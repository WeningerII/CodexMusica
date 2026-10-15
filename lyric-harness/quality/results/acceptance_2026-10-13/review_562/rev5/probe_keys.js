// Headless Chromium emulation (no real device). Real keyboard input via Playwright page.keyboard (CDP Input.dispatchKeyEvent)
// at 0/16/33 ms after a CSS viewport resize 390x844 -> 390x508. usage: node probe_keys.js <root> [line]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2]);
const LINE = Number(process.argv[3] || 30);
const REPS = Number(process.env.REPS || 5);
const text = '[VERSE — 40 lines]\n' + Array.from({ length: 40 }, (_, i) => `I sing the quiet song ${i + 1}`).join('\n');
const offOf = (n) => text.split('\n').slice(0, n).join('\n').length + 1;
const settle = async (p) => { await p.waitForTimeout(120); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
(async () => {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const executablePath = fs.readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).map((n) => path.join(base, n, 'chrome-linux/chrome')).find(fs.existsSync);
  const b = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const res = [];
  const actions = { type: (p) => p.keyboard.type('xy'), ArrowRight: (p) => p.keyboard.press('ArrowRight'), ArrowDown: (p) => p.keyboard.press('ArrowDown'), PageDown: (p) => p.keyboard.press('PageDown') };
  const plan = [];
  for (const d of [0, 16, 33, 'settle']) plan.push(['type', d]);
  for (const a of ['ArrowRight', 'ArrowDown', 'PageDown']) plan.push([a, 0]);
  plan.push(['scrollaway-then-type', 0]);
  for (const [act, delay] of plan) for (let rep = 0; rep < REPS; rep++) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route('**/*', async (r) => { const u = new URL(r.request().url()); if (u.hostname === '127.0.0.1') { const f = path.resolve(root, '.' + decodeURIComponent(u.pathname)); if (f.startsWith(root + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) return r.fulfill({ path: f }); return r.fulfill({ status: 404 }); } if (u.hostname === 'mcp.codexmusica.com') return r.fulfill({ json: { ok: true, enabled: true } }); return r.abort(); });
    await ctx.addInitScript(() => localStorage.setItem('codex-theme', 'light'));
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1/codex.html#lyrics');
    await p.waitForFunction(() => typeof LY !== 'undefined' && LY.model && UI.ready);
    await p.evaluate((t) => { lyDraft().value = t; uiSaveLyrics(); pushHistory(); lyRefresh(true); }, text);
    await settle(p);
    await p.evaluate((o) => { const t = lyDraft(); t.setSelectionRange(o, o); t.focus(); }, offOf(LINE));
    await settle(p);
    await p.setViewportSize({ width: 390, height: 508 });
    if (delay === 'settle') { await settle(p); await settle(p); } else if (delay) await p.waitForTimeout(delay);
    if (act === 'scrollaway-then-type') {
      await p.mouse.move(195, 250); await p.mouse.wheel(0, -400); await p.keyboard.type('xy');
    } else await actions[act](p);
    await settle(p); await settle(p);
    const m = await p.evaluate((LINE) => {
      const t = lyDraft();
      const caretIdx = t.value.slice(0, t.selectionDirection === 'backward' ? t.selectionStart : t.selectionEnd).split('\n').length - 1;
      const info = (i) => { const row = document.querySelector(`#ly-overlay .ly-r[data-i="${i}"]`); const r = row.getBoundingClientRect(); const over = ['ly-linedock', 'ly-mnav'].filter((id) => { const e = document.getElementById(id); if (!e || e.hidden) return false; const q = e.getBoundingClientRect(); return q.height && r.bottom > q.top && r.top < q.bottom; }); return { i, top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, visible: r.top >= 0 && r.bottom <= innerHeight && !over.length, over }; };
      return { caret: info(caretIdx), line: info(LINE), scroll: document.getElementById('ly-page').scrollTop };
    }, LINE);
    res.push({ act, delay, rep, ...m });
    await ctx.close();
  }
  await b.close();
  console.log(JSON.stringify(res));
})().catch((e) => { console.error(e); process.exitCode = 1; });
