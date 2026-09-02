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
      assert.ok(long.length > 9_000, `a 670-group cover is over 9k chars (${long.length})`);
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
      assert.equal(
        AI.carryState(s1, 'lyric_revise', pasted, { exit_code: 3, state: 'S2' }, surface),
        null
      );
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
    // M-186's status label, three words rather than two (2026-09-02): a
    // whole-only exit 3 used to read `stopped_with_open_lines` with
    // `loop_unresolved` 0 — a cause the verdict itself contradicted.
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
      for (const f of ['chat.js', 'gemini_agent.js', '../scripts/flash_battery.mjs']) {
        const src = readFileSync(new URL(f, import.meta.url), 'utf8');
        assert.ok(
          src.includes('loop_whole_flag_codes'),
          `${f} carries the whole-flag codes beside loop_unresolved`
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
    assert.deepEqual(
      suspended,
      { key: 'seed:7', seed: 7, state: 'S1' },
      'exit 4 carries the record'
    );
    assert.equal(
      carryState(suspended, 'lyric_revise', args, { exit_code: 3, state: 'S2' }, surface),
      null,
      'exit 3 is COMPLETE: the record is not carried, even though the verdict carries one'
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
  check('one tool budget, four readers — the pin, the default, the client clock, the kill', () => {
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
    assert.ok(y, 'render.yaml pins the deployed value — the battery derives its deadline from it');
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
  });
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
      assert.equal(r.status, 0, `the driver survives its transport failing: ${r.stderr}`);
      const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
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
    // an explicit 300s RequestOptions timeout. This is the TEST's clock
    // only: production clients keep the SDK default, and the sweep-window
    // budget in lyric_tools.js is still derived against 60s on purpose.
    const LIVE_OPTS = { timeout: 300_000 };
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
    const gradedRes = await client.callTool(
      { name: 'lyric_grade', arguments: { seed: planSeed, draft } },
      undefined,
      LIVE_OPTS
    );
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
