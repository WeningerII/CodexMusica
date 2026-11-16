// Optional exact-commit CI image reuse. This never supplies qualification evidence:
// every capacity cell still executes, in a fresh constrained container.
import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { verifyCI } from './verify_ci.mjs';
import { validateImageManifest, verifyRepositorySource, imageBuildDrift } from './image_release.mjs';

export function admitImage(manifest, { sha, repository, releaseId, source }) {
  if (!releaseId) throw new Error('A verified CI attempt is required.');
  const reference = validateImageManifest(manifest, { sha, repository, releaseId });
  verifyRepositorySource(manifest.repository_source_sha256, source);
  return reference;
}

export function checkPulledImage(manifest, imageId, build, repoDigests) {
  // Docker's classic store reports the config digest as Id; the containerd
  // store may report the manifest digest. The immutable registry reference
  // is portable across both. CI's recorder already bound it to its tested Id.
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId || '') ||
      !repoDigests?.includes(`${manifest.repository}@${manifest.digest}`))
    throw new Error('Pulled image lacks the exact CI-tested registry digest.');
  const drift = imageBuildDrift(manifest, build);
  if (drift.length) throw new Error(`Pulled image build differs from CI: ${drift.join(', ')}`);
  return imageId;
}

async function main() {
  const [verb, file] = process.argv.slice(2);
  const output = (key, value) => {
    if (/\r|\n/.test(String(value))) throw new Error('Multiline workflow output refused.');
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  };
  if (verb === 'select') {
    // A missing/in-flight/red CI run or unavailable API is a cache miss, not
    // permission to use an older image. The existing rebuild remains complete.
    try {
      const ci = await verifyCI(process.env.GITHUB_SHA);
      if (!/^[1-9][0-9]*$/.test(process.env.GITHUB_REPOSITORY_ID || ''))
        throw new Error('Missing repository ID.');
      output('run_id', ci.run_id);
      output('release_id', `${process.env.GITHUB_REPOSITORY_ID}:${ci.run_id}:${ci.run_attempt}:lyrics-image`);
    } catch (error) {
      console.log(`No reusable exact-commit CI image selected: ${error.message}; rebuild required.`);
    }
    return;
  }
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const reference = admitImage(manifest, {
    sha: process.env.GITHUB_SHA,
    repository: process.env.IMAGE_REPOSITORY,
    releaseId: process.env.VERIFIED_RELEASE_ID,
  });
  if (verb === 'admit') {
    output('reference', reference);
    return;
  }
  if (verb !== 'inspect') throw new Error('Expected select, admit or inspect.');
  const docker = (args) => execFileSync('docker', args, {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  }).trim();
  const info = JSON.parse(docker(['image', 'inspect', reference]))[0];
  const imageId = info.Id;
  const build = JSON.parse(docker(['run', '--rm', '--network=none', '--entrypoint=node', imageId,
    '--input-type=module', '-e',
    "import {runtimeBuildIdentity} from './job_store.js'; console.log(JSON.stringify(runtimeBuildIdentity()));"]));
  output('image_id', checkPulledImage(manifest, imageId, build, info.RepoDigests));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
