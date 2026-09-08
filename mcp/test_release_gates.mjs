import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REQUIRED_JOBS, validateCI, verifyCI } from '../scripts/verify_ci.mjs';
import { archiveBeforeDispatch } from '../scripts/battery_remote.mjs';
import { openArchive } from '../scripts/battery_archive.mjs';
import { allSongsExpected, sha256 } from '../scripts/battery_verdict.mjs';
import { qualifyBattery } from '../scripts/check_battery_acceptance.mjs';

const repository = 'owner/repo',
  sha = 'a'.repeat(40);
const run = {
  id: 12,
  run_attempt: 2,
  head_sha: sha,
  head_branch: 'main',
  event: 'push',
  head_repository: { full_name: repository },
  status: 'completed',
  conclusion: 'success',
};
const jobs = REQUIRED_JOBS.map((name) => ({ name, status: 'completed', conclusion: 'success' }));

test('release CI requires actual successful jobs at the exact trusted main push', () => {
  assert.equal(validateCI(run, jobs, { repository, sha }).run_id, 12);
  assert.equal(validateCI(run, jobs, { repository, sha }).run_attempt, 2);
  for (const patch of [
    { event: 'workflow_dispatch' },
    { conclusion: 'failure' },
    { head_sha: 'b'.repeat(40) },
    { head_repository: { full_name: 'fork/repo' } },
    { run_attempt: undefined },
    { run_attempt: 0 },
  ]) {
    assert.throws(() => validateCI({ ...run, ...patch }, jobs, { repository, sha }));
  }
  for (const name of REQUIRED_JOBS) {
    assert.throws(() =>
      validateCI(
        run,
        jobs.filter((job) => job.name !== name),
        { repository, sha }
      )
    );
    assert.throws(() =>
      validateCI(
        run,
        jobs.map((job) => (job.name === name ? { ...job, conclusion: 'skipped' } : job)),
        { repository, sha }
      )
    );
  }
});

test('CI evidence addresses the actual attempt and refuses a missing attempt before job lookup', async () => {
  const urls = [];
  const result = await verifyCI(sha, {
    repository,
    token: 'fixture',
    fetchImpl: async (url) => {
      urls.push(url);
      return {
        ok: true,
        json: async () =>
          url.includes('/runs?') ? { workflow_runs: [run] } : { jobs, total_count: jobs.length },
      };
    },
  });
  assert.equal(result.run_attempt, 2);
  assert(urls[1].includes('/attempts/2/jobs'));
  let requests = 0;
  await assert.rejects(
    verifyCI(sha, {
      repository,
      token: 'fixture',
      fetchImpl: async () => {
        requests++;
        return {
          ok: true,
          json: async () => ({ workflow_runs: [{ ...run, run_attempt: undefined }] }),
        };
      },
    }),
    /attempt identity/
  );
  assert.equal(requests, 1);
});

test('a newer failed CI run cannot be replaced by an older success', async () => {
  const failed = { ...run, id: 13, conclusion: 'failure' };
  await assert.rejects(
    verifyCI(sha, {
      repository,
      token: 'fixture',
      fetchImpl: async (url) => ({
        ok: true,
        json: async () =>
          url.includes('/runs?')
            ? { workflow_runs: [run, failed] }
            : { jobs, total_count: jobs.length },
      }),
    }),
    /not succeeded/
  );
});

test('song coverage rejects sparse arrays, omitted verdicts and naked exit reasons', () => {
  const good = { song: 0, exit_reason: 'finished', completion: { certified: true } };
  assert.equal(allSongsExpected({ songs: [good] }, 1, 'finished'), true);
  const sparse = new Array(2);
  sparse[1] = { ...good, song: 1 };
  assert.equal(allSongsExpected({ songs: sparse }, 2, 'finished'), false);
  assert.equal(allSongsExpected({ songs: [null, { ...good, song: 1 }] }, 2, 'survey'), false);
  assert.equal(allSongsExpected({ songs: [{ ...good, completion: null }] }, 1, 'finished'), false);
  assert.equal(allSongsExpected({ songs: [] }, 0, 'finished'), false);
});

