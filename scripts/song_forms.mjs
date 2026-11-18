#!/usr/bin/env node
// node scripts/song_forms.mjs [list|describe|realize|create|check] [form-id]
// Optional stdin is one JSON object. With no arguments the object may name
// command and id; an empty request lists the catalog. Counts are template paths.
import { readFile } from 'node:fs/promises';
import { stdin } from 'node:process';
import { describeForm, realizeForm, checkForm } from '../src/song-forms.mjs';
import { gradeObservations } from '../src/song-form-grade.mjs';
import { formMandate } from '../src/song-form-mandate.mjs';
import { projectSongFormCreation } from '../src/song-form-creation.mjs';

const usage = 'node scripts/song_forms.mjs [list|describe|realize|create|check] [form-id]';
async function readRequest() {
  if (stdin.isTTY) return {};
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  const request = JSON.parse(text);
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('Expected one JSON object on stdin');
  }
  return request;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(
      usage +
        '\nstdin: {command?, id?, variant?, counts?, lines?, sections?, units?}\ncreate exit: 0 representable, 2 invalid request, 3 unavailable\ncheck exit: 0 pass, 1 fail, 2 invalid request, 3 unknown'
    );
    return;
  }
  if (args.length > 2) throw new Error(usage);
  const request = await readRequest();
  const { command: requestedCommand, id: requestedId, ...options } = request;
  const [command = requestedCommand ?? 'list', id = requestedId] = args;
  if (
    (requestedCommand !== undefined && command !== requestedCommand) ||
    (requestedId !== undefined && id !== requestedId)
  )
    throw new Error('Arguments and stdin disagree');
  if (!['list', 'describe', 'realize', 'create', 'check', 'grade-observations'].includes(command))
    throw new Error(usage);
  if (command === 'list' ? id !== undefined : typeof id !== 'string' || !id) throw new Error(usage);
  const fields =
    command === 'realize' || command === 'create'
      ? ['variant', 'counts']
      : command === 'grade-observations'
        ? ['variant', 'counts', 'lines', 'sections']
        : command === 'check'
          ? ['variant', 'counts', 'lines', 'sections', 'units']
          : [];
  for (const key of Object.keys(options)) {
    if (!fields.includes(key)) throw new Error('Unsupported ' + command + ' option: ' + key);
  }
  const source = JSON.parse(
    await readFile(new URL('../data/song-forms.json', import.meta.url), 'utf8')
  );
  const catalog = Array.isArray(source) ? source : source.forms;
  let result;
  if (command === 'list') {
    result = catalog.map(({ id, name, scope, patterns }) => ({
      id,
      name,
      scope,
      variants: patterns.length,
    }));
  } else if (command === 'grade-observations') {
    result = gradeObservations(catalog, id, options);
  } else if (command === 'describe') {
    result = describeForm(catalog, id);
  } else if (command === 'create') {
    const plan = realizeForm(catalog, id, options);
    result = projectSongFormCreation(plan, options.counts);
    if (result.status !== 'ready') process.exitCode = 3;
  } else if (command === 'realize') {
    const plan = realizeForm(catalog, id, options);
    result = { ...plan, mandate: formMandate(plan) };
    if (plan.status !== 'ready') process.exitCode = 3;
  } else {
    result = checkForm(catalog, id, options);
    process.exitCode = { pass: 0, fail: 1, unknown: 3 }[result.verdict];
  }
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 2;
});
