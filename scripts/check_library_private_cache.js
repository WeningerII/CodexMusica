#!/usr/bin/env node
'use strict';

// Globals below are accessed only inside serialized browser callbacks.
/* global window, document, IDBObjectStore, Storage, indexedDB, localStorage, sessionStorage,
          CMLyricTokens, core, writes, snapshot, requests, jobFixture, memoryKey, reading, lib, handle */
/* global jobStatus: writable */

// Local synthetic fixtures only. Execute the real analysis chunk, token helper,
// and core device adapter in Chromium; do not duplicate their cache algorithms.
// This complements the recipe/chat isolation check: it checks private evidence
// eviction and interpretation writes, not backend deletion, HTTP cache policy,
// browser disk forensics, or every Library persistence path.
// Usage: node scripts/check_library_private_cache.js [--self-test]
//        [--source-root /path/to/exact/source/tree]
// CHROMIUM_PATH may select an installed executable. No build or registration.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
let sourceRoot = path.resolve(__dirname, '..');
let selfTest = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--self-test') selfTest = true;
  else if (args[i] === '--source-root' && args[i + 1]) sourceRoot = path.resolve(args[++i]);
  else throw Error('Unknown or incomplete argument: ' + args[i]);
}
const files = ['src/lyric-tokens.js', 'src/library/core.js', 'src/library/analysis.js'];
const sources = files.map((file) => fs.readFileSync(path.join(sourceRoot, file), 'utf8'));
const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');
const revisions = Object.fromEntries(files.map((file, i) => [file, digest(sources[i])]));

