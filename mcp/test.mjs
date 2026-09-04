// test.mjs — checks the MCP engine drives the deterministic workspace correctly.
// Engine tests need no SDK; the server-build check is skipped if the SDK isn't
// installed (npm ci in mcp/). Run: npm test
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from './engine.js';
import { TOOL_BUDGET_MS } from './budget.js';

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
  check('a turn is bounded in dollars, not only in hops', async () => {
    assert.ok(LIMITS.maxTurnUsd > 0, 'maxTurnUsd must be set');
    // ~~`maxTurnUsd < 2`, "a single turn must not be able to spend the daily
    // cap"~~ — the 2 was the daily cap's own DEFAULT, typed as a literal here,
    // so the relation it named could go false the moment either number moved
    // (doctrine 1). The owner raised the turn cap to $2.50 on 2026-09-02 and
    // it did. The relation is READ from both configs now and its consequence
    // is DISCLOSED rather than asserted away: a turn cap above the daily
    // ceiling means one admitted turn can carry the day past it, because the
    // daily check runs before a turn and never interrupts one in flight.
    const { CHAT_LIMITS: _CL, chatCeilings } = await import('./chat.js');
    const c = chatCeilings();
    assert.equal(c.turnUsd, LIMITS.maxTurnUsd);
    assert.equal(c.dailyUsd, _CL.dailyUsd);
    assert.equal(c.turnCapExceedsDay, LIMITS.maxTurnUsd > _CL.dailyUsd);
    assert.equal(
      c.dayOvershootUsd,
      c.turnCapExceedsDay ? LIMITS.maxTurnUsd - _CL.dailyUsd : 0,
      'the overshoot a single turn can cause is stated, not left to be inferred'
    );
    // Whatever the two numbers are, the day must still be bounded by
    // SOMETHING a turn cannot exceed on its own: either the dollar cap sits
    // under the day, or the turn-count ceiling is finite. That is the
    // invariant the struck literal was reaching for, written so it survives a
    // repin of either figure.
    assert.ok(
      !c.turnCapExceedsDay || _CL.maxTurnsPerDay > 0,
      'a day with a turn cap above its dollar ceiling still needs a turn-count bound'
    );
  });
  check(
    'the DAY has two ceilings too, and which one an ordinary day reaches is derived',
    async () => {
      // `dailyUsd` bounds the day in dollars, `maxTurnsPerDay` in requests, and
      // they are independent on purpose — the count needs no pricing table. The
      // owner moved the dollar figure $2 -> $25 on 2026-09-02 and the answer
      // INVERTED: 400 turns at the measured ~$0.01 mean is ~$4, so the count
      // became what an ordinary day reached and the dollar ceiling what never
      // fired. The count ceiling is DERIVED from the budget the same day and
      // the inversion is gone. Pinned as the arithmetic, never as the answer.
      const {
        CHAT_LIMITS: _CL,
        chatCeilings,
        MEAN_TURN_USD,
        TURNS_HEADROOM,
      } = await import('./chat.js');
      const { turnBudget } = await import('./gemini_agent.js');
      const c = chatCeilings();
      assert.equal(c.dayByTurnsUsd, _CL.maxTurnsPerDay * MEAN_TURN_USD);
      // THE COUNT CEILING IS DERIVED FROM THE BUDGET IT MUST NOT PRE-EMPT
      // (2026-09-02). Typing a second number is what let the two invert in
      // the first place, so what is pinned is the DERIVATION and the
      // separation it buys, never either figure.
      assert.equal(
        _CL.maxTurnsPerDay,
        Math.ceil((_CL.dailyUsd / MEAN_TURN_USD) * TURNS_HEADROOM),
        'the count ceiling is derived from the dollar budget and the headroom'
      );
      assert.ok(TURNS_HEADROOM > 1, 'at 1.0 the two ceilings tie and noise picks the winner');
      assert.ok(
        c.dayByTurnsUsd > c.dailyUsd,
        `an ordinary day must reach the DOLLAR budget first: ${c.dayByTurnsUsd} vs ${c.dailyUsd}`
      );
      // What this ceiling costs when the dollar arithmetic cannot be trusted —
      // the case it exists for — is REPORTED rather than left to be found, and
      // the bound on any ONE client is the rate limiter's, not this file's.
      assert.equal(c.worstCaseDayUsd, _CL.maxTurnsPerDay * turnBudget().worstLegalTurnUsd);
      assert.equal(c.perIpPerDay, _CL.perIpPerHour * 24);
      assert.ok(
        c.perIpPerDay < _CL.maxTurnsPerDay,
        'the day ceiling is a FLEET bound: one address cannot reach it alone'
      );
      assert.equal(
        c.perDay,
        c.dayByTurnsUsd < c.dailyUsd ? 'maxTurnsPerDay' : 'dailyUsd',
        'the reported daily ceiling IS that comparison'
      );
      assert.ok(
        MEAN_TURN_USD > 0,
        'the mean the count ceiling is priced at is declared, not quoted'
      );
    }
  );
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

