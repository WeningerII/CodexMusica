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

import { toGeminiDeclarations, WORKSPACE_PROPERTY } from './gemini_tools.js';

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
  const { workspace: _workspace, ...visible } = parsed;
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
  const { declarations, workspaceTools } = toGeminiDeclarations(tools);
  // The server's own instructions, not a paraphrase kept in sync by hand. They
  // are the text every other MCP client already receives, so the chat bar and a
  // Claude connector are driving the engine off one description.
  const instructions =
    typeof client.getInstructions === 'function' ? client.getInstructions() : undefined;
  return { declarations, workspaceTools: new Set(workspaceTools), instructions, tools };
}

/**
 * Run one user turn to completion: the model calls tools until it answers.
 *
 * @returns {{reply:string, history:Array, workspace:object|null, calls:Array,
 *            usage:object, cost:number|null, stopped:string|null}}
 *   `history` is the full contents[] to hand back on the next turn — model parts
 *   are appended VERBATIM, which is what preserves Gemini 3's thoughtSignatures
 *   across hops (dropping them degrades multi-step tool use).
 */
export async function runTurn({
  apiKey,
  model = DEFAULT_MODEL,
  surface,
  callTool,
  history = [],
  workspace = null,
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
    ...(surface.instructions
      ? { systemInstruction: { parts: [{ text: surface.instructions }] } }
      : {}),
  };

  for (let step = 0; step < limits.maxSteps; step++) {
    body.contents = contents;
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
      result = await callTool(fc.name, args);
      const isError = !!result?.isError;
      // Harvest the workspace on the way past. The model is never shown it, so
      // this is the only place it can be captured.
      let payload = null;
      if (!isError) {
        try {
          payload = JSON.parse(result?.content?.[0]?.text ?? '');
        } catch {
          payload = null;
        }
        if (payload && payload.workspace) ws = payload.workspace;
      }
      calls.push({
        name: fc.name,
        // The workspace is the bulk of an edit call and is not the model's
        // output; logging it would bury the argument that IS.
        args: surface.workspaceTools.has(fc.name)
          ? { ...args, [WORKSPACE_PROPERTY]: '<injected>' }
          : args,
        isError,
        error: isError ? (result?.content?.[0]?.text ?? '') : null,
        cards: payload?.cards ?? null,
        recipe: payload?.recipe ?? null,
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
    calls,
    usage,
    cost: costOf(usage, model),
    stopped,
  };
}
