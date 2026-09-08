#!/usr/bin/env node
// Discovery and calls through the maintained client; no session-only bridge.
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectConnector } from '../mcp/client.js';

export function parseFlags(argv) {
  const allowed = new Set(['task', 'phase', 'session-file', 'url', 'call', 'args-file', 'out']);
  const flags = {};
  for (const arg of argv) {
    const i = arg.indexOf('=');
    const name = arg.slice(2, i);
    if (!arg.startsWith('--') || i < 3 || !allowed.has(name) || name in flags || !arg.slice(i + 1))
      throw new Error(
        'Use --task=recipe|lyrics, --url=URL, --call=TOOL, --args-file=FILE, --out=FILE.'
      );
    flags[name] = arg.slice(i + 1);
  }
  if (!['recipe', 'lyrics'].includes(flags.task)) throw new Error('Select --task=recipe|lyrics.');
  if (flags.phase && (flags.task !== 'lyrics' || !['create', 'edit'].includes(flags.phase)))
    throw new Error('--phase=create|edit requires --task=lyrics.');
  if (flags['args-file'] && !flags.call) throw new Error('--args-file requires --call.');
  if (flags.task === 'lyrics' && flags.phase !== 'edit' && flags.call && !flags['session-file'])
    throw new Error(
      'New-song calls require --session-file=FILE to preserve executed workflow receipts. Use the same private file for every call; --phase=edit is only for an existing song.'
    );
  return flags;
}

// A resumed run can contain unreleased lyrics and continuation capabilities.
// Replacement must protect existing public files too, and cannot leave half JSON.
export async function writePrivateOutput(file, text) {
  const target = resolve(file);
  const temporary = `${target}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(text);
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporary, target);
  } finally {
    await handle?.close();
    await fs.rm(temporary, { force: true });
  }
}

export async function main(argv = process.argv.slice(2)) {
  const flags = parseFlags(argv);
  const args = flags['args-file'] ? JSON.parse(await fs.readFile(flags['args-file'], 'utf8')) : {};
  let session = null;
  if (flags['session-file']) {
    try {
      session = JSON.parse(await fs.readFile(flags['session-file'], 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const task =
    flags.task === 'lyrics' ? { domain: 'lyrics', phase: flags.phase || 'create' } : flags.task;
  const connection = await connectConnector({ url: flags.url, task, session });
  try {
    const result = flags.call ? await connection.call(flags.call, args) : connection.surface;
    if (flags['session-file'])
      await writePrivateOutput(flags['session-file'], JSON.stringify(connection.snapshot()) + '\n');
    const text = JSON.stringify(result, null, 2) + '\n';
    if (flags.out) await writePrivateOutput(flags.out, text);
    else process.stdout.write(text);
    if (result?.isError) process.exitCode = 2;
  } finally {
    await connection.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