// ── the revise state is carried, never typed (2026-08-28) ───────────────────
//
// `lyric_revise`'s state blob measured ~262KB on a real run and the agent's
// maxOutputTokens is 2,048, so a declaration exposing `state` asks the model
// to type an argument no model can type through this adapter. The workspace
// invented the treatment; these checks hold the second family to it: the
// declaration must not expose it, the adapter must recognise the tool, and
// the model-facing view of a result must not contain the blob in either the
// two-block (presentation + verdict) or one-block shape.
{
  const { toGeminiDeclarations } = await import('./gemini_tools.js');
  const fixtureTools = [
    {
      name: 'lyric_revise',
      description: 'revise',
      inputSchema: {
        type: 'object',
        properties: {
          seed: { type: 'integer' },
          draft: { type: 'array', items: { type: 'string' } },
          state: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['seed', 'draft'],
      },
    },
    {
      name: 'edit_recipe',
      description: 'edit',
      inputSchema: {
        type: 'object',
        properties: { workspace: {}, edits: { type: 'array', items: { type: 'string' } } },
        required: ['workspace', 'edits'],
      },
    },
  ];
  const derived = toGeminiDeclarations(fixtureTools);
  check('the state-taking tool is recognised for carriage, by derivation not by list', () => {
    assert.deepEqual(derived.stateTools, ['lyric_revise']);
    assert.deepEqual(derived.workspaceTools, ['edit_recipe']);
  });
  const revise = derived.declarations.find((d) => d.name === 'lyric_revise');
  check('the revise declaration exposes no `state` and keeps every other parameter', () => {
    assert.ok(!revise.parameters.properties.state, 'state must be stripped');
    assert.ok(revise.parameters.properties.answer, 'answer must survive');
    assert.ok(revise.parameters.properties.seed, 'seed must survive');
    assert.ok(revise.parameters.properties.draft, 'draft must survive');
    assert.ok(
      revise.description.includes('carried for you automatically'),
      'the description must say the state is carried, or a model that read the MCP ' +
        'instructions will call the declaration malformed'
    );
  });

  const { _agentInternals } = await import('./gemini_agent.js');
  check('a two-block verdict reaches the model without the blob', () => {
    const fr = _agentInternals.toFunctionResponse('lyric_revise', 'id1', {
      content: [
        {
          type: 'text',
          text: '[AWAITING PROPOSAL — seed 7 — 0 answer(s) on record — NO SONG YET]\n\nQ',
        },
        {
          type: 'text',
          text: JSON.stringify({
            exit_code: 4,
            status: 'awaiting_proposal',
            state: 'x'.repeat(64),
          }),
        },
      ],
    });
    assert.ok(fr.response.presentation.includes('AWAITING PROPOSAL'), 'the question must survive');
    assert.equal(fr.response.verdict.exit_code, 4, 'the verdict must survive');
    assert.ok(!('state' in fr.response.verdict), 'the blob must not reach the model');
  });
  check('a one-block payload reaches the model without state or workspace', () => {
    const fr = _agentInternals.toFunctionResponse('lyric_revise', 'id2', {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ exit_code: 2, state: 'blob', workspace: { a: 1 } }),
        },
      ],
    });
    assert.equal(fr.response.exit_code, 2);
    assert.ok(!('state' in fr.response) && !('workspace' in fr.response));
  });

  // ── M-158: the suspended-run reminder ────────────────────────────────────
  // The battery's first model-level finding: the model posted the loop's
  // answer into the CHAT and stalled five turns with the question unanswered
  // in the only channel that reaches the harness. The reminder must exist
  // exactly while a suspended run is carried — both directions pinned, plus
  // the structural half: the request's systemInstruction has ONE builder.
  const { suspendedSeed, buildSystemInstruction, carryState } = _agentInternals;

  // ── M-189: the CLI's globals and the missing fields reach the tools ─────
  {
    const { LYRIC_TOOL_SCHEMAS: S, _argvInternals: AV } = await import('./lyric_tools.js');
    check(
      'every grading tool can declare --voices and --fallback; screen takes a relation; verify takes structures',
      () => {
        for (const t of ['lyric_grade', 'lyric_revise', 'lyric_verify', 'lyric_check']) {
          assert.ok('voices' in S[t] && 'fallback' in S[t], `${t} lacks voices/fallback`);
        }
        assert.ok(
          'relation' in S.lyric_screen && 'fallback' in S.lyric_screen,
          "screen asks the grade's question"
        );
        assert.ok(
          'structures' in S.lyric_verify,
          'verify is checked under the mandate lyric_check grades under'
        );
        for (const t of ['lyric_plan', 'lyric_grade', 'lyric_revise']) {
          assert.ok('narrative' in S[t], `${t} lacks narrative`);
        }
        assert.ok(
          !('voices' in S.lyric_plan) && !('voices' in S.lyric_sweep),
          'a verb that reads no draft takes no voices'
        );
      }
    );
    check('the globals stand AHEAD of the verb and only when declared', () => {
      assert.deepEqual(AV.globalsFor({}), []);
      assert.deepEqual(AV.globalsFor({ voices: false, fallback: undefined }), []);
      assert.deepEqual(AV.globalsFor({ voices: true }), ['--voices']);
      assert.deepEqual(AV.globalsFor({ fallback: 'low' }), ['--fallback=low']);
      assert.deepEqual(AV.globalsFor({ voices: true, fallback: 'high' }), [
        '--voices',
        '--fallback=high',
      ]);
      assert.deepEqual(
        AV.globalsFor({ fallback: 'bogus' }),
        [],
        'an undeclared value is not passed through'
      );
    });
    check('planArgs carries --narrative= exactly as it carries --title=', () => {
      assert.deepEqual(AV.planArgs({ seed: 7 }), ['--seed=7']);
      assert.deepEqual(AV.planArgs({ seed: 7, narrative: 'off' }), ['--seed=7', '--narrative=off']);
      assert.deepEqual(
        AV.planArgs({ seed: 7, narrative: '' }),
        ['--seed=7'],
        'an empty string emits no bare flag'
      );
      assert.deepEqual(AV.planArgs({ seed: 7, title: 'Ledger', narrative: 'ESTABLISH,TURN/BUT' }), [
        '--seed=7',
        '--title=Ledger',
        '--narrative=ESTABLISH,TURN/BUT',
      ]);
    });
  }

  // ── M-195: the pasted-song door on the connector ─────────────────────────
  {
    const { LYRIC_TOOL_SCHEMAS: S, _verdictInternals: VI } = await import('./lyric_tools.js');
    const { _agentInternals: AI } = await import('./gemini_agent.js');
    check(
      'lyric_recover exists; lyric_check and lyric_revise take a blueprint; lyric_revise no longer requires a seed',
      () => {
        assert.ok(
          'lyric_recover' in S && 'lines' in S.lyric_recover && 'placements' in S.lyric_recover
        );
        assert.ok('blueprint' in S.lyric_check && 'subdivision' in S.lyric_check);
        assert.ok(
          'blueprint' in S.lyric_revise && 'groups' in S.lyric_revise && 'scheme' in S.lyric_revise
        );
        assert.ok(S.lyric_revise.seed.isOptional(), 'seed is optional on lyric_revise');
        assert.ok(!S.lyric_grade.seed.isOptional(), 'and still required on lyric_grade');
      }
    );
    // REPINNED 2026-09-02: the stdout below is the harness's REAL render
    // shape (`  key  [REFUSED] value` + an indented reason line + the
    // closing key list), copied from `recover` on a four-line unmarked
    // paste. The first pin fed the extractor `  meter: REFUSED — …`, a line
    // the harness never prints, and passed while every real `refusals` came
    // back `[]` — the self-grep shape M-142 charged test_recover §6 with.
    // The live section below drives the real verb as well.
    check('the recovered mandate and the refusals are read off the recover report', () => {
      const stdout = [
        'RECOVERED STRUCTURE — every coordinate with how it was obtained',
        '  total_lines          [counted] 4',
        '  sections             [REFUSED] none',
        '      the text carries no [SECTION] mark and no blank-line block, so its sectioning cannot be read off it. Mark the sections, or declare a blueprint',
        '  syllables_per_line   [counted] 8-10 syllables, 37 total',
        '  web                  [derived] 3 admitted pair(s)',
        '      every admitted pair over 14 binding sites at 4 placements per line',
        '  meter                [REFUSED] None',
        '      a bar grid is a DECLARED coordinate (doctrine 4). Declare one with --blueprint=',
        '',
        '  3 REFUSED coordinate(s) — each is a work order, not a failure (doctrine 20)',
        '      sections',
        '      meter',
        '      repeats_at_a_placement',
        '  MANDATE SPELLING (the cover as the two CLI flags — hand them to brief/revise):',
        '    --groups=1,3;2,4.head',
        '    --returns=5,13',
        '  EXIT 3 — 3 coordinate(s) REFUSED (sections, meter, repeats_at_a_placement)',
      ].join('\n');
      const v = VI.verdictOf({ code: 3, stdout, stderr: '' });
      assert.deepEqual(VI.extractRecoveredMandate(stdout), {
        groups: '1,3;2,4.head',
        returns: '5,13',
      });
      assert.deepEqual(VI.extractRecoverRefusals(stdout), [
        {
          coordinate: 'sections',
          why: 'the text carries no [SECTION] mark and no blank-line block, so its sectioning cannot be read off it. Mark the sections, or declare a blueprint',
        },
        {
          coordinate: 'meter',
          why: 'a bar grid is a DECLARED coordinate (doctrine 4). Declare one with --blueprint=',
        },
        { coordinate: 'repeats_at_a_placement', why: '' },
      ]);
      assert.deepEqual(
        VI.extractRecoverRefusals('  meter: REFUSED — the shape the first pin fed'),
        [],
        'the old synthetic shape reads as NO refusal, which is what it always was'
      );
      assert.equal(v.exit_code, 3);
      assert.equal(VI.extractRecoveredMandate('nothing here'), null);
    });
    check('a recovered mandate fits the check/revise ceiling (M-195, repinned 2026-09-02)', () => {
      // MEASURED at the default four places: 10,009 chars over 32 lines
      // (songs/matinee.txt), 5,299 over 25, 4,132 over 19 — every one
      // refused by the old 400-char ceiling, so recover -> check -> revise
      // could not chain. The ceiling is sized to the door now.
      // 670 groups is the MEASURED count over 32 lines; the measured string
      // (10,009 chars) mixes bare and placed members, so both a synthetic
      // cover of that many groups and a literal 10k-char mandate must pass.
      const long = Array.from(
        { length: 670 },
        (_, i) => `${1 + (i % 32)}.endword,${1 + ((i * 7) % 32)}`
      ).join(';');
      const measured = '1,2;'.repeat(2503); // 10,012 chars, the measured length
      assert.equal(long.split(';').length, 670, 'the synthetic cover has the MEASURED group count');
      assert.ok(S.lyric_check.groups.safeParse(long).success, 'lyric_check takes it');
      assert.ok(S.lyric_revise.groups.safeParse(long).success, 'lyric_revise takes it');
      assert.ok(S.lyric_check.groups.safeParse(measured).success, 'and a 10k-char mandate');
      assert.ok(
        !S.lyric_check.groups.safeParse('x'.repeat(70_000)).success,
        'and a runaway is still refused, never clamped'
      );
    });
    check("a pasted song's run is carried on its MANDATE, a planned one on its seed", () => {
      const surface = { stateTools: new Set(['lyric_revise']) };
      const seeded = { seed: 7 };
      const pasted = { groups: '1,3;2,4', returns: '5,13' };
      assert.equal(AI.stateKey(seeded), 'seed:7');
      assert.ok(AI.stateKey(pasted).startsWith('mandate:'));
      assert.equal(
        AI.stateKey({ draft: ['x'] }),
        null,
        'no seed and no mandate: nothing to key on'
      );
      const s1 = AI.carryState(
        null,
        'lyric_revise',
        pasted,
        { exit_code: 4, state: 'S1' },
        surface
      );
      assert.equal(s1.key, AI.stateKey(pasted));
      assert.equal(s1.seed, null);
      assert.equal(
        AI.carryState(
          s1,
          'lyric_revise',
          { ...pasted, returns: '6,14' },
          { exit_code: 3, state: 'S2' },
          surface
        ),
        s1,
        'a stop on a DIFFERENT mandate does not clear this run'
      );
      {
        // M-232: exit 3 PARKS the run instead of dropping it.
        const parked = AI.carryState(
          s1,
          'lyric_revise',
          pasted,
          { exit_code: 3, state: 'S2' },
          surface
        );
        assert.equal(parked.parked, true, 'exit 3 on this mandate parks the run');
        assert.equal(parked.key, s1.key);
        assert.equal(parked.seed, null);
        assert.equal('state' in parked, false, 'a parked record carries no state');
      }
      assert.equal(
        AI.carriedKey({ seed: 7, state: 'x' }),
        'seed:7',
        'a pre-M-195 record reads as its seed'
      );
      assert.equal(
        AI.suspendedSeed({
          key: AI.stateKey(pasted),
          seed: null,
          state: '{"pending":{"kind":"propose"}}',
        }),
        'the declared mandate'
      );
    });
    check("the stamp of a pasted song's run parses with no seed", () => {
      const rec = VI.extractLoopRecord(
        '  [FINISHED — declared mandate — exit 3 — NO_PROGRESS after 2 round(s) — UNRESOLVED: L2]'
      );
      assert.equal(rec.seed, null);
      assert.equal(rec.stop_reason, 'NO_PROGRESS');
      assert.deepEqual(rec.unresolved_lines, ['L2']);
    });
  }

  // ── M-186: the verdict carries what the report says, not only the code ──
  {
    const { _verdictInternals: VI } = await import('./lyric_tools.js');
    const { _agentInternals: AGI } = await import('./gemini_agent.js');
    // M-186's status label, three words rather than two (2026-09-02): a
    // whole-only exit 3 used to read `stopped_with_open_lines` with
    // `loop_unresolved` 0 — a cause the verdict itself contradicted.
    check('the standing findings at a stop are parsed off the report (M-232)', () => {
      const st =
        "  FINDING [FLAG] METER: L3 early\n\n  STANDING AT THE STOP — the findings the open lines and the whole draft still carry, in the report's own spelling:\n    L3: FINDING [FLAG] METER: L3 wants six beats\n    L5: FINDING [FLAG] SLOP: too predictable\n    WHOLE-DRAFT: FINDING [FLAG] TITLE_NOT_IN_HOOK: the title is not in the hook\n         title 'zebra confetti' vs hook \"Go on.\"; the title phrase occurs 0 time(s).\n\n  THE SONG, PERFORMANCE ORDER:\n\nx\n";
      // The shape a real parked `revise` prints (measured on keep_the_light
      // retitled, 2026-09-04): a finding's detail line rides with it.
      assert.deepEqual(VI.extractStanding(st), [
        'L3: FINDING [FLAG] METER: L3 wants six beats',
        'L5: FINDING [FLAG] SLOP: too predictable',
        'WHOLE-DRAFT: FINDING [FLAG] TITLE_NOT_IN_HOOK: the title is not in the hook — title \'zebra confetti\' vs hook "Go on."; the title phrase occurs 0 time(s).',
      ]);
      assert.deepEqual(
        VI.extractStanding('no block here\n  FINDING [FLAG] METER: L3'),
        [],
        "the report's own findings before the block are not the standing ones"
      );
    });
    check('a whole-only exit 3 is labelled by its cause, not as open lines', () => {
      assert.equal(VI.loopStatusOf(0, { loop_unresolved: 0 }), 'finished_clean');
      assert.equal(
        VI.loopStatusOf(3, { loop_unresolved: 2, loop_whole_flag_codes: ['HOOK_ABSENT'] }),
        'stopped_with_open_lines'
      );
      assert.equal(
        VI.loopStatusOf(3, { loop_unresolved: 0, loop_whole_flag_codes: ['TITLE_NOT_IN_HOOK'] }),
        'stopped_with_whole_draft_flags'
      );
      assert.equal(VI.loopStatusOf(3, { loop_unresolved: 0 }), 'stopped_with_open_lines');
      // The transcript record is a VALUE pin: `loopFields` is what runTurn
      // spreads into every call record. chat.js and flash_battery.mjs copy
      // the field off that record in an inline map, so for those two the
      // pin is the weaker source-includes and says so.
      const rec = AGI.loopFields({
        exit_code: 3,
        loop_stop_reason: 'success',
        loop_rounds: 0,
        loop_unresolved: 0,
        loop_whole_flag_codes: ['TITLE_NOT_IN_HOOK'],
        answers_on_record: 0,
      });
      assert.deepEqual(rec.loop_whole_flag_codes, ['TITLE_NOT_IN_HOOK']);
      assert.equal(rec.loop_unresolved, 0);
      assert.equal(AGI.loopFields({ exit_code: 0 }).loop_whole_flag_codes, null);
      assert.equal(AGI.loopFields(null).exit_code, null);
      for (const f of ['chat.js', '../scripts/flash_battery.mjs']) {
        const src = readFileSync(new URL(f, import.meta.url), 'utf8');
        assert.ok(
          src.includes('loop_whole_flag_codes: c.loop_whole_flag_codes ?? null') ||
            src.includes('whole_flags: c.loop_whole_flag_codes ?? null'),
          `${f} copies the whole-flag codes off the record (source pin)`
        );
      }
    });
    check('exit 1 is CRASHED, never read as a verdict', () => {
      const v = VI.verdictOf({ code: 1, stdout: '', stderr: 'Traceback (most recent call last)' });
      assert.equal(v.exit_code, 1);
      assert.ok(v.meaning.startsWith('CRASHED'), v.meaning);
      assert.ok(!('flags' in v), 'no REPORT line, no counts invented');
    });
    check('a flagged brief at exit 0 says the flags STAND instead of "no flag stands"', () => {
      const stdout =
        '  REPORT: 3 line(s) briefed — 2 FLAG, 1 NOTE (two counts, never summed: doctrine 79); 1 WHOLE-DRAFT finding(s), 1 of them FLAG(S), below\n';
      const v = VI.verdictOf({ code: 0, stdout, stderr: '' });
      assert.equal(v.flags, 2);
      assert.equal(v.notes, 1);
      assert.equal(v.whole_flags, 1);
      assert.ok(v.meaning.includes('STAND') && !v.meaning.includes('no flag stands'), v.meaning);
      const clean = VI.verdictOf({
        code: 0,
        stdout:
          '  REPORT: 2 line(s) briefed — 0 FLAG, 2 NOTE (two counts, never summed: doctrine 79)\n',
        stderr: '',
      });
      assert.equal(clean.flags, 0);
      assert.equal(clean.whole_flags, 0, 'no whole-draft clause reads as zero, not as absent');
      assert.equal(clean.meaning, VI.EXIT_MEANING[0], 'notes alone keep the plain meaning');
    });
    check('unreadable end words surface as refusals with their lines', () => {
      const stdout = [
        '  L4: the word was xqzt',
        '      FINDING [FLAG] UNREADABLE_END_WORD: L4 ends on a word the lexicon cannot read (lines 4)',
        '         xqzt is not in CMUdict',
        '      FINDING [NOTE] SCHEME_UNREADABLE: L2/L4 were NOT judged — the pair has an unreadable end (lines 2, 4)',
        '         refusal, not a verdict',
      ].join('\n');
      const v = VI.verdictOf({ code: 0, stdout, stderr: '' });
      assert.equal(v.unreadable, 2);
      assert.deepEqual(v.unreadable_findings[0].lines, ['4']);
      assert.deepEqual(v.unreadable_findings[1].lines.sort(), ['2', '4']);
      assert.ok(v.unreadable_meaning.includes('NOT judged'));
      const none = VI.verdictOf({ code: 0, stdout: '  nothing flagged\n', stderr: '' });
      assert.ok(!('unreadable' in none), 'absent means none found, never zero invented');
    });
    check('the loop stamp carries the whole-draft flags as their own count', () => {
      const rec = VI.extractLoopRecord(
        '  [FINISHED — seed 16 — exit 3 — NO_PROGRESS after 2 round(s) — UNRESOLVED: L2, L5 — WHOLE-DRAFT FLAG: STACKED_DRAFT, TITLE_NOT_IN_HOOK]'
      );
      assert.equal(rec.unresolved, 2);
      assert.deepEqual(rec.unresolved_lines, ['L2', 'L5']);
      assert.equal(rec.whole_flags, 2);
      assert.deepEqual(rec.whole_flag_codes, ['STACKED_DRAFT', 'TITLE_NOT_IN_HOOK']);
      const only = VI.extractLoopRecord(
        '  [FINISHED — seed 16 — exit 3 — SUCCESS after 1 round(s) — no flag stands — WHOLE-DRAFT FLAG: TITLE_NOT_IN_HOOK]'
      );
      assert.equal(only.unresolved, 0, 'no open line');
      assert.equal(only.whole_flags, 1, 'and still not finished');
      const old = VI.extractLoopRecord(
        '  [FINISHED — seed 16 — exit 0 — SUCCESS after 1 round(s) — no flag stands]'
      );
      assert.equal(old.whole_flags, 0, 'the pre-M-186 stamp still parses');
    });
    check('the pursued findings printed at the stop reach banned_pairs', () => {
      const stdout = [
        "  STANDING AT THE STOP — the findings the open lines and the whole draft still carry, in the report's own spelling:",
        "    L3: FINDING [NOTE] HOMEOTELEUTON: L1/L3 rhyme on the SAME SPELLED ENDING ('store'/'wore', both -ore) — the laziest class, banned before any frequency judgment (lines 1, 3)",
        "         spelled rime 'ore' on both sides.",
        '  [FINISHED — seed 16 — exit 3 — NO_PROGRESS after 1 round(s) — UNRESOLVED: L3]',
      ].join('\n');
      const v = VI.verdictOf({ code: 3, stdout, stderr: '' });
      assert.equal(v.banned_pairs, 1, 'the ban chip can fire on the finishing verb');
      assert.equal(v.loop_unresolved, 1);
    });
  }
  // ── M-183: a COMPLETE run is not carried into the next call ─────────────
  // The harvest used to keep whatever state the verdict carried, so a run
  // that had reached a stop condition (exit 0/3) was re-injected on the next
  // lyric_revise call for the seed, the harness replayed every answer and
  // stopped identically, and no parked-continue push ever asked the writer a
  // second question. Pinned in every direction the function decides.
  check('only a SUSPENDED verdict (exit 4) is carried; a stop (0/3) clears the seed', () => {
    const surface = { stateTools: new Set(['lyric_revise']) };
    const args = { seed: 7 };
    const suspended = carryState(
      null,
      'lyric_revise',
      args,
      { exit_code: 4, state: 'S1' },
      surface
    );
    // M-195: the carry is keyed on `seed:N` for a planned song and `mandate:…`
    // for a pasted one, so the record carries its key beside the seed.
    // M-229: the record also pins the run's declarations (everything but
    // draft, answer and state) — here the seed alone.
    assert.deepEqual(
      suspended,
      { key: 'seed:7', seed: 7, state: 'S1', decl: { seed: 7 } },
      'exit 4 carries the record'
    );
    assert.deepEqual(
      carryState(
        suspended,
        'lyric_revise',
        args,
        {
          exit_code: 3,
          state: 'S2',
          loop_stop_reason: 'NO_PROGRESS',
          loop_unresolved_lines: ['L2'],
          loop_whole_flag_codes: [],
        },
        surface
      ),
      {
        key: 'seed:7',
        seed: 7,
        parked: true,
        decl: { seed: 7 },
        stop: 'NO_PROGRESS',
        open: ['L2'],
        whole: [],
        standing: [],
      },
      'exit 3 is COMPLETE as a loop and PARKED as a record (M-232): no state, the open lines named'
    );
    assert.equal(
      carryState(suspended, 'lyric_revise', args, { exit_code: 0, state: 'S2' }, surface),
      null,
      'exit 0 is COMPLETE too'
    );
    assert.deepEqual(
      carryState(suspended, 'lyric_revise', args, { exit_code: 2 }, surface),
      suspended,
      'a refusal leaves the pending question carried'
    );
    assert.deepEqual(
      carryState(suspended, 'lyric_revise', { seed: 8 }, { exit_code: 3, state: 'S3' }, surface),
      suspended,
      "a stop on ANOTHER seed does not touch this seed's suspended run"
    );
    assert.deepEqual(
      carryState(suspended, 'lyric_grade', args, { exit_code: 3, state: 'S3' }, surface),
      suspended,
      'a tool that carries no state never moves the record'
    );
    assert.equal(
      carryState(null, 'lyric_revise', args, { exit_code: 4 }, surface),
      null,
      'exit 4 with no state string carries nothing rather than a broken record'
    );
  });
  check('a carried state with a pending question names its seed', () => {
    assert.equal(suspendedSeed({ seed: 7, state: '{"pending":{"kind":"propose"}}' }), 7);
    assert.equal(
      suspendedSeed({ seed: 7, state: '{"answered":{}}' }),
      null,
      'no pending → no reminder'
    );
    assert.equal(
      suspendedSeed({ seed: 7, state: 'not json' }),
      null,
      'garbage state → no reminder, never a throw'
    );
    assert.equal(suspendedSeed(null), null);
  });
  check('the reminder rides the systemInstruction only while a run is suspended', () => {
    const surface = { instructions: 'BASE INSTRUCTIONS' };
    const withRun = buildSystemInstruction(surface, {
      seed: 7,
      state: '{"pending":{"kind":"propose"}}',
    });
    const text = withRun.parts[0].text;
    assert.ok(text.startsWith('BASE INSTRUCTIONS'), 'the base instructions must survive in front');
    assert.ok(text.includes('seed 7'), 'the reminder names the suspended seed');
    assert.ok(
      text.includes('lyric_revise'),
      'the reminder names the only channel that advances the run'
    );
    const without = buildSystemInstruction(surface, null);
    assert.equal(
      without.parts[0].text,
      'BASE INSTRUCTIONS',
      'no suspended run → the base bytes, exactly'
    );
    assert.equal(
      buildSystemInstruction({ instructions: undefined }, null),
      null,
      'nothing to say → no block at all'
    );
  });
  // ── M-197: a throw mid-turn carries the hops already spent ─────────────
  // `generate()` throws on a 429 (retries 0), and the hop loop used to let
  // that throw discard `usage` — every billed hop before it was uncounted by
  // the daily cap. The stubbed model answers ONE function-calling hop, then
  // a 429; the error must carry exactly that one hop's usage.
  await (async () => {
    const { runTurn: _runTurn, LIMITS: _LIMITS } = await import('./gemini_agent.js');
    const realFetch = globalThis.fetch;
    let hop = 0;
    globalThis.fetch = async () => {
      hop += 1;
      if (hop === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              { content: { parts: [{ functionCall: { name: 'lyric_types', args: { a: 'x' } } }] } },
            ],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 0 },
          }),
        };
      }
      return { ok: false, status: 429, json: async () => ({ error: { message: 'quota' } }) };
    };
    try {
      let caught = null;
      try {
        await _runTurn({
          apiKey: 'k',
          surface: {
            instructions: '',
            declarations: [],
            workspaceTools: new Set(),
            stateTools: new Set(),
          },
          callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
          userText: 'hi',
          limits: { ..._LIMITS, maxTurnUsd: 0 },
          retries: 0,
        });
      } catch (e) {
        caught = e;
      }
      check("a 429 on the second hop throws with the FIRST hop's usage on the error", () => {
        assert.ok(caught, 'runTurn threw');
        assert.equal(caught.status, 429);
        assert.ok(caught.usage, 'the error carries usage');
        assert.equal(caught.usage.requests, 1, 'one hop was billed before the throw');
        assert.equal(caught.usage.promptTokens, 10);
        assert.equal(caught.usage.candidatesTokens, 5);
        assert.ok(
          Array.isArray(caught.calls) && caught.calls.length === 1,
          'and the one call it made'
        );
      });
    } finally {
      globalThis.fetch = realFetch;
    }
  })();
  check(
    'chat.js retries a transient upstream three times and puts the seed on every row (M-232)',
    () => {
      const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
      assert.ok(
        /retries: 3,\s*\n\s*retryStatuses: RETRY_TRANSIENT/.test(chat),
        'three retries on RETRY_TRANSIENT'
      );
      assert.ok(
        /seed: typeof c\.args\?\.seed === 'number' \? c\.args\.seed : null/.test(chat),
        'the seed rides the row'
      );
    }
  );
  check('chat.js charges the partial usage in its catch and puts the cost on the reply', () => {
    const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
    assert.ok(/err\.usage\.requests > 0/.test(chat), 'the catch reads the partial usage');
    assert.ok(
      /chargedUsd = partial === null \? LIMITS\.maxTurnUsd : partial/.test(chat),
      "an unpriceable partial charges the cap, the success path's own safe direction"
    );
    assert.ok(
      /hopsBeforeFailure/.test(chat) && /chargedUsd: Number/.test(chat),
      'and says so on the error body'
    );
    assert.ok(
      /cost: run\.cost,\s*\n\s*usage: run\.usage,/.test(chat),
      'the success body carries cost and usage (C11)'
    );
    const ga = readFileSync(new URL('./gemini_agent.js', import.meta.url), 'utf8');
    assert.ok(
      /err\.usage = usage;\s*\n\s*err\.calls = calls;/.test(ga),
      'the agent attaches both on the way out'
    );
  });
  // ── M-168 (2026-09-02): a 429 on the chat path is retried inside a budget ──
  // Round 10 ended on a hard 429 the chat path threw at once. RATE_LIMIT_RETRY
  // retries at most twice, honours Retry-After when it fits the budget,
  // refuses it at once when it does not, and counts every retried request in
  // `usage` so M-197's accounting sees the quota it spent. The stubbed 429s
  // carry `Retry-After: 0` so the pin runs in milliseconds; the budget's own
  // 2 s / 4 s backoff is pinned by shape, not slept.
  await (async () => {
    const {
      runTurn: _runTurn,
      LIMITS: _LIMITS,
      RATE_LIMIT_RETRY: _RL,
      RETRY_TRANSIENT: _TRANSIENT,
    } = await import('./gemini_agent.js');
    const realFetch = globalThis.fetch;
    const surface = {
      instructions: '',
      declarations: [],
      workspaceTools: new Set(),
      stateTools: new Set(),
    };
    const ok = () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'done' }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 0 },
      }),
    });
    const busy = (retryAfter) => () => ({
      ok: false,
      status: 429,
      headers: { get: (k) => (k.toLowerCase() === 'retry-after' ? retryAfter : null) },
      json: async () => ({ error: { message: 'quota' } }),
    });
    const drive = async (script) => {
      let i = 0;
      globalThis.fetch = async () => script[Math.min(i, script.length - 1)](i++);
      try {
        return await _runTurn({
          apiKey: 'k',
          surface,
          callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
          userText: 'hi',
          limits: { ..._LIMITS, maxTurnUsd: 0 },
          // chat.js's own configuration: 429 is NOT among the statuses waited
          // out unbounded, so the budget is what applies to it.
          retries: 0,
          retryStatuses: _TRANSIENT,
          rateLimit: _RL,
        });
      } finally {
        globalThis.fetch = realFetch;
      }
    };
    const thrown = async (script) => {
      try {
        await drive(script);
      } catch (e) {
        return e;
      }
      return null;
    };
    check('RATE_LIMIT_RETRY is two retries whose backoffs fit its own total wait', () => {
      assert.equal(_RL.retries, 2);
      assert.deepEqual(_RL.backoffMs, [2000, 4000]);
      assert.ok(
        _RL.backoffMs.reduce((a, b) => a + b, 0) <= _RL.maxTotalWaitMs,
        'the declared backoffs never exceed the declared total'
      );
      assert.ok(
        _RL.maxTotalWaitMs < 38_000,
        'and the total is under the 38 s stall chat.js refuses'
      );
    });
    const run = await drive([busy('0'), ok]);
    check('a 429 then a 200 is ONE retry: the reply lands and usage counts both requests', () => {
      assert.equal(run.reply, 'done');
      assert.equal(run.usage.requests, 2, 'the retried 429 and the 200');
      assert.equal(run.usage.retries, 1);
      assert.equal(run.stopped, null);
    });
    const past = await thrown([busy('60'), ok]);
    check('a Retry-After past the budget is refused AT ONCE with the wait on the error', () => {
      assert.ok(past, 'threw');
      assert.equal(past.status, 429);
      assert.equal(past.retryAfterMs, 60_000, 'the hint, in ms');
      assert.equal(past.rateLimitRetries, 0, 'no retry was spent on it');
      assert.equal(past.usage.requests, 0, 'and nothing was billed');
    });
    const exhausted = await thrown([busy('0'), busy('0'), busy('0'), ok]);
    check('three 429s exhaust the two retries: the throw carries the two requests spent', () => {
      assert.ok(exhausted, 'threw');
      assert.equal(exhausted.status, 429);
      assert.equal(exhausted.rateLimitRetries, 2);
      assert.equal(exhausted.usage.requests, 2, 'two retried requests, the final throw uncounted');
      assert.equal(exhausted.usage.retries, 2);
    });
  })();
  check('chat.js hands runTurn the bounded 429 budget beside its transient list', () => {
    const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
    assert.ok(
      /retryStatuses: RETRY_TRANSIENT,\s*\n\s*rateLimit: RATE_LIMIT_RETRY,/.test(chat),
      'rateLimit: RATE_LIMIT_RETRY rides beside retryStatuses: RETRY_TRANSIENT'
    );
    assert.ok(
      /res\.set\('Retry-After', String\(Math\.ceil\(err\.retryAfterMs \/ 1000\)\)\)/.test(chat),
      'a refused hint reaches the client as the standard header'
    );
    assert.ok(/refusal: c\.refusal \?\? null,/.test(chat), 'tools[] carries the refusal headline');
  });
  // ── M-219 (2026-09-03, round 11): a malformed function call is RE-ASKED ──
  // Round 11 ended 8 of 9 turns on Gemini's MALFORMED_FUNCTION_CALL, two of
  // them before any call was made; the hop loop treated every non-STOP finish
  // as the end of the turn, so the loop's next question waited a whole
  // battery pace. The re-ask is bounded (MALFORMED_CALL_RETRY), spends a hop
  // and a request, keeps NOTHING of the broken hop in the transcript, and a
  // turn that exhausts it stops with the count on stoppedDetail.
  await (async () => {
    const {
      runTurn: _runTurn,
      LIMITS: _LIMITS,
      MALFORMED_CALL_RETRY: _MCR,
    } = await import('./gemini_agent.js');
    const surface = {
      instructions: '',
      declarations: [],
      workspaceTools: new Set(),
      stateTools: new Set(),
    };
    const usageMeta = { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 0 };
    const MALFORMED_TEXT =
      "Malformed function call: lyric_revise(draft=['we carry the morning to the stone', ...";
    const malformed = () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: { parts: [] },
            finishReason: 'MALFORMED_FUNCTION_CALL',
            finishMessage: MALFORMED_TEXT,
          },
        ],
        usageMetadata: usageMeta,
      }),
    });
    const call = () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ functionCall: { name: 'lyric_types', args: { a: 'x' } } }] } },
        ],
        usageMetadata: usageMeta,
      }),
    });
    const done = () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'done' }] }, finishReason: 'STOP' }],
        usageMetadata: usageMeta,
      }),
    });
    const realFetch = globalThis.fetch;
    const drive = async (script) => {
      let hop = 0;
      globalThis.fetch = async () => script[Math.min(hop++, script.length - 1)]();
      try {
        return await _runTurn({
          apiKey: 'k',
          surface,
          callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
          userText: 'hi',
          limits: { ..._LIMITS, maxTurnUsd: 0 },
          retries: 0,
        });
      } finally {
        globalThis.fetch = realFetch;
      }
    };
    check('MALFORMED_CALL_RETRY is two re-asks, stated once', () => {
      assert.equal(_MCR.retries, 2);
    });
    const recovered = await drive([malformed, call, done]);
    check(
      'a malformed hop is re-asked in the same turn: the call lands, the turn ends on STOP, and the broken hop left nothing in the transcript',
      () => {
        assert.equal(recovered.stopped, null, 'the turn did not stop on the malformed hop');
        assert.equal(recovered.calls.length, 1, 'the re-asked hop produced the call');
        assert.equal(recovered.usage.malformedRetries, 1);
        assert.equal(recovered.usage.requests, 3, 'three requests: malformed, call, done');
        // history: user, model(call), user(functionResponse), model(done) — no
        // model turn for the malformed hop.
        const modelTurns = recovered.history.filter((c) => c.role === 'model');
        assert.equal(modelTurns.length, 2, 'the malformed hop appended no model turn');
        assert.ok(
          modelTurns.every((c) => c.parts.length > 0),
          'no empty model turn survives'
        );
      }
    );
    // M-221: the re-ask keeps nothing of the broken hop in the TRANSCRIPT and
    // keeps its text in the RECORD — round 11 banked nine malformed turns and
    // could quote none of them.
    check(
      "the malformed hop's finishMessage is recorded even when the re-ask then lands the call (M-221)",
      () => {
        assert.equal(recovered.malformed.length, 1);
        assert.deepEqual(
          {
            hop: recovered.malformed[0].hop,
            attempt: recovered.malformed[0].attempt,
            reasked: recovered.malformed[0].reasked,
          },
          { hop: 1, attempt: 1, reasked: true }
        );
        assert.equal(recovered.malformed[0].finishMessage, MALFORMED_TEXT);
      }
    );
    const exhausted = await drive([malformed, malformed, malformed]);
    check(
      'three malformed hops in a row exhaust the two re-asks: the turn stops as MALFORMED_FUNCTION_CALL with the count on stoppedDetail',
      () => {
        assert.equal(exhausted.stopped, 'MALFORMED_FUNCTION_CALL');
        assert.equal(exhausted.usage.malformedRetries, 2);
        assert.equal(exhausted.stoppedDetail.malformedRetries, 2);
        assert.equal(exhausted.stoppedDetail.retriesAllowed, 2);
        assert.equal(exhausted.stoppedDetail.hops, 3);
        assert.equal(exhausted.calls.length, 0);
      }
    );
    check(
      'an exhausted turn records all three malformed hops and puts the last text on stoppedDetail (M-221)',
      () => {
        assert.equal(
          exhausted.malformed.length,
          3,
          'two re-asked hops and the one that stopped the turn'
        );
        assert.deepEqual(
          exhausted.malformed.map((m) => m.reasked),
          [true, true, false]
        );
        assert.deepEqual(
          exhausted.malformed.map((m) => m.hop),
          [1, 2, 3]
        );
        assert.equal(exhausted.stoppedDetail.finishMessage, MALFORMED_TEXT);
      }
    );
    check(
      'a malformed hop with no finishMessage records null, not a fabricated text (M-221)',
      async () => {
        const { malformedText: mt, MALFORMED_TEXT_HEAD } = await import('./gemini_agent.js');
        assert.equal(mt({ finishReason: 'MALFORMED_FUNCTION_CALL' }), null);
        assert.equal(mt({ finishMessage: '' }), null);
        const long = 'x'.repeat(MALFORMED_TEXT_HEAD + 50);
        const head = mt({ finishMessage: long });
        assert.equal(head.length, MALFORMED_TEXT_HEAD + 1, 'head-truncated with one ellipsis');
        assert.ok(head.endsWith('…'));
      }
    );

    // ── M-221: THE DRAFT IS CARRIED BESIDE THE STATE ──────────────────────
    // The model re-emitted every quoted line of the draft on every fold. After
    // a suspended call the connector carries the draft with the record, an
    // OMITTED draft on the continuing call is filled from it, a SENT draft
    // stands, and a different seed carries nothing.
    const stateSurface = {
      instructions: '',
      declarations: [
        {
          name: 'lyric_revise',
          description: 'revise',
          parameters: {
            type: 'object',
            properties: {
              seed: { type: 'integer' },
              draft: { type: 'array', items: { type: 'string' } },
              answer: { type: 'string' },
            },
            required: ['seed', 'draft'],
          },
        },
        {
          name: 'lyric_plan',
          description: 'plan',
          parameters: { type: 'object', properties: { seed: { type: 'integer' } } },
        },
      ],
      workspaceTools: new Set(),
      stateTools: new Set(['lyric_revise']),
    };
    const callWith = (args) => () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ functionCall: { name: 'lyric_revise', args } }] } }],
        usageMetadata: usageMeta,
      }),
    });
    const suspended = (n) => ({
      content: [
        {
          type: 'text',
          text: `[AWAITING PROPOSAL — seed 5 — ${n} answer(s) on record — NO SONG YET]`,
        },
        {
          type: 'text',
          text: JSON.stringify({
            exit_code: 4,
            status: 'awaiting_proposal',
            answers_on_record: n,
            state: `{"pending":{"kind":"propose"},"n":${n}}`,
          }),
        },
      ],
    });
    const seen = [];
    const requests = []; // M-226: every request body the mocked model saw
    const driveState = async (script, lyric = null) => {
      let hop = 0;
      globalThis.fetch = async (_url, init) => {
        try {
          requests.push(JSON.parse(init?.body ?? '{}'));
        } catch {
          requests.push(null);
        }
        return script[Math.min(hop++, script.length - 1)]();
      };
      try {
        return await _runTurn({
          apiKey: 'k',
          surface: stateSurface,
          lyric,
          callTool: async (name, args) => {
            seen.push({ name, args: { ...args } });
            return suspended(seen.length - 1);
          },
          userText: 'hi',
          limits: { ..._LIMITS, maxTurnUsd: 0 },
          retries: 0,
        });
      } finally {
        globalThis.fetch = realFetch;
      }
    };
    const DRAFT = ['we carry the morning to the stone', 'the lantern turned and found the road'];
    const carried = await driveState([
      callWith({ seed: 5, draft: DRAFT }),
      callWith({ seed: 5, answer: 'a new line' }),
      callWith({ seed: 5, answer: 'another line', draft: ['a draft the model sent itself'] }),
      callWith({ seed: 6, answer: 'wrong seed' }),
      done,
    ]);
    check(
      'an omitted draft on a continuing call is filled from the carried record, a sent draft stands, a different seed gets nothing (M-221)',
      () => {
        // M-229: the fourth call named a different seed while this run was
        // suspended, so the connector refused it and the harness never saw it.
        assert.equal(seen.length, 3);
        assert.deepEqual(seen[0].args.draft, DRAFT, 'the first call sends its own draft');
        assert.equal(seen[0].args.state, undefined, 'and carries no state yet');
        assert.deepEqual(
          seen[1].args.draft,
          DRAFT,
          'the second call omitted draft and got the carried one'
        );
        assert.equal(
          seen[1].args.state,
          '{"pending":{"kind":"propose"},"n":0}',
          'beside the carried state'
        );
        assert.deepEqual(
          seen[2].args.draft,
          ['a draft the model sent itself'],
          'a draft the model sent is not overwritten'
        );
        assert.equal(
          carried.calls[3].refused_by_connector,
          true,
          'a different seed is refused while this run is suspended (M-229)'
        );
        assert.ok(/names a different run \(seed:6\)/.test(carried.calls[3].error));
        assert.deepEqual(
          carried.calls.map((c) => c.draft_carried),
          [false, true, false, false],
          'the row says which call the connector filled'
        );
        assert.equal(
          carried.calls[1].args.draft,
          '<carried>',
          'the logged args name the fill rather than repeat the lines'
        );
        // The record carries the draft the LAST suspended call ran on: the
        // third call sent its own, so that is the draft its state was produced
        // against and the one the next fold must replay onto.
        assert.deepEqual(
          carried.lyric.draft,
          ['a draft the model sent itself'],
          'the envelope hands the next turn the draft the last suspended call ran on'
        );
      }
    );
    // M-226: the declaration the model saw on the hop AFTER the first
    // suspended result has no `draft`; the first hop's did. Round 14's turn 7
    // recorded the first malformed call ever captured, and it broke inside
    // the draft array the model re-sent against a declaration that offered it.
    check(
      "while a run is suspended the lyric_revise declaration has no draft to re-emit; the first call's did (M-226)",
      async () => {
        const decl = (req) =>
          req.tools[0].functionDeclarations.find((d) => d.name === 'lyric_revise');
        assert.ok(requests.length >= 2);
        assert.ok(
          'draft' in decl(requests[0]).parameters.properties,
          'first hop: no record yet, draft offered'
        );
        assert.deepEqual(decl(requests[0]).parameters.required, ['seed', 'draft']);
        assert.ok(
          !('draft' in decl(requests[1]).parameters.properties),
          'second hop: record carried, draft gone'
        );
        assert.deepEqual(decl(requests[1]).parameters.required, ['seed'], 'and not required');
        assert.ok('answer' in decl(requests[1]).parameters.properties, 'answer stays');
        const plan = requests[1].tools[0].functionDeclarations.find((d) => d.name === 'lyric_plan');
        assert.deepEqual(
          plan,
          stateSurface.declarations[1],
          'a tool that carries no state is untouched'
        );
        assert.ok(
          /Do NOT send `draft`/.test(requests[1].systemInstruction.parts[0].text),
          'the suspended-run reminder says not to send it'
        );
        assert.ok(
          !/same arguments/.test(requests[1].systemInstruction.parts[0].text),
          'and no longer says "the same arguments"'
        );
        const { declarationsFor } = await import('./gemini_agent.js');
        assert.equal(
          declarationsFor(stateSurface, null),
          stateSurface.declarations,
          'no record: the declarations themselves'
        );
        assert.equal(
          declarationsFor(stateSurface, { key: 'seed:5', seed: 5, state: '{}' }),
          stateSurface.declarations,
          'a pre-M-221 record with no draft: nothing to fill from, so the full schema stays'
        );
      }
    );
    seen.length = 0;
    requests.length = 0;
    const nextTurn = await driveState(
      [callWith({ seed: 5, answer: 'a line on the next turn' }), done],
      { key: 'seed:5', seed: 5, state: '{"n":2}', draft: DRAFT }
    );
    check('the carried draft survives the turn boundary through the envelope (M-221)', () => {
      assert.deepEqual(seen[0].args.draft, DRAFT);
      assert.equal(seen[0].args.state, '{"n":2}');
      assert.equal(nextTurn.calls[0].draft_carried, true);
    });
    seen.length = 0;
    await driveState([callWith({ seed: 5, answer: 'a line' }), done], {
      key: 'seed:5',
      seed: 5,
      state: '{"n":1}',
    });
    check(
      'an envelope written before M-221 carries a state and no draft: nothing is invented, the tool refuses in its own words (M-221)',
      () => {
        assert.equal(seen[0].args.draft, undefined);
        assert.equal(seen[0].args.state, '{"n":1}');
      }
    );
  })();
  check('chat.js tools[] carries the seven M-216 fields loopFields stamps (M-219)', () => {
    // Round 11's rows had none of them: loopFields put them on every call and
    // chat.js's hand-spelled row projection never learned them.
    const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
    for (const f of [
      'path',
      'ms',
      'memo_state',
      'memo_hit',
      'memo_asked',
      'stale_answers',
      'plan_lines',
    ]) {
      assert.ok(
        new RegExp(`^\\s+${f}: c\\.${f} \\?\\? null,`, 'm').test(chat),
        `tools[] carries ${f}`
      );
    }
  });
  // ── M-228: THE IN-TURN STUB ─────────────────────────────────────────────
  // Inside one turn every fold's brief rode every later hop (round 12: 328 KB
  // after one turn). Once a later result of the same lyric tool exists, the
  // earlier result's body is stubbed between hops; the newest stays whole.
  await (async () => {
    const { runTurn: _rt, LIMITS: _L, _agentInternals: AI } = await import('./gemini_agent.js');
    const surface = {
      instructions: '',
      declarations: [
        {
          name: 'lyric_revise',
          parameters: {
            type: 'object',
            properties: {
              seed: { type: 'integer' },
              draft: { type: 'array' },
              answer: { type: 'string' },
            },
            required: ['seed', 'draft'],
          },
        },
      ],
      workspaceTools: new Set(),
      stateTools: new Set(['lyric_revise']),
    };
    const usageMeta = { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 0 };
    const BRIEF = 'B'.repeat(2000);
    const requests = [];
    const realFetch = globalThis.fetch;
    const script = [
      { functionCall: { name: 'lyric_revise', args: { seed: 9, draft: ['a', 'b'] } } },
      { functionCall: { name: 'lyric_revise', args: { seed: 9, answer: 'one' } } },
      { functionCall: { name: 'lyric_revise', args: { seed: 9, answer: 'two' } } },
      { text: 'done' },
    ];
    let hop = 0;
    globalThis.fetch = async (_url, init) => {
      requests.push(JSON.parse(init.body));
      const part = script[Math.min(hop++, script.length - 1)];
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            { content: { parts: [part] }, finishReason: part.text ? 'STOP' : undefined },
          ],
          usageMetadata: usageMeta,
        }),
      };
    };
    let n = 0;
    let run;
    try {
      run = await _rt({
        apiKey: 'k',
        surface,
        callTool: async () => {
          n += 1;
          return {
            content: [
              {
                type: 'text',
                text: `[AWAITING PROPOSAL — seed 9 — ${n} answer(s) on record — NO SONG YET]\n${BRIEF}`,
              },
              {
                type: 'text',
                text: JSON.stringify({
                  exit_code: 4,
                  status: 'awaiting_proposal',
                  answers_on_record: n,
                  state: `{"pending":{"kind":"propose"},"n":${n}}`,
                }),
              },
            ],
          };
        },
        userText: 'go',
        limits: { ..._L, maxTurnUsd: 0 },
        retries: 0,
      });
    } finally {
      globalThis.fetch = realFetch;
    }
    const responsesIn = (req) =>
      req.contents.flatMap((c) => (c.parts || []).map((p) => p.functionResponse).filter(Boolean));
    check(
      'between hops, a lyric result a later result of the same tool superseded is stubbed and the newest stays whole (M-228)',
      () => {
        assert.equal(requests.length, 4, 'four requests: three calls, then the reply');
        const r3 = responsesIn(requests[2]);
        assert.equal(r3.length, 2, 'request 3 carries two revise results');
        assert.ok(
          typeof r3[0].response.pruned === 'string' && /pruned/.test(r3[0].response.pruned),
          'the first carries the pruned note'
        );
        assert.equal(r3[0].response.answers_on_record, 1, 'and keeps its verdict fields');
        assert.ok(!('presentation' in r3[0].response), 'its brief is gone');
        assert.ok(r3[1].response.presentation.includes(BRIEF), 'the newest result keeps its brief');
        const r4 = responsesIn(requests[3]);
        assert.deepEqual(
          r4.map((fr) => 'presentation' in fr.response),
          [false, false, true],
          'on the next hop the second is stubbed too and the third stays whole'
        );
        const bytes2 = JSON.stringify(requests[1].contents).length;
        const bytes4 = JSON.stringify(requests[3].contents).length;
        assert.ok(
          bytes4 < bytes2 + 2 * BRIEF.length,
          `the transcript does not grow by a brief per hop (${bytes2} -> ${bytes4})`
        );
      }
    );
    check(
      'the handed-back history is the stubbed one, and stubbing it again changes nothing (M-228)',
      () => {
        const hist = run.history;
        const frs = hist.flatMap((c) =>
          (c.parts || []).map((p) => p.functionResponse).filter(Boolean)
        );
        assert.deepEqual(
          frs.map((fr) => 'presentation' in fr.response),
          [false, false, true]
        );
        const copy = JSON.parse(JSON.stringify(hist));
        assert.equal(AI.stubSupersededInPlace(copy), 0, 'idempotent');
        assert.deepEqual(copy, hist);
        assert.equal(hist.filter((c) => c.role === 'model').length, 4, 'model parts untouched');
      }
    );
    check(
      'stubSupersededInPlace leaves a recipe result and a lone lyric result alone (M-228)',
      () => {
        const c = [
          { role: 'user', parts: [{ text: 'hi' }] },
          { role: 'model', parts: [{ functionCall: { name: 'start_recipe', args: {} } }] },
          {
            role: 'user',
            parts: [{ functionResponse: { name: 'start_recipe', response: { cards: 3 } } }],
          },
          { role: 'model', parts: [{ functionCall: { name: 'lyric_plan', args: {} } }] },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: 'lyric_plan',
                  response: { presentation: 'P', verdict: { exit_code: 0 } },
                },
              },
            ],
          },
        ];
        const before = JSON.stringify(c);
        assert.equal(AI.stubSupersededInPlace(c), 0);
        assert.equal(JSON.stringify(c), before);
      }
    );
  })();
  // ── M-229: THE RUN'S DECLARATIONS ARE CARRIED, THE CALL IS ANSWER+KEY, AND
  // A CALL THAT WANDERS OFF A SUSPENDED RUN IS REFUSED ─────────────────────
  await (async () => {
    const {
      runTurn: _rt,
      LIMITS: _L,
      declarationsFor: _df,
      declarationArgs: _da,
      wanderRefusal: _wr,
    } = await import('./gemini_agent.js');
    const reviseDecl = {
      name: 'lyric_revise',
      parameters: {
        type: 'object',
        properties: {
          seed: { type: 'integer' },
          draft: { type: 'array' },
          answer: { type: 'string' },
          lines: { type: 'integer' },
          form: { type: 'string' },
          max_rounds: { type: 'integer' },
        },
        required: ['seed', 'draft'],
      },
    };
    const planDecl = {
      name: 'lyric_plan',
      parameters: { type: 'object', properties: { seed: { type: 'integer' } } },
    };
    const surface = {
      instructions: '',
      declarations: [
        reviseDecl,
        planDecl,
        { name: 'lyric_screen' },
        {
          name: 'lyric_grade',
          parameters: { type: 'object', properties: { seed: { type: 'integer' } } },
        },
      ],
      workspaceTools: new Set(),
      stateTools: new Set(['lyric_revise']),
    };
    const usageMeta = { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 0 };
    const suspended = (n) => ({
      content: [
        {
          type: 'text',
          text: `[AWAITING PROPOSAL — seed 5 — ${n} answer(s) on record — NO SONG YET]`,
        },
        {
          type: 'text',
          text: JSON.stringify({
            exit_code: 4,
            status: 'awaiting_proposal',
            answers_on_record: n,
            state: `{"pending":{"kind":"propose"},"answered":{"propose":${JSON.stringify(Array(n).fill('x'))},"propose_group":[]}}`,
          }),
        },
      ],
    });
    const script = [
      {
        functionCall: {
          name: 'lyric_revise',
          args: { seed: 5, draft: ['a', 'b'], lines: 20, form: 'verse-chorus', max_rounds: 4 },
        },
      },
      { functionCall: { name: 'lyric_revise', args: { seed: 5, answer: 'one', lines: 39 } } },
      { functionCall: { name: 'lyric_plan', args: { seed: 6 } } },
      { functionCall: { name: 'lyric_grade', args: { seed: 6 } } },
      { functionCall: { name: 'lyric_screen', args: { pairs: 'a--b' } } },
      { functionCall: { name: 'lyric_grade', args: { seed: 5 } } },
      { text: 'done' },
    ];
    const requests = [];
    const seen = [];
    let hop = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      requests.push(JSON.parse(init.body));
      const part = script[Math.min(hop++, script.length - 1)];
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            { content: { parts: [part] }, finishReason: part.text ? 'STOP' : undefined },
          ],
          usageMetadata: usageMeta,
        }),
      };
    };
    let n = 0;
    let run;
    try {
      run = await _rt({
        apiKey: 'k',
        surface,
        callTool: async (name, args) => {
          seen.push({ name, args: { ...args } });
          if (name === 'lyric_revise') return suspended(++n);
          return { content: [{ type: 'text', text: JSON.stringify({ exit_code: 0 }) }] };
        },
        userText: 'go',
        limits: { ..._L, maxTurnUsd: 0 },
        retries: 0,
      });
    } finally {
      globalThis.fetch = realFetch;
    }
    check(
      "the run's declarations are carried and re-applied over a continuing call that moved one (M-229)",
      () => {
        assert.deepEqual(_da({ seed: 5, draft: ['a'], answer: 'x', state: 's', lines: 20 }), {
          seed: 5,
          lines: 20,
        });
        assert.deepEqual(run.lyric.decl, {
          seed: 5,
          lines: 20,
          form: 'verse-chorus',
          max_rounds: 4,
        });
        const second = seen[1];
        assert.equal(second.name, 'lyric_revise');
        assert.equal(second.args.lines, 20, 'the moved declaration is put back');
        assert.equal(second.args.form, 'verse-chorus');
        assert.equal(second.args.max_rounds, 4);
        assert.equal(second.args.answer, 'one', "the answer is the model's");
        assert.deepEqual(second.args.draft, ['a', 'b'], 'the draft is carried');
        assert.equal(run.calls[1].declarations_carried, true);
        assert.equal(run.calls[0].declarations_carried, false);
      }
    );
    check(
      'while a run is suspended the lyric_revise declaration is answer plus the run key, nothing else (M-229)',
      () => {
        const d = (req) => req.tools[0].functionDeclarations.find((x) => x.name === 'lyric_revise');
        assert.deepEqual(Object.keys(d(requests[0]).parameters.properties).sort(), [
          'answer',
          'draft',
          'form',
          'lines',
          'max_rounds',
          'seed',
        ]);
        assert.deepEqual(Object.keys(d(requests[1]).parameters.properties).sort(), [
          'answer',
          'seed',
        ]);
        assert.deepEqual(d(requests[1]).parameters.required, ['seed']);
        assert.deepEqual(_df(surface, null), surface.declarations);
      }
    );
    check(
      'a call that wanders off a suspended run is refused by the connector and never reaches the harness (M-229)',
      () => {
        const names = seen.map((c) => c.name);
        assert.deepEqual(
          names,
          ['lyric_revise', 'lyric_revise', 'lyric_screen', 'lyric_grade'],
          "plan and the other seed's grade never ran"
        );
        const refused = run.calls.filter((c) => c.refused_by_connector);
        assert.deepEqual(
          refused.map((c) => c.name),
          ['lyric_plan', 'lyric_grade']
        );
        assert.ok(
          /SUSPENDED with 2 answer\(s\) on record/.test(refused[0].error),
          refused[0].error
        );
        assert.ok(/lyric_plan starts another song/.test(refused[0].error));
        assert.ok(/lyric_grade names a different run \(seed:6\)/.test(refused[1].error));
        assert.ok(/call lyric_revise with `answer`/.test(refused[0].error));
        assert.equal(seen[3].args.seed, 5, "the same run's grade went through");
        // The refusal is a functionResponse the model can read.
        const frs = run.history.flatMap((c) =>
          (c.parts || []).map((p) => p.functionResponse).filter(Boolean)
        );
        assert.ok(
          frs.some(
            (fr) => fr.name === 'lyric_plan' && /REFUSED by the connector/.test(fr.response.error)
          )
        );
        assert.equal(_wr(null, 'lyric_plan', {}), null, 'no suspended run, nothing refused');
        assert.equal(
          _wr(run.lyric, 'lyric_types', {}),
          null,
          'asking about rhyme types is not wandering'
        );
      }
    );
  })();

  // ── M-232: A PARKED RUN IS CARRIED, ITS CONTINUING CALL IS THE REWRITTEN
  // DRAFT PLUS THE KEY, AND A TURN THE ENGINE KILLS MID-WAY KEEPS ITS CALLS ──
  await (async () => {
    const {
      runTurn: _rt,
      LIMITS: _L,
      declarationsFor: _df,
      wanderRefusal: _wr,
      isParked: _ip,
      _agentInternals: _AI,
    } = await import('./gemini_agent.js');
    const reviseDecl = {
      name: 'lyric_revise',
      parameters: {
        type: 'object',
        properties: {
          seed: { type: 'integer' },
          draft: { type: 'array' },
          answer: { type: 'string' },
          lines: { type: 'integer' },
        },
        required: ['seed', 'draft'],
      },
    };
    const surface = {
      instructions: 'BASE',
      declarations: [
        reviseDecl,
        {
          name: 'lyric_plan',
          parameters: { type: 'object', properties: { seed: { type: 'integer' } } },
        },
        { name: 'lyric_screen' },
      ],
      workspaceTools: new Set(),
      stateTools: new Set(['lyric_revise']),
    };
    const usageMeta = { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 0 };
    const parkedResult = {
      content: [
        {
          type: 'text',
          text: 'a\nb\n\n[FINISHED — seed 5 — exit 3 — NO_PROGRESS after 2 round(s) — UNRESOLVED: L1 — WHOLE-DRAFT FLAG: TITLE_NOT_IN_HOOK]',
        },
        {
          type: 'text',
          text: JSON.stringify({
            exit_code: 3,
            status: 'stopped_with_open_lines',
            loop_stop_reason: 'NO_PROGRESS',
            loop_rounds: 2,
            loop_unresolved: 1,
            loop_unresolved_lines: ['L1'],
            loop_whole_flag_codes: ['TITLE_NOT_IN_HOOK'],
            standing: [
              'L1: FINDING [FLAG] METER: L1 wants six beats',
              'WHOLE-DRAFT: FINDING [FLAG] TITLE_NOT_IN_HOOK: no title in the hook',
            ],
            answers_on_record: 1,
          }),
        },
      ],
    };
    const cleanResult = {
      content: [
        {
          type: 'text',
          text: 'c\nb\n\n[FINISHED — seed 5 — exit 0 — SUCCESS after 1 round(s) — no flag stands]',
        },
        {
          type: 'text',
          text: JSON.stringify({
            exit_code: 0,
            status: 'finished_clean',
            loop_stop_reason: 'SUCCESS',
            loop_rounds: 1,
            loop_unresolved: 0,
            loop_unresolved_lines: [],
            loop_whole_flag_codes: [],
          }),
        },
      ],
    };
    const script = [
      { functionCall: { name: 'lyric_revise', args: { seed: 5, draft: ['a', 'b'], lines: 20 } } },
      { functionCall: { name: 'lyric_revise', args: { seed: 5, answer: 'L1: something' } } },
      { functionCall: { name: 'lyric_revise', args: { seed: 5, draft: ['a', 'b'] } } },
      { functionCall: { name: 'lyric_plan', args: { seed: 6 } } },
      { functionCall: { name: 'lyric_revise', args: { seed: 5, draft: ['c', 'b'], lines: 39 } } },
      { text: 'done' },
    ];
    const requests = [];
    const seen = [];
    let hop = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      requests.push(JSON.parse(init.body));
      const part = script[Math.min(hop++, script.length - 1)];
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            { content: { parts: [part] }, finishReason: part.text ? 'STOP' : undefined },
          ],
          usageMetadata: usageMeta,
        }),
      };
    };
    let run;
    try {
      run = await _rt({
        apiKey: 'k',
        surface,
        callTool: async (name, args) => {
          seen.push({ name, args: { ...args } });
          if (name === 'lyric_revise') return seen.length === 1 ? parkedResult : cleanResult;
          return { content: [{ type: 'text', text: JSON.stringify({ exit_code: 0 }) }] };
        },
        userText: 'go',
        limits: { ..._L, maxTurnUsd: 0 },
        retries: 0,
      });
    } finally {
      globalThis.fetch = realFetch;
    }
    check(
      'a run that parks at exit 3 is carried as PARKED, and its continuing call is the rewritten draft plus the key (M-232)',
      () => {
        assert.deepEqual(
          seen.map((c) => c.name),
          ['lyric_revise', 'lyric_revise'],
          'the answer, the same draft and the plan never reached the harness'
        );
        const refused = run.calls.filter((c) => c.refused_by_connector).map((c) => c.error);
        assert.equal(refused.length, 3);
        assert.ok(
          /PARKED at exit 3/.test(refused[0]) && /sends `answer`/.test(refused[0]),
          refused[0]
        );
        assert.ok(/re-sends the SAME draft/.test(refused[1]), refused[1]);
        assert.ok(/lyric_plan starts another song/.test(refused[2]), refused[2]);
        assert.ok(
          /rewrite the open line\(s\) \(L1\)/.test(refused[0]),
          'the refusal names the open line'
        );
        const cont = seen[1];
        assert.deepEqual(cont.args.draft, ['c', 'b'], "the rewritten draft is the model's");
        assert.equal(cont.args.lines, 20, "the run's declarations are put back (39 was moved)");
        assert.equal('answer' in cont.args, false);
        assert.equal('state' in cont.args, false);
        assert.equal(run.calls[4].declarations_carried, true);
        assert.equal(run.calls[4].draft_carried, false, 'a parked run never injects the draft');
        assert.equal(run.lyric, null, 'exit 0 clears the record');
        // The declaration the model saw while parked: draft plus the key.
        const d = (req) => req.tools[0].functionDeclarations.find((x) => x.name === 'lyric_revise');
        assert.deepEqual(Object.keys(d(requests[1]).parameters.properties).sort(), [
          'draft',
          'seed',
        ]);
        assert.deepEqual(d(requests[1]).parameters.required, ['seed', 'draft']);
        assert.deepEqual(Object.keys(d(requests[0]).parameters.properties).sort(), [
          'answer',
          'draft',
          'lines',
          'seed',
        ]);
        // The reminder rode the parked hops and names the lines, the flag and the findings.
        const si = requests[1].systemInstruction.parts[0].text;
        assert.ok(/PARKED at exit 3 \(NO_PROGRESS\)/.test(si), si);
        assert.ok(/line\(s\) L1 are still flagged/.test(si));
        assert.ok(/TITLE_NOT_IN_HOOK/.test(si));
        assert.ok(/METER: L1 wants six beats/.test(si), 'the standing findings ride the reminder');
        assert.ok(/all 2 lines, in order/.test(si));
        assert.ok(/Do NOT send `answer`/.test(si));
        assert.ok(!/SUSPENDED/.test(si), 'a parked run is not a suspended one');
        assert.equal(
          requests[5].systemInstruction.parts[0].text,
          'BASE',
          'exit 0: no reminder on the last hop, the base instructions alone'
        );
        // Pure helpers.
        assert.equal(_ip(null), false);
        assert.equal(
          _ip({ parked: true, state: 'x' }),
          false,
          'a record with state is suspended, not parked'
        );
        assert.equal(
          _wr({ parked: true, key: 'seed:5', seed: 5, draft: ['a'] }, 'lyric_screen', {}),
          null
        );
        assert.equal(
          _wr({ parked: true, key: 'seed:5', seed: 5, draft: ['a'] }, 'lyric_revise', {
            seed: 5,
          }) != null,
          true,
          'a call with no draft is refused'
        );
        assert.deepEqual(
          _df(surface, { parked: true, key: 'seed:5', seed: 5 }).find(
            (x) => x.name === 'lyric_plan'
          ),
          surface.declarations[1],
          'a tool without state is untouched'
        );
        assert.ok(typeof _AI.PARKED_RUN_NOTE({ seed: 5, open: [], whole: [] }) === 'string');
      }
    );
    // THE PARTIAL TURN: the engine dies on hop 2 after hop 1 made a call.
    const script2 = [{ functionCall: { name: 'lyric_plan', args: { seed: 5 } } }];
    let hop2 = 0;
    globalThis.fetch = async () => {
      const i = hop2++;
      if (i === 0)
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [script2[0]] } }],
            usageMetadata: usageMeta,
          }),
        };
      return {
        ok: false,
        status: 503,
        headers: { get: () => null },
        json: async () => ({
          error: { message: 'This model is currently experiencing high demand.' },
        }),
      };
    };
    let partial;
    let hop1Err = null;
    try {
      partial = await _rt({
        apiKey: 'k',
        surface,
        callTool: async () => ({
          content: [{ type: 'text', text: JSON.stringify({ exit_code: 0 }) }],
        }),
        userText: 'go',
        limits: { ..._L, maxTurnUsd: 0 },
        retries: 0,
      });
      hop2 = 1; // every fetch from here is a 503: the FIRST hop dies
      try {
        await _rt({
          apiKey: 'k',
          surface,
          callTool: async () => ({ content: [] }),
          userText: 'go',
          limits: { ..._L, maxTurnUsd: 0 },
          retries: 0,
        });
      } catch (e) {
        hop1Err = e;
      }
    } finally {
      globalThis.fetch = realFetch;
    }
    check(
      'a turn the engine kills after a call is returned with its calls kept, not thrown (M-232)',
      () => {
        assert.equal(partial.stopped, 'UPSTREAM_503');
        assert.equal(partial.stoppedDetail.status, 503);
        assert.equal(partial.stoppedDetail.hops, 2);
        assert.equal(partial.stoppedDetail.calls, 1);
        assert.ok(/high demand/.test(partial.stoppedDetail.detail));
        assert.equal(partial.calls.length, 1);
        assert.equal(partial.calls[0].name, 'lyric_plan');
        const last = partial.history[partial.history.length - 1];
        assert.equal(last.role, 'model', 'the transcript is closed with a model-role note');
        assert.ok(/interrupted here — upstream 503/.test(last.parts[0].text));
        const prev = partial.history[partial.history.length - 2];
        assert.ok(
          prev.parts.some((p) => p.functionResponse),
          'after the kept function response'
        );
        assert.ok(
          hop1Err && hop1Err.status === 503,
          'a first-hop failure still throws, with its status'
        );
      }
    );
  })();
  check(
    'chat.js hands the malformed hops and draft_carried out, and the battery rows bank them (M-221)',
    () => {
      const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
      assert.ok(
        /^\s+malformed: run\.malformed \?\? \[\],/m.test(chat),
        'the response carries malformed[]'
      );
      assert.ok(
        /^\s+draft_carried: c\.draft_carried \?\? false,/m.test(chat),
        'tools[] carries draft_carried'
      );
      const battery = readFileSync(
        new URL('../scripts/flash_battery.mjs', import.meta.url),
        'utf8'
      );
      assert.ok(
        /stopped_detail: p\.stopped_detail \?\? null,/.test(battery),
        'the row banks stopped_detail'
      );
      assert.ok(
        /malformed: Array\.isArray\(p\.malformed\) \? p\.malformed : null,/.test(battery),
        'the row banks the malformed hops'
      );
      assert.ok(/battery malformed hop/.test(battery), 'and prints each as an annotation');
      assert.ok(
        !/after the connector re-asks'/.test(battery),
        'the fail-fast reason no longer asserts a re-ask the deploy may not have'
      );
    }
  );
  // ── M-168's swerve (2026-09-02): an exit 2 carries the harness's own reason ──
  // Round 10's record holds two lyric_sweep calls and one lyric_plan call at
  // exit 2 with `error: null` and nothing else. The extractor reads the
  // harness's own `REFUSED — …` headline, and this pin reads that print
  // statement out of lyric_harness.py rather than trusting a fixture.
  await (async () => {
    let VI = null;
    try {
      ({ _verdictInternals: VI } = await import('./lyric_tools.js'));
    } catch {
      console.log('  --  refusal-headline check skipped (SDK not installed in-container)');
      return;
    }
    const { _agentInternals: AI } = await import('./gemini_agent.js');
    const harness = readFileSync(
      new URL('../lyric-harness/lyric_harness.py', import.meta.url),
      'utf8'
    );
    check("the harness's refusal headline is the shape the connector extracts", () => {
      assert.ok(
        harness.includes('print(f"  REFUSED — {msg}")'),
        '`_refuse` prints `  REFUSED — {msg}` (the extractor is pinned to this line)'
      );
      const sweep =
        '  SWEEP: seeds 0..99 (100), form=song\n' +
        '    swept 100  planned 100  REFUSED by the planner 0  accepted 0 (0.0% of the planned)\n' +
        '  REFUSED — no seed in 0..99 satisfies every declared predicate\n' +
        '    100 seed(s) planned and none was kept, so the declaration is unreachable\n';
      assert.equal(
        VI.extractRefusal(sweep),
        'no seed in 0..99 satisfies every declared predicate',
        'the headline, not the counts line that also says REFUSED'
      );
      assert.equal(VI.extractRefusal('  PLAN: seed 31\n  fine\n'), null, 'a clean report has none');
      const v = VI.verdictOf({ code: 2, stdout: sweep, stderr: '' });
      assert.equal(v.refusal, 'no seed in 0..99 satisfies every declared predicate');
      assert.ok(
        !('refusal' in VI.verdictOf({ code: 0, stdout: sweep, stderr: '' })),
        'only an exit 2 carries one — absent is not zero'
      );
      assert.equal(AI.loopFields(v).refusal, v.refusal, 'and the call record carries it');
      assert.equal(AI.loopFields({ exit_code: 0 }).refusal, null);
    });
  })();
  check('runTurn reaches the model through the one systemInstruction builder', () => {
    // The classic defect is built-but-unreachable: a helper both halves above
    // pass while runTurn keeps a second, reminder-less spelling. Pin the
    // source: exactly one assignment, fed only by buildSystemInstruction.
    const src = readFileSync(new URL('./gemini_agent.js', import.meta.url), 'utf8');
    const assigns = src.match(/body\.systemInstruction\s*=\s*(\w+)/g) || [];
    assert.equal(assigns.length, 1, 'exactly one assignment site');
    assert.ok(
      /const si = buildSystemInstruction\(surface, lyr\)/.test(src),
      'and it is fed by the builder, per hop, from the live carried state'
    );
  });

  // ── M-197's open half: stale-brief pruning ───────────────────────────────
  // Every hop re-sends the transcript, and the transcript is mostly folded
  // lyric results the model already acted on (~20 KB a brief, ~45 KB a
  // grade report on the record; 395 KB by turn 4 of the battery, where the
  // $0.10 cap buys four hops). Pinned BY VALUE on a synthetic history: the
  // newest prior turn intact, an older folded lyric_revise brief stubbed to
  // its verdict fields, the recipe result untouched (the two families do
  // not touch), the newest result per lyric tool kept, every functionCall
  // still paired, bytes under the bound, and the pass idempotent.
  const { pruneHistory } = _agentInternals;
  const fold = (name, id, response) => ({
    role: 'user',
    parts: [{ functionResponse: { name, id, response } }],
  });
  const ask = (name, id) => ({ role: 'model', parts: [{ functionCall: { name, id } }] });
  const brief = (n) => ({
    presentation: `[AWAITING PROPOSAL — seed 16 — ${n} answer(s) on record]\n` + 'B'.repeat(20_000),
    verdict: {
      exit_code: 4,
      status: 'awaiting_proposal',
      kind: 'propose',
      loop_whole_flag_codes: ['TITLE_NOT_IN_HOOK'],
      answers_on_record: n,
    },
  });
  const history = [
    { role: 'user', parts: [{ text: 'a song about the river, seed 16' }] },
    ask('start_recipe', 'c1'),
    fold('start_recipe', 'c1', { recipe: 'W'.repeat(3000), cards: [] }),
    ask('lyric_revise', 'c2'),
    fold('lyric_revise', 'c2', brief(0)),
    { role: 'model', parts: [{ text: 'first draft' }] },
    { role: 'user', parts: [{ text: 'CONTINUE' }] },
    ask('lyric_revise', 'c3'),
    fold('lyric_revise', 'c3', brief(1)),
    { role: 'model', parts: [{ text: 'answered one' }] },
  ];
  check('pruning stubs an older folded brief and touches nothing it must not', () => {
    const before = JSON.stringify(history).length;
    const pruned = pruneHistory(history, { keepTurns: 1, maxBytes: 200_000 });
    assert.equal(pruned.length, history.length, 'no turn dropped under the bound');
    for (let i = 6; i < history.length; i++)
      assert.equal(pruned[i], history[i], `newest prior turn entry ${i} is the same object`);
    assert.equal(pruned[2], history[2], 'the recipe result is untouched');
    assert.equal(pruned[0], history[0], 'user text untouched');
    assert.equal(pruned[3], history[3], 'the functionCall untouched');
    const stub = pruned[4].parts[0].functionResponse;
    assert.equal(stub.name, 'lyric_revise');
    assert.equal(stub.id, 'c2', 'the call/response pairing survives');
    assert.deepEqual(stub.response, {
      pruned: stub.response.pruned,
      exit_code: 4,
      status: 'awaiting_proposal',
      kind: 'propose',
      loop_whole_flag_codes: ['TITLE_NOT_IN_HOOK'],
      answers_on_record: 0,
    });
    assert.ok(!('presentation' in stub.response), 'the answered brief is gone');
    assert.ok(
      pruned[8].parts[0].functionResponse.response.presentation.includes('AWAITING PROPOSAL'),
      'the pending question is verbatim'
    );
    const after = JSON.stringify(pruned).length;
    assert.ok(after < before - 19_000 && after < 200_000, `bytes ${before} -> ${after}`);
    assert.deepEqual(
      pruneHistory(pruned, { keepTurns: 1, maxBytes: 200_000 }),
      pruned,
      'idempotent: a stub stays a stub'
    );
    assert.equal(pruneHistory(history, { keepTurns: 2 }).length, history.length);
    assert.equal(pruneHistory(history, { keepTurns: 2 })[4], history[4], 'keepTurns=2 keeps both');
  });
  check('the byte ceiling drops whole oldest turns, never the newest kept one', () => {
    const tight = pruneHistory(history, { keepTurns: 1, maxBytes: 1000 });
    assert.equal(tight[0].parts[0].text, 'CONTINUE', 'the oldest turn went first');
    assert.equal(tight.length, 4, 'the newest turn survives whole even over the bound');
    const src = readFileSync(new URL('./gemini_agent.js', import.meta.url), 'utf8');
    assert.ok(
      /const prior = limits\.pruneFolded\s*\?\s*pruneHistory\(history/.test(src),
      'wired at the one assembly site, behind the CHAT_PRUNE_FOLDED switch'
    );
    assert.ok(/CHAT_PRUNE_FOLDED'?\)? !== '0'/.test(src) || /CHAT_PRUNE_FOLDED !== '0'/.test(src));
  });
}

{
  // ── C11: which of the two turn ceilings actually binds ───────────────────
  // `maxSteps` and `maxTurnUsd` are two answers to ONE question — how many
  // hops may a turn take — and the smaller one wins in silence. `turnBudget`
  // derives the answer from the declared coordinates (LIMITS + PRICING, no
  // literal of its own) and the stop carries its numbers, so a reader of a
  // transcript can tell a turn that ran out of HOPS from one that ran out of
  // MONEY. Pinned as a RELATION, not as a dollar figure: the cap is the
  // owner's to set, and this must keep holding when they set it.
  const {
    turnBudget,
    LIMITS: _L,
    PRICING,
    DEFAULT_MODEL,
    BYTES_PER_TOKEN,
    runTurn: _rt,
  } = await import('./gemini_agent.js');
  check('turnBudget derives the per-hop cost from the declared coordinates alone', () => {
    const b = turnBudget();
    const price = PRICING[DEFAULT_MODEL];
    const expected =
      ((_L.pruneMaxBytes / BYTES_PER_TOKEN) * price.input + _L.maxOutputTokens * price.output) /
      1e6;
    assert.ok(Math.abs(b.perHopUsd - expected) < 1e-12, `${b.perHopUsd} vs ${expected}`);
    assert.ok(
      Math.abs(b.worstLegalTurnUsd - expected * _L.maxSteps) < 1e-12,
      'the worst legal turn is every declared hop at the ceiling'
    );
    assert.equal(b.hopsAffordable, Math.floor(_L.maxTurnUsd / b.perHopUsd));
    assert.equal(b.capBinds, b.hopsAffordable < _L.maxSteps);
  });
  check('an unpriced model refuses the arithmetic rather than returning a number', () => {
    assert.equal(turnBudget(_L, 'no-such-model'), null);
  });
  check('the code says WHICH of the two ceilings wins, and agrees with itself', async () => {
    // ~~The measured state on 2026-09-02: $0.10 buys 6 hops of a legal 14, so
    // the DOLLAR cap is the operative step limit.~~ The owner raised the cap
    // to $2.50 the same day and the answer flipped to `maxSteps`, which is
    // the pin doing its job — so what is pinned is the AGREEMENT between the
    // derivation and the reported answer, never the answer itself.
    const b = turnBudget();
    const { chatCeilings } = await import('./chat.js');
    assert.equal(b.capBinds, b.hopsAffordable < _L.maxSteps, 'capBinds IS that comparison');
    assert.equal(
      b.capBinds,
      _L.maxTurnUsd < b.worstLegalTurnUsd,
      'and a cap below the worst LEGAL turn is exactly what makes it bind'
    );
    assert.equal(
      chatCeilings().perTurn,
      b.capBinds ? 'maxTurnUsd' : 'maxSteps',
      'the reported per-turn ceiling is the derivation, not a second opinion'
    );
  });
  await (async () => {
    // Drive a real turn into the cap in ONE hop. The prompt size is DERIVED
    // from the cap and the model's own input price, never typed: a literal
    // here is a fixture that depends on a number the owner sets, and this
    // check went red the moment they set it (`hops` came back 3 against a
    // typed 1 when the cap went $0.10 -> $2.50). Twice the cap's worth of
    // prompt trips it on the first hop whatever the cap is, so the check
    // keeps asking its own question — what the STOP carries — instead of
    // re-deriving the cap's arithmetic, which the checks above already pin.
    const _oneHopTokens = Math.ceil((2 * _L.maxTurnUsd * 1e6) / PRICING[DEFAULT_MODEL].input);
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ functionCall: { name: 'lyric_types', args: { a: 'x' } } }] } },
        ],
        usageMetadata: {
          promptTokenCount: _oneHopTokens,
          candidatesTokenCount: 1,
          thoughtsTokenCount: 0,
        },
      }),
    });
    let run = null;
    try {
      run = await _rt({
        apiKey: 'k',
        surface: {
          instructions: '',
          declarations: [],
          workspaceTools: new Set(),
          stateTools: new Set(),
        },
        callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
        userText: 'hi',
      });
    } finally {
      globalThis.fetch = realFetch;
    }
    check('a turn stopped by the cap carries what it spent, the cap and both hop counts', () => {
      assert.equal(run.stopped, 'MAX_TURN_COST');
      const d = run.stoppedDetail;
      assert.ok(d, 'the stop is not a bare label');
      assert.ok(d.usd >= d.cap, `spent ${d.usd} against cap ${d.cap}`);
      assert.equal(d.cap, _L.maxTurnUsd);
      assert.equal(d.hops, 1, 'it bought one hop, the prompt being twice the cap');
      assert.equal(d.maxSteps, _L.maxSteps, 'and names the hop budget it did NOT reach');
      assert.ok(d.hops < d.maxSteps, 'so MAX_TURN_COST cannot be read as MAX_STEPS');
      // ~~`capBinds === true`~~ — another literal that was a function of the
      // cap, and it went false when the owner raised it. What the stop owes
      // is the DERIVATION, and that it is the same one `turnBudget` reports.
      assert.deepEqual(d.budget, turnBudget(), 'and carries the derivation itself');
    });
  })();
  check('chat.js publishes the stop detail beside the stop reason', () => {
    const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
    assert.ok(
      /stopped_detail: run\.stoppedDetail \?\? null,/.test(chat),
      'the reply carries stopped_detail'
    );
  });
}

