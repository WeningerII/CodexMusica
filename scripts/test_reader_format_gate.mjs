// node --test scripts/test_reader_format_gate.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readerFormatDecision,
  liveReaderRequirement,
  READER_FORMATS,
  READER_FORMAT_LABEL,
} from './reader_format_gate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

test('every row of the gate table', () => {
  const up = (minReader) => ({ reachable: true, minReader });
  const down = { reachable: false, minReader: 'unknown' };
  const rows = [
    [up(null), undefined, true],
    [up(null), 'A', true],
    [up('A'), 'A', true],
    [up('A'), undefined, false],
    [up('A'), null, false],
    [up('unknown'), 'A', true],
    [up('unknown'), undefined, false],
    [down, 'A', true],
    [down, undefined, false],
  ];
  for (const [live, candidate, go] of rows)
    assert.equal(readerFormatDecision(live, candidate).go, go, JSON.stringify({ live, candidate }));
});

test('an unlabeled image is refused once the marker exists, naming the inflate utility', () => {
  const d = readerFormatDecision({ reachable: true, minReader: 'A' }, undefined);
  assert.equal(d.go, false);
  assert.match(d.why, /store-format\.json/);
  assert.match(d.why, /reader_store_inflate\.mjs/);
});

test('a format the gate does not know is refused on either side', () => {
  assert.equal(readerFormatDecision({ reachable: true, minReader: null }, 'Z').go, false);
  assert.equal(readerFormatDecision({ reachable: true, minReader: 'Z' }, 'A').go, false);
  assert.equal(readerFormatDecision({ reachable: true, minReader: 'Z' }, undefined).go, false);
});

test('health bodies map to the live requirement', () => {
  assert.deepEqual(liveReaderRequirement(null), { reachable: false, minReader: 'unknown' });
  assert.deepEqual(liveReaderRequirement({ contract: 1 }), { reachable: true, minReader: null });
  assert.deepEqual(liveReaderRequirement({ reader_store: { min_reader: null } }), { reachable: true, minReader: null });
  assert.deepEqual(liveReaderRequirement({ reader_store: { min_reader: 'A' } }), { reachable: true, minReader: 'A' });
  assert.deepEqual(liveReaderRequirement({ reader_store: { min_reader: 'unknown' } }), { reachable: true, minReader: 'unknown' });
  assert.deepEqual(liveReaderRequirement({ reader_store: {} }), { reachable: true, minReader: 'unknown' });
  assert.deepEqual(liveReaderRequirement({ reader_store: { min_reader: 3 } }), { reachable: true, minReader: 'unknown' });
});

test('the Dockerfile labels the final image with the newest format', () => {
  const dockerfile = readFileSync(join(root, 'mcp/Dockerfile'), 'utf8');
  const stages = dockerfile.split(/^FROM /m);
  const final = stages[stages.length - 1];
  const newest = READER_FORMATS[READER_FORMATS.length - 1];
  assert.match(final, new RegExp(`^LABEL ${READER_FORMAT_LABEL.replace(/\./g, '\\.')}="${newest}"$`, 'm'));
});

const run = (args) =>
  new Promise((resolveRun) =>
    execFile(process.execPath, [join(here, 'reader_format_gate.mjs'), ...args], (error, stdout, stderr) =>
      resolveRun({ code: error ? error.code : 0, stdout, stderr })
    )
  );

test('the CLI against a stub health server', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'reader-format-gate-'));
  let body = { contract: 1 };
  const server = createServer((req, res) => {
    if (body === 'down') { res.writeHead(503); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/library/v1/health`;
  const labeled = join(dir, 'labeled.json');
  const unlabeled = join(dir, 'unlabeled.json');
  writeFileSync(labeled, JSON.stringify({ version: 1, reader_format: 'A' }));
  writeFileSync(unlabeled, JSON.stringify({ version: 1 }));
  try {
    assert.equal((await run([unlabeled, url])).code, 0);
    body = { reader_store: { min_reader: 'A' } };
    assert.equal((await run([labeled, url])).code, 0);
    const refused = await run([unlabeled, url]);
    assert.equal(refused.code, 1);
    assert.match(refused.stdout, /READER FORMAT REFUSED/);
    body = 'down';
    assert.equal((await run([labeled, url])).code, 0);
    assert.equal((await run([unlabeled, url])).code, 1);
    assert.equal((await run([])).code, 2);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
