// Brief provenance (Refs #665), on the REAL lyric harness: a revise run that
// flagged a line without asking about it, or whose loop replaced a line, keeps
// that line's text across calls and callers, and a later run that changes it
// is refused before anything runs (BRIEF_REQUIRED). The store is reset between
// cases, so no case matches another's song.
//
// The fixture is three one-word lines in one rhyme group: the loop flags L2 and
// L3, asks L2 first (dependent partners are asked serially), and so leaves L3
// flagged without its brief. The answer it accepts for L2 ends on a rhyme of
// the first line.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { BRIEFS, RUNS } from './lyric_tools.js';
import { withExecutionContext } from './execution_context.js';
import { encodeState, decodeState } from './state_codec.js';
import { JobStore } from './job_store.js';
import { WorkflowSessions, verdictOf as sessionVerdict } from './workflow_sessions.js';
import { BRIEF_RETAIN_MS } from './brief_ledger.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUT = ['Cat', 'Dog', 'Sun'];
const FIX = 'I watched the window like a diplomat';
const FIX3 = 'She tumbled down the stairs, an acrobat';
const DECL = {
  scheme: 'AAA',
  relation: 'class:RHYME',
  writer: 'interview',
  attempts: 1,
  backtrack: 0,
  max_rounds: 1,
};
// The same declaration for a draft of another length.
const declFor = (n) => ({ ...DECL, scheme: 'X'.repeat(Math.max(0, n - 3)) + 'AAA' });

const server = buildServer({});
const client = new Client({ name: 'brief-gate', version: '1' }, { capabilities: {} });
const [ct, st] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(st), client.connect(ct)]);
const call = (args) =>
  client.callTool({ name: 'lyric_revise', arguments: args }, undefined, { timeout: 200_000 });
const text = (r) => (r.content || []).map((c) => c.text).join('\n');
function verdict(r) {
  for (const part of r.content || []) {
    try {
      const v = JSON.parse(part.text);
      if (typeof v.exit_code === 'number') return v;
    } catch {
      /* the brief or the song */
    }
  }
  assert.fail(text(r).slice(0, 1500));
}
const refused = (r) => r.isError === true && /BRIEF_REQUIRED/.test(text(r));
// A refusal names line numbers only: none of the song's words.
function assertBrief(r, re) {
  assert.ok(refused(r), text(r).slice(0, 800));
  assert.match(text(r), re);
  assert.match(text(r), /Call lyric_revise with `new_run: true`/);
  for (const line of [...INPUT, FIX, 'Moon', 'Bat'])
    assert.doesNotMatch(text(r), new RegExp(`\\b${line}\\b`), 'no lyric text in a refusal');
}
const admitted = (r) => {
  assert.ok(
    !r.isError && !/BRIEF_(?:REQUIRED|LEDGER_UNAVAILABLE): /.test(text(r)),
    text(r).slice(0, 800)
  );
  return verdict(r);
};
// The opening call: asks L2 and leaves L3 flagged without its brief.
async function opened() {
  const first = verdict(await call({ ...DECL, draft: INPUT }));
  assert.equal(first.exit_code, 4);
  assert.equal(first.asked.line, 2, JSON.stringify(first.asked));
  assert.deepEqual(decodeState(first.state).pass_flagged_lines, [2, 3]);
  return first;
}
// L2 answered and accepted: the loop replaced it, and now asks L3.
async function fixed(first) {
  const second = verdict(await call({ state: first.state, answer: FIX }));
  assert.equal(second.exit_code, 4, JSON.stringify(second).slice(0, 600));
  assert.deepEqual(second.final_draft, [INPUT[0], FIX, INPUT[2]]);
  return second;
}

beforeEach(() => BRIEFS.resetForTests());

test('G2: a flagged line the run did not ask about is refused; the asked line is free', async () => {
  await opened();
  assertBrief(await call({ ...DECL, new_run: true, draft: ['Cat', 'Dog', 'Moon'] }), /line 3 /);
  admitted(await call({ ...DECL, new_run: true, draft: ['Cat', 'Bat', 'Sun'] }));
});

test('G3: putting back a line the loop replaced is refused; another text for it is not', async () => {
  const second = await fixed(await opened());
  const back = await call({ ...DECL, new_run: true, draft: INPUT });
  assertBrief(back, /line 2 puts back a line the loop replaced/);
  // The minted state continued the run (G6's other half): it was admitted.
  assert.ok(second.state);
  admitted(
    await call({ ...DECL, new_run: true, draft: ['Cat', 'I watched the window like a cat', 'Sun'] })
  );
});

test('G1: a park briefs its open lines and their rhyme partners', async () => {
  const parked = verdict(await call({ ...DECL, attempts: 0, draft: ['Cat', 'Dog', 'Sun'] }));
  assert.equal(parked.exit_code, 3, JSON.stringify(parked).slice(0, 600));
  // L2 and L3 are open; L1 is their group partner.
  admitted(await call({ ...DECL, attempts: 0, new_run: true, draft: ['Bat', 'Dog', 'Moon'] }));
});

