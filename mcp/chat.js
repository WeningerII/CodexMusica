// chat.js — the public chat bar's backend: page → here → Gemini → the engine.
//
// WHY A BACKEND AT ALL. codex.html is served by GitHub Pages, which is static.
// A Gemini key in the page is a key anyone can read out of the page, so the
// browser cannot call Google directly and something server-side has to hold the
// credential. This is that something, mounted on the MCP service that already
// has the engine and the catalog in memory.
//
// STILL NOTHING STORED. The conversation and the workspace live in the browser
// and are posted back each turn; this process keeps no transcript, no session
// and no handle (`connector-tools-read-only`, gated). What it does keep is
// counters — rate-limit buckets and a spend total — which are about the SERVER,
// not about any user, and are the only reason the endpoint can be open.
//
// THE ENVELOPE IS SIGNED. The client returns `history` verbatim, so without a
// signature anyone could post a fabricated transcript — including invented model
// turns — and use our key as a general-purpose completion proxy. The HMAC means
// a caller may only ever EXTEND a transcript this server wrote, by one user
// message. They can still say anything in that message; that is what a chat bar
// is. What they cannot do is choose the other half of the conversation.

import crypto from 'node:crypto';
import express from 'express';
import { Windows, clientIp } from './ratelimit.js';
import { createSpendStore } from './spend_store.js';
import { TOOL_BUDGET_MS } from './budget.js';
import {
  buildSurface,
  runTurn,
  DEFAULT_MODEL,
  LIMITS,
  costOf,
  turnBudget,
  priceFor,
  RETRY_TRANSIENT,
  RATE_LIMIT_RETRY,
} from './gemini_agent.js';

// ── limits ───────────────────────────────────────────────────────────────────
//
// Every number here is a real ceiling with a real reason, and all of them are
// env-overridable so the deploy can tighten without a code change.
//
// THE BINDING CONSTRAINT IS GOOGLE'S, NOT OURS: the key this runs on is on the
// free tier — 15 requests per MINUTE for gemini-3.1-flash-lite — and one
// conversation spends one request per tool hop, measured at 4-7. So the service
// supports roughly two concurrent conversations before Google starts refusing,
// which is why CONCURRENCY exists and why a 429 is reported to the user as
// "busy" rather than waited out: a chat bar that silently stalls for 38 seconds
// reads as broken, and retrying inside the request just moves the queue. Since
// 2026-09-02 (M-168) a 429 is retried inside RATE_LIMIT_RETRY's eight-second
// budget first — one refill slot of the per-minute limiter — and reported only
// past it.
const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

// The mean cost of one chat turn, MEASURED across the probe battery's rows
// and declared here because two ceilings below are derived from it rather
// than sized against it in prose. `CHAT_MEAN_TURN_USD` overrides it, which is
// what a repricing needs rather than an edit.
export const MEAN_TURN_USD = Number(process.env.CHAT_MEAN_TURN_USD) || 0.01;

// The day's dollar budget, hoisted so the turn-count ceiling can be DERIVED
// from it. Raised from $2 by the owner 2026-09-02.
const DAILY_USD = num('CHAT_DAILY_USD', 25);

// How much room the turn-count ceiling keeps above the budget it must not
// pre-empt. At 1.0 the two ceilings are exactly TIED at the measured mean
// and which one fires is decided by noise — the inversion this constant
// exists to prevent, one sitting after it happened. At 2 the dollar cap
// still binds first even if turns run at HALF the measured mean, which is
// the direction that would otherwise let the count ceiling quietly become
// the budget.
export const TURNS_HEADROOM = Number(process.env.CHAT_TURNS_HEADROOM) || 2;

