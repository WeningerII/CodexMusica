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
  priceFor,
  RETRY_TRANSIENT,
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
// "busy" rather than retried: a chat bar that silently stalls for 38 seconds
// reads as broken, and retrying inside the request just moves the queue.
const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const CHAT_LIMITS = {
  perIpPerMinute: num('CHAT_IP_RPM', 4),
  perIpPerHour: num('CHAT_IP_RPH', 30),
  concurrency: num('CHAT_CONCURRENCY', 2),
  dailyUsd: num('CHAT_DAILY_USD', 2),
  // 600 was too tight to describe a recording in the terms this thing rewards —
  // a mood, a room, an era, a piece of gear, and which instrument each applies
  // to — so a user with a real brief had to cut it down before asking. At the
  // deployed model's input price 5000 chars is ~1250 tokens, and even re-sent on
  // every hop of a 12-step turn that is under $0.002, against the $0.10
  // per-turn ceiling maxTurnUsd already enforces. The cap that actually bounds
  // spend is that one, not this.
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
  // 400 turns at the measured ~$0.01 mean is roughly $4, comfortably above the
  // $2 dollar cap, so in normal operation the dollar cap is what the service
  // actually hits and this never fires. It exists for the case where the dollar
  // cap cannot do its job.
  maxTurnsPerDay: num('CHAT_MAX_TURNS_PER_DAY', 400),
};

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
        retries: 1,
        retryStatuses: RETRY_TRANSIENT,
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
          error: c.isError ? c.error : null,
          exit_code: c.exit_code ?? null,
          banned_pairs: c.banned_pairs ?? null,
          loop_stop_reason: c.loop_stop_reason ?? null,
          loop_rounds: c.loop_rounds ?? null,
          loop_unresolved: c.loop_unresolved ?? null,
          loop_whole_flag_codes: c.loop_whole_flag_codes ?? null,
          answers_on_record: c.answers_on_record ?? null,
        })),
        stopped: run.stopped,
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
      // the problem, and the log gets the rest.
      console.error('[chat] ', err.message);
      res.status(status).json({
        error:
          status === 429
            ? 'The engine is over its rate limit for the moment — try again in a minute.'
            : 'The engine could not answer that one. Try rephrasing?',
        hopsBeforeFailure: err && err.usage ? err.usage.requests : 0,
        chargedUsd: Number(chargedUsd.toFixed(4)),
      });
    } finally {
      inFlight--;
    }
  });

  return router;
}
