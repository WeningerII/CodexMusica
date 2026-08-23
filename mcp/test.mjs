// test.mjs — checks the MCP engine drives the deterministic workspace correctly.
// Engine tests need no SDK; the server-build check is skipped if the SDK isn't
// installed (npm ci in mcp/). Run: npm test
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as E from './engine.js';

// Raw merged catalog (with the universal cross-instrument materials present) so the
// guard below can tell a curated variant from a borrowed (expanded, auto:false) one.
//
// This comment used to end "getInstrument strips expanded variants, so it can't
// be used for this", and getInstrument does not strip them — it returns all 803
// of kithara's string variants, of which 2 are authored for a kithara. It is the
// STATIC API build that strips them, which is why api/instruments/kithara.json
// lists exactly gut and sinew. Two surfaces, opposite policies, one sentence
// conflating them; the borrowed copies now come back marked, so the raw catalog
// is no longer the only place the difference is visible.
const require = createRequire(import.meta.url);
const C = require('../scripts/_loader.js');
const EXPANDED = new Set();
for (const inst of C.INSTRUMENTS || [])
  for (const p of inst.parts || [])
    for (const v of p.variants || []) if (v.expanded) EXPANDED.add(`${inst.id}|${p.id}|${v.id}`);

let passed = 0;
// Async checks are awaited, which they were not.
//
// This used to be a bare `fn()` inside a try/catch. An `async` callback returns
// a promise immediately and throws nothing synchronously, so the catch never
// fired: the check printed `ok`, incremented `passed`, and any assertion inside
// it became an unhandled rejection that changed no exit code. Both async checks
// in this file were therefore reporting success unconditionally — verified by
// planting a real mismatch in one and watching it still say `ok`.
//
// A promise-returning check is queued and settled before the summary rather
// than awaited here, so every call site stays `check(...)` and no future one
// can reintroduce the bug by forgetting an `await`. The cost is that async
// checks report out of order, after the sync ones.
const pending = [];
function check(name, fn) {
  const ok = () => {
    console.log(`  ok  ${name}`);
    passed++;
  };
  const bad = (err) => {
    console.error(`FAIL  ${name}\n      ${err.message}`);
    process.exitCode = 1;
  };
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      pending.push(result.then(ok, bad));
      return;
    }
    ok();
  } catch (err) {
    bad(err);
  }
}
// Simulate the model threading state: round-trip the workspace through JSON.
const thread = (ws) => JSON.parse(JSON.stringify(ws));

check('catalog loaded', () => {
  assert.ok(E.counts.traditions > 1000 && E.counts.instruments > 400 && E.counts.prefaces > 500);
});

check('start_recipe = the Current Recipe (deterministic, primary-only header)', () => {
  const r = E.startRecipe({ traditions: ['garage_rock'] });
  assert.equal(r.mode, 'single');
  assert.ok(r.recipe.startsWith('Garage rock, '), `header: ${r.recipe.slice(0, 30)}`);
  assert.ok(!/Garage rock \+/.test(r.recipe), 'no auto-staple in header');
  assert.ok(r.recipe.length <= 1000 && r.recipe.length > 900);
  assert.equal(r.cards.length, 5);
  assert.ok(r.workspace && Array.isArray(r.workspace.cards));
  const voice = r.cards.find((c) => c.instrument === 'voice');
  assert.equal(
    voice.preface,
    'evangelizing',
    'cards summary surfaces the auto-deduped preface (not null)'
  );
});

check('max_chars ceiling honored', () => {
  const r = E.startRecipe({ traditions: ['garage_rock'], max_chars: 300 });
  assert.ok(r.recipe_chars <= 300, `got ${r.recipe_chars}`);
});

check('max_chars above 1000 is clamped to the canonical 1000-char cap', () => {
  // The tool schema rejects >1000 at the boundary (max: 1000); the engine
  // clamps defensively so a direct call can't blow past the Current-Recipe cap.
  for (const mc of [1001, 4000, Number.MAX_SAFE_INTEGER]) {
    const r = E.startRecipe({ traditions: ['garage_rock'], max_chars: mc });
    assert.ok(r.recipe_chars <= 1000, `max_chars=${mc} produced ${r.recipe_chars} chars`);
  }
});

