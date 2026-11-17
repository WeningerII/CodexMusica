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
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { BRIEFS, READER_CONTROLS, RUNS, briefGradeNext } from './lyric_tools.js';
import { buildWorkflowServer } from './workflow_tools.js';
import { withExecutionContext } from './execution_context.js';
import { encodeState, decodeState } from './state_codec.js';
import { JobStore } from './job_store.js';
import {
  WorkflowSessions,
  briefNote,
  keepLeftSong,
  executeNative,
  verdictOf as sessionVerdict,
} from './workflow_sessions.js';
import { CONNECTOR_CONTRACT_VERSION } from './contract_version.js';
import { continuationSemanticIdentity } from './state_codec.js';
import { BRIEF_RETAIN_MS } from './brief_ledger.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUT = ['Cat', 'Dog', 'Sun'];
// The accepted answers are drawn by seed: four filler tokens and an end word
// from a table of rhymes for INPUT[0] (one-syllable rhymes of it would be
// refused as a prohibited pair, so the table is of longer words). FIX ends
// on another word than FIX3, so the two answers do not repeat an end word.
const FILLER = ['blue', 'stone', 'river', 'paper', 'window', 'silver', 'garden', 'candle'];
const RHYMES = ['diplomat', 'acrobat', 'habitat', 'thermostat', 'aristocrat', 'democrat'];
const draw = (seed, k, n) =>
  parseInt(
    createHash('sha256')
      .update(JSON.stringify([seed, k]))
      .digest('hex')
      .slice(0, 8),
    16
  ) % n;
const seededLine = (seed, end) =>
  [0, 1, 2, 3].map((k) => FILLER[draw(seed, k, FILLER.length)]).join(' ') + ' ' + RHYMES[end];