export const CHAT_LIMITS = {
  perIpPerMinute: num('CHAT_IP_RPM', 4),
  perIpPerHour: num('CHAT_IP_RPH', 30),
  concurrency: num('CHAT_CONCURRENCY', 2),
  // ~~2~~ **25** since 2026-09-02, raised by the owner in the same sitting as
  // the $2.50 per-turn cap and for the same reason: at $2 the turn cap sat
  // ABOVE the day's whole budget, so one admitted turn could carry the day
  // past its ceiling (the daily check runs BEFORE a turn and never
  // interrupts one in flight). At $25 the turn cap is back under the day and
  // that overshoot is zero — `chatCeilings()` reports it either way rather
  // than either number being trusted to stay put.
  dailyUsd: DAILY_USD,
  // 600 was too tight to describe a recording in the terms this thing rewards —
  // a mood, a room, an era, a piece of gear, and which instrument each applies
  // to — so a user with a real brief had to cut it down before asking. At the
  // deployed model's input price 5000 chars is ~1250 tokens, and even re-sent on
  // every hop of a 12-step turn that is under $0.002, against the per-turn
  // ceiling `maxTurnUsd` enforces (~~$0.10~~ **$2.50** since 2026-09-02).
  // The cap that actually bounds spend is that one, not this.
  maxMessageChars: num('CHAT_MAX_MESSAGE', 5000),
  // 400_000 until 2026-08-28, sized for history alone. The envelope now also
  // carries the revise state (`lyric` — measured at ~262KB on a real 28-line
  // run, capped at 2MiB by the tool's own MAX_STATE_CHARS), so the old ceiling
  // would have ended a revise conversation mid-run with "grown too long".
  // 1.5MB holds the measured state plus a long transcript and stays under the
  // 2MiB express.json body limit the POST must fit inside.
  maxHistoryBytes: num('CHAT_MAX_HISTORY_BYTES', 1_500_000),
  maxTurns: num('CHAT_MAX_TURNS', 12),
  // A SECOND daily ceiling, in turns, deliberately independent of the first.
  //
  // The dollar cap is only as good as the pricing table behind it: it needs a
  // known price, correct token accounting, and Google's rates not to have moved.
  // This one needs none of those — it counts requests. If the money arithmetic
  // is ever wrong in the cheap direction, this is what still stops the day.
  //
  // ~~400 turns at the measured ~$0.01 mean is roughly $4, comfortably above
  // the $2 dollar cap, so in normal operation the dollar cap is what the
  // service actually hits and this never fires.~~ **STRUCK 2026-09-02, AND
  // THE RELATION INVERTED WHEN THE DOLLAR CEILING MOVED TO $25**: 400 turns
  // at that same ~$0.01 mean is still roughly $4, which is now well UNDER
  // the day's dollar ceiling, so in ordinary operation THIS is what the
  // service reaches first and the dollar cap is what never fires. That is
  // not a defect — a count ceiling needs no pricing table and is the sounder
  // of the two — but it did mean raising `CHAT_DAILY_USD` alone bought
  // roughly nothing: the ordinary day stayed bounded near $4 by this number
  // until it moved too. **IT MOVED THE SAME DAY**, on the owner's *"bring it
  // actually up to $25 a day"*, and the resolution is the derivation below
  // rather than a second figure. `chatCeilings().perDay` says which of the
  // two an ordinary day reaches rather than leaving it to whichever is
  // smaller, and it reads `dailyUsd` now. This ceiling still exists for the
  // case where the dollar cap cannot do its job.
  // ~~400~~ **DERIVED 2026-09-02**, on the owner's *"bring it actually up to
  // $25 a day"*. Typing a second number would have re-armed the same trap:
  // two ceilings, one question, and whichever is smaller winning in silence.
  // It is `dailyUsd / MEAN_TURN_USD * TURNS_HEADROOM` now — 5,000 at the
  // shipped figures — so the dollar budget is what an ordinary day reaches
  // and this cannot silently become the budget again when either number
  // moves. `CHAT_MAX_TURNS_PER_DAY` still overrides it outright.
  //
  // WHAT IT COSTS, SAID RATHER THAN DISCOVERED: this ceiling is the only
  // bound that survives a WRONG PRICING TABLE, and its worst case scales
  // with it — 5,000 turns at the worst LEGAL turn is
  // `chatCeilings().worstCaseDayUsd`, which the status endpoint reports.
  // What keeps that from being one client's to reach is the rate limiter,
  // not this: `perIpPerHour` bounds a single address to
  // `chatCeilings().perIpPerDay` turns a day, so the ceiling above is a
  // FLEET bound and needs several distinct clients to approach.
  maxTurnsPerDay: num(
    'CHAT_MAX_TURNS_PER_DAY',
    Math.ceil((DAILY_USD / MEAN_TURN_USD) * TURNS_HEADROOM)
  ),
};

