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
  // measured worst prompt in the probe suite ran $0.033; ten cents is three
  // times that, so an ordinary bad turn never sees this and a pathological one
  // stops before it matters. Without it the only per-request bound was step
  // count, and a turn that grew a large workspace could spend far more inside
  // fourteen legal hops than fourteen ordinary hops ever would.
  maxTurnUsd: Number(process.env.CHAT_MAX_TURN_USD) || 0.1,
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
function retryDelayMs(json, attempt) {
  const info = (json?.error?.details || []).find((d) => /RetryInfo/.test(d['@type'] || ''));
  const fromInfo = info?.retryDelay && /^([\d.]+)s$/.exec(info.retryDelay);
  if (fromInfo) return Math.ceil(parseFloat(fromInfo[1]) * 1000) + 250;
  const fromText = /retry in ([\d.]+)s/i.exec(json?.error?.message || '');
  if (fromText) return Math.ceil(parseFloat(fromText[1]) * 1000) + 250;
  return Math.min(32000, 1000 * 2 ** attempt);
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
export const RETRY_TRANSIENT = [500, 502, 503, 504];
export const RETRY_ALL = [429, ...RETRY_TRANSIENT];

// Test seam (the `_workerInternals` precedent): what the model is SHOWN is a
// verdict this function computes, and a suite that cannot reach it can only
// grep for the strip instead of proving it.
export const _agentInternals = { toFunctionResponse, suspendedSeed, buildSystemInstruction, carryState };

async function generate({
  apiKey,
  model,
  body,
  signal,
  retries = 0,
  retryStatuses = RETRY_ALL,
  onRetry,
}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal,
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return json;
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
const SUSPENDED_RUN_NOTE = (seed) =>
  `A lyric_revise run for seed ${seed} is SUSPENDED, awaiting one answer. ` +
  'Nothing you write in chat reaches the harness: the run advances ONLY ' +
  'when you call lyric_revise again with the same arguments plus `answer` ' +
  '(the state is carried for you automatically). Put the line in the ' +
  "tool call's `answer` field — do not print it as your reply. The song " +
  'cannot finish until the loop reaches a stop condition through that tool.';

function suspendedSeed(lyr) {
  if (!lyr || typeof lyr.state !== 'string') return null;
  try {
    const st = JSON.parse(lyr.state);
    return st && st.pending && typeof lyr.seed === 'number' ? lyr.seed : null;
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
function carryState(prev, toolName, args, verdict, surface) {
  if (!surface.stateTools?.has(toolName) || typeof args?.seed !== 'number') return prev;
  const code = verdict && typeof verdict.exit_code === 'number' ? verdict.exit_code : null;
  if (code === 4 && typeof verdict[STATE_PROPERTY] === 'string') {
    return { seed: args.seed, state: verdict[STATE_PROPERTY] };
  }
  if ((code === 0 || code === 3) && prev && prev.seed === args.seed) return null;
  return prev;
}

function buildSystemInstruction(surface, lyr) {
  const seed = suspendedSeed(lyr);
  const text = [surface.instructions, seed == null ? null : SUSPENDED_RUN_NOTE(seed)]
    .filter(Boolean)
    .join('\n\n');
  return text ? { parts: [{ text }] } : null;
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
  signal,
  onEvent,
}) {
  const contents = [...history, { role: 'user', parts: [{ text: userText }] }];
  const usage = { promptTokens: 0, candidatesTokens: 0, thoughtsTokens: 0, requests: 0 };
  const calls = [];
  let ws = workspace;
  let lyr = lyric && typeof lyric.state === 'string' ? lyric : null;
  let stopped = null;
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

  for (let step = 0; step < limits.maxSteps; step++) {
    body.contents = contents;
    // Rebuilt per hop from the LIVE carried state (M-158): `lyr` moves when
    // a harvest lands mid-turn, and the reminder must move with it.
    const si = buildSystemInstruction(surface, lyr);
    if (si) body.systemInstruction = si;
    else delete body.systemInstruction;
    const json = await generate({
      apiKey,
      model,
      body,
      signal,
      retries,
      retryStatuses,
      onRetry: (r) => onEvent && onEvent({ type: 'retry', ...r }),
    });
    addUsage(usage, json.usageMetadata);
    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

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
      if (surface.stateTools?.has(fc.name)) {
        if (lyr && args.seed === lyr.seed) {
          args[STATE_PROPERTY] = lyr.state;
          injectedState = true;
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
            ? { ...args, [STATE_PROPERTY]: '<injected>' }
            : args,
        isError,
        error: isError ? (result?.content?.[0]?.text ?? '') : null,
        cards: payload?.cards ?? null,
        recipe: payload?.recipe ?? null,
        exit_code: typeof lyricVerdict?.exit_code === 'number' ? lyricVerdict.exit_code : null,
        banned_pairs:
          typeof lyricVerdict?.banned_pairs === 'number' ? lyricVerdict.banned_pairs : null,
        // M-169: the loop's own record of the run rides beside the exit code,
        // for the reason banned_pairs does — a verdict only the model ever saw
        // protects nobody, and a transcript that cannot say how many rounds
        // bought how many lines cannot tell a slow run from a stuck one.
        // `answers_on_record` joins them: it is already computed on both the
        // suspended and the finished branch of lyric_revise and was dropped
        // here, which is how round 10's "turn 0's work was thrown away" reading
        // survived long enough to need refuting from a byte count.
        loop_stop_reason:
          typeof lyricVerdict?.loop_stop_reason === 'string' ? lyricVerdict.loop_stop_reason : null,
        loop_rounds:
          typeof lyricVerdict?.loop_rounds === 'number' ? lyricVerdict.loop_rounds : null,
        loop_unresolved:
          typeof lyricVerdict?.loop_unresolved === 'number' ? lyricVerdict.loop_unresolved : null,
        answers_on_record:
          typeof lyricVerdict?.answers_on_record === 'number'
            ? lyricVerdict.answers_on_record
            : null,
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
      if (onEvent) onEvent({ type: 'stopped', reason: stopped, usd: soFar });
      break;
    }
    if (step === limits.maxSteps - 1) stopped = 'MAX_STEPS';
  }

  return {
    reply,
    history: contents,
    workspace: ws,
    lyric: lyr,
    calls,
    usage,
    cost: costOf(usage, model),
    stopped,
  };
}
