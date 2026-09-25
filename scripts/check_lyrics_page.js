#!/usr/bin/env node
// check_lyrics_page.js — the Lyrics page says only what is true of the draft.
//
// Every writer reply here is a FIXTURE: /chat is routed to a local stub, so
// this gate never reaches a provider or authorizes a paid request, and it
// makes no claim about the live service.
//
//   UNIT (src/pages/lyrics.js in a bare VM)
//   W. What the page sends the writer carries no [SETUP] row: the harness reads
//      every whole-line bracket as a section mark (lyric-harness/quality/
//      recover.py _sections_from_marks), so a [SETUP] row would open a section.
//      Headers and sung lines go unchanged; the declarations travel as JSON;
//      and the harness's own reader finds only the draft's sections.
//
//   BROWSER (the shipped codex.html in Chromium)
//   1. "Finished · certified" (header, History, the Review note) holds only
//      while the sung lines equal the certified draft AND the [SETUP] rows
//      equal the request's; otherwise "Last run certified an earlier draft".
//   2. Check & apply refuses when the [SETUP] rows differ from the request's,
//      and when this page's own checks find an issue the change would add; the
//      original stays and the reason is shown. A whole draft that came without
//      its request is labelled a replacement, not "Check & apply".
//   3. Waiting and resumable are read only from the live conversation: a page
//      helper warns before it would archive a waiting run, and after a reset
//      nothing reads as waiting and no answer is filled into a fresh one.
//   4. The /chat request the page prefilled carries no [SETUP] row, while the
//      stored draft keeps them; an auto-applied reply keeps the headers, sizes,
//      bars, meter and setup; "Writer running" clears with the request.
//
// Usage: node scripts/check_lyrics_page.js [--html=codex.html] [--shots=DIR]
// --shots writes screenshots of the states above (and light/dark, desktop/phone).
// Exit 0 if every assertion passes, 1 otherwise, 2 if playwright is missing.

'use strict';
/* global document, localStorage, $ui, LY, LY_ACTIONS, UI, chatState, lyCheckApply, lyItem, lyReceive, lyRefresh, pushHistory, uiNewTask, uiSaveLyrics */
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const flags = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
const HTML = flags.html || 'codex.html';
const SHOTS = typeof flags.shots === 'string' ? path.resolve(flags.shots) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const failures = [];
let checks = 0;
let stage = 'start';
function check(ok, message) {
  checks++;
  if (!ok) failures.push(`${stage}: ${message}`);
  return ok;
}

const DRAFT = `[SETUP — title — "Leave the Light On"]
[SETUP — rhyme groups — 3,4]
[SETUP — hook — "Leave the light on when you go home"]

[VERSE — 4 lines — 8 bars of 4/4]
I leave the porch light on for you
The rain has blurred the avenue
Your record turns beside the chair
I keep one foot upon the ground

[CHORUS — 4 lines — 8 bars of 4/4]
Leave the light on when you go home
A door can hold a little flame
The town can change the roads we roam
But I will call you by your name

[VERSE — 4 lines — 8 bars of 4/4]
The morning train cuts through the rain
Your coat still hangs beside the door
I write the words and start again
Then leave the page upon the floor

[BRIDGE — 4 lines]
And if the dark comes early on
I will not let the window close
The hour is late the bus is gone
But still the little lantern glows

[CHORUS — 4 lines — 8 bars of 4/4]
Leave the light on when you go home
A door can hold a little flame
The town can change the roads we roam
But I will call you by your name`;
const SETUP_ROW = /^\s*\[SETUP\b/i;
const sung = (t) =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\[[^\]]*\]$/.test(l));
const OLD3 = 'Your record turns beside the chair';
const NEW3 = 'Your record turns without a sound';
const FINAL = sung(DRAFT);
FINAL[2] = NEW3;
const AVOID = '[SETUP — avoid — sound]';
const withAvoid = (t) =>
  t.replace(
    '[SETUP — title — "Leave the Light On"]',
    `[SETUP — title — "Leave the Light On"]\n${AVOID}`
  );

