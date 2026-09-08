// A production release is identified by bytes baked into its image, never a
// runtime environment override. Local unbuilt checkouts report no release ID.
import fs, { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function readBakedBuildIdentity({
  file = new URL('./build_identity.json', import.meta.url),
  required = false,
} = {}) {
  let value;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && !required) return null;
    throw new Error('Baked image build identity is missing or unreadable.');
  }
  if (
    value?.version !== 1 ||
    !/^[a-f0-9]{40}$/.test(value.commit || '') ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.release_id || '')
  )
    throw new Error('Baked image build identity is invalid.');
  return Object.freeze({ commit: value.commit, release_id: value.release_id });
}

export function releaseIdentity(env = process.env) {
  const baked = readBakedBuildIdentity({ required: env.LYRIC_RELEASE_ASSETS_REQUIRED === '1' });
  return Object.freeze({
    commit: baked?.commit || env.BUILD_GIT_COMMIT || env.RENDER_GIT_COMMIT || null,
    release_id: baked?.release_id ?? null,
    reported_commit: env.RENDER_GIT_COMMIT || null,
  });
}

export function runtimeSourceFingerprint(
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
) {
  const hash = crypto.createHash('sha256');
  function visit(relative) {
    const directory = path.join(root, relative);
    if (!fs.existsSync(directory)) return;
    for (const item of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (
        item.name.startsWith('.') ||
        ['node_modules', '__pycache__', 'data', 'corpus', 'tests'].includes(item.name)
      )
        continue;
      const name = path.join(relative, item.name);
      if (item.isDirectory()) visit(name);
      else if (
        /\.(js|mjs|py)$/.test(item.name) ||
        ['package-lock.json', 'requirements-runtime.txt', 'production-config.json'].includes(
          item.name
        )
      ) {
        hash.update(name.replaceAll(path.sep, '/') + '\0');
        hash.update(fs.readFileSync(path.join(root, name)));
        hash.update('\0');
      }
    }
  }
  visit('mcp');
  visit('lyric-harness');
  visit('scripts');
  visit('references');
  return hash.digest('hex');
}
