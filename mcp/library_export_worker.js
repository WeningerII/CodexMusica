// Generates one selection ZIP off the event loop (library_exports.js). The
// parent posts {directory, layout, format, snapshot}; this thread posts the
// ZIP's bytes in order, in batches of at most STREAM_WRITE_BYTES (the stream
// guard's per-write bound; a large entry is sliced), waiting for the parent's
// 'more' after each batch so a slow client applies backpressure all the way
// down. A verification failure posts {error}.
import { parentPort, workerData } from 'node:worker_threads';
import { zipChunks } from './library_exports.js';

const BATCH = 1 << 16; // STREAM_WRITE_BYTES (library_export_routes.js)
const more = () => new Promise((resolve) => parentPort.once('message', resolve));

const { directory, layout, format, snapshot, tail = true } = workerData;
try {
  let pending = [];
  let size = 0;
  for (const chunk of zipChunks(directory, layout, format, snapshot, { tail })) {
    pending.push(chunk);
    size += chunk.length;
    if (size >= BATCH) {
      const joined = Buffer.concat(pending);
      let at = 0;
      for (; joined.length - at >= BATCH; at += BATCH) {
        // A copy of exactly this batch: posting a view would clone the whole
        // underlying buffer (and Buffer.concat may sit in the shared pool).
        parentPort.postMessage({ chunk: Uint8Array.prototype.slice.call(joined, at, at + BATCH) });
        if ((await more()) === 'stop') process.exit(0);
      }
      pending = [joined.subarray(at)];
      size = joined.length - at;
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
