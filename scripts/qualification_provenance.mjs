// A retry's job id/run_attempt can describe an inherited listing, not a new
// execution. Resolve the executing attempt by timestamps, then require every
// intervening listing to agree. Never fall back past a newer failed execution.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
// Fixed complete scope, also checked against the independent deploy table by
// test_qualification_provenance.mjs. Callers cannot request a subset here.
const COMPONENTS = [
  ...Array.from({ length: 16 }, (_, i) => `mutation-${i + 1}`),
  'song',
  'short',
  'curves',
];

const positive = (n) => Number.isSafeInteger(n) && n > 0;
function requireThat(ok, reason) {
  if (!ok) throw new Error(`Qualification provenance refused: ${reason}`);
}
function timestamp(s) {
  requireThat(typeof s === 'string' && Number.isFinite(Date.parse(s)), 'missing timestamp');
  return Date.parse(s);
}
export function githubReader(repository, token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN) {
  requireThat(/^[\w.-]+\/[\w.-]+$/.test(repository) && token, 'repository/read token required');
  return async (path) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30_000),
    });
    requireThat(response.ok, `GitHub HTTP ${response.status}`);
    return response.json();
  };
}
async function paged(get, path, key) {
  const values = [];
  for (let page = 1; page <= 20; page++) {
    const body = await get(`${path}?per_page=100&page=${page}`);
    requireThat(
      Array.isArray(body[key]) && Number.isSafeInteger(body.total_count),
      'invalid inventory'
    );
    values.push(...body[key]);
    if (values.length === body.total_count) return values;
    requireThat(values.length < body.total_count && body[key].length, 'incomplete inventory');
  }
  throw new Error('Qualification provenance inventory exceeds bound');
}
export async function qualificationProvenance({
  get,
  repository,
  runId,
  attempt,
  sha,
  settleReads = 0,
  pause = (ms) => new Promise((done) => setTimeout(done, ms)),
}) {
  requireThat(
    Number.isInteger(settleReads) && settleReads >= 0 && settleReads <= 12,
    'invalid settle bound'
  );
  requireThat(
    positive(runId) && positive(attempt) && attempt <= 100 && /^[a-f0-9]{40}$/.test(sha),
    'invalid run identity'
  );
  const base = `actions/runs/${runId}`;
  const metas = [],
    lists = [];
  for (let a = 1; a <= attempt; a++) {
    const meta = await get(`${base}/attempts/${a}`);
    requireThat(
      meta.id === runId &&
        meta.run_attempt === a &&
        meta.head_sha === sha &&
        meta.head_branch === 'main' &&
        meta.head_repository?.full_name === repository &&
        meta.repository?.full_name === repository &&
        positive(meta.repository?.id) &&
        meta.repository.id === meta.head_repository?.id &&
        ['workflow_dispatch', 'schedule'].includes(meta.event),
      `foreign attempt ${a}`
    );
    timestamp(meta.run_started_at);
    if (a > 1)
      requireThat(
        timestamp(meta.run_started_at) > timestamp(metas[a - 2].run_started_at),
        'attempt order'
      );
    metas.push(meta);
    lists.push(await paged(get, `${base}/attempts/${a}/jobs`, 'jobs'));
    // The aggregate can start before GitHub's current job records settle.
    // Wait only for missing/incomplete records, at most two minutes; then the
    // same strict checks below decide. A failed or duplicate job is not lag.
    const pending = () =>
      COMPONENTS.some((component) => {
        const found = lists[a - 1].filter((j) => j.name === `qualification-${component}`);
        return (
          found.length === 0 ||
          (found.length === 1 &&
            (found[0].status !== 'completed' || !found[0].started_at || !found[0].completed_at))
        );
      });
    if (a === attempt)
      for (let n = 0; n < settleReads && pending(); n++) {
        await pause(10000);
        lists[a - 1] = await paged(get, `${base}/attempts/${a}/jobs`, 'jobs');
      }
  }
  const artifacts = await paged(get, `${base}/artifacts`, 'artifacts');
  const job = (a, component) => {
    const found = lists[a - 1].filter((j) => j.name === `qualification-${component}`);
    requireThat(found.length === 1, `${component}: ambiguous/missing job in attempt ${a}`);
    const j = found[0];
    requireThat(
      positive(j.id) &&
        j.run_id === runId &&
        j.status === 'completed' &&
        j.conclusion === 'success',
      `${component}: unsuccessful job in attempt ${a}`
    );
    requireThat(
      timestamp(j.completed_at) >= timestamp(j.started_at),
      `${component}: invalid execution interval`
    );
    return j;
  };
  return COMPONENTS.map((component) => {
    const current = job(attempt, component);
    const start = timestamp(current.started_at);
    const executed =
      metas.findIndex(
        (m, i) =>
          timestamp(m.run_started_at) <= start &&
          (i + 1 === metas.length || start < timestamp(metas[i + 1].run_started_at))
      ) + 1;
    requireThat(executed > 0, `${component}: execution outside attempts`);
    for (let a = executed; a <= attempt; a++) {
      const inherited = job(a, component);
      requireThat(
        inherited.started_at === current.started_at &&
          inherited.completed_at === current.completed_at,
        `${component}: contradictory execution in attempt ${a}`
      );
    }
    const name = `qualification-${component}-${executed}`;
    const found = artifacts.filter((a) => a.name === name);
    requireThat(found.length === 1, `${component}: ambiguous/missing artifact ${name}`);
    const artifact = found[0],
      origin = artifact.workflow_run;
    requireThat(
      positive(artifact.id) &&
        artifact.expired === false &&
        /^sha256:[a-f0-9]{64}$/.test(artifact.digest) &&
        origin?.id === runId &&
        origin.head_sha === sha &&
        origin.head_branch === 'main' &&
        origin.repository_id === metas[0].repository.id &&
        origin.head_repository_id === metas[0].repository.id,
      `${component}: foreign, expired or unbound artifact`
    );
    requireThat(
      timestamp(artifact.created_at) >= start &&
        timestamp(artifact.created_at) <= timestamp(current.completed_at),
      `${component}: artifact outside execution`
    );
    return {
      component,
      executed_attempt: executed,
      lookup_attempt: attempt,
      execution_job_id: job(executed, component).id,
      lookup_job_id: current.id,
      started_at: current.started_at,
      completed_at: current.completed_at,
      artifact_id: artifact.id,
      artifact_name: name,
      artifact_digest: artifact.digest,
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const repository = process.env.GITHUB_REPOSITORY;
    console.log(
      JSON.stringify(
        await qualificationProvenance({
          get: githubReader(repository),
          repository,
          runId: Number(process.env.GITHUB_RUN_ID),
          attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
          sha: process.env.GITHUB_SHA,
          settleReads: 12,
        })
      )
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