/**
 * WHICH OF THE THREE SPEND CEILINGS ACTUALLY BINDS, SAID OUT LOUD.
 *
 * There are three and they answer different questions: `maxSteps` bounds a
 * turn's HOPS, `maxTurnUsd` bounds one turn's DOLLARS, and `dailyUsd` bounds
 * the day's. The smallest one wins, and until 2026-09-02 which that was
 * depended on a transcript size nothing disclosed — a turn stopped at hop 6
 * of a legal 14 reported MAX_TURN_COST, which reads as a budget problem when
 * what bound it was the hop budget (triage C11).
 *
 * The owner raised `maxTurnUsd` to $2.50 that day, which moves the answer:
 * the turn cap now sits an order of magnitude above the worst LEGAL turn, so
 * `maxSteps` is the operative per-turn limit again — and $2.50 also sits
 * ABOVE `dailyUsd` ($2). That is not an error and it is not silently
 * absorbed: the daily check admits a turn BEFORE it runs and never
 * interrupts one in flight, so ONE turn may carry the day past its ceiling
 * by up to `maxTurnUsd - dailyUsd`. Reported, not repaired — `CHAT_DAILY_USD`
 * is the owner's other knob, and moving it here would be this function
 * deciding a budget rather than describing one.
 *
 * @returns {{perTurn:string, turnUsd:number, dailyUsd:number,
 *            turnCapExceedsDay:boolean, dayOvershootUsd:number,
 *            turnsPerDay:number|null}}
 */
// The measured mean cost of an ordinary turn, from the probe suite — the
// figure `maxTurnsPerDay`'s own comment reasons with. Declared here because
// `chatCeilings` prices the count ceiling in dollars with it, and a number
// used in an arithmetic must be findable rather than quoted in prose
// (doctrine 58).

export function chatCeilings(limits = CHAT_LIMITS, agent = LIMITS, model = undefined) {
  const budget = turnBudget(agent, model === undefined ? DEFAULT_MODEL : model);
  const perTurn = budget === null ? 'UNPRICED_MODEL' : budget.capBinds ? 'maxTurnUsd' : 'maxSteps';
  const turnCapExceedsDay = agent.maxTurnUsd > limits.dailyUsd;
  // AND THE DAY HAS TWO CEILINGS OF ITS OWN, WHICH IS THE SAME QUESTION ONE
  // AXIS OVER. `dailyUsd` bounds the day in dollars and `maxTurnsPerDay`
  // bounds it in requests, deliberately independent because the count needs
  // no pricing table. Which of them an ordinary day reaches first is
  // arithmetic over a MEAN turn, and it INVERTED when the dollar figure
  // moved to $25: the count ceiling priced at that mean is the dollars the
  // day actually reaches.
  const dayByTurnsUsd = limits.maxTurnsPerDay * MEAN_TURN_USD;
  return {
    perTurn,
    turnUsd: agent.maxTurnUsd,
    dailyUsd: limits.dailyUsd,
    turnCapExceedsDay,
    // How far past the day's ceiling one admitted turn could carry it.
    dayOvershootUsd: turnCapExceedsDay ? agent.maxTurnUsd - limits.dailyUsd : 0,
    // How many worst-legal turns the day buys, or null when unpriced.
    turnsPerDay: budget === null ? null : Math.floor(limits.dailyUsd / budget.worstLegalTurnUsd),
    // Which of the DAY's two ceilings an ordinary day reaches first, and what
    // the count ceiling amounts to in dollars at the measured mean.
    perDay: dayByTurnsUsd < limits.dailyUsd ? 'maxTurnsPerDay' : 'dailyUsd',
    dayByTurnsUsd,
    // What the turn-count ceiling actually bounds when the DOLLAR arithmetic
    // cannot be trusted — the case it exists for. Null when unpriced.
    worstCaseDayUsd: budget === null ? null : limits.maxTurnsPerDay * budget.worstLegalTurnUsd,
    // And what ONE address can reach, which is the rate limiter's bound and
    // not this file's: the ceiling above is a FLEET bound.
    perIpPerDay: limits.perIpPerHour * 24,
  };
}