{
  // M-159: battery round 4 died in ITS OWN CLIENT. Node's fetch() carries
  // undici's default 300s headers timeout, which nothing declared; a
  // legitimate /chat turn (grade ~90s + revise ~80-205s in one response)
  // outlived it, and the unhandled rejection crashed the run with zero rows
  // recorded. Two properties pinned: the driver's patience DERIVES from the
  // server's own declared budget, and a transport failure is a RECORDED
  // outcome, never a crash.
  const bat = readFileSync(new URL('../scripts/flash_battery.mjs', import.meta.url), 'utf8');
  check('the battery client derives its deadline instead of inheriting a fetch default', () => {
    // Comments are stripped first: the file's own account of the defect says
    // "fetch()", and a pin defeated by its documentation is the
    // test_declared_inputs lesson repeated.
    const code = bat.replace(/^\s*\/\/.*$/gm, '');
    assert.ok(
      !/\bfetch\s*\(/.test(code),
      'no call to global fetch — its undeclared 300s headers default is the defect'
    );
    assert.ok(
      /TURN_DEADLINE_MS = MAX_STEPS \* TOOL_TIMEOUT_MS/.test(code),
      'the deadline is the product of the two server-declared factors'
    );
    assert.ok(
      /CHAT_TOOL_TIMEOUT_MS/.test(code) && /maxSteps/.test(code),
      'and both factors are read from where they are declared, never respelled'
    );
    assert.ok(
      /render\.yaml/.test(code),
      'the per-call factor comes from render.yaml — the deploy pin, not a repo default (M-165)'
    );
  });
  check('the battery socket keeps the NAT awake while the server computes', () => {
    // M-160: round 5's turn 0 was RESET at 272.7s where round 3's answered at
    // 214s — the bracket contains the 240s idle-flow timeout of the runners'
    // own NAT, and a /chat turn moves no bytes while the server grades. The
    // probes are the fix the CLIENT can make; the pin is that they exist and
    // ride the request socket.
    assert.ok(
      /req\.on\('socket', \(s\) => s\.setKeepAlive\(true, KEEPALIVE_PROBE_MS\)\)/.test(bat),
      'keep-alive probes are armed on the request socket'
    );
    assert.ok(
      /KEEPALIVE_PROBE_MS = NAT_IDLE_FLOOR_MS \/ 10/.test(bat),
      'and the cadence derives from the documented idle floor, not a bare number'
    );
  });
  check('the battery finishes only on exit 0 — a parked exit 3 is declined and continued', () => {
    // M-163 (owner's order): round 6 parked at exit 3 — NO_PROGRESS, twelve
    // lines still flagged — and the driver hung up as if the song were done.
    // Only exit 0 finishes a song now; the driver's user-role reply declines
    // the parked draft and asks the loop to keep revising. Comments stripped
    // for the same reason as the fetch pin above.
    const code = bat.replace(/^\s*\/\/.*$/gm, '');
    assert.ok(/if \(c\.exit_code === 0\) sawStop = 0;/.test(code), 'exit 0 is the only finish');
    assert.ok(
      !/sawStop = c\.exit_code/.test(code),
      'the old exit-0-or-3 finish assignment is gone'
    );
    assert.ok(
      /parkedLastTurn\s*\?\s*PARKED_CONTINUE\s*:\s*CONTINUE/.test(code),
      'a parked turn is answered with the decline-and-continue message'
    );
  });
  check("the deployment's transient answers earn the bounded logged backoff", () => {
    // M-164: round 7's turn 0 got chat.js's catch-all 502 ("The engine could
    // not answer that one") at 236s — the turn's upstream died past the
    // server's own single 5xx retry, the turn's work was thrown away, and the
    // driver treated it as fatal. The carried envelope is intact on a 502, so
    // it takes the same bounded, logged retry 429/503 always did.
    assert.ok(
      /r\.status === 429 \|\| r\.status === 502 \|\| r\.status === 503/.test(bat),
      '429, 502 and 503 all take the bounded retry path'
    );
  });
  check(
    "the spend pins state the owner's ruling, and the day derives its own turn count (M-215)",
    () => {
      // Round 10's turns 0 and 4 stopped MAX_TURN_COST under a $0.10 pin while
      // mcp/gemini_agent.js's default and BACKLOG's OWNER rows said $2.50 and
      // $25 (M-197, 2026-09-02). Env wins over a default, so what deploys is
      // the pin — and no test read the pin. Three reviewers found it the same
      // afternoon from the same evidence. Pinned like CHAT_TOOL_TIMEOUT_MS:
      // the yaml value equals the code's default, so the two cannot drift.
      const yaml = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
      const agent = readFileSync(new URL('./gemini_agent.js', import.meta.url), 'utf8');
      const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
      const turn = /key: CHAT_MAX_TURN_USD\s+value: '([\d.]+)'/.exec(yaml);
      const day = /key: CHAT_DAILY_USD\s+value: '([\d.]+)'/.exec(yaml);
      assert.ok(turn && day, 'render.yaml pins both dollar ceilings');
      const turnDefault =
        /maxTurnUsd: Number\(process\.env\.CHAT_MAX_TURN_USD\) \|\| ([\d.]+)/.exec(agent);
      const dayDefault = /const DAILY_USD = num\('CHAT_DAILY_USD', ([\d.]+)\)/.exec(chat);
      assert.ok(turnDefault && dayDefault, 'the code declares a default for each');
      assert.equal(
        Number(turn[1]),
        Number(turnDefault[1]),
        "the turn pin is the code's $2.50, not the old $0.10"
      );
      assert.equal(
        Number(day[1]),
        Number(dayDefault[1]),
        "the day pin is the code's $25, not the old $2"
      );
      assert.ok(
        !/^\s+- key: CHAT_MAX_TURNS_PER_DAY/m.test(yaml),
        "the turn-count ceiling is DERIVED from the day (chat.js) and not pinned to the old day's 400"
      );
    }
  );
  check(
    'every lyric verdict says which path answered, how long it took, and what the run disclosed (M-216)',
    async () => {
      // Ten battery rounds could not say whether the deployed box answered
      // warm or cold, and a turn's harness time was never separable from the
      // model's (M-170). `runVerb` stamps path and ms on the result, verdictOf
      // carries them with the replay memo's tally, the stale-answer count and
      // the plan's line count, and loopFields puts all of them in the tool row.
      const { _workerInternals: WK, _verdictInternals: VI } = await import('./lyric_tools.js');
      const { verdictOf, extractRunRecord } = VI;
      const { _agentInternals: AG } = await import('./gemini_agent.js');
      const rec = extractRunRecord(
        '  PLAN: form=verse-chorus seed=7045 -> 16 line(s), 8 section(s): x\n' +
          '  REPLAY MEMO: warm — 14 of 28 grading call(s) answered from the process memo (runs held: 1 of 4)\n' +
          '  2 of those answer(s) were recorded against a DIFFERENT draft (L3 attempt 1): this state file was reused\n'
      );
      assert.deepEqual(rec, {
        memo_state: 'warm',
        memo_hit: 14,
        memo_asked: 28,
        stale_answers: 2,
        plan_lines: 16,
      });
      assert.deepEqual(
        extractRunRecord('nothing here'),
        { stale_answers: 0 },
        'no line, no number — and stale is 0, not absent'
      );
      const v = verdictOf({
        code: 0,
        stdout: '  REPLAY MEMO: cold — 0 of 2 grading call(s) answered',
        stderr: '',
        path: 'warm',
        ms: 1234,
      });
      assert.equal(v.path, 'warm');
      assert.equal(v.ms, 1234);
      assert.equal(v.memo_state, 'cold');
      const row = AG.loopFields(v);
      assert.equal(row.path, 'warm');
      assert.equal(row.ms, 1234);
      assert.equal(row.memo_hit, 0);
      assert.equal(row.stale_answers, 0);
      assert.equal(row.plan_lines, null);
      const cold = await WK.runCold(['screen', 'fire', 'desire']);
      assert.ok(typeof cold.stdout === 'string', 'the cold path still answers');
      const src = readFileSync(new URL('./lyric_tools.js', import.meta.url), 'utf8');
      assert.ok(
        /stamp\(r, 'warm'\)/.test(src) &&
          /stamp\(r, 'cold-fallback'\)/.test(src) &&
          /stamp\(r, 'cold'\)/.test(src) &&
          /path: 'killed'/.test(src),
        'runVerb names all four paths'
      );
      assert.ok(
        /console\.error\([\s\S]*warm worker unavailable/.test(src),
        'a fallback to cold is LOGGED, never silent'
      );
      assert.ok(/console\.error\([\s\S]*warm worker exited/.test(src), 'a worker death is LOGGED');
    }
  );
  check(
    'one tool budget, five readers — the pin, the default, the client clock, the kill, the live test clock',
    () => {
      // M-165: round 8's turn 8 was EIGHT consecutive lyric_revise exit -1,
      // 25.6 minutes, MAX_TURN_COST — the 180s subprocess kill sat UNDER the
      // 240s the chat client was still willing to wait, and the deferred
      // replay (~34s base, ~15s per folded answer, measured) legitimately
      // outlives 180s past ~10 answers. One definition now: budget.js derives
      // the default, render.yaml pins what deploys, and both clocks read it.
      const budget = readFileSync(new URL('./budget.js', import.meta.url), 'utf8');
      const m = /DEFAULT_TOOL_BUDGET_MS = ([\d_]+)/.exec(budget);
      assert.ok(m, 'budget.js declares the derived default');
      const def = Number(m[1].replace(/_/g, ''));
      const yaml = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
      const y = /key: CHAT_TOOL_TIMEOUT_MS\s+value: '(\d+)'/.exec(yaml);
      assert.ok(
        y,
        'render.yaml pins the deployed value — the battery derives its deadline from it'
      );
      assert.equal(Number(y[1]), def, 'the pin and the default are one value, not two spellings');
      const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
      assert.ok(/TOOL_TIMEOUT_MS = TOOL_BUDGET_MS/.test(chat), 'chat.js reads the shared budget');
      assert.ok(
        !/num\('CHAT_TOOL_TIMEOUT_MS'/.test(chat),
        'and no longer holds its own spelling of it'
      );
      const lt = readFileSync(new URL('./lyric_tools.js', import.meta.url), 'utf8');
      assert.ok(
        /SUBPROCESS_TIMEOUT_MS = TOOL_BUDGET_MS/.test(lt),
        'the subprocess kill is the same budget — no wall under the caller declared patience'
      );
      // M-218: this file's OWN live clock was the fifth spelling — 300s,
      // under the 600s kill — and lost a coin flip to runner speed.
      const self = readFileSync(new URL('./test.mjs', import.meta.url), 'utf8');
      assert.ok(
        /const LIVE_OPTS = \{ timeout: TOOL_BUDGET_MS \+ LIVE_MARGIN_MS \}/.test(self),
        "the live checks' clock is the budget plus a margin, not a fifth literal"
      );
      assert.ok(
        !/timeout: 300_0{3}\b/.test(self), // spelled so this regex is not its own match
        'and the old 300s spelling is gone from the live path'
      );
    }
  );
  check("the loop's own record of a run survives every layer to the transcript", () => {
    // M-169: revise_loop computes stop_reason / rounds / unresolved, the finish
    // verb prints all three in its [FINISHED …] stamp, and until this check
    // every layer above dropped them — so the battery transcript could say a
    // call exited 3 and not whether 8 rounds closed nineteen lines or none.
    // Round 10 was diagnosed off a stamp the MODEL retyped into its reply,
    // which is the measured thing reporting its own measurement.
    const lt = readFileSync(new URL('./lyric_tools.js', import.meta.url), 'utf8');
    assert.ok(/function extractLoopRecord/.test(lt), 'the extractor exists');
    assert.ok(
      /v\.loop_stop_reason = loop\.stop_reason/.test(lt),
      'and the verdict carries it — extraction, not re-derivation'
    );
    // THE STAMP IS THE HARNESS'S, so the regex is checked against the harness's
    // OWN spelling rather than against a copy of it. A pattern tested only on a
    // fixture the test wrote is a pattern agreeing with itself.
    const py = readFileSync(new URL('../lyric-harness/lyric_harness.py', import.meta.url), 'utf8');
    assert.ok(
      /\[FINISHED — seed \{finish_seed\} — "\s*\n\s*f"exit \{_code\} — \{result\.stop_reason\.upper\(\)\} "\s*\n\s*f"after \{len\(result\.rounds\)\} round\(s\) — /.test(
        py
      ),
      'the harness still prints seed, exit, stop reason and round count in that order'
    );
    // A pasted song's run (M-195) is stamped `declared mandate` where a
    // planned one is stamped `seed N`; the harness prints both spellings and
    // the connector's ONE regex reads both. The source substring is compared
    // as a string rather than as a regex over a regex, so the pin reads the
    // way the extractor is spelled.
    assert.ok(
      /\[FINISHED — declared mandate — "\s*\n\s*f"exit \{_code\} — \{result\.stop_reason\.upper\(\)\} "\s*\n\s*f"after \{len\(result\.rounds\)\} round\(s\) — /.test(
        py
      ),
      "and the unseeded revise prints the same stamp with `declared mandate` in the seed's place"
    );
    const m = lt.includes(
      '/\\[FINISHED\\s*—\\s*(?:seed\\s*(-?\\d+)|declared mandate)\\s*—\\s*exit\\s*(\\d+)\\s*—\\s*([A-Z_]+)\\s+after\\s+(\\d+)\\s+round\\(s\\)'
    );
    assert.ok(m, 'and the connector reads exactly that shape, in both spellings');
    const ga = readFileSync(new URL('./gemini_agent.js', import.meta.url), 'utf8');
    assert.ok(
      /loop_stop_reason:/.test(ga) && /answers_on_record:/.test(ga),
      'the call record carries it'
    );
    const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
    assert.ok(
      /loop_rounds: c\.loop_rounds/.test(chat) && /loop_unresolved: c\.loop_unresolved/.test(chat),
      'and the /chat response exposes it — the battery records this array verbatim'
    );
    const bat = readFileSync(new URL('../scripts/flash_battery.mjs', import.meta.url), 'utf8');
    assert.ok(/loop_ladder: loopLadder/.test(bat), 'and the transcript banks the ladder');
  });
  check('an unstopped call contributes no loop row — absent is not zero', () => {
    // Doctrine 20 at the record's edge: a SUSPENDED call (exit 4) has reached no
    // stop condition, so it HAS no stop reason and no round count. A zero there
    // would read as a loop that ran and did nothing.
    const bat = readFileSync(new URL('../scripts/flash_battery.mjs', import.meta.url), 'utf8');
    assert.ok(
      /typeof c\.loop_rounds === 'number' && c\.loop_stop_reason/.test(bat),
      'the ladder row is gated on the record existing, not defaulted'
    );
    const lt = readFileSync(new URL('./lyric_tools.js', import.meta.url), 'utf8');
    assert.ok(
      /const loop = extractLoopRecord\(r\.stdout\);/.test(lt) && /if \(loop\) \{/.test(lt),
      'and the verdict adds the fields only when the stamp is there'
    );
  });
  check(
    'the replay memo holds as many runs as the chat layer can have — one figure, not two spellings',
    () => {
      // M-167: quality/replay_memo.py's RUNS_HELD is DERIVED from chat.js's
      // CHAT_CONCURRENCY default — 2 conversations x (live + superseded) — and
      // restates it rather than importing it, because the harness imports
      // nothing from mcp/ (the dependency runs the other way). This check is
      // the agreement the module's own comment promises: move the concurrency
      // default and this goes red instead of the memo silently evicting live
      // runs mid-conversation.
      const rm = readFileSync(
        new URL('../lyric-harness/quality/replay_memo.py', import.meta.url),
        'utf8'
      );
      const m = /RUNS_HELD = (\d+) \* (\d+)/.exec(rm);
      assert.ok(m, 'replay_memo.py derives RUNS_HELD as a product, never a bare figure');
      const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
      const c = /num\('CHAT_CONCURRENCY', (\d+)\)/.exec(chat);
      assert.ok(c, "chat.js declares the concurrency default the memo's first factor restates");
      assert.equal(
        Number(m[1]),
        Number(c[1]),
        "the memo's conversations factor IS the chat concurrency default"
      );
      assert.equal(
        Number(m[2]),
        2,
        'and the second factor is live + superseded — two states per conversation, not a tunable'
      );
    }
  );
  check('a verb that outlives the budget is not re-run cold on the serial queue', () => {
    // The cold fallback exists for a DEAD worker (crash, corruption): one
    // slow answer, identical semantics. A TIMED-OUT call already proved it
    // outlives the whole budget, so a cold re-run would hold the serial
    // queue for a SECOND whole budget to earn the same -1 — the double
    // block round 8 paid eight times over (M-165).
    const lt = readFileSync(new URL('./lyric_tools.js', import.meta.url), 'utf8');
    assert.ok(/e\.timedOut = true/.test(lt), 'the budget kill is tagged where the timer fires');
    assert.ok(
      /e && e\.timedOut\s*\?\s*\{ code: -1/.test(lt),
      'and runVerb surfaces the tagged kill as the -1 it is instead of retrying cold'
    );
  });
  check('the image ships every tracked runtime file under mcp/ — the worker included', () => {
    // M-187: mcp/Dockerfile:20 read `COPY mcp/*.js ./mcp/`, and mcp/worker.py —
    // the warm process `_spawnWorker` starts — is not a .js file, so every
    // image Render built between M-155 (2026-08-29) and 2026-09-01 lacked it.
    // The connector's own design hid that: a spawn that fails is the cold
    // execFile with byte-identical output ~20 ms later, so production served
    // every verb cold, the M-167 replay memo never engaged, and nothing went
    // red — M-170's audit found the line by reading it. A glob is a list
    // nobody re-reads when a file joins, so the list is re-derived from git on
    // every run and matched against the Dockerfile's own COPY set, with the
    // WORKDIR in force at each line resolved: a file has to land where
    // lyric_tools.js looks for it (/app/mcp), not merely somewhere in the
    // image. NOT_SHIPPED declares each tracked file the image is right to
    // omit, with its reason; a tracked file neither copied nor declared fails
    // here by name, and so does a declared file the Dockerfile copies anyway.
    //
    // EMPIRICALLY VERIFIED 2026-09-01: run against the pre-fix Dockerfile this
    // check failed with `tracked under mcp/, in no COPY and not in
    // NOT_SHIPPED: mcp/worker.py`; the planted mutant at the end IS that
    // Dockerfile (the worker's COPY line removed) and must keep saying so.
    const NOT_SHIPPED = {
      'mcp/Dockerfile': 'the build recipe — docker reads it, the server never does',
      'mcp/README.md': 'documentation',
      'mcp/PRIVACY.md': 'documentation',
      'mcp/test.mjs': 'this suite — CI runs it against the tree; the image runs server_http.js',
      'mcp/check_live.mjs':
        "the nightly's freshness probe — it runs in CI AGAINST the deployed endpoint (M-127), so an image carrying it would be the deployment checking itself",
    };
    const ROOT = fileURLToPath(new URL('..', import.meta.url));
    let tracked;
    try {
      tracked = execFileSync('git', ['ls-files', '-z', '--', 'mcp/'], {
        cwd: ROOT,
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean);
    } catch (e) {
      assert.fail(
        `REFUSED — git ls-files could not enumerate mcp/ (${e.message}); a check that cannot read its list must not pass (doctrine 20)`
      );
    }
    assert.ok(
      tracked.includes('mcp/worker.py') && tracked.includes('mcp/lyric_tools.js'),
      'git sees the tree this suite runs in'
    );
    for (const f of Object.keys(NOT_SHIPPED))
      assert.ok(
        tracked.includes(f),
        `NOT_SHIPPED names ${f}, which git no longer tracks — a stale exclusion is a list nobody re-read`
      );

    // The Dockerfile's COPY set: each tracked file that some source names,
    // mapped to the absolute directory it lands in under the WORKDIR then in
    // force. The build context is the repo root (the file's own header), so
    // sources are spelled exactly as git spells them.
    const coverage = (dockerfile) => {
      let cwd = '/';
      const landed = new Map();
      for (const raw of dockerfile.split('\n')) {
        const line = raw.trim();
        let m;
        if ((m = /^WORKDIR\s+(\S+)$/.exec(line))) {
          cwd = m[1].startsWith('/') ? m[1] : posix.join(cwd, m[1]);
          continue;
        }
        if (!(m = /^COPY\s+(.+)$/.exec(line))) continue;
        const parts = m[1].split(/\s+/).filter((p) => !p.startsWith('--'));
        const dest = parts.pop();
        let destDir = dest.startsWith('/') ? dest : posix.join(cwd, dest);
        // `COPY one/file some/name` with no trailing slash is a RENAME to a
        // file; the directory it lands in is the dirname.
        if (!dest.endsWith('/') && parts.length === 1 && tracked.includes(parts[0]))
          destDir = posix.dirname(destDir);
        destDir = posix.normalize(destDir).replace(/(.)\/$/, '$1');
        for (const src of parts) {
          const re = new RegExp(
            '^' +
              src
                .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '[^/]') +
              '$'
          );
          for (const f of tracked) {
            if (f === src || f.startsWith(src.replace(/\/$/, '') + '/') || re.test(f))
              landed.set(f, destDir);
          }
        }
      }
      const uncovered = tracked.filter((f) => !landed.has(f) && !(f in NOT_SHIPPED));
      return { landed, uncovered };
    };

    const text = readFileSync(new URL('./Dockerfile', import.meta.url), 'utf8');
    const { landed, uncovered } = coverage(text);
    assert.deepEqual(
      uncovered,
      [],
      `tracked under mcp/, in no COPY and not in NOT_SHIPPED: ${uncovered.join(', ')} — COPY it in mcp/Dockerfile or declare why the image omits it`
    );
    const declared = Object.keys(NOT_SHIPPED);
    assert.equal(
      landed.size,
      tracked.length - declared.length,
      `${landed.size} files copied against ${tracked.length} tracked minus ${declared.length} declared`
    );
    const copiedAnyway = declared.filter((f) => landed.has(f));
    assert.deepEqual(
      copiedAnyway,
      [],
      `declared NOT_SHIPPED and copied regardless: ${copiedAnyway.join(', ')} — one of the two is stale`
    );
    const astray = [...landed].filter(([, d]) => d !== '/app/mcp').map(([f, d]) => `${f} -> ${d}`);
    assert.deepEqual(astray, [], `copied where lyric_tools.js does not look: ${astray.join(', ')}`);
    assert.equal(
      landed.get('mcp/worker.py'),
      '/app/mcp',
      'the worker lands beside lyric_tools.js, where WORKER_PATH resolves'
    );
    // The planted mutant: the pre-fix Dockerfile, reproduced from the fixed one.
    const mutant = text.replace(/^COPY mcp\/worker\.py .*\n/m, '');
    assert.notEqual(mutant, text, "the worker's COPY line is there to be removed");
    assert.deepEqual(
      coverage(mutant).uncovered,
      ['mcp/worker.py'],
      'and without it the check names the worker — the finding, reproduced'
    );
  });
  check('a battery transport failure is a recorded row, never a crash', async () => {
    const { spawnSync } = await import('node:child_process');
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const out = mkdtempSync(join(tmpdir(), 'battery-m159-'));
    try {
      // The discard port: nothing listens on 127.0.0.1:9, so the refusal is
      // immediate and deterministic — a REAL run of the driver into a dead
      // endpoint, not a source pin on the error handler.
      const r = spawnSync(process.execPath, [
        fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url)),
        `--out=${out}`,
        '--base=http://127.0.0.1:9',
        '--songs=1',
        '--turns=2',
        '--pace=0',
      ]);
      // M-223: surviving means the RECORD is written; the exit code is the
      // round's verdict, and a single-song round with no song is red.
      assert.equal(r.status, 1, `a single-song round with no song exits 1: ${r.stderr}`);
      const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
      assert.equal(summary.songs[0].exit_reason, 'transport');
      assert.equal(
        summary.songs[0].flags[0].flag,
        'transport_failure',
        'the failure is on the record, not swallowed'
      );
      const rows = readFileSync(join(out, 'song0.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l));
      assert.equal(rows[0].status, 0, 'the failed turn is a row with status 0');
      assert.ok(rows[0].transport, 'carrying the transport reason');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
  // The fake connector lives in THIS process, so the driver must be awaited
  // asynchronously: spawnSync would block the event loop the server answers
  // on and the two would wait on each other forever (measured, 2026-09-04).
  const runDriver = (spawn, argv) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, argv);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c) => (stdout += c));
      child.stderr.on('data', (c) => (stderr += c));
      child.on('close', (status) => resolve({ status, stdout, stderr }));
    });
  // M-222: THE USER-LEVEL RE-ASK, DRIVEN against a fake connector. Two turns
  // that end on MALFORMED_FUNCTION_CALL with no call are re-sent as the same
  // message; the third answer lands a call, and the round does NOT fail fast
  // — three rows for one turn, the user_reasks count on the row and the
  // summary, and the envelope of the LAST answer carried forward.
  check(
    'a malformed, call-less turn is re-sent as the same message, bounded, and a recovered turn is not a failure',
    async () => {
      const { spawn } = await import('node:child_process');
      const { mkdtempSync, rmSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const http = await import('node:http');
      const seen = [];
      const srv = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const b = JSON.parse(body || '{}');
          seen.push(b);
          const n = seen.length;
          const malformedTurn = n <= 2;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              reply: malformedTurn ? '' : 'planned',
              tools: malformedTurn
                ? []
                : [{ name: 'lyric_plan', exit_code: 0, path: 'warm', answers_on_record: null }],
              stopped: malformedTurn ? 'MALFORMED_FUNCTION_CALL' : null,
              stopped_detail: null,
              history: [{ role: 'user', parts: [{ text: `h${n}` }] }],
              workspace: null,
              sig: `sig${n}`,
            })
          );
        });
      });
      await new Promise((r) => srv.listen(0, '127.0.0.1', r));
      const port = srv.address().port;
      const out = mkdtempSync(join(tmpdir(), 'battery-m222-'));
      try {
        const r = await runDriver(spawn, [
          fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url)),
          `--out=${out}`,
          `--base=http://127.0.0.1:${port}`,
          '--songs=1',
          '--turns=1',
          '--pace=0',
        ]);
        // The round reached no stop, so it is red (M-223) — but NOT as a
        // fail-fast: the reason separates a recovered turn from a failure.
        assert.equal(r.status, 1, `no song, so exit 1: ${r.stderr}\n${r.stdout}`);
        // The driver's floor is two turns; turn 0 is the message sent three
        // times and turn 1 is the CONTINUE message sent once.
        assert.equal(seen.length, 4, 'turn 0 sent three times, turn 1 once');
        assert.notEqual(
          seen[3].message,
          seen[0].message,
          'the fourth request is the next turn, not a re-ask'
        );
        assert.equal(seen[1].message, seen[0].message, 'the re-ask is the SAME message');
        assert.equal(seen[1].sig, 'sig1', 'on the envelope the failed answer handed back');
        assert.equal(seen[2].sig, 'sig2');
        const rows = readFileSync(join(out, 'song0.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((l) => JSON.parse(l));
        assert.deepEqual(
          rows.filter((x) => 'reask' in x).map((x) => [x.reask, x.stopped]),
          [
            [1, 'MALFORMED_FUNCTION_CALL'],
            [2, 'MALFORMED_FUNCTION_CALL'],
          ],
          'each re-ask is its own row'
        );
        const turnRow = rows.find((x) => 'tools' in x);
        assert.equal(turnRow.user_reasks, 2, 'the turn row counts them');
        assert.equal(turnRow.stopped, null, 'and records the LAST answer');
        assert.ok(!rows.some((x) => 'fail_fast' in x), 'no fail-fast row');
        const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
        assert.equal(summary.songs[0].user_reasks, 2);
        assert.equal(summary.songs[0].reask_bound, 2);
        assert.equal(summary.songs[0].failed_fast, false);
        assert.equal(
          summary.songs[0].exit_reason,
          'no_stop',
          'red for no song, not for the re-ask'
        );
        assert.ok(
          /battery user re-ask/.test(String(r.stdout)),
          'each re-ask is a warning annotation'
        );
      } finally {
        srv.close();
        rmSync(out, { recursive: true, force: true });
      }
    }
  );
  // M-231: A 502 WHOSE UPSTREAM SAID 4xx IS FINAL. Round 17's turn 1 banked
  // four 502s over thirteen minutes, each carrying only "The engine could not
  // answer that one" — the cause went to a service log the battery cannot
  // read. The connector's error body now carries the upstream status and
  // message; a 4xx that is not 429 ends the turn on the first answer, with
  // the detail and the hops on the row, and the round exits upstream_final.
  check(
    'a 502 whose upstream answered 4xx ends the turn at once, the row quotes the cause, and the round exits upstream_final',
    async () => {
      const { spawn } = await import('node:child_process');
      const { mkdtempSync, rmSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const http = await import('node:http');
      const seen = [];
      const srv = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          seen.push(JSON.parse(body || '{}'));
          res.writeHead(502, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'The engine could not answer that one. Try rephrasing?',
              detail:
                'Gemini 400: Please ensure that function call turn comes immediately after a user turn',
              upstream_status: 400,
              hopsBeforeFailure: 1,
              callsBeforeFailure: [{ name: 'lyric_revise', error: null, exit_code: 4 }],
              chargedUsd: 0.01,
            })
          );
        });
      });
      await new Promise((r) => srv.listen(0, '127.0.0.1', r));
      const port = srv.address().port;
      const out = mkdtempSync(join(tmpdir(), 'battery-m231-'));
      try {
        const r = await runDriver(spawn, [
          fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url)),
          `--out=${out}`,
          `--base=http://127.0.0.1:${port}`,
          '--songs=1',
          '--turns=1',
          '--pace=0',
        ]);
        assert.equal(r.status, 1, `no song, so exit 1: ${r.stderr}\n${r.stdout}`);
        assert.equal(seen.length, 1, 'ONE request: a 400 upstream is not retried');
        const rows = readFileSync(join(out, 'song0.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((l) => JSON.parse(l));
        const fin = rows.find((x) => 'upstream_final' in x);
        assert.ok(fin, 'the row names the final upstream answer');
        assert.equal(fin.upstream_final, 400);
        assert.match(fin.detail, /Gemini 400/, 'and quotes the cause');
        assert.equal(fin.hops_before_failure, 1);
        assert.deepEqual(fin.calls_before_failure, [
          { name: 'lyric_revise', error: null, exit_code: 4 },
        ]);
        assert.ok(!rows.some((x) => 'retry' in x), 'no retry row was written');
        const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
        assert.equal(summary.songs[0].exit_reason, 'upstream_final');
        assert.ok(
          summary.songs[0].flags.some((f) => f.flag === 'upstream_final'),
          'the flag is on the summary'
        );
        assert.ok(
          /battery upstream final/.test(String(r.stdout)),
          'the verdict is an error annotation naming the upstream status'
        );
      } finally {
        srv.close();
        rmSync(out, { recursive: true, force: true });
      }
    }
  );
  check('a 502 says what died: the upstream status and message ride on the body (M-231)', () => {
    const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
    assert.ok(/detail: String\(\(err && err\.message\) \|\| err\)\.slice\(0, 400\)/.test(chat));
    assert.ok(
      /upstream_status: Number\.isFinite\(err && err\.status\) \? err\.status : null/.test(chat)
    );
    assert.ok(/callsBeforeFailure: calls\.map/.test(chat), 'and the calls the turn had made');
    const bat = readFileSync(new URL('../scripts/flash_battery.mjs', import.meta.url), 'utf8');
    assert.ok(/!upstreamFinal\(\) &&/.test(bat), 'the retry loop stops on a final upstream answer');
    assert.ok(
      /r\.upstreamStatus >= 400 &&\s*r\.upstreamStatus < 500 &&\s*r\.upstreamStatus !== 429/.test(
        bat
      ),
      'final is 4xx and not 429 — a 5xx upstream keeps the bounded retry'
    );
  });
  // M-232: a turn the connector ended on an upstream 5xx WITH calls kept is
  // not an idle turn — no fail-fast, the flag names it, and the next turn
  // continues; here the next turn finishes the song, so the round exits 0.
  check(
    'a partial turn (calls kept, engine died) is not fail-fast, and the round goes on to finish',
    async () => {
      const { spawn } = await import('node:child_process');
      const { mkdtempSync, rmSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const http = await import('node:http');
      let n = 0;
      const srv = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          n++;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify(
              n === 1
                ? {
                    reply: '',
                    tools: [{ name: 'lyric_plan', seed: 5, exit_code: 0, path: 'warm' }],
                    stopped: 'UPSTREAM_503',
                    stopped_detail: {
                      status: 503,
                      detail: 'Gemini 503: high demand',
                      hops: 2,
                      calls: 1,
                    },
                    history: [{ role: 'user', parts: [{ text: 'h1' }] }],
                    workspace: null,
                    sig: 'sig1',
                  }
                : {
                    reply: 'done',
                    tools: [
                      {
                        name: 'lyric_revise',
                        seed: 5,
                        exit_code: 0,
                        path: 'warm',
                        answers_on_record: 0,
                      },
                    ],
                    stopped: null,
                    history: [{ role: 'user', parts: [{ text: 'h2' }] }],
                    workspace: null,
                    sig: 'sig2',
                  }
            )
          );
        });
      });
      await new Promise((r) => srv.listen(0, '127.0.0.1', r));
      const port = srv.address().port;
      const out = mkdtempSync(join(tmpdir(), 'battery-m232-'));
      try {
        const r = await runDriver(spawn, [
          fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url)),
          `--out=${out}`,
          `--base=http://127.0.0.1:${port}`,
          '--songs=1',
          '--turns=2',
          '--pace=0',
        ]);
        assert.equal(r.status, 0, `the song finished on turn 1: ${r.stderr}\n${r.stdout}`);
        assert.equal(n, 2, 'two turns, no retry of the partial one');
        const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
        assert.equal(summary.songs[0].exit_reason, 'finished');
        assert.deepEqual(
          summary.songs[0].flags.map((f) => f.flag),
          ['upstream_partial'],
          'the partial turn is flagged, never fail_fast'
        );
        assert.equal(summary.songs[0].flags[0].stopped, 'UPSTREAM_503');
        assert.ok(
          /battery partial turn/.test(String(r.stdout)),
          'the partial turn is a warning annotation'
        );
      } finally {
        srv.close();
        rmSync(out, { recursive: true, force: true });
      }
    }
  );
  // M-223: a 429 names its limiter in the body and its wait in Retry-After;
  // the retry row carries both and the wait is the server's number. Then the
  // round FINISHES (a lyric_revise exit 0) and exits 0, exit_reason finished.
  check(
    "a 429 is retried after the server's own Retry-After, the row quotes the limiter, and a finished song exits 0",
    async () => {
      const { spawn } = await import('node:child_process');
      const { mkdtempSync, rmSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const http = await import('node:http');
      const stamps = [];
      const srv = http.createServer((req, res) => {
        req.on('data', () => {});
        req.on('end', () => {
          stamps.push(Date.now());
          if (stamps.length === 1) {
            res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '1' });
            res.end(
              JSON.stringify({
                error: 'The engine is over its rate limit for the moment — try again in a minute.',
              })
            );
            return;
          }
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              reply: 'done',
              tools: [
                {
                  name: 'lyric_revise',
                  exit_code: 0,
                  loop_stop_reason: 'success',
                  loop_rounds: 2,
                  answers_on_record: 3,
                },
              ],
              stopped: null,
              history: [],
              workspace: null,
              sig: 's',
            })
          );
        });
      });
      await new Promise((r) => srv.listen(0, '127.0.0.1', r));
      const port = srv.address().port;
      const out = mkdtempSync(join(tmpdir(), 'battery-m223-'));
      try {
        const r = await runDriver(spawn, [
          fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url)),
          `--out=${out}`,
          `--base=http://127.0.0.1:${port}`,
          '--songs=1',
          '--turns=3',
          '--pace=0',
        ]);
        assert.equal(r.status, 0, `a finished song is the one green: ${r.stderr}`);
        assert.equal(stamps.length, 2, 'the 429 was retried once and the song finished');
        assert.ok(
          stamps[1] - stamps[0] >= 900,
          `the retry waited the server's 1s, not the 60s floor (${stamps[1] - stamps[0]}ms)`
        );
        const rows = readFileSync(join(out, 'song0.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((l) => JSON.parse(l));
        const retry = rows.find((x) => 'retry' in x);
        assert.equal(retry.status, 429);
        assert.equal(retry.retry_after_s, 1);
        assert.equal(retry.waited_s, 1);
        assert.ok(/over its rate limit/.test(retry.error), 'the row quotes the limiter');
        const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
        assert.equal(summary.songs[0].exit_reason, 'finished');
        assert.equal(summary.songs[0].reached_stop, 0);
        assert.ok(/battery retry/.test(String(r.stdout)), 'the retry is a warning annotation');
        assert.ok(
          /battery verdict::song 0: finished/.test(String(r.stdout)),
          'the verdict is an annotation'
        );
      } finally {
        srv.close();
        rmSync(out, { recursive: true, force: true });
      }
    }
  );
  // M-223 (round 13): a turn that made calls and THEN ended on a malformed
  // hop is truncated, not dead — it continues on the next message and is
  // counted, and fail-fast does not fire on it.
  check(
    'a malformed end after calls is a truncated turn: no fail-fast, the next message goes out, and the summary counts it',
    async () => {
      const { spawn } = await import('node:child_process');
      const { mkdtempSync, rmSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const http = await import('node:http');
      const seen = [];
      const srv = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          seen.push(JSON.parse(body || '{}'));
          const n = seen.length;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify(
              n === 1
                ? {
                    reply: '',
                    tools: [
                      { name: 'lyric_plan', exit_code: 0 },
                      { name: 'lyric_revise', exit_code: 4, answers_on_record: 2 },
                    ],
                    stopped: 'MALFORMED_FUNCTION_CALL',
                    history: [{ role: 'user', parts: [{ text: 'h1' }] }],
                    workspace: null,
                    sig: 'sig1',
                  }
                : {
                    reply: 'done',
                    tools: [
                      {
                        name: 'lyric_revise',
                        exit_code: 0,
                        loop_stop_reason: 'success',
                        loop_rounds: 1,
                        answers_on_record: 3,
                      },
                    ],
                    stopped: null,
                    history: [],
                    workspace: null,
                    sig: 'sig2',
                  }
            )
          );
        });
      });
      await new Promise((r) => srv.listen(0, '127.0.0.1', r));
      const port = srv.address().port;
      const out = mkdtempSync(join(tmpdir(), 'battery-m223b-'));
      try {
        const r = await runDriver(spawn, [
          fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url)),
          `--out=${out}`,
          `--base=http://127.0.0.1:${port}`,
          '--songs=1',
          '--turns=3',
          '--pace=0',
        ]);
        assert.equal(r.status, 0, `the song finished on turn 1: ${r.stderr}\n${r.stdout}`);
        assert.equal(
          seen.length,
          2,
          'the truncated turn was followed by the next message, not a re-send'
        );
        assert.notEqual(seen[1].message, seen[0].message, 'the second message is CONTINUE');
        assert.equal(seen[1].sig, 'sig1', "on the truncated turn's envelope");
        const rows = readFileSync(join(out, 'song0.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((l) => JSON.parse(l));
        assert.ok(!rows.some((x) => 'fail_fast' in x), 'no fail-fast row');
        assert.ok(!rows.some((x) => 'reask' in x), 'no user re-ask either: the turn made calls');
        const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
        assert.equal(summary.songs[0].truncated_turns, 1);
        assert.equal(summary.songs[0].exit_reason, 'finished');
      } finally {
        srv.close();
        rmSync(out, { recursive: true, force: true });
      }
    }
  );
  // M-224: the connector's own conversation cap (CHAT_MAX_TURNS) answers 429
  // with "start a new recipe" and no retry changes it — the round ends at once
  // with its own reason instead of four sixty-second waits.
  check(
    "the connector's conversation cap ends the round at once with exit_reason server_turn_cap",
    async () => {
      const { spawn } = await import('node:child_process');
      const { mkdtempSync, rmSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const http = await import('node:http');
      let n = 0;
      const t0 = Date.now();
      const srv = http.createServer((req, res) => {
        req.on('data', () => {});
        req.on('end', () => {
          n++;
          if (n === 1) {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
              JSON.stringify({
                reply: '',
                tools: [{ name: 'lyric_plan', exit_code: 0 }],
                stopped: null,
                history: [],
                workspace: null,
                sig: 's1',
              })
            );
            return;
          }
          res.writeHead(429, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({ error: 'That is 12 messages — start a new recipe to keep going.' })
          );
        });
      });
      await new Promise((r) => srv.listen(0, '127.0.0.1', r));
      const port = srv.address().port;
      const out = mkdtempSync(join(tmpdir(), 'battery-m224-'));
      try {
        const r = await runDriver(spawn, [
          fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url)),
          `--out=${out}`,
          `--base=http://127.0.0.1:${port}`,
          '--songs=1',
          '--turns=5',
          '--pace=0',
        ]);
        assert.equal(r.status, 1, 'no song, so red');
        assert.equal(n, 2, 'the cap was not retried');
        assert.ok(Date.now() - t0 < 30_000, 'and the round did not wait on it');
        const rows = readFileSync(join(out, 'song0.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((l) => JSON.parse(l));
        assert.ok(
          rows.some((x) => 'server_turn_cap' in x),
          'the cap is its own row'
        );
        assert.ok(!rows.some((x) => 'retry' in x), 'and no retry row');
        const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
        assert.equal(summary.songs[0].exit_reason, 'server_turn_cap');
        assert.equal(summary.songs[0].flags[0].flag, 'server_turn_cap');
      } finally {
        srv.close();
        rmSync(out, { recursive: true, force: true });
      }
    }
  );
  check(
    'the re-ask is bounded: a turn that fails a third time is the failure fail-fast stops on',
    async () => {
      const { spawn } = await import('node:child_process');
      const { mkdtempSync, rmSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const http = await import('node:http');
      let n = 0;
      const srv = http.createServer((req, res) => {
        req.on('data', () => {});
        req.on('end', () => {
          n++;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              reply: '',
              tools: [],
              stopped: 'MALFORMED_FUNCTION_CALL',
              stopped_detail: null,
              history: [],
              workspace: null,
              sig: `s${n}`,
            })
          );
        });
      });
      await new Promise((r) => srv.listen(0, '127.0.0.1', r));
      const port = srv.address().port;
      const out = mkdtempSync(join(tmpdir(), 'battery-m222b-'));
      try {
        const r = await runDriver(spawn, [
          fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url)),
          `--out=${out}`,
          `--base=http://127.0.0.1:${port}`,
          '--songs=1',
          '--turns=3',
          '--pace=0',
        ]);
        assert.equal(r.status, 1, 'three malformed answers to one message is the fail-fast');
        assert.equal(n, 3, 'the bound held: two re-asks, not more, and no second turn');
        const rows = readFileSync(join(out, 'song0.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((l) => JSON.parse(l));
        const ff = rows.find((x) => 'fail_fast' in x);
        assert.ok(ff, 'a fail_fast row');
        assert.ok(
          ff.fail_fast.some((m) =>
            /with no call \(this deploy records no re-ask; 2 user re-ask\(s\) spent\)/.test(m)
          ),
          'the reason says what the deploy did, not what it might have'
        );
        const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
        assert.equal(summary.songs[0].user_reasks, 2);
        assert.equal(summary.songs[0].failed_fast, true);
        assert.equal(summary.songs[0].exit_reason, 'failed_fast');
      } finally {
        srv.close();
        rmSync(out, { recursive: true, force: true });
      }
    }
  );
}

