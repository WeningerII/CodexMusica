// A manual dispatch is not evidence of CI. Resolve the latest trusted main
// push run at the exact SHA and require the release's actual jobs to pass.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

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

export const QUALIFICATION_JOBS = Object.freeze([
  'qualification-capacity-proof',
  'qualification-mutation-1',
  'qualification-mutation-2',
  'qualification-mutation-3',
  'qualification-mutation-4',
  'qualification-song',
  'qualification-short',
  'qualification-curves',
  'qualification-result',
]);

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
    run.event !== (qualification ? 'workflow_dispatch' : 'push') ||
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
  const data = await get(
    `actions/workflows/${qualification ? 'production-qualification.yml' : 'ci.yml'}/runs?head_sha=${sha}&event=${qualification ? 'workflow_dispatch' : 'push'}&branch=main&per_page=100`
  );
  const run = data.workflow_runs
    ?.filter(
      (item) =>
        item.head_sha === sha &&
        item.event === (qualification ? 'workflow_dispatch' : 'push') &&
        item.head_branch === 'main' &&
        item.head_repository?.full_name === repository
    )
    .sort((a, b) => b.id - a.id)[0];
  if (!run)
    throw new Error(
      qualification
        ? 'No trusted main production qualification exists at this SHA.'
        : 'No trusted main push CI run exists at this SHA.'
    );
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
    const result = await verifyCI(process.argv[2]);
    if (process.argv.includes('--production'))
      result.qualification = await verifyCI(process.argv[2], { qualification: true });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
