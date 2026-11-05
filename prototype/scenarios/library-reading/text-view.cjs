/* global pageCalls, controller, readCalls, say, writes, ctx, mod, fixture, handle, calls, uneven, makeCtx, before, finishReading, realCalls, actual, host2, first, second */
// Standalone source-shaped fixtures; no production loader or integration claim.
// Run: NODE_PATH=<playwright installation>/node_modules node <this file>
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const feature = path.resolve(__dirname, '../../features/library-reading/text-view.js');
const css = fs.readFileSync(feature.replace(/\.js$/, '.css'), 'utf8');
let code = fs.readFileSync(feature, 'utf8');
if (process.env.MUTATE_SOURCE_FALLBACK)
  code = code.replace('srcText == null ? text : srcText', 'srcText || text');
function productionFixtures() {
  if (!process.env.READING_FIXTURE_ROOT) return [];
  const crypto = require('node:crypto'),
    zlib = require('node:zlib');
  const specs = [
    [
      'source_difference',
      'library/data/r/00/reading_0018d4ee-45f1-5a03-bf90-31d793b3d1f8/b6b44647573f1a3b-d8be20017818/head.json.gz',
      '5d2969cbb2b425984a4e70e27ebaa1d97ac297cd',
    ],
    [
      'rtl',
      'library/data/r/00/reading_001e1786-f68f-580f-94b0-fbea01a67323/6776b0df33bea40b-50f8e25aeee5/head.json.gz',
      'aa087b3cf605001cedef0af101a4f0bf0b6fd338',
    ],
    [
      'astral',
      'library/data/r/01/reading_01b71e38-bee6-5b75-8219-cb8fceaf186a/b5cda44939991865-4906872b26af/head.json.gz',
      'f5169717bc761c23f5b8768f190bb50654faed06',
    ],
    [
      'boundary',
      'library/data/r/e0/reading_e08cee8e-f284-5eff-b7ec-111fef4060a9/4f2fdbe78802f415-4fa8e1e9ce19/head.json.gz',
      '1de93ae95ca68c0c4b87661c5398f44400105aba',
    ],
  ];
  const read = (p, sha) => {
    const bytes = fs.readFileSync(path.join(process.env.READING_FIXTURE_ROOT, p));
    const actual = crypto
      .createHash('sha1')
      .update(Buffer.from('blob ' + bytes.length + '\0'))
      .update(bytes)
      .digest('hex');
    assert.equal(actual, sha, 'Fixture must match pinned P2 Git blob');
    const raw = zlib.gunzipSync(bytes);
    return {
      record: JSON.parse(raw),
      sha256: crypto.createHash('sha256').update(raw).digest('hex'),
    };
  };
  return specs.map(([name, p, sha]) => {
    const { record: head, sha256 } = read(p, sha),
      key = path.basename(path.dirname(p));
    assert.equal(sha256.slice(0, 12), key.slice(17));
    assert.ok(head.reading_revision.startsWith(key.slice(0, 16)));
    assert.equal(head.page_index, 0);
    assert.equal(head.page_count, head.pages.length + 1);
    let next = null;
    if (name === 'boundary') {
      const data = read(
        path.dirname(p) + '/1-e22397ba26f4.json.gz',
        '8a799cf1eeb1d9d0bc11a4e51f10005ea6e0b96c'
      );
      assert.equal(data.sha256, head.pages[0]);
      next = data.record;
      assert.equal(next.reading_unit_id, head.reading_unit_id);
      assert.equal(next.reading_revision, head.reading_revision);
    }
    return { name, head, next };
  });
}
if (process.env.MUTATE_STYLESHEET)
  code = code.replace('root.append(stylesheet);', '/* missing stylesheet */');
