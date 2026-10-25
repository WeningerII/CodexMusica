// I8 local readability regression. Explicit computed text enlargement is not native browser zoom.
/* global document, getComputedStyle, localStorage, innerWidth, innerHeight, LY, UI, app, lyDraft, lyRefresh, uiSaveLyrics, pushHistory */
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(process.env.TEST_ROOT || path.join(__dirname, '..'));
const html = process.env.TEST_HTML || path.join(root, 'codex.html');
const bytes = fs.readFileSync(html);
const out = process.env.TEST_EVIDENCE || '/tmp/lyrics-i8-after';
fs.mkdirSync(out, { recursive: true });
const baseline = process.env.TEST_BASELINE
  ? JSON.parse(fs.readFileSync(process.env.TEST_BASELINE, 'utf8'))
  : null;
const text =
  '[VERSE — 12 lines]\n' +
  Array.from({ length: 12 }, (_, i) => `I sing the quiet song ${i + 1}`).join('\n');
const errors = [],
  results = [];
const check = (ok, label) => {
  if (!ok) errors.push(label);
};
const settle = (p) => p.waitForTimeout(150);
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  for (const directory of fs.readdirSync(base)) {
    if (!/^chromium-\d+$/.test(directory)) continue;
    const executable = path.join(base, directory, 'chrome-linux', 'chrome');
    if (fs.existsSync(executable)) return executable;
  }
  return undefined;
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    for (const theme of ['light', 'dark'])
      for (const [height, scale] of [
        [844, 1],
        [508, 1],
        [600, 1],
        [844, 2],
      ]) {
        const label = `${theme}-390x${height}-text${scale}`,
          record = { label, theme, height, scale };
        const context = await browser.newContext({
          viewport: { width: 390, height },
          isMobile: true,
          hasTouch: true,
        });
        const posts = [];
        await context.route('**/*', async (route) => {
          const req = route.request(),
            url = new URL(req.url());
          if (req.method() === 'POST') posts.push(req.url());
          if (url.hostname === '127.0.0.1') {
            if (url.pathname === '/codex.html')
              return route.fulfill({ body: bytes, contentType: 'text/html' });
            const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
            if (
              file.startsWith(root + path.sep) &&
              fs.existsSync(file) &&
              fs.statSync(file).isFile()
            )
              return route.fulfill({ path: file });
            return route.fulfill({ status: 404 });
          }
          if (url.hostname === 'mcp.codexmusica.com')
            return route.fulfill({ json: { ok: true, enabled: true } });
          return route.abort();
        });
        await context.addInitScript((theme) => localStorage.setItem('codex-theme', theme), theme);
        const p = await context.newPage();
        p.setDefaultTimeout(6000);
        p.on('pageerror', (e) => errors.push(label + ' pageerror ' + e.message));
        const geometry = () =>
          p.evaluate(() => {
            const rect = (el) => {
              if (!el || !el.getClientRects().length) return null;
              const r = el.getBoundingClientRect();
              return {
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                bottom: r.bottom,
                right: r.right,
              };
            };
            const dock = rect(document.getElementById('ly-linedock')),
              nav = rect(document.getElementById('ly-mnav'));
            const bottom = Math.min(innerHeight, ...[dock, nav].filter(Boolean).map((r) => r.y));
            const rows = [...document.querySelectorAll('#ly-overlay .ly-r-sung')].map((el) => {
              const r = el.getBoundingClientRect(),
                t = el.querySelector('.ly-t').getBoundingClientRect();
              const hit = document.elementFromPoint(t.left + 8, r.top + r.height / 2);
              const editorHit = hit === lyDraft() || !!hit?.closest('#ly-overlay');
              return {
                line: Number(el.dataset.n),
                top: r.top,
                bottom: r.bottom,
                height: r.height,
                hit: hit?.id || hit?.className || null,
                readable: r.top >= 0 && r.bottom <= bottom && editorHit,
              };
            });
            return {
              bottom,
              dock,
              nav,
              head: rect(document.getElementById('ly-head')),
              body: rect(document.getElementById('ly-body')),
              rows,
              readable: rows.filter((r) => r.readable).length,
              overflow:
                document.documentElement.scrollWidth > innerWidth ||
                document.getElementById('ly-page').scrollWidth > innerWidth,
            };
          });
        try {
          await p.goto('http://127.0.0.1/codex.html#lyrics');
          await p.waitForFunction(() => typeof LY !== 'undefined' && LY.model && UI.ready);
          await p.evaluate(
            ({ text }) => {
              app.workspaceName = 'I8 workspace';
              lyDraft().value = text;
              uiSaveLyrics();
              pushHistory();
              lyRefresh(true);
            },
            { text, scale }
          );
          if (scale === 2) {
            record.textScale = await p.evaluate(() => {
              const selectors = [
                '#ly-head button',
                '#ly-head button span',
                '#ly-head p',
                '#ly-head h2',
                '#ly-menu-song-actions button',
                '#ly-linedock button',
                '#ly-linedock span',
                '#ly-mnav button',
                '#ly-mnav button span',
                '#lyrics-draft',
                '#ly-overlay .ly-t',
                '#ly-overlay .ly-r',
              ];
              const samples = selectors
                .map((selector) => {
                  const el = document.querySelector(selector);
                  if (!el) return null;
                  const style = getComputedStyle(el);
                  return {
                    selector,
                    font: parseFloat(style.fontSize),
                    line: parseFloat(style.lineHeight),
                  };
                })
                .filter(Boolean);
              const style = document.createElement('style');
              style.textContent = samples
                .map(
                  (s) =>
                    `${s.selector}{font-size:${s.font * 2}px!important;${Number.isFinite(s.line) ? `line-height:${s.line * 2}px!important;` : ''}}`
                )
                .join('\n');
              document.head.append(style);
              return samples.map((s) => ({
                ...s,
                after: parseFloat(getComputedStyle(document.querySelector(s.selector)).fontSize),
              }));
            });
            check(
              record.textScale.every((s) => Math.abs(s.after - s.font * 2) < 0.1),
              label + ' measured text doubled'
            );
          }
          await settle(p);
          record.rest = await geometry();
          if (height === 844 && scale === 1)
            check(record.rest.readable >= 4, label + ' at least4 readable lines at rest');
          check(!record.rest.overflow, label + ' no horizontal overflow at rest');
          await p.screenshot({ path: path.join(out, label + '-rest.png') });
          if (height === 844 && scale === 1) {
            const target = await p
              .locator('#ly-overlay .ly-r-sung')
              .first()
              .evaluate((el) => {
                const r = el.getBoundingClientRect(),
                  t = el.querySelector('.ly-t').getBoundingClientRect();
                return { x: t.left + 8, y: r.top + r.height / 2 };
              });
            await p.touchscreen.tap(target.x, target.y);
          } else {
            await p.locator('#lyrics-draft').focus();
            await p.evaluate(
              (start) => lyDraft().setSelectionRange(start, start),
              text.indexOf('I sing') + 1
            );
            await p.keyboard.press('ArrowRight');
          }
          await settle(p);
          record.caret = await geometry();
          if (height === 844 && scale === 1)
            check(record.caret.readable >= 4, label + ' at least4 readable lines with caret');
          check(!record.caret.overflow, label + ' no horizontal overflow with caret');
          if (height <= 600 && baseline) {
            const old = baseline.results.find((r) => r.label === label);
            for (const field of ['head', 'body', 'dock', 'nav'])
              check(
                JSON.stringify(record.rest[field]) === JSON.stringify(old?.rest[field]),
                label + ' unchanged short rest ' + field
              );
            for (const field of ['head', 'body', 'dock', 'nav'])
              check(
                JSON.stringify(record.caret[field]) === JSON.stringify(old?.caret[field]),
                label + ' unchanged short caret ' + field
              );
          }
          await p.screenshot({ path: path.join(out, label + '-caret.png') });
          const opener = p.locator('#ly-head [data-ui="ly-menu"][data-id="song-actions"]');
          record.opener = {
            label: await opener.getAttribute('aria-label'),
            title: await opener.getAttribute('title'),
            description: await opener.evaluate((el) =>
              (el.getAttribute('aria-describedby') || '')
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent || '')
                .join(' ')
            ),
          };
          const workspace = await p.locator('#ly-workspace').isVisible();
          check(
            workspace ||
              /I8 workspace/.test((record.opener.label || '') + ' ' + record.opener.description),
            label + ' workspace information available'
          );
          check(
            /Song actions/.test(record.opener.label || (await opener.innerText())),
            label + ' Song actions accessible name'
          );
          await opener.focus();
          await opener.press('Enter');
          await settle(p);
          const menu = p.locator('#ly-menu-song-actions');
          check(await menu.isVisible(), label + ' keyboard opens Song actions');
          const items = menu.locator('button');
          check((await items.count()) === 10, label + ' all10 menu actions retained');
          record.keyboardItems = [];
          // A menu is one Tab stop: its actions are reached with the arrow
          // keys, and Tab leaves it (Jony #80).
          for (let i = 0; i < (await items.count()); i++) {
            const already = await items.nth(i).evaluate((el) => el === document.activeElement);
            if (!already) await p.keyboard.press('ArrowDown');
            const focused = await items.nth(i).evaluate((el) => el === document.activeElement);
            record.keyboardItems.push({ index: i, focused });
            check(focused, label + ' keyboard menu action ' + i);
          }
          record.menuItems = [];
          for (let i = 0; i < (await items.count()); i++) {
            await items.nth(i).scrollIntoViewIfNeeded();
            const measured = await items.nth(i).evaluate((el) => {
              const r = el.getBoundingClientRect(),
                hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return {
                label: el.textContent.trim(),
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                reachable:
                  r.left >= 0 &&
                  r.right <= innerWidth &&
                  r.top >= 0 &&
                  r.bottom <= innerHeight &&
                  (hit === el || el.contains(hit)),
              };
            });
            record.menuItems.push(measured);
            check(measured.reachable, label + ' reachable ' + measured.label);
          }
          await p.keyboard.press('Escape');
          check(!(await menu.isVisible()), label + ' Escape closes Song actions');
          check(
            await opener.evaluate((el) => document.activeElement === el),
            label + ' Escape restores opener focus'
          );
          await p.locator('#ly-head [data-ui="ly-tab"][data-id="review"]').click();
          await settle(p);
          check(await p.evaluate(() => LY.tab === 'review'), label + ' Review opens');
          check(posts.length === 0, label + ' Review/menu made no POST');
        } catch (e) {
          errors.push(label + ': ' + e.message);
        } finally {
          record.posts = posts;
          results.push(record);
          await context.close();
        }
      }
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(out, 'results.json'),
      JSON.stringify(
        {
          bundleSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
          fixture: text,
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
