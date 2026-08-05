#!/usr/bin/env node
// probe_gemini.mjs — can Gemini actually drive the engine? Ask the engine.
//
// NOT A UNIT TEST and deliberately not in `npm test`: it spends money and needs
// GEMINI_API_KEY, so CI cannot run it. It exists because the question "will a
// cheap model hold a 6-9 call tool sequence over this catalog" has exactly one
// honest answer, and it is not obtainable by reading schemas.
//
// EVERYTHING HERE IS REAL. The MCP server is the real one (buildServer()), the
// client is a real in-memory MCP client, the tools run the real engine over the
// bundled catalog, and the model is really called. A stub would be strictly more
// work — engine.js has no dependencies and the catalog is bundled — and it would
// guarantee a false pass, because the hard part is resolving "haunted Appalachian
// murder ballad" to a real preface id out of 741 against 2503 traditions, not
// emitting syntactically valid JSON. A stub answers the easy half and lies about
// the other.
//
// Usage:
//   GEMINI_API_KEY=... node scripts/probe_gemini.mjs
//   node scripts/probe_gemini.mjs --model=gemini-3.5-flash-lite   # the fallback
//   node scripts/probe_gemini.mjs --thinking=low --only=1,2,3     # cost comparison
//   node scripts/probe_gemini.mjs --json=probe.json               # machine-readable
//
// Exit 0 if every prompt passes, 1 otherwise.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSurface, runTurn, DEFAULT_MODEL, PRICING } from '../mcp/gemini_agent.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const flags = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const i = a.indexOf('=');
  if (i > 0) flags[a.slice(2, i)] = a.slice(i + 1);
  else flags[a.slice(2)] = true;
}

const MODEL = flags.model || DEFAULT_MODEL;
const THINKING =
  flags.thinking === 'low'
    ? { thinkingLevel: 'low' }
    : flags.thinking === 'high'
      ? { thinkingLevel: 'high' }
      : { thinkingBudget: 0 };

// The suite. The first three are the agreed baseline (Haiku 4.5 drove them 3/3,
// zero guessed ids, 6-9 calls, ~35k tokens each); the rest cover one intent
// class apiece, because a model can be good at mood words and bad at roster
// edits and a three-prompt suite would never show it.
const PROMPTS = [
  { id: 1, lane: 'baseline', text: "haunted Appalachian murder ballad, banjo like it's underwater" },
  {
    id: 2,
    lane: 'baseline',
    text: 'afrobeat, but recorded in a huge cathedral with a 1950s broadcast chain',
  },
  {
    id: 3,
    lane: 'baseline',
    text: 'fold gamelan into post-punk, drop the saxophone if there is one, add an oud',
  },
  {
    id: 4,
    lane: 'mood',
    text: "make me something bitter and sneering out of flamenco — every instrument should sound like it's holding a grudge",
  },
  {
    id: 5,
    lane: 'mood',
    text: 'dreamy, weightless shoegaze; I want the whole thing to feel like falling asleep',
  },
  {
    id: 6,
    lane: 'material',
    text: 'bluegrass, but the guitar has a mahogany body and phosphor bronze strings',
  },
  {
    id: 7,
    lane: 'material',
    text: 'delta blues with a resonator — steel body, played with a glass slide',
  },
  { id: 8, lane: 'space/era', text: 'qawwali cut to wax in 1928, mono, in a small tiled room' },
  {
    id: 9,
    lane: 'roster',
    text: 'take a mariachi ensemble, lose the trumpet, add a pedal steel and a theremin',
  },
  { id: 10, lane: 'roster', text: 'cumbia crossed with dub, and give me a melodica in there' },
  {
    id: 11,
    lane: 'awkward',
    text: 'i dunno man, something that sounds like a wet cardboard box falling down the stairs at 4am. surprise me.',
  },
];

const only = flags.only ? new Set(String(flags.only).split(',').map(Number)) : null;
const suite = PROMPTS.filter((p) => !only || only.has(p.id));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set. This probe calls the real API; there is no offline mode.');
  process.exit(2);
}
if (!PRICING[MODEL]) {
  console.error(`No published price on record for ${MODEL}; refusing to report a cost I cannot compute.`);
  process.exit(2);
}

const sdk = (m) => import(pathToFileURL(path.join(ROOT, 'mcp', 'node_modules', m)).href);
const { Client } = await sdk('@modelcontextprotocol/sdk/dist/esm/client/index.js');
const { InMemoryTransport } = await sdk('@modelcontextprotocol/sdk/dist/esm/inMemory.js');
const { buildServer } = await import(pathToFileURL(path.join(ROOT, 'mcp', 'tools.js')).href);

