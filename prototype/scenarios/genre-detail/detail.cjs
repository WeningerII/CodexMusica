#!/usr/bin/env node
'use strict';
// Standalone fixture proof, NOT shell integration or completion of rows 170/175/177/210.
// Run: CHROMIUM_PATH=/usr/bin/chromium node prototype/scenarios/genre-detail/detail.cjs
// --mutate=<name> serves an in-memory defect; each named mutation must fail.
// No CSS injection: the browser must request the real module-owned stylesheet.
// Frozen records emulate #668 6645861833: an abort ends the caller's wait,
// not the shared underlying read; aliases resolve to live record IDs. Tests also
// deliberately deliver stale completions. The shell loader and #748 overlay are
// not tested. The actual shell photo stub only announces unavailability and
// returns focus; fixture delegation checks do not establish lightbox integration.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const file = path.join(root, 'prototype/features/genre-detail/detail.js');
let source = fs.readFileSync(file, 'utf8');
const css = fs.readFileSync(file.replace(/\.js$/, '.css'), 'utf8');
// An older checkout may supply the pinned base shell CSS through this path.
// This is shell styling only; detail.css is always loaded by mount itself.
const shellCss = fs.readFileSync(
  process.env.GENRE_SHELL_CSS || path.join(root, 'prototype/proto.css'),
  'utf8'
);
const production = fs.readFileSync(path.join(root, 'src/pages/genre.js'), 'utf8');
const classification =
  'Where the catalog files this genre by musical practice. Classification is not a claim of historical descent.';
const description = 'The catalog has no description for this genre.';
const recordings =
  'Artists the catalog names as exemplars. Listen opens a YouTube search; the catalog does not cite individual recordings.';
const noRecordings =
  'The catalog names no exemplar artists for this genre. Listen opens a YouTube search for the genre itself.';
for (const sentence of [classification, description, recordings, noRecordings]) {
  assert.ok(production.includes(sentence), `production source contains ${sentence}`);
}
const mutations = {
  stale: ['ticket === generation;', 'true;'],
  signal: ['{ signal: controller.signal }', '{}'],
  style: ['host.append(stylesheet, root);', 'host.append(root);'],
  cleanup: ['stylesheet.remove();', ''],
  unsubscribe: ['unsubscribe?.();', ''],
  description: [description, 'There is no description.'],
  classification: [classification, 'Classification proves historical descent.'],
  photo: ['returnFocus: button', 'returnFocus: root'],
  credit: ['if (!photo) return;', 'if (!photo || !src) return;'],
  remote: ['const resolved = ctx.media.resolve(photo[0]);', 'const resolved = photo[0];'],
  focus: ['retry && doc.activeElement === focusTarget', 'retry'],
  'photo-error': ["box.querySelector('.pgd-photo-error')?.remove();", ''],
  alias: ['render(record, ticket);', 'if (record.id !== id) return; render(record, ticket);'],
};
const mutation = process.argv.find((x) => x.startsWith('--mutate='))?.slice(9);
if (mutation) {
  assert.ok(mutations[mutation], `known mutation: ${mutation}`);
  const [from, to] = mutations[mutation];
  assert.ok(source.includes(from), `mutation target exists: ${mutation}`);
  source = source.replace(from, to);
}

// Ground the real-photo fixture in the committed table, not an invented URL.
const photos = JSON.parse(fs.readFileSync(path.join(root, 'api/tradition_images.json'))).traditions;
const realPhoto = photos.bluegrass || Object.values(photos)[0];
assert.equal(realPhoto.length, 5);
const browse = JSON.parse(fs.readFileSync(path.join(root, 'api/browse.json')));
const retired = Object.entries(browse.aliases).find(
  ([id, entry]) => id !== entry.of && browse.items.some((item) => item.id === entry.of)
);
assert.ok(retired, 'committed catalog has a retired-to-live alias fixture');
const liveGenre = browse.items.find((item) => item.id === retired[1].of);
let styleRequests = 0;
const server = http.createServer((req, res) => {
  const send = (type, body, status = 200) => {
    res.writeHead(status, { 'Content-Type': type });
    res.end(body);
  };
  if (req.url === '/prototype/') {
    send(
      'text/html',
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Genre fixture</title><link rel="stylesheet" href="/shell.css"><h1 tabindex="-1">Genre</h1><button id="outside">Outside control</button><main id="host"></main><aside><button id="neighbor">Neighbor</button></aside></html>'
    );
  } else if (req.url === '/prototype/features/genre-detail/detail.js') {
    send('text/javascript', source);
  } else if (req.url === '/prototype/features/genre-detail/detail.css') {
    styleRequests++;
    send('text/css', css);
  } else if (req.url === '/shell.css') {
    send('text/css', shellCss);
  } else if (req.url === '/fixture.svg') {
    send(
      'image/svg+xml',
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#568"/></svg>'
    );
  } else send('text/plain', 'Fixture not found', 404);
});

