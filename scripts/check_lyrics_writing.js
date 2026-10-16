// Local Chromium emulation only. All remote traffic is blocked; no writer runs.
/* global document, localStorage, LY, UI, lyDraft, lyRefresh, uiSaveLyrics, pushHistory, lySetWritingRangeMarks, lyPrepareRangeMarks, lyValidateRangeParts, lyGoToRangeParts, lyCaptureWritingOrigin, lyRestoreWritingOrigin, lyRhymeMarks, lyParse, lyFamilyLabel, lyViewportScroller */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(process.env.TEST_ROOT || path.join(__dirname, '..'));
const out = process.env.TEST_EVIDENCE || '/tmp/lyrics-writing-evidence';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const results = [];
  try {
    for (const [width, height, theme] of [
      [1180, 757, 'light'],
      [390, 844, 'light'],
      [390, 844, 'dark'],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: width < 960,
        hasTouch: width < 960,
      });
      const requests = [],
        errors = [];
      await context.route('**/*', (route) => {
        const req = route.request(),
          u = new URL(req.url());
        if (req.method() !== 'GET') requests.push(req.method() + ' ' + req.url());
        if (u.hostname === '127.0.0.1' && req.method() === 'GET') {
          const file = path.resolve(root, '.' + decodeURIComponent(u.pathname));
          if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile())
            return route.fulfill({ path: file });
          return route.fulfill({ status: 404 });
        }
        return route.abort();
      });
      await context.addInitScript((theme) => localStorage.setItem('codex-theme', theme), theme);
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('http://127.0.0.1/codex.html#lyrics');
      await page.waitForFunction(() => typeof LY !== 'undefined' && LY.model && UI.ready);
      await page.screenshot({ path: path.join(out, `${width}-${theme}-start.png`) });
      await page.locator('#ly-empty-doc [data-ui="ly-focus-doc"]').click();
      assert.equal(
        await page.locator('#lyrics-draft').evaluate((el) => el === document.activeElement),
        true
      );
      await page.locator('#lyrics-draft').fill('[Verse 1]\nI write my own first line');
      assert.equal(
        await page.locator('#lyrics-draft').inputValue(),
        '[Verse 1]\nI write my own first line'
      );
      const checks = await page.evaluate(() => {
        const results = [];
        const check = (ok, label) => {
          if (!ok) throw new Error(label);
          results.push(label);
        };
        const t =
          '[VERSE]\nnight, night e\u0301 👩‍👩‍👦\n' +
          Array.from({ length: 45 }, (_, i) => `Line ${i + 1} ends here`).join('\n');
        lyDraft().value = t;
        uiSaveLyrics();
        pushHistory();
        lyRefresh(true);
        const first = t.indexOf('night'),
          second = t.indexOf('night', first + 1);
        const parts = [
          { start: first, end: first + 5, text: 'night' },
          { start: second, end: second + 5, text: 'night' },
        ];
        check(lyValidateRangeParts(t, parts).ok, 'ordered disjoint parts accepted');
        check(!lyValidateRangeParts(t, [...parts].reverse()).ok, 'reversed parts refused');
        check(!lyValidateRangeParts(t, [parts[0], parts[0]]).ok, 'overlapping parts refused');
        check(
          !lyValidateRangeParts(t, [{ ...parts[0], text: 'wrong' }]).ok,
          'substring mismatch refused'
        );
        check(
          !lyValidateRangeParts(t, [{ start: -1, end: 2, text: '' }]).ok,
          'negative bounds refused'
        );
        check(
          !lyValidateRangeParts(t, [{ start: 0, end: t.length + 1, text: t }]).ok,
          'out-of-document range refused'
        );
        const accent = t.indexOf('e\u0301'),
          emoji = t.indexOf('👩');
        check(
          !lyValidateRangeParts(t, [{ start: accent, end: accent + 1, text: 'e' }]).ok,
          'combining-mark split refused'
        );
        check(
          !lyValidateRangeParts(t, [{ start: emoji, end: emoji + 2, text: '👩' }]).ok,
          'ZWJ split refused'
        );
        check(
          !lyValidateRangeParts(t, [
            { start: emoji, end: emoji + 1, text: t.slice(emoji, emoji + 1) },
          ]).ok,
          'surrogate split refused'
        );
        const marks = lyPrepareRangeMarks(t, {
          text: t,
          occurrences: [
            { id: 'a', canPaint: true, parts },
            { id: 'b', canPaint: true, parts: [parts[1]] },
            { id: 'candidate', canPaint: false, parts: [parts[0]] },
          ],
        });
        check(
          marks.ok && marks.segments.length === 2 && marks.segments[1].ids.join() === 'a,b',
          'overlapping IDs retained without painting gap'
        );
        check(
          marks.rejected[0].id === 'candidate',
          'candidate cannot paint without adapter authorization'
        );
        check(
          !lyPrepareRangeMarks(t + '!', { text: t, occurrences: [] }).ok,
          'stale paint refused'
        );
        check(
          !lyPrepareRangeMarks(t, {
            text: t,
            occurrences: [
              { id: 'a', canPaint: true, parts },
              { id: 'a', canPaint: true, parts },
            ],
          }).ok,
          'duplicate occurrence IDs refused'
        );
        const paintView = {
          text: t,
          occurrences: [
            { id: 'a', canPaint: true, parts },
            { id: 'b', canPaint: true, parts: [parts[1]] },
          ],
        };
        check(
          lySetWritingRangeMarks(paintView).ok,
          'explicit evidence setter accepts current validated occurrences'
        );
        const painted = [...document.querySelectorAll('.ly-relation-mark')];
        check(
          painted.length === 2 &&
            painted[0].textContent === 'night' &&
            painted[1].textContent === 'night' &&
            painted[1].dataset.occurrences === '["a","b"]',
          'actual overlay retains exact overlapping endpoints'
        );
        check(
          [...document.querySelectorAll('.ly-t')].map((el) => el.textContent).join('\n') ===
            t.split('\n').slice(1).join('\n'),
          'painting preserves raw sung text including punctuation and Unicode'
        );
        lyDraft().value = '[INTRO]\n' + t;
        lyRefresh(true);
        check(
          !document.querySelector('.ly-relation-mark'),
          'header-only edit hides stale offset marks'
        );
        lyDraft().value = t;
        lyRefresh(true);
        lySetWritingRangeMarks(null);
        check(
          !document.querySelector('.ly-relation-mark'),
          'ending inspection clears only inspection marks'
        );
        const draft = lyDraft();
        draft.setSelectionRange(first, first + 5, 'backward');
        draft.focus({ preventScroll: true });
        lyViewportScroller().scrollTop = 250;
        const origin = lyCaptureWritingOrigin();
        const before = () =>
          JSON.stringify([
            draft.selectionStart,
            draft.selectionEnd,
            draft.selectionDirection,
            lyViewportScroller().scrollTop,
            document.activeElement === draft,
          ]);
        const saved = before();
        check(
          lyGoToRangeParts({ text: t, canGo: true, parts }).reason === 'choose-part' &&
            before() === saved,
          'disjoint Go requires explicit part, no side effects'
        );
        check(
          !lyGoToRangeParts({ text: t + '!', canGo: true, parts }, 1).ok && before() === saved,
          'stale Go leaves selection and scroll intact'
        );
        check(
          !lyGoToRangeParts({ text: t, canGo: false, parts }, 1).ok && before() === saved,
          'unauthorized Go leaves selection and scroll intact'
        );
        check(
          lyGoToRangeParts({ text: t, canGo: true, parts }, 1).ok &&
            draft.selectionStart === second &&
            draft.selectionEnd === second + 5,
          'Go selects second exact occurrence without searching'
        );
        check(
          lyRestoreWritingOrigin(origin).ok && before() === saved,
          'Return restores direction, focus and scroll'
        );
        const modal = document.createElement('div');
        modal.setAttribute('aria-modal', 'true');
        modal.textContent = 'Fixture modal';
        document.body.append(modal);
        check(
          !lyGoToRangeParts({ text: t, canGo: true, parts }, 1).ok && before() === saved,
          'active modal prevents Go focus theft'
        );
        check(!lyRestoreWritingOrigin(origin).ok, 'active modal prevents Return focus theft');
        modal.remove();
        draft.value = t + '!';
        check(!lyRestoreWritingOrigin(origin).ok, 'edited document prevents old-origin restore');
        draft.value = t;
        lyRefresh(true);
        check(
          lyFamilyLabel(0) === 'A' &&
            lyFamilyLabel(25) === 'Z' &&
            lyFamilyLabel(26) === 'AA' &&
            lyFamilyLabel(52) === 'BA',
          'family labels never wrap at Z'
        );
        LY.tool = '';
        const declared = lyRhymeMarks(
          lyParse('[SETUP — rhyme groups — 1.end,2.end; 1.end,3.end]\nnight\nlight\nbright')
        );
        check(
          declared.ends.get('1:1')?.length === 2,
          'default declared scheme retains two memberships'
        );
        check(
          declared.letters
            .get(1)
            ?.map((g) => g.letter)
            .join() === 'A,B',
          'overlap gutter preserves family IDs'
        );
        return results;
      });
      if (process.env.TEST_SHARED_DOCK === '1') {
        const initial = await page.locator('#lyrics-draft').inputValue();
        const trigger = page.locator('#ly-linedock [data-ui="ly-menu"]');
        if (width < 960) await trigger.click();
        const menu = page.locator(width < 960 ? '#ly-menu-line-actions' : '#ly-toolbar');
        if (width >= 960) await menu.scrollIntoViewIfNeeded();
        const bounds = await menu.boundingBox();
        assert.ok(
          bounds && bounds.y >= 0 && bounds.y + bounds.height <= height,
          'History controls inside viewport after reaching their container'
        );
        assert.equal(await menu.locator('[data-ui="ly-undo"]').isEnabled(), true);
        if (width < 960)
          assert.equal(await menu.getByText('Pronunciation', { exact: true }).isVisible(), true);
        await page.screenshot({ path: path.join(out, `${width}-${theme}-line-actions.png`) });
        await menu.locator('[data-ui="ly-undo"]').click();
        await page.waitForTimeout(100);
        assert.notEqual(
          await page.locator('#lyrics-draft').inputValue(),
          initial,
          'Undo changes actual draft'
        );
        if (width < 960) await trigger.click();
        await menu.locator('[data-ui="ly-redo"]').click();
        await page.waitForTimeout(100);
        assert.equal(
          await page.locator('#lyrics-draft').inputValue(),
          initial,
          'Redo restores actual draft'
        );
        checks.push('viewport history controls visible, Undo and Redo operate actual history');
      }
      await page.screenshot({ path: path.join(out, `${width}-${theme}.png`) });
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      results.push({ width, height, theme, checks, nonGetRequests: requests, pageErrors: errors });
      await context.close();
    }
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(
      `PASS: ${results.reduce((n, r) => n + r.checks.length, 0)} writing checks across desktop/phone and both themes; no non-GET requests.`
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