const server = buildServer();
const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'gemini-probe', version: '0' }, { capabilities: {} });
await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

const surface = await buildSurface(client);
const callTool = (name, args) => client.callTool({ name, arguments: args });

// ── the four pass criteria, applied to one run ───────────────────────────────
//
// "No hallucinated ids" is not judged by eye. Every id the model passes is
// resolved by the engine, which throws `Unknown tradition: x` / `Unknown
// preface` / `no part` rather than guessing — so a guessed id IS a tool error,
// and the two criteria collapse into one measurement the engine performs.
const ID_ERROR = /unknown|no part|no card|not found|no such/i;

// Did every edit the model successfully applied actually take, end to end?
// Read off the FINAL workspace, so a later edit that silently reverted an
// earlier one is caught too. Ops with no directly-readable result (add/remove
// tradition, and set_preface's re-derivation) are checked by their own visible
// field; anything this function cannot verify it does not claim to.
function editsHold(run) {
  const ws = run.workspace;
  if (!ws) return false;
  const card = (ref) =>
    (ws.cards || []).find((c) => c.id === ref) || (ws.cards || []).find((c) => c.instrumentId === ref);
  for (const call of run.calls) {
    if (call.name !== 'edit_recipe' || call.isError) continue;
    for (const e of call.args?.edits || []) {
      const c = e.card ? card(e.card) : null;
      switch (e.action) {
        case 'set_variant':
          if (!c || c.parts?.[e.part] !== e.variant) return false;
          break;
        case 'set_preface':
          if (!c || c.preface !== e.preface) return false;
          break;
        case 'set_environment':
          if (!c) return false;
          if (e.room !== undefined && c.room !== e.room) return false;
          if (e.tuning !== undefined && c.tuning !== e.tuning) return false;
          for (const [stage, id] of Object.entries(e.chain || {})) {
            const got = c.chain?.[stage];
            if (Array.isArray(got) ? !got.includes(id) : got !== id) return false;
          }
          break;
        case 'add_instrument':
          if (!(ws.cards || []).some((x) => x.instrumentId === e.instrument)) return false;
          break;
        case 'remove_instrument':
          if (e.card && card(e.card)) return false;
          break;
        case 'add_tradition':
          if (!(ws.cards || []).some((x) => x.traditionId === e.tradition)) return false;
          break;
        case 'remove_tradition':
          if ((ws.cards || []).some((x) => x.traditionId === e.tradition)) return false;
          break;
        default:
          break;
      }
    }
  }
  return true;
}

function judge(run) {
  const errors = run.calls.filter((c) => c.isError);
  const idErrors = errors.filter((c) => ID_ERROR.test(c.error || ''));
  const recipeCalls = run.calls.filter((c) => c.recipe && !c.isError);
  const editCalls = run.calls.filter((c) => c.name === 'edit_recipe' && !c.isError);
  // The workspace is threaded by the adapter, so the thing worth proving is that
  // the thread never broke: an edit that ran before any seed comes back as the
  // "no recipe yet" error, and an edit on a stale workspace comes back as an
  // unknown-card error. Both are already counted above; this asserts the
  // POSITIVE — every edit call actually received one.
  const threaded =
    editCalls.length === 0 ||
    (recipeCalls.length > 0 && !errors.some((c) => /no recipe yet/.test(c.error || '')));
  // `changed` is the engine's own confirmation that an edit landed — but it
  // reports a DIFFERENCE FROM THE SEED, so it is legitimately absent when the
  // seed already satisfied the request. Measured: "delta blues with a resonator
  // — steel body, glass slide" seeds `steel-body-resonator: bronze steel …
  // slide` before any edit runs, so the model's set_variant was a correct no-op
  // and `changed` was correctly empty. Failing that is failing the engine for
  // being right the first time.
  //
  // So `changed` is REPORTED, and the pass criterion is the stronger property it
  // was standing in for: does the state the model asked for actually hold in the
  // final workspace? That catches a silently-dropped edit (which `changed` also
  // caught) AND is honest about a no-op (which `changed` did not).
  const reportedChanged = editCalls.every((c) => (c.cards || []).some((card) => card.changed));
  const applied = editsHold(run);
  const lastRecipe = recipeCalls.length ? recipeCalls[recipeCalls.length - 1].recipe : null;
  return {
    errors: errors.length,
    idErrors: idErrors.length,
    threaded,
    edits: editCalls.length,
    // Not a pass criterion, but the connector instructions ask for the final
    // recipe verbatim and the chat bar is worthless if that does not survive.
    verbatim: !!lastRecipe && run.reply.includes(lastRecipe),
    reportedChanged,
    applied,
    pass: errors.length === 0 && threaded && applied && editCalls.length > 0,
    lastRecipe,
  };
}

