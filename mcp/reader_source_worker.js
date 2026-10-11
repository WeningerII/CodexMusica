// Verifies one complete canonical reading off the event loop for the create
// path (reader_scheduler.resolveEntry): reads it, checks its manifest hash and
// its identity and revision exactly as resolveSource does, and posts only
// readingSummary's fields back, so the parsed tree never reaches the main
// thread. A refusal posts {error: {code, message}}.
import { readFile } from 'node:fs/promises';
import { parentPort, workerData } from 'node:worker_threads';
import { readingSummary, verifyReading } from './reader_scheduler.js';

const { file, expected, request } = workerData;
try {
  const source = verifyReading(await readFile(file), expected, request);
  parentPort.postMessage({ summary: readingSummary(source) });
} catch (failure) {
  parentPort.postMessage({
    error:
      failure.code === 'ENOENT'
        ? {
            code: 'SOURCE_UNAVAILABLE',
            message: 'The registered reading is not installed in the approved snapshot.',
          }
        : { code: failure.code || 'SNAPSHOT_CHANGED', message: failure.message },
  });
}