// ── W. the writer payload, unit-level ─────────────────────────────────────
function unitWriterPayload() {
  stage = 'W. writer payload';
  const src = fs.readFileSync(path.join(ROOT, 'src/pages/lyrics.js'), 'utf8');
  const draft = { value: '' };
  const ctx = vm.createContext({
    console,
    $ui: (id) => (id === 'lyrics-draft' ? draft : null),
    uiRegisterPage: () => {},
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {},
  });
  vm.runInContext(src, ctx, { filename: 'src/pages/lyrics.js' });
  const cases = [
    ['setup first', DRAFT],
    ['setup with an avoid row', withAvoid(DRAFT)],
    ['setup mid-draft', DRAFT.replace('[BRIDGE — 4 lines]', '[BRIDGE — 4 lines]\n' + AVOID)],
    ['blank lines around setup', '\n\n' + DRAFT.replace('\n\n', '\n\n\n')],
    [
      'no setup',
      DRAFT.split('\n')
        .filter((r) => !SETUP_ROW.test(r))
        .join('\n')
        .trimStart(),
    ],
  ];
  const marks = (t) => t.split('\n').filter((r) => /^\[.*\]$/.test(r.trim()) && !SETUP_ROW.test(r));
  for (const [name, text] of cases) {
    draft.value = text;
    const out = vm.runInContext('lyDraftForWriter()', ctx);
    const [body, decl] = out.split('\n\nDeclared on the Lyrics page');
    check(!/\[SETUP/i.test(out), `${name}: a [SETUP] row reached the writer`);
    const keep = text
      .split('\n')
      .filter((r) => !SETUP_ROW.test(r))
      .join('\n')
      .replace(/^\n+/, '');
    check(body === keep, `${name}: headers or sung lines changed on the way to the writer`);
    check(
      JSON.stringify(marks(body)) === JSON.stringify(marks(text)),
      `${name}: the payload's section marks differ from the draft's headers`
    );
    if (text.split('\n').some((r) => SETUP_ROW.test(r))) {
      let json = null;
      try {
        json = JSON.parse(decl.slice(decl.indexOf('{')));
      } catch {
        /* reported below */
      }
      check(!!json, `${name}: the declarations block is missing or not JSON`);
      check(!!json?.title && json.groups === '3,4', `${name}: title/groups not declared as JSON`);
      if (text.includes(AVOID))
        check(JSON.stringify(json?.avoid) === '["sound"]', `${name}: avoid not declared as JSON`);
    }
  }
  // The harness's own reader, on exactly what the page sends.
  draft.value = DRAFT;
  const sent = vm.runInContext('lyDraftForWriter()', ctx).split('\n\nDeclared')[0];
  const py = `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'lyric-harness'))})
from quality.recover import _sections_from_marks
print(json.dumps([n for n, _ in (_sections_from_marks(sys.stdin.read().split('\\n')) or [])]))`;
  let names = null;
  try {
    names = JSON.parse(execFileSync('python3', ['-c', py], { input: sent }).toString());
  } catch (e) {
    check(false, 'could not run quality/recover.py _sections_from_marks: ' + e.message);
  }
  if (names) {
    check(!names.some((n) => /^SETUP/i.test(n)), 'the harness read a [SETUP] row as a section');
    check(
      JSON.stringify(names) ===
        JSON.stringify(marks(DRAFT).map((m) => m.trim().slice(1, -1).trim())),
      `the harness recovered sections ${JSON.stringify(names)}, not the draft's`
    );
  }
}

// ── Fixture replies ───────────────────────────────────────────────────────
const certified = () => ({
  reply: 'Finished.',
  history: [],
  sig: 'fixture',
  task: { domain: 'lyrics', phase: 'edit' },
  lyric: { standing: [], open: [] },
  artifact: { text: FINAL.join('\n'), final_draft: FINAL, status: 'finished', certified: true },
  completion: { certified: true },
  stopped: null,
  tools: [{ name: 'lyric_check', exit_code: 0 }],
});
const unfinished = () => ({
  reply: 'Here is the revised draft.',
  history: [],
  sig: 'fixture',
  task: { domain: 'lyrics', phase: 'edit' },
  lyric: { standing: ['L3: RHYME — line 3 does not rhyme with line 4 (chair / ground)'], open: [] },
  artifact: { text: FINAL.join('\n'), final_draft: FINAL, status: 'unfinished', certified: false },
  completion: null,
  stopped: 'LYRICS_UNFINISHED',
  tools: [{ name: 'lyric_check', exit_code: 3 }],
});
const waiting = () => ({
  reply: 'Line 3: which word should end it, "chair" or "ground"?',
  history: [],
  sig: 'fixture',
  task: { domain: 'lyrics', phase: 'edit' },
  lyric: { state: 'opaque-state', resumable: true, open: [3] },
  artifact: null,
  tools: [{ name: 'lyric_revise', exit_code: 3, asked: { line: 3 } }],
});

// ── Browser harness ───────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
};
function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/' + HTML;
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(f).pipe(res);
  });
}
// Chromium may be preinstalled at a different build than the pinned playwright.
function chromiumPath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base)) {
    if (!/^chromium-\d+$/.test(d)) continue;
    const exe = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

async function browserChecks(chromium) {
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/${HTML}#lyrics`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const pageErrors = [];
  const boot = async ({ theme = 'dark', phone = false } = {}) => {
    const ctx = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: phone,
      hasTouch: phone,
      colorScheme: theme,
    });
    const q = { replies: [], calls: [] };
    // The chat service is a local stub: fixture replies, never a provider.
    await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
      if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
        q.calls.push(JSON.parse(r.request().postData() || '{}'));
        const next = q.replies.shift() || { reply: 'no fixture', history: [], sig: 'x' };
        await new Promise((res) => setTimeout(res, 150));
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify(next) });
      }
      return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
    });
    await ctx.addInitScript((t) => localStorage.setItem('codex-theme', t), theme);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, {
      timeout: 60000,
    });
    return { ctx, page, q };
  };
  const shot = async (page, name) => {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  };
  const setDraft = (page, text) =>
    page.evaluate((t) => {
      $ui('lyrics-draft').value = t;
      uiSaveLyrics();
      pushHistory();
      lyRefresh(true);
    }, text);
  // A person's edit in the text area: the input event, then the page's render.
  const edit = (page, from, to) =>
    page.evaluate(
      ([a, b]) => {
        const d = $ui('lyrics-draft');
        d.value = d.value.replace(a, b);
        d.dispatchEvent(new Event('input'));
        lyRefresh(true);
      },
      [from, to]
    );
  const meta = (page) => page.evaluate(() => $ui('ly-meta').innerText.replace(/\s+/g, ' '));
  const ids = (page) => page.evaluate(() => LY.items.map((i) => i.id));
  const pane = (page, p) =>
    page.evaluate((x) => {
      LY_ACTIONS['ly-pane'](x);
      return x === 'history' ? $ui('ly-history').innerText : '';
    }, p);
  // Sends the page's own "Edit with the writer" prefill through the dock;
  // `during` runs while the request is out.
  const sendEdit = async (page, q, reply, during) => {
    q.replies.push(reply);
    await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
    await page.waitForFunction(() => /^Edit these lyrics:/.test($ui('chat-input').value));
    const sent = page.evaluate(() => $ui('chat-form').requestSubmit());
    if (during) {
      await page.waitForFunction(() => chatState.busy);
      await during();
    }
    await sent;
    await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
    // The page re-renders on its own once the dock stops being busy. Checked,
    // then forced, so the states after it are still judged when it fails.
    const cleared = await page
      .waitForFunction(() => !/Writer running/.test($ui('ly-meta').innerText), null, {
        timeout: 3000,
      })
      .then(
        () => true,
        () => false
      );
    check(cleared, '"Writer running" outlived the request');
    if (!cleared) await page.evaluate(() => lyRefresh(true));
  };

  // Each state is its own step: one that throws is reported and the rest run.
  const step = async (name, fn) => {
    stage = name;
    try {
      await fn();
    } catch (e) {
      failures.push(
        `gate threw during "${stage}": ` + String((e && e.message) || e).split('\n')[0]
      );
      for (const c of browser.contexts()) await c.close().catch(() => {});
    }
  };
  try {
    // ── 1 + 4. certified reply, auto-applied; then the draft moves on ────
    await step('1. certified', async () => {
      const { ctx, page, q } = await boot({ theme: 'dark' });
      await setDraft(page, DRAFT);
      await sendEdit(page, q, certified());
      const msg = q.calls[0]?.message || '';
      check(msg.startsWith('Edit these lyrics:'), 'the edit prefill was not what /chat received');
      check(!/\[SETUP/i.test(msg), 'the /chat message carried a [SETUP] row');
      check(/"groups":"3,4"/.test(msg), 'the declarations did not reach /chat as JSON');
      check(
        /\[VERSE — 4 lines — 8 bars of 4\/4\]/.test(msg),
        'the section headers did not reach /chat'
      );
      check(
        (await page.evaluate(() => UI.lyricRequest?.text || '')).includes(
          '[SETUP — rhyme groups — 3,4]'
        ),
        'the stored request lost its [SETUP] rows'
      );
      const d1 = await page.evaluate(() => $ui('lyrics-draft').value);
      check(d1.includes(NEW3), "the writer's line was not auto-applied");
      check(
        /\[SETUP — title/.test(d1) && d1.includes('[SETUP — rhyme groups — 3,4]'),
        'auto-apply dropped the [SETUP] rows'
      );
      check(
        (d1.match(/\[CHORUS — 4 lines — 8 bars of 4\/4\]/g) || []).length === 2 &&
          d1.includes('[BRIDGE — 4 lines]'),
        'auto-apply dropped headers, sizes, bars or meter'
      );
      const m1 = await meta(page);
      check(/Finished · certified/.test(m1), `certified draft not shown as certified: ${m1}`);
      check((await ids(page)).includes('certified'), 'no certified note for the certified draft');
      await page.evaluate(() => {
        LY_ACTIONS['ly-review']();
        LY_ACTIONS['ly-rtab']('note');
      });
      await shot(page, 'b1-certified-current');

      await edit(page, 'I leave the porch light on for you', 'I left the porch light on for you');
      const m2 = await meta(page);
      check(
        /Last run certified an earlier draft/.test(m2) && !/Finished · certified/.test(m2),
        `a sung edit still reads certified: ${m2}`
      );
      let now = await ids(page);
      check(
        !now.includes('certified') && now.includes('certified-earlier'),
        `the Review note still says certified after a sung edit: ${now}`
      );
      await page.evaluate(() => LY_ACTIONS['ly-rtab']('note'));
      await shot(page, 'b1-certified-after-edit');
      const hist = await pane(page, 'history');
      check(!/Finished · certified/.test(hist), 'History still says certified after a sung edit');
      await pane(page, 'review');

      await edit(page, 'I left the porch light on for you', 'I leave the porch light on for you');
      await edit(page, '[SETUP — rhyme groups — 3,4]', '[SETUP — rhyme groups — 1,2;3,4]');
      const m3 = await meta(page);
      now = await ids(page);
      check(
        /Last run certified an earlier draft/.test(m3),
        `a declaration change still reads certified: ${m3}`
      );
      check(
        !now.includes('certified') && now.includes('certified-earlier'),
        'the Review note still says certified after a declaration change'
      );
      await shot(page, 'b1-certified-after-declaration-change');
      await edit(page, '[SETUP — rhyme groups — 1,2;3,4]', '[SETUP — rhyme groups — 3,4]');
      check(
        /Finished · certified/.test(await meta(page)),
        'the certified draft, restored exactly, is not certified again'
      );
      await ctx.close();
    });

    // ── 2. Check & apply: declarations changed while the request was out ─
    await step('2. check & apply (declarations)', async () => {
      const { ctx, page, q } = await boot({ theme: 'dark' });
      await setDraft(page, DRAFT);
      await sendEdit(page, q, unfinished(), () =>
        page.evaluate((a) => {
          const d = $ui('lyrics-draft');
          d.value = d.value.replace(
            '[SETUP — title — "Leave the Light On"]',
            `[SETUP — title — "Leave the Light On"]\n${a}`
          );
          uiSaveLyrics();
        }, AVOID)
      );
      const m = await meta(page);
      check(/Unfinished/.test(m) && !/Unfinished · unfinished/i.test(m), `status reads: ${m}`);
      const id = await page.evaluate(
        () => LY.items.find((i) => i.decision && !i.decision.whole)?.id
      );
      check(!!id, 'no per-line suggestion after an edit during the request');
      await page.evaluate((i) => {
        LY_ACTIONS['ly-review']();
        LY_ACTIONS['ly-apply'](i);
      }, id);
      const r = await page.evaluate(() => ({
        line3: LY.model.sung[2].text,
        msg: document.querySelector('#ly-review .ly-outcome')?.innerText || '',
        note: document.querySelector('#ly-review .ly-item .ly-note')?.innerText || '',
      }));
      check(r.line3 === OLD3, `applied despite changed [SETUP] rows: line 3 is "${r.line3}"`);
      check(
        /declarations changed/.test(r.msg) && /avoid — sound/.test(r.msg),
        `the refusal does not name the changed row: ${r.msg}`
      );
      check(
        /\[SETUP\] declarations/.test(r.note) && /does not re-grade/.test(r.note),
        `the Check & apply copy does not say what it checks: ${r.note}`
      );
      await shot(page, 'b2-refused-declarations-changed');
      await edit(page, '\n' + AVOID, '');
      const ok = await page.evaluate((i) => lyCheckApply(lyItem(i)), id);
      check(
        ok === true && (await page.evaluate(() => LY.model.sung[2].text)) === NEW3,
        'the suggestion did not apply once the declarations matched the request'
      );
      check(!(await ids(page)).includes(id), 'the applied suggestion is still offered');
      await page.evaluate(() => $ui('btn-undo').click());
      await page.waitForFunction(
        () => LY.model.sung[2].text !== 'Your record turns without a sound'
      );
      await page.evaluate(() => lyRefresh(true));
      check((await ids(page)).includes(id), 'Undo did not bring the suggestion back');
      await ctx.close();
    });

    // ── 2. Check & apply: the change would add a local issue ─────────────
    await step('2. check & apply (new issue)', async () => {
      const { ctx, page, q } = await boot({ theme: 'light' });
      await setDraft(page, withAvoid(DRAFT));
      // An edit elsewhere during the request stops the shell's auto-apply
      // without touching the declarations or line 3.
      await sendEdit(page, q, unfinished(), () =>
        page.evaluate(() => {
          const d = $ui('lyrics-draft');
          d.value = d.value.replace('The rain has blurred', 'The rain had blurred');
          uiSaveLyrics();
        })
      );
      const id = await page.evaluate(
        () => LY.items.find((i) => i.decision && !i.decision.whole)?.id
      );
      await page.evaluate((i) => {
        LY_ACTIONS['ly-review']();
        LY_ACTIONS['ly-apply'](i);
      }, id);
      const r = await page.evaluate(() => ({
        line3: LY.model.sung[2].text,
        msg: document.querySelector('#ly-review .ly-outcome')?.innerText || '',
      }));
      check(r.line3 === OLD3, 'applied a suggestion that adds an issue the page checks');
      check(/would add 1 issue/.test(r.msg), `the refusal does not name the new issue: ${r.msg}`);
      await shot(page, 'b2-refused-new-issue');
      const five = ['one', 'two', 'three', 'four', 'five'];
      await page.evaluate((f) => {
        lyReceive(
          {
            artifact: { text: f.join('\n'), final_draft: f, status: 'unfinished' },
            task: { domain: 'lyrics' },
          },
          null
        );
        LY_ACTIONS['ly-review']();
      }, five);
      const btn = await page.evaluate(() => ({
        apply: [...document.querySelectorAll('#ly-review [data-ui="ly-apply"]')].map((b) =>
          b.innerText.trim()
        ),
        keep: document.querySelector('#ly-review [data-ui="ly-keep"]')?.className || '',
      }));
      check(
        btn.apply.includes('Replace with the writer’s draft') &&
          !btn.apply.includes('Check & apply'),
        `a whole draft without its request is labelled ${JSON.stringify(btn.apply)}`
      );
      check(
        /\bcm-btn\b/.test(btn.keep) && /cm-btn-outline/.test(btn.keep),
        'Keep mine is unstyled'
      );
      await shot(page, 'b2-whole-no-base-replace');
      await ctx.close();
    });

    // ── 3. a waiting run, then a page helper would reset the conversation ─
    await step('3. waiting run', async () => {
      const { ctx, page, q } = await boot({ theme: 'dark' });
      await setDraft(page, DRAFT);
      await sendEdit(page, q, waiting());
      let now = await ids(page);
      check(now.includes('waiting'), `no waiting item once the writer is idle: ${now}`);
      check(/Waiting for your answer/.test(await meta(page)), 'the header does not say waiting');
      await page.evaluate(() => {
        LY.reviewTab = 'input';
        LY_ACTIONS['ly-pane']('review');
      });
      await shot(page, 'waiting-after-reply-fixed');
      const keep = page.evaluate(() => LY_ACTIONS['ly-rewrite-group']('3,4'));
      await page.waitForSelector('.confirm-dialog', { timeout: 5000 });
      const dlg = await page.evaluate(() => document.querySelector('.confirm-dialog').innerText);
      check(
        /waiting for your answer/.test(dlg) && /archives that run/.test(dlg),
        `no warning before archiving a waiting run: ${dlg}`
      );
      await shot(page, 'b3-reset-warning');
      await page.click('[data-confirm-action="cancel"]');
      await keep;
      check(
        await page.evaluate(() => !!chatState.lyric?.state && chatState.archives.length === 0),
        'declining the warning still reset the conversation'
      );
      check((await ids(page)).includes('waiting'), 'declining the warning lost the waiting item');
      const go = page.evaluate(() => LY_ACTIONS['ly-rewrite-group']('3,4'));
      await page.waitForSelector('.confirm-dialog', { timeout: 5000 });
      await page.click('[data-confirm-action="confirm"]');
      await go;
      await page.evaluate(() => lyRefresh(true));
      const st = await page.evaluate(() => ({
        lyric: chatState.lyric,
        archives: chatState.archives.length,
        input: $ui('chat-input').value,
      }));
      check(st.lyric === null && st.archives === 1, 'confirming did not archive the run');
      check(/^Rewrite lines 3 and 4/.test(st.input), 'the helper prompt was not filled in');
      check(!/\[SETUP/i.test(st.input), 'the helper prompt carries a [SETUP] row');
      now = await ids(page);
      check(
        !now.includes('waiting') && !now.some((i) => /^open:/.test(i)),
        `an archived run still reads as waiting or open: ${now}`
      );
      check(!/Waiting for your answer/.test(await meta(page)), 'the header still says waiting');
      const hist = await pane(page, 'history');
      check(
        !/Waiting for your answer/.test(hist) && !/Answer in the writer/.test(hist),
        'History still offers the archived run as waiting'
      );
      await shot(page, 'b3-after-reset-history');
      await page.evaluate(() => {
        LY.reviewTab = 'input';
        LY_ACTIONS['ly-pane']('review');
      });
      check(
        !(await page.evaluate(() => !!document.querySelector('[data-ui="ly-answer"]'))),
        '"Put my answer in the writer" is offered for an archived run'
      );
      await shot(page, 'b3-after-reset-review');
      await page.evaluate(() => {
        $ui('chat-input').value = '';
        LY_ACTIONS['ly-answer']();
      });
      check(
        (await page.evaluate(() => $ui('chat-input').value)) === '',
        'an answer was filled into a fresh conversation'
      );
      await ctx.close();
    });

    // ── 3. a reset from outside the page (the shell's own new task) ──────
    await step('3. shell reset', async () => {
      const { ctx, page, q } = await boot({ theme: 'dark' });
      await setDraft(page, DRAFT);
      await sendEdit(page, q, waiting());
      await page.evaluate(() => {
        uiNewTask('lyrics');
        lyRefresh(true);
      });
      const hist = await pane(page, 'history');
      check(
        !(await ids(page)).includes('waiting') && !/Waiting for your answer/.test(hist),
        'a run reset by the shell still reads as waiting'
      );
      await ctx.close();
    });

    // ── screenshots: a suggestion, light and dark, desktop and phone ─────
    if (SHOTS) {
      stage = 'screenshots';
      for (const theme of ['light', 'dark'])
        for (const phone of [false, true]) {
          const { ctx, page, q } = await boot({ theme, phone });
          await setDraft(page, DRAFT);
          await sendEdit(page, q, unfinished(), () =>
            page.evaluate(() => {
              const d = $ui('lyrics-draft');
              d.value = d.value.replace('The rain has blurred', 'The rain had blurred');
              uiSaveLyrics();
            })
          );
          await page.evaluate(() => LY_ACTIONS['ly-review']());
          await shot(page, `lyrics-${theme}-${phone ? 'phone' : 'desktop'}`);
          await ctx.close();
        }
    }
  } catch (e) {
    failures.push(`gate threw during "${stage}": ` + String((e && e.message) || e).split('\n')[0]);
  } finally {
    await browser.close();
    server.close();
  }
  checks++;
  if (pageErrors.length) failures.push('uncaught page error: ' + pageErrors[0]);
}

(async () => {
  unitWriterPayload();
  if (!fs.existsSync(path.join(ROOT, HTML))) {
    console.error(`LYRICS PAGE: FAIL — ${HTML} not found (build it first)`);
    process.exit(1);
  }
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('LYRICS PAGE: FAIL — playwright not installed (npm ci)');
    process.exit(2);
  }
  await browserChecks(chromium);
  if (failures.length) {
    console.error(`LYRICS PAGE: FAIL — ${failures.length} problem(s):`);
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log(
    `LYRICS PAGE: PASS — ${checks} assertions (fixture replies, no provider): no [SETUP] row ` +
      'reaches the writer (unit, harness reader and /chat); certified only for the same sung ' +
      'lines and [SETUP] rows, in header, Review and History; Check & apply refuses changed ' +
      'declarations and new issues; waiting read only from the live conversation, with a ' +
      'warning before a helper archives it; auto-apply keeps headers and setup; Undo restores ' +
      'the suggestion.'
  );
  process.exit(0);
})();
