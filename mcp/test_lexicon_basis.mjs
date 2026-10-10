// THE SUPPLEMENT A RUN READS, AND THAT IT KEEPS READING IT (lexicon_basis.js).
//
// Acceptance fixtures for the activation/version seam agreed on PR #519
// (comment 6102572994): new-default grade -> omitted revise; a legacy record
// stays on CMUdict alone under a newer default; explicit mismatches; raw,
// cached-run and session reload; unknown versions and a saved sha256 that is
// not the shipped file's; and the identity every verdict carries. The
// checkpoint path is covered in test_lyric_state.mjs (it needs the kitchen
// writer fixture); the harness's own version refusals in
// lyric-harness/quality/test_lexicon_supplement.py section 12.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { connectConnector } from './client.js';
import { RUNS, LYRIC_TOOL_SCHEMAS, _argvInternals, _verdictInternals } from './lyric_tools.js';
import { decodeState, encodeState } from './state_codec.js';
import { creationRefusal, recordCreation } from './lyric_workflow.js';
import {
  applyLexiconBasis,
  lexiconGlobals,
  LEXICON_CHOICES,
  LEXICON_MANIFEST,
  NONE,
  UNAVAILABLE,
} from './lexicon_basis.js';

const V1 = LEXICON_MANIFEST.versions.find((v) => v.id === 'v1');
const DEFAULT = LEXICON_MANIFEST.versions.find((v) => v.id === LEXICON_MANIFEST.default);
const ZERO = '0'.repeat(64);
const READERS = [
  'lyric_screen',
  'lyric_grade',
  'lyric_revise',
  'lyric_check',
  'lyric_verify',
  'lyric_recover',
];

const verdictOf = (result) => {
  for (const block of result.content || []) {
    try {
      const v = JSON.parse(block.text);
      if (typeof v.exit_code === 'number') return v;
    } catch {
      /* a render block */
    }
  }
  throw Error(
    (result.content || [])
      .map((c) => c.text)
      .join('\n')
      .slice(0, 1500)
  );
};
const text = (result) => (result.content || []).map((c) => c.text).join('\n');

test('the manifest ships v1 at the bytes #522 shipped, and the published choices are its ids', () => {
  assert.equal(V1.sha256, '452d7aae056ed67f6bff94b76bf6f5df66516ce9e1c95d31796d45a8a92957f7');
  assert.deepEqual(LEXICON_CHOICES, [NONE, ...LEXICON_MANIFEST.versions.map((v) => v.id)]);
  for (const name of READERS) {
    const field = LYRIC_TOOL_SCHEMAS[name].lexicon_supplement;
    assert(field, `${name} declares lexicon_supplement`);
    assert.equal(field.parse('v1'), 'v1');
    assert.equal(field.parse(NONE), NONE);
    assert.throws(() => field.parse('v9'), `${name} refuses an unshipped id at the schema`);
    assert(LYRIC_TOOL_SCHEMAS[name].lexicon_supplement_sha256, `${name} carries the sha256`);
  }
  for (const name of ['lyric_sweep', 'lyric_plan'])
    assert.equal(LYRIC_TOOL_SCHEMAS[name]?.lexicon_supplement, undefined, `${name} reads no words`);
});

test('inheritance first, then the default: new work reads the default, a legacy record stays on none', () => {
  const fresh = applyLexiconBasis({});
  assert.equal(fresh.lexicon_supplement, DEFAULT.id);
  assert.equal(fresh.lexicon_supplement_sha256, DEFAULT.sha256);
  const legacy = applyLexiconBasis({}, { continuing: true });
  assert.equal(legacy.lexicon_supplement, NONE);
  assert.equal(legacy.lexicon_supplement_sha256, undefined);
  const carried = applyLexiconBasis(
    { lexicon_supplement: 'v1', lexicon_supplement_sha256: V1.sha256 },
    { continuing: true }
  );
  assert.equal(carried.lexicon_supplement, 'v1');
  const explicitNone = applyLexiconBasis({ lexicon_supplement: NONE });
  assert.equal(explicitNone.lexicon_supplement, NONE);
  assert.deepEqual(lexiconGlobals(explicitNone), []);
  assert.deepEqual(lexiconGlobals(fresh), [
    `--lexicon-supplement=${DEFAULT.id}`,
    `--lexicon-supplement-sha256=${DEFAULT.sha256}`,
  ]);
  // globalsFor resolves the basis before it spells the verb.
  const args = {};
  assert.deepEqual(_argvInternals.globalsFor(args), lexiconGlobals(fresh));
  assert.equal(args.lexicon_supplement, DEFAULT.id);
});

