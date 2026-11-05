#!/usr/bin/env node
'use strict';
/* global window, document */

// The Library where the browser has no DecompressionStream (#660 6666279630,
// A1 row 1.14). The Library's static data is gzip; src/library/core.js
// inflates it with DecompressionStream, refuses by name when the API is
// absent, and forgets a failed load so Retry asks again. No other test removes
// the API (check_library_overcap_offer.js and test_library_reader_provenance.js
// pass it in). Chromium stands in for a browser without it: an init script
// deletes window.DecompressionStream before the page loads.
//
// One collection page, served by _pages_server.js from the committed data
// (its .json.gz arrives as raw gzip bytes, as on the site), in four arms:
//   1. control: the API present renders the collection;
//   2. the API absent: the explicit refusal and Retry, not a hang or a blank;
//   3. Retry twice, nothing repaired: the same refusal, focus on the new
//      Retry, the refusal said through #library-live, one request per attempt
//      (a failed inflate is not cached);
//   4. the same file served already decoded, then Retry: the collection
//      renders, "<name> loaded" is said, focus is on the heading.
// --self-test plants two defects in the served core chunk and requires each
// to fail this check by name: a failed load kept in the cache, and the
// refusal replaced by a generic error.
//
//   node scripts/check_library_no_decompression.js [--self-test]
//
// CHROMIUM_PATH may name a Chromium executable.

const path = require('node:path');
const zlib = require('node:zlib');
const { chromium } = require('playwright');
const { start } = require('./_pages_server.js');

const root = path.resolve(__dirname, '..');
const CID = 'collection_c98dc032-daaf-56af-aaf4-2496e825bd9d';
const NAME = 'cym alun strict';
const REFUSAL = 'This browser cannot read the Library data';
const selfTest = process.argv.includes('--self-test');
// Plants whose target text wasn't in the served chunk: a self-test failure,
// not a catch.
const unplanted = new Set();

// The defects --self-test plants in the served core chunk (minified source).
const MUTANTS = {
  // json(): `p.catch(() => cache.get(path) === p && cache.delete(path))`.
  'a failed load stays cached': (js) =>
    js.replace(
      /(\w+)\.catch\(\(\)=>(\w+)\.get\((\w+)\)===\1&&\2\.delete\(\3\)\)/,
      '$1.catch(()=>{})'
    ),
  'the refusal is a generic error': (js) => js.split(REFUSAL).join('Failed to fetch'),
};

