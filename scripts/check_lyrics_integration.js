// Offline integration journeys for the shared lyrics shell.
// Chromium viewport emulation is not real-device keyboard or zoom acceptance.
/* global window, document, localStorage, requestAnimationFrame, innerHeight, innerWidth, LY, UI, lyDraft, lyRefresh, uiSaveLyrics, pushHistory */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(process.env.TEST_ROOT || path.join(__dirname, '..'));
const out = process.env.TEST_EVIDENCE || '/tmp/lyrics-integration-evidence';
const html = process.env.TEST_HTML || path.join(root, 'codex.html');
fs.mkdirSync(out, { recursive: true });
const text =
  '[VERSE — 12 lines]\n' +
  Array.from({ length: 12 }, (_, i) => `I sing the quiet song ${i + 1}`).join('\n');
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
  const geometry = (locator) =>
    locator.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        hit: hit?.id || hit?.className,
        reachable:
          r.width > 0 &&
          r.height > 0 &&
          r.left >= 0 &&
          r.right <= innerWidth &&
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          !!hit &&
          (hit === el || el.contains(hit)),
      };
    });
  const tab = async (p, id) => {
    const narrow = await p.evaluate(() => LY.size === 'narrow');
    await p.locator(narrow ? `#ly-mtab-${id}` : `#ly-tab-${id}`).click();
    await settle(p);
  };
  try {
    if (process.env.TEST_SECTION !== 'menu')
      for (const [width, height] of [
        [1180, 757],
        [390, 844],
        [390, 508],
        [844, 390],
      ]) {
        const p = await open(width, height);
        const record = { width, height, checks: [] };
        const verify = (ok, label) => {
          check(ok, `${width}x${height}: ${label}`);
          record.checks.push({ label, ok });
        };
        await tab(p, 'writer');
        const composer = p.locator('#chat-input');
        record.composerOnEntry = await geometry(composer);
        record.sendOnEntry = await geometry(p.locator('#chat-send'));
        verify(record.composerOnEntry.reachable, 'composer reachable on Writer entry');
        verify(record.sendOnEntry.reachable, 'Send reachable on Writer entry before fill');
        const unsent = 'Keep this unsent lyric request — café and moonlight.';
        await composer.fill(unsent);
        await settle(p);
        record.composer = await geometry(composer);
        record.send = await geometry(p.locator('#chat-send'));
        verify(record.composer.reachable, 'composer immediately reachable');
        verify(record.send.reachable, 'Send immediately visible and hit-testable');
        verify(await p.locator('#chat-send').isEnabled(), 'Send enabled for unsent text');
        await p.screenshot({ path: path.join(out, `${width}x${height}-writer.png`) });
        await tab(p, 'tools');
        await tab(p, 'writer');
        verify((await composer.inputValue()) === unsent, 'unsent text survives Tools roundtrip');
        await p.locator('#ly-writer-status [data-ui="ly-tab"][data-id="history"]').click();
        await settle(p);
        verify(await p.evaluate(() => LY.tab === 'history'), 'History opens');
        await tab(p, 'writer');
        verify((await composer.inputValue()) === unsent, 'unsent text survives History roundtrip');
        await tab(p, 'review');
        verify(
          (await p.locator('[data-ui="ly-run-review"]:visible').count()) === 1,
          'exactly one visible Run review in Review'
        );
        const narrow = await p.evaluate(() => LY.size === 'narrow');
        if (narrow) await tab(p, 'song');
        // Exercise a local download rather than invoking a writer request.
        const songActions = p.getByRole('button', { name: 'Song actions', exact: true });
        await songActions.click();
        const downloadButton = p.locator('[data-ui="ly-download"]:visible');
        record.songMenu = await geometry(p.locator('#ly-menu-song-actions'));
        verify(record.songMenu.reachable, 'Song actions menu is within viewport and hit-testable');
        record.downloadInitial = await geometry(downloadButton);
        record.download = record.downloadInitial;
        for (let attempt = 0; attempt < 3 && !record.download.reachable; attempt++) {
          const box = await p.locator('#ly-menu-song-actions').boundingBox();
          await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await p.mouse.wheel(0, 500);
          await settle(p);
          record.download = await geometry(downloadButton);
        }
        verify(
          record.download.reachable,
          'Song actions download is reachable after menu scrolling'
        );
        const pendingDownload = p.waitForEvent('download');
        await downloadButton.click();
        const download = await pendingDownload;
        const file = await download.path();
        verify(
          fs.readFileSync(file, 'utf8').includes('I sing the quiet song 1'),
          'Song actions downloads current song'
        );
        verify((await composer.inputValue()) === unsent, 'song action preserves unsent composer');
        const prior = await p.locator('#lyrics-draft').inputValue();
        await p.locator('#lyrics-draft').fill(prior + '\nA local edit to undo');
        await p.locator('#lyrics-draft').blur();
        await settle(p);
        const edited = await p.locator('#lyrics-draft').inputValue();
        const trigger = p.locator('#ly-linedock [data-ui="ly-menu"]');
        if (narrow) await trigger.click();
        const historyScope = narrow ? '#ly-menu-line-actions' : '#ly-toolbar';
        const undo = p.locator(`${historyScope} [data-ui="ly-undo"]`);
        if (!narrow) await undo.scrollIntoViewIfNeeded();
        record.undo = await geometry(undo);
        verify(record.undo.reachable, 'Undo is visible and hit-testable in its viewport control');
        await undo.click();
        await settle(p);
        verify(
          (await p.locator('#lyrics-draft').inputValue()) !== edited,
          'Line actions Undo changes draft'
        );
        if (narrow) await trigger.click();
        await p.locator(`${historyScope} [data-ui="ly-redo"]`).click();
        await settle(p);
        verify(
          (await p.locator('#lyrics-draft').inputValue()) === edited,
          'Line actions Redo restores edit'
        );
        verify((await composer.inputValue()) === unsent, 'Undo/Redo preserve unsent composer');
        results.push(record);
        await p.finish();
      }
    if (process.env.TEST_SECTION !== 'journey') {
      const menuCases = [844, 508].flatMap((height) =>
        [1, 30, 55].map((line) => ({ height, line, size: '0' }))
      );
      menuCases.push(
        { height: 508, line: 30, size: '2' },
        { height: 260, line: 30, size: '2', fallback: true },
        { height: 844, line: 30, size: '0', resizeTo: 508 }
      );
      for (const { height, line, size, fallback = false, resizeTo } of menuCases) {
        const p = await open(390, height);
        await p.evaluate(
          ({ line, size }) => {
            const t = lyDraft();
            t.value =
              '[VERSE]\n' +
              Array.from({ length: 60 }, (_, i) => `I sing the quiet song ${i + 1}`).join('\n');
            uiSaveLyrics();
            pushHistory();
            LY.prefs.size.set(size);
            lyRefresh(true);
            const offset = t.value.split('\n').slice(0, line).join('\n').length + 1;
            t.setSelectionRange(offset, offset);
            t.focus();
          },
          { line, size }
        );
        await settle(p);
        const before = await p.evaluate(() => ({
          text: lyDraft().value,
          selection: [lyDraft().selectionStart, lyDraft().selectionEnd],
          dockHeight: document.getElementById('ly-linedock').getBoundingClientRect().height,
        }));
        await p.locator('#ly-linedock [data-ui="ly-menu"]').click();
        await settle(p);
        if (resizeTo) {
          await p.evaluate(() => {
            window.__menuFocus = document.activeElement;
          });
          await p.setViewportSize({ width: 390, height: resizeTo });
          await settle(p);
        }
        const geometry = await p.evaluate(() => {
          const menu = document.getElementById('ly-menu-line-actions'),
            draft = lyDraft();
          const i = draft.value.slice(0, draft.selectionStart).split('\n').length - 1;
          const row = document
              .querySelector(`#ly-overlay .ly-r[data-i="${i}"]`)
              .getBoundingClientRect(),
            r = menu.getBoundingClientRect();
          const bounds = (x) => ({
            top: x.top,
            bottom: x.bottom,
            left: x.left,
            right: x.right,
            height: x.height,
          });
          return {
            menu: bounds(r),
            row: bounds(row),
            onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
            focusPreserved: !window.__menuFocus || document.activeElement === window.__menuFocus,
            rowVisible:
              row.top >= 0 &&
              row.bottom <= innerHeight &&
              document.elementFromPoint(row.left + 10, (row.top + row.bottom) / 2) === draft,
            overlap:
              r.bottom > row.top + 1 &&
              r.top < row.bottom - 1 &&
              r.right > row.left &&
              r.left < row.right,
            itemHits: [...menu.querySelectorAll('[role="menuitem"]')].map((e) => {
              const q = e.getBoundingClientRect(),
                hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
              return { label: e.textContent.trim(), hit: hit === e || e.contains(hit) };
            }),
            statuses: [...menu.querySelectorAll('[role="status"]')].map((e) =>
              e.textContent.trim()
            ),
            selection: [draft.selectionStart, draft.selectionEnd],
            text: draft.value,
            overflowX: document.documentElement.scrollWidth > innerWidth,
          };
        });
        const label = `menu390x${height}${resizeTo ? '-to-' + resizeTo : ''} L${line} size${size}`;
        check(geometry.onScreen, `${label} menu outside viewport`);
        check(!geometry.overflowX, `${label} horizontal overflow`);
        check(
          before.text === geometry.text &&
            JSON.stringify(before.selection) === JSON.stringify(geometry.selection),
          `${label} changed draft/selection`
        );
        if (resizeTo) check(geometry.focusPreserved, `${label} changed menu focus`);
        if (resizeTo)
          check(geometry.rowVisible, `${label} caret row no longer visible after resize`);
        if (size === '0') check(before.dockHeight <= 61.5, `${label} dock exceeds61px`);
        if (fallback)
          check(geometry.statuses.some(Boolean), `${label} lacks explicit cramped-space status`);
        else {
          check(!geometry.overlap, `${label} menu covers caret row`);
          check(
            geometry.itemHits.every((item) => item.hit),
            `${label} menu action intercepted`
          );
        }
        results.push({ kind: 'menu', height, resizeTo, line, size, fallback, before, ...geometry });
        await p.screenshot({
          path: path.join(
            out,
            `menu-${height}${resizeTo ? '-to-' + resizeTo : ''}-L${line}-size${size}.png`
          ),
        });
        await p.keyboard.press('Escape');
        check(
          !(await p.locator('#ly-menu-line-actions').isVisible()),
          `${label} Escape did not close menu`
        );
        await p.finish();
      }
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
