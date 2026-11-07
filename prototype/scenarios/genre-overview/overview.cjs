// Standalone contract scenario, not real-shell integration or CI.
// Real records pinned to P2 5969d99854fab11cdb2bba2139eed7e1e76918f1:
// browse_boot 80c531e657e8115c638a5026c31075c02ff1feab;
// instruments/index bd5fca0ca953d1887616ab428a9b5744ecdf84c7;
// tree-nodes 652e32b24dfc9cbbbdd83330977a39e81909889b.
// Expected words executed through production gpSoundWords/axisLabel, independently
// checked for Bluegrass/Afrobeat/Ambient ties. No axis ranking lives in this lane.
// Glyphs below are fixture-only data SVGs, NOT canonical glyph-parity evidence.
// Branch/map callbacks are explicit no-navigation stand-ins, as #668 6646665459.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const FIXTURES = [
  {
    id: 'bluegrass',
    name: 'Bluegrass',
    instruments: [
      {
        id: 'acoustic_guitar_dread',
        name: 'Dreadnought acoustic guitar',
      },
      {
        id: 'mandolin',
        name: 'Mandolin',
      },
      {
        id: 'banjo_5_string',
        name: 'Five-string banjo',
      },
      {
        id: 'upright_bass',
        name: 'Upright (double) bass',
      },
      {
        id: 'fiddle',
        name: 'Fiddle',
      },
      {
        id: 'mandola',
        name: 'Mandola (alto mandolin)',
      },
    ],
    soundWords: [
      'strict isochronous',
      'acoustic',
      'cyclical / strophic',
      'leans functional progression',
    ],
    crossListings: [
      {
        id: 'droneModal.appalachian',
        name: 'Appalachian and old-time mountain',
      },
      {
        id: 'fieldWork.americanSouth',
        name: 'American South field-work song',
      },
    ],
  },
  {
    id: 'afrobeat',
    name: 'Afrobeat',
    instruments: [
      {
        id: 'electric_guitar_single_coil',
        name: 'Solid-body electric guitar with single-coil pickups',
      },
      {
        id: 'electric_bass',
        name: 'Solid-body electric bass',
      },
      {
        id: 'drum_kit',
        name: 'Drum kit (Western)',
      },
      {
        id: 'tonewheel_organ',
        name: 'Drawbar tonewheel organ (with rotating-speaker cabinet)',
      },
      {
        id: 'saxophone',
        name: 'Saxophone (soprano / alto / tenor / baritone)',
      },
      {
        id: 'trumpet',
        name: 'Trumpet / cornet / flugelhorn',
      },
      {
        id: 'voice',
        name: 'Voice',
      },
      {
        id: 'shekere',
        name: 'Shekere (West African beaded gourd)',
      },
      {
        id: 'congas',
        name: 'Congas / tumbadoras (Cuban)',
      },
    ],
    soundWords: [
      'strict isochronous',
      'dense polyphonic',
      'foreground / metric',
      'cyclical / strophic',
    ],
    crossListings: [
      {
        id: 'improvOnFrame.americanJazz.fusion',
        name: 'Jazz fusion',
      },
      {
        id: 'mcRhythm.afroDiasporic',
        name: 'African and diasporic MCing',
      },
    ],
  },
  {
    id: 'ambient',
    name: 'Ambient',
    instruments: [
      {
        id: 'analog_synth',
        name: 'Analog synthesizer (subtractive)',
      },
      {
        id: 'tape_replay_keyboard',
        name: 'Tape-replay polyphonic keyboard',
      },
      {
        id: 'handpan',
        name: 'Handpan (steel tongue drum)',
      },
      {
        id: 'cristal_baschet',
        name: 'Cristal Baschet (glass-rod friction idiophone)',
      },
    ],
    soundWords: ['meditative', 'instrumental', 'absent', 'leans modal / drone-tonic'],
    crossListings: [
      {
        id: 'droneModal.modalElectric',
        name: 'Modal electric strings',
      },
    ],
  },
  {
    id: 'bornesange',
    name: 'Bornesange',
    instruments: [
      {
        id: 'voice',
        name: 'Voice',
      },
      {
        id: 'acoustic_guitar_dread',
        name: 'Dreadnought acoustic guitar',
      },
    ],
    soundWords: [],
    crossListings: [],
  },
  {
    id: 'pop',
    name: 'Pop',
    instruments: [
      {
        id: 'voice',
        name: 'Voice',
      },
      {
        id: 'analog_synth',
        name: 'Analog synthesizer (subtractive)',
      },
      {
        id: 'drum_machine_808',
        name: 'Roland TR-808 drum machine',
      },
      {
        id: 'electric_bass',
        name: 'Solid-body electric bass',
      },
      {
        id: 'multitrack_vocal_stack',
        name: 'Multi-track vocal stack (recorded-stack as constitutive instrument)',
      },
    ],
    soundWords: [
      'vocally driven',
      'foreground / metric',
      'leans functional progression',
      'leans flexible / microtonal',
    ],
    crossListings: [],
  },
];
const root = path.resolve(__dirname, '../..');
const feature = path.join(root, 'features/genre-overview/overview.js');
const css = path.join(root, 'features/genre-overview/overview.css');
const mutations = {
  overflow: ['slice(0, 6)', 'slice(0, 5)'],
  words: [
    'for (const word of record.soundWords)',
    'for (const word of [...record.soundWords].reverse())',
  ],
  mapping: ["tab('Inspect instruments', 'instruments')", "tab('Inspect instruments', 'overview')"],
  stale: ['ticket === generation && !controller.signal.aborted', 'true'],
  alias: ['if (!current()) return;', 'if (!current() || record.id !== id) return;'],
  abort: ['request?.abort();', '/* no abort */'],
  teardown: ['unsubscribe();', '/* leaked subscription */'],
  style: ['style.remove();', '/* leaked stylesheet */'],
  error: ['? error.message', "? 'Wrong error'"],
  focus: ['again && doc.activeElement === loading', 'again'],
};
let source = fs.readFileSync(feature, 'utf8');
if (process.env.OVERVIEW_MUTATION) {
  const mutation = mutations[process.env.OVERVIEW_MUTATION];
  assert(mutation && source.includes(mutation[0]), 'known mutation target');
  source = source.replaceAll(mutation[0], mutation[1]);
}
const server = http.createServer((req, res) => {
  if (req.url === '/overview.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(source);
  } else if (req.url === '/overview.css') {
    res.setHeader('Content-Type', 'text/css');
    res.end(fs.readFileSync(css));
  } else if (req.url === '/shell.css') {
    res.setHeader('Content-Type', 'text/css');
    res.end(fs.readFileSync(process.env.GENRE_SHELL_CSS || path.join(root, 'proto.css')));
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Overview contract scenario</title><link rel="stylesheet" href="/shell.css"><body><h1>Genre contract harness</h1><button id="outside">Outside</button><div id="one"></div><div id="two"></div><p id="status" role="status"></p></body></html>'
    );
  }
});
let checks = 0;
function equal(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  checks++;
}
async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const external = [];
    await page.route('**/*', (r) => {
      if (!r.request().url().startsWith(origin)) {
        external.push(r.request().url());
        return r.abort();
      }
      return r.continue();
    });
    await page.goto(origin);
    await page.evaluate(async (fixtures) => {
      const { mount } = await import('/overview.js');
      const freeze = (x) => {
        if (x && typeof x === 'object') {
          Object.values(x).forEach(freeze);
          Object.freeze(x);
        }
        return x;
      };
      const glyph =
        'data:image/svg+xml,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="10"/></svg>'
        );
      window.records = Object.fromEntries(
        fixtures.map((f) => [
          f.id,
          freeze({ ...f, instruments: f.instruments.map((i) => ({ ...i, glyphUrl: glyph })) }),
        ])
      );
      window.create = (hostId, preAborted = false) => {
        const host = document.getElementById(hostId),
          controller = new AbortController(),
          listeners = new Set();
        let selected = null;
        const state = {
          controller,
          listeners,
          calls: [],
          pending: [],
          manual: false,
          fail: null,
          host,
        };
        state.set = (id) => {
          selected = id;
          for (const fn of [...listeners]) fn();
        };
        state.ctx = Object.freeze({
          signal: controller.signal,
          storage: Object.freeze({}),
          announce: (t) => {
            document.getElementById('status').textContent = t;
          },
          genre: Object.freeze({
            current: () => selected,
            subscribe: (fn) => {
              listeners.add(fn);
              return () => listeners.delete(fn);
            },
          }),
          loadGenreOverview(id, { signal }) {
            state.calls.push(['load', id]);
            if (state.manual)
              return new Promise((resolve, reject) =>
                state.pending.push({ id, signal, resolve, reject })
              ); // deliberately ignores cancellation: exercise generation guard too
            if (state.fail)
              return Promise.reject(
                Object.assign(new Error(state.fail.message), { code: state.fail.code })
              );
            return Promise.resolve(window.records[id === 'bluegrass_fiddle' ? 'bluegrass' : id]);
          },
          openGenreTab(tab) {
            if (!['overview', 'sound', 'instruments', 'similar', 'background'].includes(tab))
              throw new TypeError('Invalid tab');
            state.calls.push(['tab', tab]);
            document.getElementById('status').textContent =
              'The target panel is not mounted in this contract harness.';
          },
          openGenreBranch(id) {
            state.calls.push(['branch', id]);
            document.getElementById('status').textContent =
              'The branch browser is not part of this prototype yet.';
          },
          openGenreMap(id) {
            state.calls.push(['map', id]);
            document.getElementById('status').textContent =
              'Map integration is not part of this prototype yet.';
          },
        });
        if (preAborted) controller.abort();
        state.handle = mount(host, state.ctx);
        return state;
      };
      window.one = window.create('one');
      window.two = window.create('two');
    }, FIXTURES);
    const one = page.locator('#one');
    equal(
      await one.locator('p').textContent(),
      'Open a genre to see its overview.',
      'empty selection'
    );
    equal(
      await page.locator('link[href$="overview.css"]').count(),
      2,
      'one owned stylesheet per host'
    );
    for (const f of FIXTURES) {
      await page.evaluate((id) => window.one.set(id), f.id);
      await one.locator('.go-ensemble').waitFor();
      equal(
        await one.locator('.go-ensemble li span').allTextContents(),
        f.instruments.slice(0, 6).map((i) => i.name),
        f.id + ' ordered six'
      );
      equal(
        await one.locator('.go-words li').allTextContents(),
        f.soundWords,
        f.id + ' canonical word order'
      );
      equal(
        await one.locator('.go-also button').allTextContents(),
        f.crossListings.map((x) => x.name),
        f.id + ' cross order'
      );
      equal(
        await one.locator('.go-more').allTextContents(),
        f.instruments.length > 6 ? [`+${f.instruments.length - 6} more`] : [],
        f.id + ' overflow'
      );
      equal(await one.locator('.go-ensemble button').count(), 0, 'names never navigation');
      equal(await one.locator('img').count(), Math.min(6, f.instruments.length), 'glyph count');
      equal(
        await one.locator('.go-note').allTextContents(),
        f.soundWords.length
          ? []
          : ['The catalog places this genre in the middle of every characteristic.'],
        'zero fallback'
      );
    }
    await page.evaluate(() => window.one.set('bluegrass'));
    for (const [label, key] of [
      ['Inspect instruments', 'instruments'],
      ['Sound profile', 'sound'],
      ['Recordings & references', 'background'],
      ['Find similar sounds', 'similar'],
    ]) {
      await one.getByRole('button', { name: label, exact: true }).click();
      equal(
        await page.evaluate(() => window.one.calls.at(-1)),
        ['tab', key],
        'exact tab mapping ' + key
      );
    }
    equal(
      await page.evaluate(() => {
        try {
          window.one.ctx.openGenreTab('invented');
          return false;
        } catch (e) {
          return e instanceof TypeError;
        }
      }),
      true,
      'stand-in rejects invalid contract mapping'
    );
    await one.locator('.go-also button').first().click();
    equal(
      await page.evaluate(() => window.one.calls.at(-1)),
      ['branch', 'droneModal.appalachian'],
      'branch callback'
    );
    await one.getByRole('button', { name: 'View on map', exact: true }).click();
    equal(await page.evaluate(() => window.one.calls.at(-1)), ['map', 'bluegrass'], 'map callback');
    equal(
      await page.evaluate(() => [
        window.one.ctx.genre.current(),
        location.hash,
        document.querySelectorAll('iframe').length,
      ]),
      ['bluegrass', '', 0],
      'stand-ins do not navigate'
    );
    await page.evaluate(() => window.one.set('bluegrass_fiddle'));
    await one.locator('.go-ensemble').waitFor();
    await one.getByRole('button', { name: 'View on map', exact: true }).click();
    equal(
      await page.evaluate(() => window.one.calls.at(-1)),
      ['map', 'bluegrass'],
      'resolved alias uses live id'
    );
    // A -> B -> A, and old completions after the new A: id equality alone is insufficient.
    await page.evaluate(() => {
      window.one.manual = true;
      window.one.set('bluegrass');
      window.one.set('afrobeat');
      window.one.set('bluegrass');
    });
    equal(
      await page.evaluate(() => window.one.pending.map((p) => p.signal.aborted)),
      [true, true, false],
      'superseded caller waits aborted'
    );
    await page.evaluate(() => {
      window.one.pending[2].resolve(window.records.bluegrass);
    });
    await one.locator('.go-ensemble').waitFor();
    await page.evaluate(() => {
      window.one.pending[0].resolve(window.records.ambient);
      window.one.pending[1].reject(
        Object.assign(new Error('stale failure'), { code: 'LOAD_FAILED' })
      );
    });
    equal(
      await one.locator('.go-words li').allTextContents(),
      FIXTURES[0].soundWords,
      'stale success/error suppressed'
    );
    // Current safe guidance and retry focus, including a user who moves elsewhere.
    for (const failure of [
      {
        code: 'NOT_FOUND',
        message: 'This genre isn’t in the catalog’s data. Reload to see the current catalog.',
      },
      {
        code: 'LOAD_FAILED',
        message: 'This genre’s details couldn’t load. Check your connection, then try again.',
      },
    ]) {
      await page.evaluate((f) => {
        window.one.manual = false;
        window.one.fail = f;
        window.one.set('bluegrass');
      }, failure);
      await one.getByRole('button', { name: 'Retry loading the overview' }).waitFor();
      equal(
        await one.locator('.go-note').textContent(),
        failure.message,
        'current safe error guidance'
      );
    }
    await page.evaluate(() => {
      window.one.fail = null;
      window.one.manual = true;
    });
    await one.getByRole('button', { name: 'Retry loading the overview' }).click();
    equal(
      await page.evaluate(() => document.activeElement.textContent),
      'Loading the overview…',
      'retry starts focused'
    );
    await page.locator('#outside').focus();
    await page.evaluate(() => window.one.pending.at(-1).resolve(window.records.bluegrass));
    await one.locator('.go-ensemble').waitFor();
    equal(
      await page.evaluate(() => document.activeElement.id),
      'outside',
      'retry does not steal moved focus'
    );
    await page.evaluate(() => {
      window.one.manual = false;
      window.one.fail = { code: 'LOAD_FAILED', message: 'Current guidance' };
      window.one.set('bluegrass');
    });
    await one.getByRole('button', { name: 'Retry loading the overview' }).waitFor();
    await page.evaluate(() => {
      window.one.fail = null;
    });
    await one.getByRole('button', { name: 'Retry loading the overview' }).click();
    equal(
      await page.evaluate(() => document.activeElement.textContent),
      'Overview',
      'successful retry retains focus in own heading'
    );
    await one.getByRole('button', { name: 'Inspect instruments', exact: true }).focus();
    await page.keyboard.press('Enter');
    equal(
      await page.evaluate(() => window.one.calls.at(-1)),
      ['tab', 'instruments'],
      'keyboard activation delegates'
    );
    await page.evaluate(() => {
      window.one.fail = { code: 'LOAD_FAILED', message: 'Retry still unavailable. Try again.' };
      window.one.set('bluegrass');
    });
    await one.getByRole('button', { name: 'Retry loading the overview' }).click();
    equal(
      await page.evaluate(() => document.activeElement.getAttribute('aria-label')),
      'Retry loading the overview',
      'retry failure focuses new Retry'
    );
    await page.evaluate(() => {
      window.one.fail = null;
    });
    // Untrusted display text stays text; unsupported glyph schemes are never fetched.
    await page.evaluate(() => {
      window.one.manual = true;
      window.one.set('unsafe');
      window.one.pending.at(-1).resolve({
        id: 'unsafe',
        name: 'unsafe',
        instruments: [
          { id: 'x', name: '<img src=x onerror=alert(1)>', glyphUrl: 'javascript:alert(1)' },
          { id: 'y', name: 'remote', glyphUrl: 'https://example.invalid/glyph.svg' },
        ],
        soundWords: ['<b>plain</b>'],
        crossListings: [{ id: 'x', name: '<script>bad</script>' }],
      });
    });
    await one.locator('.go-ensemble').waitFor();
    equal(await one.locator('img,script,b').count(), 0, 'unsafe text and URLs inert');
    equal(await one.locator('.go-words li').textContent(), '<b>plain</b>', 'text preserved');
    await page.evaluate(() => {
      window.one.manual = false;
      window.one.set('afrobeat');
      window.two.set('ambient');
    });
    await one.locator('.go-more').waitFor();
    for (const width of [1200, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      if (process.env.OVERVIEW_SCREENSHOTS)
        await page.screenshot({
          path: path.join(process.env.OVERVIEW_SCREENSHOTS, `overview-${width}.png`),
          fullPage: true,
        });
      equal(
        await one.evaluate((h) => h.scrollWidth <= h.clientWidth + 1),
        true,
        'no horizontal overflow ' + width
      );
      equal(
        await one
          .locator('.go-grid')
          .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
        width > 700 ? 2 : 1,
        'responsive columns ' + width
      );
    }
    await page.setViewportSize({ width: 640, height: 900 });
    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });
    equal(
      await one.evaluate((h) => h.scrollWidth <= h.clientWidth + 1),
      true,
      '200 percent zoom overflow'
    );
    equal(
      await one
        .locator('.go-grid')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
      1,
      'zoom reflows'
    );
    await page.evaluate(() => {
      document.body.style.zoom = '';
      window.one.handle.focus();
    });
    equal(
      await page.evaluate(() => document.activeElement.closest('#one') !== null),
      true,
      'focus stays in host'
    );
    await page.evaluate(() => {
      window.one.manual = true;
      window.one.set('bluegrass');
      window.one.handle.unmount();
      window.one.handle.unmount();
      window.one.pending.at(-1).resolve(window.records.bluegrass);
    });
    equal(await page.evaluate(() => window.one.listeners.size), 0, 'unsubscribe on teardown');
    equal(
      await page.evaluate(() => window.one.pending.at(-1).signal.aborted),
      true,
      'unmount aborts caller'
    );
    equal(await one.locator('*').count(), 0, 'teardown removes content and stylesheet');
    equal(
      await page.locator('#two .go-words li').allTextContents(),
      FIXTURES[2].soundWords,
      'other host survives'
    );
    await page.evaluate(() => {
      window.two.manual = true;
      window.two.set('ambient');
      window.two.controller.abort();
      window.two.pending.at(-1).reject(new DOMException('Aborted', 'AbortError'));
    });
    equal(
      await page.evaluate(() => window.two.pending.at(-1).signal.aborted),
      true,
      'parent abort cancels active caller'
    );
    equal(await page.locator('#two *').count(), 0, 'parent abort cleans host');
    equal(await page.evaluate(() => window.two.listeners.size), 0, 'parent abort unsubscribes');
    await page.evaluate(() => {
      window.preAborted = window.create('one', true);
    });
    equal(await one.locator('*').count(), 0, 'pre-aborted mount creates no nodes');
    equal(
      await page.evaluate(() => [window.preAborted.calls.length, window.preAborted.listeners.size]),
      [0, 0],
      'pre-aborted mount starts no load or subscription'
    );
    equal(external, [], 'no off-origin requests');
    equal(errors, [], 'no browser errors');
    console.log(
      `PASS ${checks} Overview contract checks; standalone fixtures and navigation stand-ins only.`
    );
  } finally {
    await browser.close();
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => server.close());
