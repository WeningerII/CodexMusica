// Durable receipts and checkpoints for the battery. The full signed envelope
// is a continuation capability: keep checkpoint artifacts private to the run.
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function readJSON(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function atomicJSON(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  const fd = openSync(tmp, 'wx', 0o600);
  try {
    writeFileSync(fd, JSON.stringify(value) + '\n');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
  const dir = openSync(dirname(file), 'r');
  try {
    fsyncSync(dir);
  } finally {
    closeSync(dir);
  }
}

export function appendDurable(file, value) {
  const created = !existsSync(file);
  const fd = openSync(file, 'a', 0o600);
  try {
    const bytes = Buffer.from(JSON.stringify(value) + '\n');
    let written = 0;
    while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  if (created) {
    const dir = openSync(dirname(file), 'r');
    try {
      fsyncSync(dir);
    } finally {
      closeSync(dir);
    }
  }
}

export function flushFile(file) {
  const fd = openSync(file, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
