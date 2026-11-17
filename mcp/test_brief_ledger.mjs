// test_brief_ledger.mjs — the brief ledger on its own, with no harness
// (Refs #665): digests and fold, 3 h expiry, both partition caps, a corrupt
// file failing closed until recover(), atomic save, reload, alignLines, the
// match rules, compare-and-set supersede, and a key-check mismatch starting
// fresh. Lyrics here are placeholders.
//
// Usage: node --test mcp/test_brief_ledger.mjs

import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BRIEF_RETAIN_MS,
  BriefLedger,
  alignLines,
  createBriefLedger,
  deriveBriefKey,
  fold,
} from './brief_ledger.js';

const KEY = deriveBriefKey('a'.repeat(64));
const OTHER_KEY = deriveBriefKey('b'.repeat(64));
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'brief-ledger-'));
const quiet = () => {
  const lines = [];
  const log = (m) => lines.push(m);
  log.lines = lines;
  return log;
};
const clock = (start = 1_700_000_000_000) => {
  const c = () => c.t;
  c.t = start;
  return c;
};
const song = (tag, n = 8) =>
  Array.from({ length: n }, (_, i) => `${tag} placeholder line ${i + 1}`);
const ledger = (opts = {}) => new BriefLedger({ key: KEY, log: quiet(), ...opts });

test('fold keeps letters, marks and digits, after NFKC and lowercase', () => {
  assert.equal(fold('Ｈｅｌｌｏ, World!  2'), 'helloworld2');
  assert.equal(fold('Ünïcode Ok'), fold('ünïcode ok'));
  // A vowel sign or tone mark is part of the word: changing it is a change.
  assert.notEqual(fold('कि'), fold('का'));
  assert.notEqual(fold('दिल टूटा'), fold('दल टट'));
  assert.notEqual(fold('ไม่'), fold('ไม้'));
  // A line with no letters keeps its symbols; blank lines stay alike.
  assert.notEqual(fold('🔥🔥'), fold('✨'));
  assert.equal(fold('🔥 🔥!'), fold('🔥🔥!'));
  assert.equal(fold('   '), fold(''));
  assert.notEqual(fold('  —…  '), fold(''));
});

test('digests: keyed, short, folded, and not recoverable without the key', () => {
  const b = ledger();
  const { ex, fo } = b.digests(['Alpha beta', 'alpha, BETA!', 'gamma']);
  for (const d of [...ex, ...fo]) assert.match(d, /^[A-Za-z0-9+/]{11}=$/);
  assert.equal(fo[0], fo[1]);
  assert.notEqual(ex[0], ex[1]);
  assert.notEqual(fo[0], fo[2]);
  // Not an unkeyed hash of the text, nor the same under another key.
  const plain = createHash('sha256').update('alphabeta').digest().subarray(0, 8).toString('base64');
  assert.notEqual(fo[0], plain);
  const raw = createHmac('sha256', Buffer.alloc(32)).update('f\0alphabeta').digest();
  assert.notEqual(fo[0], raw.subarray(0, 8).toString('base64'));
  assert.notEqual(
    new BriefLedger({ key: OTHER_KEY, log: quiet() }).digests(['gamma']).fo[0],
    fo[2]
  );
});

test('no lyric text reaches the file, which is 0600 and leaves no temp file', async () => {
  const dir = tmpDir();
  const file = path.join(dir, 'brief-ledger.json');
  fs.writeFileSync(file + '.deadbeef.tmp', 'left by a kill');
  const b = ledger({ file });
  assert.ok(!fs.existsSync(file + '.deadbeef.tmp'), 'a leftover temp file is swept');
  const cur = song('zebrawordqq');
  await b.capture({ runId: 'run-a', cur, input: cur, flagged: [2], wire: '{"w":"zebrawordqq"}' });
  const body = fs.readFileSync(file, 'utf8');
  assert.ok(!/zebrawordqq|placeholder/i.test(body), 'no plaintext in the store');
  assert.ok(!body.includes('run-a'), 'no run id in the store');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(
    fs.readdirSync(dir).filter((n) => n.endsWith('.tmp')),
    []
  );
});

test('alignLines: insert, delete and substitute', () => {
  assert.deepEqual(alignLines(['a', 'b', 'c'], ['a', 'x', 'b', 'c']), {
    pairs: [
      [0, 0],
      [1, 2],
      [2, 3],
    ],
    subs: [],
    deleted: [],
    inserted: [1],
  });
  assert.deepEqual(alignLines(['a', 'b', 'c'], ['a', 'c']).deleted, [1]);
  const s = alignLines(['a', 'b', 'c', 'd'], ['a', 'B', 'C', 'd', 'e']);
  assert.deepEqual(s.subs, [
    [1, 1],
    [2, 2],
  ]);
  assert.deepEqual(s.inserted, [4]);
  const g = alignLines(['a', 'b', 'c', 'd'], ['a', 'X', 'd']);
  assert.deepEqual(g.subs, [[1, 1]]);
  assert.deepEqual(g.deleted, [2]);
  assert.deepEqual(alignLines([], ['a']).inserted, [0]);
  assert.deepEqual(alignLines(['a'], []).deleted, [0]);
});

