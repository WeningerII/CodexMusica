#!/usr/bin/env node
// Offline rollback preparation. Stop all reader processes and disable gzip first.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  READER_LIMITS,
  decodeStoredObject,
  atomicWrite,
  syncDirectory,
  withReaderWriterLock,
} from './reader_job_store.js';

const kinds = ['pages', 'indexes', 'checkpoints', 'manifests', 'definitions'];
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = (message) => Object.assign(new Error(message), { code: 'INFLATE_REFUSED' });
function read(file, hash) {
  if (!fs.lstatSync(file).isFile() || fs.statSync(file).size > READER_LIMITS.objectBytes)
    throw fail(`Invalid or oversized object: ${file}`);
  const raw = fs.readFileSync(file);
  const plain = decodeStoredObject(raw);
  if (sha(plain) !== hash) throw fail(`Object hash mismatch: ${file}`);
  return { plain, gzip: raw[0] === 0x1f && raw[1] === 0x8b };
}

/** directory is the reader-jobs-v1 directory, not READER_RUNTIME_DIR.
 * Hooks are fixture-only: the CLI always measures actual filesystem free space.
 * Never instantiate ReaderJobStore here: startup would collect orphan objects.
 */
export function inflateReaderStore(
  directory,
  {
    freeBytes = () => {
      const s = fs.statfsSync(directory, { bigint: true });
      return s.bavail * s.bsize;
    },
    fault = () => {},
  } = {}
) {
  directory = path.resolve(directory);
  return withReaderWriterLock(directory, () => {
    const marker = path.join(directory, 'store-format.json');
    if (fs.existsSync(marker) && JSON.parse(fs.readFileSync(marker, 'utf8')).min_reader !== 'A')
      throw fail('Unknown store format; no conversion attempted.');
    const generationFile = path.join(directory, 'generation');
    const generation = fs.existsSync(generationFile)
      ? JSON.parse(fs.readFileSync(generationFile, 'utf8')).generation
      : 0;
    if (!Number.isSafeInteger(generation) || generation < 0) throw fail('Invalid generation.');
    const objects = [];
    let inflatedBytes = 0;
    // Full validation before touching any object. Repeating a partial conversion
    // simply sees the already-converted objects as plain and verifies them too.
    for (const kind of kinds) {
      for (const name of fs.readdirSync(path.join(directory, kind))) {
        if (!/^[a-f0-9]{64}\.json$/.test(name)) throw fail(`Unexpected object: ${kind}/${name}`);
        const hash = name.slice(0, -5);
        const item = read(path.join(directory, kind, name), hash);
        objects.push({
          path: `${kind}/${name}`,
          sha256: hash,
          bytes: item.plain.length,
          gzip: item.gzip,
        });
        if (item.gzip) inflatedBytes += item.plain.length;
      }
    }
    // Stage all remaining gzip objects beside the store before replacing any.
    // 20% headroom is retained rather than relying on compression-ratio guesses.
    const required = (BigInt(inflatedBytes) * 120n + 99n) / 100n;
    if (BigInt(freeBytes()) < required) throw fail(`Need ${required} free bytes for conversion.`);
    const pending = path.join(directory, 'pending');
    const stage = path.join(directory, 'inflate-staging');
    const manifestFile = path.join(directory, 'inflate-manifest.json');
    const manifest = {
      version: 1,
      complete: false,
      objects: objects.map(({ gzip: _gzip, ...o }) => o),
    };
    // Establish a compatibility floor even for manually imported gzip fixtures.
    if (objects.some((o) => o.gzip) && !fs.existsSync(marker))
      atomicWrite(marker, JSON.stringify({ min_reader: 'A' }));
    atomicWrite(pending, JSON.stringify({ generation: generation + 1 }));
    atomicWrite(manifestFile, JSON.stringify(manifest));
    fs.mkdirSync(stage, { recursive: true, mode: 0o700 });
    syncDirectory(directory);
    for (const object of objects.filter((o) => o.gzip)) {
      const file = path.join(directory, object.path);
      const staged = path.join(stage, object.path.replace('/', '-'));
      atomicWrite(staged, read(file, object.sha256).plain);
      if (sha(fs.readFileSync(staged)) !== object.sha256) throw fail('Staged hash mismatch.');
      fault('staged', object);
    }
    for (const object of objects.filter((o) => o.gzip)) {
      const file = path.join(directory, object.path);
      const staged = path.join(stage, object.path.replace('/', '-'));
      const stat = fs.statSync(file);
      // Atomic replacement means readers see either a complete gzip or plain object.
      fs.renameSync(staged, file);
      fs.utimesSync(file, stat.atime, stat.mtime);
      const fd = fs.openSync(file, 'r');
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      syncDirectory(path.dirname(file));
      syncDirectory(stage);
      fault('replaced', object);
    }
    for (const object of objects) {
      const file = path.join(directory, object.path);
      if (read(file, object.sha256).gzip)
        throw fail('A gzip object remains; retaining compatibility marker.');
      // Also fence replacements from an interrupted previous invocation whose
      // rename may have happened before its directory fsync.
      const fd = fs.openSync(file, 'r');
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    }
    for (const kind of kinds) syncDirectory(path.join(directory, kind));
    // All replacements are verified/durable before publishing completion and
    // lowering the external compatibility floor. Keep the checksum manifest.
    manifest.complete = true;
    atomicWrite(manifestFile, JSON.stringify(manifest));
    atomicWrite(generationFile, JSON.stringify({ generation: generation + 1 }));
    fs.unlinkSync(pending);
    syncDirectory(directory);
    fault('before_marker_removal');
    if (fs.existsSync(marker)) fs.unlinkSync(marker);
    syncDirectory(directory);
    fs.rmSync(stage, { recursive: true, force: true });
    syncDirectory(directory);
    return {
      converted: objects.filter((o) => o.gzip).length,
      inflatedBytes,
      manifest: manifestFile,
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) {
    console.error('Usage: node mcp/reader_store_inflate.mjs /absolute/path/reader-jobs-v1');
    process.exitCode = 2;
  } else {
    try {
      console.log(JSON.stringify(inflateReaderStore(process.argv[2])));
    } catch (error) {
      console.error(`${error.code || 'INFLATE_FAILED'}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