check('edit_recipe set_preface re-derives + labels verbatim (state threaded)', () => {
  const s = E.startRecipe({ traditions: ['garage_rock'] });
  const r = E.editRecipe({
    workspace: thread(s.workspace),
    edits: [{ action: 'set_preface', card: 'voice', preface: 'satirical' }],
  });
  assert.ok(/(^|,\s*)satirical voice:/.test(r.recipe), 'preface labeled verbatim');
  const voice = r.workspace.cards.find((c) => c.instrumentId === 'voice');
  assert.ok(
    voice.prefaceLock === true && voice.preface === 'satirical',
    'preface locked on the card'
  );
  assert.notDeepEqual(voice.parts, s.workspace.cards[0].parts, 'voice settings re-derived');
});

check('set_preface never AUTO-selects a borrowed (auto:false) material', () => {
  // The universal cross-instrument materials are auto:false — a human picks them,
  // the inverse-configure optimizer must never reach for one on its own. This guards
  // scripts/_inverse_configure.js (shared by connector + CLI) against re-introducing
  // the borrowed-material auto-pick that the wood/strings merge let slip in. afrobeat
  // seeds material instruments (guitar/bass body_wood + string parts, drum shell_wood),
  // all with CURATED defaults — so any expanded pick after set_preface is the bug.
  const s = E.startRecipe({ traditions: ['afrobeat'] });
  const prefaces = ['shrieking', 'keening', 'brooding', 'caressing', 'raging', 'groaning'];
  let runs = 0;
  for (const seed of s.workspace.cards) {
    const before = { ...seed.parts };
    for (const pref of prefaces) {
      const r = E.editRecipe({
        workspace: thread(s.workspace),
        edits: [{ action: 'set_preface', card: seed.instrumentId, preface: pref }],
      });
      const edited = r.workspace.cards.find((c) => c.instrumentId === seed.instrumentId);
      for (const [partId, vid] of Object.entries(edited.parts || {})) {
        if (EXPANDED.has(`${seed.instrumentId}|${partId}|${vid}`)) {
          assert.equal(
            before[partId],
            vid,
            `set_preface("${pref}") auto-selected borrowed material ${seed.instrumentId}.${partId}=${vid}`
          );
        }
      }
      runs++;
    }
  }
  assert.ok(runs >= 6, `expected several inverse runs, got ${runs}`);
});

check('edit_recipe add_tradition reflects in the header (explicit staple)', () => {
  const s = E.startRecipe({ traditions: ['garage_rock'] });
  const r = E.editRecipe({
    workspace: thread(s.workspace),
    edits: [{ action: 'add_tradition', tradition: 'punk' }],
  });
  assert.ok(r.recipe.startsWith('Garage rock + Punk, '), `header: ${r.recipe.slice(0, 40)}`);
  assert.ok(r.cards.length > s.cards.length);
});

check('edit_recipe set_variant applies + chains multiple edits', () => {
  const s = E.startRecipe({ traditions: ['garage_rock'] });
  const r = E.editRecipe({
    workspace: thread(s.workspace),
    edits: [
      {
        action: 'set_variant',
        card: 'electric_guitar_single_coil',
        part: 'body_wood',
        variant: 'mahogany',
      },
      { action: 'remove_instrument', card: 'tonewheel_organ' },
    ],
  });
  assert.ok(/mahogany/.test(r.recipe));
  assert.equal(r.cards.length, 4);
  assert.ok(!r.cards.some((c) => c.instrument === 'tonewheel_organ'));
});