{
  // THE DEPLOY RE-RUN GUARD, DRIVEN — `MISSING.md` M-187 (b), owed by that
  // entry's 2026-09-02 addendum and paid here. `scripts/deploy_guard.sh` and
  // `scripts/last_deployed_sha.sh` shipped exercised only in a throwaway
  // repository against a hand-written `gh` shim, which is a measurement
  // nobody can re-run: NO GATE READ EITHER SCRIPT, so a regression in the one
  // decision standing between a re-run of a push's CI run and a needless
  // rebuild-and-restart of the live connector would have gone red nowhere.
  // These checks build a REAL temporary git repository per case and run the
  // REAL scripts against it, with a `gh` on PATH replaying the run shapes the
  // API actually returns. Nothing here reads the network, the live
  // repository, or the deployed service.
  //
  // WHY IN THIS FILE. mcp/test.mjs is the connector's own suite and CI runs
  // it (`npm run test` -> `test:serial` -> `test:connector`), and the guard is
  // the last thing between a green CI run and a POST that restarts the
  // connector. The shape is `scripts/check_publish_guard.js`'s, one service
  // over, and the wiring check at the end is that file's §7 lesson.
  //
  // EMPIRICALLY VERIFIED TWO-SIDED, 2026-09-02 — doctrine 48 one layer in: a
  // check that cannot fail enforces nothing, and a rule enforced by nothing is
  // followed as often as someone remembers it. Five defects were reintroduced
  // into the two scripts in turn, and the scripts restored byte-identical
  // afterwards; each named exactly the checks it should and no others.
  // Striking the same-sha block: the ALREADY-ASKED
  // check red at `0 !== 10` (plus the mutant check, which can no longer find
  // the block to strike). Reading an absent record as a match (`-n … &&` ->
  // `-z … ||`): the NO-RECORD check and the FAILING-gh check red at
  // `10 !== 0`. Hoisting the same-sha test above the ordering test: the
  // BEHIND-THE-TIP check red, alone, and the mutant check still green —
  // the ordering assertion is the only thing that sees it. Dropping
  // `select(.id != $SKIP)` from the lookup: the SKIP check red on the run in
  // flight being asked about. Widening `grep -qx success` to accept `skipped`
  // and `failure`: the SKIP check red, returning the stood-down run's sha
  // instead of the record's.
  const { mkdtempSync, writeFileSync, chmodSync, rmSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const GUARD = fileURLToPath(new URL('../scripts/deploy_guard.sh', import.meta.url));
  const LOOKUP = fileURLToPath(new URL('../scripts/last_deployed_sha.sh', import.meta.url));
  const DEPLOY = 0;
  const STAND_DOWN = 10;
  const trash = [];

  // A git environment that cannot read the box's own config: a global signing
  // key or a commit template would otherwise decide whether these commits
  // exist at all.
  const GIT_ENV = {
    GIT_AUTHOR_NAME: 'T',
    GIT_AUTHOR_EMAIL: 't@e',
    GIT_COMMITTER_NAME: 'T',
    GIT_COMMITTER_EMAIL: 't@e',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
  };
  // The suite itself runs inside a git worktree, so GIT_DIR or GIT_WORK_TREE
  // leaking in would point the guard at THIS repository and every case below
  // would measure the wrong tree.
  const cleanEnv = () => {
    const e = { ...process.env, ...GIT_ENV };
    delete e.GIT_DIR;
    delete e.GIT_WORK_TREE;
    delete e.LAST_DEPLOYED_SHA;
    return e;
  };

  // A repository with `main` and a real `refs/remotes/origin/main`, which is
  // the ref the guard asks about — deploy-connector.yml checks out at
  // fetch-depth 0 precisely so `merge-base` and `rev-list --count` can be
  // answered about it.
  const makeRepo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'deployguard-'));
    trash.push(dir);
    const git = (...args) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: cleanEnv() }).trim();
    git('init', '-q', '-b', 'main');
    const commit = (msg, body) => {
      writeFileSync(join(dir, 'file.txt'), body);
      git('add', '-A');
      git('commit', '-q', '-m', msg);
      return git('rev-parse', 'HEAD');
    };
    const setOrigin = () => git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    const base = commit('base', 'v1\n');
    setOrigin();
    return { dir, git, commit, setOrigin, base };
  };

  // `bash scripts/deploy_guard.sh --verbose` is the exact invocation in
  // deploy-connector.yml, and --verbose is load-bearing here: the sentence
  // saying the same-sha check DID NOT RUN only prints under it.
  const runGuard = (dir, built, last, script = GUARD) => {
    const env = cleanEnv();
    env.BUILT_SHA = built;
    if (last !== undefined) env.LAST_DEPLOYED_SHA = last;
    try {
      // stderr is CAPTURED, not inherited: a case that deliberately drives a
      // refusal would otherwise print the refusal into the suite's own log and
      // read as a failure to anyone skimming it.
      const out = execFileSync('bash', [script, '--verbose'], {
        cwd: dir,
        encoding: 'utf8',
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
    }
  };

  // The `gh` the lookup calls, replaying what `gh api --jq` PRINTS for the two
  // requests the script makes. It replays the API, not the script's own logic:
  // the run-list request applies the `select(.id != N)` the script wrote into
  // its own jq expression, and the jobs request answers with that run's
  // `Deploy` step conclusion exactly as the API reports it — `null` for a step
  // that has not concluded, nothing at all when the run has no such step.
  // Every request is logged, so a case can assert WHICH runs were asked about.
  const shimDir = mkdtempSync(join(tmpdir(), 'ghshim-'));
  trash.push(shimDir);
  writeFileSync(
    join(shimDir, 'gh'),
    `#!${process.execPath}
const fs = require('fs');
const log = process.env.GH_SHIM_LOG;
const args = process.argv.slice(2);
if (log) fs.appendFileSync(log, args.join(' ') + '\\n');
if (process.env.GH_SHIM_FAIL === '1') {
  process.stderr.write('gh: HTTP 403: Resource not accessible by integration\\n');
  process.exit(1);
}
if (args[0] !== 'api') process.exit(64);
const url = args[1];
const jq = args.includes('--jq') ? args[args.indexOf('--jq') + 1] : '';
const runs = JSON.parse(process.env.GH_SHIM_RUNS || '[]');
let m;
if (/\\/actions\\/workflows\\/[^/]+\\/runs\\?/.test(url)) {
  const skip = (m = /select\\(\\.id != (\\d+)\\)/.exec(jq)) ? Number(m[1]) : null;
  const rows = runs.filter((r) => r.id !== skip).map((r) => r.id + ' ' + r.sha);
  process.stdout.write(rows.length ? rows.join('\\n') + '\\n' : '');
} else if ((m = /\\/actions\\/runs\\/(\\d+)\\/jobs$/.exec(url))) {
  const run = runs.find((r) => r.id === Number(m[1]));
  if (run && 'deploy' in run) process.stdout.write(String(run.deploy) + '\\n');
} else {
  process.stderr.write('gh shim: unexpected request ' + url + '\\n');
  process.exit(65);
}
`
  );
  chmodSync(join(shimDir, 'gh'), 0o755);

  const runLookup = ({ runs, runId, fail, log }) => {
    const env = cleanEnv();
    env.PATH = `${shimDir}:${process.env.PATH}`;
    env.GITHUB_REPOSITORY = 'WeningerII/CodexMusica';
    env.GH_TOKEN = 'the-shim-never-reads-this';
    env.GH_SHIM_RUNS = JSON.stringify(runs || []);
    if (runId !== undefined) env.GITHUB_RUN_ID = String(runId);
    if (fail) env.GH_SHIM_FAIL = '1';
    if (log) env.GH_SHIM_LOG = log;
    try {
      const out = execFileSync('bash', [LOOKUP], {
        encoding: 'utf8',
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
    }
  };

  // The run history as the API hands it back, newest first and ALREADY
  // filtered to `status=success` — a STOOD-DOWN run is a successful run whose
  // `Deploy` step was skipped, which is exactly why the step conclusion and
  // not the run status is what decides. Verified against the live API on
  // 2026-09-02: run #26 shows `Deploy: success / Stood down: skipped`, #21 the
  // reverse.
  const HISTORY = (tip, prior) => [
    { id: 100, sha: tip, deploy: null }, // this very run: Deploy has not concluded
    { id: 99, sha: tip, deploy: 'skipped' }, // stood down — Render was never asked
    { id: 98, sha: tip, deploy: 'failure' }, // asked, and refused
    { id: 97, sha: prior, deploy: 'success' }, // the record
    { id: 96, sha: 'c'.repeat(40), deploy: 'success' }, // older still
  ];

  check(
    'deploy guard: the tip with no record on file deploys, and SAYS the check did not run',
    () => {
      // Doctrine 20 in one exit code: an absent record is UNKNOWN, and an
      // unknown must never read as a match. Both shapes the caller can produce
      // are driven — the variable unset, and the EMPTY STRING
      // deploy-connector.yml actually passes when the lookup found nothing or
      // could not be read at all.
      const r = makeRepo();
      for (const [label, last] of [
        ['unset', undefined],
        ['empty', ''],
      ]) {
        const res = runGuard(r.dir, r.base, last);
        assert.equal(res.code, DEPLOY, `${label}: an unknown record must deploy — ${res.out}`);
        assert.match(
          res.out,
          /the same-sha check did not run/,
          `${label}: and the guard must SAY the check did not run rather than pass in silence`
        );
      }
    }
  );

  check('deploy guard: the tip with a record that DIFFERS deploys, and names the record', () => {
    const r = makeRepo();
    const other = 'd'.repeat(40);
    const res = runGuard(r.dir, r.base, other);
    assert.equal(res.code, DEPLOY, `a different last-accepted sha must not block: ${res.out}`);
    assert.ok(res.out.includes(other) && /differs/.test(res.out), res.out);
  });

  check(
    'deploy guard: the tip that IS the last sha Render was asked for stands down at 10, naming both',
    () => {
      // The re-run M-187 (b) is about. A re-run of a push's CI run keeps
      // `event == 'push'`, so the workflow's own condition cannot see it, and
      // the tip-of-main test cannot either — an unchanged tip IS the tip.
      const r = makeRepo();
      const res = runGuard(r.dir, r.base, r.base);
      assert.equal(res.code, STAND_DOWN, `an already-asked sha must stand down: ${res.out}`);
      assert.match(res.out, /STAND DOWN/, res.out);
      assert.match(res.out, /built:\s+/, 'the message names the built sha');
      assert.match(res.out, /last accepted:\s+/, '...and the sha Render was already asked for');
      assert.ok(
        (res.out.match(new RegExp(r.base, 'g')) || []).length >= 2,
        'both lines carry a sha, so the log says WHICH tree is being refused'
      );
    }
  );

  check(
    'deploy guard: a sha BEHIND the tip stands down on ORDERING, and that test fires first',
    () => {
      // The ordering hazard is the older question and the guard asks it FIRST.
      // This case makes the two answers contradict on purpose —
      // LAST_DEPLOYED_SHA equals the built sha, so the same-sha rule would also
      // stand down — and then demands the ORDERING message. A guard that asked
      // the cheaper question first would still exit 10 here and would tell the
      // reader the wrong reason for a whole class of runs.
      const r = makeRepo();
      const built = r.base;
      r.commit('a later merge lands on main', 'v2\n');
      r.setOrigin();
      const res = runGuard(r.dir, built, built);
      assert.equal(res.code, STAND_DOWN, `a superseded tree must not deploy: ${res.out}`);
      assert.match(res.out, /behind main's tip by 1 commit/, res.out);
      assert.ok(
        !/last accepted/.test(res.out),
        'and the ordering answer must not arrive wearing the same-sha reason'
      );
    }
  );

  check(
    'last_deployed_sha: the run in flight is skipped, and so is every Deploy that did not conclude success',
    () => {
      const tip = 'a'.repeat(40);
      const prior = 'b'.repeat(40);
      const log = join(shimDir, 'calls.log');
      if (existsSync(log)) rmSync(log);
      const res = runLookup({ runs: HISTORY(tip, prior), runId: 100, log });
      assert.equal(
        res.code,
        0,
        `the lookup answers, or says nothing; it does not error: ${res.out}`
      );
      assert.equal(
        res.out.trim(),
        prior,
        'the record is the newest run whose Deploy step concluded success'
      );
      const calls = readFileSync(log, 'utf8');
      assert.ok(
        !/actions\/runs\/100\/jobs/.test(calls),
        'the run in flight is filtered out of the list, so its own pending Deploy is never even asked about'
      );
      assert.ok(
        /actions\/runs\/99\/jobs/.test(calls) && /actions\/runs\/98\/jobs/.test(calls),
        'the stood-down and the refused runs WERE asked about — they are skipped on their conclusion, not by luck'
      );
      assert.ok(
        !/actions\/runs\/96\/jobs/.test(calls),
        'and the walk stops at the first success instead of reading the whole history'
      );
      // No accepted deploy anywhere on record is check (a)'s input, and it is
      // a silent success, never an error.
      const none = runLookup({ runs: HISTORY(tip, prior).slice(0, 3), runId: 100 });
      assert.equal(none.code, 0, 'a history holding no accepted deploy exits 0');
      assert.equal(none.out.trim(), '', '...and prints nothing, which the caller reads as UNKNOWN');
    }
  );

  check(
    'last_deployed_sha: a gh that FAILS is unknown, and unknown deploys rather than matching',
    () => {
      // The API refusing to answer is the case that must collapse into neither
      // "no match" nor "match". The lookup exits non-zero and prints no sha;
      // deploy-connector.yml turns that into an empty LAST_DEPLOYED_SHA with a
      // WARNING, and the guard then deploys and says the check did not run.
      // Driven end to end here rather than asserted about the source.
      const res = runLookup({
        runs: HISTORY('a'.repeat(40), 'b'.repeat(40)),
        runId: 100,
        fail: true,
      });
      assert.notEqual(res.code, 0, 'a failing gh must not exit 0 carrying an empty answer');
      assert.equal(
        /^[0-9a-f]{40}$/m.test(res.out.trim()),
        false,
        'and it must print no sha at all — an unreadable history is not a value'
      );
      const r = makeRepo();
      const after = runGuard(r.dir, r.base, '');
      assert.equal(after.code, DEPLOY, `the unreadable case deploys: ${after.out}`);
      assert.match(after.out, /the same-sha check did not run/);
    }
  );

  check('the same-sha rule is load-bearing in BOTH directions (the two planted mutants)', () => {
    // A check that cannot fail enforces nothing — doctrine 48 one layer in,
    // and the shape the COPY-set check above answers the same way. The guard
    // is fed
    // its own two defects here — the comparison struck, and an absent record
    // read as a match — and each must flip exactly one of the answers above.
    const text = readFileSync(GUARD, 'utf8');
    const runMutant = (name, body, dir, built, last) => {
      const p = join(shimDir, name);
      writeFileSync(p, body);
      chmodSync(p, 0o755);
      return runGuard(dir, built, last, p);
    };

    // MUTANT 1 — the same-sha block deleted, which is the guard exactly as it
    // stood before M-187 (b). The already-asked tip deploys once more.
    const struck = text.replace(
      /^ {2}if \[ -n "\$\{LAST_DEPLOYED_SHA:-\}" \][\s\S]*?\n {2}fi\n/m,
      ''
    );
    assert.notEqual(struck, text, 'the same-sha block is there to be struck');
    const r1 = makeRepo();
    assert.equal(
      runMutant('mutant_struck.sh', struck, r1.dir, r1.base, r1.base).code,
      DEPLOY,
      'with the comparison gone the guard redeploys the sha Render was already asked for — the defect, reproduced'
    );

    // MUTANT 2 — an absent record counted as a match. The tip with nothing on
    // file stands down, which would stall the deploy of a commit nobody has
    // ever shipped every time the history could not be read.
    const greedy = text.replace(
      '[ -n "${LAST_DEPLOYED_SHA:-}" ] && [ "$BUILT" = "$LAST_DEPLOYED_SHA" ]',
      '[ -z "${LAST_DEPLOYED_SHA:-}" ] || [ "$BUILT" = "$LAST_DEPLOYED_SHA" ]'
    );
    assert.notEqual(greedy, text, 'the unknown-is-not-a-match guard is there to be broken');
    const r2 = makeRepo();
    assert.equal(
      runMutant('mutant_greedy.sh', greedy, r2.dir, r2.base, '').code,
      STAND_DOWN,
      'reading an absent record as a match stands down on a commit that was never deployed — the other defect'
    );
  });

  check(
    'deploy-connector.yml reaches both scripts, and LAST_DEPLOYED_SHA crosses the process boundary',
    () => {
      // check_publish_guard.js §7's lesson, learned there the expensive way:
      // the publish guard's first live run refused to decide because
      // BUILT_SHA was a plain shell variable the child process never saw. A
      // suite that proves the script while its only caller is broken is a
      // green suite over a broken pipeline.
      const wf = readFileSync(
        fileURLToPath(new URL('../.github/workflows/deploy-connector.yml', import.meta.url)),
        'utf8'
      );
      const code = wf
        .split('\n')
        .map((l, i) => ({ i, t: l.trim() }))
        .filter((l) => l.t && !l.t.startsWith('#'));
      const lineOf = (needle) => {
        const hit = code.find((l) => l.t.includes(needle));
        return hit ? hit.i : -1;
      };
      assert.ok(lineOf('scripts/deploy_guard.sh') >= 0, 'the workflow calls the guard');
      assert.ok(lineOf('scripts/last_deployed_sha.sh') >= 0, '...and the lookup that feeds it');
      assert.ok(
        lineOf('scripts/last_deployed_sha.sh') < lineOf('scripts/deploy_guard.sh'),
        'the record is read BEFORE the guard is asked, or the guard is handed nothing'
      );
      // The guard is a CHILD PROCESS: the sha has to be in its environment,
      // which for a `run` step means the step's `env:` block or an inline
      // assignment — never a bare shell variable.
      assert.ok(
        /env:\s*\n\s*LAST_DEPLOYED_SHA:/.test(wf) ||
          /LAST_DEPLOYED_SHA=\S+\s+\S*deploy_guard\.sh/.test(wf) ||
          /^\s*export\s+LAST_DEPLOYED_SHA\b/m.test(wf),
        'LAST_DEPLOYED_SHA reaches the guard as an environment variable'
      );
      assert.ok(
        /BUILT_SHA=(?:"[^"]*"|'[^']*'|\S+)\s+\S*scripts\/deploy_guard\.sh/.test(wf) ||
          /^\s*export\s+BUILT_SHA\b/m.test(wf),
        'and so does BUILT_SHA'
      );
      // Exit 10 is an ANSWER. A workflow that let it fail the job would paint
      // a correct stand-down red, and people learn to ignore a colour that
      // lies.
      assert.ok(/\b10\)/.test(wf) && /go=no/.test(wf), 'exit 10 is handled as a clean stand-down');
      assert.ok(
        /actions:\s*read/.test(wf),
        "the lookup needs actions: read to see this workflow's own run history"
      );
    }
  );

  for (const d of trash) rmSync(d, { recursive: true, force: true });
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
    [
      'lyric_check',
      'lyric_grade',
      'lyric_plan',
      'lyric_recover',
      'lyric_revise',
      'lyric_screen',
      'lyric_sweep',
      'lyric_types',
      'lyric_verify',
    ],
    'the nine lyric tools are advertised (M-195 added lyric_recover)'
  );
  for (const t of lyric) {
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name} read-only`);
    assert.equal(t.annotations?.openWorldHint, false, `${t.name} closed-world`);
  }
  console.log('  ok  lyric family advertised: 9 tools, read-only, closed-world');
  passed++;

  // DEPLOYMENT FRESHNESS HAS AN INSTRUMENT (M-127): check_live.mjs compares
  // the surface a RUNNING server advertises against this tree's own, because
  // on 2026-08-26 a live server was found serving a one-commit-stale
  // lyric_sweep schema (12-want ceiling, no story_lineups) and NOTHING could
  // have said so — every check in this repo ran against the code, none against
  // the deployment. These checks prove the comparator FAILS in every direction
  // it claims to detect; a differ that cannot fail is the vacuous-check defect
  // this suite's own history warns about. The transport half (a real server
  // answering over HTTP) is proven by running the instrument, not simulated
  // here — the comparator is the half a network cannot exercise.
  const { surfaceDrift } = await import('./check_live.mjs');
  const surf = tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
  assert.deepEqual(surfaceDrift(surf, surf), [], 'a surface matches itself — MATCH is reachable');
  const dropped = surf.slice(1);
  assert.ok(
    surfaceDrift(surf, dropped).some((d) => d.tool === surf[0].name && /missing/.test(d.what)),
    'a tool the live server lost is named as missing'
  );
  assert.ok(
    surfaceDrift(dropped, surf).some(
      (d) => d.tool === surf[0].name && /not in the tree/.test(d.what)
    ),
    'a tool only the live server has is named as extra'
  );
  const reworded = surf.map((t, i) => (i ? t : { ...t, description: `${t.description} (stale)` }));
  assert.ok(
    surfaceDrift(surf, reworded).some(
      (d) => d.tool === surf[0].name && d.what === 'description differs'
    ),
    'a drifted description is named with its coordinate'
  );
  const reshaped = surf.map((t, i) =>
    i ? t : { ...t, inputSchema: { ...t.inputSchema, maxItems: 999 } }
  );
  assert.ok(
    surfaceDrift(surf, reshaped).some(
      (d) => d.tool === surf[0].name && d.what === 'inputSchema differs'
    ),
    'a drifted schema is named with its coordinate — the exact shape the stale server wore'
  );
  const reordered = surf.map((t) => ({
    ...t,
    inputSchema: JSON.parse(JSON.stringify(t.inputSchema)),
  }));
  assert.deepEqual(
    surfaceDrift(surf, reordered.reverse()),
    [],
    'neither tool order nor key order is drift — the comparison is canonical'
  );
  console.log(
    '  ok  check_live: the freshness comparator fails in all four directions, and only those'
  );
  passed++;

  // THE SURFACE IS NOT THE BUILD (M-230): the M-228/M-229 merge touched no
  // tool, so the surface was byte-identical between the old process and the
  // new and the battery's wait-for-live matched the OLD deployment on its
  // first probe. commitDrift is the second half of the probe: /health's
  // commit against the sha the caller expects. Unknown is not a match.
  const { commitDrift } = await import('./check_live.mjs');
  const full = '62215f575ee73068212dc0201346e09a2fc8e194';
  assert.equal(commitDrift('', full), null, 'no expectation — the surface alone decides');
  assert.equal(commitDrift(full, full), null, 'the same sha matches');
  assert.equal(commitDrift(full.slice(0, 8), full), null, 'a short sha matches its full one');
  assert.equal(
    commitDrift(full, full.slice(0, 8).toUpperCase()),
    null,
    'case and length are not drift'
  );
  assert.match(
    commitDrift(full, null),
    /does not report a commit/,
    'a server that does not say its commit is NOT a match — unknown is not equal'
  );
  assert.match(
    commitDrift(full, 'b3928ddba7509365c2f09af27f7824935e3d0d6c'),
    /serving b3928ddba750, not 62215f575ee7/,
    'a different build is named by both shas'
  );
  assert.match(
    commitDrift('62215', full),
    /shorter than 7/,
    'a five-character prefix is refused, not matched'
  );
  console.log(
    '  ok  check_live: the build is compared beside the surface, and unknown is not a match'
  );
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
    // THE LIVE CHECKS DECLARE THEIR OWN CLOCK (2026-08-26). The SDK's
    // DEFAULT_REQUEST_TIMEOUT_MSEC is 60_000 and the bridge emits no
    // progress notifications to reset it — and the whole-vocabulary
    // default (M-116) put a full plan->fill->grade round trip AT that
    // cliff: ~61s wall on the CI runner that passed, MCP error -32001 on
    // the one that didn't, the same call both times. A regression gate
    // may not flip coins on runner speed, so every live lyric call rides
    // an explicit RequestOptions timeout. ~~300s~~ AND THE 300s WAS THE
    // SAME COIN ONE ROUNDING UP (M-218, 2026-09-03): run 33796842987's
    // runner was ~13% slower than the green run before it (regression_
    // recipes 351s -> 396s) and the seed-55 plan->grade call crossed 300s
    // — `MCP error -32001: Request timed out`, the SDK's anonymous
    // sentence, while the connector's own kill (`SUBPROCESS_TIMEOUT_MS`,
    // budget.js's ONE budget, 600s) sat ABOVE it and never got to answer.
    // A test clock under the connector's kill is M-165's wall-under-the-
    // caller shape inside the test. So the clock is DERIVED, not spelled:
    // the budget plus the bridge's own margin, so a call that outlives
    // the budget is answered by the connector as `path: 'killed'`, a
    // named verdict this file can read, and never by the SDK's timeout.
    // This is still the TEST's clock only: production clients keep the
    // SDK default, and the sweep-window budget in lyric_tools.js is still
    // derived against 60s on purpose.
    const LIVE_MARGIN_MS = 30_000;
    const LIVE_OPTS = { timeout: TOOL_BUDGET_MS + LIVE_MARGIN_MS };
    const callText = async (name, args) => {
      const res = await client.callTool({ name, arguments: args }, undefined, LIVE_OPTS);
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

    // THE HUMAN DOOR, LIVE (M-195, added 2026-09-02): an unmarked four-line
    // paste through the real verb. The refusals must be read off the REAL
    // render — the extractor's first pin passed on a shape the harness never
    // printed, and only a live call could have said so.
    const recovered = await callText('lyric_recover', {
      lines: [
        'The river took the bridge at dawn',
        'and no one saw the water again',
        'our cattle waded knee deep in silt',
        'past every fence the county rebuilt',
      ],
    });
    assert.equal(recovered.exit_code, 3, 'recover on an unmarked paste exits 3 — a work order');
    assert.ok(
      recovered.mandate && recovered.mandate.groups.length > 0,
      'the recovered mandate rides the verdict'
    );
    const coords = recovered.refusals.map((r) => r.coordinate);
    assert.ok(
      coords.includes('sections') && coords.includes('meter'),
      `the refusals are read off the real render: ${JSON.stringify(coords)}`
    );
    assert.ok(
      recovered.refusals.find((r) => r.coordinate === 'sections').why.includes('Mark the sections'),
      'and the reason travels with the coordinate'
    );
    console.log(
      `  ok  lyric_recover live: unmarked paste exits 3, mandate + refusals ${JSON.stringify(coords)} on the verdict`
    );
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
    // THE SEED IS SEARCHED FOR, NOT REMEMBERED (2026-08-24, `MISSING.md`
    // M-106). This block asserts three TITLE codes, and every one of them is
    // asked only of a plan that DECLARES A HOOK -- a hook is defined by
    // RETURN, so a pattern whose functions all occur once declares none and
    // the title question is never put. `seed: 55` was hardcoded here and had
    // a hook until the length envelope was re-derived; it now draws six
    // sections with no repeat, and the failure read "with no title the
    // question is REFUSED, not answered" -- naming the title layer for a
    // fact about the pattern. That is the SAME staleness this file's own
    // comment above describes fixing once already, one coordinate over, so
    // the fix is the same: ASK the report rather than remember the answer.
    // MEASURED over 240 seeds: 59.6% of plans declared a hook before the
    // re-derivation and 56.2% after, so this is a coin flip either way and
    // was never a property of 55.
    let plannedRes = null;
    let planSeed = null;
    for (const candidate of [55, 1, 4, 5, 11, 16, 17, 19]) {
      const tryRes = await client.callTool(
        { name: 'lyric_plan', arguments: { seed: candidate } },
        undefined,
        LIVE_OPTS
      );
      assert.ok(!tryRes.isError, `lyric_plan answered without isError (seed ${candidate})`);
      if (/is the hook/.test(tryRes.content[0].text)) {
        plannedRes = tryRes;
        planSeed = candidate;
        break;
      }
    }
    assert.ok(
      plannedRes !== null,
      'NO candidate seed declares a hook -- the premise of the title checks ' +
        'below, and a fact about the PATTERN rather than about titles'
    );
    assert.equal(plannedRes.content.length, 2, 'plan returns two blocks: report, then verdict');
    // M-219: the plan's verdict block says which path answered, how long it
    // took and how many lines it drew — it used to say exit_code and meaning
    // and nothing else, so no battery row ever carried the drawn shape.
    const planVerdict = JSON.parse(plannedRes.content[1].text);
    assert.ok(
      ['warm', 'cold', 'cold-fallback'].includes(planVerdict.path),
      `the plan verdict names its path (got ${planVerdict.path})`
    );
    assert.equal(typeof planVerdict.ms, 'number', 'and carries its wall time');
    assert.ok(!('report' in planVerdict), 'and does not repeat block 0 as JSON');
    const planReport = plannedRes.content[0].text;
    const nLines = Number((planReport.match(/-> (\d+) line\(s\)/) || [])[1]);
    assert.ok(nLines >= 4, `the plan declares its own line count (got ${nLines})`);
    assert.equal(
      planVerdict.plan_lines,
      nLines,
      'the verdict block carries the same line count the report prints'
    );

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
    const gradedRes = await client.callTool(
      { name: 'lyric_grade', arguments: { seed: planSeed, draft } },
      undefined,
      LIVE_OPTS
    );
    assert.ok(!gradedRes.isError, 'lyric_grade answered without isError');
    assert.equal(gradedRes.content.length, 2, 'grade returns two blocks: song, then verdict');
    {
      const gv = JSON.parse(gradedRes.content[1].text);
      assert.ok(
        ['warm', 'cold', 'cold-fallback'].includes(gv.path) && typeof gv.ms === 'number',
        `the grade verdict names its path and time (got ${gv.path}, ${gv.ms})`
      );
    }
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
      new RegExp(`\\[GRADED — seed ${planSeed} — exit [03], .+ — \\d+ banned pair\\(s\\)`).test(
        song
      ),
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

    // THE PLAN'S DRAWN RELATIONS REACH THE GRADE (MISSING.md M-117). With no
    // `relation` declared, the planner DRAWS one schema per group, and the
    // grade has to be asked the question the plan states. It was wired at the
    // plan and at NOTHING ELSE from 2026-08-25 to 2026-08-26: the brief told
    // the writer a group was "judged as itself, not as plain rhyme" and the
    // grade judged it under the whole-vocabulary default. Measured over three
    // seeds at the time, 226 FLAG findings suppressed and 1 MANUFACTURED —
    // the drop was never one-signed, because `schema:anaphora` REQUIRES the
    // token identity a bare `--groups=` charges as REPEAT.
    //
    // THE PIN IS AN EQUALITY BETWEEN THE HARNESS'S OWN TWO REPORTS — the
    // brief's `a NAMED relation` rows against the grade's `RELATION: group`
    // rows — so no vocabulary and no `--relations=` spelling is restated in
    // JS (doctrine 1). It goes red on a connector that drops the coordinate:
    // measured at 0 grade rows against 28 brief rows on seed 1. Adds no
    // subprocess; both reports are already in hand.
    const drawnInBrief = (planReport.match(/a NAMED relation/g) || []).length;
    const judgedInGrade = (gradeVerdict.report.match(/RELATION: group /g) || []).length;
    assert.ok(
      drawnInBrief > 0,
      'the planner drew at least one per-group relation — a 0 here is the ' +
        'certified pool going empty (M-117), not this wiring'
    );
    assert.equal(
      judgedInGrade,
      drawnInBrief,
      'every relation the PLAN drew is a relation the GRADE judged — the ' +
        'brief and the verdict have to ask the same question'
    );
    console.log(
      '  ok  lyric_grade live: the plan drew ' +
        drawnInBrief +
        ' relation(s) and the grade judged all of them (M-117)'
    );
    passed++;

    // `lyric_revise` — THE SEAM (M-154). The claims only this tool makes:
    // a suspended call contains NO SONG anywhere in its output (the render
    // exists structurally only past a stop condition of the loop), the
    // question is the writer's brief, and the `state` blob round-trips —
    // the server keeps nothing, so a re-call with the same unanswered state
    // re-asks the SAME question rather than advancing or inventing one.
    // M-221: `draft` is optional in the SCHEMA so the connector may fill it
    // from the carried record; a client that carries nothing gets a refusal
    // naming the parameter, never a run on an empty draft.
    const noDraft = await client.callTool(
      { name: 'lyric_revise', arguments: { seed: planSeed } },
      undefined,
      LIVE_OPTS
    );
    assert.ok(noDraft.isError, 'lyric_revise with no draft and nothing carried refuses');
    assert.ok(
      /`draft` omitted and no draft is carried/.test(noDraft.content[0].text),
      `the refusal names the draft (got: ${noDraft.content[0].text.slice(0, 120)})`
    );
    console.log(
      '  ok  lyric_revise live: an omitted draft nothing carries refuses by name (M-221)'
    );
    passed++;
    const rev1 = await client.callTool(
      { name: 'lyric_revise', arguments: { seed: planSeed, draft } },
      undefined,
      LIVE_OPTS
    );
    assert.ok(!rev1.isError, 'lyric_revise answered without isError');
    assert.equal(rev1.content.length, 2, 'revise returns two blocks: question, then verdict');
    const q1 = rev1.content[0].text;
    assert.ok(
      q1.startsWith(`[AWAITING PROPOSAL — seed ${planSeed} — 0 answer(s) on record — NO SONG YET]`),
      'a fresh revision suspends awaiting the first proposal'
    );
    assert.ok(
      !q1.includes('[FINISHED') && !q1.includes('THE SONG, PERFORMANCE ORDER'),
      'NO render reaches a suspended response — the seam holds'
    );
    const rv1 = JSON.parse(rev1.content[1].text);
    assert.equal(
      rv1.exit_code,
      4,
      'suspension is exit 4, its own code — neither verdict nor failure'
    );
    assert.equal(rv1.status, 'awaiting_proposal', 'and says so in its own field');
    // M-219: the SUSPENDED verdict is the common row of a real run (32 of
    // round 11's 33) and it was built by hand without the path stamp.
    assert.ok(
      ['warm', 'cold', 'cold-fallback'].includes(rv1.path) && typeof rv1.ms === 'number',
      `a suspended verdict names its path and time too (got ${rv1.path}, ${rv1.ms})`
    );
    const st1 = JSON.parse(rv1.state);
    assert.ok(st1.pending && st1.pending.kind, 'the state carries the pending question');
    // Round-trip: same state, no answer -> the SAME question, fast (the
    // harness refuses to advance past an unanswered pending — that refusal
    // IS the enforcement, and it must be idempotent or a retry would skip).
    const rev2 = await client.callTool(
      { name: 'lyric_revise', arguments: { seed: planSeed, draft, state: rv1.state } },
      undefined,
      LIVE_OPTS
    );
    const rv2 = JSON.parse(rev2.content[1].text);
    assert.equal(rv2.exit_code, 4, 'an unanswered state re-suspends');
    assert.equal(
      JSON.parse(rv2.state).pending.prompt,
      st1.pending.prompt,
      'and re-asks the IDENTICAL question — the loop is resumed, not re-imagined'
    );
    // An answer with no state to answer is refused by the tool itself.
    const revBad = await client.callTool(
      { name: 'lyric_revise', arguments: { seed: planSeed, draft, answer: 'a line' } },
      undefined,
      LIVE_OPTS
    );
    assert.ok(revBad.isError, '`answer` without `state` refuses — there is no question it answers');
    console.log(
      '  ok  lyric_revise live: suspends with the question, no render, state round-trips'
    );
    passed++;

    // THE WARM WORKER (M-155). The one claim that licenses it: the warm
    // path answers with the COLD PATH'S EXACT BYTES — same stdout, same
    // exit code — for every argv, including refusals, and a request served
    // AFTER another verb's request is not poisoned by it (the cross-verb
    // ordering below is the control). Then the operational half: the
    // worker PERSISTS between requests (that persistence is the entire
    // point — the memos live in it), and a killed worker costs one
    // fallback answer, never a wrong one.
    const { _workerInternals: WK } = await import('./lyric_tools.js');
    assert.ok(WK.enabled, 'the warm path is on by default (LYRIC_WORKER=0 disables)');
    const battery = [
      ['screen', 'fire', 'desire'],
      ['plan', '--seed=7', '--lines=22'],
      ['screen', 'hair', 'chair'],
      ['brief', 'no_such_file.txt', 'ABAB'], // a refusal, through both paths
    ];
    for (const argv of battery) {
      const warm = await WK.runWarm(argv).catch(() => null);
      const cold = await WK.runCold(argv);
      assert.ok(warm, `warm path answered for ${argv[0]}`);
      assert.equal(warm.code, cold.code, `${argv.join(' ')}: same exit code`);
      assert.equal(warm.stdout, cold.stdout, `${argv.join(' ')}: byte-identical stdout`);
    }
    const pidBefore = WK.pid();
    await WK.runWarm(['screen', 'fire', 'desire']);
    assert.ok(
      pidBefore !== null && WK.pid() === pidBefore,
      'the worker persists across requests — the memos live in it'
    );
    WK.kill();
    const after = await WK.runWarm(['screen', 'fire', 'desire']).catch(() => null);
    const afterCold = await WK.runCold(['screen', 'fire', 'desire']);
    assert.ok(
      after && after.stdout === afterCold.stdout,
      'a killed worker respawns and still answers with the cold bytes'
    );
    console.log(
      '  ok  warm worker: byte-identical to cold on the battery, persists, survives a kill'
    );
    passed++;

    // `title` REACHES THE PLAN (MISSING.md M-93), and the only shape that
    // proves it is a DIFFERENCE between runs — accepting a field and
    // dropping it looks identical from the outside. Three runs, because the
    // coordinate moves TWO codes in opposite directions: undeclared leaves
    // the question REFUSED, a title inside the hook answers it YES, and a
    // title outside the hook answers NO and that answer is a FLAG.
    //
    // Every draft line here is `we carry the morning to the <word>` and the
    // blueprint's hook is the draft line at the plan's own hook slot, so
    // `carry the morning` is a contiguous run of words inside it under any
    // seed. Containment is a normalised WORD-subsequence test, not a
    // substring match, which is why the in-hook title is three whole words.
    const titleReport = async (title) => {
      const res = await client.callTool(
        {
          name: 'lyric_grade',
          arguments: title === null ? { seed: planSeed, draft } : { seed: planSeed, draft, title },
        },
        undefined,
        LIVE_OPTS
      );
      assert.ok(!res.isError, `lyric_grade answered without isError (title=${title})`);
      return JSON.parse(res.content[1].text);
    };
    const noTitle = await titleReport(null);
    assert.ok(
      noTitle.report.includes('TITLE_UNDECLARED'),
      'with no title the question is REFUSED, not answered'
    );
    const inHook = await titleReport('carry the morning');
    assert.ok(
      !inHook.report.includes('TITLE_UNDECLARED'),
      'declaring a title REMOVES the refusal — the field is read, not dropped'
    );
    assert.ok(
      !inHook.report.includes('TITLE_NOT_IN_HOOK'),
      'and a title that is a run of words inside the hook answers YES'
    );
    const outOfHook = await titleReport('zzz nowhere');
    assert.ok(
      outOfHook.report.includes('TITLE_NOT_IN_HOOK'),
      'a title outside the hook answers NO'
    );
    assert.equal(
      outOfHook.exit_code,
      3,
      'and that answer is a FLAG (M-86) — the connector can now trip it AND fix it'
    );
    console.log('  ok  lyric_grade live: --title reaches the plan, both directions');
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

    // `structures` REACHES lyric_check (MISSING.md M-103's flag, wired here).
    // Mirrors quality/test_verbs.py §39: the binding assertion is a
    // DIFFERENCE between two runs on ONE draft, because a field accepted and
    // dropped is byte-identical to one never sent.
    const stLines = [
      'the night was cold and bright',
      'we held each other tight',
      'we walked beneath the sun',
      'and rivers ran with silver',
    ];
    const plain = await callText('lyric_check', { lines: stLines, groups: '1,2;3,4' });
    assert.ok(
      plain.report.includes('SCHEME_VIOLATION'),
      'sun/silver is a violation under the default end-rhyme question'
    );
    const structured = await callText('lyric_check', {
      lines: stLines,
      groups: '1,2;3,4',
      structures: 'B:kalevala-alliteration',
    });
    assert.ok(
      !structured.report.includes('SCHEME_VIOLATION'),
      'and NOT one under the declared alliteration — the field is read, not dropped'
    );
    // THE DISCLOSURE IS THE REASON THE FIELD IS SAFE TO EXPOSE. Every
    // declarable row is uncalibrated for English, so the two-tier ban is
    // skipped on the structured group and an absent banned_pairs means the
    // question was not asked.
    assert.ok(
      structured.structures_uncalibrated &&
        structured.structures_uncalibrated.includes('kalevala-alliteration'),
      'the verdict carries structures_uncalibrated, naming the row'
    );
    assert.ok(
      /laziness is NOT/i.test(structured.structures_uncalibrated_meaning || ''),
      'and its meaning says correctness is graded and laziness is not'
    );
    const bogus = await callText('lyric_check', {
      lines: stLines,
      groups: '1,2',
      structures: 'A:vibes',
    });
    assert.equal(bogus.exit_code, 2, 'an unknown row REFUSES rather than defaulting');
    assert.ok(
      bogus.report.includes('not a declared structure') && bogus.report.includes('58 structures'),
      "...through the catalog's own message, with the vocabulary size in it"
    );
    // M-102: both judge the same pairs and the relation would win on every
    // group, so the HARNESS refuses — not a second copy of the rule here.
    const collide = await callText('lyric_check', {
      lines: stLines,
      groups: '1,2;3,4',
      structures: 'B:kalevala-alliteration',
      relation: 'type:pararhyme',
    });
    assert.equal(collide.exit_code, 2, 'a song-wide relation beside a structure REFUSES');
    assert.ok(
      collide.report.includes('song-wide relation') && collide.report.includes('--relations='),
      '...naming the collision and the per-group spelling that expresses the intent'
    );
    console.log('  ok  lyric_check live: --structures reaches the mandate, with its disclosure');
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

    // `lyric_sweep` — the seed search, bounded. The claims this tool makes
    // that nothing else checks are: the bound is real, the windows COMPOSE
    // (which is what makes a bound pagination rather than truncation), the
    // vocabulary description is a checked restatement rather than a second
    // copy, and it does not rank.
    // The predicate is TIGHT so accepted_count > 0 keeps the checks
    // non-vacuous. It does NOT promise to sit under the harness's printed
    // ACCEPTED cap of 40: this comment used to say "240 seeds accept 28
    // here, under the cap", and the 2026-08-28 seed remap (M-52's patter
    // row) moved that to 41 — one over the cap on the spanning window while
    // both halves fit, which is exactly the remembered-rate staleness the
    // two-block check above was rebuilt to end. The membership check below
    // therefore reads the verdict's own truncation disclosure instead of
    // assuming the rate.
    const sweepA = await callText('lyric_sweep', {
      seed_from: 1,
      count: 120,
      want: ['lines>=24', 'lines<=28'],
    });
    assert.equal(sweepA.swept, 120, 'the window is the one that was asked for');
    assert.ok(sweepA.accepted_count > 0, 'and it found seeds, so this check is not vacuous');
    assert.equal(sweepA.window.next_seed_from, 121, 'the next window starts where this one ended');
    const sweepB = await callText('lyric_sweep', {
      seed_from: 121,
      count: 120,
      want: ['lines>=24', 'lines<=28'],
    });
    const sweepAB = await callText('lyric_sweep', {
      seed_from: 1,
      count: 240,
      want: ['lines>=24', 'lines<=28'],
    });
    // COMPOSITION IS THE LOAD-BEARING CLAIM. A plan is a pure function of
    // its seed, so two windows must equal the one that spans them — counts
    // and membership both. Without this the bound is just truncation with a
    // friendly name.
    assert.equal(
      sweepA.accepted_count + sweepB.accepted_count,
      sweepAB.accepted_count,
      'two windows accept exactly what the window spanning them accepts'
    );
    assert.equal(sweepA.planned + sweepB.planned, sweepAB.planned, '...and the planned counts add');
    // MEMBERSHIP, under the disclosed cap. Every shown list is a PREFIX of
    // its window's accepted seeds in seed order, so the span's shown list
    // must be a prefix of its halves' concatenation whatever the cap cuts —
    // strict equality is the cap-free special case, not a separate claim.
    // The flag is charged per window against the two counts it relates, so
    // a truncation can neither hide nor be claimed idly.
    const concatShown = [...sweepA.accepted_shown, ...sweepB.accepted_shown];
    assert.deepEqual(
      concatShown.slice(0, sweepAB.accepted_shown.length),
      sweepAB.accepted_shown,
      '...and the shown seeds are the same, in the same order (the span is a prefix of its halves)'
    );
    for (const [label, w] of [
      ['A', sweepA],
      ['B', sweepB],
      ['AB', sweepAB],
    ])
      assert.equal(
        w.accepted_truncated === true,
        w.accepted_shown.length < w.accepted_count,
        `window ${label}'s truncation flag agrees with its own two counts`
      );
    if (!sweepAB.accepted_truncated)
      assert.equal(
        concatShown.length,
        sweepAB.accepted_shown.length,
        'no truncation claimed, so the halves and the span show identical lists'
      );
    // IT DOES NOT RANK, and the report says so in its own words.
    assert.ok(
      sweepAB.report.includes('does NOT rank') && sweepAB.report.includes('doctrine 19'),
      'the report carries its own not-ranked disclosure'
    );
    for (const k of ['best', 'top', 'score', 'ranked'])
      assert.ok(!(k in sweepAB), `the verdict carries no '${k}' key`);
    assert.deepEqual(
      [...sweepAB.accepted_shown].sort((x, y) => x - y),
      sweepAB.accepted_shown,
      'and the accepted seeds are in seed order'
    );
    // THE BOUND IS REAL AND NAMED.
    const over = await client.callTool(
      { name: 'lyric_sweep', arguments: { seed_from: 1, count: 513 } },
      undefined,
      LIVE_OPTS
    );
    assert.ok(over.isError, 'a window past the ceiling is refused');
    // THE VOCABULARY DESCRIPTION IS CHECKED, NOT TRUSTED. The harness prints
    // the whole closed table when it refuses an undeclared name; every name
    // it lists must appear in this tool's own `want` description, or the
    // description is a second copy that has drifted.
    const bogusWant = await callText('lyric_sweep', {
      seed_from: 1,
      count: 4,
      want: ['zzz<=1'],
    });
    assert.equal(bogusWant.exit_code, 2, 'an undeclared predicate name REFUSES');
    const declared = (bogusWant.report.match(/Declared: ([^.]*)\./) || [])[1];
    assert.ok(declared, 'and the refusal prints the whole declared vocabulary');
    // Read the ADVERTISED schema, not the module's export: what a client
    // sees is what has to agree with the harness, and the SDK rewrites the
    // schema on the way out.
    const sweepTool = tools.find((t) => t.name === 'lyric_sweep');
    const described = sweepTool.inputSchema.properties.want.description || '';
    const missing = declared
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x && !described.includes(x));
    assert.deepEqual(
      missing,
      [],
      `every declared predicate name appears in the tool description (missing: ${missing})`
    );
    // TRUNCATION IS DISCLOSED, NOT SILENT. A no-predicate window accepts
    // every seed that plans, so the printed list is cut at 40 and the count
    // is not — a field holding 40 of N with no flag would be the silent
    // substitution this repo refuses.
    const wide = await callText('lyric_sweep', { seed_from: 1, count: 64 });
    assert.equal(wide.accepted_count, 64, 'with no predicate every seed that plans is accepted');
    assert.ok(wide.accepted_shown.length < wide.accepted_count, 'and the printed list is shorter');
    assert.equal(wide.accepted_truncated, true, '...which the verdict says out loud');
    console.log('  ok  lyric_sweep live: bounded, composes, and does not rank');
    passed++;

    // `lyric_verify` — the other half of a revision round. The claims that
    // needed their own checks are the two that would have been silently
    // wrong under a reused verdictOf: the exit code does NOT carry the
    // verdict, and this verb reports no banned pairs BY CONSTRUCTION.
    //
    // RELATION DECLARED 2026-08-26 (M-116 repin): under the
    // whole-vocabulary default the pour/stone pair SATISFIES — its lines
    // stand in the chain-rhyme schema — so the "violation" these checks
    // revise stopped existing and the fix was correctly rejected as
    // repairing nothing. These are LOOP-MECHANICS checks (accepted,
    // fixed_count, targeted), so they declare class:RHYME, the same
    // narrowing every loop-mechanics fixture in quality/ took: a declared
    // relation silences the vocabulary default (M-126 defers to it), and
    // it also makes `relation` a READ field on this verb rather than a
    // parsed one. Validated at the CLI: violation restored, fix ACCEPTED
    // (fixed 1, changed only [2]), no-op REJECTED, targeted flips the
    // untargeted-rewrite verdict.
    const V_RELATION = 'class:RHYME';
    const vBefore = [
      'Lights cut, and the bass came down in a pour',
      'Half the room gone quiet where the sound stone',
    ];
    const vGood = [vBefore[0], 'Half the room gone quiet where the sound tore'];
    const ok = await callText('lyric_verify', {
      before: vBefore,
      after: vGood,
      groups: '1,2',
      relation: V_RELATION,
    });
    assert.equal(ok.accepted, true, 'a revision that fixes the violation is ACCEPTED');
    assert.equal(ok.fixed_count, 1, '...and the fixed count is reported');
    // THE EXIT CODE IS 0 EITHER WAY. A connector reading exit_code would
    // call a refused revision "no flag stands".
    const bad = await callText('lyric_verify', {
      before: vBefore,
      after: vBefore,
      groups: '1,2',
      relation: V_RELATION,
    });
    assert.equal(bad.accepted, false, 'a no-op revision is REJECTED');
    assert.equal(bad.exit_code, ok.exit_code, 'and BOTH exit with the same code');
    assert.equal(bad.exit_code, 0, '...which is 0 — the verdict is an answer, not an error');
    assert.ok(
      /accepted.*not.*exit_code/i.test(bad.meaning),
      'so the meaning tells the caller to read accepted, not exit_code'
    );
    // IT IS A DIFF AND SAYS SO. verify cannot speak about a defect that
    // survived the change untouched, so it must not carry banned_pairs —
    // an absent banned_pairs here would read as "no banned pairs".
    assert.ok(!('banned_pairs' in ok), 'no banned_pairs field: verify cannot answer that');
    assert.ok(
      /does not report banned pairs/i.test(ok.scope) && /lyric_grade/.test(ok.scope),
      '...and the scope field says so, pointing at the verb that can'
    );
    // TARGETED IS THE SOLE GATE on the untargeted-rewrite rejection, and
    // the only shape that proves it is read is OPPOSITE verdicts on one diff.
    const untargeted = [vGood[0].replace('Lights cut', 'Lights fell'), vGood[1]];
    const free = await callText('lyric_verify', {
      before: vBefore,
      after: untargeted,
      groups: '1,2',
      relation: V_RELATION,
    });
    const scoped = await callText('lyric_verify', {
      before: vBefore,
      after: untargeted,
      groups: '1,2',
      relation: V_RELATION,
      targeted: [2],
    });
    assert.notEqual(
      free.accepted,
      scoped.accepted,
      'declaring targeted changes the verdict on the identical diff — the field is read'
    );
    assert.equal(scoped.accepted, false, '...and the run that named line 2 refuses the L1 rewrite');
    console.log('  ok  lyric_verify live: accepted is the verdict, and targeted is read');
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
