// gemini_agent.js — one conversational turn of Gemini driving the real MCP tools.
//
// runTurn() takes the prior history/workspace and returns the updated envelope.
// The HTTP host durably stores signed continuation receipts and lyrics tools
// own private run state. This driver preserves that host-owned state across
// model calls; an extracted historical journal never counts as resumed work.
//
// The workspace rides in the ENVELOPE, never in the model's context: it goes
// browser → server → engine and back, and the model neither sees nor writes it.
// See WORKSPACE_PROPERTY in gemini_tools.js for why it cannot be a parameter.

import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { instructionsForTask, completionTaskIdentity } from './task_contract.js';
import {
  workflowFor,
  creationRefusal,
  recordCreation,
  creationQualified,
  isRecoveryOnly,
} from './lyric_workflow.js';
import { decodeState } from './state_codec.js';
import { requestContext } from './execution_context.js';
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
// KITCHEN COOKS (owner ruling 2026-09-06, M-254): who answers a revise
// question on THIS surface. Read at CALL time, not import time, so a test
// can drive both surfaces from one process; the mechanism is beside
// `declarationsFor`. `LYRIC_CHAT_WRITER=interview` restores the old surface
// for a measured comparison; anything else, including unset, cooks.
export function chatWriter() {
  return process.env.LYRIC_CHAT_WRITER === 'interview' ? 'interview' : 'kitchen';
}

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
  // One monotonic deadline covers model requests, response bodies, backoff,
  // queue wait and every tool in a model hop. Interrupted tools get one short
  // cleanup window to return their checkpoint; no further work is admitted.
  maxTurnMs: 2_400_000,
  cancelGraceMs: 1_000,
  maxOutputTokens: 2048,
  maxLyricOutputTokens: 32768,
  temperature: 0,
  // The owner raised the per-turn ceiling to $2.50 on 2026-09-02.
  // Every outer model and kitchen proposal now reserves its bounded cost
  // BEFORE dispatch against the remaining turn AND daily budgets. Returned
  // usage settles that reservation; unknown usage retains it conservatively.
  // Step limits and historical outer-model estimates do not include kitchen
  // proposal counts and are not a substitute for this shared admission gate.
  maxTurnUsd:
    Number.isFinite(Number(process.env.CHAT_MAX_TURN_USD)) &&
    Number(process.env.CHAT_MAX_TURN_USD) > 0
      ? Number(process.env.CHAT_MAX_TURN_USD)
      : 2.5,
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
  // These overrides declare the configured chat model's price, not a price
  // for every unknown model a separate kitchen configuration could select.
  if (model !== (process.env.GEMINI_MODEL || DEFAULT_MODEL)) return null;
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
      const {
        [STATE_PROPERTY]: _state,
        checkpoint: _checkpoint,
        replay_draft: _replay,
        ...visible
      } = verdict;
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
  const {
    workspace: _workspace,
    [STATE_PROPERTY]: _state,
    checkpoint: _checkpoint,
    replay_draft: _replay,
    ...visible
  } = parsed;
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
  return Math.min(32_000, bodyHintMs(json) ?? 1000 * 2 ** attempt);
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
    status: typeof v?.status === 'string' ? v.status : null,
    certified: typeof v?.certified === 'boolean' ? v.certified : null,
    coverage: v?.coverage ?? null,
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
    // THE PROPOSAL RECORD (M-235): which question the call left open, which
    // one its answer folded and what verify made of it, the head of the
    // answer the model sent, the draft's fingerprint, and at a stop the song
    // the loop stopped on. Null where the verb stamped none.
    asked: v?.asked && typeof v.asked === 'object' ? v.asked : null,
    folded: v?.folded && typeof v.folded === 'object' ? v.folded : null,
    verified_outcomes: Array.isArray(v?.verified_outcomes) ? v.verified_outcomes : null,
    verified_outcomes_error: v?.verified_outcomes_error ?? null,
    verified_outcomes_draft_sha256: v?.verified_outcomes_draft_sha256 ?? null,
    journal_id: v?.journal_id ?? null,
    resume_proof: v?.resume_proof ?? null,
    resume_proof_error: v?.resume_proof_error ?? null,
    answer_sent: typeof v?.answer_sent === 'string' ? v.answer_sent : null,
    draft_fp: typeof v?.draft_fp === 'string' ? v.draft_fp : null,
    final_draft_sha256: typeof v?.final_draft_sha256 === 'string' ? v.final_draft_sha256 : null,
    run_revision: v?.run_revision ?? null,
    song_at_stop: typeof v?.song_at_stop === 'string' ? v.song_at_stop : null,
    // THE RUN THE TOOL REMEMBERED (M-237): its id, and which of the state,
    // the draft and the declarations the TOOL filled in (the wrapper's own
    // `draft_carried`/`declarations_carried` stay its own count).
    run_id: typeof v?.run_id === 'string' ? v.run_id : null,
    run_state_carried: v?.run_state_carried === true,
    run_draft_carried: v?.run_draft_carried === true,
    run_decl_carried: v?.run_decl_carried === true,
    // THE KITCHEN'S BILL (M-254/M-255): who wrote the lines, and what the
    // server's own writer spent doing it — calls, wall, tokens, empties,
    // retries, seconds waited on 429s. A battery row that cannot say what a
    // kitchen run cost is the row round 24 would be read wrong from.
    writer: typeof v?.writer === 'string' ? v.writer : null,
    proposer_model: typeof v?.proposer_model === 'string' ? v.proposer_model : null,
    proposer_calls: typeof v?.proposer_calls === 'number' ? v.proposer_calls : null,
    proposer_ms: typeof v?.proposer_ms === 'number' ? v.proposer_ms : null,
    proposer_ms_max: typeof v?.proposer_ms_max === 'number' ? v.proposer_ms_max : null,
    proposer_tokens_in: typeof v?.proposer_tokens_in === 'number' ? v.proposer_tokens_in : null,
    proposer_tokens_out: typeof v?.proposer_tokens_out === 'number' ? v.proposer_tokens_out : null,
    proposer_tokens_thoughts:
      typeof v?.proposer_tokens_thoughts === 'number' ? v.proposer_tokens_thoughts : null,
    proposer_cost_usd: typeof v?.proposer_cost_usd === 'number' ? v.proposer_cost_usd : null,
    checkpoint: v?.checkpoint ?? null,
    final_draft: Array.isArray(v?.final_draft) ? v.final_draft : null,
    proposer_empty: typeof v?.proposer_empty === 'number' ? v.proposer_empty : null,
    proposer_retries: typeof v?.proposer_retries === 'number' ? v.proposer_retries : null,
    proposer_wait_s: typeof v?.proposer_wait_s === 'number' ? v.proposer_wait_s : null,
    // THE FINDINGS STANDING AT THE STOP, on the record (round 24's smoke run,
    // 2026-09-07): six kitchen runs parked on the same two chorus lines and
    // the rows said "UNRESOLVED: L5, L6" and never WHY — the verdict's
    // `standing` (M-232) reached the model and no row. The report's two
    // counts ride with it (never summed, M-186).
    standing: Array.isArray(v?.standing) ? v.standing.slice(0, 24) : null,
    flags: typeof v?.flags === 'number' ? v.flags : null,
    whole_flags: typeof v?.whole_flags === 'number' ? v.whole_flags : null,
  };
}

export const _agentInternals = {
  chatWriter,
  loopFields,
  PARKED_RUN_NOTE,
  SKIPPED_STEPS_NOTE,
  lyricCallsOnRecord,
  parkedRefusal,
  toFunctionResponse,
  suspendedSeed,
  buildSystemInstruction,
  carryState,
  stateKey,
  carriedKey,
  pruneHistory,
  stubSupersededInPlace,
};