async function scenario(browser, analysis, mode, action) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Intercept every request; the synthetic origin provides secure-context APIs.
  await context.route('**/*', (route) => {
    if (route.request().url() === 'http://localhost/private-cache-check')
      return route.fulfill({ contentType: 'text/html', body: '<main id="fixture"></main>' });
    if (mode === 'core' && route.request().url() === 'http://localhost/library/data/catalog.json')
      return route.fulfill({ json: { data_id: 'synthetic-catalog' } });
    errors.push('Unexpected network request: ' + route.request().url());
    return route.abort();
  });
  try {
    await page.goto('http://localhost/private-cache-check');
    await page.evaluate(() => {
      window.esc = (s) =>
        String(s ?? '').replace(
          /[&<>"']/g,
          (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
        );
      window.icon = window.uiEmptyState = () => '';
      window.showToast = window.libraryAnnounce = () => {};
      // Capture attempted transient writes as well as final stored values.
      window.writes = [];
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, key) {
        writes.push({ key, value: structuredClone(value) });
        return put.apply(this, arguments);
      };
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (value, key) {
        writes.push({ key, value: structuredClone(value) });
        return add.apply(this, arguments);
      };
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        writes.push({ key, value });
        return set.apply(this, arguments);
      };
      window.snapshot = async () => {
        const out = [];
        for (const { name } of await indexedDB.databases()) {
          const db = await new Promise((resolve, reject) => {
            const r = indexedDB.open(name);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          });
          for (const store of db.objectStoreNames) {
            const rows = await new Promise((resolve, reject) => {
              const rows = [];
              const tx = db.transaction(store);
              const r = tx.objectStore(store).openCursor();
              r.onsuccess = () => {
                if (r.result) {
                  rows.push({ key: r.result.key, value: r.result.value });
                  r.result.continue();
                }
              };
              tx.oncomplete = () => resolve(rows);
              tx.onerror = () => reject(tx.error);
            });
            out.push({ name, store, rows });
          }
          db.close();
        }
        return out;
      };
    });
    await page.addScriptTag({ content: sources[0] });
    if (mode === 'core') {
      await page.addScriptTag({ content: 'window.core = (function(){\n' + sources[1] + '\n})();' });
      await page.evaluate(() => core.lib.selection.ready);
    }
    await page.addScriptTag({ content: 'window.analysis = (function(){\n' + analysis + '\n})();' });
    await page.evaluate(
      async ({ mode }) => {
        const hash = async (s) =>
          Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
          )
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        const id = 'private-job-sentinel';
        const identity = { reading_revision: 'revision-fixture' };
        const pageBytes = JSON.stringify({
          instances: [{ kind: 'fixture', method_id: 'fixture', value: 'private-page-sentinel' }],
        });
        const pageHash = await hash(pageBytes);
        const manifestBytes = JSON.stringify({
          job_id: id,
          identity_hash: await hash(analysis.canonical(identity)),
          summary: { marker: 'private-manifest-sentinel' },
          evidence_count: 1,
          page_count: 1,
        });
        const manifestHash = await hash(manifestBytes);
        window.jobFixture = { id, identity, manifest_hash: manifestHash, state: 'completed' };
        window.requests = [];
        window.jobStatus = 200;
        window.lib = {
          json: async () => ({ methods: [] }),
          ...(mode === 'core' ? { device: core.lib.device } : {}),
          viewer: async (url, opts = {}) => {
            requests.push({ url, method: opts.method || 'GET' });
            if (url === '/jobs/' + id && opts.method === 'DELETE') return {};
            if (url === '/jobs/' + id) {
              if (jobStatus !== 200)
                throw Object.assign(Error('Synthetic status'), { status: jobStatus });
              return { job: structuredClone(jobFixture) };
            }
            if (url === '/jobs/' + id + '/manifests/' + manifestHash)
              return new Response(manifestBytes);
            if (url.includes('/manifests/') && url.includes('/pages?'))
              return {
                manifest_hash: manifestHash,
                page_refs: [{ sha256: pageHash }],
                next_offset: 7,
              };
            if (url.includes('/pages/' + pageHash)) return new Response(pageBytes);
            throw Error('Unexpected viewer route');
          },
        };
        window.reading = { reading_unit_id: 'unit-fixture', reading_revision: 'revision-fixture' };
        window.memoryKey = 'unit-fixture:revision-fixture';
        window.deviceKey = 'interpretation:unit-fixture:revision-fixture';
        // Seed only the already-owned job. The real activation must fetch, verify
        // and populate report/records/next/offset from the synthetic transport.
        analysis._memory.set(memoryKey, {
          job: structuredClone(jobFixture),
          previous: [],
          report: null,
          records: [],
          next: null,
          offset: 0,
        });
        window.handle = analysis.mount(document.querySelector('#fixture'), {
          reading,
          lib,
          lines: [],
        });
      },
      { mode }
    );
    await page.waitForFunction(() => analysis._memory.get(memoryKey).records.length === 1);
    const loaded = await page.evaluate(() => {
      const m = analysis._memory.get(memoryKey);
      return {
        report: m.report.summary.marker,
        record: m.records[0].value,
        next: m.next,
        requests,
        writes: structuredClone(writes),
      };
    });
    assert.equal(loaded.report, 'private-manifest-sentinel', 'real manifest loaded');
    assert.equal(loaded.record, 'private-page-sentinel', 'real evidence page loaded');
    assert.equal(loaded.next, 7, 'pagination cached before eviction');
    assert(
      loaded.requests.some((r) => r.url.includes('/pages/')),
      'page transport exercised'
    );
    // Save through the actual editor while credentialed evidence is resident.
    await page.locator('[data-act="decl"]').click();
    await page
      .locator('details')
      .filter({ has: page.locator('[data-f="raw"]') })
      .locator('summary')
      .click();
    await page.locator('[data-f="raw"]').fill(
      JSON.stringify({
        hooks: [{ text: 'synthetic declaration', source: 'local fixture' }],
      })
    );
    await page.locator('[data-f="raw"]').dispatchEvent('input');
    await page.locator('[data-act="save"]').click();
    await page.waitForFunction(() => writes.some((w) => w.value?.declarations?.hooks?.length));
    const before = await page.evaluate(() => snapshot());
    assert.equal(before.length, 1, 'only the selected device database exists');
    assert.equal(
      before[0].name,
      mode === 'core' ? 'codex-musica-library-v1' : 'codex-musica-library-analysis-v1'
    );
    assert.equal(before[0].rows.length, 1, 'one interpretation key only');
    const row = before[0].rows[0];
    assert.equal(row.key, 'interpretation:unit-fixture:revision-fixture', 'exact device key');
    assert.deepEqual(
      Object.keys(row.value).sort(),
      ['declarations', 'token_cut'],
      'stored interpretation has exact allowed shape'
    );
    assert.deepEqual(row.value.declarations, {
      hooks: [{ text: 'synthetic declaration', source: 'local fixture' }],
    });
    assert.equal(row.value.token_cut, await page.evaluate(() => CMLyricTokens.SCHEME));
    // Use a nonzero offset too: forgetting to reset just the cursor must fail.
    await page.evaluate(() => {
      analysis._memory.get(memoryKey).offset = 3;
    });
    if (action === 'delete') {
      await page.locator('[data-act="delete"]').click();
      await page.waitForFunction(() => analysis._memory.get(memoryKey).job === null);
    } else {
      await page.evaluate(async (status) => {
        jobStatus = status;
        await handle.activate();
      }, action);
    }
    const after = await page.evaluate(async () => ({
      memory: analysis._memory.get(memoryKey),
      stored: await snapshot(),
      writes,
      declarations: await analysis.declarations(reading, lib),
      requests,
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));
    assert.equal(after.memory.job, null, action + ': job released');
    assert.equal(after.memory.report, null, action + ': manifest dropped');
    assert.deepEqual(after.memory.records, [], action + ': evidence pages dropped');
    assert.equal(after.memory.next, null, action + ': next cursor dropped');
    assert.equal(after.memory.offset, 0, action + ': offset reset');
    assert.deepEqual(after.stored, before, action + ': declarations preserved unchanged');
    assert.deepEqual(after.declarations, row.value.declarations, 'declarations remain readable');
    for (const w of after.writes) {
      assert.equal(w.key, row.key, 'no other storage keys');
      assert.deepEqual(
        Object.keys(w.value).sort(),
        ['declarations', 'token_cut'],
        'every attempted write is declarations-only'
      );
      assert(
        !/private-(job|page|manifest)-sentinel/.test(JSON.stringify(w)),
        'no credentialed sentinel in attempted writes'
      );
    }
    assert.deepEqual(after.local, []);
    assert.deepEqual(after.session, []);
    if (action === 'delete')
      assert.equal(after.requests.filter((r) => r.method === 'DELETE').length, 1);
    assert.deepEqual(errors, [], 'no browser/runtime/network errors');
  } finally {
    await context.close();
  }
}

