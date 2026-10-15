// Reviewer probes for PR #562 (headless Chromium emulation; no real device).
// usage: node probe.js <root-with-codex.html> <label>
/* eslint-disable */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2]);
const label = process.argv[3] || 'run';
const text =
  '[VERSE — 40 lines]\n' +
  Array.from({ length: 40 }, (_, i) => `I sing the quiet song ${i + 1}`).join('\n');
const out = {};
const settle = async (p) => {
  await p.waitForTimeout(120);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};
(async () => {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const executablePath = fs
    .readdirSync(base)
    .filter((n) => /^chromium-\d+$/.test(n))
    .map((n) => path.join(base, n, 'chrome-linux/chrome'))
    .find(fs.existsSync);
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const open = async (width, height, draft = text) => {
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 960, hasTouch: width < 960 });
    const posts = [];
    await ctx.route('**/*', async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === '127.0.0.1') {
        const f = path.resolve(root, '.' + decodeURIComponent(u.pathname));
        if (f.startsWith(root + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ path: f });
        return route.fulfill({ status: 404 });
      }
      if (u.hostname === 'mcp.codexmusica.com') {
        if (req.method() === 'POST') posts.push(req.url());
        return route.fulfill({ json: { ok: true, enabled: true } });
      }
      return route.abort();
    });
    await ctx.addInitScript(() => localStorage.setItem('codex-theme', 'light'));
    const p = await ctx.newPage();
    p.errs = [];
    p.on('pageerror', (e) => p.errs.push(e.message));
    await p.goto('http://127.0.0.1/codex.html#lyrics');
    await p.waitForFunction(() => typeof LY !== 'undefined' && LY.model && UI.ready);
    await p.evaluate((t) => { lyDraft().value = t; uiSaveLyrics(); pushHistory(); lyRefresh(true); }, draft);
    await settle(p);
    p.posts = posts;
    p.ctx = ctx;
    return p;
  };
  const scrolls = (p) => p.evaluate(() => Object.fromEntries(['surface-lyrics', 'ly-page', 'ly-body', 'ly-main-scroll'].map((id) => [id, document.getElementById(id)?.scrollTop])));
  const rowInfo = (p, i) => p.evaluate((i) => {
    const row = document.querySelector(`#ly-overlay .ly-r[data-i="${i}"]`);
    const r = row.getBoundingClientRect();
    const t = lyDraft();
    const vh = window.visualViewport ? window.visualViewport.height : innerHeight;
    const over = ['ly-linedock', 'ly-mnav'].filter((id) => { const e = document.getElementById(id); if (!e || e.hidden) return false; const q = e.getBoundingClientRect(); return q.height && r.bottom > q.top && r.top < q.bottom; });
    return { i, top: r.top, bottom: r.bottom, inView: r.top >= 0 && r.bottom <= vh && !over.length, over, focused: document.activeElement === t, sel: [t.selectionStart, t.selectionEnd, t.selectionDirection] };
  }, i);
  const offOf = (n) => text.split('\n').slice(0, n).join('\n').length + 1; // start of line index n (0 = header)
  try {
    const setFocus = (p, a, b = a, dir = 'forward') => p.evaluate(([a, b, dir]) => { const t = lyDraft(); t.setSelectionRange(a, b, dir); t.focus(); }, [a, b, dir]);
    const rowY = (p, i) => p.evaluate((i) => Math.round(document.querySelector(`#ly-overlay .ly-r[data-i="${i}"]`).getBoundingClientRect().top * 100) / 100, i);
    // R2': unfocused reading row 28 screen y across 844->508->844
    {
      const p = await open(390, 844);
      await p.evaluate(() => { document.getElementById('ly-body').scrollTop = 1047; });
      await settle(p);
      const y0 = await rowY(p, 28);
      await p.setViewportSize({ width: 390, height: 508 }); await settle(p);
      const y1 = await rowY(p, 28), s1 = await scrolls(p);
      await p.setViewportSize({ width: 390, height: 844 }); await settle(p);
      out.r2b_row28_y = { y844: y0, y508: y1, scroll508: s1, y844back: await rowY(p, 28), errs: p.errs };
      await p.ctx.close();
    }
    // backward selection with caret (start, line 25) visible before
    {
      const p = await open(390, 844);
      await setFocus(p, offOf(25), offOf(35) + 3, 'backward');
      await settle(p);
      const before = await rowInfo(p, 25);
      await p.setViewportSize({ width: 390, height: 508 }); await settle(p);
      out.r4c_backward_caret_visible_before = { before, after: await rowInfo(p, 25), errs: p.errs };
      await p.ctx.close();
    }
    // A2': rapid resizes, caret visible before (set-then-focus line 9)
    for (const seq of [[700, 508], [508, 844, 508], [600, 560, 520, 508]]) {
      const p = await open(390, 844);
      await setFocus(p, offOf(9)); await settle(p);
      const before = await rowInfo(p, 9);
      for (const h of seq) await p.setViewportSize({ width: 390, height: h });
      await settle(p); await settle(p);
      out['a2b_rapid_' + seq.join('_')] = { before, after: await rowInfo(p, 9), errs: p.errs };
      await p.ctx.close();
    }
    // A3': rotation-like with caret visible before (line 9), then rotate back
    {
      const p = await open(390, 844);
      await setFocus(p, offOf(9)); await settle(p);
      const before = await rowInfo(p, 9);
      await p.setViewportSize({ width: 844, height: 390 }); await settle(p); await settle(p);
      const rot = await rowInfo(p, 9);
      await p.setViewportSize({ width: 390, height: 844 }); await settle(p); await settle(p);
      out.a3b_rotate_focused = { before, rotated: rot, back: await rowInfo(p, 9), errs: p.errs };
      await p.ctx.close();
    }
    // A5': typing during the queued rise, caret visible before; then one more key after settling; control types after settle
    for (const n of [9, 30]) {
      const p = await open(390, 844);
      await setFocus(p, offOf(n)); await settle(p);
      const before = await rowInfo(p, n);
      await Promise.all([p.setViewportSize({ width: 390, height: 508 }), p.keyboard.type('xy')]);
      await settle(p); await settle(p);
      const after = await rowInfo(p, n);
      await p.keyboard.type('z'); await settle(p);
      const afterMore = await rowInfo(p, n);
      out['a5b_type_during_queue_line' + n] = { before, after, afterNextKey: afterMore, line: await p.evaluate((n) => lyDraft().value.split('\n')[n], n), errs: p.errs };
      await p.ctx.close();
      const q = await open(390, 844);
      await setFocus(q, offOf(n)); await settle(q);
      await q.setViewportSize({ width: 390, height: 508 }); await settle(q); await settle(q);
      await q.keyboard.type('xy'); await settle(q);
      out['a5b_control_type_after_settle_line' + n] = { after: await rowInfo(q, n), errs: q.errs };
      await q.ctx.close();
    }
  } finally {
    await browser.close();
  }
  out.label = label;
  out.root = root;
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exitCode = 1; });