check('set_environment with no card targets the primary (and only it)', () => {
  // The recipe renders its tuning/room/chain from cards[0] alone, so an omitted
  // `card` has one correct meaning. Asserting the recipe MOVED (not just that a
  // field was written) is the point: a default that wrote to some other card
  // would leave the output identical and look like it had worked.
  const s = E.startRecipe({ traditions: ['ethio_jazz'] });
  const r = E.editRecipe({
    workspace: thread(s.workspace),
    edits: [{ action: 'set_environment', room: 'cathedral', tuning: 'gamelan_pelog' }],
  });
  assert.notEqual(r.recipe, s.recipe, 'recipe did not change');
  assert.match(r.recipe, /cathedral/);
  assert.equal(r.workspace.cards[0].room, 'cathedral');
  assert.equal(
    r.cards.filter((c) => c.changed).length,
    1,
    'the default must touch exactly one card, not the whole roster'
  );
  // The per-instrument actions keep requiring an explicit card — an omitted one
  // there is a real ambiguity, not a single obvious target.
  for (const bad of [
    { action: 'set_preface', preface: 'woozy' },
    { action: 'set_variant', part: 'body_wood', variant: 'mahogany' },
  ]) {
    assert.throws(
      () => E.editRecipe({ workspace: thread(s.workspace), edits: [bad] }),
      /requires "card"/,
      `${bad.action} should still require a card`
    );
  }
  // No cards at all is still an error, with the guiding message.
  assert.throws(
    () =>
      E.editRecipe({
        workspace: { cards: [] },
        edits: [{ action: 'set_environment', room: 'cathedral' }],
      }),
    /requires "card"/
  );
});

check('render_recipe re-renders threaded state', () => {
  const s = E.startRecipe({ traditions: ['bluegrass'] });
  const r = E.renderRecipe({ workspace: thread(s.workspace), max_chars: 250 });
  assert.ok(r.recipe_chars <= 250 && r.recipe.length > 0);
});

check('search_catalog resolves words → ids', () => {
  const r = E.searchCatalog({ query: 'garage rock', types: ['tradition'] });
  assert.ok(r.items.some((x) => x.id === 'garage_rock'));
});

check('search_prefaces returns preface ids', () => {
  const r = E.searchPrefaces({ query: 'satirical' });
  assert.ok(r.items.some((x) => x.id === 'satirical'));
});

check('get_instrument exposes variant ids for set_variant', () => {
  const i = E.getInstrument({ id: 'electric_guitar_single_coil' });
  const bw = i.parts.find((p) => p.id === 'body_wood');
  assert.ok(bw && bw.variants.some((v) => v.id === 'mahogany'));
});

check('list_options enumerates rooms', () => {
  const o = E.listOptions({ kind: 'rooms' });
  assert.ok(o.count > 0 && o.items[0].id);
});

check('validation: actionable errors', () => {
  assert.throws(() => E.startRecipe({ traditions: ['nope_not_real'] }), /Unknown tradition/);
  assert.throws(
    () => E.editRecipe({ edits: [{ action: 'set_preface', card: 'voice', preface: 'x' }] }),
    /needs a "workspace"/
  );
  const s = E.startRecipe({ traditions: ['garage_rock'] });
  assert.throws(
    () => E.editRecipe({ workspace: thread(s.workspace), edits: [{ action: 'bogus' }] }),
    /Unknown edit action/
  );
  assert.throws(
    () =>
      E.editRecipe({
        workspace: thread(s.workspace),
        edits: [{ action: 'set_variant', card: 'voice', part: 'nope', variant: 'x' }],
      }),
    /no part/
  );
});

