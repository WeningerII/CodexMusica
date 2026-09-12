// Encryption and workflow publication regression: local files and test keys only.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, createCipheriv } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sealArchive, openArchive, safeSummary } from '../scripts/battery_archive.mjs';

const withDir = async (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'battery-seal-test-'));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const key = () => randomBytes(32).toString('hex');
const source = (dir) => {
  const src = join(dir, 'source');
  mkdirSync(join(src, 'nested'), { recursive: true });
  writeFileSync(
    join(src, 'run.json'),
    JSON.stringify({ request_id: 'private-request-capability', sig: 'private-signed-envelope' })
  );
  writeFileSync(join(src, 'nested', 'draft.txt'), 'Private accepted lyric\n');
  return src;
};

test('archive round trip preserves every byte and restores private permissions', () =>
  withDir((dir) => {
    const src = source(dir),
      archive = join(dir, 'receipt.enc'),
      out = join(dir, 'restored'),
      secret = key();
    const metadata = sealArchive({ source: src, out: archive, key: secret });
    const wire = readFileSync(archive, 'utf8');
    for (const word of [
      'private-request-capability',
      'private-signed-envelope',
      'Private accepted lyric',
      secret,
    ]) {
      assert.ok(!wire.includes(word));
      assert.ok(!JSON.stringify(metadata).includes(word));
    }
    assert.equal(statSync(archive).mode & 0o777, 0o600);
    openArchive({ archive, out, key: secret });
    for (const file of ['run.json', 'nested/draft.txt']) {
      assert.deepEqual(readFileSync(join(out, file)), readFileSync(join(src, file)));
      assert.equal(statSync(join(out, file)).mode & 0o777, 0o600);
    }
    assert.equal(statSync(out).mode & 0o777, 0o700);
    assert.equal(statSync(join(out, 'nested')).mode & 0o777, 0o700);
  }));

test('wrong key or ciphertext tampering creates no restore tree', () =>
  withDir((dir) => {
    const src = source(dir),
      archive = join(dir, 'receipt.enc'),
      secret = key();
    sealArchive({ source: src, out: archive, key: secret });
    const first = join(dir, 'wrong-key');
    assert.throws(() => openArchive({ archive, out: first, key: key() }));
    assert.equal(existsSync(first), false);
    const payload = JSON.parse(readFileSync(archive));
    const bytes = Buffer.from(payload.ciphertext, 'base64');
    bytes[0] ^= 1;
    payload.ciphertext = bytes.toString('base64');
    writeFileSync(archive, JSON.stringify(payload));
    const second = join(dir, 'tampered');
    assert.throws(() => openArchive({ archive, out: second, key: secret }));
    assert.equal(existsSync(second), false);
  }));

test('seal refuses symlink sources and leaves prior archive and plaintext intact', () =>
  withDir((dir) => {
    const src = source(dir),
      archive = join(dir, 'receipt.enc'),
      secret = key();
    sealArchive({ source: src, out: archive, key: secret });
    const previous = readFileSync(archive);
    writeFileSync(join(dir, 'external-secret'), 'not an archive input');
    symlinkSync(join(dir, 'external-secret'), join(src, 'linked'));
    assert.throws(() => sealArchive({ source: src, out: archive, key: secret }));
    assert.deepEqual(readFileSync(archive), previous);
    assert.equal(readFileSync(join(src, 'nested/draft.txt'), 'utf8'), 'Private accepted lyric\n');
  }));

test('restore refuses existing destinations and symlinked ancestors', () =>
  withDir((dir) => {
    const src = source(dir),
      archive = join(dir, 'receipt.enc'),
      secret = key();
    sealArchive({ source: src, out: archive, key: secret });
    const existing = join(dir, 'existing');
    mkdirSync(existing);
    writeFileSync(join(existing, 'keep'), 'untouched');
    assert.throws(() => openArchive({ archive, out: existing, key: secret }));
    assert.equal(readFileSync(join(existing, 'keep'), 'utf8'), 'untouched');
    const target = join(dir, 'target');
    mkdirSync(target);
    symlinkSync(target, join(dir, 'link'));
    assert.throws(() => openArchive({ archive, out: join(dir, 'link', 'restore'), key: secret }));
    assert.equal(existsSync(join(target, 'restore')), false);
  }));

function authenticatedPayload(secret, files) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), nonce);
  cipher.setAAD(Buffer.from('CodexMusica battery archive\nversion=1\ncipher=AES-256-GCM\n'));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ version: 1, files })),
    cipher.final(),
  ]);
  return {
    version: 1,
    cipher: 'AES-256-GCM',
    nonce: nonce.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}
