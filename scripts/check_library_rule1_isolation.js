#!/usr/bin/env node
// Rule-1 runtime coverage (#661), complementary to check_library_shell's byte checks.
// Usage: node scripts/check_library_rule1_isolation.js [--negative-control]
// Builds in /tmp; never changes source, registration or release artifacts.
// Observe reads, not just writes: app's recipe fields, Engine/Catalog accessors,
// recipe compiler/environment entry points, and saved recipe storage. Arm only
// after workspace initialization; keep the observer armed through async work.
// The real Reader button drives the Lyrics handoff, including its receiver.
// --negative-control adds a read-only app.cards access during Works. It must
// fail even though the recipe snapshot is unchanged. Exit 1 also reports genuine
// existing violations; this check does not whitelist shell/receiver callers.
/* global app, Engine, Catalog, compileRecipeStack:writable, envCardOf:writable, _workspaceReady, UI, window, location, document, Storage, localStorage */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { start } = require('./_pages_server');
const ROOT = path.resolve(__dirname, '..');
const READING = 'reading_570567e3-ba7f-56f3-a1bf-f06c6a8d9b81';
const negative = process.argv.includes('--negative-control');
assert.ok(
  process.argv.slice(2).every((a) => a === '--negative-control'),
  'unknown argument'
);

// Runs in the browser. Getters preserve original values and writes, so even a
// violation caught by production code remains recorded and behavior can finish.
function instrument() {
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
          if (negative)
            await page.evaluate(() => {
              void app.cards;
            });
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
      const accesses = [...new Set(reads.map((r) => r.access))];
      console.log(
        `${reads.length ? 'FAIL' : 'PASS'} ${name}: ${reads.length} recipe reads ${accesses.join(', ')}`
      );
      if (reads.length) {
        failures.push(`${name}: ${reads.length} reads`);
        for (const access of accesses) console.log(reads.find((r) => r.access === access).stack);
      }
      assert.equal(
        await page.evaluate(() => window.rule1.snapshot()),
        before,
        name + ': recipe bytes changed'
      );
    }
    assert.deepEqual(errors, [], 'uncaught browser exceptions');
    assert.deepEqual(unexpected, [], 'unstubbed network traffic');
    assert.deepEqual(failures, [], 'Rule-1 isolation violations');
    console.log('LIBRARY RULE-1: PASS — six routes, no recipe reads');
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
