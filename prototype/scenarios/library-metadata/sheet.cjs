/* global ac, messages, mod, handle */
// Standalone component evidence only; Library14/checklist234 stays pending.
// Fixture below is summary('u1', {availability:'held',title_search:'sea'}) from
// mcp/test_library_search.mjs:24-39,186-191 at production 10b42689f04db0f16a98425b3e22c9a5487b254c.
// search_store.py stores that exact summary for metadataById. Evidence additions
// are explicitly synthetic edge fixtures shaped by catalog_site_export.py.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../../..');
const modulePath = path.join(root, 'prototype/features/library-metadata/sheet.js');
const css = fs.readFileSync(
  path.join(root, 'prototype/features/library-metadata/sheet.css'),
  'utf8'
);
let source = fs.readFileSync(modulePath, 'utf8');
if (process.env.METADATA_MUTATION === 'leak')
  source = source.replace(
    'const m = record || {};',
    'const m = record || {}; root.dataset.leaked = m.snippet || "";'
  );
if (process.env.METADATA_MUTATION === 'style')
  source = source.replace('host.append(style);', '/* missing stylesheet */');
const held = {
  availability: 'held',
  collection_ids: ['col_a'],
  completeness: 'complete',
  contributor_search: 'anon',
  language: 'eng',
  reading_revision: 'rev_u1',
  reading_unit_id: 'u1',
  title: 'sea',
  title_search: 'sea',
  work_id: 'work_u1',
};
let count = 0;
const check = (ok, message) => {
  assert.ok(ok, message);
  count++;
};
(async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/sheet.js') {
      res.setHeader('Content-Type', 'text/javascript');
      return res.end(source);
    }
    if (req.url === '/sheet.css') {
      res.setHeader('Content-Type', 'text/css');
      return res.end(css);
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><meta name="viewport" content="width=device-width"><button id="opener">Inspect</button><div id="host"></div><button id="outside">Outside</button>'
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => {
      requests.push(route.request().url());
      return route.request().url().startsWith(base) ? route.continue() : route.abort();
    });
    await page.goto(base);
    await page.evaluate(async () => {
      window.mod = await import('/sheet.js');
    });
    async function mount(record = held, aborted = false) {
      await page.evaluate(
        ({ record, aborted }) => {
          window.handle?.unmount();
          window.ac = new AbortController();
          window.messages = [];
          if (aborted) ac.abort();
          document.querySelector('#opener').focus();
          const freeze = (x) => {
            if (x && typeof x === 'object') {
              Object.values(x).forEach(freeze);
              Object.freeze(x);
            }
            return x;
          };
          const ctx = {
            record: freeze(record),
            storage: {
              read() {
                throw Error('unexpected storage');
              },
              write() {
                throw Error('unexpected storage');
              },
            },
            announce: (s) => messages.push(s),
            signal: ac.signal,
          };
          window.handle = mod.mount(document.querySelector('#host'), Object.freeze(ctx));
          handle.focus();
        },
        { record, aborted }
      );
    }
    check(
      (await page.locator('link[rel="stylesheet"]').count()) === 0,
      'harness injects no stylesheet'
    );
    await mount();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('link')).some((l) => l.sheet)
    );
    check(
      (await page.locator('[data-library-metadata-style]').count()) === 1,
      'module owns stylesheet'
    );
    check(
      (await page.locator('.lm-sheet').evaluate((e) => getComputedStyle(e).maxInlineSize)) ===
        '672px',
      'module CSS applies'
    );
    check(
      (await page.locator('h2').textContent()) === 'sea',
      'exact source-shaped held summary title'
    );
    check(
      (await page.locator('[data-availability]').textContent()) === 'held',
      'availability badge'
    );
    check(
      (await page.locator('#host').textContent()).includes('English'),
      'production language label'
    );
    check(
      (await page.locator('#host').textContent()).includes('not readable'),
      'not-readable notice'
    );
    check((await page.locator('#host button').count()) === 1, 'no Read or export action');
    const poison = {
      ...held,
      title: '<img src=x onerror=alert(1)>',
      source_path: 'source/very-long-'.repeat(30),
      availability_reason: { admitted: false, reason: null },
      source_basis: {
        canonical_reading_sha256: 'a'.repeat(64),
        sources: [{ declared: true, snippet: 'DO_NOT_LEAK' }],
      },
      work_reviewed_equivalence: false,
      body: 'DO_NOT_LEAK',
      snippet: 'DO_NOT_LEAK',
      search_hit: { text: 'DO_NOT_LEAK' },
      source_labels: ['DO_NOT_LEAK'],
    };
    await mount(poison);
    check((await page.locator('#host img').count()) === 0, 'title is escaped');
    check(
      !(await page.locator('#host').innerHTML()).includes('DO_NOT_LEAK'),
      'forbidden fields never reach DOM, including nested evidence'
    );
    check(
      (await page.locator('#host').textContent()).includes('Undeclared / unread'),
      'null evidence preserved'
    );
    check(
      (await page.locator('#host').textContent()).includes('No'),
      'false equivalence preserved'
    );
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `no horizontal overflow ${width}`
      );
    }
    await page.locator('#outside').focus();
    await page.keyboard.press('Escape');
    check((await page.locator('.lm-sheet').count()) === 1, 'outside Escape does not close');
    await page.evaluate(() => handle.focus());
    await page.keyboard.press('Escape');
    check((await page.locator('.lm-sheet').count()) === 0, 'scoped Escape closes');
    check(
      await page.evaluate(() => document.activeElement.id === 'opener'),
      'close restores opener'
    );
    await mount(null);
    check(
      (await page.locator('#host').textContent()).includes('No metadata record was supplied'),
      'missing metadata state'
    );
    await mount({ ...held, contributors: 'broken' });
    check(
      (await page.locator('#host').textContent()).includes('fields are invalid'),
      'malformed contributors refused'
    );
    check(
      !(await page.locator('#host').textContent()).includes('sea'),
      'malformed record not rendered'
    );
    for (const bad of [
      { ...held, work_reviewed_equivalence: {} },
      { ...held, source_path: [] },
      { ...held, source_basis: 'public_domain' },
      { ...held, availability: 'unknown' },
      { ...held, reading_unit_id: '' },
    ]) {
      await mount(bad);
      check(
        (await page.locator('#host').textContent()).includes('fields are invalid'),
        'malformed metadata state'
      );
    }
    await mount({ reading_unit_id: 'u1', availability: 'held' });
    check(
      (await page.locator('#host').textContent()).includes('Not loaded yet'),
      'sparse record preserves unknown evidence'
    );
    for (const availability of ['metadata_only', 'research_only', 'rejected', 'readable']) {
      await mount({ ...held, availability });
      check(
        (await page.locator('[data-availability]').getAttribute('data-availability')) ===
          availability,
        'exact availability preserved'
      );
      check(
        (await page.locator('#host button').count()) === 1,
        'no reading action for any availability'
      );
    }
    await mount();
    await page.locator('#outside').focus();
    await page.evaluate(() => ac.abort());
    check((await page.locator('#host').textContent()) === '', 'abort removes nodes');
    check(
      (await page.locator('[data-library-metadata-style]').count()) === 0,
      'abort removes stylesheet'
    );
    check(
      await page.evaluate(() => document.activeElement.id === 'outside'),
      'teardown does not steal focus'
    );
    await mount(held, true);
    check((await page.locator('#host').textContent()) === '', 'already-aborted mount stays empty');
    await page.evaluate(() => {
      handle.unmount();
      handle.unmount();
      handle.focus();
    });
    await mount();
    await page.locator('[data-lm-close]').click();
    check((await page.locator('#host').textContent()) === '', 'button close');
    check(
      await page.evaluate(() => document.activeElement.id === 'opener'),
      'button restores opener'
    );
    check(
      (await page.locator('[data-library-metadata-style]').count()) === 0,
      'close removes stylesheet'
    );
    await mount();
    await page.evaluate(() => {
      const sibling = document.createElement('div');
      sibling.id = 'sibling';
      document.body.append(sibling);
      window.other = mod.mount(sibling, {
        record: { reading_unit_id: 'u2', availability: 'held' },
        signal: new AbortController().signal,
      });
    });
    check(
      (await page.locator('[data-library-metadata-style]').count()) === 2,
      'two hosts own separate links'
    );
    await page.evaluate(() => handle.unmount());
    check(
      (await page.locator('#sibling .lm-sheet').count()) === 1 &&
        (await page.locator('[data-library-metadata-style]').count()) === 1,
      'one teardown leaves sibling intact'
    );
    await page.evaluate(() => window.other.unmount());
    check(
      (await page.locator('[data-library-metadata-style]').count()) === 0,
      'both hosts cleaned up'
    );
    check(errors.length === 0, `browser errors: ${errors}`);
    check(
      requests.every((u) => u.startsWith(base)),
      'only local fixture requests'
    );
    console.log(`metadata sheet: ${count} checks passed; standalone only`);
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
