#!/usr/bin/env node
// check_publish_guard.js — the publish guard stands down on the real race and
// gets out of the way the rest of the time.
//
// A workflow file is not covered by any other gate in this repo, which is how
// sync-pages.yml shipped a stale live artifact twice on consecutive merge pairs
// without anything going red. The decision it gets wrong is now a script
// (publish_guard.sh), and this drives that script against a synthetic repository
// that replays the exact sequence.
//
// Each case builds a throwaway git repo, so this touches nothing real and needs
// no network.
//
// Usage: node scripts/check_publish_guard.js [--verbose]
// Exit 0 if every case behaves, 1 otherwise.

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GUARD = path.join(ROOT, 'scripts', 'publish_guard.sh');
const VERBOSE = process.argv.includes('--verbose');

const PUBLISH = 0;
const STAND_DOWN = 10;

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pubguard-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'T',
        GIT_AUTHOR_EMAIL: 't@e',
        GIT_COMMITTER_NAME: 'T',
        GIT_COMMITTER_EMAIL: 't@e',
        // A signing key may be configured globally; never sign throwaway commits.
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_SYSTEM: '/dev/null',
      },
    });
  git('init', '-q', '-b', 'main');
  const write = (p, s) => {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), s);
  };
  const commit = (msg) => {
    git('add', '-A');
    git('commit', '-q', '-m', msg);
    return git('rev-parse', 'HEAD').trim();
  };
  // Seed: source + the generated artifacts the publish job overwrites.
  write('src/app.js', 'v1\n');
  write('references/02_instruments.js', 'data v1\n');
  write('codex.html', 'built from v1\n');
  write('llms.txt', 'discovery v1\n');
  write('api/index.json', '{"v":1}\n');
  const base = commit('base');
  // origin/main is what the publish job fetches; model it as a real ref.
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  const setOrigin = () => git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  return { dir, git, write, commit, base, setOrigin };
}