test('authenticated malicious paths and duplicate entries cannot partially restore', () =>
  withDir((dir) => {
    const archive = join(dir, 'malicious.enc'),
      secret = key();
    const data = Buffer.from('private').toString('base64');
    const badSets = [
      '../escape',
      '/absolute',
      'nested/../../escape',
      'nested\\escape',
      './ambiguous',
      '',
    ].map((path) => [
      { path: 'good', data },
      { path, data },
    ]);
    badSets.push([
      { path: 'same', data },
      { path: 'same', data },
    ]);
    badSets.push([
      { path: 'Same', data },
      { path: 'same', data },
    ]);
    badSets.push([
      { path: 'a', data },
      { path: 'a/child', data },
    ]);
    for (let i = 0; i < badSets.length; i++) {
      const out = join(dir, `malicious-${i}`);
      writeFileSync(archive, JSON.stringify(authenticatedPayload(secret, badSets[i])));
      assert.throws(() => openArchive({ archive, out, key: secret }));
      assert.equal(existsSync(out), false);
    }
    assert.equal(existsSync(join(dir, 'escape')), false);
  }));

test('safe public summary cannot carry capability-bearing strings or nested metadata', () => {
  const capability = 'secret-capability-never-publish';
  const result = safeSummary({
    sig: capability,
    base: capability,
    expected: true,
    songs: [
      {
        song: 0,
        turns: 2,
        retries: 0,
        exit_reason: 'finished',
        expected: true,
        run_id: capability,
        flags: [{ detail: capability }],
        cycles: [{ draft_fp: capability }],
        brief: capability,
        checkpoint: capability,
      },
      {
        song: capability,
        turns: capability,
        retries: capability,
        exit_reason: capability,
        expected: capability,
      },
    ],
  });
  assert.ok(!JSON.stringify(result).includes(capability));
  assert.equal(result.songs[0].exit_reason, 'finished');
  assert.equal(result.songs[0].turns, 2);
});

test('workflow validates the secret before paid work and uploads no plaintext path', () =>
  withDir((dir) => {
    const workflow = readFileSync(
      new URL('../.github/workflows/flash-battery.yml', import.meta.url),
      'utf8'
    );
    const first = workflow.slice(
      workflow.indexOf('      - name: Validate recovery encryption'),
      workflow.indexOf('      - uses: actions/checkout')
    );
    assert.match(first, /BATTERY_RECOVERY_KEY: \$\{\{ secrets\.BATTERY_RECOVERY_KEY \}\}/);
    const body = first
      .split('        run: |\n')[1]
      .split('\n')
      .map((line) => line.replace(/^ {10}/, ''))
      .join('\n');
    for (const valid of [false, true]) {
      const secret = valid ? 'a'.repeat(64) : 'private-invalid-secret';
      const result = spawnSync('bash', ['-e', '-c', body], {
        encoding: 'utf8',
        env: {
          ...process.env,
          BATTERY_RECOVERY_KEY: secret,
          LIVE_COMMIT: 'b'.repeat(40),
          GITHUB_ENV: join(dir, 'env'),
        },
      });
      assert.equal(result.status, valid ? 0 : 1, result.stderr);
      assert.ok(!`${result.stdout}${result.stderr}`.includes(secret));
    }
    assert.ok(
      workflow.indexOf('Prove archive encryption before paid work') <
        workflow.indexOf('Drive the battery')
    );
    // The driver's whole output lands in the private log; only its per-turn
    // notice rows and the verdict pass the allowlist to the job log, and the
    // malformed-hop notice (which quotes the model) does not match it (M-279).
    assert.match(workflow, /"\$\{resume\[@\]\}" 2>&1 \\\n\s+\| tee -a battery-out\/driver\.log \\\n\s+\| grep --line-buffered -E '([^']+)'/);
    const allow = new RegExp(/\| grep --line-buffered -E '([^']+)'/.exec(workflow)[1]);
    assert.match('::notice title=battery song 0 turn 3::status=200 ms=1705569 tools=14', allow);
    assert.match('::error title=battery verdict::song 0: no_stop', allow);
    assert.doesNotMatch('::notice title=battery malformed hop::song 0 turn 1 hop 2 not re-asked: call:lyric_revise{draft', allow);
    assert.doesNotMatch('::notice title=battery partial turn::song 0 turn 1: the engine died', allow);
    assert.match(workflow, /rc=\$\{PIPESTATUS\[0\]\}/);
    assert.match(workflow, /set -o pipefail/);
    const upload = workflow.slice(workflow.indexOf('      - name: Upload only encrypted'));
    assert.match(
      upload,
      /battery-sealed\/battery-recovery\.enc\n\s+battery-sealed\/manifest\.json/
    );
    assert.doesNotMatch(upload, /battery-out|\.jsonl|\.checkpoint|driver\.log/);
    assert.doesNotMatch(workflow, /head -c|cat battery-out|Print.*transcripts/);
    assert.match(workflow, /battery_archive\.mjs summary --source=battery-out/);
  }));