// ── rate limiting ────────────────────────────────────────────────────────────
//
// Windows and clientIp now live in ratelimit.js, because /mcp needs the same
// two things — see the header there. The day's spend total below is still
// chat-only: it is about money, and /mcp spends none.
//
// KNOWN LIMITATION, unchanged by the move: process-local. A redeploy or a crash
// resets both the buckets and the day's spend total, and a second instance
// (autoscale) would keep its own. Google's own per-key quota is the backstop
// underneath this, and it is the one that cannot be reset by restarting us.

// ── envelope signing ─────────────────────────────────────────────────────────
//
// The secret is generated at boot when unset, which means a redeploy invalidates
// open conversations: the next message gets a fresh start rather than an error,
// which is the right failure for a chat bar. Set CHAT_SECRET to survive deploys.
const SECRET = process.env.CHAT_SECRET || crypto.randomBytes(32).toString('hex');

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(JSON.stringify(payload)).digest('hex');
}

function verify(payload, signature) {
  if (typeof signature !== 'string' || signature.length !== 64) return false;
  const expected = sign(payload);
  // Constant-time: a length-checked compare that returns early leaks the prefix.
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

/**
 * @param {object} opts
 * @param {Function} opts.buildServer  the real MCP server factory (mcp/tools.js)
 * @param {Function} opts.Client       MCP SDK client class
 * @param {Function} opts.InMemoryTransport MCP SDK in-memory transport
 */
export async function createChatRouter({
  buildServer,
  Client,
  InMemoryTransport,
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || DEFAULT_MODEL,
  limits = CHAT_LIMITS,
}) {
  const router = express.Router();
  // THE KITCHEN'S WRITER IS THE CHAT'S OWN MODEL (M-254): declared here once
  // (GEMINI_MODEL, else DEFAULT_MODEL) and handed to the harness processes
  // through their env, so mcp/gemini_proposer.py asks the model the service
  // says it runs and no second model name exists anywhere. Set before any
  // harness worker spawns (they spawn lazily on the first lyric call).
  if (!process.env.LYRIC_PROPOSER_MODEL) process.env.LYRIC_PROPOSER_MODEL = model;

  if (!apiKey) {
    // A chat bar that 500s on every message is worse than one that says it is
    // off. This is the deploy-without-a-key case, and it should be legible.
    router.post('/chat', (_req, res) =>
      res.status(503).json({ error: 'The chat bar is not configured on this deployment.' })
    );
    router.get('/chat/status', (_req, res) => res.json({ ok: false, reason: 'no-key' }));
    return router;
  }

  // ONE long-lived in-memory client, not one per request. Every tool is
  // read-only, idempotent and closed-world (the annotations say so and the
  // contract gate proves it), so there is no cross-request state to leak through
  // it — the workspace arrives in the request and leaves in the response.
  //
  // Tools are executed THROUGH the MCP client rather than by calling engine.js:
  // that is the path the zod schemas validate, and schemas.js is explicit that
  // reaching the engine another way inherits none of it and degrades silently
  // instead of throwing.
  const server = buildServer();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'codex-musica-chat', version: '1.0.0' }, { capabilities: {} });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const surface = await buildSurface(client);
  // The SDK's default request timeout is 60s and the lyric verbs' own
  // descriptions advertise more — lyric_revise says "expect ~60-120s per
  // call", and the FIRST call on a cold Starter instance also pays the
  // worker spawn and the lexicon load. Under the default, the first heavy
  // call of a conversation threw McpError(timeout) and 502'd the whole
  // turn: the flash battery's finding #1, reproduced 4/4 at 79s per death.
  // The value is the ONE shared tool budget (mcp/budget.js, M-165): this
  // clock and the subprocess kill under it used to be two spellings, and
  // the lower one killed calls the higher one was still waiting for —
  // round 8's eight consecutive lyric_revise exit -1 in a single turn.
  const TOOL_TIMEOUT_MS = TOOL_BUDGET_MS;
  const callTool = (name, args) =>
    client.callTool({ name, arguments: args }, undefined, { timeout: TOOL_TIMEOUT_MS });

  const windows = new Windows();
  // The daily counters, behind a store that persists them when the deployment
  // has somewhere to put them (CHAT_SPEND_FILE + a mounted disk) and reports
  // honestly when it does not. Today it does not — see spend_store.js.
  const spendStore = createSpendStore(process.env);
  const spend = spendStore.load();
  let inFlight = 0;

  // Can this model be metered at all? Resolved ONCE, at construction, so the
  // answer is visible in the boot log rather than discovered per request.
  //
  // If it cannot, /chat refuses to serve. That is the deliberate choice: the
  // endpoint spends money on someone else's key, and a cap that cannot count is
  // not a cap. Running anyway is what turned CHAT_DAILY_USD into decoration the
  // moment GEMINI_MODEL named anything the pricing table had not heard of —
  // which is precisely what an operator does when a model is retired.
  //
  // The escape hatch is CHAT_PRICE_INPUT_PER_1M / CHAT_PRICE_OUTPUT_PER_1M:
  // state the rates and the service runs. Explicit, and it leaves a record of
  // what the operator believed the price was.
  const price = priceFor(model);
  if (!price) {
    console.error(
      `[chat] DISABLED — no price known for "${model}". The daily cap cannot be enforced ` +
        `without one, so /chat will refuse rather than spend unmetered. Add it to PRICING in ` +
        `gemini_agent.js, or set CHAT_PRICE_INPUT_PER_1M and CHAT_PRICE_OUTPUT_PER_1M.`
    );
  }

  const today = () => new Date().toISOString().slice(0, 10);
  const rollDay = () => spendStore.rollDay(today());
  // When this process's counter last started from zero. With a durable store
  // that is the last UTC rollover; without one it is boot, which is the whole
  // point of reporting it.
  const countingSince = new Date().toISOString();

  if (!spendStore.durable) {
    console.error(
      '[chat] the daily spend counter is IN-MEMORY: it resets on every restart and deploy, ' +
        `so CHAT_DAILY_USD ($${limits.dailyUsd}) bounds an uptime period rather than a UTC day. ` +
        'Set CHAT_SPEND_FILE to a path on a mounted disk to make it durable.'
    );
  }

  router.get('/chat/status', (_req, res) => {
    rollDay();
    res.json({
      ok: true,
      model,
      // Published list price, so the page can be honest about what it is
      // spending rather than describing itself as free and hoping.
      pricePer1M: price || null,
      // Say so out loud. A chat bar that is off because its price is unknown
      // should not look identical to one that is merely quiet.
      enabled: !!price,
      spentUsdToday: Number(spend.usd.toFixed(4)),
      dailyCapUsd: limits.dailyUsd,
      turnsToday: spend.turns,
      dailyCapTurns: limits.maxTurnsPerDay,
      // Which ceiling actually binds, and what the turn cap costs the day.
      ceilings: chatCeilings(limits, LIMITS, model),
      // WHAT THE TWO NUMBERS ABOVE ACTUALLY COVER.
      //
      // `spentUsdToday` reads as the day's total, and with no spend file it is
      // only this process's share of it: render.yaml sets autoDeploy, so every
      // push restarts the service and the counter starts again from zero while
      // the date has not changed. The cap was "$2 per uptime period" described
      // as "$2 per UTC day" (audit F128).
      //
      // Rather than leave the reader to infer that, say it. `capDurable` is
      // false when the counter cannot survive a restart, and `countingSince`
      // gives the instant it last started from zero — so a status response
      // taken minutes after a deploy is self-evidently a partial total rather
      // than a reassuring one.
      capDurable: spendStore.durable,
      countingSince,
      tools: surface.declarations.length,
    });
  });

  router.post('/chat', async (req, res) => {
    rollDay();
    // Before anything else, including the rate limiters: an unmeterable model
    // means no request is safe to make, so there is nothing to rate-limit.
    if (!price) {
      return res.status(503).json({
        error: 'The chat bar is off: this deployment has no price configured for its model.',
      });
    }
    const now = Date.now();
    const ip = clientIp(req);

    const minute = windows.hit(ip, 60_000, limits.perIpPerMinute, now);
    if (!minute.ok) {
      res.set('Retry-After', String(Math.ceil(minute.retryAfter / 1000)));
      return res.status(429).json({
        error: `That is a lot of recipes at once — try again in ${Math.ceil(minute.retryAfter / 1000)}s.`,
      });
    }
    const hour = windows.hit(ip, 3_600_000, limits.perIpPerHour, now);
    if (!hour.ok) {
      res.set('Retry-After', String(Math.ceil(hour.retryAfter / 1000)));
      return res
        .status(429)
        .json({ error: 'Hourly limit reached for this address. Back shortly.' });
    }
    if (spend.usd >= limits.dailyUsd) {
      return res
        .status(503)
        .json({ error: "The chat bar has hit today's budget. It resets at midnight UTC." });
    }
    // The turn ceiling, which does not consult the pricing table. Same answer to
    // the user; the point is that it still fires when the dollar arithmetic
    // cannot.
    if (spend.turns >= limits.maxTurnsPerDay) {
      return res
        .status(503)
        .json({ error: "The chat bar has hit today's limit. It resets at midnight UTC." });
    }
    if (inFlight >= limits.concurrency) {
      return res
        .status(503)
        .json({ error: 'Busy — a couple of recipes are already cooking. Try again in a moment.' });
    }

    const { message, history, workspace, lyric, sig } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Say something first.' });
    }
    if (message.length > limits.maxMessageChars) {
      return res.status(400).json({ error: `Keep it under ${limits.maxMessageChars} characters.` });
    }

    // An envelope is either absent (a new conversation) or signed by us.
    let priorHistory = [];
    let priorWorkspace = null;
    let priorLyric = null;
    if (history !== undefined || workspace !== undefined || sig !== undefined) {
      const envelope = { history: history || [], workspace: workspace ?? null };
      // `lyric` (the carried revise state) joins the envelope ONLY when it is
      // actually carried, on both the sign side and this rebuild side — so an
      // envelope from before the field existed, or from a conversation that
      // never ran the revise loop, keeps its old shape and its old signature.
      if (lyric != null) envelope.lyric = lyric;
      if (!verify(envelope, sig)) {
        return res
          .status(400)
          .json({ error: 'That conversation could not be verified — start a new one.' });
      }
      if (JSON.stringify(envelope).length > limits.maxHistoryBytes) {
        return res
          .status(413)
          .json({ error: 'This conversation has grown too long — start a new one.' });
      }
      priorHistory = envelope.history;
      priorWorkspace = envelope.workspace;
      priorLyric = envelope.lyric ?? null;
      const userTurns = priorHistory.filter(
        (c) => c.role === 'user' && (c.parts || []).some((p) => typeof p.text === 'string')
      ).length;
      if (userTurns >= limits.maxTurns) {
        return res.status(429).json({
          error: `That is ${limits.maxTurns} messages — start a new recipe to keep going.`,
        });
      }
    }

    inFlight++;
    try {
      const run = await runTurn({
        apiKey,
        model,
        surface,
        callTool,
        history: priorHistory,
        workspace: priorWorkspace,
        lyric: priorLyric,
        userText: message,
        // One retry, and ONLY on a transient 5xx. Previously this was
        // `retries: 0`, which meant a single blip from Google — a 500 on one hop
        // of a nine-hop conversation — threw away the whole turn and showed the
        // user "The engine could not answer that one", with everything they had
        // built still intact but unreachable. The backoff for a 5xx is about a
        // second, so the retry is invisible.
        //
        // 429 is deliberately NOT in this list. Its retry hint is routinely tens
        // of seconds, and a chat bar that silently stalls for 38 seconds reads as
        // broken; "busy, try again" is the better answer to a quota wall.
        // WHAT IT GETS INSTEAD (2026-09-02, M-168): the BOUNDED budget —
        // at most two retries, 2 s then 4 s or the hint when it fits, never
        // more than eight seconds in all — because round 10 died on a hard
        // 429 that a single refill slot of the 15-a-minute limiter would have
        // cleared. A hint past the budget is refused at once, and the
        // retries it did spend are on `usage.retries`.
        // THREE, SINCE M-232 (round 18): every 502 of rounds 17 and 18 was a
        // Gemini 503 "high demand"; one retry a second later lost to the same
        // spike. Three retries at 1 s / 2 s / 4 s (retryDelayMs) cover a short
        // spike for seven seconds of waiting; a longer one ends the turn
        // with its calls kept (runTurn's partial return) rather than thrown.
        retries: 3,
        retryStatuses: RETRY_TRANSIENT,
        rateLimit: RATE_LIMIT_RETRY,
      });
      // `?? null` and not `|| 0`.
      //
      // The old line read `run.cost || costOf(...) || 0`, which turned an
      // uncostable turn into a free one: spend.usd never moved, so the daily
      // gate never tripped and the cap was decoration. A cost we cannot compute
      // is the one case where charging nothing is the worst possible choice —
      // it is indistinguishable from having spent nothing, and it compounds.
      //
      // The constructor already refuses to serve an unpriced model, so reaching
      // this branch means the accounting broke in some way we did not predict.
      // Charge the turn's full allowance and say so: the day closes early, which
      // is the safe direction to be wrong in.
      const turnUsd = run.cost ?? costOf(run.usage, model);
      if (turnUsd === null) {
        console.error(`[chat] turn cost could not be computed for "${model}"; charging the cap.`);
        spend.usd += LIMITS.maxTurnUsd;
      } else {
        spend.usd += turnUsd;
      }
      spend.turns += 1;
      // Persist immediately after accounting, not at the end of the response:
      // the money is already spent by this point, and a crash between here and
      // the reply would otherwise lose the record of it. A no-op when the
      // deployment has no spend file.
      spendStore.save();

      const envelope = { history: run.history, workspace: run.workspace };
      if (run.lyric != null) envelope.lyric = run.lyric;
      const lastRecipe = [...run.calls].reverse().find((c) => c.recipe && !c.isError);
      res.json({
        reply: run.reply,
        // WHAT THE TURN COST AND HOW MANY HOPS IT TOOK (2026-09-01, triage
        // finding C11): the battery and the page can record $/turn and
        // hops/turn off the response instead of inferring them from the log,
        // which is the measurement the CHAT_MAX_TURN_USD ruling waits on.
        cost: run.cost,
        usage: run.usage,
        // The recipe string is returned SEPARATELY as well as inside the reply.
        // The connector instructions ask the model to reproduce it verbatim, and
        // "asked to" is not "did" — the page renders this copy, so a recipe the
        // model paraphrased is still shown exactly.
        recipe: lastRecipe?.recipe || null,
        cards: lastRecipe?.cards || null,
        // exit_code and banned_pairs ride along for the lyric verbs (null for
        // the recipe tools) so the page's tool chips can show the verdict the
        // model may not relay — the two-tier ban is unskippable, and a count
        // only the model ever saw protects nobody.
        // The loop record and the answer count join them for the same reason
        // one layer out (M-169): the flash battery records this array verbatim
        // and it IS the project's record of a production run, so a field
        // dropped here is a question no later analysis can ask. Null means the
        // call never reached a stop condition (or is not a lyric verb) — never
        // that the loop spent zero rounds.
        tools: run.calls.map((c) => ({
          name: c.name,
          // M-232: the seed the call named, so a parked or suspended run can
          // be reproduced from the row (round 18's rows could not say).
          seed: typeof c.args?.seed === 'number' ? c.args.seed : null,
          error: c.isError ? c.error : null,
          exit_code: c.exit_code ?? null,
          banned_pairs: c.banned_pairs ?? null,
          loop_stop_reason: c.loop_stop_reason ?? null,
          loop_rounds: c.loop_rounds ?? null,
          loop_unresolved: c.loop_unresolved ?? null,
          loop_whole_flag_codes: c.loop_whole_flag_codes ?? null,
          answers_on_record: c.answers_on_record ?? null,
          // The harness's own REFUSED headline on an exit 2 (M-168's swerve:
          // round 10 banked three exit-2 calls with no reason on record).
          refusal: c.refusal ?? null,
          // THE M-216 FIELDS, AND THIS PROJECTION WAS THE SECOND SPELLING
          // THAT DROPPED THEM (M-219, round 11): `loopFields` put path, ms
          // and the run record on every call, this map re-spelled the row
          // by hand and never learned them, and round 11's rows could not
          // say whether the new deploy answered warm. Copied by name so a
          // field added to loopFields is a field added HERE, in one edit.
          path: c.path ?? null,
          ms: c.ms ?? null,
          memo_state: c.memo_state ?? null,
          memo_hit: c.memo_hit ?? null,
          memo_asked: c.memo_asked ?? null,
          stale_answers: c.stale_answers ?? null,
          plan_lines: c.plan_lines ?? null,
          // M-221: the draft came from the carried record, not the model.
          draft_carried: c.draft_carried ?? false,
          // M-229: the run's declarations were re-applied; the call was refused
          // by the connector for wandering off a suspended run.
          declarations_carried: c.declarations_carried ?? false,
          refused_by_connector: c.refused_by_connector ?? false,
          // M-235: the proposal record, copied by name as the M-216 fields are.
          asked: c.asked ?? null,
          folded: c.folded ?? null,
          answer_sent: c.answer_sent ?? null,
          draft_fp: c.draft_fp ?? null,
          song_at_stop: c.song_at_stop ?? null,
          // M-237: the run the tool remembered, copied by name.
          run_id: c.run_id ?? null,
          run_state_carried: c.run_state_carried ?? false,
          run_draft_carried: c.run_draft_carried ?? false,
          run_decl_carried: c.run_decl_carried ?? false,
        })),
        stopped: run.stopped,
        // WHY IT STOPPED, WITH THE NUMBERS (2026-09-02, triage C11). A bare
        // `MAX_TURN_COST` cannot be told from `MAX_STEPS` by a reader of the
        // transcript, and the two ceilings answer one question — how many
        // hops may a turn take. `stoppedDetail` carries what the turn spent,
        // the cap it hit, the hops it bought and the hops it was allowed, so
        // the battery banks the reason rather than the label. Null on every
        // turn that stopped for any other reason.
        stopped_detail: run.stoppedDetail ?? null,
        // WHAT EACH MALFORMED HOP CONTAINED (M-221): one entry per hop Gemini
        // ended on MALFORMED_FUNCTION_CALL, with the head of the call text it
        // could not parse — re-asked or not. Empty on a clean turn.
        malformed: run.malformed ?? [],
        ...envelope,
        sig: sign(envelope),
      });
    } catch (err) {
      const status = err.status === 429 ? 429 : 502;
      // THE HOPS BEFORE THE THROW WERE BILLED, SO THEY ARE CHARGED (M-197):
      // `runTurn` hands the partial usage out on the error; a turn that died
      // on hop 5 spent four hops of someone's key, and a counter that skips
      // them reads lower than the bill. An uncomputable partial cost charges
      // the turn's cap, the same safe direction the success path takes.
      let chargedUsd = 0;
      if (err && err.usage && err.usage.requests > 0) {
        const partial = costOf(err.usage, model);
        chargedUsd = partial === null ? LIMITS.maxTurnUsd : partial;
        spend.usd += chargedUsd;
        spend.turns += 1;
        spendStore.save();
      }
      // The upstream message can carry quota detail; the user gets the shape of
      // the problem, and the log gets the rest. A 429 that named a wait past
      // RATE_LIMIT_RETRY's budget hands that wait to the client as the
      // standard header, so a driver can pace on the number instead of a guess.
      if (status === 429 && Number.isFinite(err.retryAfterMs) && err.retryAfterMs > 0) {
        res.set('Retry-After', String(Math.ceil(err.retryAfterMs / 1000)));
      }
      console.error('[chat] ', err.message);
      // WHAT DIED, ON THE BODY (M-231, round 17): four 502s in a row carried
      // only the sentence above, and the one line that said WHY went to a
      // service log nobody driving the battery can read. The upstream's own
      // status and message ride out with the shape, head-truncated, beside
      // the calls the turn had already made — a 400 is not a 503, and a
      // driver that cannot tell them apart retries both for thirteen minutes.
      const calls = Array.isArray(err && err.calls) ? err.calls : [];
      res.status(status).json({
        error:
          status === 429
            ? 'The engine is over its rate limit for the moment — try again in a minute.'
            : 'The engine could not answer that one. Try rephrasing?',
        detail: String((err && err.message) || err).slice(0, 400),
        upstream_status: Number.isFinite(err && err.status) ? err.status : null,
        hopsBeforeFailure: err && err.usage ? err.usage.requests : 0,
        callsBeforeFailure: calls.map((c) => ({
          name: c.name,
          error: c.error ?? null,
          exit_code: typeof c.exit_code === 'number' ? c.exit_code : null,
        })),
        chargedUsd: Number(chargedUsd.toFixed(4)),
      });
    } finally {
      inFlight--;
    }
  });

  return router;
}
