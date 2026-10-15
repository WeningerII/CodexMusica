#!/usr/bin/env node
// Live acceptance probe for P-A on the DEPLOYED Lyrics page (https://codexmusica.com/codex.html#lyrics).
// Headless Chromium. Every request whose URL contains '/chat' or whose host is mcp.codexmusica.com
// is RECORDED and then ABORTED (route.abort) -- never continued, never fulfilled, never fetched.
// Usage: node live_pa.js <outdir> [direction ...]   directions: off-to-sung, sung-to-off
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/user/CodexMusica/node_modules/playwright');

const OUT = path.resolve(process.argv[2] || '.');
const DIRS = process.argv.slice(3).length ? process.argv.slice(3) : ['off-to-sung', 'sung-to-off'];
const URL = 'https://codexmusica.com/codex.html#lyrics';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LEGACY_ROW = '[SETUP — rhyme groups — 1.T4,2.end]';
const VOICES_ROW = '[SETUP — voices — parentheses are sung]';
const BODY = 'Oh--oh, (ah) oh my love\na song for us above';

const blocked = (u) => /\/chat/.test(u) || /^https?:\/\/mcp\.codexmusica\.com(\/|$|:)/.test(u);

async function runDirection(browser, dir) {
  const log = { direction: dir, intercepted: [], completed_blocked: [], failed_blocked: [], all_requests: 0, page_errors: [], console_errors: [], steps: [] };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    if (blocked(req.url())) {
      log.intercepted.push({ t: new Date().toISOString(), method: req.method(), url: req.url(), postData: req.postData() });
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  ctx.on('request', () => log.all_requests++);
  ctx.on('requestfinished', (r) => { if (blocked(r.url())) log.completed_blocked.push({ method: r.method(), url: r.url() }); });
  ctx.on('requestfailed', (r) => { if (blocked(r.url())) log.failed_blocked.push({ method: r.method(), url: r.url(), failure: r.failure()?.errorText }); });
  const page = await ctx.newPage();
  page.on('response', async (r) => {
    if (/\/codex\.html(\?|#|$)/.test(r.url()) && r.request().resourceType() === 'document') {
      try { const b = await r.body(); log.document = { url: r.url(), status: r.status(), bytes: b.length, sha256: require('crypto').createHash('sha256').update(b).digest('hex'), last_modified: r.headers()['last-modified'] || null, etag: r.headers()['etag'] || null }; } catch (e) { log.document = { error: String(e) }; }
    }
  });
  page.on('pageerror', (e) => log.page_errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') log.console_errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 120000 });
  log.build = await page.evaluate(() => ({ engine: typeof CODEX_ENGINE_SHA === 'string' ? CODEX_ENGINE_SHA : null, chat_backend: typeof CHAT_BACKEND === 'string' ? CHAT_BACKEND : null, location: location.href }));

  const editorText = () => page.locator('#lyrics-draft').inputValue();
  const declRows = (t) => t.split('\n').filter((r) => /^\[SETUP/.test(r));
  const chatLog = () => page.evaluate(() => (document.getElementById('chat-log')?.innerText || '').trim().split('\n').slice(-6));
  const idle = () => page.waitForFunction(() => !chatState.busy, null, { timeout: 60000 });

  // 1. Draft in the editor: a real fill of the textarea (input event).
  const startSung = dir === 'sung-to-off';
  const draft = `${LEGACY_ROW}\n${startSung ? VOICES_ROW + '\n' : ''}${BODY}`;
  await page.locator('#lyrics-draft').fill(draft);
  await page.locator('#lyrics-draft').blur();
  log.steps.push({ step: 'draft typed into #lyrics-draft (fill + blur)', rows: declRows(await editorText()) });

  // 2. Run review (header button), the send boundary.
  const sendReview = async (label) => {
    const before = log.intercepted.length;
    await page.locator('.ly-head [data-ui="ly-run-review"]').first().click();
    await page.waitForFunction((n) => true, before); // no-op; request capture is via route
    await page.waitForTimeout(500);
    await idle();
    await page.waitForTimeout(500);
    const posts = log.intercepted.slice(before).filter((r) => r.method === 'POST' && /\/chat$/.test(r.url));
    let body = null;
    try { body = posts[0] ? JSON.parse(posts[0].postData || 'null') : null; } catch (e) { body = { parse_error: String(e), raw: posts[0].postData }; }
    const decl = body?.lyric_context?.declarations ?? null;
    const gate = await page.evaluate(() => !!LY.gate);
    const text = await editorText();
    const s = { step: label, chat_posts: posts.length, declarations: decl, lyric_context_keys: body?.lyric_context ? Object.keys(body.lyric_context) : null, task: body?.task ?? null, message: body?.message ?? null, rows_after: declRows(text), editor_after: text, gate_open: gate, chat_log_tail: await chatLog() };
    log.steps.push(s);
    return s;
  };
  log.send1 = await sendReview('send 1: Run review clicked');

  // The aborted POST leaves chatState.pending (an unknown-outcome request, which the page
  // refuses to start a new request over). Clear it -- a NON-UI step, recorded as such.
  log.steps.push({ step: 'NON-UI: cleared chatState.pending/disconnected left by the aborted POST', pending_before: await page.evaluate(() => JSON.parse(JSON.stringify(chatState.pending || null))) });
  await page.evaluate(() => { chatState.pending = null; chatState.disconnected = null; _chatSave(); lyRefresh(true); });

  // 3. Voices via the page's own control: Tools tab -> Repeats & voices -> segmented button -> apply.
  const target = startSung ? 'unsung' : 'sung';
  await page.locator('[data-ui="ly-tab"][data-id="tools"]').click();
  await page.locator('[data-ui="ly-tool"][data-id="repeats-voices"]').first().click();
  await page.locator(`[data-ui="ly-voices"][data-id="${target}"]`).first().click();
  await page.locator('[data-ui="ly-draft-apply"][data-id="repeats-voices"]').first().click();
  await page.waitForTimeout(300);
  const t3 = await editorText();
  log.steps.push({ step: `voices set ${target} via Tools > Repeats & voices > "${target === 'sung' ? 'Sung second voice' : 'Unsung aside'}" > apply`, rows: declRows(t3), editor: t3, voices_model: await page.evaluate(() => !!LY.model.voices) });

  // 4. Run review again.
  log.send2 = await sendReview('send 2: Run review clicked');
  if (log.send2.gate_open) log.steps.push({ step: 'note: pending-changes gate opened on send 2' });

  await ctx.close();
  return log;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: EXE,
    proxy: { server: process.env.HTTPS_PROXY },
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const all = { label: 'live deployed page, headless Chromium, requests intercepted', url: URL, started: new Date().toISOString(), runs: [] };
  try {
    for (const d of DIRS) {
      const r = await runDirection(browser, d);
      fs.writeFileSync(path.join(OUT, `run_${d}.json`), JSON.stringify(r, null, 1));
      all.runs.push(r);
      console.log(`== ${d}`, JSON.stringify(r.document));
      console.log(' send1 decl:', JSON.stringify(r.send1.declarations), '| rows after:', JSON.stringify(r.send1.rows_after));
      console.log(' send2 decl:', JSON.stringify(r.send2.declarations), '| rows after:', JSON.stringify(r.send2.rows_after));
      console.log(' intercepted:', r.intercepted.map((x) => `${x.method} ${x.url}`).join(' ; '));
      console.log(' completed blocked requests:', r.completed_blocked.length, '| page errors:', r.page_errors.length);
    }
  } finally {
    await browser.close();
  }
  all.finished = new Date().toISOString();
  all.zero_blocked_completed = all.runs.every((r) => r.completed_blocked.length === 0);
  fs.writeFileSync(path.join(OUT, 'live_pa_all.json'), JSON.stringify(all, null, 1));
  console.log('zero blocked requests completed:', all.zero_blocked_completed);
})().catch((e) => { console.error(e); process.exit(2); });
