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
const PYTHON = process.env.PYTHON || 'python3';

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
    'suites-result': ['dup', 'gate', 'suites', 'suites-evidence'],
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
  for (const required of ['api', 'codex.html', 'library/code', 'artifact-build.json'])
    assert.ok(
      archive[0].run.split(/\s+/).includes(required),
      `shared archive must contain ${required}`
    );
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

function checkVerifyFixedChecks(w) {
  const expected = [
    'npm run check:api',
    'npm run check:promises',
    'npm run check:doc-tools',
    'npm run check:prefaces',
    'npm run check:dead-tokens',
    'npm run check:names',
    'npm run check:publish',
    'npm run audit',
    'npm run build:html',
    'npm run reachability',
    'npm run build:html:embedded -- --out="$RUNNER_TEMP/embedded/codex.html" --quiet',
  ];
  for (const line of expected) {
    const owners = runs(w.jobs['verify-shard']).filter((step) => step.run.trim() === line);
    assert.equal(owners.length, 1, `verify fixed check ${line} must retain exactly one owner`);
    assert.equal(
      owners[0].if,
      'matrix.shard == 3',
      `verify fixed check ${line} must run on its measured lane`
    );
  }
}

function checkSuitesAggregate(w) {
  const job = w.jobs['suites-result'];
  const gates = runs(job).filter((step) => step.env?.SUITES_RESULT);
  assert.equal(gates.length, 1, 'suites aggregate must read both producer results');
  const gate = gates[0];
  assert.equal(gate.env.SUITES_RESULT, '${{ needs.suites.result }}');
  assert.equal(gate.env.EVIDENCE_RESULT, '${{ needs.suites-evidence.result }}');
  for (const suites of ['success', 'failure', 'skipped', 'cancelled', ''])
    for (const evidence of ['success', 'failure', 'skipped', 'cancelled', '']) {
      const result = spawnSync('bash', ['-eo', 'pipefail', '-c', gate.run], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, SUITES_RESULT: suites, EVIDENCE_RESULT: evidence },
      });
      assert.equal(
        result.status === 0,
        suites === 'success' && evidence === 'success',
        `suites aggregate must fail closed for pool=${suites}, evidence=${evidence}`
      );
    }
}

function checkEvidenceRunner(w) {
  const evidence = w.jobs['suites-evidence'];
  assert.ok(evidence, 'suites evidence must retain its independent producer');
  assert.deepEqual(evidence.needs, ['dup', 'gate']);
  assert.equal(evidence.if, "needs.dup.outputs.already_covered != 'true'");
  assert.ok(!evidence['continue-on-error']);
  const python = evidence.steps.find((step) => step.uses?.startsWith('actions/setup-python@'));
  const poolPython = w.jobs.suites.steps.find((step) =>
    step.uses?.startsWith('actions/setup-python@')
  );
  assert.deepEqual(
    python.with,
    poolPython.with,
    'both suites producers need the same Python runtime'
  );
  for (const key of ['OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'SWEEP_WORKERS'])
    assert.equal(evidence.env[key], '1');
  const setup = allCommands(evidence);
  for (const required of [
    'lyric_harness.fetch_data()',
    '--require-hashes',
    'numpy',
    'quality/fetch_data.py --research',
  ])
    assert.ok(setup.includes(required), `suites evidence must retain setup for ${required}`);
  const invocations = command(evidence, /python3 scripts\/run_suite_evidence\.py/);
  assert.equal(invocations.length, 1, 'the complete evidence runner must execute exactly once');
  assert.equal(
    invocations[0].if,
    '${{ always() }}',
    'setup failures must not hide evidence outcomes'
  );
  assert.match(invocations[0].run, /--workers=4\b/);
  assert.match(invocations[0].run, /--logs-dir=/);
  assert.match(invocations[0].run, /--report=/);
  assert.doesNotMatch(invocations[0].run, /--only[=\s]/);
  const oldFixed =
    /(?:^|\n)\s*python3 quality\/(?:expected_drift|meter_bands|search_null|schema_end_reading|schema_window|door_census|chance_rate|e5_coda_adoption)\.py\b/;
  assert.ok(
    !runs(w.jobs.suites).some((step) => oldFixed.test(step.run)),
    'fixed checks must not be duplicated on the pool shards'
  );
  const artifacts = evidence.steps.filter((step) =>
    step.uses?.startsWith('actions/upload-artifact@')
  );
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].with['if-no-files-found'], 'error');
  assert.match(artifacts[0].with.path, /\*\*\/\*\.log/);
  assert.match(artifacts[0].with.path, /suite-evidence\.json/);

  const listing = spawnSync(PYTHON, ['scripts/run_suite_evidence.py', '--list-json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(listing.status, 0, listing.stderr);
  const registry = JSON.parse(listing.stdout);
  const expected = [
    ['python3', 'quality/expected_drift.py', 'song_profile_calibration-fast'],
    ...[
      'meter_bands',
      'search_null',
      'schema_end_reading',
      'schema_window',
      'door_census',
      'chance_rate',
    ].map((file) => ['python3', `quality/${file}.py`, '--check']),
    ['python3', 'quality/e5_coda_adoption.py', '--part=canon'],
    ...Array.from({ length: 4 }, (_, i) => [
      'python3',
      'quality/e5_coda_adoption.py',
      `--part=random-${i + 1}/4`,
    ]),
  ];
  assert.equal(registry.count, 12, 'every original fixed check and complete E5 panel must remain');
  assert.equal(registry.commands.length, 12);
  assert.equal(new Set(registry.commands.map((entry) => entry.name)).size, 12);
  assert.deepEqual(
    registry.commands.map((entry) => JSON.stringify(entry.argv)).sort(),
    expected.map(JSON.stringify).sort(),
    'fixed evidence registry must retain every original command exactly once'
  );
  // The companion controls execute this actual registry through subprocess
  // stubs, observe four slots, and prove one failure cannot hide later checks.
  const controls = spawnSync(PYTHON, ['scripts/test_run_suite_evidence.py'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(controls.status, 0, controls.stdout + controls.stderr);
}

checkMatrices(workflow);
checkGates(workflow);
checkBuildHandoff(workflow);
checkInjectionAdmission(workflow);
checkVerifyFixedChecks(workflow);
checkSuitesAggregate(workflow);
checkEvidenceRunner(workflow);

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
const missingEvidence = clone(workflow);
delete missingEvidence.jobs['suites-evidence'];
assert.throws(() => checkEvidenceRunner(missingEvidence), /independent producer/);
const ignoredEvidence = clone(workflow);
const aggregate = runs(ignoredEvidence.jobs['suites-result']).find(
  (step) => step.env?.SUITES_RESULT
);
aggregate.run = aggregate.run.replace(
  'for producer in SUITES EVIDENCE;',
  'for producer in SUITES;'
);
assert.throws(() => checkSuitesAggregate(ignoredEvidence), /suites aggregate must fail closed/);
const missingFixed = clone(workflow);
missingFixed.jobs['verify-shard'].steps = missingFixed.jobs['verify-shard'].steps.filter(
  (step) => step.run !== 'npm run check:publish'
);
assert.throws(() => checkVerifyFixedChecks(missingFixed), /verify fixed check.*check:publish/);
console.log(
  'CI sharding: coordinates, complete fan-ins, verified build handoff and exactly-once fixed checks pass; missing work/admission controls reject'
);