async function run(browser, srv, mutant) {
  const problems = [];
  const expect = (ok, what) => {
    if (!ok) problems.push(what);
  };
  const read = (page) =>
    page.evaluate(() => {
      const s = document.querySelector('#surface-library');
      const err = s && s.querySelector('.cm-empty[data-tone="danger"]');
      const live = document.getElementById('library-live');
      const a = document.activeElement;
      return {
        error: err ? err.innerText.replace(/\s+/g, ' ').trim() : null,
        rows: s ? s.querySelectorAll('.lib-coll-list').length : 0,
        live: live ? live.textContent : '',
        focus: a ? a.dataset.libAct || a.tagName : null,
        api: typeof window.DecompressionStream !== 'undefined',
      };
    });
  const settle = (page) =>
    page
      .waitForFunction(
        () => {
          const s = document.querySelector('#surface-library');
          return (
            s &&
            (s.querySelector('.cm-empty[data-tone="danger"]') || s.querySelector('.lib-coll-list'))
          );
        },
        null,
        { timeout: 30000 }
      )
      .catch(() => null);
  async function open({ removeApi, decoded }) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const requests = [];
    await context.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== srv.url) return route.abort();
      if (mutant && /\/library\/code\/core\.[0-9a-f]+\.js$/.test(u.pathname)) {
        const res = await route.fetch();
        const js = (await res.body()).toString('utf8');
        const out = MUTANTS[mutant](js);
        if (out === js) unplanted.add(mutant);
        return route.fulfill({ response: res, body: out });
      }
      if (!u.pathname.endsWith(`/c/${CID}.json.gz`)) return route.continue();
      const res = await route.fetch();
      const body = await res.body();
      const gzip = body[0] === 0x1f && body[1] === 0x8b;
      const asDecoded = decoded() && gzip;
      requests.push({ gzip, decoded: asDecoded });
      if (asDecoded)
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: zlib.gunzipSync(body),
        });
      return route.fulfill({ response: res, body });
    });
    // A planted chunk no longer matches its sha384, so the browser would
    // refuse it ("The site was updated") and the plant would never run:
    // under --self-test only, the loader's and the preload's integrity are
    // not applied.
    if (mutant)
      await context.addInitScript(() => {
        Object.defineProperty(window.HTMLScriptElement.prototype, 'integrity', {
          set() {},
          get: () => '',
          configurable: true,
        });
        Object.defineProperty(window.HTMLLinkElement.prototype, 'integrity', {
          set() {},
          get: () => '',
          configurable: true,
        });
        const setAttribute = window.Element.prototype.setAttribute;
        window.Element.prototype.setAttribute = function (name, value) {
          if (String(name).toLowerCase() === 'integrity') return;
          return setAttribute.call(this, name, value);
        };
      });
    if (removeApi)
      await context.addInitScript(() => {
        delete window.DecompressionStream;
      });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${srv.url}/codex.html#library/collections/${CID}`);
    await settle(page);
    return { context, page, requests, errors };
  }
  const retry = async (page) => {
    const b = await page.$('#surface-library [data-lib-act="retry"]');
    if (!b) return false;
    await b.click();
    await page.waitForTimeout(1000);
    await settle(page);
    return true;
  };

  // 1. Control.
  {
    const a = await open({ removeApi: false, decoded: () => false });
    const s = await read(a.page);
    expect(
      s.api && s.rows === 1 && !s.error,
      `control: the collection did not render (${JSON.stringify(s)})`
    );
    expect(
      a.requests.length === 1,
      `control: ${a.requests.length} requests for the collection, not 1`
    );
    expect(!a.errors.length, `control: page errors: ${a.errors.join(' | ')}`);
    await a.context.close();
  }
  // 2–4. The API absent.
  {
    let decoded = false;
    const a = await open({ removeApi: true, decoded: () => decoded });
    const first = await read(a.page);
    expect(!first.api, 'absent: the init script did not remove DecompressionStream');
    expect(
      first.error &&
        first.error.includes('The Library catalog did not load') &&
        first.error.includes(REFUSAL),
      `absent: no explicit refusal "${REFUSAL}" (${JSON.stringify(first.error)})`
    );
    for (const n of [1, 2]) {
      const pressed = await retry(a.page);
      const s = await read(a.page);
      expect(pressed, `retry ${n}: no Retry button`);
      expect(
        s.error && s.error.includes(REFUSAL),
        `retry ${n}: the refusal changed (${JSON.stringify(s.error)})`
      );
      expect(s.focus === 'retry', `retry ${n}: focus is on ${s.focus}, not the new Retry`);
      expect(
        s.live.includes(REFUSAL),
        `retry ${n}: #library-live said "${s.live}", not the refusal`
      );
    }
    expect(
      a.requests.length === 3 && a.requests.every((r) => r.gzip && !r.decoded),
      `retry: ${a.requests.length} requests for the collection over a load and two Retries, not 3 (a failed inflate is cached?)`
    );
    decoded = true;
    await retry(a.page);
    const after = await read(a.page);
    expect(
      a.requests.length === 4 && a.requests[3].decoded,
      `decoded: the recovery did not ask again for the file (${a.requests.length} requests)`
    );
    expect(
      after.rows === 1 && !after.error,
      `decoded: the collection did not render (${JSON.stringify(after)})`
    );
    expect(
      after.live === `${NAME} loaded`,
      `decoded: #library-live said "${after.live}", not "${NAME} loaded"`
    );
    expect(after.focus === 'H1', `decoded: focus is on ${after.focus}, not the heading`);
    expect(!a.errors.length, `absent: page errors: ${a.errors.join(' | ')}`);
    await a.context.close();
  }
  return problems;
}

(async () => {
  const srv = await start({ root });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  let failed = false;
  try {
    const problems = await run(browser, srv, null);
    if (problems.length) {
      failed = true;
      console.error(`check_library_no_decompression: FAIL — ${problems.length} problem(s)`);
      for (const p of problems) console.error(`  ✗ ${p}`);
    } else console.log('check_library_no_decompression: the four arms pass');
    if (selfTest) {
      for (const name of Object.keys(MUTANTS)) {
        const caught = await run(browser, srv, name);
        if (unplanted.has(name)) {
          failed = true;
          console.error(
            `  ✗ self-test: the "${name}" plant did not apply to the served core chunk`
          );
        } else if (caught.length) console.log(`  self-test: "${name}" fails it (${caught[0]})`);
        else {
          failed = true;
          console.error(`  ✗ self-test: "${name}" was not caught`);
        }
      }
    }
  } finally {
    await browser.close();
    await srv.close();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
