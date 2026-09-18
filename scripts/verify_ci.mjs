// A manual dispatch is not evidence of CI. Resolve the latest trusted main
// push run at the exact SHA and require the release's actual jobs to pass.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { MUTATION_SHARDS } from './verify_qualification.mjs';

export const REQUIRED_JOBS = Object.freeze([
  'gate',
  'lyrics-image',
  'capacity-proof-result',
  'verify',
  'freshness',
  'catalog-result',
  'record',
  'suites-result',
  'plan-result',
  'capacity-result',
  'revision-loop-result',
  'verbs-result',
]);

// EVERY mutation shard, derived from the same count the deploy verifier
// re-derives commands from -- until 2026-09-12 this list named shards 1-4 by
// hand while the workflow ran eight, so a run whose shard 5 had been skipped
// would have passed this check (M-282).
export const QUALIFICATION_JOBS = Object.freeze([
  'qualification-capacity-proof',
  // M-282: the full matrix moved from PR CI to production qualification.
  // A green candidate image never substitutes for this exact attempt's matrix.
  'qualification-capacity-matrix',
  ...Array.from({ length: MUTATION_SHARDS }, (_, i) => `qualification-mutation-${i + 1}`),
  'qualification-song',
  'qualification-short',
  'qualification-curves',
  'qualification-result',
]);

// THE QUALIFICATION IS ABSENT AT EVERY MERGE, BY DESIGN (M-287). It is a
// manual dispatch a person runs AFTER CI, so at the moment a merge's CI
// completes there is normally no qualification at that SHA, and six deploy runs
// in a row (80, 83, 84, 85, 87, 88) went red on exactly that sentence while
// nothing was wrong. Absent is a stand-down, not a failure: the deploy runs
// again by itself when the qualification workflow completes. A qualification
// that EXISTS and did not succeed is still a failure, and stays red.
//: WHICH EVENTS PRODUCE A TRUSTED QUALIFICATION. A person pressing the button
//: was the only producer until 2026-09-16; the nightly schedule added that day
//: emits `schedule`. Both run from the default branch of this repository and
//: neither can be driven from a fork, so they are equally trusted -- and every
//: caller re-checks sha, branch and head repository regardless. Declared ONCE
//: here because it is read in two places that must never disagree: the run
//: lookup in `verifyCI` and the acceptance in `validateCI`. They already did
//: disagree for the length of one commit while this was being written.
export const QUALIFICATION_EVENTS = ['workflow_dispatch', 'schedule'];

export const QUALIFICATION_ABSENT = 'No trusted main production qualification exists at this SHA.';

//: AND "RUNNING" IS A THIRD ANSWER, NOT THE FAILED ONE -- 2026-09-18, doctrine
//: 20 at the deploy gate. A qualification that is IN FLIGHT has not said
//: anything yet, and until today the run lookup handed it to `validateCI`,
//: which rejected it on `status !== 'completed'` with the SAME sentence a
//: genuinely failed qualification earns -- so the deploy painted itself red
//: for the ordinary condition of a qualification still running. MEASURED on
//: main at `fae14b1b`: deploy run 175 (2026-09-18 04:28Z) fired on the merge's
//: push CI while qualification run 24 was 16 minutes into a 2h43m run, and
//: went red on "has not succeeded" where the honest answer is the stand-down
//: M-287 already built. Inconclusive by construction is not a null, and it is
//: certainly not a failure.
export const QUALIFICATION_PENDING =
  'A main production qualification at this SHA has not completed yet.';

export async function productionEvidence(sha, options = {}) {
  const result = await verifyCI(sha, options);
  try {
    result.qualification = await verifyCI(sha, { ...options, qualification: true });
  } catch (error) {
    // TWO STAND-DOWNS, NEVER SUMMED AND NEVER MERGED INTO ONE SENTENCE
    // (doctrine 79): nobody has started a qualification here, and one is
    // running. Both mean DO NOT DEPLOY YET and neither is a defect; they ask
    // different things of whoever reads the summary, so the reason carried out
    // is the one that was thrown. Anything else -- a qualification that
    // completed and did not succeed among them -- is still re-thrown and still
    // red, which is this file's own rule two constants up.
    if (error.message !== QUALIFICATION_ABSENT && error.message !== QUALIFICATION_PENDING)
      throw error;
    result.qualification = null;
    result.stand_down = error.message;
  }
  return result;
}

export function validateCI(run, jobs, { repository, sha, qualification = false }) {
  const requiredJobs = qualification ? QUALIFICATION_JOBS : REQUIRED_JOBS;
  if (
    !run ||
    !Number.isSafeInteger(run.id) ||
    run.id < 1 ||
    !Number.isSafeInteger(run.run_attempt) ||
    run.run_attempt < 1 ||
    run.head_sha !== sha ||
    run.head_branch !== 'main' ||
    !(qualification ? QUALIFICATION_EVENTS.includes(run.event) : run.event === 'push') ||
    run.head_repository?.full_name !== repository ||
    run.status !== 'completed' ||
    run.conclusion !== 'success'
  )
    throw new Error(
      qualification
        ? 'Exact trusted main production qualification has not succeeded.'
        : 'Exact trusted main push CI has not succeeded.'
    );
  for (const name of requiredJobs) {
    const matches = jobs.filter((job) => job.name === name);
    if (
      matches.length !== 1 ||
      matches[0].status !== 'completed' ||
      matches[0].conclusion !== 'success'
    ) {
      throw new Error(`Required CI job ${name} did not complete successfully.`);
    }
  }
  if (
    jobs.some((job) =>
      ['failure', 'cancelled', 'timed_out', 'action_required'].includes(job.conclusion)
    )
  ) {
    throw new Error('The CI run contains an unsuccessful job.');
  }
  return {
    run_id: run.id,
    run_attempt: run.run_attempt,
    commit: sha,
    verified_jobs: requiredJobs,
  };
}