test('an unshipped version or a saved sha256 that is not the shipped file refuses, never substitutes', () => {
  assert.throws(
    () => applyLexiconBasis({ lexicon_supplement: 'v9' }),
    (e) => {
      assert(e.isRefusal);
      assert.match(e.message, new RegExp(`^${UNAVAILABLE}: .*v9.*it ships: v1`));
      return true;
    }
  );
  assert.throws(
    () => applyLexiconBasis({ lexicon_supplement: 'v1', lexicon_supplement_sha256: ZERO }),
    new RegExp(`${UNAVAILABLE}: the run was graded under lexicon supplement v1 with sha256 ${ZERO}`)
  );
  assert.throws(
    () => applyLexiconBasis({ lexicon_supplement: NONE, lexicon_supplement_sha256: V1.sha256 }),
    new RegExp(UNAVAILABLE)
  );
});

test('every verdict names its basis from the authenticated record, null/null for CMUdict alone', () => {
  const record = (lexicon) =>
    _verdictInternals.verdictOf({
      code: 0,
      stdout: '',
      stderr: '',
      lyric_result: { version: 1, status: 'graded', final_draft: ['a'], findings: [], lexicon },
    });
  assert.deepEqual(record({ supplement_id: 'v1', sha256: V1.sha256 }).lexicon, {
    supplement_id: 'v1',
    sha256: V1.sha256,
  });
  assert.deepEqual(record({ supplement_id: null, sha256: null }).lexicon, {
    supplement_id: null,
    sha256: null,
  });
  assert.equal(record({ supplement_id: 'v1', sha256: 'short' }).lexicon, undefined);
  assert.equal(record(undefined).lexicon, undefined);
});

// ── The creation receipt: a grade binds its basis; a revision inherits it ──
function plannedTask() {
  const t = { domain: 'lyrics', phase: 'create' };
  t.workflow = {
    version: 1,
    sweeps: [{ args: { lines: 2 }, accepted: [3] }],
    screen: { words: [], relation: null },
    plan: { sha256: 'p'.repeat(64), request: { seed: 3, lines: 2 }, lines: 2 },
    grade: null,
    started: null,
  };
  return t;
}
const coverage = {
  scope: 'requested_layers',
  pairs_mandated: 0,
  pairs_judged: 0,
  pairs_refused: 0,
  certified: true,
  obligations: [{ id: 'meter:L1', layer: 'meter', status: 'answered' }],
  refused_obligations: [],
};
const draft = ['one line', 'two line'];
const gradeVerdict = (lexicon) => ({
  ..._verdictInternals.verdictOf({
    code: 0,
    stdout: '',
    stderr: '',
    lyric_result: {
      version: 1,
      status: 'graded',
      coverage,
      final_draft: draft,
      findings: [],
      ...(lexicon === undefined ? {} : { lexicon }),
    },
  }),
  plan_sha256: 'p'.repeat(64),
});

