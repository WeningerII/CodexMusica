// Natural-scheduling keyboard-rise regressions, complementing the held-frame suite.
// wheel + tap is not a real finger drag, and the viewport stub is not pinch zoom.
/* global window, document, localStorage, requestAnimationFrame, innerHeight, LY, UI, lyDraft, lyRefresh, uiSaveLyrics, pushHistory */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(process.env.TEST_ROOT || path.join(__dirname, '..'));
const out = process.env.TEST_EVIDENCE || '/tmp/ui-natural-correction/run';
const html = process.env.TEST_HTML || path.join(root, 'codex.html');
fs.mkdirSync(out, { recursive: true });
const text =
  '[VERSE — 40 lines]\n' +
  Array.from({ length: 40 }, (_, i) => `I sing the quiet song ${i + 1}`).join('\n');
const errors = [],
  results = [];
const check = (ok, message) => {
  if (!ok) errors.push(message);
};
const settle = async (p) => {
  await p.waitForTimeout(100);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};
(async () => {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const executablePath =
    base &&
    fs
      .readdirSync(base)
      .filter((n) => /^chromium-\d+$/.test(n))
      .map((n) => path.join(base, n, 'chrome-linux/chrome'))
      .find(fs.existsSync);
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const open = async (width = 390, height = 844, stub = false) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 960,
      hasTouch: width < 960,
    });
    const posts = [];
    await ctx.route('**/*', async (route) => {
      const req = route.request(),
        u = new URL(req.url());
      if (u.hostname === '127.0.0.1') {
        const f =
          u.pathname === '/codex.html'
            ? html
            : path.resolve(root, '.' + decodeURIComponent(u.pathname));
        if (
          (f === html || f.startsWith(root + path.sep)) &&
          fs.existsSync(f) &&
          fs.statSync(f).isFile()
        )
          return route.fulfill({ path: f });
        return route.fulfill({ status: 404 });
      }
      if (u.hostname === 'mcp.codexmusica.com') {
        if (req.method() === 'POST') posts.push(req.url());
        return route.fulfill({ json: { ok: true, enabled: true } });
      }
      return route.abort();
    });
    await ctx.addInitScript((stub) => {
      localStorage.setItem('codex-theme', 'light');
      if (stub) {
        const v = new EventTarget();
        Object.assign(v, { width: 390, height: 844, offsetTop: 0, offsetLeft: 0, scale: 1 });
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: v });
      }
    }, stub);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await p.goto('http://127.0.0.1/codex.html#lyrics');
    await p.waitForFunction(() => typeof LY !== 'undefined' && LY.model && UI.ready);
    await p.evaluate((t) => {
      lyDraft().value = t;
      uiSaveLyrics();
      pushHistory();
      lyRefresh(true);
    }, text);
    p.finish = async () => {
      check(posts.length === 0, 'fixture sent a POST');
      await ctx.close();
    };
    return p;
  };
  const caret = (p) =>
    p.evaluate(() => {
      const t = lyDraft(),
        i =
          t.value
            .slice(0, t.selectionDirection === 'forward' ? t.selectionEnd : t.selectionStart)
            .split('\n').length - 1;
      const row = document.querySelector(`#ly-overlay .ly-r[data-i="${i}"]`),
        r = row.getBoundingClientRect();
      const tr = (row.querySelector('.ly-t') || row).getBoundingClientRect();
      const hit = document.elementFromPoint(tr.left + 10, (r.top + r.bottom) / 2);
      const over = ['ly-linedock', 'ly-mnav'].filter((id) => {
        const e = document.getElementById(id);
        if (!e || e.hidden) return false;
        const q = e.getBoundingClientRect();
        return q.height && r.bottom > q.top && r.top < q.bottom;
      });
      return {
        line: i,
        top: r.top,
        bottom: r.bottom,
        over,
        hit: hit?.id || hit?.className,
        ok: r.top >= 0 && r.bottom <= innerHeight && !over.length && hit === t,
        scroll: Object.fromEntries(
          ['surface-lyrics', 'ly-page', 'ly-body', 'ly-main-scroll'].map((id) => [
            id,
            document.getElementById(id).scrollTop,
          ])
        ),
        focused: document.activeElement === t,
        dock: (() => {
          const r = document.getElementById('ly-linedock').getBoundingClientRect();
          return { top: r.top, bottom: r.bottom };
        })(),
      };
    });
  const select = async (p, n, how = 'set') => {
    if (how === 'set')
      await p.evaluate((n) => {
        const t = lyDraft(),
          off = t.value.split('\n').slice(0, n).join('\n').length + 1;
        t.setSelectionRange(off, off);
        t.focus();
      }, n);
    else {
      const point = await p.evaluate((n) => {
        const row = document.querySelector(`#ly-overlay .ly-r[data-n="${n}"]`);
        row.scrollIntoView({ block: 'center' });
        const r = row.querySelector('.ly-t').getBoundingClientRect();
        return { x: r.left + 8, y: (r.top + r.bottom) / 2 };
      }, n);
      await p.touchscreen.tap(point.x, point.y);
    }
    await settle(p);
  };
  try {
    const cases = [9, 30].flatMap((line) =>
      ['type', 'arrow'].flatMap((mode) => [0, 16, 33, 100].map((delay) => ({ line, mode, delay })))
    );
    cases.push(
      ...['type-wheel', 'type-navigate'].flatMap((mode) =>
        [0, 16].map((delay) => ({ line: 30, mode, delay }))
      )
    );
    for (let trial = 0; trial < Number(process.env.TEST_REPEATS || 2); trial++)
      for (const { line, mode, delay } of cases) {
        const p = await open();
        await select(p, line);
        const before = await caret(p);
        await p.mouse.move(180, 420);
        const original = await p.evaluate(() => ({
          text: lyDraft().value,
          offset: lyDraft().selectionStart,
        }));
        await p.evaluate(() => {
          const t = lyDraft(),
            start = performance.now();
          window.__order = [];
          const log = (kind, extra = {}) =>
            window.__order.push({
              kind,
              ms: performance.now() - start,
              selection: [t.selectionStart, t.selectionEnd],
              scroll: ['ly-page', 'ly-body'].map((id) => document.getElementById(id).scrollTop),
              ...extra,
            });
          // Observe native scheduling without holding, rescheduling, or invoking callbacks early.
          const raf = window.requestAnimationFrame.bind(window);
          let serial = 0,
            executing = null;
          window.requestAnimationFrame = (callback) => {
            const id = ++serial,
              parent = executing;
            const source = callback.toString();
            const phase = /const\s+firstScroller/.test(source)
              ? 'reveal-first'
              : /revealPending\s*=\s*false/.test(source)
                ? 'reveal-second'
                : 'other';
            log('raf-schedule', { id, parent, phase });
            return raf((time) => {
              executing = id;
              log('raf-start', { id, parent, phase });
              try {
                return callback(time);
              } finally {
                log('raf-end', { id, parent, phase });
                executing = null;
              }
            });
          };
          window.addEventListener('resize', () => log('resize'), true);
          window.visualViewport.addEventListener('resize', () => log('visual-resize'), true);
          for (const name of ['keydown', 'keyup', 'beforeinput', 'input'])
            t.addEventListener(
              name,
              (event) => log(name, { key: event.key, data: event.data }),
              true
            );
          document.addEventListener(
            'wheel',
            (event) => {
              const scroller = document.getElementById('ly-page');
              window.__wheelIntent = Math.max(
                0,
                Math.min(
                  scroller.scrollHeight - scroller.clientHeight,
                  scroller.scrollTop + event.deltaY
                )
              );
              log('wheel', {
                target: event.target.id,
                deltaY: event.deltaY,
                expectedScroll: window.__wheelIntent,
              });
            },
            { capture: true, passive: true }
          );
          document.addEventListener('selectionchange', () => log('selectionchange'));
          document.addEventListener(
            'scroll',
            (event) => log('scroll', { target: event.target.id }),
            true
          );
        });
        await p.setViewportSize({ width: 390, height: 508 });
        // Delays label requested timing only. Actual phase is derived from event logs below.
        if (delay) await p.waitForTimeout(delay);
        if (mode.startsWith('type')) await p.keyboard.type('xy');
        else await p.keyboard.press('ArrowRight');
        if (mode === 'type-navigate') await p.keyboard.press('Control+Home');
        if (mode === 'type-wheel') {
          await p.mouse.wheel(0, 600);
          await p.waitForFunction(() => window.__wheelIntent !== undefined, null, { polling: 10 });
        }
        const intended = mode.includes('-')
          ? await p.evaluate(() => ({
              scroll: window.__wheelIntent ?? document.getElementById('ly-page').scrollTop,
              selection: [lyDraft().selectionStart, lyDraft().selectionEnd],
            }))
          : null;
        await p.waitForTimeout(400);
        const after = await caret(p);
        const state = await p.evaluate(() => ({
          text: lyDraft().value,
          selection: [lyDraft().selectionStart, lyDraft().selectionEnd],
          order: window.__order,
        }));
        const first = state.order.findIndex(
          (e) => e.kind === 'raf-start' && e.phase === 'reveal-first'
        );
        const second = state.order.findIndex(
          (e) => e.kind === 'raf-start' && e.phase === 'reveal-second'
        );
        const key = state.order.findIndex((e) => e.kind === 'keydown');
        const actualPhase =
          first < 0 || second < 0
            ? 'unclassified'
            : key < first
              ? 'before-first'
              : key < second
                ? 'between-frames'
                : 'after-second';
        const expected = mode.startsWith('type')
          ? original.text.slice(0, original.offset) + 'xy' + original.text.slice(original.offset)
          : original.text;
        const offset =
          mode === 'type-navigate' ? 0 : original.offset + (mode.startsWith('type') ? 2 : 1);
        check(
          state.text === expected && state.selection.every((x) => x === offset),
          `L${line} ${mode} d${delay} text/selection changed`
        );
        if (intended)
          check(
            after.scroll['ly-page'] === intended.scroll &&
              state.selection.every((x, i) => x === intended.selection[i]),
            `L${line} ${mode} d${delay} overrode intent`
          );
        else
          check(
            after.line === line && after.ok,
            `L${line} ${mode} d${delay} caret obscured (${actualPhase})`
          );
        results.push({ trial, intended, line, mode, delay, actualPhase, before, after, ...state });
        console.log(
          JSON.stringify({
            line,
            mode,
            delay,
            actualPhase,
            ok: after.ok,
            top: after.top,
            bottom: after.bottom,
          })
        );
        await p.finish();
      }
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(out, 'results.json'),
      JSON.stringify(
        {
          root,
          bundleSha256: require('node:crypto')
            .createHash('sha256')
            .update(fs.readFileSync(html))
            .digest('hex'),
          results,
          errors,
        },
        null,
        2
      )
    );
  }
  console.log(JSON.stringify({ cases: results.length, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