function runGuard(dir, builtSha) {
  try {
    const out = execFileSync('bash', [GUARD], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, BUILT_SHA: builtSha },
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const results = [];
const check = (name, got, want, detail) => {
  const ok = got === want;
  results.push({ name, ok, got, want, detail });
  if (VERBOSE || !ok) {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} — exit ${got}, wanted ${want}`);
    if (!ok && detail)
      console.log(
        String(detail)
          .split('\n')
          .slice(0, 6)
          .map((l) => '       ' + l)
          .join('\n')
      );
  }
};

// ── 1. Nothing moved: publish. ───────────────────────────────────────────────
{
  const r = makeRepo();
  const res = runGuard(r.dir, r.base);
  check('nothing moved -> publish', res.code, PUBLISH, res.out);
}

// ── 2. THE RACE: main gained a newer merge with source changes. Stand down. ──
// This is the exact shape that shipped a stale codex.html twice: we built an
// older commit, someone else's merge landed, and without a guard we would copy
// our older build over the top of it.
{
  const r = makeRepo();
  const built = r.base;
  r.write('src/app.js', 'v2 — a later PR changed the app\n');
  r.commit('merge a newer PR');
  r.setOrigin();
  const res = runGuard(r.dir, built);
  check('newer source merged -> stand down', res.code, STAND_DOWN, res.out);
}

// ── 3. main's tip is an AUTO-PUBLISH commit: still publish. ──────────────────
// The critical false-positive case. main's tip is almost always an auto-publish
// commit, which rewrites ONLY generated outputs. A sha comparison would refuse
// every real publish here; a source comparison must see through it.
{
  const r = makeRepo();
  const built = r.base;
  r.write('codex.html', 'a previous publish wrote this\n');
  r.write('llms.txt', 'discovery regenerated\n');
  r.write('api/index.json', '{"v":"republished"}\n');
  r.commit('Auto-publish site (codex.html + static API)');
  r.setOrigin();
  const res = runGuard(r.dir, built);
  check('tip is an auto-publish commit -> publish', res.code, PUBLISH, res.out);
}

// ── 4. A newer merge AND an auto-publish on top: stand down. ────────────────
// The generated outputs must not mask a real source change underneath them.
{
  const r = makeRepo();
  const built = r.base;
  r.write('references/02_instruments.js', 'data v2\n');
  r.commit('merge a newer PR that changes the catalog');
  r.write('codex.html', 'published from v2\n');
  r.commit('Auto-publish site (codex.html + static API)');
  r.setOrigin();
  const res = runGuard(r.dir, built);
  check('newer source hidden under a publish commit -> stand down', res.code, STAND_DOWN, res.out);
}

// ── 5. index.html / AGENTS.md are inputs, not outputs. ──────────────────────
// sync-pages copies both through verbatim from the built ref, so a change to
// either on main means main moved past us.
{
  const r = makeRepo();
  const built = r.base;
  r.write('index.html', 'landing page edited on main\n');
  r.commit('edit the landing page');
  r.setOrigin();
  const res = runGuard(r.dir, built);
  check('index.html changed on main -> stand down', res.code, STAND_DOWN, res.out);
}

// ── 6. Refuse to run blind. ─────────────────────────────────────────────────
// An unset or bogus BUILT_SHA must fail loudly rather than default to publishing.
{
  const r = makeRepo();
  let code;
  try {
    execFileSync('bash', [GUARD], {
      cwd: r.dir,
      encoding: 'utf8',
      env: { ...process.env, BUILT_SHA: '' },
    });
    code = 0;
  } catch (e) {
    code = e.status;
  }
  check('empty BUILT_SHA -> hard error (not a publish)', code, 1);

  const bogus = runGuard(r.dir, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
  check('unknown BUILT_SHA -> hard error (not a publish)', bogus.code, 1, bogus.out);
}

// ── 7. The WORKFLOW actually reaches the guard. ─────────────────────────────
// Cases 1-6 prove the script decides correctly. They proved nothing about
// whether sync-pages.yml calls it correctly, and the first live run failed on
// exactly that gap: BUILT_SHA was assigned as a plain shell variable, so the
// guard — a child process — never saw it and refused to run. Testing a script
// in isolation while its only caller is broken is the shape of a green suite
// over a broken pipeline, so the wiring is asserted here too.
{
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'sync-pages.yml'), 'utf8');
  const callsGuard = /publish_guard\.sh/.test(wf);
  check('workflow invokes the guard', callsGuard ? 1 : 0, 1);

  // BUILT_SHA must cross the process boundary: either exported, or set inline on
  // the guard invocation itself.
  const exported =
    /^\s*export\s+BUILT_SHA\b/m.test(wf) || /BUILT_SHA=\S+\s+bash\s+\S*publish_guard\.sh/.test(wf);
  check('workflow exports BUILT_SHA so the child process sees it', exported ? 1 : 0, 1, wf);

  // Exit 10 must be treated as a clean no-op, not a failure.
  const handlesTen = /\b10\b/.test(wf) && /publish_guard/.test(wf);
  check('workflow handles the stand-down exit code', handlesTen ? 1 : 0, 1);

  // Ordering assertions run over EXECUTABLE lines only. Both this file and the
  // workflow discuss `git checkout -B main` in prose, and matching a comment
  // instead of the command is how an ordering check silently measures nothing.
  const codeLines = wf
    .split('\n')
    .map((l, i) => ({ i, t: l.trim() }))
    .filter((l) => l.t && !l.t.startsWith('#'));
  const lineOf = (needle) => {
    const hit = codeLines.find((l) => l.t.includes(needle));
    return hit ? hit.i : -1;
  };
  const guardLine = lineOf('publish_guard.sh');
  const switchLine = lineOf('git checkout -B main');
  const shaLine = lineOf('BUILT_SHA=$(git rev-parse HEAD)');

  // The guard has to run BEFORE the branch switch clobbers what we built.
  check(
    'guard runs before the branch switch',
    guardLine >= 0 && switchLine > guardLine ? 1 : 0,
    1,
    `guard@${guardLine} switch@${switchLine}`
  );

  // And BUILT_SHA must be captured before that switch, or it names main's tip —
  // the original defect that made every stale publish look correctly labelled.
  check(
    'BUILT_SHA captured before the branch switch',
    shaLine >= 0 && switchLine > shaLine ? 1 : 0,
    1,
    `sha@${shaLine} switch@${switchLine}`
  );
}

console.log('=== Publish guard (stale-artifact race) ===');
const failed = results.filter((r) => !r.ok);
console.log(`  ${results.length - failed.length}/${results.length} case(s) behaved`);
if (results.length === 0) {
  console.error('FAIL — no cases ran; refusing to pass vacuously');
  process.exit(1);
}
if (failed.length > 0) {
  for (const f of failed) console.error(`  FAIL ${f.name}: exit ${f.got}, wanted ${f.want}`);
  console.error(
    'FAIL — the publish guard would let a stale artifact go live, or block a good one.'
  );
  process.exit(1);
}
console.log('PASS — the guard stands down on the race and stays out of the way otherwise.');
process.exit(0);