test('G4: a certified song is forgotten; any edit then starts', async () => {
  const second = await fixed(await opened());
  const done = verdict(await call({ state: second.state, answer: FIX3 }));
  assert.equal(done.exit_code, 0, JSON.stringify(done).slice(0, 600));
  assert.equal(BRIEFS.free.size + BRIEFS.paid.size, 0, 'the song and what it superseded are gone');
  admitted(await call({ ...DECL, new_run: true, draft: INPUT }));
});

test('G5: an inserted line and an unflagged edit start; a removed flagged line is refused', async () => {
  await opened();
  const grown = ['Hello there', 'Bat', 'Dog', 'Sun'];
  admitted(await call({ ...declFor(4), new_run: true, draft: grown }));
  BRIEFS.resetForTests();
  await opened();
  assertBrief(
    await call({ ...DECL, scheme: 'AA', new_run: true, draft: ['Cat', 'Dog'] }),
    /a line removed after line 2/
  );
});

test('G6: a forged state or checkpoint is judged on the lines it carries', async () => {
  const first = await opened();
  const forged = decodeState(first.state);
  forged.accepted_lines = ['Cat', 'Dog', 'Moon'];
  assertBrief(await call({ state: encodeState(forged), answer: FIX }), /line 3 /);
  // A checkpoint (the website chat's journal) with the same hand edit.
  const kitchen = buildServer({ kitchen: true });
  const kc = new Client({ name: 'brief-gate-kitchen', version: '1' }, { capabilities: {} });
  const [x, y] = InMemoryTransport.createLinkedPair();
  await Promise.all([kitchen.connect(y), kc.connect(x)]);
  const key = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = key || 'not-used-the-call-is-refused-first';
  try {
    const checkpoint = encodeState({
      version: 1,
      input_draft: INPUT,
      accepted_lines: ['Cat', 'Dog', 'Moon'],
      proposals: [],
      answered: { propose: [], propose_group: [] },
      status: 'accepted',
    });
    const r = await kc.callTool(
      {
        name: 'lyric_revise',
        arguments: { ...DECL, writer: 'kitchen', draft: INPUT, checkpoint },
      },
      undefined,
      { timeout: 60_000 }
    );
    assertBrief(r, /line 3 /);
  } finally {
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
    await kc.close();
    await kitchen.close();
  }
});

test('G7: a run whose record was lost is still checked by its run_id', async () => {
  const first = await opened();
  assert.ok(first.run_id, 'a declared mandate keeps a run record');
  RUNS.del(first.run_id);
  assertBrief(
    await call({
      run_id: first.run_id,
      run_revision: first.run_revision,
      ...DECL,
      draft: ['Cat', 'Dog', 'Moon'],
    }),
    /line 3 /
  );
});

test('G8: a restart that keeps its runtime directory still refuses', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'brief-gate-'));
  try {
    const script = (draft, newRun) => `
      import { Client } from '@modelcontextprotocol/sdk/client/index.js';
      import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
      import { buildServer } from './tools.js';
      const s = buildServer({});
      const c = new Client({ name: 'g8', version: '1' }, { capabilities: {} });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await Promise.all([s.connect(b), c.connect(a)]);
      const r = await c.callTool({ name: 'lyric_revise', arguments: ${JSON.stringify({
        ...DECL,
        draft,
        ...(newRun ? { new_run: true } : {}),
      })} }, undefined, { timeout: 200000 });
      console.log(JSON.stringify(r.content.map((x) => x.text).join('\\n')));
      await c.close(); await s.close();`;
    const run = async (draft, newRun) => {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        ['--input-type=module', '-e', script(draft, newRun)],
        { cwd: HERE, env: { ...process.env, LYRIC_RUNTIME_DIR: dir }, timeout: 200_000 }
      );
      return JSON.parse(stdout.trim().split('\n').at(-1));
    };
    assert.match(await run(INPUT, false), /AWAITING PROPOSAL/);
    const second = await run(['Cat', 'Dog', 'Moon'], true);
    assert.match(second, /BRIEF_REQUIRED: line 3 /);
    // On disk: digests, never the lines.
    const disk = readFileSync(path.join(dir, 'brief-ledger.json'), 'utf8');
    for (const line of INPUT) assert.doesNotMatch(disk, new RegExp(line));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('G9: after its 3 hours an entry no longer refuses', async () => {
  await opened();
  const now = BRIEFS.now;
  BRIEFS.now = () => Date.now() + BRIEF_RETAIN_MS + 1000;
  try {
    admitted(await call({ ...DECL, new_run: true, draft: ['Cat', 'Dog', 'Moon'] }));
  } finally {
    BRIEFS.now = now;
  }
});

