#!/usr/bin/env node
// Selected Rule-1 accessors (#661), complementary to check_library_shell's byte checks.
// Watches app.cards, Engine/Catalog/chatState own properties, compiler entry
// points, string-keyed recipe/chat/legacy Storage calls, and saved-workspace
// indexedDB.open. See NEGATIVE_CONTROLS for the planted Library-source probes.
// Usage: node scripts/check_library_rule1_isolation.js [--negative-control[=NAME]]
// Builds only in /tmp. Spec: docs/library-native-design.md Rule 1 and row 58;
// docs/ui-foundation.md "One recipe workspace"; Don's superseding #733 comment 6639915514.
// Monitored Library-owned reads fail. Shared shell reads are INFO;
// Lyrics/history accesses remain WARN until the separately owned wording lands.
// Jony 6640484873 permits host history/autosave reads; unchanged recipe bytes
// cannot distinguish an identical autosave re-store from no write. Storage
// instrumentation now records such calls, without treating host calls as leaks. Walk frames from
// reader outward: a Library source frame
// before the explicit handoff boundary owns a read, including shared helpers.
// Do not discard a stack merely because it also contains shell/receiver code.
// The handoff wrapper marks only uiOpenInLyrics's awaited receiver call, never
// a global "handoff active" interval (which would hide concurrent Library reads).
// Async stacks can be truncated by the browser: this is exercised-path evidence,
// not a proof about arbitrary deferred callbacks or retained object aliases.
// Negative controls inject into the built Works chunk or inline libraryShow,
// directly or through sessionSnapshot. Only the temporary build/SRI are changed.
/* global app, Engine, Catalog, compileRecipeStack:writable, envCardOf:writable, uiOpenInLyrics:writable, _workspaceReady, UI, window, location, document, Storage, localStorage, chatState, IDBFactory */
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
const NEGATIVE_CONTROLS = {
  direct: { code: 'void app.cards;', expected: ['app.cards'] },
  helper: {
    code: 'queueMicrotask(function rule1HelperLeak(){sessionSnapshot();});',
    expected: ['app.cards'],
  },
  inline: { code: 'void app.cards;', expected: ['app.cards'] },
  'inline-helper': { code: 'sessionSnapshot();', expected: ['app.cards'] },
  'chat-state': { code: 'void chatState.workspace;', expected: ['chatState.workspace'] },
  'chat-storage': {
    code: 'localStorage.getItem(CHAT_STORAGE_KEY);',
    expected: ['storage.getItem:codex-musica-chat-v2:'],
  },
  'storage-write': {
    code: '{const saved=localStorage.getItem("codex-workbench-v1");localStorage.setItem("codex-workbench-v1",saved);}',
    expected: ['storage.setItem:codex-workbench-v1'],
  },
  'storage-remove': {
    code: '{const saved=localStorage.getItem("codex-workbench-v1");localStorage.removeItem("codex-workbench-v1");localStorage.setItem("codex-workbench-v1",saved);}',
    expected: ['storage.removeItem:codex-workbench-v1'],
  },
  legacy: {
    code: 'localStorage.getItem("musica-workbench-v3");localStorage.getItem("musica-study-v1");',
    expected: ['storage.getItem:musica-workbench-v3', 'storage.getItem:musica-study-v1'],
  },
  indexeddb: {
    code: '{const req=indexedDB.open("codex-musica");req.onsuccess=()=>req.result.close();}',
    expected: ['indexedDB.open:codex-musica'],
  },
};
const negativeArg = process.argv[2];
const negative = negativeArg ? negativeArg.split('=')[1] || 'direct' : null;
assert.ok(
  process.argv.length <= 3 &&
    (!negativeArg ||
      (/^--negative-control(?:=[a-z-]+)?$/.test(negativeArg) &&
        Object.hasOwn(NEGATIVE_CONTROLS, negative))),
  'unknown argument'
);

