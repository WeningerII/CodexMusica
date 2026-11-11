#!/usr/bin/env node
'use strict';
// Exercise the workflow's coordinates and fixed-check ownership. The existing
// run_parallel/faults fan-ins prove executed coverage; these contracts catch a
// mismatched workflow before runners spend time on an incomplete matrix.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
// js-yaml is installed by the root lockfile's ESLint dependency tree.
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const workflow = yaml.load(fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const runs = (job) => job.steps.filter((step) => typeof step.run === 'string');
const command = (job, pattern) => runs(job).filter((step) => pattern.test(step.run));
const allCommands = (job) =>
  runs(job)
    .map((step) => step.run)
    .join('\n');
const affected = "needs.gate.outputs.artifacts_affected == 'true'";

function matrix(job, count, label) {
  assert.deepEqual(
    job.strategy.matrix.shard,
    Array.from({ length: count }, (_, i) => i + 1),
    `${label} matrix must contain every coordinate`
  );
  assert.equal(job.strategy['fail-fast'], false, `${label} must retain every shard's verdict`);
  assert.ok(job.name.endsWith(`/` + count + ')'), `${label} job name must match its matrix`);
  assert.ok(!job['continue-on-error'], `${label} failures must fail CI`);
}

function checkMatrices(w) {
  const { jobs } = w;
  matrix(jobs['verify-shard'], 8, 'verify');
  matrix(jobs.suites, 8, 'suites');
  matrix(jobs.faults, 6, 'faults');
  const verifyRun = command(jobs['verify-shard'], /run_parallel\.js test:ci:serial/);
  assert.equal(verifyRun.length, 1, 'verify must run one complete leaf partition per shard');
  assert.match(verifyRun[0].run, /--shard=\$\{\{\s*matrix\.shard\s*\}\}\/8\b/);
  assert.match(verifyRun[0].run, /--record=/, 'verify must record executed leaves');
  const verifyFan = command(jobs.verify, /run_parallel\.js test:ci:serial.*--verify-shards=/);
  assert.equal(verifyFan.length, 1, 'verify must keep the exact-coverage fan-in');
  assert.match(verifyFan[0].run, /--shards=8\b/, 'verify fan-in must require all eight records');
  for (const entry of [verifyRun[0], verifyFan[0]])
    assert.match(entry.run, /--costs=scripts\/ci_verify_costs\.json\b/);

  assert.equal(Number(jobs.suites.env.SUITES_SHARDS), 8, 'suites environment must match matrix');
  assert.equal(jobs.suites.env.SUITES_SHARD, '${{ matrix.shard }}');
  const pool = command(jobs.suites, /SUITES_SHARD/);
  assert.equal(pool.length, 1, 'the full suites pool must have one owner');
  // quality/test_shard.py executes this shell with a per-command environment
  // recorder and proves the rotated and ordinary panels are each a full deal.
  assert.equal(pool[0].env.TEST_RELATIONS_NULL_SHARD, '${{ matrix.shard }}/8');

  const injection = command(jobs.faults, /node scripts\/faults\.js /);
  assert.equal(injection.length, 1, 'faults must retain its injection step');
  assert.equal(
    [...injection[0].run.matchAll(/--shard=\$\{\{\s*matrix\.shard\s*\}\}\/6\b/g)].length,
    2,
    'both affected and documentation-only diffs must run all six fault partitions'
  );
  assert.doesNotMatch(
    injection[0].run,
    /--only[=\s]/,
    'fault partitions cannot select a test subset'
  );
  assert.match(injection[0].run, /--record=/);
  const faultFan = command(jobs.freshness, /node scripts\/faults_shards\.js /);
  assert.equal(faultFan.length, 1, 'freshness must keep the complete fault fan-in');
  assert.match(
    faultFan[0].run,
    /faults-records["']?\s+6\s*$/,
    'fault fan-in must require six records'
  );
}

function checkGates(w) {
  const expectedNeeds = {
    verify: ['dup', 'gate', 'verify-shard'],
    freshness: ['dup', 'gate', 'freshness-build', 'faults'],
    'suites-result': ['dup', 'gate', 'suites'],
  };
  for (const [name, needs] of Object.entries(expectedNeeds)) {
    const job = w.jobs[name];
    assert.deepEqual(job.needs, needs, `${name} must wait for every required producer`);
    assert.equal(job.if, "${{ !cancelled() && needs.dup.outputs.already_covered != 'true' }}");
    assert.ok(!job['continue-on-error'], `${name} must fail on incomplete work`);
    const result = allCommands(job);
    assert.match(result, /success/, `${name} must require successful producer results`);
    assert.match(result, /exit 1/, `${name} must fail on a rejected producer result`);
    for (const step of job.steps)
      assert.ok(!step['continue-on-error'], `${name} cannot ignore its coverage gate`);
  }
  assert.deepEqual(w.jobs.faults.needs, ['dup', 'gate', 'freshness-build']);
  assert.equal(
    w.jobs.faults.if,
    "${{ !cancelled() && needs.dup.outputs.already_covered != 'true' }}"
  );
  assert.equal(w.jobs['verify-shard'].if, "needs.dup.outputs.already_covered != 'true'");
  assert.equal(w.jobs.suites.if, "needs.dup.outputs.already_covered != 'true'");
}

function checkBuildHandoff(w) {
  const producer = w.jobs['freshness-build'];
  const consumer = w.jobs.faults;
  const compare = command(producer, /scripts\/check_artifact_fresh\.js --prebuilt-api=/);
  const receipt = command(producer, /scripts\/artifact_build_cache\.js record /);
  const archive = command(producer, /tar -czf .*verified-fresh-build\.tar\.gz/);
  assert.equal(compare.length, 1, 'freshness comparison must precede build sharing');
  assert.equal(receipt.length, 1, 'shared build must carry a source/runtime inventory');
  assert.equal(archive.length, 1, 'shared build must archive one complete verified pair');
  assert.equal(receipt[0].if, affected, 'inventory must be recorded on cold builds and cache hits');
  assert.equal(receipt[0].env.EXPECTED_KEY, '${{ steps.artifact-key.outputs.key }}');
  assert.match(receipt[0].run, /"\$EXPECTED_KEY"/);
  assert.match(archive[0].run, /api codex\.html artifact-build\.json\s*$/);
  const upload = producer.steps.filter(
    (step) =>
      step.uses?.startsWith('actions/upload-artifact@') &&
      /verified-fresh-build/.test(step.with.name)
  );
  const download = consumer.steps.filter(
    (step) =>
      step.uses?.startsWith('actions/download-artifact@') &&
      /verified-fresh-build/.test(step.with.name)
  );
  assert.equal(upload.length, 1, 'one verified build must be shared per run');
  assert.equal(download.length, 1, 'each fault shard must receive the same verified build');
  assert.equal(upload[0].with.name, 'verified-fresh-build-${{ github.run_attempt }}');
  assert.equal(upload[0].with.name, download[0].with.name);
  assert.equal(upload[0].with['if-no-files-found'], 'error');
  assert.equal(upload[0].if, affected);
  assert.equal(download[0].if, affected);
  assert.ok(!('run-id' in download[0].with), 'handoff must use this run, not another run');
  for (const [before, after] of [
    [compare[0], receipt[0]],
    [receipt[0], archive[0]],
    [archive[0], upload[0]],
  ])
    assert.ok(
      producer.steps.indexOf(before) < producer.steps.indexOf(after),
      'only verified bytes may be uploaded'
    );
  const admission = command(consumer, /scripts\/artifact_build_cache\.js admit /);
  assert.ok(admission.length, 'fault build admission must validate source/runtime and every byte');
  assert.ok(
    admission.some((step) => step.if === affected),
    'affected fault jobs must admit the downloaded pair'
  );
  assert.doesNotMatch(
    allCommands(consumer),
    /scripts\/build_(?:static_api|html)\.js/,
    'fault shards must share the build instead of rebuilding it'
  );
  assert.ok(!consumer.steps.some((step) => step.uses?.startsWith('actions/cache/restore@')));
  const restore = producer.steps.find((step) => step.id === 'artifact-cache');
  assert.match(
    restore.if,
    /github\.event_name != 'schedule'/,
    'scheduled producer must still build cold'
  );
}

// The injection step runs after other steps fail, so extracted file existence
// cannot replace the source/runtime and complete byte-inventory admission.
function checkInjectionAdmission(w) {
  const step = command(w.jobs.faults, /node scripts\/faults\.js /)[0];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-fault-admission-'));
  const log = path.join(dir, 'calls.jsonl');
  fs.mkdirSync(path.join(dir, 'fresh', 'api'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'fresh', 'codex.html'), 'extracted bytes');
  fs.writeFileSync(
    path.join(dir, 'node'),
    `#!${process.execPath}\nconst args=process.argv.slice(2); require('node:fs').appendFileSync(process.env.CI_SHARDING_CALLS,JSON.stringify(args)+'\\n'); if(args[0]==='scripts/artifact_build_cache.js'&&args[1]==='admit'&&process.env.CI_REJECT_ADMISSION==='1') process.exit(7);\n`,
    { mode: 0o755 }
  );
  const script = step.run
    .replace(/\$\{\{\s*matrix\.shard\s*\}\}/g, '1')
    .replace(/\$\{\{\s*needs\.gate\.outputs\.artifacts_affected\s*\}\}/g, 'true');
  try {
    for (const reject of ['0', '1']) {
      fs.writeFileSync(log, '');
      const result = spawnSync('bash', ['-eo', 'pipefail', '-c', script], {
        cwd: dir,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          RUNNER_TEMP: dir,
          CI_SHARDING_CALLS: log,
          CI_REJECT_ADMISSION: reject,
        },
      });
      const calls = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
      assert.equal(
        calls.filter((args) => args[0] === 'scripts/artifact_build_cache.js' && args[1] === 'admit')
          .length,
        1,
        'injection must admit the pair even after a preceding step fails'
      );
      const faultCalls = calls.filter((args) => args[0] === 'scripts/faults.js').length;
      if (reject === '1') {
        assert.notEqual(result.status, 0, 'rejected admission must fail the injection shell');
        assert.equal(faultCalls, 0, 'unadmitted bytes must never reach fault injection');
      } else {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(faultCalls, 1, 'admitted bytes must still run the fault partition');
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const fixedFiles = new Set([
  'expected_drift.py',
  'meter_bands.py',
  'search_null.py',
  'schema_end_reading.py',
  'schema_window.py',
  'door_census.py',
  'chance_rate.py',
  'e5_coda_adoption.py',
]);
function fixedSteps(w) {
  return runs(w.jobs.suites).filter((step) =>
    [...fixedFiles].some((file) =>
      new RegExp(`(?:^|\\n)\\s*python3 quality/${file.replaceAll('.', '\\.')}\\b`).test(step.run)
    )
  );
}

function ownsShard(condition, shard) {
  assert.ok(condition?.includes('always()'), 'fixed checks must still run after a suite fails');
  const expression = condition
    .replace(/^\$\{\{|\}\}$/g, '')
    .replaceAll('always()', '1')
    .replaceAll('matrix.shard', String(shard))
    .trim();
  assert.match(
    expression,
    /^[\d\s<>=!&|()]+$/,
    'fixed-check condition must depend only on its shard'
  );
  return Function(`"use strict"; return (${expression});`)();
}

function checkFixedChecks(w) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-fixed-checks-'));
  const log = path.join(dir, 'calls.jsonl');
  fs.writeFileSync(
    path.join(dir, 'python3'),
    `#!${process.execPath}\nrequire('node:fs').appendFileSync(process.env.CI_SHARDING_CALLS,JSON.stringify(process.argv.slice(2))+'\\n');\n`,
    { mode: 0o755 }
  );
  try {
    for (const shard of w.jobs.suites.strategy.matrix.shard)
      for (const step of fixedSteps(w)) {
        if (!ownsShard(step.if, shard)) continue;
        const run = step.run.replace(/\$\{\{\s*matrix\.shard\s*\}\}/g, String(shard));
        const result = spawnSync('bash', ['-euo', 'pipefail', '-c', run], {
          cwd: dir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${dir}:${process.env.PATH}`,
            CI_SHARDING_CALLS: log,
            SUITES_SHARD: String(shard),
            SUITES_SHARDS: '8',
          },
        });
        assert.equal(
          result.status,
          0,
          `fixed-check shell must run for shard ${shard}: ${result.stderr}`
        );
      }
    const calls = fs.existsSync(log)
      ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
      : [];
    const expected = [
      ['quality/expected_drift.py', 'song_profile_calibration-fast'],
      ...[
        'meter_bands',
        'search_null',
        'schema_end_reading',
        'schema_window',
        'door_census',
        'chance_rate',
      ].map((file) => [`quality/${file}.py`, '--check']),
    ];
    for (const args of expected)
      assert.equal(
        calls.filter((call) => JSON.stringify(call) === JSON.stringify(args)).length,
        1,
        `fixed check ${args.join(' ')} must run exactly once`
      );
    const e5 = calls.filter((call) => call[0] === 'quality/e5_coda_adoption.py');
    assert.equal(
      e5.filter((call) => call.length === 2 && call[1] === '--part=canon').length,
      1,
      'fixed E5 canon must run exactly once'
    );
    const random = e5.map((call) => /^--part=random-(\d+)\/(\d+)$/.exec(call[1])).filter(Boolean);
    assert.ok(random.length, 'fixed E5 must retain its complete random stream');
    const denominator = Number(random[0][2]);
    assert.ok(
      random.every((part) => Number(part[2]) === denominator),
      'fixed E5 random panels must use one coordinate system'
    );
    assert.deepEqual(
      random.map((part) => Number(part[1])).sort((a, b) => a - b),
      Array.from({ length: denominator }, (_, i) => i + 1),
      'fixed E5 random panels must run exactly once'
    );
    assert.equal(
      calls.length,
      expected.length + 1 + denominator,
      'fixed checks must not duplicate work or add unrecognized partial calls'
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

checkMatrices(workflow);
checkGates(workflow);
checkBuildHandoff(workflow);
checkInjectionAdmission(workflow);
checkFixedChecks(workflow);

const missingCoordinate = clone(workflow);
missingCoordinate.jobs.faults.strategy.matrix.shard.pop();
assert.throws(() => checkMatrices(missingCoordinate), /faults matrix/);
const wrongFanIn = clone(workflow);
const verifyFan = command(wrongFanIn.jobs.verify, /--verify-shards=/)[0];
verifyFan.run = verifyFan.run.replace('--shards=8', '--shards=7');
assert.throws(() => checkMatrices(wrongFanIn), /verify fan-in/);
const unadmittedBuild = clone(workflow);
unadmittedBuild.jobs.faults.steps = unadmittedBuild.jobs.faults.steps.filter(
  (step) => !/artifact_build_cache\.js admit /.test(step.run || '')
);
assert.throws(() => checkBuildHandoff(unadmittedBuild), /admission/);
const bypassedAdmission = clone(workflow);
const injection = command(bypassedAdmission.jobs.faults, /node scripts\/faults\.js /)[0];
injection.run = injection.run.replace(/^\s*node scripts\/artifact_build_cache\.js admit .*\n/m, '');
assert.throws(() => checkInjectionAdmission(bypassedAdmission), /injection must admit/);
const missingFixed = clone(workflow);
missingFixed.jobs.suites.steps = missingFixed.jobs.suites.steps.filter(
  (step) => !/quality\/door_census\.py/.test(step.run || '')
);
assert.throws(() => checkFixedChecks(missingFixed), /fixed check.*door_census/);
console.log(
  'CI sharding: coordinates, complete fan-ins, verified build handoff and exactly-once fixed checks pass; missing work/admission controls reject'
);