test('new-default grade -> omitted revise inherits the graded version and its bytes', () => {
  const t = plannedTask();
  // The grade call omitted the field; the tool applied the default, and the
  // receipt takes what the authenticated record says it read.
  recordCreation(
    t,
    'lyric_grade',
    { seed: 3, draft },
    gradeVerdict({ supplement_id: 'v1', sha256: V1.sha256 })
  );
  assert.equal(t.workflow.grade.readings.lexicon_supplement, 'v1');
  assert.equal(t.workflow.grade.readings.lexicon_supplement_sha256, V1.sha256);
  const args = { seed: 3, draft };
  assert.equal(creationRefusal(t, 'lyric_revise', args), null);
  assert.equal(args.lexicon_supplement, 'v1');
  assert.equal(args.lexicon_supplement_sha256, V1.sha256);
  for (const moved of [{ lexicon_supplement: NONE }, { lexicon_supplement_sha256: ZERO }])
    assert.match(
      creationRefusal(t, 'lyric_revise', { seed: 3, draft, ...moved }),
      /CREATION_GRADE/
    );
  assert.equal(
    creationRefusal(t, 'lyric_revise', { seed: 3, draft, lexicon_supplement: 'v1' }),
    null,
    'restating the graded version is not a move'
  );
});

test('a grade read on CMUdict alone, and a receipt from before the field, revise on none', () => {
  const t = plannedTask();
  recordCreation(
    t,
    'lyric_grade',
    { seed: 3, draft, lexicon_supplement: NONE },
    gradeVerdict({ supplement_id: null, sha256: null })
  );
  const args = { seed: 3, draft };
  assert.equal(creationRefusal(t, 'lyric_revise', args), null);
  assert.equal(
    args.lexicon_supplement,
    NONE,
    'an explicit none, so the tool cannot apply the default'
  );
  // A session snapshot saved before this field existed: its grade receipt has
  // no lexicon readings. Restored, it revises on none under a newer default.
  const legacy = plannedTask();
  recordCreation(
    legacy,
    'lyric_grade',
    { seed: 3, draft },
    gradeVerdict({ supplement_id: 'v1', sha256: V1.sha256 })
  );
  delete legacy.workflow.grade.readings.lexicon_supplement;
  delete legacy.workflow.grade.readings.lexicon_supplement_sha256;
  const restored = JSON.parse(JSON.stringify(legacy));
  const legacyArgs = { seed: 3, draft };
  assert.equal(creationRefusal(restored, 'lyric_revise', legacyArgs), null);
  assert.equal(legacyArgs.lexicon_supplement, NONE);
  assert.match(
    creationRefusal(restored, 'lyric_revise', { seed: 3, draft, lexicon_supplement: 'v1' }),
    /CREATION_GRADE/
  );
});

test('a grade verdict with no authenticated basis records no receipt', () => {
  const t = plannedTask();
  recordCreation(t, 'lyric_grade', { seed: 3, draft }, gradeVerdict(undefined));
  assert.equal(t.workflow.grade, null);
});