const results = [];
for (const prompt of suite) {
  process.stderr.write(`\n[${prompt.id}] ${prompt.text}\n`);
  const started = process.hrtime.bigint();
  let run;
  let threw = null;
  try {
    run = await runTurn({
      apiKey,
      model: MODEL,
      surface,
      callTool,
      userText: prompt.text,
      thinking: THINKING,
      // The free tier allows 15 requests/minute and one conversation makes one
      // request per hop, so the probe waits out the quota rather than reporting
      // it as a model failure. Without this the suite measures Google's meter.
      retries: 6,
      onEvent: (e) =>
        process.stderr.write(
          e.type === 'retry'
            ? `    … ${e.status}, waiting ${Math.round(e.waitMs / 1000)}s\n`
            : `    → ${e.name}${e.isError ? ' ✗' : ''}\n`
        ),
    });
  } catch (err) {
    threw = err.message;
  }
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  if (threw) {
    process.stderr.write(`    THREW: ${threw}\n`);
    results.push({ ...prompt, threw, verdict: { pass: false }, usage: {}, cost: 0, seconds });
    continue;
  }
  const verdict = judge(run);
  results.push({
    ...prompt,
    verdict,
    calls: run.calls.map((c) => ({ name: c.name, args: c.args, isError: c.isError, error: c.error })),
    usage: run.usage,
    cost: run.cost,
    stopped: run.stopped,
    seconds,
    reply: run.reply,
    recipe: verdict.lastRecipe,
  });
  process.stderr.write(
    `    ${verdict.pass ? 'PASS' : 'FAIL'}  ${run.calls.length} calls, ` +
      `${run.usage.promptTokens + run.usage.candidatesTokens + run.usage.thoughtsTokens} tokens, ` +
      `$${run.cost.toFixed(5)}\n`
  );
}

// ── report ───────────────────────────────────────────────────────────────────
const totalTokens = (u) => (u.promptTokens || 0) + (u.candidatesTokens || 0) + (u.thoughtsTokens || 0);
const passed = results.filter((r) => r.verdict.pass).length;
const totalCost = results.reduce((a, r) => a + (r.cost || 0), 0);

console.log(`\nMODEL: ${MODEL}   thinking: ${JSON.stringify(THINKING)}`);
console.log(
  '\n| # | lane | prompt | calls | edits | errors | guessed ids | threaded | applied | changed | verbatim | in | out | think | tokens | cost |'
);
console.log('|---|---|---|--:|--:|--:|--:|:-:|:-:|:-:|:-:|--:|--:|--:|--:|--:|');
for (const r of results) {
  const v = r.verdict;
  const u = r.usage || {};
  const yn = (b) => (b ? 'yes' : 'NO');
  console.log(
    `| ${r.id} | ${r.lane} | ${r.text.length > 46 ? r.text.slice(0, 44) + '…' : r.text} | ` +
      `${r.calls ? r.calls.length : '—'} | ${v.edits ?? '—'} | ${v.errors ?? '—'} | ${v.idErrors ?? '—'} | ` +
      `${yn(v.threaded)} | ${yn(v.applied)} | ${yn(v.reportedChanged)} | ${yn(v.verbatim)} | ` +
      `${u.promptTokens ?? 0} | ${u.candidatesTokens ?? 0} | ${u.thoughtsTokens ?? 0} | ` +
      `${totalTokens(u)} | $${(r.cost || 0).toFixed(5)} |`
  );
}
console.log(
  `\n${passed}/${results.length} passed — total $${totalCost.toFixed(4)}, ` +
    `mean $${(totalCost / results.length).toFixed(5)}/conversation, ` +
    `mean ${Math.round(results.reduce((a, r) => a + totalTokens(r.usage || {}), 0) / results.length)} tokens.`
);

for (const r of results) {
  if (r.verdict.pass) continue;
  console.log(`\n--- [${r.id}] FAILED: ${r.text}`);
  if (r.threw) console.log(`    threw: ${r.threw}`);
  for (const c of r.calls || []) if (c.isError) console.log(`    ✗ ${c.name}: ${c.error}`);
  if (r.stopped) console.log(`    stopped: ${r.stopped}`);
}

if (flags.json) {
  fs.writeFileSync(path.resolve(ROOT, String(flags.json)), JSON.stringify({ model: MODEL, thinking: THINKING, results }, null, 2));
  console.log(`\nwrote ${flags.json}`);
}

process.exit(passed === results.length ? 0 : 1);
