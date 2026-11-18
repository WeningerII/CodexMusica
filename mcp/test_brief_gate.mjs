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
import { BRIEFS, BRIEF_WIRE_SONG, READER_CONTROLS, RUNS, briefGradeNext } from './lyric_tools.js';
import { buildWorkflowServer } from './workflow_tools.js';
import { withExecutionContext } from './execution_context.js';
import { encodeState, decodeState } from './state_codec.js';
import { JobStore } from './job_store.js';
import {
  WorkflowSessions,
  briefNote,
  keepLeftSong,
  executeNative,
  publicToolResult,
  receiptOutcome,
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
// Seeded filler alone: a line that ends on no rhyme word.
const fillerLine = (seed, n) =>
  Array.from({ length: n }, (_, k) => FILLER[draw(seed, k, FILLER.length)]).join(' ');
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

// The ledger on a file, for a case that restarts it. -> a reader of the file.
function ledgerOnDisk(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'brief-gate-ledger-'));
  const file = BRIEFS.file;
  BRIEFS.file = path.join(dir, 'brief-ledger.json');
  t.after(() => {
    clearTimeout(BRIEFS.saveTimer);
    BRIEFS.saveTimer = null;
    BRIEFS.file = file;
    BRIEFS.resetForTests();
    rmSync(dir, { recursive: true, force: true });
  });
  return () => readFileSync(BRIEFS.file, 'utf8');
}
// A restart, as the ledger sees one: its file is read back as it stood at
// `disk` (what was captured after that never reached it), and the run cache
// is empty.
function restartLedger(disk) {
  clearTimeout(BRIEFS.saveTimer);
  BRIEFS.saveTimer = null;
  writeFileSync(BRIEFS.file, disk);
  BRIEFS.clear();
  BRIEFS.load();
  assert.equal(BRIEFS.healthy, true);
  for (const id of [...RUNS.map.keys()]) RUNS.del(id);
}

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
  // The run's entry holds the two states it returned and no progress record's.
  assert.deepEqual(
    [...BRIEFS.free.values()].map((e) => e.wires.length),
    [2]
  );
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
  const grown = [fillerLine(5, 2), 'Bat', 'Dog', 'Sun'];
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
  // character it splits on is in the table or refused as a line break, and
  // every one it strips that JS keeps is in the table.
  const py = await new Promise((resolve, reject) => {
    const child = execFile(
      'python3',
      [
        '-c',
        'import json,sys\n' +
          'rows=[[len(("a"+c+"b").splitlines())==2,(c+"a"+c).strip()=="a"] for c in json.load(sys.stdin)]\n' +
          'split=[n for n in range(0x110000) if len(("a"+chr(n)+"b").splitlines())==2]\n' +
          'strip=[n for n in range(0x110000) if ("a"+chr(n)).strip()=="a"]\n' +
          'print(json.dumps({"rows":rows,"split":split,"strip":strip}))',
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
  // Every character the reader strips from a line's end that JS .trim()
  // keeps, and that is not a split row, is a strip-only row.
  assert.deepEqual(
    py.strip.filter(
      (n) => String.fromCodePoint(n).trim() !== '' && !py.split.includes(n) && !breaks.includes(n)
    ),
    READER_CONTROLS.filter((row) => !row.split).map((row) => row.ch.codePointAt(0))
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

// Round 2, item 2 (owner, 18 Nov): protection ends when the flag clears. Five
// lines in two rhyme groups: the loop flags L2, L3 and L5 and asks L2 and L5
// together, so L3 is flagged without its brief. The answer it accepts for L2
// rhymes with L1 and L3, which clears L3's flag; the answer for L5 is not
// accepted, and the run stops with L5 open. L3 carries no flag any more.
test('a line whose flag a fix cleared is no longer protected', async () => {
  const song = [RHYMES[1], 'Dog', RHYMES[0], 'Sun', 'Fig'];
  const decl = { ...DECL, scheme: 'AAABB' };
  const hand = (draft, n) => draft.map((l, i) => (i === n - 1 ? 'Jar' : l));
  const first = verdict(await call({ ...decl, draft: song }));
  assert.equal(first.exit_code, 4, JSON.stringify(first).slice(0, 600));
  assert.deepEqual(first.asked.lines, [2, 5], JSON.stringify(first.asked));
  assert.deepEqual(decodeState(first.state).pass_flagged_lines, [2, 3, 5]);
  // While L3 carries its flag, it keeps its text.
  assertBrief(await call({ ...decl, new_run: true, draft: hand(song, 3) }), /line 3 /);
  const answer2 = seededLine(6, 2);
  const parked = verdict(
    await call({
      state: first.state,
      answers: [
        { line: 2, text: answer2 },
        { line: 5, text: fillerLine(7, 5) },
      ],
    })
  );
  assert.equal(parked.exit_code, 3, JSON.stringify(parked).slice(0, 600));
  assert.deepEqual(parked.final_draft, [song[0], answer2, ...song.slice(2)]);
  // L3 as the run left it, changed by hand: its flag cleared, so this starts.
  admitted(await call({ ...decl, new_run: true, draft: hand(parked.final_draft, 3) }));
});

// Read off the ledger at the progress records that publish no flag set (the
// ones before a pass opens, and the last one of a run that stops): unknown,
// never empty. What was protected stays protected there, and a line whose
// flag cleared is not protected again from the set the call started with.
test('a progress record that publishes no flags keeps what is protected and brings nothing back', async () => {
  // The protected lines of the live entries at each record with no flag set.
  const unknownAt = async (args) => {
    const seen = [];
    const out = verdict(
      await withExecutionContext(
        {
          onCheckpoint: (record) => {
            if (!Array.isArray(record.pass_flagged_lines))
              seen.push([...BRIEFS.free.values()].filter((e) => !e.retired).map((e) => e.prot));
          },
        },
        () => call(args)
      )
    );
    assert.ok(seen.length > 0, 'a record with no flag set was stored');
    return { seen, out };
  };
  // A new run on a song whose earlier run protects line 3: before its pass
  // opens it knows no flags, and line 3 stays protected throughout.
  await opened();
  const again = await unknownAt({ ...DECL, new_run: true, draft: INPUT });
  assert.equal(again.out.exit_code, 4, JSON.stringify(again.out).slice(0, 600));
  for (const prot of again.seen) assert.deepEqual(prot, [[3]]);
  // The five-line song above: the call starts with L3 protected, the accepted
  // answer for L2 clears L3's flag, and the run's last record knows no flags.
  BRIEFS.resetForTests();
  const song = [RHYMES[1], 'Dog', RHYMES[0], 'Sun', 'Fig'];
  const first = verdict(await call({ ...DECL, scheme: 'AAABB', draft: song }));
  assert.deepEqual(first.asked?.lines, [2, 5], JSON.stringify(first).slice(0, 600));
  assert.deepEqual(
    [...BRIEFS.free.values()].map((e) => e.prot),
    [[3]]
  );
  const cleared = await unknownAt({
    state: first.state,
    answers: [
      { line: 2, text: seededLine(6, 2) },
      { line: 5, text: fillerLine(7, 5) },
    ],
  });
  assert.equal(cleared.out.exit_code, 3, JSON.stringify(cleared.out).slice(0, 600));
  assert.deepEqual(cleared.seen.at(-1), [[]]);
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

// Round 2, item 5 (Andrej's item 9): beside a state the caller's draft is the
// run's opening draft. "This draft" is named only where the caller sent it
// and the run replaced no line of it; otherwise the refusal names the song
// the state holds, which is the song the check passed.
test('a forged-wire refusal names "this draft" only for a draft the caller sent that puts nothing back', async () => {
  const forge = (state) => encodeState({ ...decodeState(state), retained_note: 'x' });
  const first = await opened();
  // The run protects line 3 and replaced nothing; the caller sent the draft.
  const sent = await call({ ...DECL, draft: INPUT, state: forge(first.state), answer: FIX });
  assert.ok(refused(sent), text(sent).slice(0, 800));
  assert.match(text(sent), /not one this server returned/);
  assert.match(
    text(sent),
    /Call lyric_revise with `new_run: true` and this draft, or continue with the state or checkpoint the last lyric_revise returned\.$/
  );
  // The loop replaces line 2: the draft beside the state now holds the old
  // line, and a new run on it is refused (G3), so it is not what is named.
  const second = await fixed(first);
  const moved = await call({ ...DECL, draft: INPUT, state: forge(second.state), answer: FIX3 });
  assert.ok(refused(moved), text(moved).slice(0, 800));
  assert.match(text(moved), /keeps lines its loop replaced from coming back, so/);
  assert.doesNotMatch(text(moved), /this draft/);
  assert.ok(text(moved).endsWith(BRIEF_WIRE_SONG), text(moved));
  for (const line of [...INPUT, FIX])
    assert.doesNotMatch(text(moved), new RegExp(`\\b${line}\\b`), 'no lyric text in a refusal');
  // The call it names starts: the song that state holds, as draft_text.
  admitted(await call({ ...DECL, new_run: true, draft_text: second.final_draft.join('\n') }));
});

// The same refusal in a session, which withholds states: the draft in the
// call is one the session restored, so the refusal names the session's own
// calls, and those calls work.
test('in a session a forged-wire refusal names recover_only and a new run, and both work', async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'brief-gate-wire-'));
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
  // The ledger no longer holds the state this session carries, and the run's
  // entry still protects line 3.
  for (const e of BRIEFS.free.values()) e.wires.length = 0;
  const answered = await run('lyric_revise', { answer: FIX });
  const said = answered.tool_result.content[0].text;
  assert.match(said, /BRIEF_REQUIRED: the state or checkpoint this call carries is not one/);
  assert.doesNotMatch(said, /this draft/);
  assert.doesNotMatch(said, /the song this state or checkpoint holds/);
  assert.match(
    said,
    /Nothing was run\. Call lyric_revise with the latest session_id and `recover_only: true` to read the accepted lyrics this session holds, then call lyric_revise with the latest session_id, `new_run: true`, those lyrics as `draft_text` and the same declarations this run was given\.$/
  );
  // The two calls it names.
  const exported = JSON.parse(sessions.recover(session_id, 'lyrics').content[0].text);
  assert.deepEqual(exported.final_draft, INPUT, JSON.stringify(exported).slice(0, 600));
  const again = await run('lyric_revise', {
    ...decl,
    new_run: true,
    draft_text: exported.final_draft.join('\n'),
  });
  assert.ok(!again.tool_error, JSON.stringify(again).slice(0, 800));
  assert.equal(sessionVerdict(again.tool_result).exit_code, 4, JSON.stringify(again));
  // A new song's session revises only a draft it graded.
  const raw =
    "BRIEF_REQUIRED: the state or checkpoint this call carries is not one this server returned, and the song it holds is one in which a live revise run keeps lines its loop replaced from coming back, so its records cannot be taken as that run's. Nothing was run. " +
    BRIEF_WIRE_SONG;
  assert.match(
    briefNote(raw, { phase: 'create' }),
    /Nothing was run\. Call lyric_revise with the latest session_id and `recover_only: true` to read the accepted lyrics this session holds, grade them with lyric_grade, then call lyric_revise with that exact draft, the latest session_id and `new_run: true`\.$/
  );
});

// Round 2, item 6 (Andrej's item 10): a call's first progress capture is
// written at once, also when another run's capture was written within the
// same second. The second is counted on the ledger's clock, held still here.
test("a call's first progress capture is written to disk at once", async (t) => {
  const disk = ledgerOnDisk(t);
  const now = BRIEFS.now;
  const at = Date.now();
  BRIEFS.now = () => at;
  t.after(() => {
    BRIEFS.now = now;
  });
  await opened();
  // Another song, in the same second by that clock.
  let onDisk = null;
  const other = await withExecutionContext(
    {
      onCheckpoint: () => {
        if (onDisk === null) onDisk = JSON.parse(disk()).free.length;
      },
    },
    () => call({ ...DECL, draft: ['Fig', 'Jar', 'Hut'] })
  );
  assert.equal(typeof verdict(other).exit_code, 'number');
  assert.equal(onDisk, 2, "the second run's entry is on disk at its first progress record");
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
  // A verdict says its tool read the lines with the tool's own
  // `measurement_status`; one the harness refused says "refused".
  const READ = { lyric_check: 'graded', lyric_recover: 'recovered' };
  const ran = (name, args, value = {}, isError = false) => {
    const next = { task: { domain: 'lyrics', phase: 'edit' }, left_draft: [...song] };
    const verdict = { exit_code: 3, measurement_status: READ[name], ...value };
    keepLeftSong(next, name, args, isError ? { ...v(verdict), isError } : v(verdict), verdict);
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
  // Other lines the harness refused in its verdict (exit 2, nothing read): kept.
  const unread = { exit_code: 2, measurement_status: 'refused', refusal: 'refused' };
  assert.deepEqual(ran('lyric_check', { lines: ['Cat', 'Dog', 'Bun'] }, unread), song);
  assert.deepEqual(ran('lyric_recover', { lines: ['Cat'] }, unread), song);
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
  // Other lines the harness refused to check (a scheme of another length:
  // exit 2 with a refusal, nothing measured): the session is still on the
  // song the revision left, and the restart starts from it.
  BRIEFS.resetForTests();
  run = await open();
  const unread = await run('lyric_check', {
    scheme: 'A'.repeat(INPUT.length + 2),
    relation: 'class:RHYME',
    lines: ['Fig', 'Jar', 'Hut'],
  });
  checked(unread);
  const unreadVerdict = sessionVerdict(unread.tool_result);
  assert.equal(unreadVerdict.exit_code, 2, JSON.stringify(unread).slice(0, 800));
  assert.equal(unreadVerdict.measurement_status, 'refused');
  assert.equal(typeof unreadVerdict.refusal, 'string');
  const still = await run('lyric_revise', { ...decl, new_run: true });
  const stillSaid = JSON.stringify(still);
  assert.ok(!still.tool_error && !still.tool_result?.isError, stillSaid.slice(0, 800));
  assert.equal(sessionVerdict(still.tool_result).exit_code, 4, stillSaid.slice(0, 800));
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

// The same through the real lyric_grade, whose handler makes that call: a
// planned seed, and a draft of filler tokens drawn by seed, one line of which
// a live revise run keeps.
test('a real lyric_grade names the lines a live revise run keeps, and drops its call', async () => {
  const seed = 31;
  const lines = 12;
  const fillerLine = (k) =>
    [0, 1, 2].map((j) => FILLER[draw(`grade:${k}`, j, FILLER.length)]).join(' ');
  const draft = Array.from({ length: lines }, (_, i) => fillerLine(i));
  const edited = draft.map((line, i) => (i === 1 ? fillerLine('other') : line));
  assert.ok(!draft.includes(edited[1]), 'the other text for line 2 is on no line of the draft');
  const grade = async (d) => {
    const r = await client.callTool(
      { name: 'lyric_grade', arguments: { seed, lines, draft: d } },
      undefined,
      { timeout: 200_000 }
    );
    const v = verdict(r);
    assert.ok([0, 3].includes(v.exit_code), JSON.stringify(v).slice(0, 800));
    return v;
  };
  await BRIEFS.capture({ runId: 'grade-site', cur: draft, input: draft, flagged: [2] });
  // The draft as that run holds it: lyric_revise on it is the next call.
  const same = await grade(draft);
  assert.deepEqual(same.next_call, { tool: 'lyric_revise', args: { seed } });
  // Line 2 changed by hand: that revise would be refused before it runs.
  const changed = await grade(edited);
  assert.equal(changed.next_call, undefined);
  assert.match(changed.next, /^lyric_revise refuses this draft before it runs \(BRIEF_REQUIRED\)/);
  assert.match(
    changed.next,
    /Put back line 2 as the last lyric_revise returned it, grade that draft with lyric_grade/
  );
  assert.deepEqual(changed.outcome, {
    kind: 'decision',
    by: 'writer',
    call: { tool: 'lyric_grade', args: {} },
  });
  for (const word of FILLER)
    assert.doesNotMatch(changed.next, new RegExp(`\\b${word}\\b`), 'no lyric text');
});

// A lyric_revise the brief gate refused, in a new song's session: the same
// call on the same draft is refused again, so the receipt's outcome is the
// writer's decision, and its call the grade the refusal's text names first.
test('after BRIEF_REQUIRED in a session for a new song the receipt names the grade, not the revise again', async () => {
  await opened();
  const edited = ['Cat', 'Dog', 'Moon'];
  const refusal = await call({ ...DECL, new_run: true, draft: edited });
  assert.ok(refused(refusal), text(refusal).slice(0, 800));
  // What a new song's session holds once it graded that draft: the receipts
  // nextCreationCall reads (lyric_workflow.js).
  const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const receipts = (continuation = null) => ({
    task: { domain: 'lyrics', phase: 'create' },
    native: {
      continuation,
      task: {
        domain: 'lyrics',
        phase: 'create',
        workflow: {
          version: 1,
          sweeps: [{ args: {}, accepted: [7] }],
          plan: { sha256: 'plan', lines: edited.length, request: { seed: 7 } },
          screen: { words: [], relation: null, plan_sha256: 'plan' },
          grade: { plan_sha256: 'plan', draft_sha256: sha(edited), draft: edited, readings: {} },
          started: { plan_sha256: 'plan' },
        },
      },
    },
  });
  const receiptOf = (result, session) => ({
    operation_id: 'brief-gate-receipt',
    status: 'completed',
    tool: 'lyric_revise',
    tool_result: publicToolResult(result, session.task, { tool: 'lyric_revise' }),
    tool_error: true,
  });
  const sent = { seed: 7, new_run: true };
  const session = receipts();
  const receipt = receiptOf(refusal, session);
  assert.match(
    receipt.tool_result.content.map((c) => c.text).join('\n'),
    /Grade this draft with line 3 as the last lyric_revise returned it with lyric_grade, then call lyric_revise/
  );
  const grade = {
    kind: 'decision',
    by: 'writer',
    call: { tool: 'lyric_grade', args: { seed: 7 } },
  };
  assert.deepEqual(receiptOutcome(receipt, session, 'lyrics', sent), grade);
  // The same with a run the session still carries: the grade comes first.
  const carrying = receipts({ seed: 7, args: { seed: 7, state: 'carried' } });
  assert.deepEqual(receiptOutcome(receiptOf(refusal, carrying), carrying, 'lyrics', sent), grade);
  // Any other refusal of that call keeps the call the creation gate admits.
  const other = {
    isError: true,
    content: [
      { type: 'text', text: 'CREATION_PLAN: scheme differs from the recorded program plan.' },
    ],
  };
  assert.deepEqual(receiptOutcome(receiptOf(other, session), session, 'lyrics', sent), {
    kind: 'next_call',
    by: 'writer',
    call: { tool: 'lyric_revise', args: { seed: 7 } },
  });
  // Lyrics the person supplied hold no creation receipts: no outcome, as before.
  const pasted = { task: { domain: 'lyrics', phase: 'edit' }, native: { continuation: null } };
  assert.equal(receiptOutcome(receiptOf(refusal, pasted), pasted, 'lyrics', sent), null);
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

// Andrej's item 1, the chat's half, across a restart. The fixture is
// deterministic and the run ledger refuses a record that was already
// continued, so this resumes from another record than G22 does. No progress
// record's state reaches the ledger while the run is live: the state the
// recovered envelope carries is recorded when the server builds it, on the
// ledger a restarted process reads from disk.
test('G23: the chat recovered envelope continues an interrupted run after a restart', async (t) => {
  const disk = ledgerOnDisk(t);
  const first = await opened();
  const records = [];
  const atRecord = [];
  const parked = verdict(
    await withExecutionContext(
      {
        onCheckpoint: (record) => {
          records.push(record);
          atRecord.push(disk());
        },
      },
      () => call({ state: first.state, answer: FIX })
    )
  );
  assert.equal(parked.exit_code, 4, JSON.stringify(parked).slice(0, 600));
  // The process dies just after the fix is accepted: the first record that
  // holds it is the last one saved. (G22 resumes from the run's last record.)
  const last = records.find((x) => x.status === 'accepted');
  assert.deepEqual(last.accepted_lines, [INPUT[0], FIX, INPUT[2]]);
  assert.notDeepEqual(last, records.at(-1));
  restartLedger(atRecord[records.indexOf(last)]);
  assert.ok(
    [...BRIEFS.free.values()].some((e) => e.prot.length || e.undo.length),
    'the run still guards its song on disk'
  );
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

// Andrej's item 1, across a restart: a lyric_revise that accepts a fix and
// never returns is resumed, by a new process, from its last stored progress
// record. The ledger that process reads is the file as it stood when that
// record was stored; the state the resume builds is recorded then.
test('G22: a session resumes an interrupted run after a restart, from its progress record', async (t) => {
  const disk = ledgerOnDisk(t);
  const directory = mkdtempSync(path.join(tmpdir(), 'brief-gate-resume-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let lose = false;
  const store = new JobStore(directory);
  // The ledger file each time a progress record reached the job store.
  const atRecord = [];
  const checkpoint = store.checkpoint.bind(store);
  store.checkpoint = (id, payload) => {
    const out = checkpoint(id, payload);
    atRecord.push(disk());
    return out;
  };
  const sessions = new WorkflowSessions({
    store,
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
  // Asking whether it can resume records nothing (get_operation is a read).
  const wires = () => [...BRIEFS.free.values()].map((e) => e.wires.length).join();
  const before = wires();
  assert.equal(sessions.status(q.operation_id, 'lyrics').resumable, true);
  assert.equal(wires(), before);
  // The restart: the ledger as the file held it when the last record was stored.
  assert.ok(atRecord.length > 1);
  restartLedger(atRecord.at(-1));
  assert.ok(
    [...BRIEFS.free.values()].some((e) => e.prot.length || e.undo.length),
    'the run still guards its song on disk'
  );
  const restarted = new WorkflowSessions({ store: new JobStore(directory) });
  const resumed = restarted.resume(q.operation_id, 'lyrics');
  await restarted.wait(resumed.operation_id);
  const after = restarted.status(resumed.operation_id, 'lyrics');
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
