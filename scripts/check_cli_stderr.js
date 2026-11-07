#!/usr/bin/env node
// Gate: scripts/recipe.js writes the SAME stderr bytes, and the same exit
// code, to a pipe as it does to a file, and those bytes say what they must.
//
// @covers: cli-stderr-complete
//
// Usage: node scripts/check_cli_stderr.js [ROOT] [--self-test]
//   ROOT defaults to the checkout this file is in (scripts/..).
//   --self-test also runs the controls below: a 4 MiB stderr write with and
//   without a forced process.exit(0), a stalled child, and two in-memory edits
//   of recipe.js's note loop. check:cli (so CI) runs it WITH --self-test: the
//   controls anchor on exact recipe.js lines, and a refactor that moves one
//   must fail here, not leave the controls unrun (about 15 s more than the
//   cases alone).
//
// Issue #815, to BB8's acceptance contract (comment 6687985836). Written by
// 3PO (candidate V3, built on ccfd3bc85); registered here beside
// check_cli_output.js, which gates stdout and is left as it is.
//
// No production files are modified. File-backed stderr is the transport oracle;
// explicit shape/note assertions prevent consistently absent diagnostics passing.
'use strict';
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const argv = process.argv.slice(2);
const unknown = argv.filter((a) => a.startsWith('-') && a !== '--self-test');
const positional = argv.filter((a) => !a.startsWith('-'));
if (unknown.length || positional.length > 1) {
  console.error(
    `check_cli_stderr: usage: node scripts/check_cli_stderr.js [ROOT] [--self-test] (got ${argv.join(' ')})`
  );
  process.exit(2);
}
const root = path.resolve(positional[0] || path.join(__dirname, '..'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-stderr-815-'));
const active = new Set();
const TIMEOUT = 15000,
  HOLD = 200,
  REPEATS = 3,
  CONCURRENCY = 4;
let serial = 0,
  cancelled = false;
const started = Date.now();
const filtered =
  "note: --swap-variant descriptor(s) not printed in the sampler_classic card's part of the recipe: modern (sampler_archetypes:mpc_modern)";
const absent =
  'note: banjo_5_string is not in the recipe, so --swap-variant banjo_5_string:banjo_back:resonator was not applied (add it with --add-instrument=banjo_5_string)';
const removed =
  'note: sampler_classic is not in the recipe, so --swap-variant sampler_classic:sampler_archetypes:mpc_modern was not applied (--exclude-instrument removed it)';
const filterArg = '--swap-variant=sampler_classic:sampler_archetypes:mpc_modern';
const absentArg = '--swap-variant=banjo_5_string:banjo_back:resonator';
const cases = [
  ['plain', [], []],
  ['json', ['--json'], []],
  ['why', ['--why'], []],
  ['json-why', ['--json', '--why'], []],
  ['why-json', ['--why-json'], []],
  ['json-why-json', ['--json', '--why-json'], []],
  ['filtered', [filterArg], [filtered]],
  ['absent-json', ['--json', absentArg], [absent]],
  ['removed', ['--exclude-instrument=sampler_classic', filterArg], [removed]],
  ['filtered-why-json', ['--why-json', filterArg], [filtered]],
  ['absent-json-why-json', ['--json', '--why-json', absentArg], [absent]],
  ['filtered-prefaces-json', ['--why-prefaces-json', filterArg], [filtered]],
].map(([name, args, notes]) => ({
  name,
  args: ['scripts/recipe.js', '--tradition', 'gangsta_rap', ...args],
  notes,
}));
const replaced =
  'note: --swap-variant drum_kit:bearing_edges:edge_round was replaced by a later --swap-variant for the same part (edge_45)';
const repeated =
  "note: only the last --swap-variant is read, so --swap-variant=drum_kit:bearing_edges:edge_round was not (to give several, separate them with ';' in one --swap-variant)";
for (const json of [false, true]) {
  for (const [name, flags, note] of [
    [
      'replaced',
      ['--swap-variant=drum_kit:bearing_edges:edge_round;drum_kit:bearing_edges:edge_45'],
      replaced,
    ],
    [
      'repeated',
      [
        '--swap-variant=drum_kit:bearing_edges:edge_round',
        '--swap-variant=drum_kit:bearing_edges:edge_45',
      ],
      repeated,
    ],
  ])
    cases.push({
      name: name + (json ? '-why-json' : ''),
      args: [
        'scripts/recipe.js',
        '--tradition',
        'italogaze',
        ...flags,
        ...(json ? ['--why-json'] : []),
      ],
      notes: [
        note,
        "note: --swap-variant descriptor(s) not printed in the drum_kit card's part of the recipe: attacky, modern (bearing_edges:edge_45)",
      ],
    });
}
cases.push({
  name: 'large-blend-why-json',
  args: [
    'scripts/recipe.js',
    '--traditions',
    'bluegrass,thrash_metal,afrobeat,gangsta_rap,delta_blues,detroit_techno',
    '--why-json',
  ],
  notes: [],
  minStderr: 65536,
  jsonPrefix:
    'note: blending 6 traditions; recipes are tuned for up to 3, so output may be noisy.\n',
});
// The one case whose stderr cannot fit in the pipe: Linux gives the child a
// socketpair holding 208 KiB (212,992 B, net.core.wmem_default), and this
// --json --why-json blend writes more than twice that (449,254 B measured), so
// a --json exit that does not wait for stderr loses bytes here (BB8, #828).
// minStderr is that 2 x 208 KiB: a wording trim that took the case under it
// would let the case fit again, so the gate fails instead. The 17 ids are the
// smallest pinned blend found that clears it with margin (greedy on distinct
// slots; 16 cleared it by under 2%).
cases.push({
  name: 'pipe-overflow-json-why-json',
  args: [
    'scripts/recipe.js',
    '--traditions',
    'musique_comorienne,symphonic,british_invasion_rb,historical_informed_performance,carnatic_instrumental,nordic_folk,chinese_traditional_ensemble,musique_guadeloupe,french_indietronica,hindustani,video_game_music,samba,mande_griot,nepali_indie,persian_dastgah,celtic_irish_trad,classic_bhangra',
    '--json',
    '--why-json',
  ],
  notes: [],
  minStderr: 2 * 212992,
  // About 5.4 s alone and up to 8.2 s with CONCURRENCY children on a 4-core
  // box: too close to the shared 15 s for a slow runner, so this case alone
  // gets 30 s (BB8, #828). A timeout still fails under the case's name.
  timeout: 30000,
  jsonPrefix:
    'note: blending 17 traditions; recipes are tuned for up to 3, so output may be noisy.\n',
});
const kill = (c) => {
  try {
    if (process.platform !== 'win32') process.kill(-c.pid, 'SIGKILL');
    else c.kill('SIGKILL');
  } catch (e) {
    if (e.code !== 'ESRCH') throw e;
  }
};
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    cancelled = true;
    for (const c of active) kill(c);
    process.exitCode = 1;
  });
