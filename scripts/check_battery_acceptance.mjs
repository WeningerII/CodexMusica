// Unattended production qualification consumes real driver evidence. Offline
// CI tests the oracle; it cannot manufacture a successful paid provider run.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { acceptedRepairs } from './battery_repairs.mjs';
import {
  allSongsExpected,
  completedArtifact,
  wallCheckpoint,
  wallContinued,
} from './battery_verdict.mjs';

const read = (directory, name) => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const lines = (directory, name) =>
  readFileSync(join(directory, name), 'utf8').split('\n').filter(Boolean).map(JSON.parse);

const BUILD_FIELDS = [
  'commit',
  'release_id',
  'source_sha256',
  'config_sha256',
  'assets_sha256',
  'asset_manifest_sha256',
];
const sameBuild = (a, b) =>
  BUILD_FIELDS.every((key) => typeof a?.[key] === 'string' && a[key] && a[key] === b?.[key]);

function wallTrace(directory, song, expectedBuild) {
  const names = readdirSync(directory).filter((name) =>
    new RegExp(`^song${song}\\.attempts(?:\\.[0-9]{6})?\\.jsonl$`).test(name)
  );
  const attempts = names.flatMap((name) => lines(directory, name));
  const measuredBuild = (receipt) => {
    const identity = attempts.findLast(
      (row) => row.event === 'identity_checked' && row.request_id === receipt.request_id
    );
    const build = receipt.response?.build;
    return identity && sameBuild(identity.build, build) && sameBuild(build, expectedBuild)
      ? build
      : null;
  };
  for (const receipt of attempts.filter((row) => row.event === 'response_received')) {
    const payload = receipt.response?.payload;
    const checkpointBuild = measuredBuild(receipt);
    if (receipt.response?.status !== 200 || !wallCheckpoint(payload, checkpointBuild)) continue;
    for (const request of attempts.filter(
      (row) =>
        row.event === 'request_started' &&
        row.request_id !== receipt.request_id &&
        row.turn > receipt.turn
    )) {
      if (
        request.body?.continuation_id !== (receipt.response?.request_id || receipt.request_id) &&
        !['history', 'workspace', 'lyric', 'sig', 'task'].every(
          (key) => JSON.stringify(request.body?.[key]) === JSON.stringify(payload[key])
        )
      )
        continue;
      const next = attempts.findLast(
        (row) => row.event === 'response_received' && row.request_id === request.request_id
      );
      if (
        next &&
        wallContinued(payload, next.response?.payload, next.response?.status, {
          checkpointBuild,
          continuationBuild: measuredBuild(next),
        })
      )
        return true;
    }
  }
  return false;
}
function evidence(directory, expect) {
  const manifest = read(directory, 'run.json');
  const summary = read(directory, 'summary.json');
  if (
    !/^[a-f0-9]{40}$/.test(manifest.expected_commit || '') ||
    manifest.live_build?.commit !== manifest.expected_commit ||
    !manifest.options?.['require-recovery'] ||
    !/^https:\/\//.test(manifest.base || '') ||
    summary.expect !== expect ||
    summary.expected !== true ||
    !allSongsExpected(summary, manifest.brief_indices?.length, expect)
  ) {
    throw new Error(`${expect} evidence is incomplete or was not a pinned live recovery run.`);
  }
  return { manifest, summary };
}

export function qualifyBattery({ songs, wall }) {
  const fresh = evidence(songs, 'finished');
  const canary = evidence(wall, 'turn-wall');
  for (const key of [
    'commit',
    'release_id',
    'source_sha256',
    'config_sha256',
    'assets_sha256',
    'asset_manifest_sha256',
  ]) {
    if (
      !fresh.manifest.live_build[key] ||
      fresh.manifest.live_build[key] !== canary.manifest.live_build[key]
    ) {
      throw new Error(
        'Song and wall continuation evidence must measure the same implementation and configuration.'
      );
    }
  }
  let repairs = 0;
  for (const song of fresh.summary.songs) {
    if (!song.plan_observed)
      throw new Error(`Song ${song.song} has no program-generated plan in its trace.`);
    const rows = lines(songs, `song${song.song}.jsonl`);
    if (
      !rows.some((row) =>
        row.tools?.some((tool) => tool.name === 'lyric_plan' && tool.exit_code === 0 && !tool.error)
      )
    )
      throw new Error(`Song ${song.song} has no successful plan call in its trace.`);
    const delivery = rows.filter((row) => row.status != null).at(-1);
    const proof = completedArtifact(delivery, delivery?.status);
    if (
      !proof ||
      proof.delivery_sha256 !== song.completion?.delivery_sha256 ||
      proof.final_draft_sha256 !== song.completion?.final_draft_sha256
    ) {
      throw new Error(`Song ${song.song} has no matching final delivery receipt.`);
    }
    const accepted = acceptedRepairs(rows.flatMap((row) => row.tools || []));
    if (
      accepted !== (song.cycles || []).reduce((count, cycle) => count + (cycle.accepted || 0), 0)
    ) {
      throw new Error(`Song ${song.song} has mismatched repair counts in its summary and trace.`);
    }
    repairs += accepted;
  }
  if (repairs < 1)
    throw new Error(
      'No accepted model-driven repair was measured; clean first drafts do not prove revision.'
    );
  for (const song of canary.summary.songs) {
    if (!wallTrace(wall, song.song, canary.manifest.live_build))
      throw new Error(
        `Wall canary ${song.song} has no exact signed continuation and successful response in its request journal.`
      );
  }
  return {
    qualified: true,
    commit: fresh.manifest.expected_commit,
    songs: fresh.summary.songs.length,
    accepted_repairs: repairs,
    wall_continuations: canary.summary.songs.length,
    build: fresh.manifest.live_build,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = Object.fromEntries(
      process.argv.slice(2).map((arg) => {
        const match = /^--(songs|wall)=(.+)$/.exec(arg);
        if (!match) throw new Error('Usage: check_battery_acceptance.mjs --songs=DIR --wall=DIR');
        return match.slice(1);
      })
    );
    if (!args.songs || !args.wall)
      throw new Error('Both fresh-song and wall-continuation records are required.');
    console.log(JSON.stringify(qualifyBattery(args)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
