import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeSourceFingerprint } from './build_identity.js';

const root = fileURLToPath(new URL('../lyric-harness/', import.meta.url));
const defaultProof = fileURLToPath(new URL('./capacity_verification.json', import.meta.url));
function stat(file) {
  try {
    const value = fs.statSync(file);
    return [file, value.size, value.mtimeMs, value.ctimeMs, value.ino];
  } catch {
    return [file, null];
  }
}
function directoryEpoch(directory, seen = new Set()) {
  try {
    const real = fs.realpathSync(directory);
    if (seen.has(real)) return [];
    seen.add(real);
    const result = [stat(directory)];
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const child = path.join(directory, entry.name);
      let directoryChild = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        // A broken link must not prevent observing later sibling directories.
        try {
          directoryChild = fs.statSync(child).isDirectory();
        } catch {}
      }
      if (directoryChild) result.push(...directoryEpoch(child, seen));
    }
    return result;
  } catch {
    return [stat(directory)];
  }
}
function canonical(directory) {
  try {
    return fs.realpathSync(directory);
  } catch {
    return path.resolve(directory);
  }
}
function assetEpoch(env) {
  const manifest = path.join(root, 'data/runtime_assets.json');
  const staged = env.LYRIC_STAGED_DATA || path.join(root, 'data');
  const files = [manifest, path.join(root, 'data'), path.join(root, 'corpus'), staged];
  try {
    for (const asset of JSON.parse(fs.readFileSync(manifest, 'utf8')).assets)
      for (const item of asset.files) {
        const base = asset.base === 'root' ? root : staged;
        const file = path.join(base, item.path);
        files.push(file);
        for (
          let parent = path.dirname(file);
          parent.startsWith(base) && parent !== path.dirname(parent);
          parent = path.dirname(parent)
        )
          files.push(parent);
      }
  } catch {}
  return [...new Set(files)]
    .map(stat)
    .concat(
      ...[path.join(root, 'data'), staged, path.join(root, 'corpus')].map((directory) =>
        directoryEpoch(directory)
      )
    );
}

// The production reader is cached only while its source, consumed asset file
// identities, interpreter selection and exact proof bytes remain unchanged.
export function createRuntimeAssetReader({
  env = process.env,
  run = spawnSync,
  source = runtimeSourceFingerprint,
} = {}) {
  let cached, previous;
  return function read() {
    const required = env.LYRIC_RELEASE_ASSETS_REQUIRED === '1';
    // This must name the same interpreter as lyric_tools.js's worker bridge.
    const python = env.LYRIC_PYTHON || 'python3';
    const proofFile = env.LYRIC_CAPACITY_ATTESTATION || defaultProof;
    let proofBytes = null,
      proof = null;
    try {
      if (fs.statSync(proofFile).size <= 1024 * 1024) {
        proofBytes = fs.readFileSync(proofFile);
        proof = JSON.parse(proofBytes);
      }
    } catch {}
    const proofHash = proofBytes ? createHash('sha256').update(proofBytes).digest('hex') : null;
    const epoch = () =>
      JSON.stringify([
        required,
        python,
        env.NLTK_DATA,
        env.LYRIC_STAGED_DATA,
        proofFile,
        proofHash,
        source(),
        assetEpoch(env),
      ]);
    const key = epoch();
    if (cached && key === previous) return cached;
    const options = {
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      env,
    };
    const result = run(
      python,
      [path.join(root, 'quality/release_assets.py'), required ? '--check' : '--integrity'],
      options
    );
    let inventory;
    try {
      inventory = JSON.parse(result.stdout);
    } catch {
      inventory = null;
    }
    const inventoryOK = result.status === 0 && inventory?.ok === true;
    const approvedTagger = path.join(env.LYRIC_STAGED_DATA || path.join(root, 'data'), 'nltk');
    const taggerOK =
      !required || !env.NLTK_DATA || canonical(env.NLTK_DATA) === canonical(approvedTagger);
    const assetOK = inventoryOK && taggerOK;
    const errors = inventoryOK
      ? []
      : inventory?.errors?.length
        ? [...inventory.errors]
        : [result.error?.message || 'Asset inventory did not complete.'];
    if (!taggerOK)
      errors.push(
        'LYRIC_ASSETS_UNAVAILABLE: production NLTK_DATA must name the approved staged/nltk model.'
      );
    let capacityOK = !required;
    if (required && assetOK) {
      if (!proof)
        errors.push(
          'CAPACITY_UNVERIFIED: actual-runtime all-family receipt is missing or unreadable.'
        );
      else {
        const checked = run(
          python,
          [path.join(root, 'quality/verify_capacity.py'), '--output', proofFile, '--check'],
          options
        );
        capacityOK = checked.status === 0;
        if (!capacityOK)
          errors.push(
            'CAPACITY_UNVERIFIED: ' +
              (checked.error?.message ||
                checked.stderr?.trim() ||
                'the current runtime/source/table proof was refused.')
          );
      }
    }
    // A verifier never creates a proof on this read-only path. Detect a receipt
    // swap during validation before caching a successful readiness result.
    if (required && capacityOK) {
      try {
        if (!proofBytes.equals(fs.readFileSync(proofFile))) capacityOK = false;
      } catch {
        capacityOK = false;
      }
      if (!capacityOK) errors.push('CAPACITY_UNVERIFIED: receipt changed during validation.');
    }
    if (required && capacityOK && epoch() !== key) {
      capacityOK = false;
      errors.push('CAPACITY_UNVERIFIED: source or assets changed during validation.');
    }
    previous = key;
    cached = Object.freeze({
      ok: assetOK && capacityOK,
      releaseRequired: required,
      errors,
      capacity: { required, ok: capacityOK, receipt_sha256: proofHash },
      manifest_sha256: inventory?.manifest_sha256 || null,
      assets_sha256: inventory?.assets
        ? createHash('sha256').update(JSON.stringify(inventory.assets)).digest('hex')
        : null,
      python: inventory?.python || null,
      nltk: inventory?.nltk || null,
    });
    return cached;
  };
}
export const runtimeAssets = createRuntimeAssetReader();