async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  let checks = 0;
  const check = (value, message) => {
    assert.ok(value, message);
    checks++;
  };
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox'],
    });
    const context = await browser.newContext({ hasTouch: true, colorScheme: 'light' });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const offOrigin = [];
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        offOrigin.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(`${origin}/prototype/`);
    const neighborBefore = await page.locator('#neighbor').evaluate((el) => ({
      height: getComputedStyle(el).minHeight,
      color: getComputedStyle(el).color,
    }));
    await page.evaluate(async (remotePhoto) => {
      const mod = await import('./features/genre-detail/detail.js');
      const freeze = (value) => {
        if (value && typeof value === 'object') {
          Object.values(value).forEach(freeze);
          Object.freeze(value);
        }
        return value;
      };
      const f = (window.fixture = {
        module: mod,
        id: null,
        listeners: new Set(),
        calls: [],
        messages: [],
        opens: [],
        resolutions: [],
        unsubscribed: 0,
        controller: new AbortController(),
        record: freeze({
          id: 'a',
          name: 'Genre <script> & café',
          family: 'vernacular',
          lineage: 'A recorded lineage.',
          description: 'A complete catalog description.',
          exemplars: ['Artist one', ' ', 'Artist <two>'],
          status: 'documented',
          path: [
            { id: 'root', name: 'Root name' },
            { id: 'parent', name: 'Parent name' },
          ],
          place: { label: 'Rosine', region: 'Kentucky', provenance: { status: 'reviewed' } },
          photo: remotePhoto,
        }),
        freeze,
      });
      f.select = (id) => {
        f.id = id;
        for (const fn of f.listeners) fn();
      };
      f.ctx = Object.freeze({
        signal: f.controller.signal,
        storage: Object.freeze({
          read() {
            throw Error('Unexpected storage read');
          },
          write() {
            throw Error('Unexpected storage write');
          },
          remove() {
            throw Error('Unexpected storage remove');
          },
        }),
        announce: (text) => f.messages.push(text),
        genre: Object.freeze({
          current: () => f.id,
          subscribe(fn) {
            f.listeners.add(fn);
            return () => {
              f.unsubscribed++;
              f.listeners.delete(fn);
            };
          },
        }),
        loadGenre(id, { signal } = {}) {
          return new Promise((resolve, reject) => {
            const call = { id, signal, resolve, reject, cooperate: false };
            f.calls.push(call);
            signal?.addEventListener(
              'abort',
              () => {
                if (call.cooperate) reject(new DOMException('Canceled', 'AbortError'));
              },
              { once: true }
            );
          });
        },
        media: Object.freeze({
          resolve(url) {
            if (typeof url !== 'string') throw Error('Resolver received non-string');
            f.resolutions.push(url);
            return url.startsWith('fixture:')
              ? '/fixture.svg'
              : url === 'broken:'
                ? '/missing.svg'
                : null;
          },
        }),
        openPhoto(photo, options) {
          f.opens.push({ photo, options });
          if (f.rejectPhoto) return Promise.reject(Error('fixture error'));
        },
      });
      f.mount = () => {
        f.handle = mod.mount(document.getElementById('host'), f.ctx);
      };
      f.mount();
    }, realPhoto);
    await page.waitForFunction(() => document.querySelector('#host link[rel="stylesheet"]')?.sheet);
    check(styleRequests === 1, 'module requests its own stylesheet exactly once');
    check(
      await page.locator('.pgd').evaluate((el) => getComputedStyle(el).display === 'grid'),
      'module stylesheet has applied'
    );
    check(
      (await page.locator('.pgd').getAttribute('data-state')) === 'empty',
      'null selection is empty'
    );
    check(
      await page.evaluate(() => window.fixture.calls.length === 0),
      'null selection never loads'
    );
    await page.locator('#outside').focus();
    await page.evaluate(() => window.fixture.select('a'));
    check(
      (await page.locator('.pgd').getAttribute('aria-busy')) === 'true',
      'loading has busy state'
    );
    check(
      !(await page.locator('.pgd').innerText()).includes(description),
      'loading is not absence of description'
    );
    check(
      await page.evaluate(() => window.fixture.calls[0].signal instanceof AbortSignal),
      'load receives AbortSignal'
    );
    await page.evaluate(() => window.fixture.calls[0].resolve(window.fixture.record));
    await page.waitForFunction(() => document.querySelector('.pgd')?.dataset.state === 'ready');
    check(
      await page.locator('#outside').evaluate((el) => document.activeElement === el),
      'async completion does not steal focus'
    );
    check(
      (await page.locator('.pgd h2').textContent()) === 'Genre <script> & café',
      'name rendered as text'
    );
    check((await page.locator('.pgd script').count()) === 0, 'catalog text cannot inject markup');
    check(
      (await page.locator('.pgd-place').textContent()) === 'Rosine, Kentucky',
      'production place punctuation'
    );
    check(
      (await page.locator('.pgd-path').textContent()) === 'Root name › Parent name',
      'taxonomy order and names'
    );
    const content = await page.locator('.pgd').innerText();
    for (const sentence of [
      classification,
      recordings,
      'A complete catalog description.',
      'A recorded lineage.',
      'Catalog status: documented.',
    ])
      check(content.includes(sentence), sentence);
    check((await page.locator('.pgd-exemplars li').count()) === 2, 'blank exemplar filtered');
    check(
      (await page.locator('.pgd-listen a, .pgd-listen button').count()) === 0,
      'Listen entries have no action'
    );
    check(
      content.includes('Listen entries are plain text; YouTube searches are unavailable.'),
      'Listen difference disclosed'
    );
    check(
      (await page.locator('.pgd-unavailable').count()) === 1 &&
        (await page.locator('.pgd img').count()) === 0,
      'real remote photo is unavailable without img'
    );
    check(
      (await page.locator('.pgd-credit').innerText()) ===
        `Photo: ${realPhoto[2].replace(/\s+/g, ' ').trim()} · ${realPhoto[1].replace(/\s+/g, ' ').trim()}`,
      'unavailable remote photo retains exact normalized credit'
    );
    check(
      (await page.locator('.pgd-credit a').getAttribute('href')) === realPhoto[3],
      'attribution source preserved'
    );
    check(
      (await page.locator('.pgd-credit a').getAttribute('rel')) === 'noopener noreferrer',
      'source link safe rel'
    );
    check(
      (await page.locator('.pgd-credit a').getAttribute('target')) === '_blank',
      'source link new tab'
    );
    check(
      await page.evaluate(() => window.fixture.resolutions[0] === window.fixture.record.photo[0]),
      'resolver gets thumb URL string'
    );
    await page.evaluate(() => window.fixture.handle.focus());
    check(
      await page.locator('.pgd h2').evaluate((el) => el === document.activeElement),
      'explicit focus targets genre heading'
    );

    // A -> B -> A: force old completions despite abort. The first A resolves last.
    await page.evaluate(() => {
      const f = window.fixture;
      f.select('a');
      f.select('b');
      f.select('a');
      f.calls[3].resolve(f.freeze({ ...f.record, name: 'Newest A' }));
    });
    await page.waitForFunction(() => document.querySelector('.pgd h2')?.textContent === 'Newest A');
    check(
      await page.evaluate(
        () => window.fixture.calls[1].signal.aborted && window.fixture.calls[2].signal.aborted
      ),
      'superseded caller waits receive abort'
    );
    await page.evaluate(() => {
      const f = window.fixture;
      // Deliberately make the signal non-cooperative as well as the promise.
      // This isolates the generation guard from AbortController correctness.
      Object.defineProperty(f.calls[1].signal, 'aborted', { value: false });
      f.calls[1].resolve(f.freeze({ ...f.record, name: 'Stale A' }));
      f.calls[2].reject(Object.assign(Error('Stale B failure.'), { code: 'LOAD_FAILED' }));
    });
    check(
      (await page.locator('.pgd h2').textContent()) === 'Newest A',
      'stale A cannot overwrite new A'
    );
    check(
      await page.evaluate(() => window.fixture.messages.length === 0),
      'stale failure is silent'
    );

    async function load(record) {
      await page.evaluate((data) => {
        const f = window.fixture;
        f.select(data.id);
        f.calls.at(-1).resolve(f.freeze(data));
      }, record);
      await page.waitForFunction(() => document.querySelector('.pgd')?.dataset.state === 'ready');
    }
    const base = await page.evaluate(() => window.fixture.record);
    // A real retired alias must accept a different live record.id. Resolve two
    // requests for that alias out of order to prove identity isn't freshness.
    await page.evaluate(
      ({ alias, live }) => {
        const f = window.fixture;
        f.select(alias);
        f.aliasOld = f.calls.at(-1);
        f.select(null);
        f.select(alias);
        f.aliasNew = f.calls.at(-1);
        f.aliasLiveId = live.id;
        f.aliasNew.resolve(f.freeze({ ...f.record, id: live.id, name: live.name }));
      },
      { alias: retired[0], live: liveGenre }
    );
    check(
      (await page.locator('.pgd').getAttribute('data-state')) === 'ready',
      'retired alias accepts live record ID'
    );
    check(
      (await page.locator('.pgd h2').textContent()) === liveGenre.name,
      'retired alias displays live catalog name'
    );
    check(
      await page.evaluate(() => window.fixture.aliasOld.signal.aborted),
      'superseded alias caller wait receives abort'
    );
    await page.evaluate(() => {
      const f = window.fixture;
      Object.defineProperty(f.aliasOld.signal, 'aborted', { value: false });
      f.aliasOld.resolve(
        f.freeze({ ...f.record, id: f.aliasLiveId, name: 'Stale alias response' })
      );
    });
    check(
      (await page.locator('.pgd h2').textContent()) === liveGenre.name,
      'older alias completion cannot replace current live record'
    );
    await load({
      ...base,
      description: '',
      lineage: '',
      path: [],
      exemplars: [],
      status: null,
      place: null,
      photo: null,
    });
    const sparse = await page.locator('.pgd').innerText();
    check(
      sparse.includes(description) && sparse.includes(noRecordings),
      'exact empty catalog fallbacks'
    );
    check(
      !sparse.includes('Lineage') && !sparse.includes('Catalog status:'),
      'absent lineage and status omitted'
    );
    check(
      (await page.locator('.pgd-path, .pgd-place, .pgd-credit').count()) === 0,
      'absent path/place/photo does not invent metadata'
    );

    await load({
      ...base,
      photo: ['fixture:thumb', ' CC0 ', ' Fixture   Author ', 'javascript:bad()', 1],
    });
    await page.waitForFunction(() => document.querySelector('.pgd img')?.naturalWidth === 160);
    check(
      (await page.locator('.pgd-credit').innerText()) ===
        'Photo: Fixture Author · CC0\nSource: javascript:bad()',
      'credit normalized; invalid source remains text'
    );
    check((await page.locator('.pgd-credit a').count()) === 0, 'unsafe source is not a link');
    const button = page.getByRole('button', {
      name: 'Enlarge photo of Genre <script> & café',
      exact: true,
    });
    for (const method of ['click', 'Enter', 'Space', 'tap']) {
      if (method === 'click') await button.click();
      else if (method === 'tap') await button.tap();
      else {
        await button.focus();
        await page.keyboard.press(method);
      }
    }
    check(
      await page.evaluate(() => window.fixture.opens.length === 4),
      'click/Enter/Space/touch delegate'
    );
    check(
      await page.evaluate(() =>
        window.fixture.opens.every(
          (x) =>
            x.options.returnFocus === document.querySelector('.pgd-photo') &&
            x.options.label === window.fixture.record.name
        )
      ),
      'exact returnFocus and label supplied'
    );
    check(
      await page.evaluate(() =>
        window.fixture.opens.every((x) => Object.isFrozen(x.photo) && x.photo[4] === 1)
      ),
      'original frozen five-tuple passed; sentinel retained'
    );
    await page.evaluate(() => {
      window.fixture.rejectPhoto = true;
    });
    await button.click();
    check(
      (await page.locator('.pgd-photo-error').innerText()) ===
        'The photo could not open. Try again.',
      'photo callback failure actionable'
    );
    await page.evaluate(() => {
      window.fixture.rejectPhoto = false;
    });
    await button.click();
    check(
      (await page.locator('.pgd-photo-error').count()) === 0,
      'successful photo retry clears old failure'
    );
    check(
      await button.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44;
      }),
      'photo keyboard/touch target at least 44px'
    );
    await button.focus();
    await page.locator('.pgd img').dispatchEvent('error');
    check(
      await page.locator('.pgd-unavailable').evaluate((el) => el === document.activeElement),
      'image failure recovers focused trigger'
    );
    check(
      (await page.locator('.pgd-photo').count()) === 0 &&
        (await page.locator('.pgd-credit').count()) === 1,
      'failed image removes action and retains credit'
    );
    await load({ ...base, photo: ['broken:', '', '', '', 1] });
    await page.waitForSelector('.pgd-unavailable');
    check(
      (await page.locator('.pgd-credit').innerText()) ===
        'Photo: Author not recorded · licence not recorded',
      'production missing credit fallbacks'
    );

    // Errors are not empty catalog fields; retry restores intentional focus.
    await page.evaluate(() => {
      const f = window.fixture;
      f.select('failure');
      f.calls.at(-1).reject(
        Object.assign(Error('The catalog did not load. Check your connection, then try again.'), {
          code: 'LOAD_FAILED',
        })
      );
    });
    const retry = page.getByRole('button', { name: 'Retry loading genre details' });
    await retry.waitFor();
    check(
      (await page.locator('.pgd').innerText()).includes(
        'The catalog did not load. Check your connection, then try again.'
      ),
      'shell error message preserved'
    );
    await retry.click();
    check(
      await page.locator('.pgd-note').evaluate((el) => el === document.activeElement),
      'retry focuses loading note'
    );
    await page.evaluate(() =>
      window.fixture.calls
        .at(-1)
        .reject(Object.assign(Error('Still unavailable. Try again.'), { code: 'LOAD_FAILED' }))
    );
    await retry.waitFor();
    check(
      await retry.evaluate((el) => el === document.activeElement),
      'failed retry returns focus to retry'
    );
    await retry.click();
    await page.evaluate(() => window.fixture.calls.at(-1).resolve(window.fixture.record));
    await page.waitForSelector('.pgd h2');
    check(
      await page.locator('.pgd h2').evaluate((el) => el === document.activeElement),
      'successful retry focuses heading'
    );
    for (const outcome of ['resolve', 'reject']) {
      await page.evaluate(() => {
        const f = window.fixture;
        f.select('retry-away');
        f.calls.at(-1).reject(Object.assign(Error('Failed. Try again.'), { code: 'LOAD_FAILED' }));
      });
      await retry.click();
      await page.locator('#outside').focus();
      await page.evaluate((result) => {
        const f = window.fixture;
        if (result === 'resolve') f.calls.at(-1).resolve(f.record);
        else
          f.calls
            .at(-1)
            .reject(Object.assign(Error('Failed again. Try again.'), { code: 'LOAD_FAILED' }));
      }, outcome);
      check(
        await page.locator('#outside').evaluate((el) => el === document.activeElement),
        `retry ${outcome} respects focus moved away during loading`
      );
    }
    await page.evaluate(() => {
      const f = window.fixture;
      f.select('missing');
      f.calls.at(-1).reject(
        Object.assign(Error('This genre is not in the catalog. Choose another genre.'), {
          code: 'NOT_FOUND',
        })
      );
    });
    await page.waitForFunction(() => document.querySelector('.pgd')?.dataset.state === 'error');
    check(
      (await page.locator('.pgd button').count()) === 0,
      'NOT_FOUND directs selection, no ineffective retry'
    );
    await page.evaluate(() => {
      const f = window.fixture;
      f.select('abort');
      f.calls.at(-1).reject(new DOMException('Canceled', 'AbortError'));
    });
    await retry.waitFor();
    check(
      (await page.locator('.pgd').getAttribute('data-state')) === 'canceled',
      'unexpected current AbortError is recoverable'
    );
    await page.evaluate(() => {
      const f = window.fixture;
      f.select('clear');
      f.calls.at(-1).cooperate = true;
      f.select(null);
    });
    check(
      (await page.locator('.pgd').getAttribute('data-state')) === 'empty',
      'clear selection ends caller wait and shows empty state'
    );

    // Responsive CSS, touch targets, no neighboring styles, reduced motion.
    await load({ ...base, name: 'Long'.repeat(150), description: 'Word'.repeat(300) });
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `no horizontal overflow at ${width}`
      );
      check(
        await page
          .locator('.pgd-credit a')
          .evaluate((el) => el.getBoundingClientRect().height >= 44),
        `attribution touch target at ${width}`
      );
    }
    const lightColor = await page.locator('.pgd').evaluate((el) => getComputedStyle(el).color);
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    check(
      await page
        .locator('.pgd')
        .evaluate(
          (el) => getComputedStyle(el).color !== getComputedStyle(document.body).backgroundColor
        ),
      'dark theme text differs from background'
    );
    check(
      await page
        .locator('.pgd')
        .evaluate((el) => getComputedStyle(el).color === getComputedStyle(document.body).color),
      'dark theme inherits shell foreground'
    );
    check(
      await page
        .locator('.pgd-header')
        .evaluate(
          (el) =>
            getComputedStyle(el).backgroundColor === getComputedStyle(document.body).backgroundColor
        ),
      'dark header uses shell background'
    );
    check(
      (await page.locator('.pgd').evaluate((el) => getComputedStyle(el).color)) !== lightColor,
      'light/dark shell tokens actually change module color'
    );
    check(
      await page.locator('.pgd').evaluate((el) => getComputedStyle(el).animationName === 'none'),
      'no required motion'
    );
    await page.emulateMedia({ colorScheme: 'light' });
    assert.deepEqual(
      await page.locator('#neighbor').evaluate((el) => ({
        height: getComputedStyle(el).minHeight,
        color: getComputedStyle(el).color,
      })),
      neighborBefore,
      'module CSS does not style neighboring host'
    );
    checks++;
    check(
      await page.evaluate(() => window.fixture.listeners.size === 1),
      'one subscription after all selections'
    );
    await page.evaluate(() => {
      const host = document.getElementById('host');
      host.hidden = true;
      host.hidden = false;
    });
    check(
      await page.evaluate(() => window.fixture.listeners.size === 1),
      'hide/show keeps subscription and view'
    );
    await page.evaluate(() => {
      const f = window.fixture;
      f.select('late');
      f.controller.abort();
      f.calls.at(-1).resolve(f.record);
      f.handle.unmount();
      f.handle.focus();
    });
    check(
      (await page.locator('#host').innerHTML()) === '',
      'abort removes root AND module stylesheet'
    );
    check(
      await page.evaluate(
        () => window.fixture.unsubscribed === 1 && window.fixture.listeners.size === 0
      ),
      'unsubscribe once even after repeated cleanup'
    );
    check(
      await page.evaluate(() => window.fixture.calls.at(-1).signal.aborted),
      'teardown sends abort to in-flight caller wait'
    );
    await page.evaluate(() => window.fixture.mount());
    check(
      (await page.locator('#host').innerHTML()) === '',
      'mount with already aborted signal does nothing'
    );
    check(
      await page.evaluate(() => window.fixture.unsubscribed === 1),
      'aborted mount does not subscribe'
    );
    check(offOrigin.length === 0, `no off-origin requests: ${offOrigin.join(', ')}`);
    check(errors.length === 0, `no page errors: ${errors.join(', ')}`);
    console.log(`genre-detail: ${checks} checks passed (standalone fixture; rows remain pending).`);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
