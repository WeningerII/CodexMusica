// Generates one selection ZIP off the event loop (library_exports.js). The
// parent posts {directory, layout, format, snapshot}; this thread posts the
// ZIP's bytes in order, in batches of about 1 MiB, waiting for the parent's
// 'more' after each batch so a slow client applies backpressure all the way
// down. A verification failure posts {error}.
import { parentPort, workerData } from 'node:worker_threads';
import { zipChunks } from './library_exports.js';

const BATCH = 1 << 20;
const more = () => new Promise((resolve) => parentPort.once('message', resolve));

const { directory, layout, format, snapshot } = workerData;
try {
  let pending = [];
  let size = 0;
  for (const chunk of zipChunks(directory, layout, format, snapshot)) {
    pending.push(chunk);
    size += chunk.length;
    if (size >= BATCH) {
      // Copied, not transferred: Buffer.concat may sit in Node's shared pool.
      parentPort.postMessage({ chunk: Buffer.concat(pending) });
      pending = [];
      size = 0;
      if ((await more()) === 'stop') process.exit(0);
    }
  }
  if (size) {
    parentPort.postMessage({ chunk: Buffer.concat(pending) });
    await more();
  }
  parentPort.postMessage({ done: true });
} catch (error) {
  parentPort.postMessage({ error: { code: error.code, message: error.message } });
}
