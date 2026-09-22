import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { _workerInternals } from './lyric_tools.js';

test('real MCP preserves draft coordinates and uses the placed-return judge', async () => {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const client = new Client(
    { name: 'high-report-regressions', version: '1' },
    { capabilities: {} }
  );
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  async function call(name, args) {
    const response = await client.callTool({ name, arguments: args }, undefined, {
      timeout: 120000,
    });
    assert.ok(!response.isError, JSON.stringify(response));
    const result = response.content
      .map((block) => {
        try {
          return JSON.parse(block.text);
        } catch {
          return null;
        }
      })
      .find((value) => typeof value?.exit_code === 'number');
    assert.ok(result, JSON.stringify(response));
    assert.notEqual(result.exit_code, 1, JSON.stringify(result));
    return result;
  }
  try {
    const lines = [
      '#1 with a bullet and a song',
      'The day is long',
      '[Chorus] we sing along',
      '--- and the morning too',
    ];
    const checked = await call('lyric_check', {
      lines,
      groups: '1,4',
      relation: 'class:ASSONANCE',
    });
    assert.deepEqual(checked.final_draft, lines);
    const verified = await call('lyric_verify', {
      before: lines,
      after: lines,
      groups: '1,4',
      relation: 'class:ASSONANCE',
    });
    assert.doesNotMatch(verified.report, /outside 1\.\.3|outside 1\.\.1/);
    const recovered = await call('lyric_recover', { lines, placements: 'head' });
    assert.match(recovered.report, /total_lines\s+\[counted\] 4/);
    const placed = await call('lyric_check', {
      lines: [
        'The basket rests beside the open gate',
        'A farmer waits beneath the fading light',
        'The children bring their apples home at night',
      ],
      groups: '1,2',
      relation: 'class:ASSONANCE',
      returns: '1.head,3.head',
    });
    assert.doesNotMatch(placed.report, /RETURN_NOT_VERBATIM/);
  } finally {
    _workerInternals.kill();
    await client.close();
    await server.close();
  }
});
