// A LINE TOO SHORT FOR THE WORD ITS RHYME GROUP NAMES IS MARKED, NOT REFUSED
// (the owner's ruling, 2026-11-23: "mark the line"). Through the connector's
// raw engine: the check flags the short line with the two counts, revise asks
// for that line and lists it as the one line that may change, an answer long
// enough that does not rhyme is refused for the rhyme, and one that rhymes is
// accepted.
//
// Every word is drawn by seed from the harness dictionary (one reading, one
// stressed syllable, as mcp/test_statements.mjs draws them). The rhyming and
// the non-rhyming answer are the screen's own answers under the declared
// relation, never a word this file names.
// Run: node --test mcp/test_short_line.mjs

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { BRIEFS, _workerInternals } from './lyric_tools.js';

// A seeded draw (mulberry32): the same seed, the same values.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rows = readFileSync(new URL('../lyric-harness/cmudict.dict', import.meta.url), 'utf8')
  .split('\n')
  .map((row) => row.trim().split(/\s+/));
const readings = new Map();
for (const [w] of rows) {
  const base = (w || '').replace(/\(\d+\)$/, '');
  readings.set(base, (readings.get(base) || 0) + 1);
}
const PHONES = new Map(
  rows
    .filter(
      ([w, ...ph]) =>
        /^[a-z]+$/.test(w || '') &&
        readings.get(w) === 1 &&
        ph.filter((x) => /\d/.test(x)).length === 1
    )
    .map(([w, ...ph]) => [w, ph])
);
const WORDS = [...PHONES.keys()];
// The sound from the stressed vowel on: a prefilter for the screen's
// candidates only. The screen decides.
const rime = (w) => {
  const ph = PHONES.get(w);
  return ph
    .slice(ph.findIndex((x) => /\d/.test(x)))
    .join(' ')
    .replace(/\d/g, '');
};
// The letters from the last vowel on. A partner spelled the same from there
// is refused as a same-spelled ending, so the candidates are spelled apart.
const spelt = (w) => (w.match(/[aeiouy]+[^aeiouy]*$/) || [w])[0];

const verdictOf = (res) => {
  for (const block of res.content || []) {
    try {
      const j = JSON.parse(block.text);
      if (Number.isInteger(j.exit_code)) return j;
    } catch {}
  }
  return null;
};
const textOf = (res) => (res.content || []).map((block) => String(block.text ?? '')).join('\n');