async function run(args, file = false, timeout = TIMEOUT, forceExit = false) {
  if (cancelled) throw new Error('gate cancelled');
  const outPath = path.join(temp, `${++serial}.out`),
    errPath = path.join(temp, `${serial}.err`);
  const outFd = file ? fs.openSync(outPath, 'w') : null,
    errFd = file ? fs.openSync(errPath, 'w') : null;
  let c;
  try {
    c = spawn(process.execPath, args, {
      cwd: root,
      detached: process.platform !== 'win32',
      stdio: ['ignore', file ? outFd : 'pipe', file ? errFd : 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '', CLI815_EXIT: forceExit ? '1' : '0' },
    });
  } finally {
    if (outFd !== null) fs.closeSync(outFd);
    if (errFd !== null) fs.closeSync(errFd);
  }
  active.add(c);
  let hold,
    timedOut = false,
    error,
    bytes = 0;
  const chunks = [],
    outChunks = [];
  let outBytes = 0;
  if (!file)
    c.stdout.on('data', (b) => {
      outBytes += b.length;
      if (outBytes > 16 * 1024 * 1024) {
        error = new Error('stdout exceeds 16 MiB capture limit');
        kill(c);
      } else outChunks.push(b);
    });
  const drain = () => {
    clearTimeout(hold);
    c.stderr?.removeListener('readable', first);
    c.stderr?.on('data', (b) => {
      bytes += b.length;
      if (bytes > 16 * 1024 * 1024) {
        error = new Error('stderr exceeds 16 MiB capture limit');
        kill(c);
      } else chunks.push(b);
    });
    c.stderr?.resume();
  };
  // Hold starts when output is actually available, not while the catalog loads.
  const first = () => {
    c.stderr.removeListener('readable', first);
    hold = setTimeout(drain, HOLD);
  };
  if (!file) {
    c.stderr.once('readable', first);
    c.once('exit', () => {
      if (!c.stderr.readableFlowing) drain();
    });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    kill(c);
  }, timeout);
  c.on('error', (e) => {
    error = e;
  });
  return await new Promise((resolve) =>
    c.on('close', (code, signal) => {
      clearTimeout(timer);
      clearTimeout(hold);
      active.delete(c);
      const out = file ? fs.readFileSync(outPath) : Buffer.concat(outChunks),
        err = file ? fs.readFileSync(errPath) : Buffer.concat(chunks);
      if (file) {
        fs.rmSync(outPath);
        fs.rmSync(errPath);
      }
      resolve({ code, signal, error, timedOut, out, err });
    })
  );
}
function valid(c, r) {
  assert.ifError(r.error);
  assert.equal(r.timedOut, false, `${c.name}: timeout`);
  assert.equal(r.signal, null);
  assert.equal(r.code, 0);
  if (c.minStderr)
    assert.ok(
      r.err.length >= c.minStderr,
      `${c.name}: stderr is ${r.err.length} bytes, under this case's floor of ${c.minStderr}`
    );
  const text = r.err.toString('utf8');
  if (c.args.includes('--json')) assert.ok(JSON.parse(r.out).config);
  else assert.ok(r.out.length > 0);
  if (c.args.includes('--why-json') || c.args.includes('--why-prefaces-json')) {
    if (c.jsonPrefix) assert.ok(text.startsWith(c.jsonPrefix), 'literal blend prefix missing');
    const j = JSON.parse(c.jsonPrefix ? text.slice(c.jsonPrefix.length) : text);
    assert.ok(Object.hasOwn(j, 'notes'), 'literal notes key missing');
    assert.deepEqual(j.notes, c.notes, 'literal notes mismatch');
    if (c.args.includes('--why-json')) {
      assert.ok(j.slots.length);
      assert.ok(Array.isArray(j.trace));
      assert.equal(typeof j.finalScore, 'number');
    } else assert.ok(j.prefaces.length);
  } else {
    assert.deepEqual(
      text.split('\n').filter((x) => x.startsWith('note: ')),
      c.notes,
      'literal notes mismatch'
    );
    if (c.args.includes('--why')) {
      assert.ok(text.includes('=== --why: per-slot variant selection ==='));
      assert.ok(text.includes('=== --why: search trace ==='));
      assert.match(text, /final score: -?\d+\.\d{2}\n/);
    }
    if (!c.args.includes('--json'))
      assert.ok(text.endsWith(`(${r.out.toString('utf8').replace(/\n$/, '').length} chars)\n`));
    else if (!c.args.includes('--why'))
      assert.equal(text, c.notes.length ? c.notes.join('\n') + '\n' : '');
  }
}
function equal(ref, r, label) {
  assert.ok(!r.error, `${label}: spawn error: ${r.error && r.error.message}`);
  assert.equal(r.timedOut, false, `${label}: timeout`);
  assert.equal(r.signal, null, `${label}: signal ${r.signal}`);
  assert.equal(r.code, ref.code, `${label}: exit ${r.code}, reference ${ref.code}`);
  assert.equal(r.signal, ref.signal, `${label}: signal ${r.signal}, reference ${ref.signal}`);
  assert.ok(
    ref.err.equals(r.err),
    `${label}: stderr mismatch expected=${ref.err.length} actual=${r.err.length}`
  );
  assert.ok(ref.out.equals(r.out), `${label}: stdout changed`);
}
async function pool(jobs) {
  let cursor = 0;
  const failures = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        try {
          await job();
        } catch (e) {
          failures.push(e);
        }
      }
    })
  );
  if (failures.length)
    throw new AggregateError(failures, failures.map((e) => e.message).join('\n'));
}
async function main() {
  console.log(
    `Runtime ${process.version} ${process.platform}; normalization=none; baseline file/file, probe pipe/pipe`
  );
  const refs = new Map();
  await pool(
    cases.map((c) => async () => {
      const r = await run(c.args, true, c.timeout || TIMEOUT);
      valid(c, r);
      refs.set(c.name, r);
    })
  );
  await pool(
    cases.flatMap((c) =>
      Array.from({ length: REPEATS }, (_, i) => async () => {
        const r = await run(c.args, false, c.timeout || TIMEOUT);
        // Bytes first: a pipe that lost a JSON stderr's tail is a stderr
        // mismatch against the file reference, not a JSON parse error.
        equal(refs.get(c.name), r, `${c.name} repeat ${i + 1}`);
        valid(c, r);
      })
    )
  );
  for (const c of cases) {
    const r = refs.get(c.name);
    console.log(
      `PASS ${c.name}: stdout=${r.out.length} exit=${r.code} stderr=${r.err.length} bytes sha256=${crypto.createHash('sha256').update(r.err).digest('hex')} repeats=${REPEATS}`
    );
  }
  if (process.argv.includes('--self-test')) {
    // Transform only this process's in-memory compilation of the actual CLI.
    // Append JSON whitespace immediately at its success exit point, then optionally
    // reintroduce process.exit(0). Identical file reference, independent known size.
    const preload = path.join(temp, 'mutation.cjs');
    fs.writeFileSync(
      preload,
      `const Module=require('node:module'); const orig=Module.prototype._compile;\nModule.prototype._compile=function(src,file){ if(file===require('node:path').resolve('scripts/recipe.js')) { const needle='process.exitCode = 0;\\n  return;'; if(src.split(needle).length!==2) throw Error('mutation anchor absent/ambiguous'); src=src.replace(needle, "process.stderr.write(' '.repeat(4 * 1024 * 1024)); " + (process.env.CLI815_EXIT==='1' ? 'process.exit(0);' : 'process.exitCode = 0; return;')); } return orig.call(this,src,file); };\n`
    );
    const args = ['--require', preload, ...cases.find((c) => c.name === 'json-why-json').args];
    const ordinary = refs.get('json-why-json');
    const good = await run(args, true);
    assert.equal(good.err.length, ordinary.err.length + 4 * 1024 * 1024);
    assert.ok(good.err.subarray(0, ordinary.err.length).equals(ordinary.err));
    JSON.parse(good.err);
    await pool(
      Array.from(
        { length: REPEATS },
        () => async () => equal(good, await run(args), 'large natural-exit control')
      )
    );
    console.log(
      `PASS large natural-exit control: complete=${good.err.length} bytes repeats=${REPEATS}`
    );
    {
      const badRef = await run(args, true, TIMEOUT, true);
      equal(good, badRef, 'mutation file control');
      await pool(
        Array.from({ length: REPEATS }, (_, i) => async () => {
          const bad = await run(args, false, TIMEOUT, true);
          let jsonParseable = true;
          try {
            JSON.parse(bad.err);
          } catch {
            jsonParseable = false;
          }
          assert.equal(bad.code, 0);
          assert.equal(bad.timedOut, false);
          assert.ifError(bad.error);
          assert.throws(() => equal(badRef, bad, 'planted process.exit(0)'), /stderr mismatch/);
          console.log(
            `PASS rejected process.exit(0) control ${i + 1}: expected=${badRef.err.length} actual=${bad.err.length} bytes json_parseable=${jsonParseable}`
          );
        })
      );
    }
    const hung = await run(
      ['-e', 'process.stderr.write("started\\n"); setInterval(()=>{},1000)'],
      false,
      400
    );
    assert.equal(hung.timedOut, true);
    assert.equal(hung.signal, 'SIGKILL');
    assert.equal(active.size, 0);
    console.log('PASS timeout control: killed and reaped stalled child; active=0');
    // Actual CLI source mutations, applied in memory only. Both file and pipe
    // see the same defect, so transport passes and only literal content rejects.
    for (const mutation of ['delete-note', 'change-note']) {
      const notePreload = path.join(temp, mutation + '.cjs');
      const needle = 'for (const note of notes) console.error(note);';
      const replacement =
        mutation === 'delete-note'
          ? 'for (const note of notes) {}'
          : "for (const note of notes) console.error(note.replace('not printed', 'CHANGED TEXT'));";
      fs.writeFileSync(
        notePreload,
        `const Module=require('node:module'), orig=Module.prototype._compile; Module.prototype._compile=function(src,file) {if(file===require('node:path').resolve('scripts/recipe.js')) {const needle=${JSON.stringify(needle)}; if(src.split(needle).length!==2) throw Error('note mutation anchor absent/ambiguous'); src=src.replace(needle,${JSON.stringify(replacement)});} return orig.call(this,src,file);};`
      );
      const c = cases.find((c) => c.name === 'filtered');
      const argv = ['--require', notePreload, ...c.args];
      const ref = await run(argv, true);
      assert.equal(ref.code, 0);
      assert.equal(ref.timedOut, false);
      assert.ifError(ref.error);
      assert.throws(() => valid(c, ref), /literal notes mismatch/);
      await pool(
        Array.from({ length: REPEATS }, () => async () => {
          const r = await run(argv);
          equal(ref, r, mutation + ' transport');
          assert.throws(() => valid(c, r), /literal notes mismatch/);
        })
      );
      console.log(
        `PASS ${mutation} actual CLI: transport equality PASS; literal content REJECTED file + ${REPEATS} piped runs`
      );
    }
  }
  console.log(
    `PASS total: cases=${cases.length} piped=${cases.length * REPEATS} concurrency=${CONCURRENCY} elapsed_ms=${Date.now() - started} active=${active.size}`
  );
}
main()
  .catch((e) => {
    console.error(e.stack);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const c of active) kill(c);
    fs.rmSync(temp, { recursive: true, force: true });
  });