// ── the cost guards on /chat ────────────────────────────────────────────────
//
// chat.js is the only surface here that spends money, and it had no tests at
// all — the audit counted 653 lines of credential-bearing, billable code with
// zero coverage. These assert the four things that stand between an open
// endpoint and a bill, and each one is a defect that was live:
//
//   * the daily cap read `cost || 0`, so an unpriced model contributed nothing
//     to the day's total and the cap silently became infinite;
//   * per-IP limits bucketed on the LEFTMOST X-Forwarded-For entry, the one
//     field a caller writes, so every limit was opt-out;
//   * nothing bounded a single turn in dollars, only in hops, while cost grows
//     with the square of the transcript;
//   * every ceiling depended on the pricing table being right.
//
// These need no API key and make no network call: they exercise the router's
// refusal paths, which is exactly where the money is decided.
{
  const { priceFor, LIMITS, costOf: cost } = await import('./gemini_agent.js');
  const { clientIp } = await import('./ratelimit.js');

  const req = (xff) => ({ headers: { 'x-forwarded-for': xff }, socket: {}, ip: '' });
  check('clientIp ignores a spoofed leftmost X-Forwarded-For entry', () => {
    assert.equal(clientIp(req('1.2.3.4, 203.0.113.7')), '203.0.113.7');
  });
  check('clientIp gives one bucket regardless of the spoofed prefix', () => {
    assert.equal(clientIp(req('9.9.9.9, 203.0.113.7')), clientIp(req('8.8.8.8, 203.0.113.7')));
  });
  check('clientIp keeps IPv6 intact', () => {
    assert.equal(clientIp(req('2001:db8::1, 2001:db8::99')), '2001:db8::99');
  });

  check('an unpriced model has no price and no cost', () => {
    assert.equal(priceFor('__no_such_model__'), null);
    assert.equal(cost({ promptTokens: 1e6, candidatesTokens: 1e6 }, '__no_such_model__'), null);
  });
  check('a turn is bounded in dollars, not only in hops', () => {
    assert.ok(LIMITS.maxTurnUsd > 0, 'maxTurnUsd must be set');
    assert.ok(LIMITS.maxTurnUsd < 2, 'a single turn must not be able to spend the daily cap');
  });
  check('there is a daily ceiling that does not consult the pricing table', async () => {
    const { CHAT_LIMITS } = await import('./chat.js');
    assert.ok(CHAT_LIMITS.maxTurnsPerDay > 0, 'maxTurnsPerDay must be set');
  });

  // The daily counter survives a restart when the deployment gives it somewhere
  // to live, and says so when it does not. See mcp/spend_store.js for why this
  // is opt-in rather than always-on: render.yaml declares no disk, so writing to
  // the container filesystem would reset on the exact event (a deploy) that
  // motivated the fix.
  check('the spend counter persists across a restart when it has a file', async () => {
    const { SpendStore } = await import('./spend_store.js');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spend-test-'));
    const file = path.join(dir, 'nested', 'spend.json');
    try {
      const first = new SpendStore(file);
      assert.equal(first.durable, true, 'a writable path must report durable');
      first.rollDay('2026-01-02');
      first.state.usd = 1.75;
      first.state.turns = 9;
      first.save();

      // A NEW instance is what a restarted process gets.
      const restarted = new SpendStore(file);
      assert.equal(restarted.state.usd, 1.75, 'spend must survive the restart');
      assert.equal(restarted.state.turns, 9, 'turn count must survive the restart');
      assert.equal(restarted.state.day, '2026-01-02', 'the day must survive the restart');

      // A UTC rollover still zeroes, which is the behaviour the cap is named for.
      restarted.rollDay('2026-01-03');
      assert.equal(restarted.state.usd, 0, 'a new UTC day starts from zero');
      assert.equal(restarted.state.turns, 0, 'a new UTC day starts from zero');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // The file is the ONLY input that can raise the remaining budget, so it is
  // treated as hostile: anything that is not a finite non-negative number reads
  // as zero. A negative `usd` would otherwise hand back budget that was spent.
  check('a corrupt spend file cannot widen the cap', async () => {
    const { SpendStore } = await import('./spend_store.js');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spend-bad-'));
    const file = path.join(dir, 'spend.json');
    try {
      fs.writeFileSync(file, JSON.stringify({ day: '2026-01-02', usd: -9999, turns: 'lots' }));
      const s = new SpendStore(file);
      assert.equal(s.state.usd, 0, 'a negative spend must not restore budget');
      assert.equal(s.state.turns, 0, 'a non-numeric turn count must read as zero');

      fs.writeFileSync(file, '{ not json');
      const t = new SpendStore(file);
      assert.equal(t.state.usd, 0, 'unparseable must read as zero');
      assert.equal(t.state.day, null, 'unparseable must not claim a day');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // An unusable path must degrade to in-memory rather than take the endpoint
  // down. /etc/hostname is a file, so creating a directory under it is ENOTDIR.
  check('an unusable spend path degrades instead of throwing', async () => {
    const { SpendStore } = await import('./spend_store.js');
    let logged = '';
    const s = new SpendStore('/etc/hostname/sub/spend.json', { log: (m) => (logged = m) });
    assert.equal(s.durable, false, 'an unusable path must not report durable');
    assert.match(logged, /not usable/, 'the fallback must be logged, not silent');
    s.state.usd = 1;
    s.save(); // must not throw
    assert.equal(s.rollDay('2026-01-02'), true, 'rollDay still works in-memory');
  });

  // The status endpoint must not present a partial total as the day's total.
  check('/chat/status discloses whether the cap survives a restart', () => {
    const src = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
    assert.match(src, /capDurable:\s*spendStore\.durable/, 'status must report capDurable');
    assert.match(src, /countingSince/, 'status must report when the counter last zeroed');
  });

  // The page's maxlength and the server's maxMessageChars are the same bound
  // written twice, and they drift silently in the direction that hurts: raise
  // the server and the field still truncates, so the extra room is invisible
  // and nobody can tell whether the limit moved. (The other direction is merely
  // rude — the field accepts text the server then rejects with a 400.)
  //
  // The template is the source codex.html is built from, so this reads the
  // template rather than the artifact and stays honest between rebuilds.
  check('the chat field and the server agree on the message ceiling', async () => {
    const { CHAT_LIMITS } = await import('./chat.js');
    const tpl = readFileSync(new URL('../src/index.template.html', import.meta.url), 'utf8');
    const m = tpl.match(/id="chat-input"[^>]*maxlength="(\d+)"/);
    assert.ok(m, 'the chat input must declare a maxlength');
    assert.equal(
      Number(m[1]),
      CHAT_LIMITS.maxMessageChars,
      `chat-input maxlength=${m[1]} but the server accepts ${CHAT_LIMITS.maxMessageChars}`
    );
  });

  // The blueprint names a model; the pricing table must be able to price it.
  //
  // Otherwise the fail-closed guard does its job at DEPLOY time — the chat bar
  // goes dark and the first anyone knows is a dead dock on the live page. This
  // is the same failure caught one step earlier, where a diff is still in front
  // of someone. render.yaml pins GEMINI_MODEL precisely so this check has
  // something to read.
  //
  // Scanned rather than YAML-parsed: mcp/ has no YAML dependency and this is a
  // two-line shape in a file we control. A declaration that stops matching this
  // shape reads as "not declared", which fails loudly below rather than
  // silently passing.
  check('the model named in render.yaml is one we can price', () => {
    const blueprint = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
    const m = blueprint.match(/-\s*key:\s*GEMINI_MODEL\s*\n\s*value:\s*['"]?([\w.-]+)['"]?/);
    assert.ok(m, 'render.yaml must declare GEMINI_MODEL so the deployed model is auditable');
    const declared = m[1];
    assert.ok(
      priceFor(declared),
      `render.yaml declares GEMINI_MODEL=${declared}, which has no price. ` +
        `/chat would refuse to serve on deploy. Add it to PRICING in gemini_agent.js, ` +
        `or declare CHAT_PRICE_INPUT_PER_1M / CHAT_PRICE_OUTPUT_PER_1M alongside it.`
    );
  });
}

// SDK-dependent: only runs if @modelcontextprotocol/sdk is installed.
try {
  const { buildServer } = await import('./tools.js');
  assert.ok(buildServer(), 'server constructed');
  console.log('  ok  server builds with all tools');
  passed++;
} catch (err) {
  if (/Cannot find package|Cannot find module/.test(err.message)) {
    console.log('  --  server build skipped (SDK not installed in-container)');
  } else {
    console.error(`FAIL  server builds with all tools\n      ${err.message}`);
    process.exitCode = 1;
  }
}

// The refusal path end to end, in its own block so a failure here reports
// itself rather than surfacing under the server-build label. Same SDK skip.
try {
  const express = (await import('express')).default;
  const here = new URL('.', import.meta.url).pathname;
  const sdkPath = (m) => import(require.resolve(m, { paths: [here] }));
  const { buildServer } = await import('./tools.js');
  const { Client } = await sdkPath('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await sdkPath('@modelcontextprotocol/sdk/inMemory.js');
  const { createChatRouter } = await import('./chat.js');

  const app = express();
  app.use(express.json());
  app.use(
    await createChatRouter({
      buildServer,
      Client,
      InMemoryTransport,
      apiKey: 'test-key-never-used', // never spent: the router refuses before any call
      model: '__no_such_model__',
    })
  );
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const posted = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });
  const status = await (await fetch(`${base}/chat/status`)).json();
  server.close();

  assert.equal(posted.status, 503, `expected 503 for an unpriced model, got ${posted.status}`);
  assert.equal(status.enabled, false, '/chat/status must report enabled:false');
  console.log('  ok  /chat refuses to spend on a model it cannot price');
  passed++;
} catch (err) {
  if (/Cannot find package|Cannot find module/.test(err.message)) {
    console.log('  --  /chat refusal check skipped (SDK not installed in-container)');
  } else {
    console.error(`FAIL  /chat refuses to spend on a model it cannot price\n      ${err.message}`);
    process.exitCode = 1;
  }
}

// The lyric family (mcp/lyric_tools.js) — the DISJOINT tool family over the
// lyric harness CLI. Two layers here: (1) SDK-only — the five tools are
// advertised with read-only annotations; (2) LIVE — python3 runs the real
// verbs through the bridge, staged the way the Docker build stages them.
// The live half skips loudly when python3 or the network is absent, but in
// CI both exist, so a skip there is a real signal in the log.
try {
  const here = new URL('.', import.meta.url).pathname;
  const sdkPath = (m) => import(require.resolve(m, { paths: [here] }));
  const { buildServer } = await import('./tools.js');
  const { Client } = await sdkPath('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await sdkPath('@modelcontextprotocol/sdk/inMemory.js');

  const server = buildServer();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'lyric-check', version: '0' }, { capabilities: {} });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const { tools } = await client.listTools();
  const lyric = tools.filter((t) => t.name.startsWith('lyric_'));
  assert.deepEqual(
    lyric.map((t) => t.name).sort(),
    ['lyric_check', 'lyric_grade', 'lyric_plan', 'lyric_screen', 'lyric_types'],
    'the five lyric tools are advertised'
  );
  for (const t of lyric) {
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name} read-only`);
    assert.equal(t.annotations?.openWorldHint, false, `${t.name} closed-world`);
  }
  console.log('  ok  lyric family advertised: 5 tools, read-only, closed-world');
  passed++;

  // LIVE: stage the lexicon exactly as the Docker build does, then drive
  // the bridge with the control pair the ban was taught on, and one full
  // plan->fill->grade round trip. These are the checks that catch a
  // broken subprocess bridge, a wrong cwd, or an image missing python.
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  let staged = false;
  try {
    await run('python3', ['-c', 'import lyric_harness; lyric_harness.fetch_data()'], {
      cwd: new URL('../lyric-harness', import.meta.url).pathname,
      timeout: 120_000,
    });
    staged = true;
  } catch (err) {
    console.log(
      `  --  lyric LIVE checks skipped (python3/lexicon unavailable: ${String(err.message).slice(0, 80)})`
    );
  }
  if (staged) {
    const callText = async (name, args) => {
      const res = await client.callTool({ name, arguments: args });
      assert.ok(!res.isError, `${name} answered without isError`);
      return JSON.parse(res.content[0].text);
    };
    const screened = await callText('lyric_screen', { words: ['hair', 'chair'] });
    assert.equal(screened.exit_code, 0, 'screen exit 0 — a banned pair is an ANSWER');
    assert.ok(
      screened.report.includes('BANNED: HOMEOTELEUTON'),
      'the control pair is banned through the whole stack'
    );
    console.log('  ok  lyric_screen live: hair/chair BANNED: HOMEOTELEUTON, exit 0');
    passed++;

    // THE SHAPE IS READ FROM THE PLAN, NEVER REMEMBERED (2026-08-23).
    // This block used to open `Seed 55 is Count to Five's shape: 22 lines,
    // chorus lines 17-19 returning verbatim as 20-22` and build a 22-line
    // draft to match. That was true of planner v1. Planner v2 re-derived
    // every space it samples from, so seed 55 is 53 lines in 4 sections
    // today -- and the check went red as `1 !== 2`, which is the SYMPTOM
    // (`lyric_grade` returns one block when `plan --fill` produced no
    // render) and names neither the seed nor the count. A grade whose
    // draft is the wrong length REFUSES at exit 2, correctly; the test was
    // the thing that was wrong.
    //
    // So the draft is built from the plan's OWN report: the line count and
    // the return classes come back from `lyric_plan` on the same seed, and
    // nothing here restates them. That is strictly stronger than the
    // literal it replaces -- it proves the two-block contract for whatever
    // shape the planner produces, it cannot go stale when the planner is
    // re-derived, and it reads two coordinates (`lines`, `returns`) the
    // hardcoded version never consulted.
    const plannedRes = await client.callTool({
      name: 'lyric_plan',
      arguments: { seed: 55 },
    });
    assert.ok(!plannedRes.isError, 'lyric_plan answered without isError');
    assert.equal(plannedRes.content.length, 2, 'plan returns two blocks: report, then verdict');
    const planReport = plannedRes.content[0].text;
    const nLines = Number((planReport.match(/-> (\d+) line\(s\)/) || [])[1]);
    assert.ok(nLines >= 4, `the plan declares its own line count (got ${nLines})`);

    // The bracket header rows ARE the shape, and their line counts must sum
    // to the declared total -- an invariant of the report rather than a
    // remembered section list, so a planner that re-derives its patterns
    // still has to satisfy it.
    const headers = [...planReport.matchAll(/\[([A-Z_]+) — (\d+) lines? — /g)];
    assert.ok(headers.length > 0, 'the plan brief carries bracket section headers');
    assert.equal(
      headers.reduce((t, h) => t + Number(h[2]), 0),
      nLines,
      'the section headers account for every declared line'
    );

    // RETURNS is the plan's own verbatim-return declaration. `(none)` is an
    // ordinary answer, not a missing one, so the draft honors whatever is
    // there and asserts nothing about which it got.
    const returnsMatch = planReport.match(/RETURNS: (.*)/);
    assert.ok(returnsMatch, 'the plan report declares its return classes on a RETURNS line');
    const returnsRaw = returnsMatch[1].trim();
    const returnClasses =
      returnsRaw === '(none)'
        ? []
        : returnsRaw.split(';').map((g) => g.split(',').map((n) => Number(n.trim())));

    const bank = (
      'stone rain door light road name glass train hill salt wire ' +
      'bell coat dust song tide map north paper'
    ).split(' ');
    const draft = [];
    for (let i = 1; i <= nLines; i++)
      draft.push(`we carry the morning to the ${bank[(i - 1) % bank.length]}`);
    // A declared return class is the SAME LINE, so every member after the
    // first is that first line verbatim (1-based line numbers).
    for (const cls of returnClasses)
      for (const ln of cls.slice(1)) draft[ln - 1] = draft[cls[0] - 1];
    // The Wide Room fix (2026-08-19): grade and plan lead with the
    // deliverable as its OWN PLAIN-TEXT content block — the song, the plan
    // report — and carry the JSON verdict second, because a render buried
    // as an escaped JSON field is what a client model restyled to bare
    // [SECTION] headers. Block 0 must parse as a song, not as JSON.
    const gradedRes = await client.callTool({
      name: 'lyric_grade',
      arguments: { seed: 55, draft },
    });
    assert.ok(!gradedRes.isError, 'lyric_grade answered without isError');
    assert.equal(gradedRes.content.length, 2, 'grade returns two blocks: song, then verdict');
    const song = gradedRes.content[0].text;
    assert.ok(
      // The plan's OWN first header, not a literal -- see the note above.
      song.includes(`[${headers[0][1]} — ${headers[0][2]} line`) &&
        !song.trimStart().startsWith('{'),
      'block 0 is the SONG as plain text, the plan\u2019s own bracket headers intact'
    );
    // The provenance stamp is SERVER-written under the song, inside the
    // verbatim block: seed + exit + banned-pair count reach the user even
    // through a client that relays nothing else.
    assert.ok(
      /\[GRADED — seed 55 — exit [03], .+ — \d+ banned pair\(s\)/.test(song),
      'block 0 carries the [GRADED — seed …] stamp line'
    );
    const gradeVerdict = JSON.parse(gradedRes.content[1].text);
    assert.ok([0, 3].includes(gradeVerdict.exit_code), 'grade answered (0 or 3, never a refusal)');
    assert.ok(
      /pairs?/i.test(gradeVerdict.report) || gradeVerdict.report.includes('REPORT'),
      'a grade report came back in the verdict block'
    );
    console.log('  ok  lyric_grade live: two blocks — the song plain, the verdict JSON');
    passed++;

    // The two-tier ban reaches the verdict as banned_pairs — UNSKIPPABLE
    // disclosure at the one surface with no revise loop. mass/pass is the
    // demonstrative pair: it RHYMES, so it grades exit 0, and it is
    // HOMEOTELEUTON (-ass on both sides), so a chat model shown only the
    // exit code would present it as finished — the 2026-08-19 site
    // transcript, in miniature.
    const checked = await callText('lyric_check', {
      lines: ['we carry the evening to the mass', 'and no one had to tell us about pass'],
      scheme: 'AA',
    });
    assert.equal(checked.exit_code, 0, 'the banned pair rhymes — no flag stands');
    assert.equal(checked.banned_pairs, 1, 'exactly one banned pair is surfaced');
    assert.equal(checked.banned[0].code, 'HOMEOTELEUTON', 'named by the ban tier that caught it');
    assert.deepEqual(checked.banned[0].lines, [1, 2], 'with the lines to revise');
    assert.ok(
      typeof checked.banned_pairs_meaning === 'string' &&
        checked.banned_pairs_meaning.includes('UNSKIPPABLE'),
      'and the meaning says the ban is unskippable'
    );
    console.log('  ok  lyric_check live: banned_pairs surfaces the ban at exit 0');
    passed++;

    // The SAME plan the draft above was built from -- re-calling the tool
    // here ran the planner a second time on one seed and then asserted a
    // remembered `[CHORUS — 3 lines —` against it, which is the stale
    // literal repaired above wearing a second hat (doctrine 1: one
    // definition per question). `plannedRes` is that call; this check owns
    // the presentation contract, so it keeps its own assertions.
    assert.ok(
      planReport.includes(`[${headers[0][1]} — ${headers[0][2]} line`) &&
        !planReport.trimStart().startsWith('{'),
      'block 0 is the plan report as plain text, its own bracket headers intact'
    );
    assert.equal(
      JSON.parse(plannedRes.content[1].text).exit_code,
      0,
      'plan verdict block reports exit 0'
    );
    console.log('  ok  lyric_plan live: two blocks — the report plain, the verdict JSON');
    passed++;
  }
} catch (err) {
  if (/Cannot find package|Cannot find module/.test(err.message)) {
    console.log('  --  lyric family checks skipped (SDK not installed in-container)');
  } else {
    console.error(`FAIL  lyric family\n      ${err.message}`);
    process.exitCode = 1;
  }
}

// Settle the queued async checks before counting. Without this the summary
// prints while they are still in flight and reports a total that excludes them.
await Promise.all(pending);

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`);
