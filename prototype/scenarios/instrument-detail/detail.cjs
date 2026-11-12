// Standalone lane harness; does not establish #755 shell or #748 overlay parity.
// Self-contained recorded fixtures; synthetic local photos/glyphs exercise wiring only.
// Catalog snapshot: fd16719d46217adc9b57ef939c9497e29e77741c.
// api/instruments/{id}.json: scripts/build_static_api.js main() writes
// scripts/_api_contract.js stripExpandedVariants(inst). Only fields used here
// are retained; no renderer is executed by this scenario.
// Record blobs: oud 29e26ab50962daf006fe6599614bfb5df61ea3f5;
// accordina d37cee03575e45a9697336c6b0b16e2351db2e6b;
// credited_auxiliary_percussion c14822037562ffb901aa454b3c5d556f7e9f8fab.
// Photo tuples: scripts/_image_tables.js compactInstrumentImages(), written by
// build_static_api.js main() to api/instrument_images.json, blob
// d0386633dec52cb64a388adbdbe7ec28382b547f at the same snapshot.
// Labels follow references/02_instruments.js INSTRUMENT_FAMILIES and production
// src/pages/instrument.js ipHuman(). The described fixture deliberately overlays
// prose onto Oud's identity shape to prove prose is ignored, not family parity.
// Current catalog/adapter/glyph parity belongs to Don's shared gates.
/* global fixture, control, feature */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '../../..');
const featurePath = 'prototype/features/instrument-detail/detail.js';
const photos = {
  oud: [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/%C5%AAd_MET_DP340079.jpg/500px-%C5%AAd_MET_DP340079.jpg',
    'CC0',
    'Creator:Manol (Emmanuel Venios)',
    'https://commons.wikimedia.org/wiki/File:%C5%AAd_MET_DP340079.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/9/92/%C5%AAd_MET_DP340079.jpg',
  ],
  accordina: [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Shure_SM58.jpg/250px-Shure_SM58.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
    'CC BY 2.5 Generic',
    'Iain Fergusson; existing crop by Binksternet, Shure SM58.jpg, Wikimedia Commons, CC BY 2.5 Generic',
    'https://commons.wikimedia.org/wiki/File:Shure_SM58.jpg',
  ],
};
const oud = {
  id: 'oud',
  name: 'ʿŪd (Arab/Mediterranean fretless lute)',
  short: 'oud',
  family: 'plucked_traditional',
  class: 'plucked_string_lead',
};
const accordina = {
  id: 'accordina',
  name: 'Accordina',
  short: 'Accordina',
  family: 'free_reed',
  class: 'accordina',
};
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="12"/></svg>';
const records = {
  oud: {
    id: oud.id,
    name: oud.name,
    short: oud.short,
    family: { id: oud.family, name: 'Plucked traditional' },
    class: { id: oud.class, name: 'Plucked string lead' },
    photo: photos.oud,
    glyphUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
  },
  accordina: {
    id: accordina.id,
    name: accordina.name,
    short: accordina.short,
    family: { id: accordina.family, name: 'Free reed' },
    class: {
      id: accordina.class,
      name: accordina.class.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()),
    },
    photo: photos.accordina,
    glyphUrl: null,
  },
};
const described = {
  id: 'credited_auxiliary_percussion',
  name: 'Credited auxiliary percussion (source unspecified)',
  short: 'Unspecified credited percussion',
  description:
    'Data owner for a positively credited auxiliary percussion role whose source does not identify the instrument family or playing mechanism. No drum, shaker, tambourine, construction, material or technique is inferred. Neutral axes are authored routing coordinates, not measured acoustic facts.',
  sources: [
    'https://mencho.bandcamp.com/album/interiores',
    'https://www.wuwm.com/arts-culture/2023-06-23/muna-tiny-desk-concert',
  ],
};
records.described = {
  ...records.oud,
  id: described.id,
  name: described.name,
  short: described.short,
  description: described.description,
  sources: described.sources,
  photo: null,
  glyphUrl: null,
};
// Recorded from prototype/data.js INSTRUMENT_MESSAGES / instrumentFail(),
// consumed by instrumentLoader(), at #755 241718b1157540c2c6db669cf2b01e3f15da569c
// (data.js blob 14c98a6741c90a806ef2496c0f30abf45653334a).
// Historical qualification executed the real adapter's NOT_FOUND and HTTP503
// LOAD_FAILED errors. Its two source-oracle assertions are intentionally removed
// here; the two rendering assertions remain below using these recorded errors.
// This hermetic scenario does not rerun that adapter qualification.
const messages = {
  NOT_FOUND: 'This instrument isn’t in the catalog’s data. Reload to see the current catalog.',
  LOAD_FAILED: 'This instrument’s details couldn’t load. Check your connection, then try again.',
};
const mutation = process.env.INSTRUMENT_MUTATION || '';
const mutations = {
  guidance: ['? error.message', '? fallback'],
  fallback: ['Reload to see the current catalog.', 'Select another instrument.'],
  html: ['el.textContent = text;', 'el.innerHTML = text;'],
  css: ['host.append(sheet, root);', 'host.append(root);'],
  stale: ['disposed || seq !== generation', 'disposed'],
  credit: ["photo[2] || 'uncredited'", "photo[1] || 'uncredited'"],
  unsubscribe: ['unsubscribe();', '/* removed unsubscribe */'],
  mediaCleanup: [
    'events.abort();\n    events = new AbortController();',
    'events = new AbortController();',
  ],
  focus: ['moveFocus && doc.activeElement === loading', 'moveFocus'],
  remote: ['const src = ctx.media.resolve(photo[0]);', 'const src = photo[0];'],
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button id="outside">Outside</button><h1 tabindex="-1" style="overflow-wrap:anywhere">Instrument</h1><div id="one"></div><div id="two"></div></body></html>'
    );
  } else if (url.pathname === '/local.svg') {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.end(svg);
  } else if (
    [`/${featurePath}`, '/prototype/features/instrument-detail/detail.css'].includes(url.pathname)
  ) {
    let body = fs.readFileSync(path.join(repo, url.pathname.slice(1)), 'utf8');
    if (url.pathname.endsWith('.js') && mutation) {
      const [from, to] = mutations[mutation] || [];
      assert.ok(from && body.includes(from), `mutation ${mutation} must apply`);
      body = body.replaceAll(from, to);
    }
    res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
    res.end(body);
  } else {
    res.statusCode = 404;
    res.end();
  }
});
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  const page = await browser.newPage({ hasTouch: true });
  const outsideRequests = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (!url.startsWith(origin) && !url.startsWith('data:')) {
      outsideRequests.push(url);
      return route.abort();
    }
    return route.continue();
  });
  try {
    await page.goto(origin);
    await page.evaluate(
      async ({ records, featurePath, messages }) => {
        window.feature = await import('/' + featurePath);
        const freeze = (value) => {
          if (value && typeof value === 'object') {
            Object.values(value).forEach(freeze);
            Object.freeze(value);
          }
          return value;
        };
        Object.values(records).forEach(freeze);
        window.fixture = records;
        window.control = { messages };
        window.control.create = (hostId, initial) => {
          let value = initial;
          const listeners = new Set();
          const abort = new AbortController();
          const calls = [],
            pending = [],
            announcements = [],
            opens = [];
          const c = {
            listeners,
            abort,
            calls,
            pending,
            announcements,
            opens,
            slow: false,
            fail: null,
            select(id) {
              value = id;
              for (const fn of listeners) fn();
            },
          };
          const ctx = Object.freeze({
            signal: abort.signal,
            storage: Object.freeze({}),
            announce: (text) => announcements.push(text),
            instrument: Object.freeze({
              current: () => value,
              subscribe(fn) {
                listeners.add(fn);
                return () => listeners.delete(fn);
              },
            }),
            loadInstrument(id, { signal }) {
              calls.push({ id, signal });
              if (c.slow)
                return new Promise((resolve, reject) => pending.push({ id, resolve, reject })); // deliberately ignores abort
              if (c.rejectRaw) return Promise.reject(c.rawError);
              if (c.fail)
                return Promise.reject(Object.assign(new Error(messages.LOAD_FAILED), c.fail));
              return fixture[id]
                ? Promise.resolve(fixture[id])
                : Promise.reject(
                    Object.assign(new Error(messages.NOT_FOUND), { code: 'NOT_FOUND' })
                  );
            },
            media: Object.freeze({ resolve: (url) => (url === '/local.svg' ? url : null) }),
            openPhoto(photo, options) {
              opens.push({ photo, label: options.label, returnFocus: options.returnFocus });
              options.returnFocus.focus();
            },
          });
          c.handle = feature.mount(document.getElementById(hostId), ctx);
          return c;
        };
        control.one = control.create('one', null);
      },
      { records, featurePath, messages }
    );
    const heading = page.locator('#one h2');
    await heading.filter({ hasText: 'Select an instrument' }).waitFor();
    assert.equal(await page.locator('#one link').count(), 1, 'module owns stylesheet');
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('.instrument-detail')).padding === '16px'
    );
    await page.locator('#outside').focus();
    await page.evaluate(() => control.one.select('oud'));
    await heading.filter({ hasText: oud.name }).waitFor();
    assert.equal(await page.locator('#one code').textContent(), 'oud');
    assert.equal(
      await page.locator('#one .instrument-detail-class').textContent(),
      'Plucked traditional › Plucked string lead'
    );
    assert.equal(
      await page.locator('#one .instrument-detail-credit').textContent(),
      `Photo: ${photos.oud[2]} · ${photos.oud[1]}`,
      'credit tuple order'
    );
    assert.equal(await page.locator('#one img').getAttribute('alt'), '');
    assert.equal(await page.locator('#one svg').count(), 0, 'no SVG markup injection');
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'outside',
      'async selection must not steal focus'
    );
    await page.locator('#one .instrument-detail-note').waitFor();
    assert.equal(
      await page.locator('#one a').getAttribute('href'),
      photos.oud[3],
      'exact source link'
    );
    assert.equal(await page.locator('#one a').getAttribute('rel'), 'noopener noreferrer');
    assert.equal(await page.locator('#one a').getAttribute('target'), '_blank');
    await page.evaluate(() => control.one.select('described'));
    await heading.filter({ hasText: described.name }).waitFor();
    assert.equal(
      (await page.locator('#one').textContent()).includes(described.description),
      false,
      'no Background prose'
    );
    assert.equal(await page.locator('#one img').count(), 0, 'null photo and glyph');

    await page.evaluate(() => {
      control.two = control.create('two', 'accordina');
    });
    await page.locator('#two h2').filter({ hasText: accordina.name }).waitFor();
    assert.equal(await page.locator('#two img').count(), 0, 'null glyph stays absent');
    assert.equal(
      await page.locator('#two .instrument-detail-credit').textContent(),
      `Photo: ${photos.accordina[2]} · ${photos.accordina[1]}`
    );
    await page.evaluate(() => {
      fixture.local = {
        ...fixture.oud,
        photo: ['/local.svg', '', '', 'javascript:alert(1)'],
        glyphUrl: null,
      };
      control.one.select('local');
    });
    const photo = page.locator('#one button');
    await photo.waitFor();
    await photo.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => control.one.opens.length), 2, 'keyboard activation');
    assert.equal(
      await page.evaluate(() => control.one.opens[0].returnFocus === document.activeElement),
      true
    );
    assert.equal(await page.locator('#one a').count(), 0, 'unsafe credit link omitted');
    assert.equal(
      await page.locator('#one .instrument-detail-credit').textContent(),
      'Photo: uncredited · licence not stated'
    );
    await page.evaluate(() => {
      control.oldPhoto = document.querySelector('#one button img');
      control.one.select('accordina');
    });
    await heading.filter({ hasText: accordina.name }).waitFor();
    await page.evaluate(() => control.oldPhoto.dispatchEvent(new Event('error')));
    assert.equal(
      await page.locator('#one .instrument-detail-note').count(),
      1,
      'detached photo error cannot alter new selection'
    );
    await page.evaluate(() => control.one.select('local'));
    await photo.waitFor();
    await photo.tap();
    assert.equal(await page.evaluate(() => control.one.opens.length), 3, 'touch activation');
    await photo.focus();
    await page.locator('#one button img').evaluate((img) => img.dispatchEvent(new Event('error')));
    assert.equal(await page.locator('#one button').count(), 0, 'failed photo removes activation');
    assert.equal(
      await page.evaluate(() => document.activeElement.tagName),
      'H2',
      'failed focused photo recovers focus'
    );
    await page.evaluate(() => control.one.select('local'));
    await photo.waitFor();
    const box = await photo.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, 'touch target');
    await page.evaluate(() => {
      control.one.slow = true;
      control.one.select('oud');
      control.one.select('accordina');
      control.one.pending[1].resolve(fixture.accordina);
    });
    await heading.filter({ hasText: accordina.name }).waitFor();
    await page.evaluate(() => control.one.pending[0].resolve(fixture.oud));
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(await heading.textContent(), accordina.name, 'stale A must not replace B');
    assert.equal(
      await page.evaluate(() => control.one.calls.at(-2).signal.aborted),
      true,
      'old caller aborted'
    );
    await page.evaluate(() => {
      control.one.select('oud');
      control.one.select(null);
      control.one.pending.at(-1).resolve(fixture.oud);
    });
    await heading.filter({ hasText: 'Select an instrument' }).waitFor();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(
      await heading.textContent(),
      'Select an instrument',
      'clear during pending load stays empty'
    );
    await page.evaluate(() => {
      control.one.slow = false;
      control.one.select('unknown');
    });
    await heading.filter({ hasText: 'isn’t in the catalog' }).waitFor();
    assert.equal(await heading.textContent(), messages.NOT_FOUND, 'full NOT_FOUND guidance');
    for (const code of ['NOT_FOUND', 'LOAD_FAILED']) {
      await page.evaluate(
        (error) => {
          control.one.fail = error;
          control.one.select('oud');
        },
        { code, message: messages[code] }
      );
      await page.waitForFunction(
        () => !document.querySelector('#one .instrument-detail').hasAttribute('aria-busy')
      );
      assert.equal(
        await heading.textContent(),
        messages[code],
        'preserve recorded adapter ' + code
      );
    }
    for (const code of ['NOT_FOUND', 'LOAD_FAILED']) {
      for (const payload of ['', '   ', null, 7, {}, []]) {
        await page.evaluate(
          ({ code, payload }) => {
            control.one.fail = { code, message: payload };
            control.one.select('oud');
          },
          { code, payload }
        );
        await page.waitForFunction(
          () => !document.querySelector('#one .instrument-detail').hasAttribute('aria-busy')
        );
        assert.equal(
          await heading.textContent(),
          messages[code],
          'malformed message fallback ' + code
        );
      }
    }
    for (const rawError of [
      null,
      undefined,
      'raw exception',
      { code: 'OTHER', message: 'private diagnostic' },
    ]) {
      await page.evaluate((rawError) => {
        control.one.rejectRaw = true;
        control.one.rawError = rawError;
        control.one.select('oud');
      }, rawError);
      await page.waitForFunction(
        () => !document.querySelector('#one .instrument-detail').hasAttribute('aria-busy')
      );
      assert.equal(await heading.textContent(), messages.LOAD_FAILED, 'malformed error fallback');
    }
    await page.evaluate(() => {
      control.one.rejectRaw = false;
    });
    const literal = 'Keep this guidance: <strong>Reload & retry</strong>.';
    await page.evaluate((message) => {
      control.one.fail = { code: 'LOAD_FAILED', message };
      control.one.select('oud');
    }, literal);
    await page.waitForFunction(
      () => !document.querySelector('#one .instrument-detail').hasAttribute('aria-busy')
    );
    assert.equal(await heading.textContent(), literal, 'supplied guidance preserved verbatim');
    assert.equal(await heading.locator('strong').count(), 0, 'guidance is text, not markup');
    await page.evaluate(() => {
      control.one.fail = null;
      control.one.slow = true;
      control.one.select('oud');
      control.one.select('accordina');
      control.one.pending.at(-1).resolve(fixture.accordina);
    });
    await heading.filter({ hasText: accordina.name }).waitFor();
    const announcements = await page.evaluate(() => control.one.announcements.length);
    await page.evaluate(() =>
      control.one.pending.at(-2).reject({ code: 'LOAD_FAILED', message: 'Stale guidance' })
    );
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(
      await heading.textContent(),
      accordina.name,
      'stale error cannot replace selection'
    );
    assert.equal(
      await page.evaluate(() => control.one.announcements.length),
      announcements,
      'stale error stays silent'
    );
    await page.evaluate(() => {
      control.one.slow = false;
    });

    await page.evaluate(() => {
      control.one.fail = { code: 'LOAD_FAILED' };
      control.one.select('oud');
    });
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    await page.evaluate(() => {
      control.one.fail = null;
    });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await heading.filter({ hasText: oud.name }).waitFor();
    assert.equal(
      await page.evaluate(() => document.activeElement.tagName),
      'H2',
      'retry success focus'
    );
    await page.evaluate(() => {
      control.one.fail = { code: 'LOAD_FAILED' };
      control.one.select('oud');
    });
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    await page.evaluate(() => {
      control.one.fail = null;
      control.one.slow = true;
    });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.locator('#outside').focus();
    await page.evaluate(() => {
      control.one.pending.at(-1).resolve(fixture.oud);
      control.one.slow = false;
    });
    await heading.filter({ hasText: oud.name }).waitFor();
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'outside',
      'retry must not steal focus after user leaves'
    );
    await page.evaluate(() => {
      control.one.fail = { name: 'AbortError' };
      control.one.select('accordina');
    });
    await heading.filter({ hasText: 'cancelled' }).waitFor();
    await page.evaluate(() => {
      control.one.fail = null;
      control.one.select('oud');
    });
    await heading.filter({ hasText: oud.name }).waitFor();
    for (const width of [320, 390, 1280, 160]) {
      await page.setViewportSize({ width, height: 800 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        `reflow ${width}`
      );
    }
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      '200% text'
    );
    for (const colorScheme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      assert.equal(
        await page.evaluate(
          () => getComputedStyle(document.querySelector('.instrument-detail')).animationName
        ),
        'none'
      );
    }
    await page.evaluate(() => {
      control.one.slow = true;
      control.one.select('oud');
      control.one.abort.abort();
      control.one.pending.at(-1).resolve(fixture.oud);
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(await page.locator('#one > *').count(), 0, 'abort removes owned DOM and CSS');
    assert.equal(
      await page.evaluate(() => control.one.listeners.size),
      0,
      'unsubscribe on teardown'
    );
    assert.equal(await page.locator('#two link').count(), 1, 'other host stylesheet survives');
    await page.evaluate(() => {
      control.two.handle.unmount();
      control.two.handle.unmount();
    });
    assert.equal(await page.locator('#two > *').count(), 0);
    assert.deepEqual(outsideRequests, [], 'no remote image requests');
    assert.deepEqual(errors, [], 'no browser errors');
    console.log(
      'Instrument detail: identity, media, lifecycle, stale selection, errors and reflow passed. Shell #755 and overlay #748 unverified.'
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