function ownership(stack) {
  for (const frame of stack.split('\n')) {
    if (/\bat (?:async )?rule1HandoffBoundary \(/.test(frame)) return 'Lyrics receiver';
    if (/rule1:\/\/\/src\/pages\/library\.js:\d+:\d+/.test(frame)) return 'Library';
    if (/https?:\/\/[^/]+\/library\/code\/[a-z-]+\.[0-9a-f]+\.js:\d+:\d+/.test(frame))
      return 'Library';
  }
  return 'host shell/receiver';
}
// A Library helper remains owned by Library; a caller below the explicit
// receiver seam does not transfer ownership of receiver-internal reads.
const libFrame = '    at read (http://localhost/library/code/works.abcdef1234.js:1:1)';
const inlineFrame = '    at libraryShow (rule1:///src/pages/library.js:2:1)';
assert.equal(
  ownership('Error\n at sessionSnapshot (http://localhost/codex.html:1:1)\n' + inlineFrame),
  'Library'
);
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
  const envelopes = [];
  const handoff = uiOpenInLyrics;
  uiOpenInLyrics = async function rule1HandoffBoundary(...args) {
    envelopes.push(JSON.parse(JSON.stringify(args[0])));
    return await handoff.apply(this, args);
  };
  const records = [];
  let armed = false;
  const note = (access) => {
    if (armed) records.push({ access, stack: new Error().stack });
  };
  const descriptors = [];
  const watch = (object, key, label) => {
    const d = Object.getOwnPropertyDescriptor(object, key);
    if (!d || !d.configurable) throw Error('Cannot instrument non-configurable/missing ' + label);
    let value = d.value;
    const replacement = {
      configurable: d.configurable,
      enumerable: d.enumerable,
      get() {
        note(label);
        return 'value' in d ? value : d.get?.call(this);
      },
    };
    if ('value' in d && d.writable)
      replacement.set = function (next) {
        // Preserve ordinary inherited-data assignment: write the receiver, not
        // the watched prototype. The app itself uses these objects directly.
        if (this === object) value = next;
        else
          Object.defineProperty(this, key, {
            value: next,
            writable: true,
            enumerable: true,
            configurable: true,
          });
      };
    else if (!('value' in d) && d.set)
      replacement.set = function (next) {
        return d.set.call(this, next);
      };
    Object.defineProperty(object, key, replacement);
    descriptors.push({ object, key, replacement });
  };
  const wrapMethod = (object, key, observe) => {
    const d = Object.getOwnPropertyDescriptor(object, key);
    if (!d || typeof d.value !== 'function' || (!d.writable && !d.configurable))
      throw Error('Cannot wrap ' + key);
    const original = d.value;
    const replacement = {
      ...d,
      value: function (...args) {
        observe(args);
        // No extra coercion, changed argument count, receiver binding or catches.
        return Reflect.apply(original, this, args);
      },
    };
    for (const field of ['name', 'length'])
      Object.defineProperty(replacement.value, field, {
        ...Object.getOwnPropertyDescriptor(original, field),
      });
    Object.defineProperty(object, key, replacement);
    descriptors.push({ object, key, replacement });
    return original;
  };
  // app's other fields include shared lyric/UI state; cards owns the recipe.
  watch(app, 'cards', 'app.cards');
  for (const [name, object] of [
    ['Engine', Engine],
    ['Catalog', Catalog],
    ['chatState', chatState],
  ])
    for (const key of Reflect.ownKeys(object)) watch(object, key, name + '.' + String(key));
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
  const protectedKey = (key) =>
    typeof key === 'string' &&
    (/^(?:codex-workbench-(?:v1|recovery)|musica-workbench-v3|musica-study-v1)$/.test(key) ||
      key.startsWith('codex-musica-chat-v2:'));
  const nativeStorage = {};
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    nativeStorage[method] = wrapMethod(Storage.prototype, method, (args) => {
      if (protectedKey(args[0])) note('storage.' + method + ':' + args[0]);
    });
  }
  const nativeOpen = wrapMethod(IDBFactory.prototype, 'open', (args) => {
    if (args[0] === 'codex-musica') note('indexedDB.open:codex-musica');
  });
  // Calibration while disarmed: safe descriptors, receiver forwarding, native
  // argument-count/brand errors, return values and one-time key coercion.
  const check = (ok, message) => {
    if (!ok) throw Error('Observer semantics: ' + message);
  };
  const sample = {};
  Object.defineProperty(sample, 'data', {
    value: 7,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  Object.defineProperty(sample, 'readonly', { value: 3, writable: false, configurable: true });
  Object.defineProperty(sample, 'accessor', {
    configurable: true,
    get() {
      return this.data;
    },
    set(value) {
      this.data = value;
    },
  });
  for (const key of ['data', 'readonly', 'accessor']) watch(sample, key, 'calibration.' + key);
  sample.accessor = 9;
  const child = Object.create(sample);
  child.data = 11;
  check(sample.data === 9 && child.accessor === 11, 'data/accessor receiver and values preserved');
  check(!Reflect.set(sample, 'readonly', 4) && sample.readonly === 3, 'readonly preserved');
  check(!Object.getOwnPropertyDescriptor(sample, 'data').enumerable, 'enumerability preserved');
  const errorName = (fn, receiver, args) => {
    try {
      Reflect.apply(fn, receiver, args);
      return null;
    } catch (e) {
      return e.name;
    }
  };
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    check(
      Storage.prototype[method].name === nativeStorage[method].name &&
        Storage.prototype[method].length === nativeStorage[method].length,
      method + ' metadata preserved'
    );
    for (const [receiver, args] of [
      [localStorage, []],
      [{}, ['rule1-calibration']],
    ])
      check(
        errorName(Storage.prototype[method], receiver, args) ===
          errorName(nativeStorage[method], receiver, args),
        method + ' native errors preserved'
      );
  }
  check(
    errorName(IDBFactory.prototype.open, {}, ['codex-musica']) ===
      errorName(nativeOpen, {}, ['codex-musica']),
    'IDB native receiver error preserved'
  );
  let conversions = 0;
  const key = {
    toString() {
      conversions++;
      return 'rule1-calibration';
    },
  };
  check(
    localStorage.setItem(key, 'test') === undefined && conversions === 1,
    'setItem return/coercion'
  );
  check(localStorage.getItem(key) === 'test' && conversions === 2, 'getItem return/coercion');
  check(
    localStorage.removeItem(key) === undefined && conversions === 3,
    'removeItem return/coercion'
  );
  const verifyDescriptors = () => {
    for (const { object, key, replacement } of descriptors) {
      const actual = Object.getOwnPropertyDescriptor(object, key);
      for (const field of ['get', 'set', 'value', 'writable', 'enumerable', 'configurable'])
        check(
          actual?.[field] === replacement[field],
          String(key) + ' descriptor changed: ' + field
        );
    }
    return true;
  };
  verifyDescriptors();
  window.rule1 = {
    verifyDescriptors,
    envelopes: () => envelopes,
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

// Bound the actual Reader envelope, not a fabricated handoff. Provenance is
// source metadata; this fixture has no user declarations. Recipe keys are
// forbidden recursively even inside otherwise extensible source metadata.
function checkEnvelope(envelope) {
  const keys = (value, allowed, label) => {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), label);
    assert.ok(
      Object.keys(value).every((key) => allowed.includes(key)),
      label + ': unexpected field'
    );
  };
  keys(
    envelope,
    ['protocol', 'version', 'handoffId', 'draftId', 'createdAt', 'payload', 'digest'],
    'envelope'
  );
  assert.equal(envelope.protocol, 'codex-musica.library-import');
  assert.equal(envelope.version, 1);
  const p = envelope.payload;
  keys(
    p,
    ['text', 'title', 'language', 'scope', 'provenance', 'lineage', 'declarations'],
    'payload'
  );
  assert.ok(typeof p.text === 'string' && p.text.length > 0, 'Library text present');
  assert.equal(p.scope, 'whole');
  keys(
    p.provenance,
    [
      'snapshotId',
      'unitId',
      'workId',
      'editionId',
      'revisionId',
      'source_sha256',
      'normalized_sha256',
      'source_path',
      'rights',
      'contributors',
      'completeness',
      'metadata',
      'source_map',
      'source_marks',
      'source_labels',
      'source_basis',
      'work_reviewed_equivalence',
    ],
    'provenance'
  );
  assert.equal(p.provenance.unitId, READING);
  assert.ok(Array.isArray(p.lineage) && p.lineage.length > 0, 'text lineage present');
  p.lineage.forEach((row) =>
    keys(
      row,
      [
        'line_id',
        'physical_line',
        'analysis_line',
        'normalized_cp_range',
        'normalized_utf16_range',
        'source_ranges',
      ],
      'lineage'
    )
  );
  assert.deepEqual(p.declarations, [{}], 'fresh fixture has no user declarations');
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(
        !/^(recipe|cards|workspace|engine|catalog|room|chain|tuning|instruments|traditions|arrangement|environment)$/i.test(
          key
        ),
        'recipe field in envelope: ' + key
      );
      visit(child);
    }
  };
  visit(envelope);
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
    // Label only the inline Library module's stack source in the temporary
    // build. Function names alone cannot distinguish it from the host shell.
    const htmlPath = path.join(dir, 'codex.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    let labeled = 0;
    html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (tag, body) => {
      if (!/^\s*\/\/ ─── runtime: src\/pages\/library\.js ───/.test(body)) return tag;
      labeled++;
      if (negative?.startsWith('inline')) {
        const marker = 'async function libraryShow(){';
        assert.ok(body.includes(marker), 'inline libraryShow mutation point');
        const read = NEGATIVE_CONTROLS[negative].code;
        body = body.replace(
          marker,
          marker + 'if(!window.rule1InlineLeak){window.rule1InlineLeak=true;' + read + '}'
        );
      }
      return '<script>' + body + '\n//# sourceURL=rule1:///src/pages/library.js\n</script>';
    });
    assert.equal(labeled, 1, 'exactly one inline Library source labeled');
    fs.writeFileSync(htmlPath, html);
    if (negative && !negative.startsWith('inline')) {
      const entry = /works:\["(library\/code\/works\.[0-9a-f]+\.js)","(sha384-[^"]+)"\]/.exec(html);
      assert.ok(entry, 'Works lazy chunk and SRI must exist');
      const chunkPath = path.join(dir, entry[1]);
      const original = fs.readFileSync(chunkPath, 'utf8');
      const marker = 'CMLibraryDefine("works",function(){"use strict";';
      assert.ok(original.includes(marker), 'Works factory injection point');
      const injected = NEGATIVE_CONTROLS[negative].code;
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
    console.log(
      'PASS observer semantics: descriptors, receivers, returns, argument errors and key coercion preserved'
    );
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
        `${libraryReads.length ? 'FAIL' : 'PASS'} ${name}: ${libraryReads.length} Library-owned accesses; ${reads.length - libraryReads.length} host accesses (${name === 'Lyrics handoff' ? 'WARN: doc wording pending' : 'INFO'})`
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
          `${ownership(group.stack) === 'Library' ? 'FAIL' : name === 'Lyrics handoff' ? 'WARN' : 'INFO'} ${ownership(group.stack)} ${group.access} x${group.count}\n${group.stack}`
        );
      if (libraryReads.length)
        failures.push(`${name}: ${libraryReads.length} Library-owned accesses`);
      if (negative && name === (negative.startsWith('inline') ? 'Explore' : 'Works')) {
        for (const expected of NEGATIVE_CONTROLS[negative].expected)
          assert.ok(
            libraryReads.some(
              (read) =>
                read.access === expected ||
                (expected.endsWith(':') && read.access.startsWith(expected))
            ),
            'planted Library operation must be attributed: ' + expected
          );
        console.log(
          'PASS negative-control attribution: ' +
            negative +
            ' -> ' +
            NEGATIVE_CONTROLS[negative].expected.join(', ')
        );
      }
      assert.equal(
        await page.evaluate(() => window.rule1.verifyDescriptors()),
        true,
        'observer descriptors intact'
      );
      assert.equal(
        await page.evaluate(() => window.rule1.snapshot()),
        before,
        name + ': recipe bytes changed'
      );
    }
    const envelopes = await page.evaluate(() => window.rule1.envelopes());
    assert.equal(envelopes.length, 1, 'one actual Reader handoff');
    checkEnvelope(envelopes[0]);
    for (const target of ['payload', 'provenance', 'declarations']) {
      const mutant = JSON.parse(JSON.stringify(envelopes[0]));
      const destination =
        target === 'payload'
          ? mutant.payload
          : target === 'provenance'
            ? mutant.payload.provenance
            : mutant.payload.declarations[0];
      destination.recipe = { cards: [] };
      assert.throws(
        () => checkEnvelope(mutant),
        /unexpected field|fresh fixture|recipe field/,
        target + ' rejects recipe state'
      );
    }
    console.log(
      'PASS bounded envelope: actual Library text/provenance/declarations only; three recipe-field mutants rejected'
    );
    assert.deepEqual(errors, [], 'uncaught browser exceptions');
    assert.deepEqual(unexpected, [], 'unstubbed network traffic');
    assert.deepEqual(failures, [], 'Rule-1 isolation violations');
    console.log(
      'LIBRARY RULE-1: PASS — six routes, no monitored Library-owned accesses; handoff WARN retained'
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
