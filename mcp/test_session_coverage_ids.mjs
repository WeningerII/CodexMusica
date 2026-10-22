import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { connectConnector } from './client.js';
import { buildServer } from './tools.js';

// P9's session cases (duplicate coverage rows for one end word), split from
// test_session_repairs.mjs: together they run about 90 s on the real harness,
// which pushed that file past production-offline's 120 s per-file limit. This
// file runs beside test_chatgpt_parked.mjs, outside that limit.
async function connect(session) {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  return connectConnector({ task: 'lyrics', transport: b, session });
}

test('two checks refusing one end word leave unique coverage ids and a grade receipt', async () => {
  const c = await connect();
  try {
    const verdict = (result) =>
      result.content
        .flatMap((block) => {
          try {
            return [JSON.parse(block.text)];
          } catch {
            return [];
          }
        })
        .find((value) => Number.isInteger(value.exit_code));
    const sw = verdict(await c.call('lyric_sweep', { seed_from: 16, count: 1, lines: 24 }));
    assert.deepEqual(sw.accepted_shown, [16]);
    await c.call('lyric_screen', { words: ['stove', 'coat'], relation: 'class:ASSONANCE' });
    await c.call('lyric_plan', { seed: 16, lines: 24 });
    // Seed 16 at 24 lines: drop, verse, chorus (L3-L5), prechorus, chorus, outro. Only L3,
    // the first chorus line, ends on a word the phonology cannot read.
    const draft = Array.from(
      { length: 24 },
      (_, i) => `the road I remember turns again ${i === 2 ? 'zorblax' : 'tonight'}`
    );
    const grade = verdict(await c.call('lyric_grade', { seed: 16, draft }));
    assert.equal(grade.measurement_status, 'graded');
    // The chorus return and the outro's reprise both refuse L3 ...
    const refusing = grade.findings.filter(
      (f) => f.code === 'END_WORD_UNREADABLE' && f.locations.includes(3)
    );
    assert.equal(refusing.length, 2, JSON.stringify(refusing));
    // ... and the coverage still holds one row per id, so the receipt is recorded.
    const ids = grade.coverage.obligations.map((row) => row.id);
    assert.deepEqual(
      ids.filter((id, i) => ids.indexOf(id) !== i),
      []
    );
    assert(c.snapshot().task.workflow.grade, JSON.stringify(grade.coverage.refused_obligations));
    // ... and revision starts on that exact draft: the user-visible symptom was
    // CREATION_GRADE here (3PO 6345764378). attempts 0 stops at the first stop.
    const revised = await c.call('lyric_revise', { seed: 16, draft, attempts: 0 });
    assert(!revised.isError, JSON.stringify(revised.content?.[0]?.text).slice(0, 400));
    assert(Number.isInteger(verdict(revised).exit_code));
  } finally {
    await c.close();
  }
});

test('an end word refused by two or three overlapping checks keeps one id', async () => {
  // P9's wider triggers (Jony, #519 6347183132 section 18 and 6347336795; 3PO 6347213438):
  // overlapping checks, each with its own dedup set, refuse the same located end word. Seed 7
  // at 24 lines (intro, chorus, ..., outro): outro->intro and outro->chorus both refuse L24, no
  // repeated chorus needed. Seed 9 at 24 lines: three checks refuse L8. Measured against the
  // revise.py this branch started from: two and three identical rows, and no grade receipt.
  // Each row also names its PREMISE (Don 6348656619): the line's function and the sections
  // whose overlapping checks reach it, so a later plan change that moves them fails here
  // instead of passing without exercising the bug. The findings count cannot serve: the
  // refusals are already merged into one finding per line; only the coverage rows doubled.
  for (const [seed, line, fn, needs] of [
    [7, 24, 'outro', ['intro', 'chorus', 'outro']],
    [9, 8, 'chorus', ['chorus', 'chorus', 'reprise', 'outro']],
  ]) {
    const c = await connect();
    try {
      const verdict = (result) =>
        result.content
          .flatMap((block) => {
            try {
              return [JSON.parse(block.text)];
            } catch {
              return [];
            }
          })
          .find((value) => Number.isInteger(value.exit_code));
      const sw = verdict(await c.call('lyric_sweep', { seed_from: seed, count: 1, lines: 24 }));
      assert.deepEqual(sw.accepted_shown, [seed]);
      await c.call('lyric_screen', { words: ['stove', 'coat'], relation: 'class:ASSONANCE' });
      const { plan } = verdict(await c.call('lyric_plan', { seed, lines: 24 }));
      assert.equal(plan.line_slots.find((l) => l.line === line).function, fn, `seed ${seed}`);
      const fns = plan.sections.map((x) => x.function);
      for (const f of new Set(needs))
        assert(
          fns.filter((x) => x === f).length >= needs.filter((x) => x === f).length,
          `seed ${seed} plans ${fns}`
        );
      const draft = Array.from(
        { length: 24 },
        (_, i) => `the road I remember turns again ${i === line - 1 ? 'zorblax' : 'tonight'}`
      );
      const grade = verdict(await c.call('lyric_grade', { seed, draft }));
      assert.equal(grade.measurement_status, 'graded');
      const rows = grade.coverage.obligations.filter(
        (row) => row.id === `function:END_WORD_UNREADABLE:L${line}`
      );
      assert.equal(rows.length, 1, `seed ${seed}: ${JSON.stringify(rows)}`);
      assert.equal(rows[0].word, 'zorblax');
      const ids = grade.coverage.obligations.map((row) => row.id);
      assert.deepEqual(
        ids.filter((id, i) => ids.indexOf(id) !== i),
        [],
        `seed ${seed}`
      );
      assert(c.snapshot().task.workflow.grade, `seed ${seed}: no grade receipt`);
      const revised = await c.call('lyric_revise', { seed, draft, attempts: 0 });
      assert(!revised.isError, JSON.stringify(revised.content?.[0]?.text).slice(0, 400));
      assert(Number.isInteger(verdict(revised).exit_code));
    } finally {
      await c.close();
    }
  }
});