// Unlike fetch's signal alone, this also bounds a response-body reader or
// injected transport which fails to observe cancellation. The underlying
// operation still receives the same signal so real work stops too.
function abortable(operation, signal, graceMs = 0) {
  if (!signal) return Promise.resolve().then(operation);
  return new Promise((resolve, reject) => {
    let timer;
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      fn(value);
    };
    const abort = () => {
      const fail = () => finish(reject, signal.reason || new Error('CANCELLED'));
      if (graceMs > 0) timer = setTimeout(fail, graceMs);
      else fail();
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      finish(reject, signal.reason || new Error('CANCELLED'));
      return;
    }
    Promise.resolve()
      .then(() => {
        if (signal.aborted) throw signal.reason;
        return operation();
      })
      .then(
        (value) => finish(resolve, value),
        (err) => finish(reject, err)
      );
  });
}

function waitForRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const done = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function generate({
  apiKey,
  model,
  body,
  signal,
  retries = 0,
  retryStatuses = RETRY_ALL,
  rateLimit = null,
  onRetry,
  onDispatch,
  budget,
  beforeRequest,
}) {
  let rateLimited = 0;
  let waited = 0;
  let transientRetries = 0;
  for (let attempt = 0; ; attempt++) {
    beforeRequest?.();
    if (signal?.aborted) throw signal.reason;
    const reservation = budget?.reserve({
      model,
      inputBytes: Buffer.byteLength(JSON.stringify(body)),
      maxOutputTokens: body.generationConfig.maxOutputTokens,
    });
    let res,
      json,
      settled = false,
      dispatched = false;
    try {
      res = await abortable(() => {
        beforeRequest?.();
        if (signal?.aborted) throw signal.reason;
        dispatched = true;
        onDispatch?.();
        return fetch(`${API_BASE}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal,
        });
      }, signal);
      json = await abortable(() => res.json(), signal).catch((err) => {
        if (signal?.aborted) throw err;
        return null;
      });
      if (reservation != null) {
        settled = true;
        budget.settle(reservation, {
          usage: json?.usageMetadata,
          status: res.ok
            ? json?.usageMetadata
              ? 'success'
              : 'unknown'
            : (res.status >= 400 && res.status < 500 && res.status !== 408) || res.status === 503
              ? 'rejected'
              : 'unknown',
        });
      }
    } catch (err) {
      if (reservation != null && !settled)
        budget.settle(reservation, { status: dispatched ? 'unknown' : 'rejected' });
      throw err;
    }
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
        await waitForRetry(wait, signal);
        continue;
      }
      const err = new Error(`Gemini 429: ${json?.error?.message || 'rate limited'}`);
      err.status = 429;
      err.retryAfterMs = hint;
      err.rateLimitRetries = rateLimited;
      throw err;
    }
    const retriable = retryStatuses.includes(res.status);
    if (retriable && transientRetries < retries) {
      const wait = Math.min(
        32_000,
        rateLimitHintMs(res, json) ?? retryDelayMs(json, transientRetries)
      );
      transientRetries += 1;
      if (onRetry) onRetry({ status: res.status, waitMs: wait, attempt });
      await waitForRetry(wait, signal);
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

// ── THE SKIPPED-STEPS REMINDER (M-162, owner's go 2026-09-06) ──────────────
// The model skipped lyric_sweep and lyric_screen in 2 of 2 battery rounds
// that reached it, opening with lyric_plan on a hand-round seed (9999) —
// against the standing rule that NOTHING SKIPS A STEP: sweep → screen → plan
// → write → grade → revise to a stop condition. The server cannot REFUSE at
// the tool door (a deliberate seed from an MCP client is a legitimate
// declaration), so the cure is M-158's own shape one step earlier: a
// MECHANICAL note in the systemInstruction, present while the transcript
// holds no lyric_sweep and no lyric_screen call, naming the steps not yet
// taken, rebuilt every hop from the live record so it disappears the moment
// either lands. It STATES and never blocks. Chat surface only — this driver
// is the chat surface; MCP clients never pass through it. Held for the
// owner's go rather than shipped when designed, because a nudge the server
// writes into every conversation is a policy; the go came 2026-09-06.
const LYRIC_STEPS_BEFORE_PLAN = ['lyric_sweep', 'lyric_screen'];

/** The lyric_* tool names the transcript's model turns have called so far. */
export function lyricCallsOnRecord(contents) {
  const seen = new Set();
  for (const entry of contents || []) {
    if (!entry || entry.role !== 'model') continue;
    for (const part of entry.parts || []) {
      const name = part?.functionCall?.name;
      if (typeof name === 'string' && name.startsWith('lyric_')) seen.add(name);
    }
  }
  return seen;
}

function SKIPPED_STEPS_NOTE(record) {
  const missing = LYRIC_STEPS_BEFORE_PLAN.filter((n) => !record.has(n));
  if (!missing.length) return null;
  const planned = record.has('lyric_plan') || record.has('lyric_revise');
  const what = {
    lyric_sweep:
      'lyric_sweep chooses the seed by declaring the shape you want — a hand-round seed is a guess the sweep exists to replace',
    lyric_screen:
      'lyric_screen checks candidate end-word pairs BEFORE you write — a banned pair (HOMEOTELEUTON / MODAL_RHYME) is an answer, pick other words',
  };
  return (
    'WORKING ORDER (mechanical reminder): this conversation has not yet called ' +
    missing.join(' or ') +
    '. Nothing skips a step — sweep, then screen, then plan, then write, then grade, then revise to a stop condition. ' +
    missing.map((n) => what[n]).join('; ') +
    '. ' +
    (planned
      ? 'lyric_plan has already been called without ' +
        (missing.length === 2 ? 'them' : 'it') +
        ': screen your end words before writing a line, and sweep before planning again. '
      : '') +
    'This note goes away once ' +
    (missing.length === 2 ? 'both are' : 'it is') +
    ' on the record.'
  );
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
  `A lyric_revise run for ${typeof seed === 'number' ? `seed ${seed}` : seed} is SUSPENDED, awaiting an answer. ` +
  'Nothing you write in chat reaches the harness: the run advances ONLY ' +
  'when you call lyric_revise again with `seed` and `answer` (or `answers`) — NOTHING ELSE. ' +
  'When the question asked about SEVERAL lines at once, send `answers` instead of `answer`: ' +
  'one {line, text} object per asked line, every one required, nothing else (M-236, M-248). ' +
  'Do NOT send `draft`: the draft and the state are carried for you, and a ' +
  're-sent draft is where the call has broken before. Put the line(s) in the ' +
  "tool call's `answer`/`answers` field — do not print them as your reply. The song " +
  'cannot finish until the loop reaches a stop condition through that tool.';

// THE PARKED-RUN REMINDER (M-232, round 18). A run that reached exit 3 is
// PARKED: no question is pending, the loop said a round of the same kind
// would fix nothing, and the only way forward is a REWRITE of the open
// lines by the writer. Round 18's turn 1 sent `answer` with no state three
// times and then the same draft once, and parked again on the same lines.
// The note names the open lines, the whole-draft flags and the standing
// findings, and the one call that continues the song.
function PARKED_RUN_NOTE(lyr) {
  const who = typeof lyr.seed === 'number' ? `seed ${lyr.seed}` : 'the declared mandate';
  const open = Array.isArray(lyr.open) && lyr.open.length ? lyr.open.join(', ') : null;
  const whole = Array.isArray(lyr.whole) && lyr.whole.length ? lyr.whole.join(', ') : null;
  const standing =
    Array.isArray(lyr.standing) && lyr.standing.length
      ? ' STANDING: ' + lyr.standing.slice(0, 12).join(' | ') + '.'
      : '';
  const n = Array.isArray(lyr.draft) ? lyr.draft.length : null;
  return (
    `A lyric_revise run for ${who} is ${lyr.uncertified ? 'UNCERTIFIED at exit 2' : 'PARKED at exit 3'}` +
    `${lyr.stop ? ` (${lyr.stop})` : ''}: ` +
    (open ? `line(s) ${open} are still flagged` : 'no line is open') +
    (whole ? `, and the whole-draft flag(s) ${whole} stand` : '') +
    '. The song is NOT finished and cannot be presented as finished.' +
    standing +
    ' No question is pending, so there is nothing to `answer`. The ONLY way forward: ' +
    'REWRITE the flagged line(s) yourself (new words, new end words — screen them with ' +
    'lyric_screen first), keep every other line byte-identical, and call lyric_revise ' +
    `again with \`seed\` and \`draft_text\`: the FULL song as ONE plain string, one line per row, newline-separated${n ? ` (all ${n} lines, in order)` : ''} — ` +
    'a string, NOT an array (the array is where your calls have broken). ' +
    "The run's declarations are carried for you. Do NOT send `answer` or `state`; do NOT " +
    're-send the same draft (the loop is deterministic — it parks again on the same lines); ' +
    'do NOT plan or sweep again. Put the lines in the tool call, not in your reply.'
  );
}

// THE DECLARATION THE MODEL SEES WHILE A RUN IS SUSPENDED HAS NO `draft`
// (M-226). Prose asks; a schema decides. With a record carried for a seed,
// the continuing lyric_revise call is filled from it, so the parameter is
// removed from the declaration for that request and the model has nothing to
// re-emit. The first call of a song, with no record, sees the full schema.
// The arguments that DECLARE a run, as opposed to answer it: everything but
// the draft, the answer and the carried state. Stored on the record at the
// first suspended call and re-applied on every continuing one (M-229).
const RUN_ANSWER_FIELDS = new Set([
  'draft',
  'draft_text',
  'answer',
  'answers',
  'run_id',
  'run_revision',
  'checkpoint',
  'final_draft',
  'replay_draft',
  'new_run',
  STATE_PROPERTY,
]);
export function declarationArgs(args) {
  const out = {};
  for (const [k, v] of Object.entries(args || {})) if (!RUN_ANSWER_FIELDS.has(k)) out[k] = v;
  return out;
}
// The fields that KEY a run (stateKey's coordinates) — the only declaration
// fields the model still sees while a run is suspended, so a continuing call
// can name the run it continues and nothing else.
const RUN_KEY_FIELDS = new Set(['seed', 'scheme', 'groups', 'returns', 'relation', 'structures']);

// KITCHEN COOKS (owner ruling 2026-09-06, M-254). On THIS surface the chat
// model never answers a revise question: every lyric_revise call it makes is
// sent with `writer: 'kitchen'`, and the interview fields (`state`, `answer`,
// `answers`, `writer`) leave the declaration it sees, so there is nothing to
// fumble. The server's own writer (mcp/gemini_proposer.py) takes the loop to
// a stop condition. `LYRIC_CHAT_WRITER=interview` restores the old surface
// for a measured comparison. Explicit recovery-only exports carry the original
// checkpoint unchanged and never enter the writer.
const INTERVIEW_FIELDS = new Set(['state', 'answer', 'answers', 'writer', 'checkpoint', 'run_id']);
const RECOVERY_FIELDS = new Set(['recover_only', 'recovery_part', 'checkpoint']);

export function declarationsFor(surface, lyr, writer = chatWriter()) {
  const base =
    writer === 'kitchen'
      ? surface.declarations.map((d) => {
          if (!surface.stateTools?.has(d.name) || !d.parameters?.properties) return d;
          const properties = {};
          for (const [k, v] of Object.entries(d.parameters.properties)) {
            if (k === 'checkpoint' && d.parameters.properties.recover_only)
              properties[k] = {
                ...v,
                description:
                  'Only with recover_only:true: the explicit original state/checkpoint envelope to export without replay. Omit every execution field; optionally set recovery_part. Ordinary revision carries its checkpoint automatically.',
              };
            else if (!INTERVIEW_FIELDS.has(k)) properties[k] = v;
          }
          const required = Array.isArray(d.parameters.required)
            ? d.parameters.required.filter((n) => n in properties)
            : d.parameters.required;
          return {
            ...d,
            parameters: { ...d.parameters, properties, ...(required ? { required } : {}) },
          };
        })
      : surface.declarations;
  return declarationsForRun({ ...surface, declarations: base }, lyr);
}

function declarationsForRun(surface, lyr) {
  // M-232: a PARKED run's continuing call is the rewritten draft plus the
  // run's key — no `answer`, no `state` — the mirror image of a suspended one.
  // M-234: the rewritten draft is sent as ONE string (`draft_text`) where the
  // tool offers it — round 20's six malformed rewrites all broke inside the
  // array — and the array property leaves the parked declaration.
  const parked = isParked(lyr);
  if (
    !parked &&
    (!lyr || (!lyr.resumable && typeof lyr.state !== 'string') || !Array.isArray(lyr.draft))
  )
    return surface.declarations;
  return surface.declarations.map((d) => {
    if (!surface.stateTools?.has(d.name) || !d.parameters?.properties?.draft) return d;
    // M-248: a suspended run's call is `answers` (a batch or a group) or
    // `answer` (one line) plus the run's key — both stay declared.
    const keep = parked
      ? new Set([d.parameters.properties.draft_text ? 'draft_text' : 'draft', 'new_run'])
      : lyr.resumable
        ? new Set()
        : new Set(['answer', 'answers']);
    // M-226 dropped `draft`; M-229 drops every other declaration field too —
    // while a run is suspended the call is the answer plus the run's key, and
    // the connector puts the run's own declarations back (declarationArgs).
    const properties = {};
    for (const [k, v] of Object.entries(d.parameters.properties))
      if (keep.has(k) || RUN_KEY_FIELDS.has(k) || RECOVERY_FIELDS.has(k)) properties[k] = v;
    let required = Array.isArray(d.parameters.required)
      ? d.parameters.required.filter((n) => n in properties)
      : d.parameters.required;
    if (
      !properties.recover_only &&
      keep.has('draft_text') &&
      Array.isArray(required) &&
      !required.includes('draft_text')
    )
      required = [...required, 'draft_text'];
    return {
      ...d,
      parameters: { ...d.parameters, properties, ...(required ? { required } : {}) },
    };
  });
}

// A CALL THAT WANDERS OFF A SUSPENDED RUN IS REFUSED BY THE CONNECTOR (M-229).
// Round 16's turn 0: with a run suspended at answers 0, the model swept
// again, planned twice more, and graded two fresh drafts — fourteen hops and
// the question never answered. While a lyric_revise run is SUSPENDED (a
// question pending), a call that plans or sweeps or recovers a song, or
// that grades/checks/revises a DIFFERENT run, gets an error result naming
// the suspended run and the one call that continues it. Screening words and
// asking about rhyme types stay open — they help answer.
const WANDER_ALWAYS = new Set(['lyric_plan', 'lyric_sweep', 'lyric_recover']);
const WANDER_KEYED = new Set(['lyric_grade', 'lyric_check', 'lyric_revise']);
export function wanderRefusal(lyr, name, args) {
  if (isParked(lyr)) return parkedRefusal(lyr, name, args);
  if (lyr?.uncertain_proposal && name === 'lyric_revise' && args.new_run !== true) {
    return 'REFUSED by the connector: the previous proposal has an unknown outcome. Preserve its accepted draft; only an explicit new_run starts independent work.';
  }
  if (
    lyr?.resumable &&
    (WANDER_ALWAYS.has(name) ||
      (WANDER_KEYED.has(name) && stateKey(args) != null && stateKey(args) !== carriedKey(lyr)))
  ) {
    return 'REFUSED by the connector: the kitchen has an interrupted checkpoint. Resume lyric_revise for the same seed or mandate; do not restart the song.';
  }
  const seed = suspendedSeed(lyr);
  if (seed == null) return null;
  let where = null;
  if (WANDER_ALWAYS.has(name)) where = `${name} starts another song`;
  else if (WANDER_KEYED.has(name)) {
    const k = stateKey(args);
    if (k != null && k !== carriedKey(lyr)) where = `${name} names a different run (${k})`;
  }
  if (!where) return null;
  let answers = null;
  try {
    const st = decodeState(lyr.state);
    answers = Array.isArray(st?.answered?.propose)
      ? st.answered.propose.length + (st.answered.propose_group?.length || 0)
      : null;
  } catch {
    /* the count is disclosure, not a gate */
  }
  return (
    `REFUSED by the connector: a lyric_revise run for ${typeof seed === 'number' ? `seed ${seed}` : seed} is SUSPENDED` +
    `${answers == null ? '' : ` with ${answers} answer(s) on record`}, awaiting one answer, and ${where}. ` +
    'Finish the suspended run first: call lyric_revise with `answer` (and the same seed). ' +
    'The song cannot finish through any other call.'
  );
}

// A PARKED RUN'S REFUSALS (M-232). While a run is parked at exit 3: a plan,
// sweep or recover starts another song; a grade/check/revise naming another
// run wanders; and a lyric_revise for THIS run that answers a question that
// is not pending, omits the draft, or re-sends the draft that just parked is
// refused with the one move that continues the song. A rewritten draft goes
// through with the run's declarations re-applied.
export function isParked(lyr) {
  return !!(lyr && lyr.parked === true && typeof lyr.state !== 'string');
}
// The same split mcp/lyric_tools.js `draftFromText` makes (kept in step by a
// pin in mcp/test.mjs): trim, drop blank rows and bracketed [SECTION] rows.
export function splitDraftText(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^\[[^\]]*\]$/.test(l));
}
function sameDraft(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((l, i) => String(l).trim() === String(b[i]).trim())
  );
}
function parkedRefusal(lyr, name, args) {
  const who = typeof lyr.seed === 'number' ? `seed ${lyr.seed}` : 'the declared mandate';
  const open = Array.isArray(lyr.open) && lyr.open.length ? lyr.open.join(', ') : 'none';
  const tail = ` Continue it: rewrite the open line(s) (${open}) and call lyric_revise with \`seed\` and \`draft_text\` (the full song as ONE newline-separated string) — no \`answer\`, no \`state\`. The song cannot finish through any other call.`;
  const head = `REFUSED by the connector: a lyric_revise run for ${who} is PARKED at exit 3 (no question pending)`;
  if (WANDER_ALWAYS.has(name)) return `${head}, and ${name} starts another song.${tail}`;
  if (WANDER_KEYED.has(name)) {
    const k = stateKey(args);
    if (k != null && k !== carriedKey(lyr))
      return `${head}, and ${name} names a different run (${k}).${tail}`;
  }
  if (name !== 'lyric_revise') return null;
  if (args && (args.answer != null || args.answers != null || args[STATE_PROPERTY] != null))
    return `${head}, and this call sends \`answer\`/\`state\` — there is no question to answer.${tail}`;
  if (!Array.isArray(args?.draft))
    return `${head}, and this call omits the draft — a parked run is continued by a REWRITTEN draft (\`draft_text\`), which only you can write.${tail}`;
  if (sameDraft(args.draft, lyr.draft))
    return `${head}, and this call re-sends the SAME draft that parked — the loop is deterministic and would park again on the same lines.${tail}`;
  return null;
}

function suspendedSeed(lyr) {
  if (!lyr || typeof lyr.state !== 'string') return null;
  try {
    const st = decodeState(lyr.state);
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

function carryState(prev, toolName, args, verdict, surface) {
  if (!surface.stateTools?.has(toolName)) return prev;
  const key = stateKey(args);
  if (key == null) return prev;
  const code = verdict && typeof verdict.exit_code === 'number' ? verdict.exit_code : null;
  if (
    ['interrupted', 'uncertain_proposal'].includes(verdict?.status) &&
    typeof verdict.checkpoint === 'string'
  ) {
    return {
      key,
      seed: typeof args.seed === 'number' ? args.seed : null,
      resumable: verdict.status === 'interrupted',
      uncertain_proposal: verdict.status === 'uncertain_proposal',
      checkpoint: verdict.checkpoint,
      ...(typeof verdict.run_id === 'string' ? { run_id: verdict.run_id } : {}),
      draft: verdict.replay_draft ?? args.draft ?? prev?.replay_draft ?? prev?.draft,
      replay_draft: verdict.replay_draft ?? args.draft ?? prev?.replay_draft ?? prev?.draft,
      final_draft: verdict.final_draft ?? prev?.final_draft,
      decl: declarationArgs(args),
    };
  }
  if (code === 4 && typeof verdict[STATE_PROPERTY] === 'string') {
    return {
      key,
      seed: typeof args.seed === 'number' ? args.seed : null,
      state: verdict[STATE_PROPERTY],
      ...(typeof verdict.run_id === 'string' ? { run_id: verdict.run_id } : {}),
      ...(verdict.checkpoint != null ? { checkpoint: verdict.checkpoint } : {}),
      // THE DRAFT RIDES WITH THE RECORD (M-221). A deferred run replays its
      // answers onto ONE draft, so the draft is constant across a run's
      // calls by the harness's own contract — and the model was re-emitting
      // every line of it, quoted, on every fold. Carried here so a
      // continuing call may omit it; the tool refuses an omitted draft that
      // nothing carries, in its own words.
      // Present only when a draft is known — a record with none is
      // byte-identical to the pre-M-221 shape, so nothing that read it moves.
      ...(Array.isArray(verdict.replay_draft)
        ? { draft: verdict.replay_draft, replay_draft: verdict.replay_draft }
        : Array.isArray(args.draft)
          ? { draft: args.draft }
          : Array.isArray(prev?.draft)
            ? { draft: prev.draft }
            : {}),
      // THE DECLARATIONS RIDE TOO (M-229, round 16). A seeded plan is a pure
      // function of the seed AND the declarations (form, lines, functions,
      // relation, title, budget knobs); round 16 changed one mid-run and the
      // harness refused the 20-line carried draft against a 39-line plan,
      // twice. The run's own declarations are pinned here and put back on
      // every continuing call.
      decl: declarationArgs(args),
    };
  }
  if (
    (code === 3 || verdict?.status === 'uncertified') &&
    !(prev && typeof prev.state === 'string' && carriedKey(prev) !== key)
  ) {
    // M-232: PARKED, not dropped (a stop on ANOTHER key while this one is
    // suspended still does not touch the suspended run). The record keeps the draft that parked,
    // the run's declarations, the open lines, the whole-draft flags and the
    // standing findings — no state, because no question is pending — so
    // the next call for this run is the rewritten draft and nothing else.
    const draft = Array.isArray(verdict.final_draft)
      ? verdict.final_draft
      : Array.isArray(args.draft)
        ? args.draft
        : Array.isArray(prev?.draft) && carriedKey(prev) === key
          ? prev.draft
          : null;
    return {
      key,
      seed: typeof args.seed === 'number' ? args.seed : null,
      parked: true,
      exit_code: code,
      uncertified: verdict?.status === 'uncertified',
      coverage: verdict.coverage ?? null,
      ...(typeof verdict.run_id === 'string' ? { run_id: verdict.run_id } : {}),
      ...(verdict.checkpoint != null ? { checkpoint: verdict.checkpoint } : {}),
      ...(draft ? { draft, final_draft: draft } : {}),
      ...(Array.isArray(verdict.replay_draft) ? { replay_draft: verdict.replay_draft } : {}),
      decl: declarationArgs(args),
      stop: typeof verdict.loop_stop_reason === 'string' ? verdict.loop_stop_reason : null,
      open: Array.isArray(verdict.loop_unresolved_lines) ? verdict.loop_unresolved_lines : [],
      whole: Array.isArray(verdict.loop_whole_flag_codes) ? verdict.loop_whole_flag_codes : [],
      standing: Array.isArray(verdict.standing) ? verdict.standing.slice(0, 24) : [],
    };
  }
  if (code === 0 && prev && carriedKey(prev) === key) return null;
  return prev;
}

// A record written before M-195 carries `seed` and no `key`; read it as its
// seed's key so a browser holding an older envelope keeps its run.
function carriedKey(lyr) {
  if (!lyr) return null;
  if (typeof lyr.key === 'string') return lyr.key;
  return typeof lyr.seed === 'number' ? `seed:${lyr.seed}` : null;
}

// `record` is the Set `lyricCallsOnRecord` returns for the live transcript.
// Omitted (null) means "no record to read" and no skipped-steps note is
// written — the two-argument contract every earlier caller and test holds.
function buildSystemInstruction(surface, lyr, record = null, task = null) {
  const seed = suspendedSeed(lyr);
  const text = [
    task ? instructionsForTask(surface.instructions || '', task.domain) : surface.instructions,
    task
      ? `ACTIVE TASK (chosen by the user and held by the host): ${JSON.stringify({ ...task, artifact: undefined })}. Stay in this domain. The brief and current plan remain authoritative even when observations have been pruned.`
      : null,
    task?.domain === 'recipe'
      ? task.phase === 'browse'
        ? 'Return the requested stock Rich recipe verbatim, at most 1000 characters. Only recording recipe tools are available for this task.'
        : 'Customize the recording with edit_recipe before returning its final Rich recipe verbatim, at most 1000 characters. Only recording recipe tools are available for this task.'
      : null,
    record && (!task || task.domain === 'lyrics') ? SKIPPED_STEPS_NOTE(record) : null,
    seed == null ? null : SUSPENDED_RUN_NOTE(seed),
    isParked(lyr) ? PARKED_RUN_NOTE(lyr) : null,
    lyr?.uncertain_proposal
      ? 'The kitchen stopped before a provider answer was safely journalled; that request may already have completed. Do not automatically resume or restart it. Report the exact accepted draft and uncertainty. An explicit new_run on that draft starts independent work; it may repeat a provider request which already incurred a charge.'
      : null,
    lyr?.resumable
      ? 'The kitchen was interrupted with an exact checkpoint. Call lyric_revise with the same seed or mandate; the accepted lines and proposal journal are carried. Do not rewrite or restart the song.'
      : null,
  ]
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
// THE IN-TURN STUB (M-228, round 14's named wall). pruneHistory stubs a
// superseded lyric result only in turns OLDER than the newest, so inside one
// turn every fold's brief rode every later hop: round 12 re-sent twelve
// superseded briefs on hop 14 and handed back a 328 KB transcript; round 14
// carried 213–282 KB after each turn and its turn 6 died on three 502s. This
// pass stubs a lyric_* functionResponse anywhere in the transcript once a
// LATER result of the same tool exists — the model has already acted on it,
// and the newest result of each tool (the pending question, the latest
// grade) stays verbatim. Same stub, same note, same idempotence as
// pruneHistory; model parts (and their thoughtSignatures) are untouched.
// Applied in place between hops so the next request carries only what the
// model still needs, and the handed-back history is already stubbed.
function stubSupersededInPlace(contents) {
  if (!Array.isArray(contents) || !contents.length) return 0;
  const newest = new Map();
  contents.forEach((entry, i) => {
    for (const p of entry?.parts || []) {
      const name = p?.functionResponse?.name;
      if (typeof name === 'string' && PRUNED_FAMILY.test(name)) newest.set(name, i);
    }
  });
  let stubbed = 0;
  contents.forEach((entry, i) => {
    if (entry?.role !== 'user') return;
    let changed = false;
    const parts = (entry.parts || []).map((p) => {
      const fr = p?.functionResponse;
      if (!fr || !PRUNED_FAMILY.test(fr.name || '') || newest.get(fr.name) === i) return p;
      if (fr.response && fr.response.pruned === PRUNED_NOTE) return p;
      const s = stubResponse(fr);
      if (!s) return p;
      changed = true;
      stubbed += 1;
      return { ...p, functionResponse: s };
    });
    if (changed) contents[i] = { ...entry, parts };
  });
  return stubbed;
}

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
  // KITCHEN COOKS (M-254): who answers a revise question on this surface —
  // the declared default, overridable per call so a test drives both
  // surfaces without touching the process environment.
  writer = chatWriter(),
  apiKey,
  model = DEFAULT_MODEL,
  surface,
  callTool,
  history = [],
  workspace = null,
  lyric = null,
  task = null,
  userText,
  thinking = DEFAULT_THINKING,
  limits = LIMITS,
  retries = 0,
  retryStatuses = RETRY_ALL,
  rateLimit = null,
  signal,
  onEvent,
  onCheckpoint,
  budget = requestContext()?.budget,
  clock = () => performance.now(),
}) {
  // THE ONE ASSEMBLY SITE. The prior transcript is pruned here and the
  // pruned transcript is what goes back in the envelope, so a fold is
  // stubbed once and stays stubbed — pruneHistory is idempotent.
  // The trusted host owns task identity. Copy before updating workflow facts;
  // model arguments can never change this record or its authorization.
  task = task ? structuredClone(task) : null;
  workflowFor(task);
  const completedSteps = new Set(task?.completedSteps || []);
  if (task) {
    task.turns = (task.turns || 0) + 1;
    task.instructions = [...(task.instructions || []), userText];
  }
  let artifact = task?.artifact ? { ...task.artifact, certified: false } : null;
  let recoveredDelivery = null;
  if (task?.artifact) task.artifact = artifact;
  const prior = limits.pruneFolded
    ? pruneHistory(history, { keepTurns: limits.pruneKeepTurns, maxBytes: limits.pruneMaxBytes })
    : history;
  const contents = [...prior, { role: 'user', parts: [{ text: userText }] }];
  let safeHistory = [...contents];
  let safeWorkspace = workspace;
  let safeLyric = lyric;
  const usage = {
    promptTokens: 0,
    candidatesTokens: 0,
    thoughtsTokens: 0,
    requests: 0,
    providerAttempts: 0,
    retries: 0,
    malformedRetries: 0,
    kitchenUsd: 0,
    kitchenUnpriced: false,
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
  // M-233 (round 19): a PARKED record has no state string and was dropped
  // here at the turn boundary — the park was carried out of turn 1 and
  // thrown away at the top of turn 2, which then sent a draft-less call,
  // moved a declaration, planned again and restarted the run. A record is
  // carried when it is suspended (state) OR parked.
  let lyr =
    lyric &&
    (typeof lyric.state === 'string' ||
      lyric.parked === true ||
      typeof lyric.checkpoint === 'string')
      ? lyric
      : null;
  let stopped = null;
  let stoppedDetail = null;
  let reply = '';

  const body = {
    contents,
    tools: [{ functionDeclarations: surface.declarations }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: {
      temperature: limits.temperature,
      maxOutputTokens:
        task?.domain === 'lyrics'
          ? Math.max(limits.maxOutputTokens, limits.maxLyricOutputTokens ?? 32768)
          : limits.maxOutputTokens,
      ...(thinking ? { thinkingConfig: thinking } : {}),
    },
  };

  // A THROW MID-TURN CARRIES WHAT WAS SPENT (2026-09-01, triage finding
  // C28 / `MISSING.md` M-197): only 5xx is retried, so a 429 on hop N
  // threw hops 1..N-1 away and the spend counter never saw them — every
  // billed hop before the throw was uncounted. The error now carries the
  // partial `usage` and the calls made, and `chat.js` charges it in its
  // catch before replying.
  const turnStartedAt = clock();
  const deadline = limits.maxTurnMs > 0 ? turnStartedAt + limits.maxTurnMs : Infinity;
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal.reason || new Error('CANCELLED'));
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const expire = () =>
    controller.abort(Object.assign(new Error('Turn deadline reached'), { code: 'MAX_TURN_MS' }));
  const timer = Number.isFinite(deadline)
    ? setTimeout(expire, Math.max(0, deadline - clock()))
    : null;
  const turnSignal = controller.signal;
  const totalCost = () => {
    const outer = costOf(usage, model);
    if (outer === null || usage.kitchenUnpriced) return null;
    const accounted = budget?.snapshot?.();
    return Math.max(
      outer + usage.kitchenUsd,
      accounted ? accounted.usd + accounted.reservedUsd : 0
    );
  };
  const interruption = (hops) => {
    if (clock() >= deadline && !turnSignal.aborted) expire();
    if (!turnSignal.aborted) return false;
    stopped = turnSignal.reason?.code === 'MAX_TURN_MS' ? 'MAX_TURN_MS' : 'CANCELLED';
    stoppedDetail = {
      ms: Math.max(0, clock() - turnStartedAt),
      cap: limits.maxTurnMs,
      hops,
      maxSteps: limits.maxSteps,
    };
    return true;
  };
  try {
    for (let step = 0; step < limits.maxSteps; step++) {
      if (interruption(step)) break;
      body.contents = contents;
      // Rebuilt per hop from the LIVE carried state (M-158): `lyr` moves when
      // a harvest lands mid-turn, and the reminder must move with it. The
      // skipped-steps note (M-162) reads the transcript the same way, so it
      // disappears on the hop after a sweep or a screen lands.
      const si = buildSystemInstruction(
        surface,
        lyr,
        task ? completedSteps : lyricCallsOnRecord(contents),
        task
      );
      if (si) body.systemInstruction = si;
      else delete body.systemInstruction;
      // Per hop, like the reminder: the record can appear mid-turn (M-226).
      body.tools = [
        {
          functionDeclarations: declarationsFor(surface, lyr, writer).filter(
            (d) => !task || (task.domain === 'lyrics') === d.name.startsWith('lyric_')
          ),
        },
      ];
      let json;
      try {
        json = await generate({
          apiKey,
          model,
          body,
          signal: turnSignal,
          retries,
          retryStatuses,
          rateLimit,
          budget,
          beforeRequest: () => {
            if (clock() >= deadline) expire();
          },
          // A retried request spent a slot of the key's quota whether or not it
          // was billed tokens; the count is the record (M-197, M-168).
          onDispatch: () => {
            usage.providerAttempts += 1;
          },
          onRetry: (r) => {
            usage.requests += 1;
            usage.retries += 1;
            if (onEvent) onEvent({ type: 'retry', ...r });
          },
        });
      } catch (err) {
        // A TURN THAT HAS ALREADY MADE CALLS IS RETURNED, NOT THROWN AWAY
        // (M-232, round 18): turn 0's second attempt folded six answers over
        // ten hops and a Gemini 503 on hop eleven threw all six away — the
        // driver's retry re-sent the turn from the previous envelope. When
        // the upstream dies AFTER a hop that made calls, the turn ends here:
        // the calls stand, the carried record stands, and the transcript is
        // closed with a model-role note so the next user message continues
        // it. A failure before any call still throws (nothing to keep) and
        // an aborted request throws (the client is gone).
        // A 429 keeps throwing whatever the hop: its Retry-After is the
        // driver's pacing signal (M-229) and its usage rides the error
        // (M-197's pin); the bounded in-hop retry has already absorbed a
        // short one. The partial return is for the engine dying (5xx, a
        // dropped socket), which no wait cures within the turn.
        if (interruption(step + 1)) break;
        if (
          err?.code === 'MAX_TURN_COST' ||
          err?.code === 'DAILY_BUDGET' ||
          err?.code === 'UNPRICED_MODEL' ||
          err?.code === 'ACCOUNTING_UNAVAILABLE'
        ) {
          stopped = err.code;
          stoppedDetail = { detail: err.message, hops: step, maxSteps: limits.maxSteps };
          break;
        }
        if (!calls.length) throw err;
        const status = Number.isFinite(err?.status) ? err.status : null;
        stopped = `UPSTREAM_${status ?? 'ERROR'}`;
        stoppedDetail = {
          status,
          retry_after_ms: Number.isFinite(err?.retryAfterMs) ? err.retryAfterMs : null,
          detail: String((err && err.message) || err).slice(0, 300),
          hops: step + 1,
          calls: calls.length,
          maxSteps: limits.maxSteps,
        };
        contents.push({
          role: 'model',
          parts: [
            {
              text:
                `(the engine was interrupted here — upstream ${status ?? 'error'}; ` +
                'the tool calls above stand and the run continues from them)',
            },
          ],
        });
        if (onEvent) onEvent({ type: 'stopped', reason: stopped, status });
        break;
      }
      addUsage(usage, json?.usageMetadata);
      const candidate = json?.candidates?.[0];
      const rawParts = candidate?.content?.parts;
      const parts = Array.isArray(rawParts)
        ? rawParts.filter(
            (p) =>
              p &&
              typeof p === 'object' &&
              ((typeof p.text === 'string' && p.text.length > 0) ||
                (p.functionCall &&
                  typeof p.functionCall.name === 'string' &&
                  p.functionCall.name.length > 0))
          )
        : [];
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

      if (
        !parts.length ||
        !parts.some(
          (p) => p.functionCall || (typeof p.text === 'string' && p.text.trim() && !p.thought)
        )
      ) {
        stopped =
          candidate?.finishReason === 'MALFORMED_FUNCTION_CALL'
            ? 'MALFORMED_FUNCTION_CALL'
            : json?.promptFeedback?.blockReason
              ? 'PROVIDER_BLOCKED'
              : 'INVALID_PROVIDER_RESPONSE';
        stoppedDetail = {
          reason:
            json?.promptFeedback?.blockReason ||
            candidate?.finishReason ||
            'No usable candidate content',
          malformedRetries: malformed,
          retriesAllowed: MALFORMED_CALL_RETRY.retries,
          hops: step + 1,
          maxSteps: limits.maxSteps,
          ...(stopped === 'MALFORMED_FUNCTION_CALL'
            ? { finishMessage: malformedText(candidate) }
            : {}),
        };
        if (stopped === 'MALFORMED_FUNCTION_CALL')
          malformedHops.push({
            hop: step + 1,
            attempt: malformed + 1,
            reasked: false,
            finishMessage: malformedText(candidate),
          });
        break;
      }
      // Verbatim, including thoughtSignature; never persist an empty model turn.
      contents.push({ role: 'model', parts });

      if (!functionCalls.length) {
        if (interruption(step + 1)) break;
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
        const recoveryOnly = isRecoveryOnly(fc.name, args);
        let result;
        if (task && (task.domain === 'lyrics') !== fc.name.startsWith('lyric_')) {
          result = {
            isError: true,
            content: [
              {
                type: 'text',
                text: `REFUSED: ${fc.name} is outside the active ${task.domain} task.`,
              },
            ],
          };
          calls.push({
            name: fc.name,
            args,
            isError: true,
            not_run: true,
            error: result.content[0].text,
          });
          responses.push({ functionResponse: toFunctionResponse(fc.name, fc.id, result) });
          continue;
        }
        if (task?.domain === 'recipe') args.format = 'rich';
        const spent = totalCost();
        const overCost = limits.maxTurnUsd > 0 && (spent === null || spent >= limits.maxTurnUsd);
        if (stopped || interruption(step + 1) || overCost) {
          if (!stopped) {
            stopped = spent === null ? 'UNPRICED_MODEL' : 'MAX_TURN_COST';
            stoppedDetail = {
              usd: spent,
              cap: limits.maxTurnUsd,
              hops: step + 1,
              maxSteps: limits.maxSteps,
            };
          }
          result = {
            isError: true,
            content: [
              { type: 'text', text: `Not run: ${stopped}; continue from the returned record.` },
            ],
          };
          calls.push({
            name: fc.name,
            args,
            isError: true,
            error: result.content[0].text,
            not_run: true,
          });
          responses.push({ functionResponse: toFunctionResponse(fc.name, fc.id, result) });
          continue;
        }
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
        // M-229: a call that wanders off a suspended run is answered by the
        // connector, never sent to the harness.
        // M-234: a draft sent as one string becomes the array the tools take,
        // before any check reads it.
        if (!recoveryOnly && typeof args.draft_text === 'string' && !Array.isArray(args.draft)) {
          args.draft = splitDraftText(args.draft_text);
          delete args.draft_text;
        }
        if (
          !recoveryOnly &&
          lyr?.resumable &&
          surface.stateTools?.has(fc.name) &&
          stateKey(args) == null
        ) {
          Object.assign(args, lyr.decl);
        }
        const freshRun = !recoveryOnly && surface.stateTools?.has(fc.name) && args.new_run === true;
        const restartingUncertain = lyr?.uncertain_proposal && freshRun;
        if (restartingUncertain && surface.stateTools?.has(fc.name) && stateKey(args) == null) {
          for (const [key, value] of Object.entries(lyr.decl || {}))
            if (args[key] === undefined) args[key] = value;
        }
        if (
          restartingUncertain &&
          surface.stateTools?.has(fc.name) &&
          args.draft == null &&
          Array.isArray(lyr.final_draft)
        )
          args.draft = lyr.final_draft;
        const wander = freshRun || recoveryOnly ? null : wanderRefusal(lyr, fc.name, args);
        if (wander) {
          if (lyr?.uncertain_proposal) stopped = 'UNCERTAIN_PROPOSAL';
          result = { isError: true, content: [{ type: 'text', text: `Error: ${wander}` }] };
          calls.push({
            name: fc.name,
            args,
            isError: true,
            error: wander,
            refused_by_connector: true,
            draft_carried: false,
            declarations_carried: false,
            cards: null,
            recipe: null,
            ...loopFields(null),
          });
          if (onEvent) onEvent({ type: 'tool', name: fc.name, isError: true, refused: true });
          responses.push({ functionResponse: toFunctionResponse(fc.name, fc.id, result) });
          continue;
        }
        let injectedState = false;
        let injectedDraft = false;
        let injectedDecl = false;
        if (!recoveryOnly && surface.stateTools?.has(fc.name) && !freshRun) {
          if (isParked(lyr) && stateKey(args) != null && stateKey(args) === carriedKey(lyr)) {
            // M-232: a parked run's continuing call carries its own draft
            // (the rewrite) and gets the run's declarations back; nothing
            // else is injected — there is no state and no pending question.
            delete args[STATE_PROPERTY];
            delete args.answer;
            delete args.answers;
            if (lyr.decl && typeof lyr.decl === 'object') {
              for (const k of Object.keys(args)) if (!RUN_ANSWER_FIELDS.has(k)) delete args[k];
              Object.assign(args, lyr.decl);
              injectedDecl = true;
            }
          } else if (lyr && stateKey(args) != null && stateKey(args) === carriedKey(lyr)) {
            args[STATE_PROPERTY] = lyr.state;
            injectedState = true;
            // The carried draft fills an OMITTED draft only (M-221): a draft
            // the model did send is the model's own statement and stands.
            if (args.draft == null && Array.isArray(lyr.draft)) {
              args.draft = lyr.draft;
              injectedDraft = true;
            }
            // The run's own declarations REPLACE whatever the model sent
            // (M-229): the plan is a function of them, and a moved one is a
            // different song the carried draft cannot be graded against.
            if (lyr.decl && typeof lyr.decl === 'object') {
              for (const k of Object.keys(args)) if (!RUN_ANSWER_FIELDS.has(k)) delete args[k];
              Object.assign(args, lyr.decl);
              injectedDecl = true;
            }
          } else {
            // The declaration does not expose `state`, so anything here is
            // model-fabricated; the harness would replay it through verify()
            // and refuse honestly, but a clean first call is the better run.
            delete args[STATE_PROPERTY];
          }
        }
        // KITCHEN COOKS (M-254): on this surface the server's writer answers
        // every revise question. Mechanical, not asked of the model — the
        // interview fields never reach the tool from here.
        if (
          !recoveryOnly &&
          surface.stateTools?.has(fc.name) &&
          !freshRun &&
          carriedKey(lyr) === stateKey(args)
        ) {
          if (typeof lyr?.run_id === 'string') {
            args.run_id = lyr.run_id;
            args.run_revision = lyr.run_revision;
          }
          if (lyr?.resumable && lyr.checkpoint != null) {
            args.checkpoint = lyr.checkpoint;
            delete args.new_run;
            args.draft = lyr.replay_draft ?? lyr.draft;
            injectedDraft = true;
          } else delete args.checkpoint;
          if (args.draft == null && Array.isArray(lyr?.draft)) {
            args.draft = lyr.draft;
            injectedDraft = true;
          }
        }
        if (!recoveryOnly && writer === 'kitchen' && surface.stateTools?.has(fc.name)) {
          args.writer = 'kitchen';
          delete args[STATE_PROPERTY];
          delete args.answer;
          delete args.answers;
        }
        const creationError = creationRefusal(task, fc.name, args, lyr);
        if (creationError) {
          result = { isError: true, content: [{ type: 'text', text: creationError }] };
          calls.push({
            name: fc.name,
            args,
            isError: true,
            not_run: true,
            refused_by_connector: true,
            error: creationError,
          });
          responses.push({ functionResponse: toFunctionResponse(fc.name, fc.id, result) });
          continue;
        }
        // A tool that fails — a timeout, a dropped transport — becomes an
        // ERROR RESULT the model can see and react to, never an exception
        // that kills the whole turn: under the old shape one slow call
        // turned the entire conversation into a bare 502 with the record
        // of every earlier call discarded (flash battery finding #1).
        try {
          const remainingMs = Math.max(0, deadline - clock());
          result = await abortable(
            () =>
              callTool(fc.name, args, {
                signal: turnSignal,
                task,
                budget,
                remainingMs,
                deadlineMs: Number.isFinite(remainingMs) ? Date.now() + remainingMs : undefined,
              }),
            turnSignal,
            limits.cancelGraceMs ?? 1_000
          );
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
        let recoveredExport = false;
        {
          try {
            payload = JSON.parse(result?.content?.[0]?.text ?? '');
          } catch {
            payload = null;
          }
          if (!isError && payload && payload.workspace) ws = payload.workspace;
          if (!isError && task?.domain === 'recipe') {
            if (fc.name === 'start_recipe') task.customized = false;
            if (fc.name === 'edit_recipe') task.customized = true;
          }
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
          if (
            recoveryOnly &&
            !isError &&
            payload?.status === 'recovered_artifact' &&
            payload.certified === false &&
            payload.resumable === false &&
            payload.new_run_required === true
          ) {
            // Recovery has no grading exit code. Its tool-authored JSON is the
            // export itself, including exact journal-part instructions.
            lyricVerdict = payload;
            recoveredExport = true;
          }
          // Harvest the revise state the way the workspace is harvested above:
          // the verdict block is the only place it rides, the model is never
          // shown it, and the envelope carries it to the next turn — but ONLY
          // a suspended run is carried; see `carryState`.
          if (
            !recoveryOnly &&
            !isError &&
            fc.name.startsWith('lyric_') &&
            (lyricVerdict?.exit_code ?? 0) !== 2
          ) {
            completedSteps.add(fc.name);
            if (task) {
              task.completedSteps = [...completedSteps];
              task.progress = fc.name.replace('lyric_', '');
            }
          }
          recordCreation(task, fc.name, args, lyricVerdict, isError);
          if (task?.domain === 'lyrics' && task.phase === 'create' && fc.name === 'lyric_plan') {
            artifact = null;
            task.artifact = null;
          }
          if (
            !recoveryOnly &&
            task?.domain === 'lyrics' &&
            ['lyric_grade', 'lyric_check', 'lyric_revise'].includes(fc.name)
          ) {
            // A later grade/call invalidates any earlier finish, including an error.
            const presentation =
              typeof lyricVerdict?.presentation_text === 'string'
                ? lyricVerdict.presentation_text
                : null;
            artifact = {
              text: presentation,
              final_draft: lyricVerdict?.final_draft ?? null,
              status: lyricVerdict?.status ?? 'unfinished',
              draft_fp: lyricVerdict?.draft_fp ?? null,
              final_draft_sha256: lyricVerdict?.final_draft_sha256 ?? null,
              certified:
                !recoveryOnly &&
                !isError &&
                fc.name === 'lyric_revise' &&
                creationQualified(task) &&
                lyricVerdict?.exit_code === 0 &&
                lyricVerdict?.certified === true &&
                !!presentation &&
                Array.isArray(lyricVerdict?.final_draft) &&
                lyricVerdict.final_draft_sha256 ===
                  createHash('sha256')
                    .update(JSON.stringify(lyricVerdict.final_draft))
                    .digest('hex'),
            };
            task.artifact = artifact;
          }
          if (recoveredExport) {
            recoveredDelivery = result.content[0].text;
            reply = recoveredDelivery;
            stopped = 'RECOVERY_EXPORTED';
            stoppedDetail = {
              detail: 'The original stored artifact was exported without replay or grading.',
              recovery_part: payload.recovery_part,
              next_recovery_part: payload.next_recovery_part ?? null,
            };
          }
          if (!recoveryOnly) lyr = carryState(lyr, fc.name, args, lyricVerdict, surface);
          if (!recoveryOnly && lyr && lyricVerdict?.run_revision != null)
            lyr.run_revision = lyricVerdict.run_revision;
          if (lyricVerdict?.status === 'uncertain_proposal') {
            stopped = 'UNCERTAIN_PROPOSAL';
            stoppedDetail = {
              detail:
                'The interrupted model proposal may already have incurred a charge. Its accepted draft is preserved; automatic replay is stopped.',
              calls: calls.length + 1,
            };
          }
          if (lyricVerdict?.proposer_calls > 0) {
            const kitchenCost =
              typeof lyricVerdict.proposer_cost_usd === 'number'
                ? lyricVerdict.proposer_cost_usd
                : costOf(
                    {
                      promptTokens: lyricVerdict.proposer_tokens_in,
                      candidatesTokens: lyricVerdict.proposer_tokens_out,
                      thoughtsTokens: lyricVerdict.proposer_tokens_thoughts,
                    },
                    lyricVerdict.proposer_model
                  );
            if (kitchenCost === null) usage.kitchenUnpriced = true;
            else usage.kitchenUsd += kitchenCost;
          }
        }
        calls.push({
          name: fc.name,
          // The workspace is the bulk of an edit call and is not the model's
          // output; logging it would bury the argument that IS. The injected
          // revise state is the same bulk one family over.
          args: recoveredExport
            ? {
                recover_only: true,
                recovery_part: payload.recovery_part,
                original_wire_sha256: payload.original_wire_sha256,
                original_wire_bytes: payload.original_wire_bytes,
              }
            : surface.workspaceTools.has(fc.name)
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
          // M-229: the run's declarations were re-applied over the model's.
          declarations_carried: injectedDecl,
          error: isError ? (result?.content?.[0]?.text ?? '') : null,
          cards: payload?.cards ?? null,
          recipe: payload?.recipe ?? null,
          ...loopFields(lyricVerdict),
        });
        if (onEvent) onEvent({ type: 'tool', name: fc.name, isError });
        // The original tool arguments remain verbatim in the model turn.
        // A terminal export is delivered exactly once in reply; retaining its
        // body again in history and task.artifact can exceed durable limits.
        const observation = recoveredExport
          ? {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    status: payload.status,
                    recovery_part: payload.recovery_part,
                    original_wire_sha256: payload.original_wire_sha256,
                    original_wire_bytes: payload.original_wire_bytes,
                    journal_included: payload.journal_included,
                    next_recovery_part: payload.next_recovery_part ?? null,
                    certified: false,
                    resumable: false,
                    new_run_required: true,
                    meaning:
                      'Exact recovery export delivered in the HTTP reply and durable receipt; its body is omitted from future model observations. ' +
                      payload.meaning,
                  }),
                },
              ],
            }
          : result;
        responses.push({ functionResponse: toFunctionResponse(fc.name, fc.id, observation) });
        if (onCheckpoint && responses.length < functionCalls.length) {
          // A crash during the next tool must not erase this completed one.
          // Close a COPY of the current model group for recovery, explicitly
          // marking calls which had not begun at this checkpoint. The live
          // transcript retains its original group and receives actual results.
          const pending = functionCalls.slice(responses.length).map((next) => ({
            functionResponse: toFunctionResponse(next.name, next.id, {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Not run at this checkpoint; continue from the completed calls above.',
                },
              ],
            }),
          }));
          safeHistory = [...contents, { role: 'user', parts: [...responses, ...pending] }];
          safeWorkspace = ws;
          safeLyric = lyr;
          await onCheckpoint({
            history: safeHistory,
            workspace: ws,
            lyric: lyr,
            task,
            calls,
            usage,
            cost: totalCost(),
          });
        }
      }
      // Gemini takes tool output back on the `user` turn.
      contents.push({ role: 'user', parts: responses });
      safeHistory = [...contents];
      safeWorkspace = ws;
      safeLyric = lyr;
      if (onCheckpoint)
        await onCheckpoint({
          history: contents,
          workspace: ws,
          lyric: lyr,
          task,
          calls,
          usage,
          cost: totalCost(),
        });
      if (task?.domain === 'lyrics' && artifact?.certified) {
        stopped = null;
        break;
      }
      // M-228: the brief the model just answered leaves the transcript before
      // the next request; the result it has not acted on yet stays whole.
      if (limits.pruneFolded) stubSupersededInPlace(contents);

      // Stop between hops once this turn has spent its allowance. Checked HERE,
      // after the tool responses are appended, so the transcript handed back is
      // still coherent and the next user message can continue from it — an abort
      // mid-hop would strand a functionCall with no functionResponse, which
      // Gemini rejects on the following turn.
      //
      // A null cost means the model is unpriced, which the caller is supposed to
      // have refused before getting here; if one reaches this loop anyway, stop
      // rather than run on unmetered.
      if (stopped || interruption(step + 1)) break;
      const soFar = totalCost();
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
      err.cost = totalCost();
      err.envelope = {
        history: safeHistory,
        workspace: safeWorkspace,
        ...(safeLyric != null ? { lyric: safeLyric } : {}),
        ...(task ? { task } : {}),
      };
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  let completion = null;
  if (recoveredDelivery !== null) {
    reply = recoveredDelivery;
  } else if (task?.domain === 'lyrics') {
    reply = artifact?.text || 'This song has no certified final deliverable yet.';
    if (artifact?.certified && creationQualified(task) && !stopped && artifact.draft_fp) {
      completion = {
        certified: true,
        draft_fp: artifact.draft_fp,
        final_draft_sha256: createHash('sha256')
          .update(JSON.stringify(artifact.final_draft))
          .digest('hex'),
        delivery_sha256: createHash('sha256').update(reply).digest('hex'),
        task_sha256: createHash('sha256')
          .update(JSON.stringify(completionTaskIdentity(task)))
          .digest('hex'),
      };
    } else if (!stopped) stopped = 'LYRICS_UNFINISHED';
  }
  if (task?.domain === 'recipe') {
    const recipe = [...calls]
      .reverse()
      .find((c) => !c.isError && typeof c.recipe === 'string')?.recipe;
    if (
      recipe &&
      recipe.length <= task.maxChars &&
      (!task.requiresCustomization || task.customized)
    )
      reply = recipe;
    else {
      stopped ||= 'RECIPE_UNFINISHED';
      reply = 'No customized Rich recipe has been produced yet.';
    }
  }
  return {
    reply,
    task,
    artifact,
    completion,
    history: contents,
    workspace: ws,
    lyric: lyr,
    calls,
    usage,
    cost: totalCost(),
    accounted_cost: budget ? budget.snapshot().usd + budget.snapshot().reservedUsd : null,
    usage_unknown: budget
      ? budget.snapshot().unknownUsd + budget.snapshot().reservedUsd > 0
      : false,
    stoppedDetail,
    stopped,
    malformed: malformedHops,
  };
}