async function run() {
  const realFixtures = productionFixtures();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    for (const width of [1100, 375]) {
      const page = await browser.newPage({ viewport: { width, height: 700 } });
      await page.route('**/*', (route) => {
        const p = new URL(route.request().url()).pathname;
        if (p.endsWith('/text-view.js'))
          return route.fulfill({ contentType: 'text/javascript', body: code });
        if (p.endsWith('/text-view.css'))
          return route.fulfill({ contentType: 'text/css', body: css });
        return route.fulfill({ contentType: 'text/html', body: '<main></main>' });
      });
      await page.goto('http://reading.test/');
      await page.evaluate(async () => {
        const mod = await import('/prototype/features/library-reading/text-view.js');
        const head = {
          reading_unit_id: 'reading_fixture',
          reading_revision: 'fixture-revision',
          page_index: 0,
          page_count: 2,
          pages: ['fixture-page-hash'],
          title: 'Fixture <not markup>',
          language: 'fas',
          direction: 'rtl',
          start: {
            row_start: 0,
            analysis_line_start: 0,
            normalized_cp_start: 0,
            normalized_utf16_start: 0,
            physical_line_start: 0,
          },
          lines: Array.from({ length: 250 }, (_, i) => [
            'blank',
            '',
            0,
            i + 1,
            null,
            [i, i],
            null,
            [],
          ]),
        };
        head.lines[0] = ['lyric', 'A😀ب', 2, 1, 1, [0, 3], '', []];
        head.lines[1] = ['structure', 'Section', 0, 2, null, [3, 10], null, []];
        head.lines[2] = [
          'editorial',
          'hidden normalized',
          0,
          3,
          null,
          [10, 27],
          'physical source',
          [],
        ];
        const second = {
          ...head,
          page_index: 1,
          start: {
            row_start: 250,
            analysis_line_start: 1,
            normalized_cp_start: 3,
            normalized_utf16_start: 4,
            physical_line_start: 250,
          },
          lines: [['lyric', '𐐀ب', 0, 251, 2, [99, 101], null, []]],
        };
        window.fixture = { head, second };
        window.mod = mod;
        window.controller = new AbortController();
        window.writes = [];
        window.say = [];
        window.fail = false;
        window.pending = false;
        window.readCalls = [];
        window.pageCalls = [];
        const loadPage = async (index, { signal }) => {
          pageCalls.push(index);
          if (signal !== controller.signal) throw Error('signal mismatch');
          if (window.pending) await new Promise((resolve) => (window.resolvePage = resolve));
          if (window.fail) throw window.fail;
          return index === 1 ? second : head;
        };
        window.ctx = {
          unitId: head.reading_unit_id,
          reading: async (id) => {
            readCalls.push(id);
            return { head, loadPage };
          },
          signal: controller.signal,
          announce: (t) => say.push(t),
          storage: {
            read: () => ({ ok: true, value: 20 }),
            write: (...a) => {
              writes.push(a);
              return { ok: false };
            },
          },
        };
        window.handle = mod.mount(document.querySelector('main'), ctx);
      });
      await page.locator('p[data-lr-status]').filter({ hasText: 'Page 1' }).waitFor();
      assert.deepEqual(await page.evaluate(() => readCalls), ['reading_fixture']);
      assert.deepEqual(await page.evaluate(() => pageCalls), []);
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector('.lr-controls')).display === 'flex'
      );
      assert.equal(await page.locator('link[rel=stylesheet]').count(), 1);
      assert.equal(await page.getByRole('status').count(), 0);
      const count = () => page.locator('.lr-line').count();
      assert.equal(await count(), 249);
      assert.equal(await page.locator('.lr-lines').getAttribute('dir'), 'rtl');
      assert.equal(await page.locator('.lr-lines').getAttribute('lang'), 'fas');
      assert.equal(await page.locator('.lr-text').first().textContent(), 'A😀ب');
      await page.getByRole('button', { name: 'Source transcription', exact: true }).click();
      assert.equal(await count(), 250);
      assert.equal(await page.locator('.lr-text').first().textContent(), '');
      assert.equal(await page.locator('.lr-text').nth(1).textContent(), 'Section');
      await page.getByRole('button', { name: 'Source transcription', exact: true }).click();
      for (let i = 0; i < 6; i++)
        await page.getByRole('button', { name: 'Larger text', exact: true }).click();
      assert.equal(
        await page.getByRole('button', { name: 'Larger text', exact: true }).isDisabled(),
        true
      );
      assert.match(await page.locator('p[data-lr-status]').textContent(), /Not saved/);
      for (let i = 0; i < 8; i++)
        await page.getByRole('button', { name: 'Smaller text', exact: true }).click();
      assert.equal(
        await page.getByRole('button', { name: 'Smaller text', exact: true }).isDisabled(),
        true
      );
      await page.evaluate(() => (window.fail = { code: 'LOAD_FAILED', message: 'offline' }));
      await page.getByRole('button', { name: 'Next page', exact: true }).click();
      await page.locator('p[data-lr-status]').filter({ hasText: 'Try again' }).waitFor();
      assert.equal(await count(), 249);
      await page.evaluate(() => (window.fail = false));
      await page.getByRole('button', { name: 'Next page', exact: true }).click();
      await page.locator('p[data-lr-status]').filter({ hasText: 'Page 2' }).waitFor();
      assert.equal(await count(), 1);
      assert.equal(await page.locator('.lr-number').textContent(), '2');
      const ranges = await page.evaluate(() => mod.decodePage(fixture.head, fixture.second, 1)[0]);
      assert.deepEqual(ranges.cpRange, [4, 6]);
      assert.deepEqual(ranges.utfRange, [5, 8]);
      const checks = await page.evaluate(() => {
        const faults = [
          (p) => (p.reading_revision = 'wrong'),
          (p) => (p.start.row_start = -1),
          (p) => (p.lines[0][4] = 99),
          (p) => (p.lines = null),
        ];
        return faults.map((f) => {
          const p = structuredClone(fixture.second);
          f(p);
          try {
            mod.decodePage(fixture.head, p, 1);
            return false;
          } catch {
            return true;
          }
        });
      });
      assert.deepEqual(checks, [true, true, true, true]);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(() => {
        handle.focus();
      });
      assert.equal(await page.locator('h2').evaluate((e) => e === document.activeElement), true);
      // Two full pages expose stale scrollTop that a short final page masks.
      await page.getByRole('button', { name: 'Previous page', exact: true }).click();
      await page.locator('p[data-lr-status]').filter({ hasText: 'Page 1' }).waitFor();
      await page.evaluate(() => {
        while (fixture.second.lines.length < 250) {
          const i = fixture.second.lines.length;
          fixture.second.lines.push(['blank', '', 0, 251 + i, null, [0, 0], null, []]);
        }
        document.querySelector('.lr-lines').scrollTop = 3000;
      });
      await page.getByRole('button', { name: 'Next page', exact: true }).click();
      await page.locator('p[data-lr-status]').filter({ hasText: 'Page 2' }).waitFor();
      assert.equal(await count(), 250);
      assert.equal(await page.locator('.lr-lines').evaluate((e) => e.scrollTop), 0);
      assert.equal(await page.locator('h2').evaluate((e) => e === document.activeElement), true);
      await page.evaluate(() => (window.pending = true));
      await page.getByRole('button', { name: 'Previous page', exact: true }).click();
      await page.evaluate(() => {
        controller.abort();
        window.resolvePage();
      });
      assert.equal(await page.locator('link[rel=stylesheet]').count(), 0);
      assert.equal(await page.locator('.lr-text-view').count(), 0);
      await page.evaluate(() => handle.unmount());
      await page.evaluate(() => {
        window.handle = mod.mount(document.querySelector('main'), {
          unitId: fixture.head.reading_unit_id,
          reading: async () => ({ head: fixture.head }),
        });
      });
      await page.locator('p[data-lr-status]').filter({ hasText: 'failed' }).waitFor();
      await page.evaluate(() => {
        handle.unmount();
        const bad = structuredClone(fixture.head);
        bad.lines[0][4] = 2;
        window.handle = mod.mount(document.querySelector('main'), {
          unitId: bad.reading_unit_id,
          reading: async () => ({ head: bad, loadPage: async () => bad }),
        });
      });
      await page.locator('p[data-lr-status]').filter({ hasText: 'failed' }).waitFor();
      assert.equal(await count(), 0);
      assert.match(await page.locator('p[data-lr-status]').textContent(), /failed/);
      // Uneven page boundaries: 3 rows, then 5 rows; no index*page-size rule.
      await page.evaluate(() => {
        handle.unmount();
        const h = structuredClone(fixture.head);
        h.lines = h.lines.slice(0, 3);
        const p = structuredClone(fixture.second);
        p.start.row_start = 3;
        p.lines = p.lines.slice(0, 5);
        window.uneven = { h, p };
        window.failure = null;
        window.calls = [];
        window.handle = mod.mount(document.querySelector('main'), {
          ...ctx,
          reading: async () => ({
            head: h,
            loadPage: async (i, { signal }) => {
              calls.push(i);
              if (signal !== controller.signal) throw Error('bad signal');
              if (window.failure) throw window.failure;
              return i ? p : h;
            },
          }),
          signal: undefined,
        });
      });
      // Use a fresh scope: the earlier controller was intentionally aborted.
      await page.evaluate(() => {
        handle.unmount();
        window.controller = new AbortController();
        window.makeCtx = () => ({
          ...ctx,
          signal: controller.signal,
          reading: async () => ({
            head: uneven.h,
            loadPage: async (i, { signal }) => {
              calls.push(i);
              if (signal !== controller.signal) throw Error('bad signal');
              if (window.failure) throw window.failure;
              return i ? uneven.p : uneven.h;
            },
          }),
        });
        window.handle = mod.mount(document.querySelector('main'), makeCtx());
      });
      await page.locator('p[data-lr-status]').filter({ hasText: 'Page 1' }).waitFor();
      assert.equal(await count(), 2);
      await page.getByRole('button', { name: 'Next page', exact: true }).click();
      await page.locator('p[data-lr-status]').filter({ hasText: 'Page 2' }).waitFor();
      assert.equal(await count(), 5);
      assert.equal(await page.locator('.lr-line').first().getAttribute('data-row'), '3');
      for (const code of ['NOT_FOUND', 'LOAD_FAILED']) {
        await page.evaluate((code) => (window.failure = { code, message: 'test' }), code);
        await page.getByRole('button', { name: 'Previous page', exact: true }).click();
        await page.locator('p[data-lr-status]').filter({ hasText: 'Try again' }).waitFor();
        assert.equal(await count(), 5);
      }
      await page.evaluate(() => {
        window.failure = { name: 'AbortError' };
        window.before = say.length;
      });
      await page.getByRole('button', { name: 'Previous page', exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector('p[data-lr-status]').textContent === ''
      );
      assert.deepEqual(await page.evaluate(() => say.slice(before)), ['Loading reading page…']);
      assert.equal(await count(), 5);
      await page.evaluate(
        () => (window.failure = { code: 'DATA_CHANGED', message: 'revision changed' })
      );
      await page.getByRole('button', { name: 'Previous page', exact: true }).click();
      await page.locator('p[data-lr-status]').filter({ hasText: 'No text' }).waitFor();
      assert.equal(await count(), 0);
      assert.equal(
        await page.getByRole('button', { name: 'Previous page', exact: true }).isDisabled(),
        true
      );
      assert.equal(await page.locator('h2').evaluate((e) => e === document.activeElement), true);
      for (const field of [
        'row_start',
        'analysis_line_start',
        'normalized_cp_start',
        'normalized_utf16_start',
      ]) {
        await page.evaluate((field) => {
          handle.unmount();
          const bad = structuredClone(uneven.p);
          bad.start[field]++;
          if (field === 'analysis_line_start') bad.lines[0][4]++;
          window.handle = mod.mount(document.querySelector('main'), {
            ...makeCtx(),
            reading: async () => ({ head: uneven.h, loadPage: async () => bad }),
          });
        }, field);
        await page.locator('p[data-lr-status]').filter({ hasText: 'Page 1' }).waitFor();
        await page.getByRole('button', { name: 'Next page', exact: true }).click();
        await page.locator('p[data-lr-status]').filter({ hasText: 'No text' }).waitFor();
        assert.equal(await count(), 0);
      }
      // Late initial resolution and initial AbortError never resurrect/announce failure.
      await page.evaluate(() => {
        handle.unmount();
        window.handle = mod.mount(document.querySelector('main'), {
          ...makeCtx(),
          reading: () => new Promise((r) => (window.finishReading = r)),
        });
      });
      await page.evaluate(() => {
        handle.unmount();
        window.before = say.length;
        finishReading({ head: uneven.h, loadPage: async () => uneven.p });
      });
      assert.equal(await page.locator('link[rel=stylesheet]').count(), 0);
      assert.equal(await page.locator('.lr-text-view').count(), 0);
      assert.equal(await page.evaluate(() => say.length), await page.evaluate(() => before));
      await page.evaluate(() => {
        window.handle = mod.mount(document.querySelector('main'), {
          ...makeCtx(),
          reading: async () => {
            throw { name: 'AbortError' };
          },
        });
      });
      await page.waitForFunction(
        () => document.querySelector('p[data-lr-status]').textContent === ''
      );
      assert.equal(await count(), 0);
      for (const code of ['NOT_FOUND', 'LOAD_FAILED', 'DATA_CHANGED']) {
        await page.evaluate((code) => {
          handle.unmount();
          window.handle = mod.mount(document.querySelector('main'), {
            ...makeCtx(),
            reading: async () => {
              throw { code, message: 'test' };
            },
          });
        }, code);
        await page.waitForFunction(
          () => !document.querySelector('.lr-lines').getAttribute('aria-busy').includes('true')
        );
        assert.equal(await count(), 0);
      }
      assert.ok(await page.evaluate(() => writes.every(([key]) => key === 'text-size')));
      for (const fixture of realFixtures) {
        await page.evaluate(({ head, next }) => {
          handle.unmount();
          window.actual = { head, next };
          window.realCalls = [];
          window.handle = mod.mount(document.querySelector('main'), {
            unitId: head.reading_unit_id,
            reading: async () => ({
              head,
              loadPage: async (i) => {
                realCalls.push(i);
                return next;
              },
            }),
          });
        }, fixture);
        await page.locator('p[data-lr-status]').filter({ hasText: 'Page 1' }).waitFor();
        const shown = fixture.head.lines.filter((r) =>
          ['lyric', 'blank', 'structure'].includes(r[0])
        );
        assert.deepEqual(
          await page.locator('.lr-text').allTextContents(),
          shown.map((r) => r[1])
        );
        assert.equal(
          await page.locator('.lr-lines').getAttribute('dir'),
          fixture.head.direction || 'ltr'
        );
        await page.getByRole('button', { name: 'Source transcription', exact: true }).click();
        assert.deepEqual(
          await page.locator('.lr-text').allTextContents(),
          fixture.head.lines.map((r) => (r[6] == null ? r[1] : r[6]))
        );
        assert.deepEqual(await page.evaluate(() => realCalls), []);
        if (fixture.next) {
          await page.getByRole('button', { name: 'Next page', exact: true }).click();
          await page.locator('p[data-lr-status]').filter({ hasText: 'Page 2' }).waitFor();
          assert.deepEqual(
            await page.locator('.lr-text').allTextContents(),
            fixture.next.lines.map((r) => (r[6] == null ? r[1] : r[6]))
          );
          assert.deepEqual(await page.evaluate(() => realCalls), [1]);
          const decoded = await page.evaluate(() => mod.decodePage(actual.head, actual.next, 1)[0]);
          assert.equal(decoded.cpRange[0], fixture.next.start.normalized_cp_start + 1);
          assert.equal(decoded.row, fixture.next.start.row_start);
        }
        console.log(`PASS verified production ${fixture.name} ${width}px`);
      }
      await page.evaluate(() => {
        handle.unmount();
        window.host2 = document.createElement('aside');
        document.body.append(host2);
        window.first = mod.mount(document.querySelector('main'), makeCtx());
        window.second = mod.mount(host2, makeCtx());
      });
      assert.equal(await page.locator('link[rel=stylesheet]').count(), 2);
      await page.evaluate(() => first.unmount());
      assert.equal(await page.locator('link[rel=stylesheet]').count(), 1);
      assert.equal(await page.locator('aside .lr-text-view').count(), 1);
      await page.evaluate(() => {
        second.unmount();
        host2.remove();
      });
      assert.equal(await page.locator('link[rel=stylesheet]').count(), 0);
      await page.close();
      console.log(
        `PASS reading viewport ${width}px: rendering, source fallback, RTL, bounds, paging, astral offsets, failure, cleanup`
      );
    }
  } finally {
    await browser.close();
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
