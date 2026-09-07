// One assertion shared by the full MCP suite and its isolated spend mutant.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function assertCorruptSpendFailsClosed() {
  const { SpendStore } = await import('./spend_store.js');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spend-bad-'));
  const file = path.join(dir, 'spend.json');
  try {
    fs.writeFileSync(file, JSON.stringify({ day: '2026-01-02', usd: -9999, turns: 'lots' }));
    const s = new SpendStore(file);
    assert.equal(s.healthy, false, 'invalid counters disable paid admission');
    assert.equal(s.state.usd, Infinity, 'invalid input cannot restore budget');
    assert.throws(() => s.rollDay('2026-01-03'), /disabled/);

    fs.writeFileSync(file, '{ not json');
    const t = new SpendStore(file);
    assert.equal(t.state.usd, Infinity, 'unparseable must close admission');
    assert.equal(t.state.day, null, 'unparseable must not claim a day');
    assert.throws(() => t.save(), /disabled/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { test } = await import('node:test');
  test('a corrupt spend file cannot widen the cap', assertCorruptSpendFailsClosed);
}