// ── The real tools, end to end through the harness ──────────────────────────
const peers = [];
async function connect(name) {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const client = new Client({ name, version: '1' }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  peers.push(client);
  return client;
}
const revise = (client, args) =>
  client.callTool({ name: 'lyric_revise', arguments: args }, undefined, { timeout: 300000 });
const OPEN = {
  scheme: 'AA',
  relation: 'type:rime riche',
  draft: ['Copper cat', 'Azure dog'],
  writer: 'interview',
  max_rounds: 1,
  backtrack: 0,
};

test(
  'raw, cached-run and state continuations keep the recorded basis',
  { timeout: 900000 },
  async () => {
    const c = await connect('lexicon-basis');
    try {
      const first = verdictOf(await revise(c, OPEN));
      assert.equal(first.exit_code, 4, JSON.stringify(first).slice(0, 600));
      assert.deepEqual(first.lexicon, { supplement_id: DEFAULT.id, sha256: DEFAULT.sha256 });
      const rec = RUNS.byId(first.run_id);
      assert.equal(rec.decl.lexicon_supplement, DEFAULT.id);
      assert.equal(rec.decl.lexicon_supplement_sha256, DEFAULT.sha256);
      const saved = decodeState(first.state);
      assert.equal(saved.connector_declarations.lexicon_supplement, DEFAULT.id);
      assert.equal(saved.connector_declarations.lexicon_supplement_sha256, DEFAULT.sha256);

      // Cached run: an explicit other version is a moved declaration.
      const moved = await revise(c, {
        run_id: first.run_id,
        run_revision: first.run_revision,
        lexicon_supplement: NONE,
        answer: 'I hold you.',
      });
      assert.equal(moved.isError, true);
      assert.match(text(moved), /lexicon_supplement/);

      // State, with the cached run forgotten (a restart): carried from the state.
      RUNS.del(first.run_id);
      const fromState = verdictOf(await revise(c, { state: first.state, answer: 'I hold you.' }));
      assert.deepEqual(fromState.lexicon, { supplement_id: DEFAULT.id, sha256: DEFAULT.sha256 });

      // A saved sha256 the shipped file does not have: refused by name.
      const forged = decodeState(first.state);
      forged.connector_declarations.lexicon_supplement_sha256 = ZERO;
      const badHash = await revise(c, { state: encodeState(forged), answer: 'I hold you.' });
      assert.equal(badHash.isError, true);
      assert.match(text(badHash), new RegExp(`${UNAVAILABLE}: the run was graded under`));

      // A version this build does not ship: refused by name, not a schema dump.
      const future = decodeState(first.state);
      future.connector_declarations.lexicon_supplement = 'v9';
      const unknown = await revise(c, { state: encodeState(future), answer: 'I hold you.' });
      assert.equal(unknown.isError, true);
      assert.match(text(unknown), new RegExp(`${UNAVAILABLE}: .*v9`));

      // A state recorded before this field existed stays on CMUdict alone,
      // whatever the default now is, and an explicit version is a move.
      // A state whose connector declarations lost the field while the worker's
      // own record still names v1 is not legacy: the harness refuses it.
      const stripped = decodeState(first.state);
      delete stripped.connector_declarations.lexicon_supplement;
      delete stripped.connector_declarations.lexicon_supplement_sha256;
      assert.equal(stripped.lexicon?.supplement_id, DEFAULT.id, 'the worker state records it');
      const mismatched = await revise(c, {
        state: encodeState(stripped),
        answer: 'I hold you.',
      });
      assert.equal(verdictOf(mismatched).exit_code, 2);
      assert.match(text(mismatched), new RegExp(`${UNAVAILABLE}: this deferred run was started`));
      // A true legacy state carries the field in neither place.
      const legacy = structuredClone(stripped);
      delete legacy.lexicon;
      const legacyWire = encodeState(legacy);
      const upgraded = await revise(c, {
        state: legacyWire,
        lexicon_supplement: DEFAULT.id,
        answer: 'I hold you.',
      });
      assert.equal(upgraded.isError, true);
      assert.match(text(upgraded), /state declarations moved: .*lexicon_supplement/);
      const kept = verdictOf(await revise(c, { state: legacyWire, answer: 'I hold you.' }));
      assert.deepEqual(kept.lexicon, { supplement_id: null, sha256: null });
      assert.equal(decodeState(kept.state).connector_declarations.lexicon_supplement, NONE);
      // Restating what a legacy record means (`none`) is not a moved
      // declaration (3PO's review of #529): absence is normalized first.
      const restated = verdictOf(
        await revise(c, { state: legacyWire, lexicon_supplement: NONE, answer: 'I hold you.' })
      );
      assert.deepEqual(restated.lexicon, { supplement_id: null, sha256: null });
      // The same through a cached run whose record predates the field. The
      // run is continued the way its status asks: an answer to a pending
      // question, or a rewritten draft for a parked one.
      const legacyRun = RUNS.byId(kept.run_id);
      delete legacyRun.decl.lexicon_supplement;
      delete legacyRun.decl.lexicon_supplement_sha256;
      const next = (rev, extra) =>
        revise(c, {
          run_id: kept.run_id,
          run_revision: rev,
          ...(legacyRun.status === 'parked'
            ? { draft: ['Copper cat', 'A copper hat'] }
            : { answer: 'I hold you.' }),
          ...extra,
        });
      const viaRun = await next(kept.run_revision, { lexicon_supplement: NONE });
      assert.notEqual(viaRun.isError, true, text(viaRun).slice(0, 400));
      const continued = verdictOf(viaRun);
      assert.deepEqual(continued.lexicon, { supplement_id: null, sha256: null });
      const movedRun = await next(continued.run_revision ?? kept.run_revision, {
        lexicon_supplement: DEFAULT.id,
      });
      assert.equal(movedRun.isError, true);
      assert.match(text(movedRun), /lexicon_supplement/);
    } finally {
      await c.close();
    }
  }
);

test(
  'session: default grade, snapshot reload, omitted revise reads the graded version',
  { timeout: 900000 },
  async () => {
    const open = async (session) => {
      const server = buildServer({ task: { domain: 'lyrics' } });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await server.connect(a);
      return connectConnector({ task: 'lyrics', transport: b, session });
    };
    let c = await open();
    try {
      const swept = JSON.parse(
        (await c.call('lyric_sweep', { seed_from: 31, count: 1, lines: 12 })).content[0].text
      );
      const seed = swept.accepted_shown[0];
      await c.call('lyric_screen', { words: ['stove', 'coat'] });
      await c.call('lyric_plan', { seed, lines: 12 });
      const lines = Array(12).fill('The kettle whistles by the stove');
      const graded = verdictOf(await c.call('lyric_grade', { seed, draft_text: lines.join('\n') }));
      assert.deepEqual(graded.lexicon, { supplement_id: DEFAULT.id, sha256: DEFAULT.sha256 });
      const session = c.snapshot();
      assert.equal(session.task.workflow.grade.readings.lexicon_supplement, DEFAULT.id);
      assert.equal(session.task.workflow.grade.readings.lexicon_supplement_sha256, DEFAULT.sha256);
      await c.close();

      c = await open(session);
      await assert.rejects(
        c.call('lyric_revise', { seed, draft: lines, lexicon_supplement: NONE }),
        /CREATION_GRADE: lexicon_supplement differs/
      );
      const revised = verdictOf(await c.call('lyric_revise', { seed, draft: lines }));
      assert.deepEqual(revised.lexicon, { supplement_id: DEFAULT.id, sha256: DEFAULT.sha256 });
    } finally {
      await c.close();
    }
  }
);

test.after(async () => {
  for (const p of peers) await p.close().catch(() => {});
});

test('v2 is explicitly selectable while new and saved v1 work keeps v1', () => {
  const v2 = LEXICON_MANIFEST.versions.find((v) => v.id === 'v2');
  assert.equal(v2.sha256, 'bec6e6ddf8522b1f6ffc01bea806ef1ddb71584b2f8630670e8538de4c52fc51');
  assert.equal(LEXICON_MANIFEST.default, 'v1');
  assert.equal(applyLexiconBasis({}).lexicon_supplement, 'v1');
  for (const name of READERS)
    assert.equal(LYRIC_TOOL_SCHEMAS[name].lexicon_supplement.parse('v2'), 'v2');
  const explicit = applyLexiconBasis({ lexicon_supplement: 'v2' });
  assert.deepEqual(lexiconGlobals(explicit), [
    '--lexicon-supplement=v2',
    `--lexicon-supplement-sha256=${v2.sha256}`,
  ]);
  const task = plannedTask();
  recordCreation(
    task,
    'lyric_grade',
    { seed: 3, draft },
    gradeVerdict({ supplement_id: 'v2', sha256: v2.sha256 })
  );
  const next = { seed: 3, draft };
  assert.equal(creationRefusal(task, 'lyric_revise', next), null);
  assert.equal(next.lexicon_supplement, 'v2');
  assert.equal(next.lexicon_supplement_sha256, v2.sha256);
  assert.match(
    creationRefusal(task, 'lyric_revise', { seed: 3, draft, lexicon_supplement: 'v1' }),
    /CREATION_GRADE/
  );
  assert.throws(
    () => applyLexiconBasis({ lexicon_supplement: 'v2', lexicon_supplement_sha256: V1.sha256 }),
    new RegExp(UNAVAILABLE)
  );
});