test('remote pre-dispatch archive retains the capability after complete local loss', async () => {
  const root = mkdtempSync(join(tmpdir(), 'remote-recovery-test-'));
  const source = join(root, 'records');
  mkdirSync(source);
  const before = process.env.BATTERY_RECOVERY_KEY;
  process.env.BATTERY_RECOVERY_KEY = 'c'.repeat(64);
  try {
    const capability = { request_id: 'd'.repeat(64), body: { sig: 'private-fixture-signature' } };
    writeFileSync(join(source, 'intent.json'), JSON.stringify(capability));
    let remote;
    const result = await archiveBeforeDispatch(source, {
      required: true,
      upload: async (name, paths) => {
        remote = readFileSync(paths[0]);
        return { id: 123 };
      },
    });
    assert.equal(result.artifact_id, 123);
    assert.equal(remote.includes(Buffer.from(capability.body.sig)), false);
    rmSync(source, { recursive: true });
    const archive = join(root, 'remote.enc');
    writeFileSync(archive, remote);
    const restored = join(root, 'restored');
    openArchive({ archive, out: restored });
    assert.deepEqual(JSON.parse(readFileSync(join(restored, 'intent.json'))), capability);
    await assert.rejects(
      archiveBeforeDispatch(restored, {
        required: true,
        upload: async () => ({ id: null }),
      }),
      /not acknowledged/
    );
  } finally {
    if (before == null) delete process.env.BATTERY_RECOVERY_KEY;
    else process.env.BATTERY_RECOVERY_KEY = before;
    rmSync(root, { recursive: true, force: true });
  }
});

