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
//   0. One document: inspector tabs exactly Tools / Writer / Review / History,
//      the six tools with their fixed help, Run review the one header primary,
//      no Read/Edit switch, the textarea authoritative; the title commits on
//      Enter, restores on Escape and a blank title removes its declaration;
//      the brief saves to the page context and Undo restores it.
//   1. "Certified for this version" holds only while the whole version equals
//      the certified one (sung lines, headers, [SETUP] rows); otherwise the
//      badge reads "Edited since review" and History "Last run certified an
//      earlier draft". Run review is one direct edit-phase request carrying the
//      page context (no [SETUP] row, declarations as JSON, a binding).
//   2. A stale suggestion offers "Recheck before applying", never Apply; Check
//      & apply refuses changed declarations and new issues; a whole draft that
//      came without its request is an unchecked replacement.
//   3. A waiting run is never reset behind the person: new work offers Resume
//      current work / Start independent work; the answer continues the same
//      run; independent work keeps the old run under History.
//   5. Tool drafts: pending values stay out of the document and survive tool
//      switches; Run review asks first and "Review saved version" sends only
//      what is committed; an invalid field commits nothing; Apply is one Undo;
//      a moved target blocks Apply with "Target changed".
//   6. Progress is read from the receipt while the POST is out: a stage, the
//      elapsed and last-update times, no percentage, and no second POST.
//   7. Phone: Song / Tools / Writer / Review at the bottom, no sideways scroll.
//
// Usage: node scripts/check_lyrics_page.js [--html=codex.html] [--shots=DIR]
// --shots writes screenshots of the states above (and light/dark, desktop/phone).
// Exit 0 if every assertion passes, 1 otherwise, 2 if playwright is missing.

'use strict';
/* global document, localStorage, getComputedStyle, innerWidth, $ui, LY, LY_ACTIONS, UI, app, chatState, lyCheckApply, lyItem, lyReceive, lyRefresh, lyRunStatus, lyScrollToLine, pushHistory, uiNewTask, uiSaveLyrics */
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

