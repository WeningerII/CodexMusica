// Focused local UI regressions. Viewport resizing emulates keyboard rise;
// wheel + tap is not a real finger drag, and the viewport stub is not pinch zoom.
/* global WheelEvent, window, document, localStorage, requestAnimationFrame, innerHeight, getComputedStyle, LY, UI, lyDraft, lyRefresh, uiSaveLyrics, pushHistory, lyDraftSet, lyPendingAll */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(process.env.TEST_ROOT || path.join(__dirname, '..'));
const out = process.env.TEST_EVIDENCE || '/tmp/ui-three-evidence';
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
  const reading = (p, line) =>
    p.evaluate((line) => {
      const t = lyDraft(),
        rows = [...document.querySelectorAll('#ly-overlay .ly-r-sung')];
      const visible = rows.filter((row) => {
        const r = row.getBoundingClientRect(),
          q = row.querySelector('.ly-t').getBoundingClientRect();
        return document.elementFromPoint(q.left + 10, r.top + r.height / 2) === t;
      });
      const row = line ? document.querySelector(`#ly-overlay .ly-r[data-n="${line}"]`) : visible[0];
      const r = row?.getBoundingClientRect();
      return {
        line: row ? Number(row.dataset.n) : null,
        top: r?.top,
        bottom: r?.bottom,
        scroll: Object.fromEntries(
          ['ly-page', 'ly-body', 'ly-main-scroll'].map((id) => [
            id,
            document.getElementById(id).scrollTop,
          ])
        ),
        focused: document.activeElement === t,
        selection: [t.selectionStart, t.selectionEnd, t.selectionDirection],
        text: t.value,
      };
    }, line);
  try {
    {
      const p = await open();
      await p.evaluate(() => {
        lyDraft().blur();
        const row = document.querySelector('#ly-overlay .ly-r[data-n="27"]');
        document.getElementById('ly-body').scrollTop += row.getBoundingClientRect().top - 430;
      });
      await settle(p);
      const before = await reading(p, 27);
      check(
        !before.focused && Math.abs(before.top - 430) < 1,
        'unfocused reading fixture did not establish line27 at430'
      );
      await p.setViewportSize({ width: 390, height: 508 });
      await settle(p);
      const short = await reading(p, 27);
      await p.setViewportSize({ width: 390, height: 844 });
      await settle(p);
      const restored = await reading(p, 27);
      check(
        Math.abs(short.top - before.top) < 1 && Math.abs(restored.top - before.top) < 1,
        'unfocused scroller switch lost reading position'
      );
      check(
        short.text === before.text &&
          restored.text === before.text &&
          JSON.stringify(short.selection) === JSON.stringify(before.selection),
        'unfocused resize changed document/selection'
      );
      results.push({ kind: 'reading-switch', before, short, restored });
      await p.finish();
    }
    for (const height of [800, 508]) {
      const p = await open();
      await select(p, 1);
      const initially = await caret(p);
      check(initially.ok, 'scroll-away fixture caret initially obstructed');
      await p.mouse.move(195, 500);
      await p.mouse.wheel(0, 600);
      await settle(p);
      const away = await caret(p),
        before = await reading(p);
      check(
        !away.ok && away.focused && !!before.line,
        'scroll-away fixture did not move away from focused caret'
      );
      await p.setViewportSize({ width: 390, height });
      await settle(p);
      const after = await reading(p, before.line),
        afterCaret = await caret(p);
      check(
        Math.abs(after.top - before.top) < 1,
        `deliberate scroll-away snapped during resize to${height}`
      );
      if (height === 800)
        check(
          after.scroll['ly-body'] === before.scroll['ly-body'],
          'same-scroller resize changed deliberate scroll'
        );
      check(
        !afterCaret.ok &&
          after.focused &&
          JSON.stringify(after.selection) === JSON.stringify(before.selection) &&
          after.text === before.text,
        'scroll-away resize changed caret/document'
      );
      results.push({ kind: 'scroll-away', height, initially, away, before, after, afterCaret });
      await p.finish();
    }
    {
      const p = await open();
      await p.evaluate(() => {
        const t = lyDraft(),
          lines = t.value.split('\n'),
          start = lines[0].length + 3,
          end = lines.slice(0, 9).join('\n').length + 9;
        t.setSelectionRange(start, end, 'forward');
        t.focus();
      });
      await settle(p);
      // Establish a genuinely visible active endpoint before keyboard rise.
      await p.mouse.move(195, 500);
      await p.mouse.wheel(0, 250);
      await settle(p);
      const before = await caret(p),
        saved = await reading(p, 9);
      check(before.line === 9 && before.ok, 'forward-selection fixture active end not clear');
      await p.setViewportSize({ width: 390, height: 508 });
      await settle(p);
      const after = await caret(p),
        state = await reading(p, 9);
      check(after.line === 9 && after.ok, 'forward selection active end not revealed');
      check(
        JSON.stringify(state.selection) === JSON.stringify(saved.selection) &&
          state.text === saved.text,
        'forward-selection resize changed selection/document'
      );
      results.push({ kind: 'forward-selection', before, after, saved, state });
      await p.finish();
    }
    for (const mode of ['early-wheel-intent', 'wheel-intent', 'selection-intent']) {
      const p = await open(390, 844, true);
      await select(p, 1);
      const before = await caret(p);
      check(before.ok, 'queued intent fixture caret not initially visible');
      const intended = await p.evaluate(async (mode) => {
        window.visualViewport.height = 508;
        window.visualViewport.dispatchEvent(new Event('resize'));
        if (mode !== 'early-wheel-intent')
          await new Promise((resolve) => requestAnimationFrame(resolve));
        const sc = document.getElementById('ly-body'),
          t = lyDraft();
        if (mode === 'wheel-intent' || mode === 'early-wheel-intent') {
          // Explicit synthetic wheel + scroll models user intent between the
          // queued frames (or before frame1); native layout scroll alone is not this case.
          sc.dispatchEvent(new WheelEvent('wheel', { deltaY: 600, bubbles: true }));
          sc.scrollTop += 600;
          sc.dispatchEvent(new Event('scroll'));
        } else {
          const at = t.value.split('\n').slice(0, 30).join('\n').length + 1;
          t.setSelectionRange(at, at);
          document.dispatchEvent(new Event('selectionchange'));
        }
        return {
          scroll: sc.scrollTop,
          selection: [t.selectionStart, t.selectionEnd],
          text: t.value,
        };
      }, mode);
      await settle(p);
      const after = await reading(p),
        afterCaret = await caret(p);
      check(
        after.scroll['ly-body'] === intended.scroll,
        `queued ${mode} was overwritten by resize`
      );
      check(
        JSON.stringify(after.selection.slice(0, 2)) === JSON.stringify(intended.selection) &&
          after.text === intended.text,
        `queued ${mode} changed selection/document`
      );
      results.push({ kind: 'queued-intent', mode, before, intended, after, afterCaret });
      await p.finish();
    }
    for (const mode of [
      'early-type',
      'between-type',
      'early-arrow',
      'between-arrow',
      'navigate',
      'select-range',
      'type-navigate',
      'navigate-type',
    ]) {
      const p = await open();
      await select(p, 30);
      const before = await caret(p);
      check(before.line === 30 && before.focused, 'queued typing fixture not on focused line30');
      await p.evaluate(() => {
        window.__resizeFrames = [];
        window.__nativeFrame = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (callback) => {
          window.__resizeFrames.push(callback);
          return window.__resizeFrames.length;
        };
      });
      // Hold application animation frames, not native keyboard events. Resize
      // performs actual CSS reflow; the explicit frame queue controls ordering.
      await p.setViewportSize({ width: 390, height: 508 });
      await p.waitForFunction(() => window.__resizeFrames.length > 0, null, {
        polling: 10,
        timeout: 5000,
      });
      const firstQueued = await p.evaluate(() => window.__resizeFrames.length);
      if (mode !== 'early-type' && mode !== 'early-arrow')
        await p.evaluate(
          () =>
            new Promise((resolve) =>
              window.__nativeFrame((time) => {
                const callbacks = window.__resizeFrames.splice(0);
                callbacks.forEach((callback) => callback(time));
                resolve();
              })
            )
        );
      const pending = await p.evaluate(() => window.__resizeFrames.length);
      check(pending > 0, `queued ${mode} had no deferred frame`);
      if (mode === 'early-type' || mode === 'between-type' || mode === 'type-navigate')
        await p.keyboard.type('xy');
      if (mode === 'navigate' || mode === 'type-navigate' || mode === 'navigate-type')
        await p.keyboard.press('Control+Home');
      if (mode === 'early-arrow' || mode === 'between-arrow') await p.keyboard.press('ArrowRight');
      if (mode === 'select-range') await p.keyboard.press('Control+Shift+Home');
      if (mode === 'navigate-type') await p.keyboard.type('xy');
      const intended = await reading(p, 30),
        intendedCaret = await caret(p);
      await p.evaluate(() => {
        window.requestAnimationFrame = window.__nativeFrame;
        const callbacks = window.__resizeFrames.splice(0);
        callbacks.forEach((callback) => window.requestAnimationFrame(callback));
      });
      await settle(p);
      const after = await reading(p, 30),
        afterCaret = await caret(p);
      check(
        after.text === intended.text &&
          JSON.stringify(after.selection) === JSON.stringify(intended.selection),
        `queued ${mode} changed typed text or selection`
      );
      if (['early-type', 'between-type', 'early-arrow', 'between-arrow'].includes(mode))
        check(afterCaret.line === 30 && afterCaret.ok, `queued ${mode} left typing caret obscured`);
      else
        check(
          JSON.stringify(after.scroll) === JSON.stringify(intended.scroll),
          `queued ${mode} overrode deliberate keyboard position`
        );
      results.push({
        kind: 'queued-typing',
        mode,
        firstQueued,
        pending,
        before,
        intended,
        intendedCaret,
        after,
        afterCaret,
      });
      await p.finish();
    }
    for (const n of [1, 9, 30])
      for (const how of ['set', 'touch']) {
        const p = await open();
        await select(p, n, how);
        const before = await caret(p);
        // This fixture's natural L30 set+focus partially overlaps the dock on
        // both baseline and repaired trees. Keep its geometry in evidence;
        // keyboard-rise acceptance starts with the following resize.
        check(
          await p.evaluate(
            () =>
              getComputedStyle(document.getElementById('surface-lyrics')).paddingBottom === '0px'
          ),
          'surface gained padding that can raise the line dock'
        );
        check(
          before.line === n && (before.ok || (n === 30 && how === 'set')),
          `before rise line ${n}/${how} is obstructed or wrong`
        );
        await p.setViewportSize({ width: 390, height: 508 });
        await settle(p);
        const rise = await caret(p);
        check(rise.line === n && rise.ok, `after rise line ${n}/${how} is obstructed`);
        await p.keyboard.type('x');
        await settle(p);
        const typed = await caret(p);
        check(typed.ok, `after typing line ${n}/${how} is obstructed`);
        results.push({ kind: 'rise', n, how, before, rise, typed });
        await p.finish();
      }
    {
      // A visualViewport-only shrink at scale 1, with no window resize.
      const p = await open(390, 844, true);
      await select(p, 9);
      const before = await caret(p);
      await p.evaluate(() => {
        window.visualViewport.height = 508;
        window.visualViewport.dispatchEvent(new Event('resize'));
      });
      await settle(p);
      const after = await caret(p);
      check(
        before.bottom > 508 &&
          after.ok &&
          after.bottom <= 508 &&
          after.focused &&
          JSON.stringify(before.scroll) !== JSON.stringify(after.scroll),
        'visualViewport-only keyboard rise did not reveal caret'
      );
      check(
        (await p.evaluate(() => lyDraft().value)) === text,
        'visualViewport-only rise changed draft'
      );
      results.push({ kind: 'visualViewport-rise', before, after });
      await p.finish();
    }
    for (const mode of ['pinch', 'queued-pinch', 'unfocused', 'queued-blur']) {
      const p = await open(390, 844, true);
      await select(p, 30);
      const before = await caret(p);
      await p.evaluate(async (mode) => {
        const v = window.visualViewport;
        if (mode === 'unfocused') lyDraft().blur();
        v.height = 422;
        if (mode === 'pinch') v.scale = 2;
        v.dispatchEvent(new Event('resize'));
        if (mode.startsWith('queued')) await new Promise((r) => requestAnimationFrame(r));
        if (mode === 'queued-pinch') v.scale = 2;
        if (mode === 'queued-blur') lyDraft().blur();
      }, mode);
      await settle(p);
      const after = await caret(p);
      check(JSON.stringify(before.scroll) === JSON.stringify(after.scroll), `${mode} moved scroll`);
      results.push({ kind: 'guard', mode, before, after });
      await p.finish();
    }
    for (const [width, height, mode] of [
      [390, 508, 'wheel'],
      [390, 508, 'tab'],
      [390, 844, 'tab'],
      [1180, 757, 'tab'],
    ]) {
      const p = await open(width, height);
      await p.evaluate(() => {
        lyDraftSet('rhythm', '0', 'meter', '6/8');
        lyRefresh(true);
      });
      if (width < 960) await p.tap('#ly-mtab-review');
      else await p.locator('[data-ui="ly-tab"][data-id="review"]').first().click();
      await settle(p);
      const selector = '#ly-panel-review [data-ui="ly-run-review"]';
      const buttonPos = (selector) =>
        p.evaluate((selector) => {
          const e = document.querySelector(selector);
          if (!e) return null;
          const r = e.getBoundingClientRect(),
            x = (r.left + r.right) / 2,
            y = (r.top + r.bottom) / 2,
            h = document.elementFromPoint(x, y);
          return { x, y, top: r.top, bottom: r.bottom, hit: !!h && (h === e || e.contains(h)) };
        }, selector);
      if (mode === 'wheel') {
        for (let k = 0; k < 12; k++) {
          const b = await buttonPos(selector);
          if (b?.hit) break;
          await p.mouse.move(width / 2, 400);
          await p.mouse.wheel(0, 150);
          await settle(p);
        }
        const b = await buttonPos(selector);
        check(b?.hit, 'panel opener unreachable by wheel');
        if (b?.hit) await p.touchscreen.tap(b.x, b.y);
      } else {
        await p.locator(selector).focus();
        await p.keyboard.press('Enter');
      }
      await settle(p);
      check(await p.evaluate(() => !!LY.gate), `gate failed to open ${width}/${height}/${mode}`);
      const close = '[data-ui="ly-gate-close"]',
        before = await buttonPos(close);
      if (mode === 'wheel')
        for (let k = 0; k < 8; k++) {
          const b = await buttonPos(close);
          if (b?.hit) break;
          await p.mouse.move(width / 2, Math.max(120, Math.min(b?.top + 5 || 250, 400)));
          await p.mouse.wheel(0, b && b.top < 108 ? -200 : 200);
          await settle(p);
        }
      else
        for (
          let k = 0;
          k < 6 && !(await p.evaluate(() => document.activeElement.dataset.ui === 'ly-gate-close'));
          k++
        )
          await p.keyboard.press('Tab');
      const after = await buttonPos(close);
      check(after?.hit, `Cancel unreachable ${width}/${height}/${mode}`);
      await p.screenshot({ path: path.join(out, `gate-${width}-${height}-${mode}.png`) });
      if (mode === 'wheel' && after?.hit) await p.touchscreen.tap(after.x, after.y);
      else await p.keyboard.press('Enter');
      await settle(p);
      const done = await p.evaluate(() => ({
        gate: !!LY.gate,
        panel: document.activeElement.closest('#ly-panel-review')?.id,
        action: document.activeElement.dataset.ui,
        review: LY.tab,
        pending: lyPendingAll(),
        draft: lyDraft().value,
      }));
      check(
        !done.gate && done.panel === 'ly-panel-review' && done.action === 'ly-run-review',
        `Cancel lost panel opener ${width}/${height}/${mode}`
      );
      check(
        done.review === 'review' && done.pending === 1,
        `Cancel changed review tab or pending draft ${mode}`
      );
      done.opener = await buttonPos(selector);
      await p.screenshot({ path: path.join(out, `opener-${width}-${height}-${mode}.png`) });
      check(done.opener?.hit, `restored panel opener obstructed ${width}/${height}/${mode}`);
      check(done.draft === text, `gate changed draft ${mode}`);
      results.push({ kind: 'gate', width, height, mode, before, after, done });
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
