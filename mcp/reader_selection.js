// Server-construction input only. Hash equality verifies artifact bytes, not
// semantic qualification or the Python import closure. Deployment must bind
// these paths to its immutable launcher and approve the pinned descriptor.
// No environment variable, request field, word-cut scheme or C1 enables this.
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { prepareReaderBootstrap } from './reader_bootstrap.js';

const selections = new WeakMap();
const fields = [
  'version',
  'discovery_version',
  'cursor_version',
  'worker_sha256',
  'producer_sha256',
];
const refuse = () =>
  Object.assign(new Error('Reader discovery artifact selection is unavailable.'), {
    code: 'READER_UNAVAILABLE',
  });
function verify(binding) {
  try {
    for (const [filename, expected] of binding.artifacts) {
      if (
        !statSync(filename).isFile() ||
        createHash('sha256').update(readFileSync(filename)).digest('hex') !== expected
      )
        throw refuse();
    }
  } catch {
    throw refuse();
  }
}

// descriptor is a reviewed server-owned pin, not a worker's claimed hash.
// bridge and paths must come from the same trusted launcher construction.
// The opaque token cannot be supplied as a JSON/request capability.
export function verifyReaderSelection({ descriptor, bridge, workerPath, producerPath }) {
  if (
    !descriptor ||
    Object.getPrototypeOf(descriptor) !== Object.prototype ||
    Object.keys(descriptor).sort().join(',') !== [...fields].sort().join(',') ||
    descriptor.version !== 1 ||
    descriptor.discovery_version !== 1 ||
    descriptor.cursor_version !== 2 ||
    ![descriptor.worker_sha256, descriptor.producer_sha256].every(
      (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
    ) ||
    !bridge ||
    typeof bridge.runReaderLease !== 'function' ||
    ![workerPath, producerPath].every((v) => typeof v === 'string' && path.isAbsolute(v))
  )
    throw refuse();
  const binding = {
    bridge,
    artifacts: [
      [workerPath, descriptor.worker_sha256],
      [producerPath, descriptor.producer_sha256],
    ],
  };
  verify(binding);
  const token = Object.freeze({});
  selections.set(token, binding);
  return token;
}

export function checkReaderSelection(selection, bridge) {
  if (selection === null) return;
  const binding = selections.get(selection);
  if (!binding || binding.bridge !== bridge) throw refuse();
  verify(binding);
}

export function selectedReaderBootstrap(selection, bridge, record) {
  checkReaderSelection(selection, bridge);
  return selection === null ? null : prepareReaderBootstrap({ selectedWorker: 'v2', record });
}