const FIX = seededLine(2, draw(2, 'end', RHYMES.length));
const FIX3 = seededLine(3, (draw(2, 'end', RHYMES.length) + 1) % RHYMES.length);
// Another text for line 2 than the one the loop accepted.
const OTHER2 = seededLine(4, (draw(2, 'end', RHYMES.length) + 2) % RHYMES.length);
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
  admitted(await call({ ...DECL, new_run: true, draft: ['Cat', OTHER2, 'Sun'] }));
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
  // A file that is not JSON: re-reading it fails again.
  const dir = mkdtempSync(path.join(tmpdir(), 'brief-gate-bad-'));
  const bad = path.join(dir, 'brief-ledger.json');
  writeFileSync(bad, '{not json');
  const file = BRIEFS.file;
  BRIEFS.file = bad;
  BRIEFS.isHealthy = false;
  BRIEFS.loadFailed = true;
  try {
    const r = await call({ ...DECL, new_run: true, draft: ['Moon', 'Spoon', 'June'] });
    assert.equal(r.isError, true);
    assert.match(text(r), /BRIEF_LEDGER_UNAVAILABLE: .*recover_only: true/);
    const exported = await call({ recover_only: true, state: first.state });
    assert.ok(!exported.isError, text(exported).slice(0, 600));
  } finally {
    BRIEFS.file = file;
    BRIEFS.resetForTests();
    rmSync(dir, { recursive: true, force: true });
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
  assert.equal(
    [...BRIEFS.free.values()].filter((e) => !e.retired).length,
    1,
    'the no-op run superseded the first'
  );
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

test('G14: a line holding a control character the reader treats otherwise is refused', async () => {
  // The table says what the Python reader does with each character: split
  // the line on it, or (every row) strip it from the line's ends. Every
  // character it splits on is in the table or refused as a line break.
  const py = await new Promise((resolve, reject) => {
    const child = execFile(
      'python3',
      [
        '-c',
        'import json,sys\n' +
          'rows=[[len(("a"+c+"b").splitlines())==2,(c+"a"+c).strip()=="a"] for c in json.load(sys.stdin)]\n' +
          'split=[n for n in range(0x110000) if len(("a"+chr(n)+"b").splitlines())==2]\n' +
          'print(json.dumps({"rows":rows,"split":split}))',
      ],
      (err, out) => (err ? reject(err) : resolve(JSON.parse(out)))
    );
    child.stdin.end(JSON.stringify(READER_CONTROLS.map((row) => row.ch)));
  });
  assert.deepEqual(
    py.rows,
    READER_CONTROLS.map((row) => [row.split, true])
  );
  const breaks = [0x0a, 0x0d, 0x2028, 0x2029]; // refused as a line break
  assert.deepEqual(
    py.split.filter((n) => !breaks.includes(n)),
    READER_CONTROLS.filter((row) => row.split).map((row) => row.ch.codePointAt(0))
  );
  for (const row of READER_CONTROLS)
    // A trailing one is checked where JS .trim() keeps it: a trimmed one
    // never reaches the reader.
    for (const line of [`Dog${row.ch}Day`, ...(row.ch.trim() ? [`Dog${row.ch}`] : [])]) {
      const r = await call({ ...DECL, draft: ['Cat', line, 'Sun'] });
      assert.equal(r.isError, true, row.name);
      assert.ok(text(r).includes(`control character (${row.name})`), text(r));
      assert.match(
        text(r),
        row.split ? /the reader takes as a line break/ : /the reader strips from the ends of a line/
      );
    }
});

// Andrej's review G2: under scheme XAA the loop asks about line 3 for its own
// flag. That is not line 3's brief under AAA, so the run that protects it
// stays, and the hand edit under AAA is still refused.
test('a run under other declarations does not free a protected line', async () => {
  await opened();
  const lax = verdict(
    await call({ ...DECL, scheme: 'XAA', new_run: true, draft: ['Cat', 'Fun', 'Sun'] })
  );
  assert.equal(lax.asked?.line, 3, JSON.stringify(lax).slice(0, 600));
  assertBrief(await call({ ...DECL, new_run: true, draft: ['Cat', 'Dog', 'Moon'] }), /line 3 /);
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
  // That padded state is not one this server returned, and a state it did
  // not return is refused for a song a live run knows (G18): the store is
  // emptied so the padding reaches the harness.
  BRIEFS.resetForTests();
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

test('G18: a forged journal is refused for a song a live run knows, so its records brief nothing', async () => {
  const first = await opened();
  const forged = decodeState(first.state);
  // An answer record claiming line 3 was asked on this very draft.
  const fp = createHash('md5').update(INPUT.join('\n')).digest('hex').slice(0, 12);
  forged.answered = {
    ...forged.answered,
    propose: [...(forged.answered?.propose || []), { line: 3, text: 'Moon', draft: fp }],
  };
  const r = await call({ state: encodeState(forged), answer: FIX });
  assert.ok(refused(r), text(r).slice(0, 800));
  assert.match(text(r), /not one this server returned/);
  // Andrej's item 9: it says what the entry holds, and, as this call sent only
  // a state, names the song to send rather than "this draft".
  assert.match(text(r), /keeps lines it flagged without asking about them, so/);
  assert.doesNotMatch(text(r), /replaced/);
  assert.match(
    text(r),
    /`new_run: true` and, as `draft_text`, the song this state or checkpoint holds/
  );
  assert.doesNotMatch(text(r), /this draft/);
  for (const line of [...INPUT, FIX, 'Moon'])
    assert.doesNotMatch(text(r), new RegExp(`\\b${line}\\b`), 'no lyric text in a refusal');
  // Line 3 is still protected.
  assertBrief(await call({ ...DECL, new_run: true, draft: ['Cat', 'Dog', 'Moon'] }), /line 3 /);
});

test('G19: a run set aside while another run on the song fixed a line still continues', async () => {
  const a = await opened();
  const b = verdict(await call({ ...DECL, new_run: true, draft: INPUT }));
  assert.equal(b.exit_code, 4);
  await fixed(b);
  // The first run's own state answers its own question.
  const resumed = admitted(await call({ state: a.state, answer: FIX }));
  assert.equal(resumed.exit_code, 4, JSON.stringify(resumed).slice(0, 600));
});

test('G20: in a session for a new song the refusal grades the draft before the revise', () => {
  const raw =
    'BRIEF_REQUIRED: line 4 changes a line the revise loop flagged without giving its brief. Nothing was run. Lines this draft may change: 1-3. Call lyric_revise with `new_run: true` and this draft with line 4 as the last lyric_revise returned it.';
  assert.match(
    briefNote(raw, { phase: 'create' }),
    /Grade this draft with line 4 as the last lyric_revise returned it with lyric_grade, then call lyric_revise with that exact draft, the latest session_id and `new_run: true`\.$/
  );
  assert.match(
    briefNote(raw, { phase: 'edit' }),
    /Call lyric_revise with the latest session_id, `new_run: true` and this draft with line 4/
  );
  // Andrej's item 7: three or more lines are named as "3, 5 and 7", and the
  // whole fix clause, commas included, moves in front of lyric_grade.
  const many = (fix) =>
    `BRIEF_REQUIRED: lines 3, 5 and 7 change lines the revise loop flagged without giving their brief. Nothing was run. Lines this draft may change: 1-2, 4, 6, 8. Call lyric_revise with \`new_run: true\` and this draft with ${fix}.`;
  for (const fix of [
    'lines 3, 5 and 7 as the last lyric_revise returned them',
    'lines 3, 5 and 7 as the last lyric_revise returned them and the removed line(s) put back',
    'lines 2, 3, 5, 7 and 9 as the last lyric_revise returned them',
  ])
    assert.equal(
      briefNote(many(fix), { phase: 'create' }).slice(
        briefNote(many(fix), { phase: 'create' }).indexOf('Grade this draft')
      ),
      `Grade this draft with ${fix} with lyric_grade, then call lyric_revise with that exact draft, the latest session_id and \`new_run: true\`.`
    );
});

// Andrej's items 14 and 22: the song a revision left, kept per phase and
// moved only by a lyric_check or lyric_recover that ran on other lines.
test('an edit session keeps the left song; a new song session does not keep a second copy', () => {
  const song = ['Cat', 'Dog', 'Sun'];
  const v = (extra = {}) => ({
    content: [{ type: 'text', text: JSON.stringify({ exit_code: 3, ...extra }) }],
  });
  const ran = (name, args, value = {}, isError = false) => {
    const next = { task: { domain: 'lyrics', phase: 'edit' }, left_draft: [...song] };
    keepLeftSong(next, name, args, isError ? { ...v(value), isError } : v(value), {
      exit_code: 3,
      ...value,
    });
    return next.left_draft;
  };
  // A create session's revise leaves no session copy; an edit session's does.
  const create = { task: { domain: 'lyrics', phase: 'create' } };
  keepLeftSong(create, 'lyric_revise', {}, v(), { exit_code: 3, final_draft: song });
  assert.equal(create.left_draft, undefined);
  const edit = { task: { domain: 'lyrics', phase: 'edit' } };
  keepLeftSong(edit, 'lyric_revise', {}, v(), { exit_code: 3, final_draft: song });
  assert.deepEqual(edit.left_draft, song);
  // The same lines, in either spelling the tool takes: kept.
  assert.deepEqual(ran('lyric_check', { lines: [' Cat ', 'Dog', 'Sun'] }), song);
  assert.deepEqual(ran('lyric_check', { lines_text: 'Cat\nDog\nSun\n' }), song);
  // lyric_recover keeps structure rows; its sung lines are the song.
  assert.deepEqual(
    ran('lyric_recover', { lines: ['[VERSE]', 'Cat', 'Dog', 'Sun'] }, { lines: song }),
    song
  );
  // Other lines: dropped. A refused call: kept.
  assert.equal(ran('lyric_check', { lines: ['Cat', 'Dog', 'Bun'] }), null);
  assert.equal(ran('lyric_recover', { lines: ['Cat'] }, { lines: ['Cat'] }), null);
  assert.deepEqual(ran('lyric_check', { lines: ['Cat', 'Dog', 'Bun'] }, {}, true), song);
});

test('G21: an edit session that checks other lines has no left song to restart from', async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'brief-gate-left-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sessions = new WorkflowSessions({ store: new JobStore(directory) });
  const { writer: _w, ...decl } = DECL;
  const open = async () => {
    let session_id = sessions.open('lyrics', { phase: 'edit' }).session_id;
    const run = async (name, args) => {
      const q = sessions.submit(session_id, 'lyrics', name, args);
      await sessions.wait(q.operation_id);
      const r = sessions.status(q.operation_id, 'lyrics');
      if (r.session_id) session_id = r.session_id;
      return r;
    };
    const opening = await run('lyric_revise', { ...decl, draft: INPUT });
    assert.equal(sessionVerdict(opening.tool_result).exit_code, 4, JSON.stringify(opening));
    return run;
  };
  const checked = (r) => {
    const said = JSON.stringify(r);
    assert.ok(!r.tool_error && !r.tool_result?.isError, said.slice(0, 800));
    assert.equal(typeof sessionVerdict(r.tool_result).exit_code, 'number', said.slice(0, 800));
  };
  // Other lines checked: the restart with no draft has no song to start from.
  let run = await open();
  checked(
    await run('lyric_check', {
      scheme: 'AAA',
      relation: 'class:RHYME',
      lines: ['Fig', 'Jar', 'Hut'],
    })
  );
  const again = await run('lyric_revise', { ...decl, new_run: true });
  const said = JSON.stringify(again);
  assert.ok(again.tool_error || again.tool_result?.isError, said.slice(0, 800));
  assert.doesNotMatch(said, /AWAITING PROPOSAL/, 'the earlier song is not revised');
  // The same lines checked: the restart starts from the song the revision left.
  BRIEFS.resetForTests();
  run = await open();
  checked(await run('lyric_check', { scheme: 'AAA', relation: 'class:RHYME', lines: INPUT }));
  const kept = await run('lyric_revise', { ...decl, new_run: true });
  const keptSaid = JSON.stringify(kept);
  assert.ok(!kept.tool_error && !kept.tool_result?.isError, keptSaid.slice(0, 800));
  assert.equal(sessionVerdict(kept.tool_result).exit_code, 4, keptSaid.slice(0, 800));
});

// Andrej's item 18: a grade whose revise the brief gate would refuse names
// the lines to put back, and no call.
test("a grade's next names the lines a live revise run keeps, and drops its call", async () => {
  const song = ['Cat', 'Dog', 'Sun', 'Fig'];
  await BRIEFS.capture({ runId: 'grade-next', cur: song, input: song, flagged: [2] });
  const graded = () => ({
    exit_code: 3,
    next_call: { tool: 'lyric_revise', args: { seed: 7 } },
    next: 'Call lyric_revise with this exact draft.',
  });
  const same = briefGradeNext(graded(), [...song]);
  assert.deepEqual(same.next_call, { tool: 'lyric_revise', args: { seed: 7 } });
  const changed = briefGradeNext(graded(), ['Cat', 'Hut', 'Sun', 'Fig']);
  assert.equal(changed.next_call, undefined);
  assert.match(changed.next, /^lyric_revise refuses this draft before it runs \(BRIEF_REQUIRED\)/);
  assert.match(
    changed.next,
    /Put back line 2 as the last lyric_revise returned it, grade that draft with lyric_grade/
  );
  assert.match(changed.next, /Lines this draft may change: 1, 3-4\.$/);
  for (const word of ['Cat', 'Dog', 'Hut', 'Sun', 'Fig'])
    assert.doesNotMatch(changed.next, new RegExp(`\\b${word}\\b`), 'no lyric text');
});

// Andrej's item 16: a session carries the run, and refuses `run_id` beside a
// session_id, so its lyric_revise description does not tell a caller to send it.
test('the session lyric_revise descriptions do not ask for the run_id', async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'brief-gate-surface-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sessions = new WorkflowSessions({ store: new JobStore(directory) });
  const described = async (opts) => {
    const s = await buildWorkflowServer({ sessions, ...opts });
    const c = new Client({ name: 'brief-gate-surface', version: '1' }, { capabilities: {} });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([s.connect(a), c.connect(b)]);
    try {
      return (await c.listTools()).tools.find((x) => x.name === 'lyric_revise').description;
    } finally {
      await c.close();
      await s.close();
    }
  };
  const session = await described({ domain: 'lyrics' });
  assert.doesNotMatch(session, /run_id starts from/);
  assert.match(
    session,
    /`new_run: true` with no draft and the latest session_id starts from the song as the last lyric_revise left it/
  );
  const shared = await described({ compatibility: true });
  assert.match(shared, /with no draft and the latest session_id starts from the song/);
  assert.match(
    shared,
    /without session_id: with no draft and the run_id, the song as that run left it/
  );
});

// Andrej's item 1, the chat's half. The fixture is deterministic and the run
// ledger refuses a record that was already continued, so this resumes from
// another record than G22 does.
test('G23: the chat recovered envelope continues an interrupted run', async (t) => {
  const first = await opened();
  const records = [];
  const parked = verdict(
    await withExecutionContext({ onCheckpoint: (record) => records.push(record) }, () =>
      call({ state: first.state, answer: FIX })
    )
  );
  assert.equal(parked.exit_code, 4, JSON.stringify(parked).slice(0, 600));
  // The process dies just after the fix is accepted: the first record that
  // holds it is the last one saved. (G22 resumes from the run's last record.)
  const last = records.find((x) => x.status === 'accepted');
  assert.deepEqual(last.accepted_lines, [INPUT[0], FIX, INPUT[2]]);
  assert.notDeepEqual(last, records.at(-1));
  // The chat router, as a restarted process builds it.
  const secret = 'brief-gate-chat-fixture-secret';
  const previous = process.env.CHAT_SECRET;
  let createChatRouter;
  try {
    process.env.CHAT_SECRET = secret;
    ({ createChatRouter } = await import('./chat.js?brief-gate-recovery'));
  } finally {
    if (previous === undefined) delete process.env.CHAT_SECRET;
    else process.env.CHAT_SECRET = previous;
  }
  const router = await createChatRouter({
    buildServer: () => buildServer({}),
    Client,
    InMemoryTransport,
    apiKey: 'offline',
  });
  const directory = mkdtempSync(path.join(tmpdir(), 'brief-gate-chat-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = new JobStore(directory);
  const id = createHash('sha256').update('brief-gate-chat').digest('hex');
  store.begin(id, { request_id: id, message: 'revise' });
  const envelope = {
    history: [],
    workspace: null,
    task: {
      version: CONNECTOR_CONTRACT_VERSION,
      domain: 'lyrics',
      format: 'rich',
      maxChars: 1000,
      brief: 'brief',
      phase: 'edit',
      completedSteps: [],
      turns: 0,
      connector_semantic_identity: continuationSemanticIdentity(),
    },
  };
  const { createHmac } = await import('node:crypto');
  store.checkpoint(id, {
    ...envelope,
    sig: createHmac('sha256', secret).update(JSON.stringify(envelope)).digest('hex'),
  });
  store.checkpoint(id, last);
  const recovered = router.recoverCheckpoint(new JobStore(directory).get(id));
  assert.ok(recovered?.lyric?.state, JSON.stringify(recovered).slice(0, 800));
  assert.equal(recovered.lyric.resumable, true);
  const r = await call({
    ...recovered.lyric.decl,
    draft: recovered.lyric.draft,
    state: recovered.lyric.state,
  });
  assert.doesNotMatch(text(r), /BRIEF_REQUIRED/, text(r).slice(0, 800));
  assert.equal(typeof verdict(r).exit_code, 'number');
});

// Andrej's item 1: a lyric_revise that accepts a fix and loses its result is
// resumed from its last saved progress record, which this server recorded.
test('G22: a session resumes an interrupted run from its progress record', async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'brief-gate-resume-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let lose = false;
  const sessions = new WorkflowSessions({
    store: new JobStore(directory),
    execute: async (...args) => {
      const out = await executeNative(...args);
      if (lose) {
        lose = false;
        throw new Error('lost result');
      }
      return out;
    },
  });
  let session_id = sessions.open('lyrics', { phase: 'edit' }).session_id;
  const run = async (name, args) => {
    const q = sessions.submit(session_id, 'lyrics', name, args);
    await sessions.wait(q.operation_id);
    const r = sessions.status(q.operation_id, 'lyrics');
    if (r.session_id) session_id = r.session_id;
    return { q, r };
  };
  const { writer: _w, ...decl } = DECL;
  const opening = (await run('lyric_revise', { ...decl, draft: INPUT })).r;
  assert.equal(sessionVerdict(opening.tool_result).exit_code, 4, JSON.stringify(opening));
  lose = true;
  const { q, r: lost } = await run('lyric_revise', { answer: FIX });
  assert.equal(lost.resumable, true, JSON.stringify(lost).slice(0, 800));
  assert.deepEqual(lost.accepted_draft, [INPUT[0], FIX, INPUT[2]]);
  const resumed = sessions.resume(q.operation_id, 'lyrics');
  await sessions.wait(resumed.operation_id);
  const after = sessions.status(resumed.operation_id, 'lyrics');
  const said = JSON.stringify(after);
  assert.doesNotMatch(said, /BRIEF_REQUIRED/, said.slice(0, 800));
  assert.ok(!after.tool_error && !after.tool_result?.isError, said.slice(0, 800));
  assert.equal(typeof sessionVerdict(after.tool_result).exit_code, 'number', said.slice(0, 800));
});

test('the lyric_revise descriptions state the same-song rule at half', async () => {
  const { tools } = await client.listTools();
  const revise = tools.find((x) => x.name === 'lyric_revise');
  const said = [
    revise.description,
    ...Object.values(revise.inputSchema.properties || {}).map((p) => p.description || ''),
  ].join(' ');
  assert.match(said, /half or more of its lines are rewritten/);
  assert.doesNotMatch(said, /more than half its lines/);
});

test.after(async () => {
  await client.close();
  await server.close();
});