test(
  'a line shorter than the word its group names is flagged, asked for, and fixed only by a rhyme',
  {
    timeout: 600_000,
  },
  async (t) => {
    const server = buildServer({ task: { domain: 'lyrics' } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 'short-line', version: '1' }, { capabilities: {} });
    await client.connect(b);
    t.after(async () => {
      await _workerInternals.kill();
      await client.close();
      await server.close();
    });
    const call = async (name, args) => {
      const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 300_000 });
      return { res, v: verdictOf(res), text: textOf(res) };
    };

    const relation = 'class:RHYME';
    let done = 0;
    for (let seed = 1; done < 3 && seed <= 8; seed++) {
      BRIEFS.resetForTests();
      const r = rng(seed);
      // n: the word the group names in line 1, from 2 to 22; line 1 has n - 1.
      const n = 2 + Math.floor(r() * 21);
      const used = new Set();
      const draw = () => {
        for (;;) {
          const w = WORDS[Math.floor(r() * WORDS.length)];
          if (!used.has(w)) {
            used.add(w);
            return w;
          }
        }
      };
      const end = draw();
      const line2 = [...Array.from({ length: 1 + Math.floor(r() * 6) }, draw), end].join(' ');
      const head = Array.from({ length: n - 1 }, draw);
      const line1 = head.join(' ');
      const same = WORDS.filter(
        (w) => w !== end && !used.has(w) && rime(w) === rime(end) && spelt(w) !== spelt(end)
      );
      const other = WORDS.filter((w) => !used.has(w) && rime(w) !== rime(end));
      const candidates = [];
      for (let k = 0; k < 8 && same.length; k++)
        candidates.push(same.splice(Math.floor(r() * same.length), 1)[0]);
      for (let k = 0; k < 3; k++)
        candidates.push(other.splice(Math.floor(r() * other.length), 1)[0]);
      const screen = await call('lyric_screen', { words: [end, ...candidates], relation });
      const pairs = (screen.v?.pairs || []).filter((p) => p.a === end || p.b === end);
      const partner = (p) => (p.a === end ? p.b : p.a);
      const ok = pairs.find((p) => p.named === true && !p.codes.length && !p.refused);
      const no = pairs.find((p) => p.named === false && !p.codes.length && !p.refused);
      if (!ok || !no) continue;

      const where = `seed ${seed}, line 1 of ${n - 1} words, group 1.T${n},2`;
      const groups = `1.T${n},2`;
      const flag = `Line 1 has ${n - 1} words. Group A names its word ${n}. Write line 1 with at least ${n} words.`;

      // The check grades the draft and flags the short line with both counts.
      const checked = await call('lyric_check', { lines: [line1, line2], groups, relation });
      assert.notEqual(checked.res.isError, true, `${where}: ${checked.text.slice(0, 400)}`);
      assert.ok(
        checked.text.includes(flag),
        `${where}: the check names the short line\n${checked.text.slice(0, 1200)}`
      );
      assert.notEqual(checked.v?.exit_code, 0, `${where}: the draft does not pass`);

      // Revise asks for that line, and it is the one line that may change.
      const first = await call('lyric_revise', {
        draft: [line1, line2],
        groups,
        relation,
        writer: 'interview',
        attempts: 2,
        backtrack: 0,
        max_rounds: 1,
      });
      assert.equal(first.v?.asked?.line, 1, `${where}: revise asks for line 1`);
      assert.ok(first.text.includes('only L1 may change'), `${where}: only line 1 may change`);
      assert.ok(first.text.includes(flag), `${where}: the brief shows the flag`);

      // Long enough, but not a rhyme: refused, and refused for the rhyme.
      const wrong = [...head, partner(no)].join(' ');
      const second = await call('lyric_revise', {
        run_id: first.v.run_id,
        run_revision: first.v.run_revision,
        answers: [{ line: 1, text: wrong }],
      });
      assert.equal(second.v?.folded?.verdict, 'rejected', `${where}: ${wrong}`);
      const reasons = second.v.folded.reasons || [];
      // The pair is read loosely, the two line numbers anywhere after the
      // code, so the reason may name it as a list or in a sentence.
      assert.ok(
        reasons.some((reason) => /SCHEME_VIOLATION[\s\S]*\b1\b[\s\S]*\b2\b/.test(reason)),
        `${where}: refused for the rhyme of lines 1 and 2: ${JSON.stringify(reasons)}`
      );
      assert.ok(
        !reasons.some((reason) => reason.includes('Line 1 has')),
        `${where}: the length is not the reason: ${JSON.stringify(reasons)}`
      );
      assert.equal(second.v?.asked?.line, 1, `${where}: line 1 is asked again`);

      // Long enough, and a rhyme by the screen's own answer: accepted.
      const right = [...head, partner(ok)].join(' ');
      const third = await call('lyric_revise', {
        run_id: second.v.run_id,
        run_revision: second.v.run_revision,
        answers: [{ line: 1, text: right }],
      });
      assert.equal(third.v?.folded?.verdict, 'accepted', `${where}: ${right}`);
      assert.equal(third.v?.exit_code, 0, `${where}: the draft passes`);
      assert.deepEqual(third.v?.final_draft, [right, line2], `${where}: only line 1 changed`);
      done += 1;
    }
    assert.equal(done, 3, 'three drawn songs ran every step');
  }
);
