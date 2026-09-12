// Battery receipts contain continuation capabilities. Only authenticated,
// encrypted archives and the deliberately small public summary may be uploaded.
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { projectRecord } from './battery_inspect.mjs';

const VERSION = 1;
const CIPHER = 'AES-256-GCM';
const AAD = Buffer.from(`CodexMusica battery archive\nversion=${VERSION}\ncipher=${CIPHER}\n`);
const MIB = 1024 * 1024;
export const ARCHIVE_LIMITS = Object.freeze({
  files: 10_000,
  fileBytes: 32 * MIB,
  totalBytes: 128 * MIB,
  payloadBytes: 192 * MIB,
  archiveBytes: 256 * MIB,
  pathBytes: 1024,
  depth: 32,
});

class ArchiveError extends Error {
  constructor(code) {
    super(`Battery archive rejected (${code}).`);
    this.code = code;
  }
}

function reject(code) {
  throw new ArchiveError(code);
}

// Neither filesystem exceptions nor JSON/parser errors may print private names
// or content. The public error vocabulary is entirely defined in this module.
function guarded(operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ArchiveError) throw error;
    throw new ArchiveError('operation_failed');
  }
}

export function checkKey(key = process.env.BATTERY_RECOVERY_KEY) {
  if (typeof key !== 'string' || !/^[0-9a-fA-F]{64}$/.test(key)) reject('invalid_key');
  return Buffer.from(key, 'hex');
}

function directoryChain(path) {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  let current = root;
  for (const part of [root, ...absolute.slice(root.length).split(sep).filter(Boolean)]) {
    current = part === root ? root : join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) reject('unsafe_directory');
  }
  return absolute;
}

function optionalStat(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function safePath(path) {
  if (
    typeof path !== 'string' ||
    !path ||
    Buffer.byteLength(path) > ARCHIVE_LIMITS.pathBytes ||
    isAbsolute(path) ||
    /[\\:]/.test(path) ||
    [...path].some((character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127)
  ) {
    reject('unsafe_entry_path');
  }
  const parts = path.split('/');
  if (
    parts.length > ARCHIVE_LIMITS.depth ||
    parts.some(
      (part) =>
        !part ||
        part === '.' ||
        part === '..' ||
        /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
    )
  ) {
    reject('unsafe_entry_path');
  }
  return parts;
}

function pathKey(path) {
  return path.normalize('NFC').toLowerCase();
}

function addPath(path, entries, parents) {
  const parts = safePath(path);
  const key = pathKey(path);
  if (entries.has(key) || parents.has(key)) reject('duplicate_or_conflicting_path');
  for (let length = 1; length < parts.length; length++) {
    const spelling = parts.slice(0, length).join('/');
    const parent = pathKey(spelling);
    if (entries.has(parent) || (parents.has(parent) && parents.get(parent) !== spelling)) {
      reject('duplicate_or_conflicting_path');
    }
    parents.set(parent, spelling);
  }
  entries.add(key);
  if (entries.size + parents.size > ARCHIVE_LIMITS.files) reject('entry_limit');
}

function boundedRead(path, limit, expected = null) {
  directoryChain(dirname(path));
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) reject('unsafe_file');
  if (stat.size > limit) reject('size_limit');
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (
      !before.isFile() ||
      before.dev !== stat.dev ||
      before.ino !== stat.ino ||
      before.size > limit ||
      (expected &&
        (before.dev !== expected.dev ||
          before.ino !== expected.ino ||
          before.size !== expected.size ||
          before.mtimeMs !== expected.mtimeMs ||
          before.ctimeMs !== expected.ctimeMs))
    ) {
      reject('source_changed');
    }
    const pieces = [];
    let size = 0;
    while (true) {
      const buffer = Buffer.alloc(Math.min(64 * 1024, limit - size + 1));
      const count = readSync(fd, buffer, 0, buffer.length, null);
      if (count === 0) break;
      size += count;
      if (size > limit) reject('size_limit');
      pieces.push(buffer.subarray(0, count));
    }
    const after = fstatSync(fd);
    if (
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs ||
      size !== before.size
    ) {
      reject('source_changed');
    }
    return Buffer.concat(pieces, size);
  } finally {
    closeSync(fd);
  }
}

