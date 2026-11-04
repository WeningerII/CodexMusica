#!/usr/bin/env node
// Rule-1 runtime coverage (#661), complementary to check_library_shell's byte checks.
// Usage: node scripts/check_library_rule1_isolation.js [--negative-control[=helper]]
// Builds only in /tmp. Spec: docs/library-native-design.md Rule 1 and row 58;
// docs/ui-foundation.md "One recipe workspace"; Don's #668 comment 6639896087.
// Library-owned reads fail; shared shell and explicit Lyrics receiver reads
// remain visible as INFO. Walk frames from reader outward: a Library chunk
// before the explicit handoff boundary owns a read, including shared helpers.
// Do not discard a stack merely because it also contains shell/receiver code.
// The handoff wrapper marks only uiOpenInLyrics's awaited receiver call, never
// a global "handoff active" interval (which would hide concurrent Library reads).
// Async stacks can be truncated by the browser: this is exercised-path evidence,
// not a proof about arbitrary deferred callbacks or retained object aliases.
// Negative controls inject a read inside the built Works chunk (directly, or
// via sessionSnapshot in a microtask). Only the temporary chunk/SRI are changed.
/* global app, Engine, Catalog, compileRecipeStack:writable, envCardOf:writable, uiOpenInLyrics:writable, _workspaceReady, UI, window, location, document, Storage, localStorage */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { start } = require('./_pages_server');
const ROOT = path.resolve(__dirname, '..');
const READING = 'reading_570567e3-ba7f-56f3-a1bf-f06c6a8d9b81';
const negativeArg = process.argv[2];
assert.ok(
  process.argv.length <= 3 &&
    [undefined, '--negative-control', '--negative-control=helper'].includes(negativeArg),
  'unknown argument'
);
const negative = negativeArg ? (negativeArg.endsWith('=helper') ? 'helper' : 'direct') : null;