export async function verifyCI(
  sha,
  {
    repository = process.env.GITHUB_REPOSITORY,
    token = process.env.GH_TOKEN,
    base = process.env.GITHUB_API_URL || 'https://api.github.com',
    fetchImpl = fetch,
    qualification = false,
  } = {}
) {
  if (!/^[a-f0-9]{40}$/.test(sha || '') || !/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !token) {
    throw new Error('A full SHA, repository and CI read token are required.');
  }
  const get = async (path) => {
    const response = await fetchImpl(`${base}/repos/${repository}/${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`CI evidence lookup failed (HTTP ${response.status}).`);
    return response.json();
  };
  // A QUALIFICATION NOW ARRIVES TWO WAYS AND BOTH ARE TRUSTED. Until
  // 2026-09-16 the only producer was a person pressing the button, so this
  // narrowed to `workflow_dispatch` on BOTH sides -- the server-side `event=`
  // filter and the predicate below. The nightly schedule added that day emits
  // `event: schedule`, and an evidence check that asks only for dispatches
  // would report every scheduled qualification ABSENT: M-287's exact shape, a
  // deploy standing down on evidence that exists and is not being looked for.
  // The schedule would have produced the runs and changed nothing.
  //
  // GitHub's `event=` query takes ONE value, so the narrowing moves entirely
  // into the predicate, which was always the authoritative half -- it re-checks
  // the sha, the branch and the head repository, and the URL filter only ever
  // narrowed what the page could contain. A `schedule` run is no weaker a
  // witness than a dispatch: it can only ever run from the default branch of
  // this repository, which is the same thing the predicate already requires.
  const data = await get(
    `actions/workflows/${qualification ? 'production-qualification.yml' : 'ci.yml'}/runs?head_sha=${sha}${qualification ? '' : '&event=push'}&branch=main&per_page=100`
  );
  // AN IN-FLIGHT RUN IS NOT EVIDENCE, AND UNTIL 2026-09-18 IT MASKED THE
  // EVIDENCE THAT WAS THERE. The selection took the newest matching run BY ID
  // whatever its status, so a run that had not finished outranked a completed
  // one at the same SHA and `validateCI` then rejected the whole question.
  // MEASURED on main at `fae14b1b`: deploy run 176 (2026-09-18 06:56Z) fired on
  // qualification run 24's SUCCESS and went red anyway, because the nightly
  // scheduled qualification run 25 -- newer id, still running, 13 minutes from
  // its own success -- was what this line picked. Two qualifications at one SHA
  // is now the ORDINARY case (a dispatch, the nightly schedule, and the
  // backstop's recovery dispatch), so this is not a corner.
  //
  // COMPLETENESS IS THE ONLY NARROWING, and that is deliberate. Selecting the
  // newest SUCCESSFUL run would let a green witness outrank a red one at the
  // same SHA -- promoting evidence selectively, which is a real weakening of
  // this gate. A completed FAILURE still wins the selection and is still red.
  const matching =
    data.workflow_runs?.filter(
      (item) =>
        item.head_sha === sha &&
        (qualification ? QUALIFICATION_EVENTS.includes(item.event) : item.event === 'push') &&
        item.head_branch === 'main' &&
        item.head_repository?.full_name === repository
    ) ?? [];
  const run = matching.filter((item) => item.status === 'completed').sort((a, b) => b.id - a.id)[0];
  if (!run) {
    if (matching.length)
      throw new Error(
        qualification
          ? QUALIFICATION_PENDING
          : 'A main push CI run at this SHA has not completed yet.'
      );
    throw new Error(
      qualification ? QUALIFICATION_ABSENT : 'No trusted main push CI run exists at this SHA.'
    );
  }
  if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1)
    throw new Error('The CI run has no verified attempt identity.');
  const jobs = [];
  for (let page = 1; page <= 20; page++) {
    const result = await get(
      `actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100&page=${page}`
    );
    if (!Array.isArray(result.jobs)) throw new Error('CI jobs response is malformed.');
    jobs.push(...result.jobs);
    if (jobs.length >= result.total_count)
      return validateCI(run, jobs, { repository, sha, qualification });
  }
  throw new Error('CI job evidence exceeds the bounded inventory.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    // Three answers, never collapsed (the deploy guard's own shape): 0 with
    // the evidence, 10 with the CI evidence and no qualification yet -- a
    // stand-down the caller must not paint red -- and 1 for anything wrong.
    const result = process.argv.includes('--production')
      ? await productionEvidence(process.argv[2])
      : await verifyCI(process.argv[2]);
    console.log(JSON.stringify(result));
    if (result.stand_down) {
      console.error(result.stand_down);
      process.exitCode = 10;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