function sourceFiles(source) {
  const files = [];
  let entries = 0;
  function visit(dir, prefix) {
    directoryChain(dir);
    for (const name of readdirSync(dir).sort()) {
      if (++entries > ARCHIVE_LIMITS.files) reject('entry_limit');
      const path = prefix ? `${prefix}/${name}` : name;
      safePath(path);
      const absolute = join(dir, name);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) reject('unsafe_file');
      if (stat.isDirectory()) visit(absolute, path);
      else if (stat.isFile()) files.push({ path, absolute, stat });
      else reject('unsafe_file');
    }
  }
  visit(source, '');
  return files;
}

function syncDirectory(path) {
  directoryChain(path);
  const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function privateFile(path, data) {
  directoryChain(dirname(path));
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  try {
    fchmodSync(fd, 0o600);
    writeFileSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function atomicArchive(out, data) {
  const parent = directoryChain(dirname(out));
  const previous = optionalStat(out);
  if (previous && (previous.isSymbolicLink() || !previous.isFile())) reject('unsafe_output');
  const temporary = join(parent, `.battery-archive-${randomUUID()}.tmp`);
  try {
    privateFile(temporary, data);
    directoryChain(parent);
    const current = optionalStat(out);
    if (current && (current.isSymbolicLink() || !current.isFile())) reject('unsafe_output');
    renameSync(temporary, out);
    syncDirectory(parent);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function publicMetadata(files, plaintextBytes, sealedBytes) {
  return {
    version: VERSION,
    cipher: CIPHER,
    files_count: files,
    plaintext_bytes: plaintextBytes,
    sealed_bytes: sealedBytes,
  };
}

// The source must be quiescent: this is an archive, not a filesystem snapshot.
// Source data is never removed. Re-sealing atomically replaces an older archive.
export function sealArchive({ source, out, key = process.env.BATTERY_RECOVERY_KEY } = {}) {
  return guarded(() => {
    const secret = checkKey(key);
    try {
      const root = directoryChain(source);
      const destination = resolve(out);
      const beneath = relative(root, destination);
      if (
        !beneath ||
        (!beneath.startsWith(`..${sep}`) && beneath !== '..' && !isAbsolute(beneath))
      ) {
        reject('output_inside_source');
      }
      directoryChain(dirname(destination));
      const paths = new Set();
      const parents = new Map();
      let total = 0;
      const sourceEntries = sourceFiles(root);
      const files = sourceEntries.map(({ path, absolute, stat }) => {
        addPath(path, paths, parents);
        const data = boundedRead(
          absolute,
          Math.min(ARCHIVE_LIMITS.fileBytes, ARCHIVE_LIMITS.totalBytes - total),
          stat
        );
        total += data.length;
        return { path, data: data.toString('base64') };
      });
      // Catch ordinary concurrent appends/renames before sealing a stale scan.
      const finalEntries = sourceFiles(root);
      if (
        finalEntries.length !== sourceEntries.length ||
        finalEntries.some((entry, index) => {
          const before = sourceEntries[index];
          return (
            entry.path !== before.path ||
            entry.stat.dev !== before.stat.dev ||
            entry.stat.ino !== before.stat.ino ||
            entry.stat.size !== before.stat.size ||
            entry.stat.mtimeMs !== before.stat.mtimeMs ||
            entry.stat.ctimeMs !== before.stat.ctimeMs
          );
        })
      ) {
        reject('source_changed');
      }
      const payload = Buffer.from(JSON.stringify({ version: VERSION, files }));
      if (payload.length > ARCHIVE_LIMITS.payloadBytes) reject('size_limit');
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', secret, nonce, { authTagLength: 16 });
      cipher.setAAD(AAD);
      const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
      const archive = Buffer.from(
        JSON.stringify({
          version: VERSION,
          cipher: CIPHER,
          nonce: nonce.toString('base64'),
          tag: cipher.getAuthTag().toString('base64'),
          ciphertext: ciphertext.toString('base64'),
        }) + '\n'
      );
      if (archive.length > ARCHIVE_LIMITS.archiveBytes) reject('size_limit');
      atomicArchive(destination, archive);
      return publicMetadata(files.length, total, archive.length);
    } finally {
      secret.fill(0);
    }
  });
}

function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function base64(value, limit) {
  if (
    typeof value !== 'string' ||
    value.length > 4 * Math.ceil(limit / 3) ||
    value.length % 4 !== 0 ||
    /[^A-Za-z0-9+/=]/.test(value)
  ) {
    reject('invalid_encoding');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length > limit || decoded.toString('base64') !== value) reject('invalid_encoding');
  return decoded;
}

export function openArchive({ archive, out, key = process.env.BATTERY_RECOVERY_KEY } = {}) {
  return guarded(() => {
    const secret = checkKey(key);
    try {
      const encoded = boundedRead(resolve(archive), ARCHIVE_LIMITS.archiveBytes);
      const header = JSON.parse(encoded.toString('utf8'));
      if (
        !exactKeys(header, ['version', 'cipher', 'nonce', 'tag', 'ciphertext']) ||
        header.version !== VERSION ||
        header.cipher !== CIPHER
      ) {
        reject('invalid_format');
      }
      const nonce = base64(header.nonce, 12);
      const tag = base64(header.tag, 16);
      const ciphertext = base64(header.ciphertext, ARCHIVE_LIMITS.payloadBytes);
      if (nonce.length !== 12 || tag.length !== 16) reject('invalid_format');
      const decipher = createDecipheriv('aes-256-gcm', secret, nonce, { authTagLength: 16 });
      decipher.setAAD(AAD);
      decipher.setAuthTag(tag);
      let plaintext;
      try {
        plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } catch {
        reject('authentication_failed');
      }
      const payload = JSON.parse(plaintext.toString('utf8'));
      if (
        !exactKeys(payload, ['version', 'files']) ||
        payload.version !== VERSION ||
        !Array.isArray(payload.files) ||
        payload.files.length > ARCHIVE_LIMITS.files
      ) {
        reject('invalid_payload');
      }
      const paths = new Set();
      const parents = new Map();
      let total = 0;
      // Authenticate and validate every path and byte limit before creating any
      // restore directory. A correctly encrypted malicious manifest is refused.
      const files = payload.files.map((entry) => {
        if (!exactKeys(entry, ['path', 'data'])) reject('invalid_payload');
        addPath(entry.path, paths, parents);
        const data = base64(
          entry.data,
          Math.min(ARCHIVE_LIMITS.fileBytes, ARCHIVE_LIMITS.totalBytes - total)
        );
        total += data.length;
        return { path: entry.path, data };
      });
      const destination = resolve(out);
      const parent = directoryChain(dirname(destination));
      if (optionalStat(destination)) reject('output_exists');
      let temporary = mkdtempSync(join(parent, '.battery-restore-'));
      try {
        // mkdtemp uses mode 0700. Explicitly preserve it across unusual umasks.
        const fd = openSync(
          temporary,
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
        );
        try {
          fchmodSync(fd, 0o700);
        } finally {
          closeSync(fd);
        }
        const directories = new Set([temporary]);
        for (const file of files) {
          const parts = safePath(file.path);
          let dir = temporary;
          for (const part of parts.slice(0, -1)) {
            dir = join(dir, part);
            if (!directories.has(dir)) {
              directoryChain(dirname(dir));
              mkdirSync(dir, { mode: 0o700 });
              const directoryFd = openSync(
                dir,
                constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
              );
              try {
                fchmodSync(directoryFd, 0o700);
              } finally {
                closeSync(directoryFd);
              }
              directories.add(dir);
            }
          }
          privateFile(join(dir, parts.at(-1)), file.data);
        }
        for (const directory of [...directories].reverse()) syncDirectory(directory);
        directoryChain(parent);
        if (optionalStat(destination)) reject('output_exists');
        renameSync(temporary, destination);
        temporary = null;
        syncDirectory(parent);
      } finally {
        if (temporary) rmSync(temporary, { recursive: true, force: true });
      }
      return publicMetadata(files.length, total, encoded.length);
    } finally {
      secret.fill(0);
    }
  });
}

const EXIT_REASONS = new Set([
  'finished',
  'failed_fast',
  'server_turn_cap',
  'upstream_final',
  'rate_limited',
  'transport',
  'no_stop',
  'uncertain_proposal',
  'aggregate_deadline',
  'storage_budget',
  'turn_wall_checkpoint',
  'turn_wall_continued',
]);

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000 ? value : 0;
}

export function safeSummary(summary) {
  if (!summary || typeof summary !== 'object' || !Array.isArray(summary.songs)) {
    return { state: 'no_summary' };
  }
  const songs = summary.songs
    .slice(0, ARCHIVE_LIMITS.files)
    .filter((song) => song && typeof song === 'object' && !Array.isArray(song))
    .map((song) => ({
      song: count(song.song),
      turns: count(song.turns),
      retries: count(song.retries),
      exit_reason: EXIT_REASONS.has(song.exit_reason) ? song.exit_reason : 'unknown',
      parked: count(song.parked),
      expected: song.expected === true,
    }));
  return {
    songs,
    expected: summary.expected === true,
    completed_songs: songs.filter((song) => song.exit_reason === 'finished').length,
    total_songs: songs.length,
  };
}

function readSummary(source) {
  return guarded(() => {
    const root = resolve(source);
    directoryChain(dirname(root));
    if (!optionalStat(root)) return { state: 'no_summary' };
    directoryChain(root);
    const file = join(root, 'summary.json');
    if (!optionalStat(file)) return { state: 'no_summary' };
    const summary = safeSummary(
      JSON.parse(boundedRead(file, ARCHIVE_LIMITS.fileBytes).toString('utf8'))
    );
    // A song reaches `summary.json` only when it ends; a run that was
    // cancelled or killed mid-song left nothing there. The projection reads
    // the checkpoint and transcript for what the summary cannot yet say —
    // counts, enums and timings only (battery_inspect.mjs).
    summary.inspection = projectRecord(root);
    return summary;
  });
}

function main(argv) {
  if (argv.length === 1 && argv[0] === '--check-key') {
    checkKey().fill(0);
    console.log(JSON.stringify({ key_valid: true }));
    return;
  }
  const [command, ...options] = argv;
  const args = {};
  const allowed =
    command === 'seal'
      ? ['source', 'out']
      : command === 'open'
        ? ['archive', 'out']
        : command === 'summary'
          ? ['source']
          : [];
  if (!allowed.length) reject('invalid_arguments');
  for (const option of options) {
    const match = /^--([a-z]+)=(.+)$/.exec(option);
    if (!match || !allowed.includes(match[1]) || Object.hasOwn(args, match[1])) {
      reject('invalid_arguments');
    }
    args[match[1]] = match[2];
  }
  if (allowed.some((key) => !Object.hasOwn(args, key))) reject('invalid_arguments');
  const result =
    command === 'seal'
      ? sealArchive(args)
      : command === 'open'
        ? openArchive(args)
        : readSummary(args.source);
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(
      error instanceof ArchiveError ? error.message : 'Battery archive rejected (operation_failed).'
    );
    process.exitCode = 1;
  }
}