function ownership(stack) {
  for (const frame of stack.split('\n')) {
    if (/\bat (?:async )?rule1HandoffBoundary \(/.test(frame)) return 'Lyrics receiver';
    if (/https?:\/\/[^/]+\/library\/code\/[a-z-]+\.[0-9a-f]+\.js:\d+:\d+/.test(frame))
      return 'Library';
  }
  return 'host shell/receiver';
}
// A Library helper remains owned by Library; a caller below the explicit
// receiver seam does not transfer ownership of receiver-internal reads.
const libFrame = '    at read (http://localhost/library/code/works.abcdef1234.js:1:1)';
const seam = '    at async rule1HandoffBoundary (eval at evaluate:1:1)';
assert.equal(
  ownership('Error\n at sessionSnapshot (http://localhost/codex.html:1:1)\n' + libFrame),
  'Library'
);
assert.equal(ownership('Error\n' + seam + '\n' + libFrame), 'Lyrics receiver');
assert.equal(ownership('Error\n' + libFrame + '\n' + seam), 'Library');

// Runs in the browser. Getters preserve original values and writes, so even a
// violation caught by production code remains recorded and behavior can finish.
function instrument() {
  Error.stackTraceLimit = 100;
  const handoff = uiOpenInLyrics;
  uiOpenInLyrics = async function rule1HandoffBoundary(...args) {
    return await handoff.apply(this, args);
  };
  const records = [];
  let armed = false;
  const note = (access) => {
    if (armed) records.push({ access, stack: new Error().stack });
  };
  const watch = (object, key, label) => {
    const d = Object.getOwnPropertyDescriptor(object, key);
    if (!d || !d.configurable || !('value' in d)) throw Error('Cannot instrument ' + label);
    let value = d.value;
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: d.enumerable,
      get() {
        note(label);
        return value;
      },
      ...(d.writable
        ? {
            set(next) {
              value = next;
            },
          }
        : {}),
    });
  };
  // app's other fields include shared lyric/UI state; cards owns the recipe.
  watch(app, 'cards', 'app.cards');
  for (const [name, object] of [
    ['Engine', Engine],
    ['Catalog', Catalog],
  ])
    for (const key of Object.keys(object)) watch(object, key, name + '.' + key);
  const compile = compileRecipeStack;
  compileRecipeStack = function (...args) {
    note('compileRecipeStack');
    return compile.apply(this, args);
  };
  const env = envCardOf;
  envCardOf = function (...args) {
    note('envCardOf');
    return env.apply(this, args);
  };
  const getItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function (key) {
    if (/^codex-workbench(?:-v1|-recovery)$/.test(String(key))) note('storage.' + key);
    return getItem.call(this, key);
  };
  window.rule1 = {
    begin() {
      records.length = 0;
      armed = true;
    },
    end() {
      armed = false;
      return records.slice();
    },
    snapshot() {
      return JSON.stringify(app.cards);
    },
  };
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-rule1-'));
  let browser, srv;
  const failures = [];
  try {
    execFileSync(
      process.execPath,
      [path.join(ROOT, 'scripts/build_html.js'), `--out=${dir}/codex.html`, '--quiet'],
      {
        cwd: ROOT,
        env: { ...process.env, CODEX_LIBRARY: '1' },
        stdio: ['ignore', 'ignore', 'inherit'],
      }
    );
    if (negative) {
      const htmlPath = path.join(dir, 'codex.html');
      let html = fs.readFileSync(htmlPath, 'utf8');
      const entry = /works:\["(library\/code\/works\.[0-9a-f]+\.js)","(sha384-[^"]+)"\]/.exec(html);
      assert.ok(entry, 'Works lazy chunk and SRI must exist');
      const chunkPath = path.join(dir, entry[1]);
      const original = fs.readFileSync(chunkPath, 'utf8');
      const marker = 'CMLibraryDefine("works",function(){';
      assert.ok(original.includes(marker), 'Works factory injection point');
      const injected =
        negative === 'helper'
          ? 'queueMicrotask(function rule1HelperLeak(){sessionSnapshot();});'
          : 'void app.cards;';
      const changed = original.replace(marker, marker + injected);
      fs.writeFileSync(chunkPath, changed);
      const integrity = 'sha384-' + crypto.createHash('sha384').update(changed).digest('base64');
      html = html.replaceAll(entry[2], integrity);
      fs.writeFileSync(htmlPath, html);
    }
    for (const rel of ['api', 'assets', 'library/data'])
      fs.symlinkSync(path.join(ROOT, rel), path.join(dir, rel));
    srv = await start({ root: dir });
    const { chromium } = require('playwright');
    const exe = process.env.CHROMIUM_PATH;
    browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    let job;
    const requests = [];
    const unexpected = [];
    // Only local build traffic and explicit backend fixtures are allowed.
    await context.route('**/*', async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.origin === srv.url) return route.continue();
      const reply = (status, body) =>
        route.fulfill({
          status,
          headers: {
            'content-type': 'application/json',
            'access-control-allow-origin': srv.url,
            'access-control-allow-credentials': 'true',
            'access-control-allow-headers': 'content-type, idempotency-key, if-match',
            'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
          },
          body: JSON.stringify(body),
        });
      if (url.origin !== 'https://mcp.codexmusica.com') {
        unexpected.push(req.url());
        return route.abort();
      }
      if (req.method() === 'OPTIONS') return reply(204, null);
      const p = url.pathname.replace(/^\/library\/v1/, '');
      requests.push(req.method() + ' ' + p);
      if (!url.pathname.startsWith('/library/v1/')) return reply(200, { ok: true, enabled: true });
      if (p === '/health')
        return reply(200, {
          contract: 1,
          snapshot_id: 'rule1',
          readable_ids_sha256: '0'.repeat(64),
          counts: { units: 1, readable: 1 },
          search_ready: true,
          analysis_available: true,
          corpus: {},
        });
      if (p === '/analyses' && req.method() === 'POST') {
        const body = req.postDataJSON();
        job = {
          id: 'rule1-job',
          state: 'running',
          identity: {
            reading_unit_id: body.reading_unit_id,
            reading_revision: body.reading_revision,
            snapshot_id: 'rule1',
          },
          attempt: 1,
          generation: 1,
          progress: { completed: 1, total: 4 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return reply(202, { contract_version: 1, job });
      }
      if (p === '/jobs/rule1-job') return reply(200, { contract_version: 1, job });
      if (['/viewer', '/session', '/me', '/jobs', '/analyses'].includes(p))
        return reply(200, { contract_version: 1, viewer: 'rule1-viewer', jobs: job ? [job] : [] });
      unexpected.push(req.method() + ' ' + p);
      return reply(404, { error: { code: 'NOT_FOUND', message: 'Unstubbed request' } });
    });
    await context.addInitScript(() => {
      localStorage.setItem(
        'codex-workbench-v1',
        JSON.stringify({
          version: 1,
          name: 'Rule-1 saved recipe',
          cards: [{ id: 'c1', instrumentId: 'voice', traditionId: 'dub', parts: {} }],
        })
      );
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Initialize the shell before arming; Library chunks have not run yet.
    await page.goto(srv.url + '/codex.html#lyrics');
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && _workspaceReady);
    // Drain deferred boot, prose loading and initial page resize work before
    // measuring Library actions; these are not initiated by Library routes.
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => app.cards.length), 1, 'saved recipe restored');
    await page.evaluate(instrument);
    // Calibrate the observer with a read that leaves every recipe byte intact.
    const before = await page.evaluate(() => window.rule1.snapshot());
    const calibration = await page.evaluate(() => {
      window.rule1.begin();
      void app.cards;
      return window.rule1.end();
    });
    assert.deepEqual(
      calibration.map((r) => r.access),
      ['app.cards']
    );
    assert.equal(await page.evaluate(() => window.rule1.snapshot()), before);
    console.log('PASS observer calibration: read detected, recipe unchanged');
    const go = async (hash, selector) => {
      await page.evaluate((h) => {
        location.hash = h;
      }, '#library' + hash);
      await page
        .locator('#surface-library ' + selector)
        .first()
        .waitFor({ state: 'visible' });
    };
    const cases = [
      [
        'Explore',
        async () => {
          await go('', '.lib-shelf');
        },
      ],
      [
        'Works',
        async () => {
          await go('/works', '.lw-table tbody tr');
        },
      ],
      ['Reader', () => go('/read/' + READING, '.rd-paper .rd-line')],
      ['Rights', () => go('/rights', '.lr-view')],
      [
        'Analysis',
        async () => {
          await go('/read/' + READING + '?lens=sound', '.rd-paper .rd-line');
          await page.locator('#surface-library [data-act="analyze"]').click();
          await page.waitForFunction(() =>
            /running/i.test(document.querySelector('#surface-library').innerText)
          );
          assert.ok(requests.includes('POST /analyses'), 'analysis must actually start');
        },
      ],
      [
        'Lyrics handoff',
        async () => {
          await page.locator('#surface-library [data-rd="lyrics"]').click();
          await page.waitForFunction(
            () =>
              location.hash === '#lyrics' &&
              document.getElementById('lyrics-draft').value.length > 0
          );
          await page.waitForFunction(() => document.activeElement?.id === 'lyrics-draft');
        },
      ],
    ];
    for (const [name, run] of cases) {
      await page.evaluate(() => window.rule1.begin());
      try {
        await run();
        // Include delayed shell saves and asynchronous route completion.
        await page.waitForTimeout(1200);
      } catch (e) {
        failures.push(name + ' behavior: ' + e.message);
      }
      const reads = await page.evaluate(() => window.rule1.end());
      const libraryReads = reads.filter((r) => ownership(r.stack) === 'Library');
      console.log(
        `${libraryReads.length ? 'FAIL' : 'PASS'} ${name}: ${libraryReads.length} Library-owned reads; ${reads.length - libraryReads.length} host reads (INFO)`
      );
      // Preserve every distinct caller stack, including legitimate host reads.
      const groups = new Map();
      for (const read of reads) {
        const key = read.access + '\n' + read.stack;
        const group = groups.get(key) || { ...read, count: 0 };
        group.count++;
        groups.set(key, group);
      }
      for (const group of groups.values())
        console.log(
          `${ownership(group.stack) === 'Library' ? 'FAIL' : 'INFO'} ${ownership(group.stack)} ${group.access} x${group.count}\n${group.stack}`
        );
      if (libraryReads.length) failures.push(`${name}: ${libraryReads.length} Library-owned reads`);
      if (name === 'Works' && negative)
        assert.ok(libraryReads.length > 0, 'planted Library read must be attributed to Library');
      assert.equal(
        await page.evaluate(() => window.rule1.snapshot()),
        before,
        name + ': recipe bytes changed'
      );
    }
    assert.deepEqual(errors, [], 'uncaught browser exceptions');
    assert.deepEqual(unexpected, [], 'unstubbed network traffic');
    assert.deepEqual(failures, [], 'Rule-1 isolation violations');
    console.log(
      'LIBRARY RULE-1: PASS — six routes, no Library-owned recipe reads; host reads reported'
    );
  } finally {
    if (browser) await browser.close();
    if (srv) await srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error('LIBRARY RULE-1: FAIL', e.stack || e);
  process.exitCode = 1;
});
