// Standalone contract scenario, NOT real-shell/Browse integration. Rows 170/171
// remain partial/pending. Navigation callbacks deliberately only announce.
// Run: CHROMIUM_PATH=/usr/bin/chromium node prototype/scenarios/genre-sound/sound.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const FEATURE = path.resolve(__dirname, '../../features/genre-sound');
const source = (file) => fs.readFileSync(path.join(FEATURE, file), 'utf8');
// Frozen-context fixtures derived at e736f53404b13491fbb22f1570d4e4f178faa49d:
// scripts/_browse_tables.js browseItem + Catalog.bootFromIndex produced the
// named axes below; AXIS_DEFINITIONS supplied the ordered endpoint vocabulary.
// gpSoundProfile + axisLabel produced the expected labels/values captured below.
// Catalog.resolve maps the real retired bluegrass_fiddle alias to bluegrass.
// These are historical fixture oracles, not a current-production parity check.
// Current parity belongs to Don's hosts/engine/lanes gates. Missing-value and
// race cases below remain explicit fault injections, not new catalog records.
const definitions = [
  {
    id: 'harm',
    name: 'Harmonic logic',
    neg: 'modal / drone-tonic',
    pos: 'functional progression',
  },
  {
    id: 'pitch',
    name: 'Pitch system',
    neg: 'fixed equal-tempered',
    pos: 'flexible / microtonal',
  },
  {
    id: 'ornament',
    name: 'Melodic ornament',
    neg: 'plain',
    pos: 'heavily ornamented',
  },
  {
    id: 'meter',
    name: 'Meter',
    neg: 'free / rubato',
    pos: 'strict isochronous',
  },
  {
    id: 'density',
    name: 'Density',
    neg: 'sparse',
    pos: 'dense polyphonic',
  },
  {
    id: 'transmission',
    name: 'Transmission',
    neg: 'notated',
    pos: 'oral',
  },
  {
    id: 'improv',
    name: 'Real-time generativity',
    neg: 'fixed',
    pos: 'improvised',
  },
  {
    id: 'soundTech',
    name: 'Sound technology',
    neg: 'acoustic',
    pos: 'processed / synthesized',
  },
  {
    id: 'intensity',
    name: 'Perceptual intensity',
    neg: 'meditative',
    pos: 'cathartic',
  },
  {
    id: 'voice',
    name: 'Voice centrality',
    neg: 'instrumental',
    pos: 'vocally driven',
  },
  {
    id: 'timbre',
    name: 'Timbral grain',
    neg: 'clean / smooth',
    pos: 'rough / distorted',
  },
  {
    id: 'percussion',
    name: 'Percussion role',
    neg: 'absent',
    pos: 'foreground / metric',
  },
  {
    id: 'cyclicity',
    name: 'Formal cyclicity',
    neg: 'through-composed',
    pos: 'cyclical / strophic',
  },
];
const records = {
  bluegrass: {
    id: 'bluegrass',
    name: 'Bluegrass',
    values: [1, 1, 1, 2, 1, 1, 1, -2, 1, 1, 1, -1, 2],
  },
  delta_blues: {
    id: 'delta_blues',
    name: 'Delta blues',
    values: [1, 1, 1, 0, -1, 1, 1, -2, 1, 2, 2, -1, 2],
  },
  techno: {
    id: 'techno',
    name: 'Techno',
    values: [0, -1, 0, 1, 0, -1, 0, 2, 1, -2, 1, 2, 2],
  },
  bornesange: {
    id: 'bornesange',
    name: 'Bornesange',
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
};
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const fixtures = freeze(
  Object.fromEntries(
    Object.entries(records).map(([id, row]) => [
      id,
      {
        id: row.id,
        name: row.name,
        definitions,
        axes: definitions.map((axis, i) => ({ id: axis.id, value: row.values[i], recorded: true })),
      },
    ])
  )
);
const expected = freeze({
  bluegrass: {
    labels: [
      'Harmonic logic: leans functional progression (+1 from −2 modal / drone-tonic to +2 functional progression)',
      'Pitch system: leans flexible / microtonal (+1 from −2 fixed equal-tempered to +2 flexible / microtonal)',
      'Melodic ornament: leans heavily ornamented (+1 from −2 plain to +2 heavily ornamented)',
      'Meter: strict isochronous (+2 from −2 free / rubato to +2 strict isochronous)',
      'Density: leans dense polyphonic (+1 from −2 sparse to +2 dense polyphonic)',
      'Transmission: leans oral (+1 from −2 notated to +2 oral)',
      'Real-time generativity: leans improvised (+1 from −2 fixed to +2 improvised)',
      'Sound technology: acoustic (-2 from −2 acoustic to +2 processed / synthesized)',
      'Perceptual intensity: leans cathartic (+1 from −2 meditative to +2 cathartic)',
      'Voice centrality: leans vocally driven (+1 from −2 instrumental to +2 vocally driven)',
      'Timbral grain: leans rough / distorted (+1 from −2 clean / smooth to +2 rough / distorted)',
      'Percussion role: leans absent (-1 from −2 absent to +2 foreground / metric)',
      'Formal cyclicity: cyclical / strophic (+2 from −2 through-composed to +2 cyclical / strophic)',
    ],
    values: [
      'leans functional progression',
      'leans flexible / microtonal',
      'leans heavily ornamented',
      'strict isochronous',
      'leans dense polyphonic',
      'leans oral',
      'leans improvised',
      'acoustic',
      'leans cathartic',
      'leans vocally driven',
      'leans rough / distorted',
      'leans absent',
      'cyclical / strophic',
    ],
  },
  delta_blues: {
    labels: [
      'Harmonic logic: leans functional progression (+1 from −2 modal / drone-tonic to +2 functional progression)',
      'Pitch system: leans flexible / microtonal (+1 from −2 fixed equal-tempered to +2 flexible / microtonal)',
      'Melodic ornament: leans heavily ornamented (+1 from −2 plain to +2 heavily ornamented)',
      'Meter: middle (0 from −2 free / rubato to +2 strict isochronous)',
      'Density: leans sparse (-1 from −2 sparse to +2 dense polyphonic)',
      'Transmission: leans oral (+1 from −2 notated to +2 oral)',
      'Real-time generativity: leans improvised (+1 from −2 fixed to +2 improvised)',
      'Sound technology: acoustic (-2 from −2 acoustic to +2 processed / synthesized)',
      'Perceptual intensity: leans cathartic (+1 from −2 meditative to +2 cathartic)',
      'Voice centrality: vocally driven (+2 from −2 instrumental to +2 vocally driven)',
      'Timbral grain: rough / distorted (+2 from −2 clean / smooth to +2 rough / distorted)',
      'Percussion role: leans absent (-1 from −2 absent to +2 foreground / metric)',
      'Formal cyclicity: cyclical / strophic (+2 from −2 through-composed to +2 cyclical / strophic)',
    ],
    values: [
      'leans functional progression',
      'leans flexible / microtonal',
      'leans heavily ornamented',
      'middle',
      'leans sparse',
      'leans oral',
      'leans improvised',
      'acoustic',
      'leans cathartic',
      'vocally driven',
      'rough / distorted',
      'leans absent',
      'cyclical / strophic',
    ],
  },
  techno: {
    labels: [
      'Harmonic logic: middle (0 from −2 modal / drone-tonic to +2 functional progression)',
      'Pitch system: leans fixed equal-tempered (-1 from −2 fixed equal-tempered to +2 flexible / microtonal)',
      'Melodic ornament: middle (0 from −2 plain to +2 heavily ornamented)',
      'Meter: leans strict isochronous (+1 from −2 free / rubato to +2 strict isochronous)',
      'Density: middle (0 from −2 sparse to +2 dense polyphonic)',
      'Transmission: leans notated (-1 from −2 notated to +2 oral)',
      'Real-time generativity: middle (0 from −2 fixed to +2 improvised)',
      'Sound technology: processed / synthesized (+2 from −2 acoustic to +2 processed / synthesized)',
      'Perceptual intensity: leans cathartic (+1 from −2 meditative to +2 cathartic)',
      'Voice centrality: instrumental (-2 from −2 instrumental to +2 vocally driven)',
      'Timbral grain: leans rough / distorted (+1 from −2 clean / smooth to +2 rough / distorted)',
      'Percussion role: foreground / metric (+2 from −2 absent to +2 foreground / metric)',
      'Formal cyclicity: cyclical / strophic (+2 from −2 through-composed to +2 cyclical / strophic)',
    ],
    values: [
      'middle',
      'leans fixed equal-tempered',
      'middle',
      'leans strict isochronous',
      'middle',
      'leans notated',
      'middle',
      'processed / synthesized',
      'leans cathartic',
      'instrumental',
      'leans rough / distorted',
      'foreground / metric',
      'cyclical / strophic',
    ],
  },
  bornesange: {
    labels: [
      'Harmonic logic: middle (0 from −2 modal / drone-tonic to +2 functional progression)',
      'Pitch system: middle (0 from −2 fixed equal-tempered to +2 flexible / microtonal)',
      'Melodic ornament: middle (0 from −2 plain to +2 heavily ornamented)',
      'Meter: middle (0 from −2 free / rubato to +2 strict isochronous)',
      'Density: middle (0 from −2 sparse to +2 dense polyphonic)',
      'Transmission: middle (0 from −2 notated to +2 oral)',
      'Real-time generativity: middle (0 from −2 fixed to +2 improvised)',
      'Sound technology: middle (0 from −2 acoustic to +2 processed / synthesized)',
      'Perceptual intensity: middle (0 from −2 meditative to +2 cathartic)',
      'Voice centrality: middle (0 from −2 instrumental to +2 vocally driven)',
      'Timbral grain: middle (0 from −2 clean / smooth to +2 rough / distorted)',
      'Percussion role: middle (0 from −2 absent to +2 foreground / metric)',
      'Formal cyclicity: middle (0 from −2 through-composed to +2 cyclical / strophic)',
    ],
    values: [
      'middle',
      'middle',
      'middle',
      'middle',
      'middle',
      'middle',
      'middle',
      'middle',
      'middle',
      'middle',
      'middle',
      'middle',
      'middle',
    ],
  },
});
const alias = freeze(['bluegrass_fiddle', { of: 'bluegrass', name: 'Bluegrass fiddle' }]);

async function main() {
  const modulePath = 'prototype/features/genre-sound/sound.js';
  let moduleSource = source('sound.js');
  // Meaningful negative controls, applied only to the served bytes.
  const mutations = {
    label: ["return 'middle';", 'return axis.pos;'],
    order: ['profile.definitions.forEach', '[...profile.definitions].reverse().forEach'],
    alias: ['ctx.useSoundTargets(profile.id)', 'ctx.useSoundTargets(ctx.genre.current())'],
    stale: ['if (disposed || token !== generation) return;', 'if (disposed) return;'],
    cleanup: ['sheet.remove();', '// stylesheet leaked'],
    missing: ['if (profile.axes.some((axis) => !axis.recorded))', 'if (false)'],
    scale: ["scale.setAttribute('role', 'img');", "scale.setAttribute('role', 'presentation');"],
  };
  if (process.env.SOUND_MUTATION) {
    const pair = mutations[process.env.SOUND_MUTATION];
    assert.ok(pair && moduleSource.includes(pair[0]), 'known mutation target');
    moduleSource = moduleSource.replaceAll(pair[0], pair[1]);
  }
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html');
      res.end(
        '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px;background:#171b23;color:#eee;font:16px system-ui}</style><button id="outside">Outside</button><main id="a"></main><main id="b"></main><p role="status" id="status"></p>'
      );
    } else if (req.url === '/' + modulePath) {
      res.setHeader('content-type', 'text/javascript');
      res.end(moduleSource);
    } else if (req.url === '/prototype/features/genre-sound/sound.css') {
      res.setHeader('content-type', 'text/css');
      res.end(source('sound.css'));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(
      async ({ fixtures, alias }) => {
        const { mount } = await import('/prototype/features/genre-sound/sound.js');
        const freeze = (value) => {
          if (value && typeof value === 'object') {
            Object.values(value).forEach(freeze);
            Object.freeze(value);
          }
          return value;
        };
        window.fixtures = freeze(fixtures);
        window.calls = [];
        window.loads = [];
        window.listeners = new Set();
        window.selected = null;
        window.mode = 'normal';
        window.waits = [];
        window.control = new AbortController();
        window.select = (id) => {
          window.selected = id;
          for (const fn of window.listeners) fn();
        };
        window.make = (host, signal) =>
          mount(
            host,
            Object.freeze({
              signal,
              storage: Object.freeze({}),
              announce: (text) => {
                document.querySelector('#status').textContent = text;
              },
              genre: Object.freeze({
                current: () => window.selected,
                subscribe: (fn) => {
                  window.listeners.add(fn);
                  return () => window.listeners.delete(fn);
                },
              }),
              loadSoundProfile: (id, { signal }) => {
                window.loads.push({ id, signal });
                if (window.mode === 'defer')
                  return new Promise((resolve, reject) =>
                    window.waits.push({ resolve, reject, signal, id })
                  );
                if (window.mode === 'fail')
                  return Promise.reject(
                    Object.assign(
                      new Error(
                        'This genre’s details couldn’t load. Check your connection, then try again.'
                      ),
                      { code: 'LOAD_FAILED' }
                    )
                  );
                if (window.mode === 'notfound')
                  return Promise.reject(
                    Object.assign(
                      new Error(
                        'This genre isn’t in the catalog’s data. Reload to see the current catalog.'
                      ),
                      { code: 'NOT_FOUND' }
                    )
                  );
                if (window.mode === 'abort')
                  return Promise.reject(new DOMException('Cancelled', 'AbortError'));
                const record = fixtures[id === alias[0] ? alias[1].of : id];
                if (window.mode === 'missing')
                  return Promise.resolve(
                    freeze({
                      ...record,
                      axes: record.axes.map((axis, i) =>
                        i ? axis : { ...axis, value: 0, recorded: false }
                      ),
                    })
                  );
                return Promise.resolve(record);
              },
              useSoundTargets: (id) => {
                window.calls.push(['targets', id]);
                document.querySelector('#status').textContent =
                  'Find a sound isn’t part of this build of the prototype yet.';
              },
              openGenreTab: (tab) => {
                if (!['overview', 'sound', 'instruments', 'similar', 'background'].includes(tab))
                  throw new TypeError('Unknown tab');
                window.calls.push(['tab', tab]);
                document.querySelector('#status').textContent =
                  'The panel isn’t part of this build of the prototype yet.';
              },
            })
          );
        window.handle = window.make(document.querySelector('#a'), window.control.signal);
      },
      { fixtures, alias }
    );
    const waitReady = () =>
      page.waitForFunction(
        () =>
          document.querySelector('#a .genre-sound-row') &&
          !document.querySelector('#a .genre-sound').hasAttribute('aria-busy')
      );
    const choose = async (id) => {
      await page.evaluate((id) => window.select(id), id);
      await waitReady();
    };
    assert.match(await page.locator('#a').innerText(), /Open a genre/);
    assert.equal(await page.evaluate(() => window.loads.length), 0);
    await page.locator('#outside').focus();
    for (const id of Object.keys(fixtures)) {
      await choose(id);
      const actual = await page.locator('#a').evaluate((host, oracle) => {
        return {
          names: [...host.querySelectorAll('.genre-sound-name')].map((x) => x.textContent),
          labels: [...host.querySelectorAll('[role="img"]')].map((x) =>
            x.getAttribute('aria-label')
          ),
          expectedLabels: oracle.labels,
          values: [...host.querySelectorAll('.genre-sound-value')].map((x) => x.textContent),
          expectedValues: oracle.values,
          positions: [...host.querySelectorAll('.genre-sound-dots')].map((x) =>
            [...x.children].findIndex((d) => d.classList.contains('is-on'))
          ),
          focus: document.activeElement.id,
        };
      }, expected[id]);
      assert.deepEqual(
        actual.names,
        fixtures[id].definitions.map((x) => x.name),
        'all 13 in production order'
      );
      assert.deepEqual(
        actual.labels,
        actual.expectedLabels,
        'exact historical fixture accessible scales'
      );
      assert.deepEqual(
        actual.values,
        actual.expectedValues,
        'exact historical fixture value labels'
      );
      assert.deepEqual(
        actual.positions,
        fixtures[id].axes.map((x) => x.value + 2)
      );
      assert.equal(actual.focus, 'outside', 'background loading must not steal focus');
    }
    await choose(alias[0]);
    await page.getByRole('button', { name: 'Use as sound targets', exact: true }).click();
    await page.getByRole('button', { name: 'Similar sounds', exact: true }).click();
    assert.deepEqual(
      await page.evaluate(() => window.calls),
      [
        ['targets', alias[1].of],
        ['tab', 'similar'],
      ],
      'resolved alias and tab callback'
    );
    assert.equal(
      await page.evaluate(() => window.selected),
      alias[0],
      'stand-in does not change selection'
    );
    assert.equal(await page.locator('#a input, #a audio, #a video').count(), 0);
    await page.evaluate(() => {
      window.mode = 'missing';
      window.select('bluegrass');
    });
    await waitReady();
    assert.match(await page.locator('#a').innerText(), /does not establish measured neutrality/);
    assert.equal(await page.locator('#a .genre-sound-value').first().textContent(), 'middle');
    assert.equal(
      await page.locator('#a .genre-sound-row').first().getAttribute('data-recorded'),
      'false'
    );
    assert.equal(
      await page
        .locator('#a .genre-sound-dots')
        .first()
        .evaluate((dots) => [...dots.children].findIndex((dot) => dot.classList.contains('is-on'))),
      2
    );
    assert.equal(
      await page.locator('#a [role="img"]').first().getAttribute('aria-label'),
      'Harmonic logic: middle (0 from −2 modal / drone-tonic to +2 functional progression)'
    );
    for (const mode of ['notfound', 'fail', 'abort']) {
      await page.evaluate((mode) => {
        window.mode = mode;
        window.select('bluegrass');
      }, mode);
      await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
      assert.match(
        await page.locator('#a').innerText(),
        mode === 'notfound'
          ? /Reload to see the current catalog/
          : mode === 'fail'
            ? /Check your connection, then try again/
            : /cancelled. Try again/
      );
    }
    await page.evaluate(() => {
      window.mode = 'defer';
    });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      'Loading the sound profile…'
    );
    await page.evaluate(() =>
      window.waits
        .shift()
        .reject(
          Object.assign(
            new Error('This genre’s details couldn’t load. Check your connection, then try again.'),
            { code: 'LOAD_FAILED' }
          )
        )
    );
    await page.waitForFunction(() => document.activeElement.textContent === 'Retry');
    await page.evaluate(() => {
      window.mode = 'normal';
    });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await waitReady();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Sound profile');
    // Out-of-order success must not replace the newer selection even if a loader ignores abort.
    await page.evaluate(() => {
      window.mode = 'defer';
      window.select('bluegrass');
      window.select('techno');
    });
    assert.equal(await page.evaluate(() => window.waits[0].signal.aborted), true);
    await page.evaluate(() => window.waits[1].resolve(window.fixtures.techno));
    await waitReady();
    await page.evaluate(() => window.waits[0].resolve(window.fixtures.bluegrass));
    assert.match(await page.locator('#a .genre-sound-note').first().textContent(), /Techno/);
    // Late failure must not replace a successful later view or announce a stale error.
    await page.evaluate(() => {
      window.waits = [];
      window.select('bluegrass');
      window.select('techno');
      window.waits[1].resolve(window.fixtures.techno);
    });
    await waitReady();
    const beforeStaleFailure = await page.locator('#status').textContent();
    await page.evaluate(() => window.waits[0].reject(new Error('stale failure')));
    assert.equal(
      await page.locator('#status').textContent(),
      beforeStaleFailure,
      'no stale error announcement'
    );
    assert.equal(await page.locator('#a button').count(), 2);
    assert.match(await page.locator('#a .genre-sound-note').first().textContent(), /Techno/);
    await page.evaluate(() => {
      window.waits = [];
      window.select('bluegrass');
      window.select(null);
    });
    assert.equal(await page.evaluate(() => window.waits[0].signal.aborted), true);
    await page.evaluate(() => window.waits[0].resolve(window.fixtures.bluegrass));
    assert.match(await page.locator('#a').innerText(), /Open a genre/);
    await page.evaluate(() => {
      window.mode = 'fail';
      window.select('techno');
    });
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    await page.evaluate(() => {
      window.mode = 'defer';
      window.waits = [];
    });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.locator('#outside').focus();
    await page.evaluate(() => window.waits[0].resolve(window.fixtures.techno));
    await waitReady();
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'outside',
      'retry completion respects focus moved elsewhere'
    );
    await page.getByRole('button', { name: 'Use as sound targets', exact: true }).focus();
    const beforeKeyboard = await page.evaluate(() => window.calls.length);
    await page.keyboard.press('Enter');
    assert.equal(
      await page.evaluate(() => window.calls.length),
      beforeKeyboard + 1,
      'keyboard activation invokes exactly once'
    );
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    assert.deepEqual(await page.evaluate(() => window.calls.at(-1)), ['tab', 'similar']);
    await page.evaluate(() => {
      window.mode = 'normal';
      window.select('techno');
    });
    await waitReady();
    // 640 CSS px matches 200% browser zoom on a 1280 px window, as in
    // check_prototype_isolation.js; this does not automate browser chrome zoom.
    for (const width of [1280, 640, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '16px';
      });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `no overflow at ${width}px`
      );
      assert.equal(await page.locator('#a [role="img"]').count(), 13);
      assert.ok(
        await page
          .locator('#a button')
          .first()
          .evaluate((b) => b.getBoundingClientRect().height >= 44)
      );
    }
    // 200% text enlargement with narrow viewport is a reflow stress check, not native browser zoom.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      '200% text reflow'
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '16px';
      document.querySelector('#a').style.width = '280px';
    });
    assert.ok(
      await page.locator('#a').evaluate((host) => host.scrollWidth <= host.clientWidth),
      'narrow host at desktop width'
    );
    await page.evaluate(() => {
      document.querySelector('#a').style.width = '';
    });
    await page.emulateMedia({ forcedColors: 'active' });
    assert.equal(await page.locator('#a .is-on').count(), 13);
    await page.emulateMedia({ forcedColors: 'none' });
    await page.evaluate(() => {
      window.second = new AbortController();
      window.other = window.make(document.querySelector('#b'), window.second.signal);
    });
    await page.waitForFunction(() => document.querySelectorAll('.genre-sound-row').length === 26);
    assert.equal(await page.locator('link.genre-sound-sheet').count(), 2);
    const beforeTeardown = await page.evaluate(() => {
      window.detachedButton = document.querySelector('#a button');
      return window.calls.length;
    });
    await page.evaluate(() => {
      window.handle.unmount();
      window.handle.unmount();
    });
    assert.equal(await page.locator('#a').innerHTML(), '');
    await page.evaluate(() => window.detachedButton.click());
    assert.equal(
      await page.evaluate(() => window.calls.length),
      beforeTeardown,
      'detached control listener cleaned up'
    );
    assert.equal(await page.locator('#b .genre-sound-row').count(), 13);
    assert.equal(await page.evaluate(() => window.listeners.size), 1);
    await page.evaluate(() => {
      window.mode = 'defer';
      window.select('delta_blues');
      window.second.abort();
    });
    assert.equal(await page.evaluate(() => window.waits.at(-1).signal.aborted), true);
    await page.evaluate(() => window.waits.at(-1).resolve(window.fixtures.delta_blues));
    assert.equal(await page.locator('#b').innerHTML(), '');
    assert.equal(await page.evaluate(() => window.listeners.size), 0);
    await page.evaluate(() => {
      const c = new AbortController();
      c.abort();
      window.make(document.querySelector('#a'), c.signal);
    });
    assert.equal(await page.locator('#a').innerHTML(), '');
    assert.deepEqual(failures, []);
    console.log(
      'PASS: derived historical fixture scales; alias callbacks; missing-value fault; errors/retry/focus; stale/abort/teardown; multiple hosts; desktop/mobile/text reflow. Standalone only; rows 170/171 pending.'
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