function replaceOnce(source, from, to) {
  assert.equal(source.split(from).length, 2, 'mutation anchor must match exactly once');
  return source.replace(from, to);
}

async function main() {
  console.log('Source SHA-256:', JSON.stringify(revisions));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  try {
    for (const mode of ['core', 'fallback']) {
      for (const action of ['delete', 404, 410]) {
        await scenario(browser, sources[2], mode, action);
        console.log('PASS', mode, action);
      }
    }
    if (selfTest) {
      // Only in-memory source strings are faulted. No repository file is edited.
      const mutants = [
        [
          'delete retains evidence',
          'core',
          'delete',
          'delete: manifest dropped',
          'mem.job = null;\n        dropEvidence(mem);',
          'mem.job = null;',
        ],
        [
          'authorization loss retains evidence',
          'fallback',
          410,
          '410: manifest dropped',
          'dropEvidence(mem);\n    st.resolved = [];',
          'st.resolved = [];',
        ],
        [
          'cursor retained',
          'core',
          404,
          '404: next cursor dropped',
          'const dropEvidence = (m) => Object.assign(m, { report: null, records: [], next: null, offset: 0 });',
          'const dropEvidence = (m) => Object.assign(m, { report: null, records: [], next: 7, offset: 3 });',
        ],
        [
          'page records retained',
          'fallback',
          404,
          '404: evidence pages dropped',
          'const dropEvidence = (m) => Object.assign(m, { report: null, records: [], next: null, offset: 0 });',
          'const dropEvidence = (m) => Object.assign(m, { report: null, next: null, offset: 0 });',
        ],
        [
          'credentialed memory persisted',
          'core',
          'delete',
          'stored interpretation has exact allowed shape',
          'await device.set(deviceKey, interpretationRecord(st));\n          st.unsaved',
          'await device.set(deviceKey, { ...interpretationRecord(st), private_cache: mem });\n          st.unsaved',
        ],
        [
          'wrong interpretation key',
          'fallback',
          'delete',
          'exact device key',
          'const deviceKey = `interpretation:${reading.reading_unit_id}:${reading.reading_revision}`;',
          'const deviceKey = `interpretation:${reading.reading_unit_id}:wrong-revision`;',
        ],
      ];
      for (const [name, mode, action, expected, from, to] of mutants) {
        const mutated = replaceOnce(sources[2], from, to);
        let caught;
        try {
          await scenario(browser, mutated, mode, action);
        } catch (e) {
          caught = e;
        }
        assert(
          caught instanceof assert.AssertionError,
          name + ': must fail a behavioral assertion, not a timeout/runtime error'
        );
        assert.equal(
          caught.message.split('\n')[0],
          expected,
          name + ': must fail the intended assertion'
        );
        console.log('DETECTED', name, '—', caught.message.split('\n')[0]);
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
