#!/usr/bin/env node
// Execute the built production image, with no external network or paid model.
// Usage: node scripts/check_lyrics_image.mjs IMAGE_TAG EXPECTED_COMMIT
// CI builds mcp/Dockerfile first; this gate deliberately does not rebuild it.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [image, commit] = process.argv.slice(2);
if (
  !image ||
  image.startsWith('-') ||
  !/^[0-9a-f]{40}$/.test(commit || '') ||
  process.argv.length !== 4
) {
  console.error(
    'Usage: node scripts/check_lyrics_image.mjs IMAGE_TAG EXPECTED_40_CHARACTER_COMMIT'
  );
  process.exitCode = 2;
} else {
  const deadline = performance.now() + 300_000;
  const suffix = randomBytes(8).toString('hex');
  const volume = `lyrics-image-${suffix}`;
  const containers = [];
  let volumeCreated = false;
  let imageId;

  const docker = (args, { timeoutMs = 30_000, quiet = false, cleanup = false } = {}) =>
    new Promise((resolve, reject) => {
      const remaining = cleanup ? timeoutMs : Math.min(timeoutMs, deadline - performance.now());
      if (remaining <= 0)
        return reject(
          new Error('Production image gate exceeded its five-minute execution budget.')
        );
      const child = spawn('docker', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      const chunks = [];
      let bytes = 0,
        stopped;
      const timer = setTimeout(() => {
        stopped = new Error(`Docker ${args[0]} exceeded its bounded execution time.`);
        child.kill('SIGKILL');
      }, remaining);
      const output = (data, stream) => {
        bytes += data.length;
        if (bytes > 2 * 1024 * 1024) {
          stopped = new Error(`Docker ${args[0]} exceeded the gate's output limit.`);
          child.kill('SIGKILL');
          return;
        }
        if (quiet) chunks.push(data);
        else stream.write(data);
      };
      child.stdout.on('data', (data) => output(data, process.stdout));
      child.stderr.on('data', (data) => output(data, process.stderr));
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code, signal) => {
        clearTimeout(timer);
        if (stopped) return reject(stopped);
        if (code !== 0)
          return reject(
            new Error(
              `Docker ${args[0]} failed (${signal || code}).${quiet ? ` ${Buffer.concat(chunks).toString('utf8').slice(0, 2000)}` : ''}`
            )
          );
        resolve(Buffer.concat(chunks).toString('utf8').trim());
      });
    });
  const isolation = [
    '--network=none',
    '--memory=2g',
    '--memory-swap=2g',
    '--cpus=1',
    '--pids-limit=256',
    '--env=HTTP_PROXY=',
    '--env=HTTPS_PROXY=',
    '--env=ALL_PROXY=',
    '--env=NO_PROXY=127.0.0.1,localhost',
  ];
  const mounts = async (names) => {
    const args = [];
    for (const name of names) {
      const source = path.join(root, 'mcp', name);
      await access(source);
      if (source.includes(','))
        throw new Error('The checkout path cannot contain a comma for Docker bind mounts.');
      args.push('--mount', `type=bind,src=${source},dst=/app/mcp/${name},readonly`);
    }
    return args;
  };
  const runTests = async (label, files, command, timeoutMs) => {
    const name = `lyrics-${label}-${suffix}`;
    containers.push(name);
    console.log(`Production image: ${label} (Node 22, network disabled, 2 GiB limit)`);
    await docker(
      [
        'run',
        '--name',
        name,
        ...isolation,
        ...(await mounts(files)),
        '--workdir=/app/mcp',
        '--entrypoint=node',
        imageId,
        ...command,
      ],
      { timeoutMs }
    );
  };

  // Runs inside the actual service container. Only localhost is reachable.
  // Neither the signing key nor its hash is written to tool or CI output.
  const probe = `
    import fs from 'node:fs';
    import crypto from 'node:crypto';
    import assert from 'node:assert/strict';
    import { setTimeout as delay } from 'node:timers/promises';
    const [commit, mode] = process.argv.slice(1);
    assert.equal(process.versions.node.split('.')[0], '22', 'production runtime must be Node 22');
    const until = Date.now() + 20_000;
    let health;
    while (Date.now() < until) {
      try {
        const res = await fetch('http://127.0.0.1:8080/health', { signal: AbortSignal.timeout(1000) });
        if (res.ok) { health = await res.json(); break; }
      } catch { /* bounded startup polling */ }
      await delay(250);
    }
    assert.ok(health, 'production server did not become healthy within 20 seconds');
    assert.equal(health.commit, commit, 'health commit must match the built image');
    assert.equal(health.build.commit, commit);
    const baked = JSON.parse(fs.readFileSync('/app/mcp/build_identity.json', 'utf8'));
    assert.equal(baked.commit, commit);
    assert.equal(health.build.release_id, baked.release_id);
    assert.match(health.build.release_id, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
    assert.notEqual(health.build.release_id, 'runtime-cannot-override-this');
    assert.equal(health.recovery.durable, true);
    assert.equal(health.recovery.healthy, true);
    assert.match(health.build.source_sha256, /^[0-9a-f]{64}$/);
    const statusResponse = await fetch('http://127.0.0.1:8080/chat/status', { signal: AbortSignal.timeout(1000) });
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.enabled, true);
    assert.equal(status.capDurable, true);
    assert.equal(status.accountingBlocked, null);
    const keyFile = '/data/lyrics/chat-secret.key';
    const digestFile = '/data/lyrics/image-gate-signing.digest';
    const key = fs.readFileSync(keyFile, 'utf8').trim();
    if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('Persisted signing key is malformed.');
    if (fs.statSync(keyFile).mode & 0o077) throw new Error('Persisted signing key is not private.');
    const digest = crypto.createHash('sha256').update(key).digest('hex');
    if (mode === 'before') fs.writeFileSync(digestFile, digest, { mode: 0o600 });
    else {
      if (fs.readFileSync(digestFile, 'utf8') !== digest) throw new Error('The signing key changed across a service restart.');
      fs.unlinkSync(digestFile);
    }
    console.log('Production image: healthy pinned build, durable recovery/accounting, private stable signing (' + mode + ' restart)');
  `;

  try {
    imageId = await docker(['image', 'inspect', '--format={{.Id}}', image], { quiet: true });
    assert.match(imageId, /^sha256:[0-9a-f]{64}$/);
    // Use the immutable inspected ID throughout so a moved tag cannot mix builds.
    await runTests(
      'harness',
      ['test_lyric_state.mjs'],
      ['test_lyric_state.mjs', '--harness'],
      210_000
    );
    await runTests(
      'persistence',
      ['test_job_store.mjs', 'test_paid_budget.mjs'],
      ['--test', '--test-concurrency=1', 'test_job_store.mjs', 'test_paid_budget.mjs'],
      45_000
    );
    await docker(['volume', 'create', volume], { quiet: true });
    volumeCreated = true;
    const server = `lyrics-server-${suffix}`;
    containers.push(server);
    await docker(
      [
        'run',
        '--detach',
        '--name',
        server,
        ...isolation,
        '--mount',
        `type=volume,src=${volume},dst=/data`,
        '--env=LYRIC_RUNTIME_DIR=/data/lyrics',
        '--env=PORT=8080',
        '--env=GEMINI_API_KEY=image-gate-offline-placeholder',
        '--env=BUILD_GIT_COMMIT=runtime-cannot-override-this',
        '--env=RENDER_GIT_COMMIT=runtime-cannot-override-this',
        '--env=BUILD_RELEASE_ID=runtime-cannot-override-this',
        imageId,
      ],
      { quiet: true }
    );
    const config = JSON.parse(await docker(['inspect', server], { quiet: true }))[0];
    assert.equal(config.Image, imageId);
    assert.equal(config.HostConfig.Memory, 2 * 1024 ** 3);
    assert.equal(config.HostConfig.MemorySwap, 2 * 1024 ** 3);
    assert.equal(config.HostConfig.NetworkMode, 'none');
    await docker(['exec', server, 'node', '--input-type=module', '-e', probe, commit, 'before'], {
      timeoutMs: 25_000,
    });
    await docker(['restart', '--time=2', server], { quiet: true, timeoutMs: 10_000 });
    await docker(['exec', server, 'node', '--input-type=module', '-e', probe, commit, 'after'], {
      timeoutMs: 25_000,
    });
    console.log(
      'Production lyrics image gate passed: real harness/worker/proposer/verification and durable restart.'
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    // Killing only the Docker CLI can leave its container alive; remove every
    // named container even after timeout, then remove its private test volume.
    if (containers.length) {
      try {
        await docker(['rm', '--force', ...containers], {
          quiet: true,
          cleanup: true,
          timeoutMs: 10_000,
        });
      } catch (error) {
        console.error(`Container cleanup: ${error.message}`);
        process.exitCode = 1;
      }
    }
    if (volumeCreated) {
      try {
        await docker(['volume', 'rm', '--force', volume], {
          quiet: true,
          cleanup: true,
          timeoutMs: 10_000,
        });
      } catch (error) {
        console.error(`Volume cleanup: ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
}