test('G10: a store that cannot be read refuses every run; recover_only still exports', async () => {
  const first = await opened();
  BRIEFS.isHealthy = false;
  BRIEFS.loadFailed = true;
  try {
    const r = await call({ ...DECL, new_run: true, draft: ['Moon', 'Spoon', 'June'] });
    assert.equal(r.isError, true);
    assert.match(text(r), /BRIEF_LEDGER_UNAVAILABLE: .*recover_only: true/);
    const exported = await call({ recover_only: true, state: first.state });
    assert.ok(!exported.isError, text(exported).slice(0, 600));
  } finally {
    BRIEFS.resetForTests();
  }
});

test('G11: an edit session is held to the same rule, and its refusal names the session', async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'brief-gate-sessions-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sessions = new WorkflowSessions({ store: new JobStore(directory) });
  let session_id = sessions.open('lyrics', { phase: 'edit' }).session_id;
  const run = async (name, args) => {
    const q = sessions.submit(session_id, 'lyrics', name, args);
    await sessions.wait(q.operation_id);
    const r = sessions.status(q.operation_id, 'lyrics');
    if (r.session_id) session_id = r.session_id;
    return r;
  };
  const { writer: _w, ...decl } = DECL;
  const opening = await run('lyric_revise', { ...decl, draft: INPUT });
  assert.equal(sessionVerdict(opening.tool_result).exit_code, 4, JSON.stringify(opening));
  const answered = await run('lyric_revise', { answer: FIX });
  assert.equal(sessionVerdict(answered.tool_result).exit_code, 4, JSON.stringify(answered));
  const back = await run('lyric_revise', { ...decl, new_run: true, draft: INPUT });
  const said = back.tool_result.content[0].text;
  assert.match(said, /BRIEF_REQUIRED: line 2 puts back a line the loop replaced/);
  assert.match(
    said,
    /Call lyric_revise with the latest session_id, `new_run: true` and this draft/
  );
  // A restart with no lyrics starts from the song as the run left it (fix
  // included): from the original draft it would be the refusal above.
  const again = await run('lyric_revise', { ...decl, new_run: true });
  assert.ok(!again.tool_error, JSON.stringify(again).slice(0, 800));
  assert.equal(sessionVerdict(again.tool_result).exit_code, 4, JSON.stringify(again));
});

test('G12: a no-op run inherits what the run before it protected', async () => {
  await opened();
  admitted(await call({ ...DECL, new_run: true, draft: INPUT }));
  assert.equal(BRIEFS.free.size, 1, 'the no-op run superseded the first');
  assertBrief(await call({ ...DECL, new_run: true, draft: ['Cat', 'Dog', 'Moon'] }), /line 3 /);
});

test('G13: case, spacing and punctuation are not changes; words are', async () => {
  await opened();
  assertBrief(
    await call({ ...DECL, new_run: true, draft: ['cat!', '  DOG.', 'Moon?'] }),
    /line 3 /
  );
  admitted(await call({ ...DECL, new_run: true, draft: ['cat!', 'Bat', 'SUN...'] }));
});

test('G14: a line holding a reader line break is refused before anything runs', async () => {
  const r = await call({ ...DECL, draft: ['Cat', 'Dog\u0085Day', 'Sun'] });
  assert.equal(r.isError, true);
  assert.match(text(r), /control character/);
});

test('G15: no connector argv asks the harness to skip its own brief check', () => {
  for (const name of readdirSync(HERE))
    if (name.endsWith('.js'))
      assert.doesNotMatch(readFileSync(path.join(HERE, name), 'utf8'), /--unbriefed/, name);
});

test('G16: after a journal_capacity stop, a new run on its final_draft starts', async () => {
  const first = await opened();
  const near = decodeState(first.state);
  near.retained_metadata = 'x'.repeat(1040 * 1024);
  const capacity = verdict(await call({ state: encodeState(near), answer: FIX }));
  assert.equal(capacity.status, 'journal_capacity');
  admitted(await call({ ...DECL, new_run: true, draft: capacity.final_draft }));
});

test('G17: interrupted, recovered, and started again on the recovered lyrics', async () => {
  const first = await opened();
  const controller = new AbortController();
  const stopped = verdict(
    await withExecutionContext(
      {
        signal: controller.signal,
        onCheckpoint(record) {
          if (record.status === 'accepted' && !controller.signal.aborted) controller.abort();
        },
      },
      () => call({ state: first.state, answer: FIX })
    )
  );
  assert.equal(stopped.status, 'interrupted');
  const exported = await call({ recover_only: true, state: stopped.state });
  assert.ok(!exported.isError, text(exported).slice(0, 600));
  admitted(await call({ ...DECL, new_run: true, draft: stopped.final_draft }));
});

test('answer 1: new_run with a run_id and no draft starts from the song as it was left', async () => {
  const second = await fixed(await opened());
  const again = admitted(await call({ new_run: true, run_id: second.run_id, ...DECL }));
  assert.deepEqual(again.replay_draft, second.final_draft);
});

test.after(async () => {
  await client.close();
  await server.close();
});
