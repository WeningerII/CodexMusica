// A lookup does not wait behind a grade (song runs A and B, 2026-09-30:
// `lyric_types` passed the caller's 60 s limit while a grade or revise held
// the one serial Python queue). The real tool handlers, a stand-in Python:
// every verb but `types` takes 3 s, `types` answers at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = await mkdtemp(path.join(tmpdir(), 'lookup-queue-'));
const fake = path.join(dir, 'python');
await writeFile(
  fake,
  '#!/bin/sh\n' +
    '# argv: -u lyric_harness.py VERB ...\n' +
    'if [ "$3" = "types" ]; then echo "  types answered"; exit 0; fi\n' +
    'sleep 3; echo "  slow verb answered"; exit 0\n'
);
await chmod(fake, 0o755);
process.env.LYRIC_PYTHON = fake;
process.env.LYRIC_WORKER = '0';
const { registerLyricTools } = await import('./lyric_tools.js');
const handlers = {};
registerLyricTools({}, (_server, name, _config, fn) => {
  handlers[name] = fn;
});

test('lyric_types answers while a grade holds the lyric queue', async (t) => {
  t.after(() => rm(dir, { recursive: true, force: true }));
  let slowDone = false;
  const slow = handlers
    .lyric_check({ lines: ['the cat sat down', 'upon the hat'], scheme: 'AA' })
    .catch((error) => error)
    .finally(() => {
      slowDone = true;
    });
  // Let the slow verb reach the queue first.
  await new Promise((resolve) => setTimeout(resolve, 300));
  const t0 = performance.now();
  const types = await handlers.lyric_types({ word_a: 'cat', word_b: 'hat' });
  const ms = performance.now() - t0;
  assert.equal(slowDone, false, 'the grade is still running when the lookup answers');
  assert.ok(ms < 2000, `the lookup took ${Math.round(ms)} ms behind a 3 s grade`);
  assert.match(JSON.stringify(types), /types answered/);
  await slow;
});
