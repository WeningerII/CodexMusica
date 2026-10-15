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
    // A/B: multi-line selection then keyboard rise (window resize), forward and backward.
    for (const dir of ['forward', 'backward']) {
      const p = await open(390, 844);
      await p.evaluate(([a, b, dir]) => { const t = lyDraft(); t.focus(); t.setSelectionRange(a, b, dir); }, [offOf(5), offOf(30) + 5, dir]);
      await settle(p);
      await p.setViewportSize({ width: 390, height: 508 });
      await settle(p);
      const caretLine = dir === 'forward' ? 30 : 5;
      const otherLine = dir === 'forward' ? 5 : 30;
      out[`sel_${dir}`] = { caretLine, caret: await rowInfo(p, caretLine), other: await rowInfo(p, otherLine), scroll: await scrolls(p), errs: p.errs };
      await p.ctx.close();
    }
    // C: desktop, focused editor, user scrolls the document away with the wheel, then the window is resized.
    {
      const p = await open(1180, 757);
      await p.evaluate((o) => { const t = lyDraft(); t.focus(); t.setSelectionRange(o, o); }, offOf(1));
      await settle(p);
      const box = await p.evaluate(() => { const r = document.getElementById('ly-main-scroll').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 200 }; });
      await p.mouse.move(box.x, box.y);
      for (let k = 0; k < 6; k++) { await p.mouse.wheel(0, 300); await settle(p); }
      const s1 = await scrolls(p), r1 = await rowInfo(p, 1);
      await p.setViewportSize({ width: 1180, height: 740 });
      await settle(p);
      out.desktop_scroll_away_resize = { afterWheel: { scroll: s1, row1: r1 }, afterResize: { scroll: await scrolls(p), row1: await rowInfo(p, 1) }, errs: p.errs };
      await p.ctx.close();
    }
    // D: phone with keyboard up (508), editing line 1, user wheels down, then a small height change (e.g. URL bar 508->500).
    {
      const p = await open(390, 844);
      await p.evaluate((o) => { const t = lyDraft(); t.focus(); t.setSelectionRange(o, o); }, offOf(1));
      await settle(p);
      await p.setViewportSize({ width: 390, height: 508 });
      await settle(p);
      await p.mouse.move(195, 250);
      for (let k = 0; k < 5; k++) { await p.mouse.wheel(0, 250); await settle(p); }
      const s1 = await scrolls(p), r1 = await rowInfo(p, 1);
      await p.setViewportSize({ width: 390, height: 500 });
      await settle(p);
      out.phone_scroll_away_small_resize = { afterWheel: { scroll: s1, row1: r1 }, afterResize: { scroll: await scrolls(p), row1: await rowInfo(p, 1) }, errs: p.errs };
      await p.ctx.close();
    }
    // E: IME composition in progress during keyboard rise (CDP imeSetComposition), then commit.
    {
      const p = await open(390, 844);
      await p.evaluate((o) => { const t = lyDraft(); t.focus(); t.setSelectionRange(o, o); }, offOf(30) + 'I sing the quiet song 30'.length);
      await settle(p);
      const cdp = await p.ctx.newCDPSession(p);
      await p.evaluate(() => { window.__ev = []; const t = lyDraft(); for (const k of ['compositionstart', 'compositionupdate', 'compositionend']) t.addEventListener(k, (e) => window.__ev.push(k + ':' + e.data)); });
      await cdp.send('Input.imeSetComposition', { text: 'あい', selectionStart: 2, selectionEnd: 2 });
      await settle(p);
      const mid = await scrolls(p);
      await p.setViewportSize({ width: 390, height: 508 });
      await settle(p);
      const during = { scroll: await scrolls(p), row: await rowInfo(p, 30) };
      await cdp.send('Input.insertText', { text: '愛' });
      await settle(p);
      const line30 = await p.evaluate(() => lyDraft().value.split('\n')[30]);
      out.ime = { beforeRise: mid, during, line30, events: await p.evaluate(() => window.__ev), afterCommit: await rowInfo(p, 30), errs: p.errs };
      await p.ctx.close();
    }
    // F: gate Cancel when the gate was opened from the HEADER Run review (desktop), Review tab active vs Tools tab active.
    for (const tab of ['review', 'tools']) {
      const p = await open(1180, 757);
      await p.evaluate(() => { lyDraftSet('rhythm', '0', 'meter', '6/8'); lyRefresh(true); });
      await p.locator(`[data-ui="ly-tab"][data-id="${tab}"]`).first().click();
      await settle(p);
      const header = p.locator('#ly-head [data-ui="ly-run-review"]');
      await header.focus();
      await p.keyboard.press('Enter');
      await settle(p);
      const gateOpen = await p.evaluate(() => !!LY.gate);
      const s0 = await scrolls(p);
      await p.locator('[data-ui="ly-gate-close"]').focus();
      await p.keyboard.press('Enter');
      await settle(p);
      out[`gate_from_header_${tab}`] = {
        gateOpen,
        scrollBeforeCancel: s0,
        scrollAfterCancel: await scrolls(p),
        active: await p.evaluate(() => { const a = document.activeElement; return { tag: a.tagName, ui: a.dataset?.ui, inHead: !!a.closest('#ly-head'), inReviewPanel: !!a.closest('#ly-panel-review') }; }),
        errs: p.errs,
      };
      await p.ctx.close();
    }
    // G: New song with the user's own unsent composer text (no prefill involved).
    {
      const p = await open(1180, 757, '[VERSE]\nLove stays here\nLove comes home');
      await p.evaluate(() => { uiChatOpen(); $ui('chat-input').value = 'a song about rain on tin roofs'; _chatSyncCount(); });
      await p.evaluate(() => LY_ACTIONS['new-lyrics']());
      await settle(p);
      out.new_song_user_text = { input: await p.inputValue('#chat-input'), posts: p.posts.length, errs: p.errs };
      await p.ctx.close();
    }
    // H: unfocused editor, window resize, no scroll change expected.
    {
      const p = await open(390, 844);
      await p.evaluate((o) => { const t = lyDraft(); t.focus(); t.setSelectionRange(o, o); t.blur(); }, offOf(30));
      await settle(p);
      const s0 = await scrolls(p);
      await p.setViewportSize({ width: 390, height: 508 });
      await settle(p);
      out.unfocused_resize = { before: s0, after: await scrolls(p), errs: p.errs };
      await p.ctx.close();
    }
    // I: J1 Next section button pressed until disabled: where does focus land?
    {
      const p = await open(390, 844, '[VERSE 1]\na\nb\n[CHORUS]\nc\nd\n[BRIDGE]\ne\nf');
      await p.evaluate(() => { const t = lyDraft(); t.focus(); t.setSelectionRange(10, 10); });
      await settle(p);
      const steps = [];
      for (let k = 0; k < 3; k++) {
        const next = p.locator('#ly-section-nav [data-ui="ly-sec-step"][data-id="1"]');
        if (await next.isDisabled()) break;
        await next.focus();
        await p.keyboard.press('Enter');
        await settle(p);
        steps.push(await p.evaluate(() => ({ label: document.querySelector('#ly-section-nav .ly-sec-pos')?.textContent, active: document.activeElement.dataset?.ui || document.activeElement.id || document.activeElement.tagName, nextDisabled: document.querySelector('#ly-section-nav [data-ui="ly-sec-step"][data-id="1"]')?.disabled })));
      }
      out.j1_next_until_end = { steps, errs: p.errs };
      await p.ctx.close();
    }
    // J: reload with no focus: init-time viewportResize must not scroll.
    {
      const p = await open(390, 508);
      await p.reload();
      await p.waitForFunction(() => typeof LY !== 'undefined' && LY.model && UI.ready);
      await settle(p);
      out.reload_short = { scroll: await scrolls(p), active: await p.evaluate(() => document.activeElement.id || document.activeElement.tagName), errs: p.errs };
      await p.ctx.close();
    }
    // K: gate opened from the Review panel at short heights / landscape phone: is the warning + Apply all visible on open?
    for (const [w, h] of [[390, 508], [390, 600], [844, 390], [667, 375], [390, 844]]) {
      const p = await open(w, h);
      await p.evaluate(() => { lyDraftSet('rhythm', '0', 'meter', '6/8'); lyRefresh(true); });
      if (w < 960 && (await p.locator('#ly-mtab-review').isVisible())) await p.tap('#ly-mtab-review');
      else await p.locator('[data-ui="ly-tab"][data-id="review"]').first().click();
      await settle(p);
      await p.locator('#ly-panel-review [data-ui="ly-run-review"]').focus();
      await p.keyboard.press('Enter');
      await settle(p);
      out[`gate_open_${w}x${h}`] = await p.evaluate(() => {
        const rect = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const h = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return { top: Math.round(r.top), bottom: Math.round(r.bottom), hit: !!h && (h === e || e.contains(h)) }; };
        return { gate: !!LY.gate, vh: innerHeight, warning: rect(document.querySelector('#ly-gate .ly-inline')), apply: rect(document.querySelector('[data-ui="ly-gate-apply"]')), cancel: rect(document.querySelector('[data-ui="ly-gate-close"]')), active: document.activeElement.dataset?.ui || document.activeElement.id || document.activeElement.tagName };
      });
      await p.ctx.close();
    }
  } finally {
    await browser.close();
  }
  out.label = label;
  out.root = root;
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exitCode = 1; });
