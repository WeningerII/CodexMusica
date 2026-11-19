import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { qualificationProvenance } from './qualification_provenance.mjs';
import { COMPONENTS, expectedCommand, validateQualification } from './verify_qualification.mjs';

const repository = 'WeningerII/CodexMusica',
  runId = 44462290084;
const sha = '4ce5735855f478e976b0d227da6df88a1c1fabeb';
function fixture() {
  const read = (name) =>
    JSON.parse(
      readFileSync(
        new URL(`./fixtures/qualification_rerun_44462290084/${name}.json`, import.meta.url)
      )
    );
  return {
    metas: [read('attempt-1'), read('attempt-2')],
    jobs: [read('jobs-1'), read('jobs-2')],
    artifacts: read('artifacts'),
  };
}
function resolve(f = fixture(), attempt = 2) {
  const get = async (path) => {
    const m = path.match(/attempts\/(\d+)(\/jobs)?/);
    return m ? (m[2] ? f.jobs : f.metas)[Number(m[1]) - 1] : f.artifacts;
  };
  return qualificationProvenance({ get, repository, runId, attempt, sha });
}
function rerun(f, component) {
  const j = f.jobs[1].jobs.find((j) => j.name === `qualification-${component}`);
  j.started_at = '2026-11-19T05:35:00Z';
  j.completed_at = '2026-11-19T05:45:00Z';
  const old = f.artifacts.artifacts.find((a) => a.name === `qualification-${component}-1`);
  f.artifacts.artifacts.push({
    ...old,
    id: old.id + 1000000,
    name: `qualification-${component}-2`,
    created_at: '2026-11-19T05:44:00Z',
  });
  f.artifacts.total_count++;
}

test('#883 recorded partial retry selects all nineteen original executions, not relisted ids', async () => {
  const p = await resolve();
  assert.deepEqual(
    p.map((x) => x.component),
    COMPONENTS
  );
  assert(
    p.every(
      (x) =>
        x.executed_attempt === 1 && x.lookup_attempt === 2 && x.execution_job_id !== x.lookup_job_id
    )
  );
  assert.equal(p.find((x) => x.component === 'mutation-7').artifact_id, 14501419609);
});
test('mixed and full retries select latest executions only', async () => {
  assert(
    (await resolve(fixture(), 1)).every((x) => x.executed_attempt === 1 && x.lookup_attempt === 1)
  );
  const f = fixture();
  rerun(f, 'mutation-7');
  assert.equal((await resolve(f)).filter((x) => x.executed_attempt === 2).length, 1);
  for (const c of COMPONENTS.filter((c) => c !== 'mutation-7')) rerun(f, c);
  assert((await resolve(f)).every((x) => x.executed_attempt === 2));
});

