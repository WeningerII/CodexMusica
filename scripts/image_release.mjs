// The release manifest names the exact image that passed the offline image gate.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runtimeSourceFingerprint } from '../mcp/build_identity.js';

export function validateImageManifest(value, { sha, repository, releaseId }) {
  if (!/^[a-f0-9]{40}$/.test(sha || '') || value?.version !== 1 || value.commit !== sha)
    throw new Error('Image manifest does not identify the exact verified commit.');
  if (!/^ghcr\.io\/[a-z0-9._/-]+$/.test(repository || '') || value.repository !== repository)
    throw new Error('Image repository differs from the configured Render image repository.');
  if (
    !/^sha256:[a-f0-9]{64}$/.test(value.image_id || '') ||
    !/^sha256:[a-f0-9]{64}$/.test(value.digest || '')
  )
    throw new Error('An immutable image ID and registry digest are required.');
  for (const field of ['source_sha256', 'assets_sha256', 'asset_manifest_sha256'])
    if (!/^[a-f0-9]{64}$/.test(value.build?.[field] || ''))
      throw new Error(`Image manifest lacks ${field}.`);
  if (!/^[a-f0-9]{64}$/.test(value.repository_source_sha256 || ''))
    throw new Error('Image manifest lacks the verified repository source fingerprint.');
  if (value.build.commit !== sha) throw new Error('Baked image commit does not match CI.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.build.release_id || ''))
    throw new Error('Image manifest lacks a baked per-build release identity.');
  if (releaseId !== undefined && value.build.release_id !== releaseId)
    throw new Error('Image manifest belongs to a different verified CI attempt.');
  for (const field of ['node', 'python', 'nltk'])
    if (typeof value.build[field] !== 'string' || !value.build[field].trim())
      throw new Error(`Image manifest lacks ${field} runtime version.`);
  return `${repository}@${value.digest}`;
}

export function verifyRepositorySource(before, after = runtimeSourceFingerprint()) {
  if (!/^[a-f0-9]{64}$/.test(before || '') || before !== after)
    throw new Error('Repository source changed after the candidate image build.');
  return before;
}

export function imageBuildDrift(manifest, build) {
  return [
    'commit',
    'release_id',
    'source_sha256',
    'assets_sha256',
    'asset_manifest_sha256',
    'node',
    'python',
    'nltk',
  ].filter((key) => !manifest.build?.[key] || manifest.build[key] !== build?.[key]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [verb, file, sha, repository, imageId, repositorySource] = process.argv.slice(2);
    if (verb === 'record') {
      if (!/^sha256:[a-f0-9]{64}$/.test(imageId || ''))
        throw new Error('Supply the tested image ID.');
      const docker = (args) =>
        execFileSync('docker', args, {
          encoding: 'utf8',
          timeout: 30_000,
          maxBuffer: 4 * 1024 * 1024,
        }).trim();
      const info = JSON.parse(docker(['image', 'inspect', `${repository}:${sha}`]))[0];
      if (info.Id !== imageId) throw new Error('Published tag no longer names the tested image.');
      const reference = info.RepoDigests.find((x) => x.startsWith(`${repository}@sha256:`));
      if (!reference) throw new Error('Pushed image has no registry digest.');
      const build = JSON.parse(
        docker([
          'run',
          '--rm',
          '--network=none',
          '--entrypoint=node',
          imageId,
          '--input-type=module',
          '-e',
          "import {runtimeBuildIdentity} from './job_store.js'; console.log(JSON.stringify(runtimeBuildIdentity()));",
        ])
      );
      const manifest = {
        version: 1,
        commit: sha,
        repository_source_sha256: verifyRepositorySource(repositorySource),
        repository,
        image_id: imageId,
        digest: reference.split('@')[1],
        build,
      };
      validateImageManifest(manifest, { sha, repository });
      writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    } else if (verb === 'url') {
      if (!imageId) throw new Error('Supply the expected verified CI release ID.');
      console.log(
        validateImageManifest(JSON.parse(readFileSync(file, 'utf8')), {
          sha,
          repository,
          releaseId: imageId,
        })
      );
    } else
      throw new Error(
        'Usage: image_release.mjs record FILE SHA GHCR_REPOSITORY TESTED_IMAGE_ID REPOSITORY_SOURCE_SHA256 | url FILE SHA GHCR_REPOSITORY VERIFIED_RELEASE_ID'
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
