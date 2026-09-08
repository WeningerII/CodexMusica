// Replay the actual Moonshots interview through the maintained native client.
// No paid writer, mocked grader, altered state, or hand-authored blueprint.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { connectConnector } from './client.js';
const server = buildServer({ task: { domain: 'lyrics' } });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a);
const client = await connectConnector({ task: 'lyrics', transport: b });
const decl = {
  seed: 5691,
  lines: 30,
  functions: 'verse,chorus',
  title: 'Moonshot',
  relation: 'class:ASSONANCE',
  wants: [
    'group<=3',
    'binding_cap<=1',
    'beats_per_line<=8',
    'slots_per_line>=16',
    'lines_per_section>=2',
    'uses=verse,chorus',
  ],
};
const receipts = [];
async function call(name, args) {
  const start = Date.now();
  const result = await client.call(name, args);
  assert(!result.isError, JSON.stringify(result));
  let verdict;
  for (const block of result.content || []) {
    try {
      const v = JSON.parse(block.text);
      if (Number.isInteger(v.exit_code)) verdict = v;
    } catch {}
  }
  assert(verdict, name);
  assert.notEqual(verdict.exit_code, 1, JSON.stringify(verdict));
  const row = {
    tool: name,
    elapsed_ms: Date.now() - start,
    exit_code: verdict.exit_code,
    measurement_status: verdict.measurement_status,
    status: verdict.status,
    certified: verdict.certified,
    coverage: verdict.coverage,
  };
  receipts.push(row);
  console.log(JSON.stringify(row));
  return { result, verdict };
}
try {
  await call('lyric_sweep', {
    seed_from: 5691,
    count: 1,
    lines: 30,
    functions: decl.functions,
    want: decl.wants,
  });
  await call('lyric_screen', { words: ['prize', 'time'], relation: decl.relation });
  await call('lyric_plan', decl);
  const draft = (
    await fs.readFile(
      new URL('../docs/session-repair-evidence/moonshots-draft.txt', import.meta.url),
      'utf8'
    )
  )
    .trim()
    .split('\n');
  await call('lyric_grade', { ...decl, draft, fallback: 'low' });
  const pronunciations = [
    {
      line: 'Cut that record; let the bass shake glass',
      token: 3,
      word: 'record',
      phones: ['R', 'EH1', 'K', 'ER0', 'D'],
      basis: 'dictionary',
      source: 'Writer: record means the disc being played, so select the noun pronunciation.',
    },
  ];
  const selected = await call('lyric_grade', { ...decl, draft, fallback: 'low', pronunciations });
  assert.deepEqual(selected.verdict.pronunciations, pronunciations);
  let run = await call('lyric_revise', {
    ...decl,
    draft,
    fallback: 'low',
    writer: 'interview',
    max_rounds: 8,
    attempts: 1,
    backtrack: 1,
  });
  if (run.verdict.state) {
    // These are the two actual repairs accepted during the original run.
    run = await call('lyric_revise', {
      answers: [
        { line: 12, text: 'Ismail works where new ideas breach the fence' },
        { line: 25, text: 'Feet jump; let the whole room bring it back' },
      ],
    });
  }
  assert.equal(run.verdict.measurement_status, 'finished', JSON.stringify(run.verdict));
  assert.equal(run.verdict.certified, true, JSON.stringify(run.verdict));
  assert.equal(run.verdict.exit_code, 0, JSON.stringify(run.verdict));
  assert.deepEqual(run.verdict.pronunciations, pronunciations);
  const text = run.result.content[0].text;
  assert.equal((text.match(/\[VERSE —/g) || []).length, 5);
  assert.equal((text.match(/\[CHORUS —/g) || []).length, 2);
  assert(text.includes('7/8'));
  assert(
    !(run.verdict.coverage?.refused_obligations || []).some((x) =>
      x.includes('COUNT_IS_A_LOWER_BOUND')
    )
  );
  await fs.writeFile(
    new URL('../docs/session-repair-evidence/moonshots-pronunciation-replay.json', import.meta.url),
    JSON.stringify(receipts, null, 2) + '\n'
  );
  await fs.writeFile(
    new URL('../docs/session-repair-evidence/moonshots-pronunciation-replay.txt', import.meta.url),
    text + '\n'
  );
} finally {
  await client.close();
}