test('a flagged unbriefed line may not change; a briefed or unflagged one may', async () => {
  const b = ledger();
  const cur = song('s1');
  await b.capture({ runId: 'r1', cur, input: cur, flagged: [2, 5], briefed: [5] });
  const free = cur.slice();
  free[4] = 'a new fifth line';
  free[6] = 'a new seventh line';
  assert.equal(b.check({ runId: 'r1', lineSets: [free] }).ok, true);
  const bad = cur.slice();
  bad[1] = 'a hand edit of line two';
  const r = b.check({ runId: 'r1', lineSets: [bad] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'brief');
  assert.deepEqual(r.changed, [2]);
  assert.ok(!r.may.includes(2) && r.may.includes(5));
});

test('changed is judged on folded text: case, spacing and punctuation pass', async () => {
  const b = ledger();
  const cur = song('s2');
  await b.capture({ runId: 'r2', cur, input: cur, flagged: [3] });
  const retyped = cur.slice();
  retyped[2] = `  ${cur[2].toUpperCase()}, — !`;
  assert.equal(b.check({ runId: 'r2', lineSets: [retyped] }).ok, true);
  // Punctuation-only edits on every line still match by content.
  const all = cur.map((l) => l.toUpperCase() + '!');
  all[2] = 'different words here';
  const r = b.check({ lineSets: [all] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.changed, [3]);
});

test('undo: putting back the pre-fix text is refused, compared folded', async () => {
  const b = ledger();
  const input = song('s3');
  const cur = input.slice();
  cur[3] = 'the loop fixed this line';
  await b.capture({ runId: 'r3', cur, input, flagged: [], briefed: [] });
  const back = cur.slice();
  back[3] = input[3].toUpperCase() + '.';
  const r = b.check({ runId: 'r3', lineSets: [back] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.undone, [4]);
  assert.ok(!r.may.includes(4), 'the refused line is not among those the draft may change');
  const other = cur.slice();
  other[3] = 'yet another wording';
  assert.equal(b.check({ runId: 'r3', lineSets: [other] }).ok, true);
});

test('a removed protected line is named by the line before it; inserts are free', async () => {
  const b = ledger();
  const cur = song('s4');
  await b.capture({ runId: 'r4', cur, input: cur, flagged: [4] });
  const ins = cur.slice();
  ins.splice(2, 0, 'an inserted line');
  ins[0] = 'an edited unflagged line';
  assert.equal(b.check({ runId: 'r4', lineSets: [ins] }).ok, true);
  const del = cur.slice();
  del.splice(3, 1);
  const r = b.check({ runId: 'r4', lineSets: [del] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.removedAfter, [3]);
  const first = song('s4b');
  await b.capture({ runId: 'r4b', cur: first, input: first, flagged: [1] });
  assert.deepEqual(b.check({ runId: 'r4b', lineSets: [first.slice(1)] }).removedAfter, [0]);
});

test('content match: more than half the lines in common', async () => {
  const b = ledger();
  const cur = song('s5', 10);
  await b.capture({ runId: 'r5', cur, input: cur, flagged: [2] });
  // No run_id: six of ten lines kept, line 2 edited -> matched and refused.
  const most = cur.slice();
  most[1] = 'edited';
  for (const i of [7, 8, 9]) most[i] = `new ${i}`;
  assert.equal(b.check({ lineSets: [most] }).ok, false);
  // Half or fewer kept and line 2 edited -> a new song.
  const half = cur.map((l, i) => (i < 5 && i !== 1 ? l : `fresh ${i}`));
  assert.equal(b.check({ lineSets: [half] }).ok, true);
  // Only the protected line kept (the rest rewritten) -> a new song: it
  // neither takes over the run's entry nor inherits its protection.
  const kept = cur.map((l, i) => (i === 1 ? l : `fresh ${i}`));
  const r = b.check({ lineSets: [kept] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.supersedes, []);
  assert.deepEqual(r.inherited.prot, []);
  // Every line set is checked: a clean draft with an edited wire line set.
  assert.equal(b.check({ lineSets: [cur, most] }).set, 1);
});

test('an unminted wire for a known song is refused; a minted one is exempt', async () => {
  const b = ledger();
  const cur = song('s6');
  await b.capture({ runId: 'r6', cur, input: cur, flagged: [1], wire: 'wire-one' });
  assert.equal(b.minted('wire-one'), true);
  assert.equal(b.minted('wire-forged'), false);
  const forged = b.check({ lineSets: [cur], wires: ['wire-forged'] });
  assert.equal(forged.ok, false);
  assert.equal(forged.reason, 'unminted_wire');
  const ok = b.check({ lineSets: [cur], wires: ['wire-one'] });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.inherited.prot, [1]);
  // An unknown song with an unknown wire is admitted.
  assert.equal(b.check({ lineSets: [song('other')], wires: ['x'] }).ok, true);
  // A known song in which no line is protected has nothing a forged record
  // could free, so its unminted wire is admitted too.
  const plain = song('s6plain');
  await b.capture({ runId: 'r6p', cur: plain, input: plain, flagged: [], wire: 'wire-plain' });
  assert.equal(b.check({ lineSets: [plain], wires: ['wire-forged-2'] }).ok, true);
});

test('inheritance: a no-op run cannot launder protection away', async () => {
  const b = ledger();
  const cur = song('s7');
  await b.capture({ runId: 'r7', cur, input: cur, flagged: [3] });
  const draft = ['an inserted first line', ...cur];
  const c = b.check({ runId: 'r7b', lineSets: [draft] });
  assert.equal(c.ok, true);
  assert.deepEqual(c.inherited.prot, [4]);
  // r7b ran, flagged nothing and briefed nothing: line 4 stays protected.
  await b.capture({
    runId: 'r7b',
    cur: draft,
    input: draft,
    supersedes: c.supersedes,
    inherited: c.inherited,
  });
  assert.equal(b.get(c.supersedes[0].id).retired, true, 'the old entry is retired');
  const edit = draft.slice();
  edit[3] = 'hand edit';
  assert.deepEqual(b.check({ lineSets: [edit] }).changed, [4]);
  // Briefing the line releases it; a whole-draft flag releases every line.
  await b.capture({ runId: 'r7b', cur: draft, input: draft, inherited: c.inherited, briefed: [4] });
  assert.equal(b.check({ lineSets: [edit] }).ok, true);
  await b.capture({ runId: 'r7c', cur: draft, input: draft, flagged: [1, 2], whole: true });
  assert.equal(b.get(c.supersedes[0].id).retired, true);
});

test('supersede is compare-and-set: two concurrent captures, and a moved entry', async () => {
  const now = clock();
  const b = ledger({ now });
  const cur = song('s8');
  await b.capture({ runId: 'base', cur, input: cur, flagged: [2] });
  const c1 = b.check({ lineSets: [cur] });
  const c2 = b.check({ lineSets: [cur] });
  now.t += 10;
  await Promise.all([
    b.capture({ runId: 'x1', cur, input: cur, supersedes: c1.supersedes, inherited: c1.inherited }),
    b.capture({ runId: 'x2', cur, input: cur, supersedes: c2.supersedes, inherited: c2.inherited }),
  ]);
  assert.equal(b.get(c1.supersedes[0].id).retired, true);
  const edit = cur.slice();
  edit[1] = 'hand edit';
  const r = b.check({ lineSets: [edit] });
  assert.equal(r.ok, false, 'both successors inherited the protection');
  // The base run captured again after the check: its newer entry stays.
  const now2 = clock();
  const b2 = ledger({ now: now2 });
  await b2.capture({ runId: 'base', cur, input: cur, flagged: [2] });
  const stale = b2.check({ lineSets: [cur] });
  now2.t += 5;
  await b2.capture({ runId: 'base', cur, input: cur, flagged: [2] });
  await b2.capture({ runId: 'y', cur, input: cur, supersedes: stale.supersedes });
  assert.ok(b2.get(stale.supersedes[0].id), 'a moved entry is not retired');
});

test('forget drops the run and what it superseded', async () => {
  const b = ledger();
  const cur = song('s9');
  await b.capture({ runId: 'f1', cur, input: cur, flagged: [1] });
  const c = b.check({ runId: 'f2', lineSets: [cur] });
  await b.capture({ runId: 'f2', cur, input: cur, flagged: [1], supersedes: [] });
  b.forget({ runId: 'f2', supersedes: c.supersedes });
  const edit = cur.slice();
  edit[0] = 'edited after certification';
  assert.equal(b.check({ lineSets: [edit] }).ok, true);
});

test('3 hour expiry, free and paid alike', async () => {
  const now = clock();
  const b = ledger({ now });
  const a = song('e1'),
    p = song('e2');
  await b.capture({ runId: 'free', cur: a, input: a, flagged: [1], wire: 'wa' });
  await b.capture({ runId: 'paid', paid: true, cur: p, input: p, flagged: [1] });
  const ea = a.slice(),
    ep = p.slice();
  ea[0] = ep[0] = 'edited';
  now.t += BRIEF_RETAIN_MS - 1;
  assert.equal(b.check({ lineSets: [ea] }).ok, false);
  assert.equal(b.check({ lineSets: [ep] }).ok, false);
  assert.equal(b.minted('wa'), true);
  now.t += 2;
  assert.equal(b.minted('wa'), false);
  assert.equal(b.check({ lineSets: [ea] }).ok, true);
  assert.equal(b.check({ lineSets: [ep] }).ok, true);
  assert.equal(b.free.size + b.paid.size, 0);
});

test('both partition caps hold, and free runs never push out paid ones', async () => {
  const b = ledger({ cap: 3, paidCap: 2 });
  for (let i = 0; i < 5; i++) {
    const s = song(`c${i}`);
    await b.capture({ runId: `free${i}`, cur: s, input: s, flagged: [1] });
    await b.capture({ runId: `paid${i}`, paid: true, cur: s, input: s, flagged: [2] });
  }
  assert.equal(b.free.size, 3);
  assert.equal(b.paid.size, 2);
  const e = song('c4');
  e[1] = 'edited';
  assert.equal(b.check({ lineSets: [e] }).ok, false, 'the newest paid entry is kept');
  const old = song('c0');
  old[0] = 'edited';
  assert.equal(b.check({ lineSets: [old] }).ok, true, 'the oldest free entry is gone');
});

test('reload gives the same entries and index', async () => {
  const file = path.join(tmpDir(), 'b.json');
  const b = ledger({ file });
  const cur = song('l1');
  const input = cur.slice();
  input[5] = 'before the fix';
  await b.capture({ runId: 'L', cur, input, flagged: [2], wire: 'wl' });
  const again = ledger({ file });
  assert.equal(again.healthy, true);
  assert.deepEqual([...again.free.values()], [...b.free.values()]);
  assert.deepEqual(
    [...again.index].map(([k, v]) => [k, [...v]]),
    [...b.index].map(([k, v]) => [k, [...v]])
  );
  const edit = cur.slice();
  edit[1] = 'hand edit';
  edit[5] = 'before the fix';
  const r = again.check({ lineSets: [edit] });
  assert.deepEqual([r.changed, r.undone], [[2], [6]]);
  assert.equal(again.minted('wl'), true);
});

test('a corrupt file fails closed, is never overwritten, and recover() reads it again', async () => {
  const file = path.join(tmpDir(), 'b.json');
  fs.writeFileSync(file, '{not json');
  const log = quiet();
  const b = new BriefLedger({ file, key: KEY, log });
  assert.equal(b.healthy, false);
  assert.ok(log.lines.some((l) => l.includes('unreadable')));
  const cur = song('k1');
  await b.capture({ runId: 'k', cur, input: cur, flagged: [1] });
  assert.equal(fs.readFileSync(file, 'utf8'), '{not json', 'not written over');
  assert.equal(b.recover(), false);
  assert.equal(fs.readFileSync(file, 'utf8'), '{not json');
  // Repaired (here: removed) -> healthy, and what was captured meanwhile is saved.
  fs.rmSync(file);
  assert.equal(b.recover(), true);
  assert.equal(b.healthy, true);
  const reread = ledger({ file });
  const edit = cur.slice();
  edit[0] = 'edited';
  assert.equal(reread.check({ lineSets: [edit] }).ok, false);
  // A non-object body fails closed too.
  fs.writeFileSync(file, '[]');
  assert.equal(ledger({ file }).healthy, false);
});

test('a failed save makes it unhealthy until a save succeeds', async () => {
  const dir = tmpDir();
  const file = path.join(dir, 'sub', 'b.json');
  fs.writeFileSync(path.join(dir, 'sub'), 'a file where the directory should be');
  const b = ledger({ file });
  const cur = song('v1');
  await b.capture({ runId: 'v', cur, input: cur, flagged: [1] });
  assert.equal(b.healthy, false);
  fs.rmSync(path.join(dir, 'sub'));
  assert.equal(b.recover(), true);
  assert.ok(fs.existsSync(file));
});

test('a key-check mismatch drops the entries and starts fresh, logged', async () => {
  const file = path.join(tmpDir(), 'b.json');
  const b = ledger({ file });
  const cur = song('m1');
  await b.capture({ runId: 'm', cur, input: cur, flagged: [1] });
  const log = quiet();
  const rotated = new BriefLedger({ file, key: OTHER_KEY, log });
  assert.equal(rotated.healthy, true);
  assert.equal(rotated.free.size, 0);
  assert.ok(log.lines.some((l) => l.includes('key changed')));
  const edit = cur.slice();
  edit[0] = 'edited';
  assert.equal(rotated.check({ lineSets: [edit] }).ok, true);
  assert.equal(new BriefLedger({ file, key: OTHER_KEY, log: quiet() }).healthy, true);
});

test('createBriefLedger: file from the environment, key from the server secret', async () => {
  const dir = tmpDir();
  const env = { LYRIC_RUNTIME_DIR: dir, CHAT_SECRET: 'c'.repeat(64) };
  const b = createBriefLedger(env, { log: quiet() });
  assert.equal(b.file, path.join(dir, 'brief-ledger.json'));
  const cur = song('n1');
  await b.capture({ runId: 'n', cur, input: cur, flagged: [1] });
  assert.equal(createBriefLedger(env, { log: quiet() }).free.size, 1);
  assert.equal(createBriefLedger({}, { log: quiet() }).file, null);
  // An unloadable key fails closed.
  const bad = path.join(dir, 'bad.key');
  fs.writeFileSync(bad, 'x', { mode: 0o644 });
  const broken = createBriefLedger(
    { BRIEF_LEDGER_FILE: path.join(dir, 'o.json'), CHAT_SECRET_FILE: bad },
    { log: quiet() }
  );
  assert.equal(broken.healthy, false);
  assert.equal(broken.recover(), false);
});

test('resetForTests empties the store', async () => {
  const b = ledger();
  const cur = song('t1');
  await b.capture({ runId: 't', cur, input: cur, flagged: [1] });
  b.resetForTests();
  assert.equal(b.free.size + b.paid.size + b.index.size, 0);
  assert.equal(b.healthy, true);
});

test('a song that only shares a protected line neither matches nor takes over the run', async () => {
  const b = ledger();
  const cur = song('d1', 6);
  await b.capture({ runId: 'orig', cur, input: cur, flagged: [3] });
  // A decoy holding the protected line verbatim, and nothing else of the song.
  const decoy = ['decoy one', cur[2], 'decoy three'];
  const c = b.check({ runId: 'decoy', lineSets: [decoy] });
  assert.equal(c.ok, true);
  assert.deepEqual(c.supersedes, []);
  assert.deepEqual(c.inherited.prot, []);
  await b.capture({
    runId: 'decoy',
    cur: decoy,
    input: decoy,
    flagged: [2],
    supersedes: c.supersedes,
    inherited: c.inherited,
  });
  b.forget({ runId: 'decoy', supersedes: c.supersedes });
  // The original song is still guarded.
  const edit = cur.slice();
  edit[2] = 'a hand edit of line three';
  assert.deepEqual(b.check({ lineSets: [edit] }).changed, [3]);
  // An unrelated song sharing that line and another, in the other order, is
  // admitted rather than told a line of someone else's run was removed.
  const stranger = [cur[4], 'other two', cur[2], 'other four', 'other five'];
  const s2 = b.check({ lineSets: [stranger] });
  assert.equal(s2.ok, true);
  assert.deepEqual(s2.supersedes, []);
});

test('a replaced line may not come back after its line is deleted, nor as an inserted line', async () => {
  const b = ledger();
  const input = song('u1', 6);
  const cur = input.slice();
  cur[1] = 'the loop replaced line two';
  await b.capture({ runId: 'u', cur, input });
  // One call: the old text added as a new line, the fix kept.
  const added = [...cur, input[1]];
  assert.deepEqual(b.check({ lineSets: [added] }).undone, [7]);
  // Two calls: delete the fixed line (admitted), then put the old text back.
  const step1 = cur.filter((_, i) => i !== 1);
  const c1 = b.check({ runId: 'u2', lineSets: [step1] });
  assert.equal(c1.ok, true);
  assert.equal(c1.inherited.undo.length, 1);
  assert.equal(c1.inherited.undo[0][0], 0, 'carried with no place');
  await b.capture({
    runId: 'u2',
    cur: step1,
    input: step1,
    supersedes: c1.supersedes,
    inherited: c1.inherited,
  });
  const r = b.check({ lineSets: [input] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.undone, [2]);
  assert.ok(!r.may.includes(2));
  // A different new line is fine.
  assert.equal(b.check({ lineSets: [[...step1, 'a different line']] }).ok, true);
  // It survives a reload.
  const file = path.join(tmpDir(), 'u.json');
  const d = ledger({ file });
  await d.capture({ runId: 'u3', cur: step1, input: step1, inherited: c1.inherited });
  assert.deepEqual(ledger({ file }).check({ lineSets: [input] }).undone, [2]);
});

test('a run set aside on a song another run took over still continues on its own wire', async () => {
  const b = ledger();
  const cur = song('a1', 6);
  await b.capture({ runId: 'A', cur, input: cur, flagged: [2], wire: 'wire-a' });
  const c = b.check({ runId: 'B', lineSets: [cur] });
  assert.equal(c.ok, true);
  const fixed = cur.slice();
  fixed[1] = 'the other run replaced line two';
  await b.capture({
    runId: 'B',
    cur: fixed,
    input: cur,
    wire: 'wire-b',
    supersedes: c.supersedes,
    inherited: c.inherited,
  });
  assert.equal(b.minted('wire-a'), true, 'the retired entry still holds its wire');
  assert.equal(b.check({ runId: 'A', lineSets: [cur], wires: ['wire-a'] }).ok, true);
  // Without the wire, the same lines answer to the run that took over.
  assert.deepEqual(b.check({ lineSets: [cur] }).undone, [2]);
});

test('the line budget prunes the oldest entries before the count cap', async () => {
  const b = ledger({ lineBudget: 20 });
  for (let i = 0; i < 3; i++) {
    const s = song(`lb${i}`);
    await b.capture({ runId: `lb${i}`, cur: s, input: s, flagged: [1] });
  }
  assert.equal(b.free.size, 2);
  const old = song('lb0');
  old[0] = 'edited';
  assert.equal(b.check({ lineSets: [old] }).ok, true);
});

test('a memory-only store whose key failed once recovers', () => {
  let calls = 0;
  const b = new BriefLedger({
    key: () => {
      if (calls++ === 0) throw new Error('not yet');
      return KEY;
    },
    log: quiet(),
  });
  assert.equal(b.healthy, false);
  assert.equal(b.recover(), true);
  assert.equal(b.healthy, true);
});

test('a file in another format fails closed and is not written over', () => {
  const file = path.join(tmpDir(), 'b.json');
  for (const body of [
    '{"v":2,"entries":[1,2]}',
    '{"v":1,"free":[],"paid":[]}',
    '{"v":1,"kc":"x"}',
  ]) {
    fs.writeFileSync(file, body);
    const b = ledger({ file });
    assert.equal(b.healthy, false, body);
    assert.equal(fs.readFileSync(file, 'utf8'), body);
  }
});

// "More than half the lines" at its boundary (BB8's review of #875): an
// 8-line song whose line 1 is flagged, and drafts that change line 1 and
// keep some of the other lines. Exactly half kept is a new song (admitted);
// one more is the same song (refused). The rule is decided by the count of
// lines still in order (aligned); the count of shared lines in front of it is
// only a quick filter, since the aligned count can never exceed it, so an
// off-by-one there changes no outcome and no test can see it (checked by
// mutation: flipping its `<=` to `<` leaves every case here unchanged).
test('the same-song rule at exactly half, and one line either side', async () => {
  const b = ledger();
  const cur = song('edge');
  await b.capture({ runId: 'rEdge', cur, input: cur, flagged: [1] });
  const fresh = (i) => `a new line written in place ${i}`;
  const draft = (kept) => {
    const out = [fresh(0), ...Array.from({ length: 7 }, (_, i) => fresh(i + 1))];
    for (const [pos, line] of kept) out[pos] = cur[line];
    return out;
  };
  const inOrder = (n) => Array.from({ length: n }, (_, i) => [i + 1, i + 1]);
  // Line 1 changed; n of lines 2..8 kept at their own places.
  assert.equal(b.check({ lineSets: [draft(inOrder(3))] }).ok, true, 'three kept: a new song');
  assert.equal(
    b.check({ lineSets: [draft(inOrder(4))] }).ok,
    true,
    'exactly half kept: a new song'
  );
  const five = b.check({ lineSets: [draft(inOrder(5))] });
  assert.equal(five.ok, false, 'five kept, in order: the same song, line 1 refused');
  assert.deepEqual(five.changed, [1]);
  // Five kept but only four in order: the shared count passes and the
  // in-order count does not, so it is a new song.
  const scrambled = draft([
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 6],
    [5, 2],
  ]);
  assert.equal(
    b.check({ lineSets: [scrambled] }).ok,
    true,
    'five shared, four in order: a new song'
  );
  // Five in order, one of them moved by one place: still five in order.
  const shifted = draft([
    [2, 1 + 1],
    [3, 2 + 1],
    [4, 3 + 1],
    [5, 4 + 1],
    [6, 5 + 1],
  ]);
  assert.equal(b.check({ lineSets: [shifted] }).ok, false, 'five in order, shifted: the same song');
});

// Andrej's review of #875, item 20: a whole-draft flag releases every line,
// and the same capture without it does not.
test('a whole-draft flag releases every line it flagged; without it they stay protected', async () => {
  const b = ledger();
  const cur = song('wh1');
  await b.capture({ runId: 'wh', cur, input: cur, flagged: [1, 2], whole: true });
  for (const k of [0, 1]) {
    const edit = cur.slice();
    edit[k] = 'hand edit';
    assert.equal(b.check({ lineSets: [edit] }).ok, true, `line ${k + 1} is free`);
  }
  await b.capture({ runId: 'wh', cur, input: cur, flagged: [1, 2] });
  for (const k of [0, 1]) {
    const edit = cur.slice();
    edit[k] = 'hand edit';
    assert.deepEqual(b.check({ lineSets: [edit] }).changed, [k + 1]);
  }
});

// Item 9: the forged-wire refusal says what the entry holds.
test('an unminted wire refusal says whether the entry protects lines or holds replaced ones', async () => {
  const b = ledger();
  const input = song('u9');
  const cur = input.slice();
  cur[2] = 'the loop fix';
  await b.capture({ runId: 'u9', cur, input, flagged: [] });
  const undoOnly = b.check({ lineSets: [cur], wires: ['forged'] });
  assert.equal(undoOnly.reason, 'unminted_wire');
  assert.deepEqual([undoOnly.protects, undoOnly.replaced], [false, true]);
  const other = song('p9');
  await b.capture({ runId: 'p9', cur: other, input: other, flagged: [4] });
  const protOnly = b.check({ lineSets: [other], wires: ['forged'] });
  assert.deepEqual([protOnly.protects, protOnly.replaced], [true, false]);
});

// Item 10: a progress capture that is not saved at once is saved a moment
// later, so a restart after that window still has it.
test('a capture held back from disk is saved after the save gap', async () => {
  const file = path.join(tmpDir(), 'b.json');
  const b = ledger({ file, saveGapMs: 20 });
  const sa = song('ta');
  const sb = song('tb');
  await b.capture({ runId: 'A', cur: sa, input: sa, flagged: [1] });
  await b.capture({ runId: 'B', cur: sb, input: sb, flagged: [2], persist: false });
  await new Promise((r) => setTimeout(r, 120));
  const again = ledger({ file });
  assert.equal(again.free.size, 2, 'both runs survive the restart');
  const edit = sb.slice();
  edit[1] = 'hand edit';
  assert.deepEqual(again.check({ lineSets: [edit] }).changed, [2]);
});

// Item 11: undo items and protected lines count against the budget.
test('the item budget counts undo items, so undo-heavy entries stay within it', async () => {
  const file = path.join(tmpDir(), 'b.json');
  const budget = 1000;
  const b = ledger({ file, lineBudget: budget });
  const undo = (tag) =>
    Array.from({ length: 256 }, (_, i) => [0, b.digests([`${tag} gone ${i}`]).fo[0]]);
  for (let i = 0; i < 10; i++) {
    const s = song(`ud${i}`, 4);
    await b.capture({
      runId: `ud${i}`,
      cur: s,
      input: s,
      flagged: [1],
      inherited: { prot: [], undo: undo(`ud${i}`) },
    });
  }
  let items = 0;
  for (const e of b.free.values()) items += e.n + e.prot.length + e.undo.length;
  assert.ok(items <= budget, `${items} items over a budget of ${budget}`);
  assert.ok(b.free.size >= 1, 'the newest entry is kept');
  // A byte ceiling: about 16 bytes per stored item, plus each entry's frame.
  assert.ok(fs.statSync(file).size <= budget * 16 + b.free.size * 400, 'the file stays bounded');
});

// Item 12: entries that guard nothing go before one that protects a line.
test('pruning drops entries that guard nothing before the oldest protecting one', async () => {
  const b = ledger({ lineBudget: 40 });
  const kept = song('ev0', 4);
  await b.capture({ runId: 'ev0', cur: kept, input: kept, flagged: [3] });
  for (let i = 1; i <= 12; i++) {
    const s = song(`ev${i}`, 4);
    await b.capture({ runId: `ev${i}`, cur: s, input: s, flagged: [] });
  }
  const edit = kept.slice();
  edit[2] = 'hand edit';
  assert.deepEqual(b.check({ lineSets: [edit] }).changed, [3], 'the protecting entry is kept');
  // Once only protecting entries are left, the oldest of them goes.
  for (let i = 0; i < 12; i++) {
    const s = song(`evp${i}`, 4);
    await b.capture({ runId: `evp${i}`, cur: s, input: s, flagged: [1] });
  }
  assert.equal(b.check({ lineSets: [edit] }).ok, true);
});

// Gap item G1: newer look-alike runs cannot push the protecting entry out of
// the check.
test('decoy runs on look-alike songs do not push the protecting entry out of the check', async () => {
  const now = clock();
  const b = ledger({ now });
  const S = song('g1', 10);
  await b.capture({ runId: 'protect', cur: S, input: S, flagged: [3] });
  const D = S.slice();
  D[2] = 'hand edit';
  assert.deepEqual(b.check({ lineSets: [D] }).changed, [3]);
  for (let k = 0; k < 8; k++) {
    now.t += 1000; // each decoy is newer than the entry it hides
    const decoy = [...D.slice(0, 6), ...song(`decoy${k}`, 4)];
    await b.capture({ runId: `decoy${k}`, cur: decoy, input: decoy, flagged: [] });
  }
  const r = b.check({ lineSets: [D] });
  assert.equal(r.ok, false, 'still refused after eight decoys');
  assert.deepEqual(r.changed, [3]);
});

// Gap item G3: one damaged entry fails the whole store closed.
test('a store with one damaged entry fails closed and is not written over', async () => {
  const file = path.join(tmpDir(), 'b.json');
  const b = ledger({ file });
  const cur = song('dm');
  await b.capture({ runId: 'dm', cur, input: cur, flagged: [2] });
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  raw.free[0].fo[1] = raw.free[0].fo[1].slice(0, 5);
  const damaged = JSON.stringify(raw);
  fs.writeFileSync(file, damaged);
  const log = quiet();
  const again = new BriefLedger({ file, key: KEY, log });
  assert.equal(again.healthy, false);
  assert.ok(log.lines.some((l) => l.includes('damaged')));
  const other = song('dm2');
  await again.capture({ runId: 'dm2', cur: other, input: other, flagged: [1] });
  assert.equal(fs.readFileSync(file, 'utf8'), damaged, 'the evidence is not written over');
  assert.equal(again.recover(), false, 'still damaged');
  // Repaired: the entry is whole again.
  fs.writeFileSync(file, JSON.stringify({ ...raw, free: [] }));
  assert.equal(again.recover(), true);
});

// Gap item G4: a ledger file whose key is new on every start says so.
test('createBriefLedger warns when the file is set but the key is new on every start', () => {
  const dir = tmpDir();
  const log = quiet();
  const b = createBriefLedger({ BRIEF_LEDGER_FILE: path.join(dir, 'x.json') }, { log });
  assert.equal(b.ephemeralKey, true);
  assert.ok(
    log.lines.some((l) => /WARNING: BRIEF_LEDGER_FILE is set/.test(l)),
    log.lines.join('\n')
  );
  const quietLog = quiet();
  const durable = createBriefLedger(
    { BRIEF_LEDGER_FILE: path.join(dir, 'y.json'), CHAT_SECRET: 'd'.repeat(64) },
    { log: quietLog }
  );
  assert.equal(durable.ephemeralKey, false);
  assert.deepEqual(quietLog.lines, []);
  assert.equal(createBriefLedger({}, { log: quiet() }).ephemeralKey, false, 'memory only');
});

// The resume path (item 1) records a wire on the run's own entry.
test('mint adds a wire to the run entry only', async () => {
  const b = ledger();
  const cur = song('mi');
  assert.equal(b.mint({ runId: 'none', wire: 'w0' }), false);
  await b.capture({ runId: 'mi', cur, input: cur, flagged: [1] });
  assert.equal(b.minted('w1'), false);
  assert.equal(b.mint({ runId: 'mi', wire: 'w1' }), true);
  assert.equal(b.minted('w1'), true);
  assert.equal(b.check({ lineSets: [cur], wires: ['w1'] }).ok, true);
});

// Andrej's review G2: a run under other declarations asks about a protected
// line for its own flag; that must not retire the entry that protects it.
test('a run under other declarations does not supersede an entry that guards a line', async () => {
  const b = ledger();
  const cur = song('dd');
  const plan = { scheme: 'AAAAAAAA', relation: 'class:RHYME' };
  const lax = { scheme: 'XAAAAAAA', relation: 'class:RHYME' };
  await b.capture({ runId: 'd1', cur, input: cur, flagged: [3], decl: plan });
  // Keys in another order are the same declarations.
  assert.equal(b.declDigest(plan), b.declDigest({ relation: 'class:RHYME', scheme: 'AAAAAAAA' }));
  assert.equal(b.check({ runId: 'd2', lineSets: [cur], decl: plan }).supersedes.length, 1);
  const c = b.check({ runId: 'd3', lineSets: [cur], decl: lax });
  assert.deepEqual(c.supersedes, []);
  // d3 asks about line 3 under its own declarations, and is then certified.
  await b.capture({
    runId: 'd3',
    cur,
    input: cur,
    briefed: [3],
    decl: lax,
    supersedes: c.supersedes,
    inherited: c.inherited,
  });
  const edit = cur.slice();
  edit[2] = 'hand edit';
  assert.deepEqual(b.check({ lineSets: [edit], decl: plan }).changed, [3]);
  b.forget({ runId: 'd3', supersedes: c.supersedes });
  assert.deepEqual(b.check({ lineSets: [edit], decl: plan }).changed, [3]);
  // An entry that guards nothing is superseded under any declarations.
  const idle = song('dd-idle');
  await b.capture({ runId: 'd4', cur: idle, input: idle, decl: plan });
  assert.equal(b.check({ lineSets: [idle], decl: lax }).supersedes.length, 1);
  // The digest is kept on disk and read back; a damaged one fails closed.
  const file = path.join(tmpDir(), 'dd.json');
  const disk = ledger({ file });
  await disk.capture({ runId: 'd5', cur, input: cur, flagged: [3], decl: plan });
  const [id] = disk.free.keys();
  assert.equal(ledger({ file }).get(id).dd, disk.declDigest(plan));
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  raw.free[0].dd = 'short';
  fs.writeFileSync(file, JSON.stringify(raw));
  assert.equal(ledger({ file }).healthy, false);
});