// ── H. headers and the document's identity, unit-level ────────────────────
// Every rhythm shape the page writes reads back as the same declaration; a
// review, a certification and a suggestion answer for the whole document —
// headers, section boundaries, setup rows (duplicates kept) and voices — and
// nothing a display preference or a run stamp changes.
function unitHeadersAndIdentity() {
  stage = 'H. headers and identity';
  const src = fs.readFileSync(path.join(ROOT, 'src/pages/lyrics.js'), 'utf8');
  const draft = { value: '' };
  const ctx = vm.createContext({
    console,
    $ui: (id) => (id === 'lyrics-draft' ? draft : null),
    uiRegisterPage: () => {},
    uiCount: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`,
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {},
  });
  vm.runInContext(src, ctx, { filename: 'src/pages/lyrics.js' });
  const run = (code, vars = {}) => {
    Object.assign(ctx, vars);
    return vm.runInContext(code, ctx);
  };
  // SHA-256 of the page, against node's own, on ASCII and multibyte text.
  for (const text of [
    'abc',
    '',
    'Leave a light on, New York — I’m coming home 🎵',
    'x'.repeat(200),
  ])
    check(
      run('lySha256(__t)', { __t: text }) ===
        require('crypto').createHash('sha256').update(text, 'utf8').digest('hex'),
      `lySha256(${JSON.stringify(text.slice(0, 20))}) differs from node's SHA-256`
    );
  // Every header shape round-trips, fields and text alike.
  const shapes = [
    ['[CHORUS — 6 lines — 6/8]', { lines: 6, bars: null, meter: '6/8', pickup: null }],
    [
      '[CHORUS — 6 lines — 6/8, pickup 1 beat]',
      { lines: 6, bars: null, meter: '6/8', pickup: 'pickup 1 beat' },
    ],
    ['[CHORUS — 6 lines — 4 bars]', { lines: 6, bars: 4, meter: null, pickup: null }],
    ['[CHORUS — 6 lines — 4 bars of 6/8]', { lines: 6, bars: 4, meter: '6/8', pickup: null }],
    [
      '[CHORUS — 5 lines — 5 bars of 7/8, one-beat pickup]',
      { lines: 5, bars: 5, meter: '7/8', pickup: 'one-beat pickup' },
    ],
    [
      '[INTERLUDE — instrumental — 2 bars of 8/8, no words]',
      { lines: null, bars: 2, meter: '8/8', pickup: 'no words', extra: ['instrumental'] },
    ],
    ['[BRIDGE — 4 lines — 0/8]', { lines: 4, bars: null, meter: null, extra: ['0/8'] }],
    [
      '[BRIDGE — 0 bars of 4/4]',
      { lines: null, bars: null, meter: null, extra: ['0 bars of 4/4'] },
    ],
    ['[VERSE — 4 lines — sung softly]', { lines: 4, meter: null, extra: ['sung softly'] }],
    ['[OUTRO]', { lines: null, bars: null, meter: null, extra: [] }],
  ];
  for (const [text, want] of shapes) {
    const h = JSON.parse(run('JSON.stringify(lyParseHeader(__h))', { __h: text }));
    for (const [k, v] of Object.entries(want))
      check(
        JSON.stringify(h[k]) === JSON.stringify(v),
        `${text}: ${k} read as ${JSON.stringify(h[k])}, not ${JSON.stringify(v)}`
      );
    check(
      run('lyHeaderText(lyParseHeader(__h))', { __h: text }) === text,
      `${text} does not round-trip`
    );
  }
  // The audit's witness: the rhythm form saves 6/8 with no bars; it reads back.
  const saved = run(
    "lyHeaderText({ name: 'CHORUS', lines: 4, bars: null, meter: '6/8', pickup: null, extra: [], order: [] })"
  );
  check(saved === '[CHORUS — 4 lines — 6/8]', `meter-only saved as ${saved}`);
  check(
    run('lyParseHeader(__h).meter', { __h: saved }) === '6/8',
    'a saved meter-only header reads back with no meter'
  );
  const withPickup = run(
    "lyHeaderText({ name: 'CHORUS', lines: 4, bars: null, meter: '6/8', pickup: 'pickup 1 beat', extra: [], order: [] })"
  );
  check(
    withPickup === '[CHORUS — 4 lines — 6/8, pickup 1 beat]' &&
      run('lyParseHeader(__h).pickup', { __h: withPickup }) === 'pickup 1 beat',
    `meter and pickup without bars saved as ${withPickup} and did not read back`
  );
  // A rewrite keeps each part where it stood.
  const moved = run(
    "(() => { const h = lyParseHeader('[INTERLUDE — instrumental — 2 bars of 8/8, no words]'); h.bars = 4; return lyHeaderText(h); })()"
  );
  check(
    moved === '[INTERLUDE — instrumental — 4 bars of 8/8, no words]',
    `a rewrite moved an unknown clause: ${moved}`
  );
  // The writer is sent the header as written.
  draft.value = '[CHORUS — 4 lines — 6/8]\na\nb\nc\nd';
  check(
    run('lyDraftForWriter()').includes('[CHORUS — 4 lines — 6/8]'),
    'the meter-only header did not reach the writer'
  );

  // Identity: what changes it and what does not.
  const id = (text) => run('lyIdentity(lyParse(__d))', { __d: text });
  const base = DRAFT;
  const same = [
    ['a run stamp appended', base + '\n\n[FINISHED — seed 7 — exit 0 — CLEAN]'],
    ['trailing blank lines', base + '\n\n\n'],
    ['CRLF line endings', base.replace(/\n/g, '\r\n').replace(/\r/g, '')],
  ];
  for (const [what, text] of same)
    check(id(text) === id(base), `${what} changed the identity (it is not the song)`);
  const changed = [
    ['a section renamed', base.replace('[BRIDGE — 4 lines]', '[MIDDLE EIGHT — 4 lines]')],
    ['a declared size', base.replace('[BRIDGE — 4 lines]', '[BRIDGE — 3 lines]')],
    [
      'bars',
      base.replace('[VERSE — 4 lines — 8 bars of 4/4]', '[VERSE — 4 lines — 6 bars of 4/4]'),
    ],
    [
      'meter',
      base.replace('[VERSE — 4 lines — 8 bars of 4/4]', '[VERSE — 4 lines — 8 bars of 7/8]'),
    ],
    [
      'a pickup',
      base.replace(
        '[VERSE — 4 lines — 8 bars of 4/4]',
        '[VERSE — 4 lines — 8 bars of 4/4, one-beat pickup]'
      ),
    ],
    [
      'a section boundary',
      base.replace('And if the dark comes early on\n', 'And if the dark comes early on\n[TAG]\n'),
    ],
    ['a sung line', base.replace(OLD3, NEW3)],
    ['a setup row', withAvoid(base)],
    [
      'a duplicated setup row',
      base.replace(
        '[SETUP — rhyme groups — 3,4]',
        '[SETUP — rhyme groups — 3,4]\n[SETUP — rhyme groups — 3,4]'
      ),
    ],
    ['voices', '[SETUP — voices — parentheses are sung]\n' + base],
  ];
  for (const [what, text] of changed)
    check(id(text) !== id(base), `${what} left the identity unchanged`);

  // Certification follows the identity, for every header field on its own.
  const model = (text) => run('lyParse(__d)', { __d: text });
  const certRun = (resultText, known = true) => ({
    id: 1,
    generation: 0,
    artifact: { certified: true, status: 'finished_clean' },
    completion: { certified: true },
    final: sung(resultText),
    resultId: known ? id(resultText) : null,
    resultModel: known ? model(resultText) : null,
  });
  const status = (r, text) => run('lyRunStatus(__r, lyParse(__d)).word', { __r: r, __d: text });
  check(
    status(certRun(base), base) === 'Finished · certified',
    'a run certifying this exact version does not read certified'
  );
  for (const [what, text] of changed.slice(0, 6))
    check(
      status(certRun(base), text) === 'Last run certified an earlier draft',
      `a header-only change (${what}) kept the certification: ${status(certRun(base), text)}`
    );
  check(
    status(certRun(base, false), base) === 'Earlier result · declarations unknown',
    'a certified reply with no request on record reads as current'
  );
  // A suggestion made against one version refuses on another, naming what moved.
  const sugRun = { baseId: id(base), baseSetup: null, baseModel: model(base) };
  sugRun.baseSetup = run('lySetupKey(lyParse(__d))', { __d: base });
  check(
    run('lyDeclarationRefusal(__r, lyParse(__d))', { __r: sugRun, __d: base }) === '',
    'a suggestion against the current version was refused'
  );
  const meterRefusal = run('lyDeclarationRefusal(__r, lyParse(__d))', {
    __r: sugRun,
    __d: changed[3][1],
  });
  check(
    /section headers/.test(meterRefusal) && /Nothing was changed/.test(meterRefusal),
    `a meter change did not refuse a stale suggestion by name: ${meterRefusal}`
  );
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
        await new Promise((res) => setTimeout(res, q.delay || 150));
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
  // The header badge and the last reply's own status, as one line.
  const meta = (page) =>
    page.evaluate(
      () =>
        $ui('ly-badge').innerText.replace(/\s+/g, ' ') +
        ' | ' +
        (LY.run ? lyRunStatus(LY.run)?.word || '' : '')
    );
  const ids = (page) => page.evaluate(() => LY.items.map((i) => i.id));
  const pane = (page, p) =>
    page.evaluate((x) => {
      LY_ACTIONS['ly-tab'](x);
      return $ui('ly-panel-' + x).innerText;
    }, p);
  // Run review: one direct edit-phase request; `during` runs while it is out.
  const sendReview = async (page, q, reply, during) => {
    q.replies.push(reply);
    const sent = page.evaluate(() => LY_ACTIONS['ly-run-review']());
    if (during) {
      await page.waitForFunction(() => chatState.busy);
      await during();
    }
    await sent;
    await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
    const cleared = await page
      .waitForFunction(() => !/Reviewing this version/.test($ui('ly-badge').innerText), null, {
        timeout: 3000,
      })
      .then(
        () => true,
        () => false
      );
    check(cleared, '"Reviewing this version" outlived the request');
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
    // ── 0. the shape: one document, fixed tabs and tools, no mode switch ──
    await step('0. structure', async () => {
      const { ctx, page } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT);
      const s = await page.evaluate(() => ({
        tabs: [...document.querySelectorAll('.ly-itab')].map((b) => b.innerText.trim()),
        tools: [...document.querySelectorAll('.ly-toolrow')].map((b) =>
          b.innerText.trim().replace(/\s+/g, ' ')
        ),
        head: [...document.querySelectorAll('.ly-head-actions > *')].map((b) =>
          b.innerText.trim().replace(/\s+/g, ' ')
        ),
        primary: [...document.querySelectorAll('.ly-head .cm-btn-primary')].map((b) =>
          b.innerText.trim()
        ),
        modes: document.querySelectorAll('[data-ui="ly-view"]').length,
        textarea: !!document.querySelector('#ly-editor textarea#lyrics-draft'),
        brief: $ui('ly-brief').innerText.replace(/\s+/g, ' '),
        workspace: $ui('ly-workspace').innerText,
        title: document.querySelector('.ly-title-btn')?.innerText.trim(),
      }));
      check(
        JSON.stringify(s.tabs) === '["Tools","Writer","Review","History"]',
        `inspector tabs are ${JSON.stringify(s.tabs)}`
      );
      check(
        JSON.stringify(s.tools) ===
          JSON.stringify([
            'Form & story Section order and story jobs',
            'Rhymes Declared rhyme links',
            'Rhythm Meter and line placement',
            'Pronunciation Sung-word readings',
            'Repeats & voices Exact repeats and sung asides',
            'Word rules Required and avoided phrases',
          ]),
        `the Tools index reads ${JSON.stringify(s.tools)}`
      );
      check(
        /Not reviewed/.test(s.head[0]) &&
          s.head[1] === 'Run review' &&
          s.head[2] === 'Write with AI' &&
          s.head[3] === 'Export',
        `header actions are ${JSON.stringify(s.head)}`
      );
      check(
        JSON.stringify(s.primary) === '["Run review"]',
        `header primaries: ${JSON.stringify(s.primary)}`
      );
      check(s.modes === 0, 'a Read/Edit mode switch is still on the page');
      check(s.textarea, 'the document is not one textarea in the editor');
      check(
        /Song brief/.test(s.brief) &&
          /Hook: Leave the light on when you go home/.test(s.brief) &&
          /Edit brief/.test(s.brief),
        `the brief strip reads: ${s.brief}`
      );
      check(s.workspace.startsWith('Workspace: '), `workspace line: ${s.workspace}`);
      check(s.title === 'Leave the Light On', `title button reads ${s.title}`);
      // The title: Escape restores, Enter commits, blank removes the declaration.
      const titleRow = () =>
        page.evaluate(() =>
          $ui('lyrics-draft')
            .value.split('\n')
            .filter((r) => /^\[SETUP — title/.test(r))
        );
      await page.click('.ly-title-btn');
      await page.fill('#ly-title-input', 'Something Else');
      await page.keyboard.press('Escape');
      check(
        JSON.stringify(await titleRow()) === '["[SETUP — title — \\"Leave the Light On\\"]"]',
        'Escape did not restore the title'
      );
      await page.click('.ly-title-btn');
      await page.fill('#ly-title-input', '  Porch Light  ');
      await page.keyboard.press('Enter');
      check(
        JSON.stringify(await titleRow()) === '["[SETUP — title — Porch Light]"]',
        `Enter did not write the title declaration: ${await titleRow()}`
      );
      await page.click('.ly-title-btn');
      await page.fill('#ly-title-input', '   ');
      await page.keyboard.press('Enter');
      check((await titleRow()).length === 0, 'a blank title kept a declaration');
      check(
        (await page.evaluate(() => document.querySelector('.ly-title-btn').innerText.trim())) ===
          'Untitled song',
        'a blank title does not read Untitled song'
      );
      // The brief: saved to the page context, undone by Undo.
      await page.evaluate(() => LY_ACTIONS['ly-brief-edit']());
      await page.fill('#ly-brief-text', 'A love letter to a city');
      await page.evaluate(() => LY_ACTIONS['ly-brief-save']());
      check(
        (await page.evaluate(() => app.lyricMeta.brief)) === 'A love letter to a city',
        'the brief did not reach the lyric context'
      );
      check(
        /A love letter to a city/.test(await page.evaluate(() => $ui('ly-brief').innerText)),
        'the brief strip does not show the saved brief'
      );
      await page.evaluate(() => LY_ACTIONS['ly-undo']());
      await page.evaluate(() => lyRefresh(true));
      check(
        (await page.evaluate(() => app.lyricMeta.brief)) === '',
        'Undo did not restore the brief'
      );
      await shot(page, 'b0-editor');
      await ctx.close();
    });

    // ── 1 + 4. certified reply, auto-applied; then the draft moves on ────
    await step('1. certified', async () => {
      const { ctx, page, q } = await boot({ theme: 'dark' });
      await setDraft(page, DRAFT);
      await sendReview(page, q, certified());
      const body = q.calls[0] || {};
      const msg = body.message || '';
      const c = body.lyric_context || {};
      check(body.task?.phase === 'edit', `Run review asked for phase ${body.task?.phase}`);
      check(/^Review the committed document/.test(msg), `Run review sent: ${msg.slice(0, 80)}`);
      check(
        !/\[SETUP/i.test(msg) && msg.length < 1000,
        'the message carried the draft or a [SETUP] row'
      );
      check(!/\[SETUP/i.test(c.document || ''), 'the page context document carried a [SETUP] row');
      check(c.declarations?.groups === '3,4', 'the declarations did not reach /chat as JSON');
      check(
        /\[VERSE — 4 lines — 8 bars of 4\/4\]/.test(c.document || ''),
        'the section headers did not reach /chat'
      );
      check(
        /^[0-9a-f]{64}$/.test(c.binding?.document_sha256 || ''),
        'the request carries no document binding'
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
      check(
        /Certified for this version/.test(m1) && /Finished · certified/.test(m1),
        `certified draft not shown as certified: ${m1}`
      );
      check((await ids(page)).includes('certified'), 'no certified note for the certified draft');
      await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
      await shot(page, 'b1-certified-current');

      await edit(page, 'I leave the porch light on for you', 'I left the porch light on for you');
      const m2 = await meta(page);
      check(
        /Edited since review/.test(m2) &&
          /Last run certified an earlier draft/.test(m2) &&
          !/Certified for this version/.test(m2),
        `a sung edit still reads certified: ${m2}`
      );
      let now = await ids(page);
      check(
        !now.includes('certified') && now.includes('certified-earlier'),
        `the Review note still says certified after a sung edit: ${now}`
      );
      await shot(page, 'b1-certified-after-edit');
      const hist = await pane(page, 'history');
      check(!/Finished · certified/.test(hist), 'History still says certified after a sung edit');

      await edit(page, 'I left the porch light on for you', 'I leave the porch light on for you');
      await edit(page, '[SETUP — rhyme groups — 3,4]', '[SETUP — rhyme groups — 1,2;3,4]');
      const m3 = await meta(page);
      now = await ids(page);
      check(
        /Last run certified an earlier draft/.test(m3) && !/Certified for this version/.test(m3),
        `a declaration change still reads certified: ${m3}`
      );
      check(
        !now.includes('certified') && now.includes('certified-earlier'),
        'the Review note still says certified after a declaration change'
      );
      await shot(page, 'b1-certified-after-declaration-change');
      await edit(page, '[SETUP — rhyme groups — 1,2;3,4]', '[SETUP — rhyme groups — 3,4]');
      check(
        /Certified for this version/.test(await meta(page)),
        'the certified draft, restored exactly, is not certified again'
      );
      await ctx.close();
    });

    // ── 2. Check & apply: declarations changed while the request was out ─
    await step('2. check & apply (declarations)', async () => {
      const { ctx, page, q } = await boot({ theme: 'dark' });
      await setDraft(page, DRAFT);
      await sendReview(page, q, unfinished(), () =>
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
      check(/Edited since review/.test(m), `an edit during the review is not stale: ${m}`);
      const id = await page.evaluate(
        () => LY.items.find((i) => i.decision && !i.decision.whole)?.id
      );
      check(!!id, 'no per-line suggestion after an edit during the request');
      await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
      const card = await page.evaluate(() => ({
        recheck: !!document.querySelector('#ly-panel-review [data-ui="ly-recheck"]'),
        disabled: [...document.querySelectorAll('#ly-panel-review button[disabled]')].map((b) =>
          b.innerText.trim()
        ),
        apply: !!document.querySelector('#ly-panel-review [data-ui="ly-apply"]'),
      }));
      check(
        card.recheck && card.disabled.includes('Recheck before applying') && !card.apply,
        `a stale suggestion still offers Apply: ${JSON.stringify(card)}`
      );
      await page.evaluate((i) => LY_ACTIONS['ly-apply'](i), id);
      const r = await page.evaluate(() => ({
        line3: LY.model.sung[2].text,
        msg:
          document.querySelector('#ly-panel-review .ly-inline[data-tone="danger"]')?.innerText ||
          '',
      }));
      check(r.line3 === OLD3, `applied despite changed [SETUP] rows: line 3 is "${r.line3}"`);
      check(
        /declarations changed/.test(r.msg) && /avoid — sound/.test(r.msg),
        `the refusal does not name the changed row: ${r.msg}`
      );
      await shot(page, 'b2-refused-declarations-changed');
      await edit(page, '\n' + AVOID, '');
      const apply = await page.evaluate(
        () => !!document.querySelector('#ly-panel-review [data-ui="ly-apply"]')
      );
      check(apply, 'the suggestion does not offer Apply change once the version matches again');
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
      await sendReview(page, q, unfinished(), () =>
        page.evaluate(() => {
          const d = $ui('lyrics-draft');
          d.value = d.value.replace('The rain has blurred', 'The rain had blurred');
          uiSaveLyrics();
        })
      );
      const id = await page.evaluate(
        () => LY.items.find((i) => i.decision && !i.decision.whole)?.id
      );
      const apply = async () => {
        await page.evaluate((i) => {
          LY_ACTIONS['ly-tab']('review');
          LY_ACTIONS['ly-apply'](i);
        }, id);
        return page.evaluate(() => ({
          line3: LY.model.sung[2].text,
          msg:
            document.querySelector('#ly-panel-review .ly-inline[data-tone="danger"]')?.innerText ||
            '',
        }));
      };
      let r = await apply();
      check(r.line3 === OLD3, 'applied a suggestion made against an earlier version');
      check(
        /changed after you asked the writer/.test(r.msg) && /Recheck/.test(r.msg),
        `a stale suggestion was not refused as stale: ${r.msg}`
      );
      await edit(page, 'The rain had blurred', 'The rain has blurred');
      r = await apply();
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
        LY_ACTIONS['ly-tab']('review');
      }, five);
      const btn = await page.evaluate(() => ({
        apply: [...document.querySelectorAll('#ly-panel-review [data-ui="ly-apply"]')].map((b) =>
          b.innerText.trim()
        ),
        keep: document.querySelector('#ly-panel-review [data-ui="ly-keep"]')?.className || '',
        badge: $ui('ly-badge').innerText,
      }));
      check(
        btn.apply.includes('Replace with writer’s draft (unchecked)') &&
          !btn.apply.includes('Apply change'),
        `a whole draft without its request is labelled ${JSON.stringify(btn.apply)}`
      );
      check(
        /\bcm-btn\b/.test(btn.keep) && /cm-btn-outline/.test(btn.keep),
        'Keep mine is unstyled'
      );
      check(
        /Not reviewed/.test(btn.badge),
        `a reply without its request reads as a review of this version: ${btn.badge}`
      );
      await shot(page, 'b2-whole-no-base-replace');
      await ctx.close();
    });

    // ── 3. a waiting run: new work never resets it behind the person ─────
    await step('3. waiting run', async () => {
      const { ctx, page, q } = await boot({ theme: 'dark' });
      await setDraft(page, DRAFT);
      await sendReview(page, q, waiting());
      let now = await ids(page);
      check(now.includes('waiting'), `no waiting item once the writer is idle: ${now}`);
      check(/Review needs input/.test(await meta(page)), 'the header does not say input is needed');
      await page.evaluate(() => LY_ACTIONS['ly-run-review']());
      const card = await page.evaluate(() => $ui('ly-writer-status').innerText);
      check(
        /waiting for your answer/.test(card) &&
          /Resume current work/.test(card) &&
          /Start independent work/.test(card),
        `no Resume/Start choice before new work: ${card}`
      );
      check(
        await page.evaluate(() => !!chatState.lyric?.state && chatState.archives.length === 0),
        'asking for new work reset the waiting run'
      );
      check(q.calls.length === 1, 'a request was sent over a waiting run');
      await shot(page, 'b3-conflict');
      await page.evaluate(() => LY_ACTIONS['ly-conflict-cancel']());
      check((await ids(page)).includes('waiting'), 'cancelling lost the waiting item');
      // The answer goes to the same run.
      q.replies.push(certified());
      await page.fill('#ly-answer-3', 'I keep one foot upon the chair');
      await page.evaluate(() => LY_ACTIONS['ly-answer']());
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      check(
        q.calls.length === 2 &&
          !!(q.calls[1].continuation_id || q.calls[1].sig) &&
          !q.calls[1].lyric_context,
        `the answer did not continue the same run: ${JSON.stringify(Object.keys(q.calls[1] || {}))}`
      );
      check(
        /L3: I keep one foot upon the chair/.test(q.calls[1]?.message || ''),
        'the answer was not sent'
      );
      await ctx.close();
    });
    await step('3. waiting run, independent work', async () => {
      const { ctx, page, q } = await boot({ theme: 'dark' });
      await setDraft(page, DRAFT);
      await sendReview(page, q, waiting());
      q.replies.push(unfinished());
      await page.evaluate(() => LY_ACTIONS['ly-run-review']());
      await page.evaluate(() => LY_ACTIONS['ly-conflict-new']());
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      await page.evaluate(() => lyRefresh(true));
      const st = await page.evaluate(() => ({ archives: chatState.archives.length }));
      check(st.archives === 1, 'starting independent work did not keep the run under History');
      check(
        q.calls.length === 2 &&
          !!q.calls[1].lyric_context &&
          !q.calls[1].sig &&
          !q.calls[1].continuation_id,
        'independent work did not start a new task with the page context'
      );
      const now = await ids(page);
      check(
        !now.includes('waiting') && !now.some((i) => /^open:/.test(i)),
        `an archived run still reads as waiting or open: ${now}`
      );
      const hist = await pane(page, 'history');
      check(
        /Saved runs/.test(hist) && /Retrieve saved result/.test(hist),
        'History does not keep the set-aside run'
      );
      check(
        !(await page.evaluate(() => !!document.querySelector('[data-ui="ly-answer"]'))),
        '"Submit answer" is offered for an archived run'
      );
      await shot(page, 'b3-after-independent-work');
      await ctx.close();
    });

    // ── 3. a reset from outside the page (the shell's own new task) ──────
    await step('3. shell reset', async () => {
      const { ctx, page, q } = await boot({ theme: 'dark' });
      await setDraft(page, DRAFT);
      await sendReview(page, q, waiting());
      await page.evaluate(() => {
        uiNewTask('lyrics');
        lyRefresh(true);
      });
      const w = await pane(page, 'writer');
      check(
        !(await ids(page)).includes('waiting') && !/waiting for an answer/i.test(w),
        'a run reset by the shell still reads as waiting'
      );
      await ctx.close();
    });

    // ── 5. pending tool changes: drafts, the review gate, one undo ───────
    await step('5. tool drafts', async () => {
      const { ctx, page, q } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT);
      await page.evaluate(() => {
        LY.picks.rhythmSec = 3;
        LY_ACTIONS['ly-tool']('rhythm');
      });
      await page.fill('#ly-r-meter', '6/8');
      const strip = () =>
        page.evaluate(
          () => document.querySelector('#ly-pending-rhythm')?.innerText.replace(/\s+/g, ' ') || ''
        );
      check(/1 pending change\b/.test(await strip()), `pending strip reads: ${await strip()}`);
      check(
        !(await page.evaluate(() => $ui('lyrics-draft').value)).includes('6/8'),
        'a pending value reached the document'
      );
      // Switching tools keeps the entry; the form reads it back.
      await page.evaluate(() => LY_ACTIONS['ly-tool']('word-rules'));
      await page.evaluate(() => LY_ACTIONS['ly-tool']('rhythm'));
      check(
        (await page.evaluate(() => $ui('ly-r-meter').value)) === '6/8',
        'the pending meter was lost on switching tools'
      );
      // Run review with pending entries asks first; the saved version is sent.
      await page.evaluate(() => LY_ACTIONS['ly-run-review']());
      const gate = await page.evaluate(() => $ui('ly-gate').innerText);
      check(
        /Apply pending changes before review/.test(gate) &&
          /Apply all/.test(gate) &&
          /Review saved version/.test(gate),
        `no pending-changes gate: ${gate}`
      );
      check(q.calls.length === 0, 'Run review sent while pending changes waited');
      q.replies.push(unfinished());
      await page.evaluate(() => LY_ACTIONS['ly-gate-saved']());
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      check(
        q.calls.length === 1 && !/6\/8/.test(q.calls[0].lyric_context?.document || ''),
        'Review saved version sent a pending value'
      );
      // An invalid value keeps everything and commits nothing.
      await page.fill('#ly-r-bars', '0');
      const before = await page.evaluate(() => $ui('lyrics-draft').value);
      await page.evaluate(() => LY_ACTIONS['ly-draft-apply']('rhythm'));
      check(
        (await page.evaluate(() => $ui('lyrics-draft').value)) === before &&
          (await page.evaluate(() => $ui('ly-r-meter').value)) === '6/8',
        'an invalid field let Apply commit, or lost a value'
      );
      check(
        await page.evaluate(() => $ui('ly-r-bars').getAttribute('aria-invalid') === 'true'),
        'the invalid field is not marked'
      );
      await page.fill('#ly-r-bars', '4');
      await page.evaluate(() => LY_ACTIONS['ly-draft-apply']('rhythm'));
      const after = await page.evaluate(() => $ui('lyrics-draft').value);
      check(
        /\[BRIDGE — 4 lines — 4 bars of 6\/8\]/.test(after),
        `Apply did not write the rhythm header: ${after.split('\n').find((r) => /BRIDGE/.test(r))}`
      );
      await page.evaluate(() => $ui('btn-undo').click());
      check(
        (await page.evaluate(() => $ui('lyrics-draft').value)).includes('[BRIDGE — 4 lines]'),
        'one Undo did not reverse the applied change'
      );
      // A pending entry whose target moves is kept and blocked.
      await page.evaluate(() => {
        LY.picks.formSec = 0;
        LY_ACTIONS['ly-tool']('form-story');
      });
      await page.fill('#ly-f-note', 'Arrival and kindness');
      // The person clicks Move down: focus leaves the note field.
      await page.evaluate(() => {
        document.activeElement.blur();
        LY_ACTIONS['ly-sec-move']('0:1');
      });
      await page.evaluate(() => lyRefresh(true));
      const blocked = await page.evaluate(() => ({
        text: document.querySelector('#ly-pending-form-story')?.innerText || '',
        disabled: !!document.querySelector(
          '#ly-pending-form-story [data-ui="ly-draft-apply"][disabled]'
        ),
      }));
      check(
        /Target changed\. Review these entries before applying\./.test(blocked.text) &&
          blocked.disabled,
        `a moved target did not block Apply: ${JSON.stringify(blocked)}`
      );
      await shot(page, 'b5-target-changed');
      await ctx.close();
    });

    // ── 6. progress while the POST is out: read-only, from the receipt ───
    await step('6. progress', async () => {
      const { ctx, page, q } = await boot({ theme: 'light' });
      let polls = 0;
      await ctx.route(/\/chat\/jobs\/[0-9a-f]+\?view=progress/, (r) => {
        polls++;
        return r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            view: 'progress',
            state: 'pending',
            stage: 'checking',
            created_at: new Date(Date.now() - 65000).toISOString(),
            updated_at: new Date().toISOString(),
            round: null,
          }),
        });
      });
      await setDraft(page, DRAFT);
      q.delay = 4500;
      q.replies.push(unfinished());
      const sent = page.evaluate(() => LY_ACTIONS['ly-run-review']());
      await page.waitForFunction(() => chatState.busy);
      await page.evaluate(() => LY_ACTIONS['ly-tab']('writer'));
      await page.waitForFunction(
        () => /^Checking/.test(document.getElementById('ly-prog-h')?.innerText || ''),
        null,
        { timeout: 8000 }
      );
      const w = await page.evaluate(() => $ui('ly-writer-status').innerText);
      check(/Elapsed/.test(w) && /Last update/.test(w), `the progress card lacks times: ${w}`);
      check(!/%/.test(w), 'the progress card shows a percentage');
      check(
        /1:0\d/.test(w) && /ago/.test(w),
        `elapsed and last update are not read from the receipt's times: ${w}`
      );
      check(
        await page.evaluate(() => {
          const b = document.querySelector('[data-ui="ly-run-review"]');
          return (
            b.disabled &&
            getComputedStyle(b).opacity !== '0' &&
            getComputedStyle(b).visibility !== 'hidden'
          );
        }),
        'Run review is not shown disabled while the writer works'
      );
      check(
        /Reviewing this version/.test(await page.evaluate(() => $ui('ly-badge').innerText)),
        'the badge does not say the review is running'
      );
      await shot(page, 'b6-progress');
      await sent;
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      check(polls >= 1, 'no progress GET was made while the POST was out');
      check(q.calls.length === 1, 'polling re-sent the POST');
      await ctx.close();
    });

    // ── 7. phone: one view at a time, a bottom bar, no sideways scroll ───
    await step('7. phone', async () => {
      const { ctx, page } = await boot({ theme: 'light', phone: true });
      await setDraft(page, DRAFT);
      const s = await page.evaluate(() => ({
        nav: [...document.querySelectorAll('.ly-mtab')].map((b) => b.innerText.trim()),
        navShown: getComputedStyle($ui('ly-mnav')).display !== 'none',
        wide: document.documentElement.scrollWidth - innerWidth,
      }));
      check(
        JSON.stringify(s.nav) === '["Song","Tools","Writer","Review"]' && s.navShown,
        `phone navigation: ${JSON.stringify(s)}`
      );
      check(s.wide <= 0, `the phone page scrolls sideways by ${s.wide}px`);
      await page.evaluate(() => LY_ACTIONS['ly-mobile']('tools'));
      const tools = await page.evaluate(() => ({
        rows: document.querySelectorAll('.ly-toolrow').length,
        doc: getComputedStyle($ui('ly-main')).display,
      }));
      check(tools.rows === 6 && tools.doc === 'none', `phone Tools view: ${JSON.stringify(tools)}`);
      await shot(page, 'b7-phone-tools');
      await ctx.close();
    });

    // ── 8. placement in bars, rhyme options, copy fallback ──────────────
    await step('8. placement, rhyme options, copy', async () => {
      const { ctx, page, q } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT.replace('[BRIDGE — 4 lines]', '[BRIDGE — 4 lines — 6/8]'));
      // Two bars in 6/8 is twelve beats: the stored duration is the beats.
      await page.evaluate(() => {
        LY.picks.rhythmSec = 3;
        LY.picks.durUnit = 'bars';
        LY_ACTIONS['ly-tool']('rhythm');
      });
      await page.fill('[data-field="bar.13"]', '1');
      await page.fill('[data-field="beat.13"]', '1');
      await page.fill('[data-field="duration.13"]', '2');
      await page.evaluate(() => LY_ACTIONS['ly-draft-apply']('rhythm'));
      const placed = await page.evaluate(() =>
        $ui('lyrics-draft')
          .value.split('\n')
          .find((r) => /^\[SETUP — placement/.test(r))
      );
      check(placed === '[SETUP — placement — 13:1:1:12]', `2 bars of 6/8 stored as ${placed}`);
      // A partial row is refused and nothing is written.
      await page.fill('[data-field="bar.14"]', '2');
      await page.evaluate(() => LY_ACTIONS['ly-draft-apply']('rhythm'));
      check(
        (await page.evaluate(() => $ui('lyrics-draft').value.match(/placement — [^\]]*/)?.[0])) ===
          'placement — 13:1:1:12',
        'a partial placement row was written'
      );
      await page.evaluate(() => LY_ACTIONS['ly-draft-discard']('rhythm'));
      // Ask writer for rhyme options: one request, a result card, nothing declared.
      await page.evaluate(() => {
        LY_ACTIONS['ly-tool']('');
        lyScrollToLine(1);
        LY_ACTIONS['ly-line-tool']('rhymes:1');
      });
      const before = await page.evaluate(() => $ui('lyrics-draft').value);
      q.delay = 1200;
      q.replies.push({
        reply: 'Screened.',
        history: [],
        sig: 'fixture',
        task: { domain: 'lyrics', phase: 'edit' },
        lyric: null,
        artifact: null,
        tools: [
          {
            name: 'lyric_screen',
            exit_code: 0,
            pairs: [
              { a: 'you', b: 'blue', codes: [], refused: false, relations: ['RHYME'] },
              {
                a: 'you',
                b: 'too',
                codes: ['HOMEOTELEUTON'],
                refused: false,
                relations: ['RHYME'],
              },
              {
                a: 'you',
                b: 'xyzzy',
                codes: [],
                refused: true,
                reason: 'no reading',
                relations: [],
              },
            ],
          },
        ],
      });
      const sent = page.evaluate(() => LY_ACTIONS['ly-rhyme-options']());
      await page.waitForFunction(() => chatState.busy);
      await page.evaluate(() => LY_ACTIONS['ly-tab']('tools'));
      check(
        await page.evaluate(() => document.querySelector('[data-ui="ly-rhyme-options"]')?.disabled),
        'Ask writer for rhyme options is not disabled while the writer works'
      );
      await sent;
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      await page.evaluate(() => LY_ACTIONS['ly-tab']('tools'));
      const card = await page.evaluate(
        () => document.querySelector('#ly-panel-tools .ly-result')?.innerText || ''
      );
      check(
        /Matched/.test(card) && /Partial/.test(card) && /Refused/.test(card),
        `the rhyme options card reads: ${card}`
      );
      check(
        q.calls.length === 1 && /lyric_screen/.test(q.calls[0].message),
        'the rhyme request was not sent once'
      );
      check(
        (await page.evaluate(() => $ui('lyrics-draft').value)) === before,
        'rhyme options changed the document'
      );
      // A rejected clipboard write leaves the text selectable on the page.
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: () => Promise.reject(new Error('denied')) },
        });
        document.execCommand = () => false;
        LY_ACTIONS['ly-copy-sung']();
      });
      await page.waitForFunction(() => !!document.querySelector('.ly-copy-text'), null, {
        timeout: 5000,
      });
      const fb = await page.evaluate(() => document.querySelector('.ly-copy-text').value);
      check(
        fb.split('\n')[0] === 'I leave the porch light on for you' && !/\[/.test(fb),
        'the copy fallback does not hold the sung lines'
      );
      await shot(page, 'b8-rhyme-options');
      await ctx.close();
    });

    // ── screenshots: a suggestion, light and dark, desktop and phone ─────
    if (SHOTS) {
      stage = 'screenshots';
      for (const theme of ['light', 'dark'])
        for (const phone of [false, true]) {
          const { ctx, page, q } = await boot({ theme, phone });
          await setDraft(page, DRAFT);
          await sendReview(page, q, unfinished(), () =>
            page.evaluate(() => {
              const d = $ui('lyrics-draft');
              d.value = d.value.replace('The rain has blurred', 'The rain had blurred');
              uiSaveLyrics();
            })
          );
          await page.evaluate((p) => LY_ACTIONS[p ? 'ly-mobile' : 'ly-tab']('review'), phone);
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
  unitHeadersAndIdentity();
  if (flags['unit-only']) {
    if (failures.length) {
      console.error(`LYRICS PAGE (unit): FAIL — ${failures.length} problem(s):`);
      for (const f of failures) console.error('  ✗ ' + f);
      process.exit(1);
    }
    console.log(`LYRICS PAGE (unit): PASS — ${checks} assertions`);
    process.exit(0);
  }
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
    `LYRICS PAGE: PASS — ${checks} assertions (fixture replies, no provider): one document with ` +
      'fixed tabs and tools; no [SETUP] row reaches the writer (unit, harness reader and /chat); ' +
      'every rhythm header shape round-trips; certified only for the same whole version; stale ' +
      'suggestions recheck, never apply; a waiting run is never reset behind the person; pending ' +
      'tool values stay out of the document and apply as one Undo; progress read-only from the ' +
      'receipt; phone navigation without sideways scroll.'
  );
  process.exit(0);
})();
