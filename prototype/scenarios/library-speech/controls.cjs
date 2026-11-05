// Offline controller scenarios. Production fixture shape: reader.js at 10b42689f04.
// Run: node prototype/scenarios/library-speech/controls.cjs [controls.js override]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
class Element extends EventTarget {
  constructor(tag, doc) {
    super();
    this.tag = tag;
    this.ownerDocument = doc;
    this.children = [];
    this.attrs = {};
    this.value = '';
  }
  append(el) {
    this.children.push(el);
    el.parent = this;
  }
  replaceChildren() {
    this.children = [];
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  remove() {
    this.parent.children = this.parent.children.filter((x) => x !== this);
  }
  focus() {
    this.ownerDocument.focused = this;
  }
}
const doc = {
  createElement(tag) {
    return new Element(tag, this);
  },
};
const english = { voiceURI: 'english', name: 'English device', lang: 'en-GB' };
const chinese = { voiceURI: 'chinese', name: 'Chinese device', lang: 'zh-CN' };
const lines = [
  { analysis_line: null, text: 'Apparatus' },
  { analysis_line: 1, text: 'First line' },
  { analysis_line: 2, text: '' },
  { analysis_line: 3, text: 'Second line' },
];
let count = 0;
function check(fn) {
  fn();
  count++;
}
(async () => {
  const source = fs.readFileSync(
    process.argv.slice(2).find((arg) => !arg.startsWith('--')) ||
      path.resolve(__dirname, '../../features/library-speech/controls.js'),
    'utf8'
  );
  const { mount } = await import(
    'data:text/javascript;base64,' +
      Buffer.from(
        source.replaceAll(
          'import.meta.url',
          JSON.stringify(
            require('node:url').pathToFileURL(
              path.resolve(__dirname, '../../features/library-speech/controls.js')
            ).href
          )
        )
      ).toString('base64')
  );
  function setup(options = {}) {
    const host = doc.createElement('div'),
      controller = new AbortController(),
      calls = [],
      announcements = [];
    const engine = options.engine || { current: null, cancellations: 0 };
    const events = [];
    let list = options.voices ?? [english, chinese],
      listener,
      removed = 0,
      cancelled = 0,
      consumed = 0;
    const speech = {
      available: options.available !== false,
      takeAutoplay() {
        events.push('takeAutoplay');
        consumed++;
        return options.auto === true && consumed === 1;
      },
      getVoices() {
        events.push('getVoices');
        if (options.voicesError) throw Error();
        return list;
      },
      subscribeVoices(fn) {
        listener = fn;
        return () => removed++;
      },
      speak(text, opts) {
        if (options.speakError) throw Error();
        const u = { text, ...opts, cancelled: false };
        events.push('speak');
        calls.push(u);
        engine.current = u;
        if (options.syncEnd) u.onend();
        return {
          cancel() {
            u.cancelled = true;
            cancelled++;
            if (engine.current === u) {
              engine.current = null;
              engine.cancellations++;
            }
            if (options.cancelCallback) u.onend();
          },
        };
      },
    };
    const ctx = {
      speech: options.missing ? null : speech,
      signal: controller.signal,
      language: options.language || 'eng',
      lines: options.lines ?? lines,
      announce: (x) => announcements.push(x),
    };
    if (options.aborted) controller.abort();
    const handle = mount(host, ctx);
    const root = host.children.find((x) => x.tag === 'section');
    const all = (el) => (el ? [el, ...el.children.flatMap(all)] : []);
    const nodes = all(root),
      button = nodes.find((x) => x.tag === 'button'),
      select = nodes.find((x) => x.tag === 'select'),
      speed = nodes.find((x) => x.tag === 'input');
    return {
      host,
      handle,
      calls,
      announcements,
      events,
      engine,
      controller,
      button,
      select,
      speed,
      click() {
        button.dispatchEvent(new Event('click'));
      },
      change(el, value, event) {
        el.value = value;
        el.dispatchEvent(new Event(event));
      },
      voiceChange(v) {
        list = v;
        listener?.();
      },
      get removed() {
        return removed;
      },
      get cancelled() {
        return cancelled;
      },
      get consumed() {
        return consumed;
      },
    };
  }
  let s = setup();
  s.click();
  check(() =>
    assert.deepEqual(
      s.calls.map((x) => x.text),
      ['First line']
    )
  );
  check(() => assert.equal(s.calls[0].voiceURI, 'english'));
  s.change(s.speed, '2', 'input');
  s.calls[0].onend();
  s.calls[0].onend();
  check(() => assert.equal(s.calls.length, 2));
  check(() => assert.equal(s.calls[1].rate, 2));
  check(() => assert.equal(s.button.attrs['aria-pressed'], 'true'));
  s.calls[1].onend();
  check(() => assert.equal(s.button.attrs['aria-pressed'], 'false'));
  s.change(s.select, 'chinese', 'change');
  s.change(s.speed, '0.5', 'input');
  s.click();
  check(() => assert.equal(s.calls[2].lang, 'zh-CN'));
  check(() => assert.equal(s.calls[2].rate, 0.5));
  s.click();
  const n = s.calls.length;
  s.calls[2].onend();
  s.calls[2].onerror();
  check(() => assert.equal(s.calls.length, n));
  s.click();
  const late = s.calls.at(-1);
  s.controller.abort();
  late.onend();
  late.onerror();
  check(() => assert.equal(s.host.children.length, 0));
  check(() => assert.equal(s.removed, 1));
  s.handle.unmount();
  check(() => assert.equal(s.removed, 1));
  s = setup({ voices: [], auto: true });
  check(() => assert.equal(s.consumed, 1));
  check(() => assert.equal(s.button.textContent, 'Stop'));
  s.voiceChange([english]);
  check(() => assert.equal(s.calls.length, 1));
  s.voiceChange([english]);
  check(() => assert.equal(s.calls.length, 1));
  s = setup({ voices: [], auto: true });
  s.click();
  s.voiceChange([english]);
  check(() => assert.equal(s.calls.length, 0));
  s = setup({ voices: [], auto: true });
  s.handle.unmount();
  s.voiceChange([english]);
  check(() => assert.equal(s.calls.length, 0));
  s = setup({ voices: [] });
  s.click();
  check(() => assert.match(s.announcements.at(-1), /No matching/));
  s = setup({ language: 'zzz' });
  s.click();
  check(() => assert.equal(s.calls.length, 0));
  s = setup({ language: 'ltc' });
  s.click();
  check(() => assert.equal(s.calls[0].lang, 'zh-CN'));
  s = setup({ lines: [] });
  s.click();
  check(() => assert.equal(s.calls.length, 0));
  check(() => assert.equal(s.button.attrs['aria-pressed'], 'false'));
  s = setup({ lines: [{ text: 'invalid' }] });
  s.click();
  check(() => assert.match(s.announcements.at(-1), /unavailable/));
  for (const options of [
    { missing: true, auto: true },
    { voicesError: true, auto: true },
  ]) {
    s = setup(options);
    check(() => assert.equal(s.button.disabled, true));
    check(() => assert.equal(s.consumed, options.missing ? 0 : 1));
  }
  s = setup({ voices: [], auto: true, lines: [{ text: 'invalid' }] });
  s.voiceChange([english]);
  check(() => assert.equal(s.button.attrs['aria-pressed'], 'false'));
  s.voiceChange([english]);
  check(() => assert.equal(s.calls.length, 0));
  s = setup({ speakError: true });
  s.click();
  check(() => assert.equal(s.button.attrs['aria-pressed'], 'false'));
  check(() => assert.match(s.announcements.at(-1), /could not read/));
  s = setup();
  s.click();
  s.calls[0].onerror();
  s.calls[0].onend();
  check(() => assert.equal(s.calls.length, 1));
  s = setup({ aborted: true, auto: true });
  check(() => assert.equal(s.consumed, 0));
  check(() => assert.equal(s.host.children.length, 0));
  s = setup();
  s.handle.focus();
  check(() => assert.equal(doc.focused, s.button));
  s.handle.unmount();
  const focused = doc.focused;
  s.handle.focus();
  check(() => assert.equal(doc.focused, focused));
  s = setup({ available: false, auto: true });
  check(() => assert.equal(s.consumed, 1));
  check(() => assert.equal(s.calls.length, 0));
  check(() => assert.equal(s.button.disabled, true));
  s = setup({ auto: true });
  check(() => assert.equal(s.events[0], 'takeAutoplay'));
  check(() => assert.equal(s.calls.length, 1));
  s.click();
  s.click();
  check(() => assert.equal(s.calls.length, 2));
  check(() => assert.equal(s.consumed, 1));
  s = setup({ auto: false });
  s.click();
  check(() => assert.equal(s.calls.length, 1));
  check(() => assert.equal(s.consumed, 1));
  s = setup({ syncEnd: true });
  s.click();
  check(() => assert.equal(s.calls.length, 2));
  check(() => assert.equal(s.button.attrs['aria-pressed'], 'false'));
  s.handle.unmount();
  check(() => assert.equal(s.cancelled, 0));
  s = setup({ cancelCallback: true });
  s.click();
  s.click();
  check(() => assert.equal(s.calls.length, 1));
  check(() => assert.equal(s.cancelled, 1));
  s.handle.unmount();
  check(() => assert.equal(s.cancelled, 1));
  s = setup({
    syncEnd: true,
    lines: Array.from({ length: 10000 }, (_, i) => ({ analysis_line: i + 1, text: 'Line ' + i })),
  });
  s.click();
  check(() => assert.equal(s.calls.length, 10000));
  check(() => assert.equal(s.button.attrs['aria-pressed'], 'false'));
  s.handle.unmount();
  check(() => assert.equal(s.cancelled, 0));
  const engine = { current: null, cancellations: 0 };
  const a = setup({ engine }),
    b = setup({ engine });
  a.click();
  b.click();
  a.click();
  check(() => assert.equal(a.cancelled, 1));
  check(() => assert.equal(b.cancelled, 0));
  check(() => assert.equal(engine.current, b.calls[0]));
  check(() => assert.equal(engine.cancellations, 0));
  a.calls[0].onend();
  a.calls[0].onerror();
  check(() => assert.equal(a.calls.length, 1));
  b.calls[0].onend();
  check(() => assert.equal(b.calls.length, 2));
  b.controller.abort();
  check(() => assert.equal(b.cancelled, 1));
  check(() => assert.equal(engine.cancellations, 1));
  b.calls[1].onend();
  check(() => assert.equal(b.calls.length, 2));
  a.handle.unmount();
  check(() => assert.equal(a.cancelled, 1));
  console.log(
    `${count} offline speech controller checks passed; no device audio; DOM shim, not browser/layout evidence.`
  );
  if (process.argv.includes('--browser')) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      for (const width of [320, 390, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 800 } });
        await page.route('**/*', (route) => {
          const pathname = new URL(route.request().url()).pathname;
          if (pathname === '/')
            return route.fulfill({
              contentType: 'text/html',
              body: '<main></main><aside></aside>',
            });
          if (pathname === '/controls.js')
            return route.fulfill({ contentType: 'text/javascript', body: source });
          if (pathname === '/controls.css')
            return route.fulfill({
              contentType: 'text/css',
              body: fs.readFileSync(
                path.resolve(__dirname, '../../features/library-speech/controls.css'),
                'utf8'
              ),
            });
          return route.abort();
        });
        await page.goto('https://speech.test/');
        await page.evaluate(async () => {
          Object.defineProperty(window, 'speechSynthesis', {
            get() {
              throw Error('Device API accessed');
            },
          });
          const { mount } = await import('/controls.js');
          window.calls = [];
          window.handle = mount(document.querySelector('main'), {
            language: 'eng',
            lines: [
              { analysis_line: 1, text: 'First' },
              { analysis_line: 2, text: 'Next' },
            ],
            speech: {
              available: true,
              takeAutoplay: () => false,
              getVoices: () => [{ voiceURI: 'en', name: 'English', lang: 'en-US' }],
              subscribeVoices: () => () => {},
              speak(text, opts) {
                window.calls.push({ text, ...opts });
                return { cancel() {} };
              },
            },
            signal: new AbortController().signal,
          });
        });
        await page.waitForFunction(
          () => document.querySelector('main link[rel=stylesheet]')?.sheet
        );
        assert.equal(await page.locator('main link[rel=stylesheet]').count(), 1);
        const button = page.getByRole('button', { name: 'Read this work' });
        await button.focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => window.calls.length), 1);
        await page.evaluate(() => window.calls[0].onend());
        assert.equal(await page.evaluate(() => window.calls.length), 2);
        await page.getByRole('button', { name: 'Stop', exact: true }).click();
        await page.evaluate(() => window.calls[1].onend());
        assert.equal(await page.evaluate(() => window.calls.length), 2);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true
        );
        for (const locator of [page.getByLabel('Device voice'), page.getByLabel('Speed'), button])
          assert.ok((await locator.boundingBox()).height >= 44);
        await page.evaluate(() => window.handle.unmount());
        assert.equal(await page.locator('main').textContent(), '');
        assert.equal(await page.locator('main link').count(), 0);
        await page.close();
      }
      console.log(
        'Browser checks passed at 320, 390 and 1280px: keyboard, sequencing, Stop, 44px targets, no overflow, cleanup; device API trapped.'
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
