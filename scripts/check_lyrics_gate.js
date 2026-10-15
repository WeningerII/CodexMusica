// Pending-review gate regressions: immediate visibility, actual actions, and
// restoration to the invoking control. Wheel/tap remain browser emulation.
/* global chatState, window, document, localStorage, requestAnimationFrame, innerHeight, LY, UI, lyDraft, lyRefresh, uiSaveLyrics, pushHistory, lyDraftSet, lyPendingAll */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(process.env.TEST_ROOT || path.join(__dirname, '..'));
const out = process.env.TEST_EVIDENCE || '/tmp/ui-gate-correction/probe';
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
        if (req.method() === 'POST') posts.push(JSON.parse(req.postData() || '{}'));
        return route.fulfill({
          json:
            req.method() === 'POST'
              ? {
                  reply: 'Fixture review only; no draft returned.',
                  history: [],
                  sig: 'fixture-gate',
                  task: { domain: 'lyrics', phase: 'edit' },
                }
              : { ok: true, enabled: true },
        });
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
    p.posts = posts;
    p.finish = async () => {
      await ctx.close();
    };
    return p;
  };
  const position = (p, selector) =>
    p.evaluate((selector) => {
      const e = document.querySelector(selector);
      if (!e) return null;
      const r = e.getBoundingClientRect(),
        x = r.x + r.width / 2,
        y = r.y + r.height / 2,
        h = document.elementFromPoint(x, y);
      return {
        x,
        y,
        top: r.top,
        bottom: r.bottom,
        hit: !!h && (h === e || e.contains(h)),
        visible: r.top >= 0 && r.bottom <= innerHeight,
      };
    }, selector);
  const cases = [];
  for (const [width, height] of [
    [390, 508],
    [390, 600],
    [667, 375],
    [844, 390],
  ])
    for (const mode of ['touch', 'keyboard'])
      for (const action of ['apply', 'saved', 'close'])
        cases.push({ width, height, mode, action, panel: true });
  for (const mode of ['touch', 'keyboard'])
    cases.push({ width: 390, height: 844, mode, action: 'close', panel: true });
  for (const panel of [false, true])
    cases.push({ width: 1180, height: 757, mode: 'keyboard', action: 'close', panel });
  cases.push({ width: 1180, height: 757, mode: 'mouse', action: 'close', panel: false });
  cases.push({ width: 390, height: 844, mode: 'keyboard', action: 'apply', panel: true });
  cases.push({ width: 1180, height: 757, mode: 'keyboard', action: 'apply', panel: true });
  for (const [width, height] of [
    [844, 390],
    [390, 508],
  ])
    for (const action of ['apply', 'saved', 'close'])
      cases.push({
        width,
        height,
        mode: 'keyboard',
        action,
        panel: true,
        start: 'page-top',
        touchAction: true,
      });
  try {
    for (const c of cases) {
      if (process.env.TEST_CASE && !JSON.stringify(c).includes(process.env.TEST_CASE)) continue;
      const { width, height, mode, action, panel, start, touchAction } = c,
        label = JSON.stringify(c),
        p = await open(width, height);
      await p.evaluate(() => {
        lyDraftSet('rhythm', '0', 'meter', '6/8');
        lyRefresh(true);
        const t = lyDraft(),
          a = t.value.indexOf('quiet');
        t.focus();
        t.setSelectionRange(a, a + 5);
      });
      await settle(p);
      if (panel) {
        if (width < 960) await p.tap('#ly-mtab-review');
        else await p.locator('[data-ui="ly-tab"][data-id="review"]').first().click();
      }
      const opener = panel
        ? '#ly-panel-review [data-ui="ly-run-review"]'
        : '.ly-head [data-ui="ly-run-review"]';
      const before = await p.evaluate(() => ({
        text: lyDraft().value,
        selection: [lyDraft().selectionStart, lyDraft().selectionEnd],
        tab: LY.tab,
        mobile: LY.mobile,
        pending: lyPendingAll(),
      }));
      if (mode === 'touch' || mode === 'mouse') {
        for (let n = 0; n < 12; n++) {
          const b = await position(p, opener);
          if (b?.hit) break;
          await p.mouse.move(width / 2, height - 100);
          await p.mouse.wheel(0, b && b.top < 108 ? -150 : 150);
          await settle(p);
        }
        const b = await position(p, opener);
        check(b?.hit, 'opener not reachable ' + label);
        if (b?.hit) {
          if (mode === 'touch') await p.touchscreen.tap(b.x, b.y);
          else await p.mouse.click(b.x, b.y);
        }
      } else {
        if (start === 'page-top')
          await p.evaluate((selector) => {
            for (const id of ['ly-page', 'ly-body', 'surface-lyrics'])
              document.getElementById(id).scrollTop = 0;
            document.querySelector(selector).focus({ preventScroll: true });
          }, opener);
        else await p.locator(opener).focus();
        await p.keyboard.press('Enter');
      }
      await settle(p);
      const opened = await p.evaluate(() => {
        const r = document.getElementById('ly-gate').getBoundingClientRect();
        const nav = document.getElementById('ly-mnav').getBoundingClientRect();
        return {
          top: r.top,
          bottom: r.bottom,
          limit: nav.height ? nav.top : innerHeight,
          active: document.activeElement.dataset.ui,
          text: lyDraft().value,
          selection: [lyDraft().selectionStart, lyDraft().selectionEnd],
          tab: LY.tab,
          mobile: LY.mobile,
          pending: lyPendingAll(),
        };
      });
      check(
        opened.top >= 0 && opened.bottom <= opened.limit && opened.active === 'ly-gate-apply',
        'warning/Applyall not immediately visible/focused ' + label
      );
      check(
        opened.text === before.text &&
          JSON.stringify(opened.selection) === JSON.stringify(before.selection) &&
          opened.tab === before.tab &&
          opened.mobile === before.mobile &&
          opened.pending === before.pending,
        'opening gate changed work ' + label
      );
      const buttons = {};
      for (const a of ['apply', 'saved', 'close'])
        buttons[a] = await position(p, `[data-ui="ly-gate-${a}"]`);
      check(await p.evaluate(() => !!LY.gate), 'gate did not open ' + label);
      check(
        Object.values(buttons).every((b) => b?.hit && b.visible),
        'gate actions not immediately visible/hittable ' + label
      );
      await p.screenshot({ path: path.join(out, `gate-${height}-${mode}-${action}-${panel}.png`) });
      // Do not repair failed geometry by scrolling after opening. A failing
      // baseline cannot safely exercise its action; record that explicitly.
      // The reported landscape Cancel tap is an intentional exception: prove
      // that touching its on-screen position closes the gate, not a tab change.
      const target = buttons[action];
      let exercised = false;
      if (target?.visible && (target.hit || (start === 'page-top' && action === 'close'))) {
        exercised = true;
        if (mode === 'touch' || touchAction) await p.touchscreen.tap(target.x, target.y);
        else if (mode === 'mouse') await p.mouse.click(target.x, target.y);
        else {
          for (
            let n = 0;
            n < 4 &&
            !(await p.evaluate(
              (a) => document.activeElement.dataset.ui === `ly-gate-${a}`,
              action
            ));
            n++
          )
            await p.keyboard.press('Tab');
          await p.keyboard.press('Enter');
        }
        await settle(p);
        await p.waitForFunction(() => !chatState.busy);
      }
      const after = await p.evaluate(() => ({
        gate: !!LY.gate,
        text: lyDraft().value,
        selection: [lyDraft().selectionStart, lyDraft().selectionEnd],
        selected: lyDraft().value.slice(lyDraft().selectionStart, lyDraft().selectionEnd),
        tab: LY.tab,
        mobile: LY.mobile,
        pending: lyPendingAll(),
        active: document.activeElement.dataset.ui,
        activePanel: document.activeElement.closest('#ly-panel-review')?.id,
        activeHeader: !!document.activeElement.closest('.ly-head'),
      }));
      if (exercised) {
        check(!after.gate, 'action did not close gate ' + label);
        if (action === 'close') {
          check(
            p.posts.length === 0 && after.pending === 1 && after.text === before.text,
            'Cancel changed work or posted ' + label
          );
          check(
            after.tab === before.tab && after.mobile === before.mobile,
            'Cancel changed tab ' + label
          );
          check(
            after.active === 'ly-run-review' &&
              (panel ? after.activePanel === 'ly-panel-review' : after.activeHeader),
            'Cancel did not restore actual visible opener ' + label
          );
          check((await position(p, opener))?.hit, 'restored opener obstructed ' + label);
          check(
            JSON.stringify(after.selection) === JSON.stringify(before.selection),
            'Cancel changed selection ' + label
          );
        } else {
          check(p.posts.length === 1, 'review action POST count wrong ' + label);
          check(after.pending === (action === 'apply' ? 0 : 1), 'pending changes wrong ' + label);
          check(
            action === 'apply' ? after.text.includes('6/8') : after.text === before.text,
            'review action applied wrong draft ' + label
          );
          if (action === 'saved')
            check(after.selected === 'quiet', 'saved review lost selected lyric ' + label);
          const sent = p.posts[0]?.lyric_context?.document || '';
          check(
            action === 'apply' ? sent.includes('6/8') : !sent.includes('6/8'),
            'review sent wrong saved/applied document ' + label
          );
          check(after.tab === 'review', 'review action did not remain on Review ' + label);
        }
      }
      results.push({ ...c, before, opened, buttons, exercised, after, posts: p.posts });
      await p.finish();
    }
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(out, 'results.json'),
      JSON.stringify(
        {
          root,
          html,
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