test('live qualification oracle rejects missing repairs, corrupt delivery and mismatched wall build', () => {
  const root = mkdtempSync(join(tmpdir(), 'qualification-oracle-'));
  const songs = join(root, 'songs'),
    wall = join(root, 'wall');
  mkdirSync(songs);
  mkdirSync(wall);
  const save = (directory, name, value) =>
    writeFileSync(join(directory, name), JSON.stringify(value));
  const build = {
    commit: sha,
    release_id: '123:456:1:lyrics-image',
    source_sha256: 'b'.repeat(64),
    config_sha256: 'c'.repeat(64),
    assets_sha256: 'e'.repeat(64),
    asset_manifest_sha256: 'f'.repeat(64),
  };
  const manifest = {
    expected_commit: sha,
    live_build: build,
    options: { 'require-recovery': true },
    base: 'https://fixture.invalid',
    brief_indices: [0],
  };
  const task = { domain: 'lyrics', brief: 'fixture', plan: {} };
  const completion = {
    certified: true,
    draft_fp: 'a'.repeat(10),
    delivery_sha256: sha256('final'),
    final_draft_sha256: sha256(JSON.stringify(['final'])),
    task_sha256: sha256(JSON.stringify(task)),
  };
  const artifact = { ...completion, text: 'final', final_draft: ['final'] };
  const row = {
    status: 200,
    reply: 'final',
    task,
    completion,
    artifact,
    tools: [
      { name: 'lyric_plan', exit_code: 0 },
      {
        ...completion,
        name: 'lyric_revise',
        exit_code: 0,
        writer: 'interview',
        run_id: 'fixture-run',
        folded: [
          {
            kind: 'propose',
            line: 1,
            attempt: 0,
            round: 1,
            answer: 'final',
            source: 'outcome',
            verdict: 'accepted',
          },
        ],
      },
    ],
  };
  const song = {
    song: 0,
    plan_observed: true,
    exit_reason: 'finished',
    completion,
    cycles: [{ accepted: 1 }],
  };
  try {
    save(songs, 'run.json', manifest);
    save(wall, 'run.json', manifest);
    save(songs, 'summary.json', { expected: true, expect: 'finished', songs: [song] });
    save(wall, 'summary.json', {
      expected: true,
      expect: 'turn-wall',
      songs: [
        { song: 0, exit_reason: 'turn_wall_continued', wall_continuation: { verified: true } },
      ],
    });
    save(songs, 'song0.jsonl', row);
    function wallFixture() {
      const initial = ['saved draft'];
      const journal = {
        version: 1,
        journal_id: '1'.repeat(32),
        input_draft: initial,
        input_fingerprint: sha256('saved draft'),
        accepted_lines: initial,
        config_key: 'same-plan-and-loop-configuration',
        proposer: 'call:fixture:make',
        round: 1,
        status: 'proposal_completed',
        proposals: [{ kind: 'propose', question_sha256: '2'.repeat(64), answer: 'final' }],
        answered: { propose: [{ line: 1, text: 'final' }], propose_group: [] },
        verified_outcomes: [],
        connector_declarations: { seed: 1, writer: 'kitchen' },
        connector_semantic_identity: '3'.repeat(64),
      };
      const bytes = Buffer.from(JSON.stringify(journal));
      const wire = JSON.stringify({
        connector_contract: 1,
        codec: 1,
        encoding: 'gzip+base64',
        semantic_identity: journal.connector_semantic_identity,
        decoded_bytes: bytes.length,
        sha256: sha256(bytes),
        payload: gzipSync(bytes).toString('base64'),
      });
      const plan = { request: { seed: 1 } };
      const task = {
        domain: 'lyrics',
        brief: 'fixture',
        plan: { args: plan.request, result: plan, sha256: sha256(JSON.stringify(plan)) },
      };
      const pending = {
        history: [{ role: 'model', parts: [{ text: 'pending' }] }],
        sig: 'checkpoint',
        workspace: null,
        task,
        reply: '',
        stopped: 'MAX_TURN_MS',
        lyric: {
          resumable: true,
          uncertain_proposal: false,
          run_id: 'run_' + '4'.repeat(64),
          checkpoint: wire,
          draft: initial,
          replay_draft: initial,
          final_draft: initial,
          decl: journal.connector_declarations,
        },
        tools: [
          {
            name: 'lyric_revise',
            writer: 'kitchen',
            status: 'interrupted',
            exit_code: 4,
            journal_id: journal.journal_id,
            final_draft: initial,
            verified_outcomes: [],
            verified_outcomes_error: null,
            verified_outcomes_draft_sha256: sha256(JSON.stringify(initial)),
          },
        ],
      };
      const after = structuredClone(row);
      after.history = [{ role: 'model', parts: [{ text: 'final' }] }];
      after.sig = 'continued';
      after.task = task;
      after.completion.task_sha256 = sha256(JSON.stringify(task));
      const native = { ...journal };
      delete native.connector_declarations;
      delete native.connector_semantic_identity;
      const outcome = {
        outcome_id: '5'.repeat(64),
        kind: 'propose',
        proposal_index: 0,
        question_sha256: journal.proposals[0].question_sha256,
        round: 1,
        attempt: 0,
        members: [1],
        accepted: true,
        applied: true,
        before_draft_sha256: sha256(JSON.stringify(initial)),
        after_draft_sha256: sha256(JSON.stringify(['final'])),
        applied_draft_sha256: sha256(JSON.stringify(['final'])),
      };
      Object.assign(after.tools[1], {
        writer: 'kitchen',
        status: 'finished_clean',
        journal_id: journal.journal_id,
        // A process cache capability can rotate; the persisted journal cannot.
        run_id: 'run_' + '6'.repeat(64),
        final_draft: ['final'],
        verified_outcomes: [outcome],
        verified_outcomes_error: null,
        verified_outcomes_draft_sha256: outcome.after_draft_sha256,
        resume_proof: {
          version: 1,
          journal_id: journal.journal_id,
          checkpoint_loaded: true,
          input_checkpoint_sha256: sha256(JSON.stringify(native) + '\n'),
          wire_checkpoint_sha256: sha256(wire),
          input_draft_sha256: sha256(JSON.stringify(initial)),
          accepted_draft_sha256_at_start: sha256(JSON.stringify(initial)),
          applied_outcome_ids_at_start: [],
          completed_proposals_at_start: 1,
          completed_proposals_replayed: 1,
          new_proposer_dispatches: 0,
          completed_proposal_redispatches: 0,
          replay_prefix_consumed: true,
        },
        resume_proof_error: null,
      });
      return { pending, after, journal };
    }
    const { pending: checkpoint, after: next } = wallFixture();
    const attempts = [
      { event: 'identity_checked', request_id: 'wall', build },
      { event: 'identity_checked', request_id: 'next', build },
      {
        event: 'response_received',
        request_id: 'wall',
        turn: 0,
        response: { status: 200, payload: checkpoint, build },
      },
      {
        event: 'request_started',
        request_id: 'next',
        turn: 1,
        body: { continuation_id: 'wall' },
      },
      {
        event: 'response_received',
        request_id: 'next',
        turn: 1,
        response: { status: 200, payload: next, build },
      },
    ];
    writeFileSync(join(wall, 'song0.attempts.jsonl'), attempts.map(JSON.stringify).join('\n'));
    assert.equal(qualifyBattery({ songs, wall }).qualified, true);
    const kitchenRow = structuredClone(row);
    kitchenRow.tools[1] = { ...next.tools[1], ...completion };
    save(songs, 'song0.jsonl', kitchenRow);
    assert.equal(qualifyBattery({ songs, wall }).accepted_repairs, 1);
    writeFileSync(
      join(songs, 'song0.jsonl'),
      [kitchenRow, kitchenRow].map(JSON.stringify).join('\n')
    );
    assert.equal(
      qualifyBattery({ songs, wall }).accepted_repairs,
      1,
      'replayed outcome counted once'
    );
    for (const outcomes of [null, undefined]) {
      save(songs, 'song0.jsonl', {
        ...kitchenRow,
        tools: [
          kitchenRow.tools[0],
          {
            ...kitchenRow.tools[1],
            verified_outcomes: outcomes,
          },
        ],
      });
      assert.throws(() => qualifyBattery({ songs, wall }), /evidence is unavailable/);
    }
    save(songs, 'song0.jsonl', row);
    // Two mutually matching responses from another build cannot be spliced
    // into a manifest for the intended deployment.
    const spliced = structuredClone(attempts);
    for (const event of spliced) {
      if (event.build) event.build.source_sha256 = '0'.repeat(64);
      if (event.response?.build) event.response.build.source_sha256 = '0'.repeat(64);
    }
    writeFileSync(join(wall, 'song0.attempts.jsonl'), spliced.map(JSON.stringify).join('\n'));
    assert.throws(() => qualifyBattery({ songs, wall }), /no exact signed continuation/);
    writeFileSync(join(wall, 'song0.attempts.jsonl'), attempts.map(JSON.stringify).join('\n'));

    save(songs, 'summary.json', {
      expected: true,
      expect: 'finished',
      songs: [{ ...song, cycles: [] }],
    });
    assert.throws(() => qualifyBattery({ songs, wall }), /mismatched repair counts/);
    save(songs, 'summary.json', { expected: true, expect: 'finished', songs: [song] });
    save(songs, 'song0.jsonl', { ...row, reply: 'altered' });
    assert.throws(() => qualifyBattery({ songs, wall }), /no matching final delivery/);
    save(songs, 'song0.jsonl', row);
    save(wall, 'run.json', {
      ...manifest,
      live_build: { ...build, config_sha256: 'd'.repeat(64) },
    });
    assert.throws(() => qualifyBattery({ songs, wall }), /same implementation and configuration/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Complete comparison evidence is separate from candidate-image CI.
test('production qualification requires each actual job in the exact trusted manual attempt', async () => {
  const { QUALIFICATION_JOBS } = await import('../scripts/verify_ci.mjs');
  const qualificationRun = { ...run, event: 'workflow_dispatch' };
  const qualificationJobs = QUALIFICATION_JOBS.map((name) => ({
    name,
    status: 'completed',
    conclusion: 'success',
  }));
  assert.equal(
    validateCI(qualificationRun, qualificationJobs, { repository, sha, qualification: true })
      .run_attempt,
    2
  );
  for (const name of QUALIFICATION_JOBS)
    assert.throws(() =>
      validateCI(
        qualificationRun,
        qualificationJobs.filter((j) => j.name !== name),
        { repository, sha, qualification: true }
      )
    );
  assert.throws(() => validateCI(run, qualificationJobs, { repository, sha, qualification: true }));
  const urls = [];
  await verifyCI(sha, {
    repository,
    token: 'fixture',
    qualification: true,
    fetchImpl: async (url) => {
      urls.push(url);
      return {
        ok: true,
        json: async () =>
          url.includes('/runs?')
            ? { workflow_runs: [qualificationRun] }
            : { jobs: qualificationJobs, total_count: qualificationJobs.length },
      };
    },
  });
  assert.match(urls[0], /production-qualification.yml/);
  assert.match(urls[1], /attempts\/2\/jobs/);
});

test('qualification artifact cannot cross source, attempt or incomplete calibration boundaries', async () => {
  const { COMPONENTS, validateQualification } = await import('../scripts/verify_qualification.mjs');
  const identity = { commit: sha, source_sha256: 'b'.repeat(64), inputs_sha256: 'c'.repeat(64) };
  const receipt = {
    version: 1,
    scope: 'complete-maintained-mutation-and-calibration-comparisons',
    completed: true,
    identity,
    repository,
    run_id: 21,
    run_attempt: 2,
    components: [...COMPONENTS],
    mutation_inventory: ['M1', 'M4', 'M5', 'M9', 'M11'],
    receipts: COMPONENTS.map((component) => ({
      component,
      command: component.startsWith('mutation-')
        ? ['quality/test_mutation.py', `--shard=${component.at(-1)}/4`]
        : component === 'curves'
          ? ['quality/length_curve_calibration.py', 'check']
          : [
              'quality/song_profile_calibration.py',
              '--check',
              `--profile=${component}`,
              '--seeds=200',
              '--draws=2000',
            ],
      inventory: ['M1', 'M4', 'M5', 'M9', 'M11'],
      status: 'completed',
      exit_code: 0,
      identity,
      identity_after: identity,
      repository,
      run_id: 21,
      run_attempt: 2,
    })),
  };
  const manifest = {
    commit: sha,
    repository_source_sha256: identity.source_sha256,
    build: { source_sha256: 'd'.repeat(64) },
  };
  const verified = { commit: sha, qualification: { run_id: 21, run_attempt: 2, commit: sha } };
  assert(validateQualification(receipt, manifest, verified, repository));
  for (const change of [
    (r) => r.receipts.pop(),
    (r) => (r.receipts[0].exit_code = 124),
    (r) => (r.run_attempt = 1),
    (r) => r.components.pop(),
    (r) => r.receipts[4].command.push('--without-predictability'),
    (r) => (r.identity.source_sha256 = 'd'.repeat(64)),
    (r) => (r.completed = false),
  ]) {
    const bad = structuredClone(receipt);
    change(bad);
    assert.throws(() => validateQualification(bad, manifest, verified, repository));
  }
});
