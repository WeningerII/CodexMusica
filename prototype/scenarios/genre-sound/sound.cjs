// Standalone contract scenario, NOT real-shell/Browse integration. Rows 170/171
// remain partial/pending. Navigation callbacks deliberately only announce.
// Run: CHROMIUM_PATH=/usr/bin/chromium node prototype/scenarios/genre-sound/sound.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const http = require('node:http');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../../..');
const source = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const blob = (text) =>
  crypto
    .createHash('sha1')
    .update(`blob ${Buffer.byteLength(text)}\0`)
    .update(text)
    .digest('hex');
const pins = {
  'api/browse_boot.json': '80c531e657e8115c638a5026c31075c02ff1feab',
  'references/03_rooms_chains_tunings.js': '2240639fd08b0ae27b2b72c2f0fdecf68be973cd',
  'src/pages/genre.js': '47078396261039a6d18e97edbe1c242d2b440f80',
  'src/app.js': 'c363423cee3f6c8340d2ca0a1ebcfe0f318e3a38',
};
// Fixtures are pinned to #755 e736f53404b13491fbb22f1570d4e4f178faa49d.
// Updating a source pin requires rechecking the production oracle, not silently
// accepting a changed fixture. Missing-value and race cases below are fault injection.
for (const [file, sha] of Object.entries(pins)) assert.equal(blob(source(file)), sha, file);
const boot = JSON.parse(source('api/browse_boot.json'));
const definitions = JSON.parse(
  JSON.stringify(
    vm.runInNewContext(
      source('references/03_rooms_chains_tunings.js').match(
        /const AXIS_DEFINITIONS = (\[[\s\S]*?\n\]);/
      )[1]
    )
  )
);
const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const production = vm.createContext({
  esc,
  AXIS_DEFINITIONS: definitions,
  Tradition: (id) => boot.items.find((item) => item.id === id),
  uiButton: () => '', // Only compare production scale semantics, not its shell controls.
});
const genreSource = source('src/pages/genre.js');
vm.runInContext(
  source('src/app.js').match(/function axisLabel\(axis, value\) \{[\s\S]*?\n\}/)[0] +
    '\n' +
    genreSource.slice(
      genreSource.indexOf('function gpSoundProfile('),
      genreSource.indexOf('// What a single-instrument Add')
    ),
  production
);
const fixtures = {};
const expected = {};
for (const id of ['bluegrass', 'delta_blues', 'techno', 'bornesange']) {
  const row = boot.items.find((item) => item.id === id);
  fixtures[id] = {
    id,
    name: row.name,
    definitions: definitions.map(({ id, name, neg, pos }) => ({ id, name, neg, pos })),
    axes: definitions.map((axis) => ({
      id: axis.id,
      value: row.axes[boot.axisKeys.indexOf(axis.id)],
      recorded: true,
    })),
  };
  expected[id] = production.gpSoundProfile(id, {
    axes: Object.fromEntries(fixtures[id].axes.map((axis) => [axis.id, axis.value])),
  });
}
const alias = Object.entries(boot.aliases || {}).find(([, row]) => fixtures[row.of]);
assert.ok(alias, 'real retired alias for one fixture');

async function main() {
  const modulePath = 'prototype/features/genre-sound/sound.js';
  let moduleSource = source(modulePath);
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
      res.end(source('prototype/features/genre-sound/sound.css'));
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
      const actual = await page.locator('#a').evaluate((host, html) => {
        const oracle = document.createElement('div');
        oracle.innerHTML = html;
        return {
          names: [...host.querySelectorAll('.genre-sound-name')].map((x) => x.textContent),
          labels: [...host.querySelectorAll('[role="img"]')].map((x) =>
            x.getAttribute('aria-label')
          ),
          expectedLabels: [...oracle.querySelectorAll('[role="img"]')].map((x) =>
            x.getAttribute('aria-label')
          ),
          values: [...host.querySelectorAll('.genre-sound-value')].map((x) => x.textContent),
          expectedValues: [...oracle.querySelectorAll('.gp-axis-value')].map((x) => x.textContent),
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
      assert.deepEqual(actual.labels, actual.expectedLabels, 'exact production accessible scales');
      assert.deepEqual(actual.values, actual.expectedValues, 'exact production value labels');
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
      'PASS: pinned production scales; alias callbacks; missing-value fault; errors/retry/focus; stale/abort/teardown; multiple hosts; desktop/mobile/text reflow. Standalone only; rows 170/171 pending.'
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