test('current job listing lag settles within a bound and still fails closed after it', async () => {
  for (const recovers of [true, false]) {
    const f = fixture();
    let reads = 0,
      pauses = 0;
    const get = async (path) => {
      const m = path.match(/attempts\/(\d+)(\/jobs)?/);
      if (!m) return f.artifacts;
      if (!m[2]) return f.metas[Number(m[1]) - 1];
      const list = structuredClone(f.jobs[Number(m[1]) - 1]);
      if (m[1] === '2' && (++reads === 1 || !recovers)) {
        list.jobs[0].status = 'in_progress';
        list.jobs[0].completed_at = null;
      }
      return list;
    };
    const pending = qualificationProvenance({
      get,
      repository,
      runId,
      attempt: 2,
      sha,
      settleReads: 1,
      pause: async () => {
        pauses++;
      },
    });
    if (recovers) assert.equal((await pending).length, 19);
    else await assert.rejects(pending);
    assert.equal(reads, 2);
    assert.equal(pauses, 1);
  }
});
test('a newer failed or artifact-less execution never falls back to an old success', async () => {
  for (const fault of ['failure', 'missing']) {
    const f = fixture();
    rerun(f, 'mutation-7');
    if (fault === 'failure')
      f.jobs[1].jobs.find((j) => j.name === 'qualification-mutation-7').conclusion = 'failure';
    else {
      f.artifacts.artifacts.pop();
      f.artifacts.total_count--;
    }
    await assert.rejects(resolve(f));
  }
});
test('contradictory jobs, missing coverage and foreign/expired/undigested artifacts refuse', async () => {
  const corruptions = [
    (f) => {
      f.jobs[0].jobs[0].conclusion = 'failure';
    },
    (f) => {
      f.jobs[0].jobs[0].completed_at = '2026-11-19T05:01:00Z';
    },
    (f) => {
      f.jobs[1].jobs.pop();
      f.jobs[1].total_count--;
    },
    (f) => {
      f.jobs[1].jobs.push(f.jobs[1].jobs[0]);
      f.jobs[1].total_count++;
    },
    (f) => {
      f.jobs[1].jobs[0].run_id++;
    },
    (f) => {
      f.metas[0].head_sha = 'a'.repeat(40);
    },
    (f) => {
      f.metas[1].run_started_at = f.metas[0].run_started_at;
    },
    (f) => {
      f.artifacts.artifacts[0].expired = true;
    },
    (f) => {
      f.artifacts.artifacts[0].digest = null;
    },
    (f) => {
      f.artifacts.artifacts[0].workflow_run.head_repository_id++;
    },
    (f) => {
      f.artifacts.artifacts[0].created_at = '2026-11-20T00:00:00Z';
    },
    (f) => {
      f.artifacts.artifacts.push(f.artifacts.artifacts[0]);
      f.artifacts.total_count++;
    },
    (f) => {
      f.artifacts.total_count++;
    },
  ];
  for (const corrupt of corruptions) {
    const f = fixture();
    corrupt(f);
    await assert.rejects(resolve(f));
  }
});
test('deployment requires independent provenance and keeps exact source, completeness and legacy gates', async () => {
  const p = await resolve();
  const identity = {
    commit: sha,
    source_sha256: 'b'.repeat(64),
    portable_inputs_sha256: 'c'.repeat(64),
    inputs_sha256: 'd'.repeat(64),
  };
  const value = {
    version: 2,
    completed: true,
    scope: 'complete-maintained-mutation-and-calibration-comparisons',
    repository,
    run_id: runId,
    run_attempt: 2,
    identity,
    components: COMPONENTS,
    mutation_inventory: ['M1'],
    provenance: p,
    receipts: COMPONENTS.map((component) => ({
      component,
      command: expectedCommand(component),
      inventory: ['M1'],
      status: 'completed',
      exit_code: 0,
      run_id: runId,
      run_attempt: 1,
      repository,
      identity,
      identity_after: identity,
    })),
  };
  const image = { commit: sha, repository_source_sha256: identity.source_sha256 };
  const verified = { commit: sha, qualification: { commit: sha, run_id: runId, run_attempt: 2 } };
  assert(validateQualification(value, image, verified, repository, p));
  // Exercise the real CLI and its independently fetched provenance, including
  // module loading (a circular top-level import must not deadlock promotion).
  const dir = mkdtempSync(join(tmpdir(), 'qualification-provenance-'));
  try {
    for (const [name, object] of Object.entries({ value, image, verified }))
      writeFileSync(join(dir, name + '.json'), JSON.stringify(object));
    const f = fixture();
    const preload = `const f=${JSON.stringify(f)}; globalThis.fetch=async url=>{
      const m=url.match(/attempts\\/(\\d+)(\\/jobs)?/);
      return {ok:true,json:async()=>m?(m[2]?f.jobs:f.metas)[Number(m[1])-1]:f.artifacts};};`;
    const result = spawnSync(
      process.execPath,
      [
        '--import=data:text/javascript,' + encodeURIComponent(preload),
        new URL('./verify_qualification.mjs', import.meta.url).pathname,
        ...['value', 'image', 'verified'].map((name) => join(dir, name + '.json')),
      ],
      {
        env: { ...process.env, GH_TOKEN: 'fixture-only', GITHUB_REPOSITORY: repository },
        encoding: 'utf8',
        timeout: 10000,
      }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Complete maintained comparisons match/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.throws(() => validateQualification(value, image, verified, repository));
  for (const corrupt of [
    (v) => {
      v.version = 1;
    },
    (v) => {
      v.provenance[0].artifact_digest = 'sha256:' + '0'.repeat(64);
    },
    (v) => {
      v.receipts[0].run_attempt = 2;
    },
    (v) => {
      v.receipts.pop();
    },
    (v) => {
      v.receipts[0].identity.commit = 'a'.repeat(40);
    },
    (v) => {
      v.receipts[0].exit_code = 1;
    },
    (v) => {
      v.receipts[0].command = [];
    },
  ]) {
    const v = structuredClone(value);
    corrupt(v);
    assert.throws(() => validateQualification(v, image, verified, repository, p));
  }
});
