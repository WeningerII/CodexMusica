// Offline integrated evidence inspection journeys; no provider requests.
/* global document, window, LY, UI, lyDraft, lyRefresh, uiSaveLyrics, pushHistory, lyReceive, lyContext, lyRelationEvidenceView, lyIdentity, LY_READING_CUT, lyInspectionSession, lyRelationWritingMarks */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(process.env.TEST_ROOT || path.join(__dirname, '..'));
const html = process.env.TEST_HTML || path.join(root, 'codex.html');
const out = process.env.TEST_EVIDENCE || '/tmp/lyrics-inspection-evidence';
fs.mkdirSync(out, { recursive: true });
let evidence;
const prefix = '[SETUP — rhyme groups — 1,2]\n'; // No section headers in authenticated transport context.
const text = prefix + 'cat bat cat\nhat';
const results = [],
  errors = [];
const check = (ok, label) => {
  if (!ok) errors.push(label);
};
const settle = (p) => p.waitForTimeout(120);
(async () => {
  const { createOfflineChat } = await import('./lyrics_inspection_transport_fixture.mjs');
  const backend = await createOfflineChat();
  const receipts = new Map();
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH || '/tmp/musica-browsers/chromium-0/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const open = async (width, height) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 960,
      hasTouch: width < 960,
    });
    const posts = [];
    await ctx.route('**/*', async (route) => {
      const req = route.request(),
        u = new URL(req.url());
      if (req.method() === 'POST') posts.push(req.url());
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
      if (u.hostname === 'mcp.codexmusica.com')
        return route.fulfill({ json: { ok: true, enabled: true } });
      return route.abort();
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(7000);
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    await p.goto('http://127.0.0.1/codex.html#lyrics');
    await p.waitForFunction(() => typeof LY !== 'undefined' && LY.model && UI.ready);
    p.finish = async () => {
      check(posts.length === 0, 'inspection made POST');
      await ctx.close();
    };
    return p;
  };
  const receive = async (
    p,
    report = 'transport',
    matched = true,
    documentText = text,
    allowUnbound = false
  ) => {
    const context = await p.evaluate((text) => {
      lyDraft().value = text;
      uiSaveLyrics();
      pushHistory();
      lyRefresh(true);
      return lyContext(LY.model);
    }, documentText);
    const key = JSON.stringify(context);
    const requestId =
      'fixture-' +
      require('node:crypto').createHash('sha256').update(key).digest('hex').slice(0, 24);
    if (!receipts.has(key)) {
      const lines = await p.evaluate(() => LY.model.sung.map((row) => row.text));
      backend.setArgs({ lines, ...context.declarations });
      const response = await backend.fetch(backend.url + '/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          message: 'Review these lyrics',
          task: { domain: 'lyrics', phase: 'edit' },
          lyric_context: context,
        }),
      });
      if (response.status !== 200) throw new Error('Local transport status ' + response.status);
      const payload = await response.json();
      const actual = payload.tools?.find(
        (tool) => tool.name === 'lyric_check'
      )?.schema_instance_evidence;
      fs.writeFileSync(
        path.join(out, `transport-${receipts.size}.json`),
        JSON.stringify({ requestId, context, payload }, null, 2)
      );
      if (!actual?.request_binding && !allowUnbound)
        throw new Error('Actual transport did not verify request binding; see transport receipt');
      receipts.set(key, { evidence: actual, payload });
      if (!evidence) evidence = actual;
    }
    const saved = receipts.get(key);
    const chosen = report === 'transport' ? saved.evidence : report;
    const payload = {
      ...saved.payload,
      tools: saved.payload.tools
        .filter((tool) => chosen || tool.name !== 'lyric_check')
        .map((tool) =>
          tool.name === 'lyric_check' ? { ...tool, schema_instance_evidence: chosen } : tool
        ),
    };
    await p.evaluate(
      ({ payload, context, matched, requestId }) => {
        UI.lyricRequest = {
          id: requestId,
          text: lyDraft().value,
          submittedContext: context,
        };
        lyReceive(payload, { request_id: matched ? requestId : 'unmatched' });
        window.inspectionView = () => {
          const r = LY.run.relationEvidence;
          return lyRelationEvidenceView(r.evidence, {
            requestId: r.requestId,
            binding: r.binding,
            document: {
              semanticId: lyIdentity(LY.model),
              text: LY.model.text,
              readerScheme: LY_READING_CUT.replace(/^cut /, ''),
              voices: LY.model.voices,
            },
          });
        };
      },
      { payload, context, matched, requestId }
    );
    await settle(p);
  };
  const control = async (p, action, extra = '') => {
    const selector = `[data-ui="${action}"]${extra}:visible`;
    const modal = p.locator('#ly-relations-dialog[open]');
    return (await modal.count()) && (await modal.locator(selector).count())
      ? modal.locator(selector).first()
      : p.locator(selector).first();
  };
  const click = async (p, action, extra = '') => {
    await (await control(p, action, extra)).click();
    await settle(p);
  };
  const state = (p) =>
    p.evaluate(() => ({
      text: lyDraft().value,
      start: lyDraft().selectionStart,
      end: lyDraft().selectionEnd,
      direction: lyDraft().selectionDirection,
      windowScroll: [window.scrollX, window.scrollY],
      scroll: ['surface-lyrics', 'ly-page', 'ly-body', 'ly-main-scroll', 'lyrics-draft'].map(
        (id) => [id, document.getElementById(id)?.scrollTop || 0]
      ),
    }));
  try {
    for (const [width, height] of [
      [1180, 757],
      [390, 844],
      [390, 508],
    ]) {
      if (process.env.TEST_ONLY === 'stale' && width !== 1180) continue;
      const p = await open(width, height),
        label = `${width}x${height}`;
      try {
        check(
          (await p.locator('[data-ui="ly-run-review"]:visible').count()) === 0,
          label + ' empty rest Run review'
        );
        await p.getByRole('button', { name: 'Song actions', exact: true }).click();
        check(
          (await p.locator('#ly-menu-song-actions [data-ui="new-lyrics"]:visible').count()) === 1,
          label + ' empty New song available'
        );
        const importButton = p.locator('#ly-menu-song-actions [data-ui="ly-import"]:visible');
        check((await importButton.count()) === 1, label + ' empty Import available');
        await Promise.all([p.waitForEvent('filechooser'), importButton.click()]);
        await p.keyboard.press('Escape');
        await receive(p);
        const view = await p.evaluate(() => window.inspectionView());
        fs.writeFileSync(
          path.join(out, `view-${width}-${height}.json`),
          JSON.stringify(
            await p.evaluate(() => ({
              view: window.inspectionView(),
              saved: LY.run.relationEvidence,
              model: { voices: LY.model.voices, text: LY.model.text },
            })),
            null,
            2
          )
        );
        check(view.freshness === 'current', label + ' real receive binds producer evidence');
        const second = Object.values(view.occurrences).find((o) =>
          o.parts.some(
            (part) => part.start === prefix.length + 8 && part.end === prefix.length + 11
          )
        );
        const first = Object.values(view.occurrences).find((o) =>
          o.parts.some((part) => part.start === prefix.length && part.end === prefix.length + 3)
        );
        check(
          first && second && first.id !== second.id,
          label + ' repeated word has distinct exact occurrence'
        );
        await p.evaluate((start) => {
          lyDraft().focus();
          lyDraft().setSelectionRange(start, start);
          lyDraft().dispatchEvent(new Event('select', { bubbles: true }));
        }, prefix.length + 1);
        await settle(p);
        await p.locator('#lyrics-draft').press('ArrowRight');
        await settle(p);
        const initialDock = await p
          .locator(width < 960 ? '#ly-linedock' : '#ly-linebar')
          .boundingBox();
        if (width < 960)
          check(!!initialDock && initialDock.height <= 61.5, label + ' active ordinary row <=61px');
        await p.evaluate(
          ({ start, end }) => {
            const d = lyDraft();
            d.focus();
            d.setSelectionRange(start, end, 'backward');
            d.dispatchEvent(new Event('select', { bubbles: true }));
          },
          { start: prefix.length, end: prefix.length + 11 }
        );
        await settle(p);
        const original = await state(p);
        await click(p, 'ly-relations');
        check(
          (await p.locator('[data-ui="ly-relation-source"]:visible').count()) > 1,
          label + ' source choice shown'
        );
        const choiceLabels = await p
          .locator('[data-ui="ly-relation-source"][data-id]:visible')
          .evaluateAll((nodes) =>
            nodes
              .filter((n) => n.dataset.id)
              .map((n) => ({ id: n.dataset.id, text: n.textContent }))
          );
        check(
          choiceLabels.some((c) => / · L1(?:,|$)/.test(c.text)),
          label + ' chooser displays line:0 as L1'
        );
        check(
          choiceLabels.every((c) => !c.text.includes('line:')),
          label + ' chooser hides raw line IDs'
        );
        check(
          choiceLabels.some((c) => c.id === second.id),
          label + ' chooser preserves raw occurrence ID'
        );
        await click(p, 'ly-relation-source', `[data-id="${second.id}"]`);
        await p.evaluate(() => {
          window.savedInspectionOrigin = lyInspectionSession().origin;
        });
        if (await p.locator('[data-ui="ly-relation-expand"]:visible').count())
          await click(p, 'ly-relation-expand');
        const pair = view.pairs.find(
          (pair) => pair.canGo && (pair.a === second.id || pair.b === second.id)
        );
        await p.evaluate(() => {
          window.inspectionFocus = [];
          lyDraft().addEventListener('focus', () =>
            window.inspectionFocus.push({
              dialog: document.getElementById('ly-relations-dialog').open,
            })
          );
        });
        for (const side of ['a', 'b']) {
          await click(
            p,
            'ly-relation-go',
            `[data-pair="${pair.id}"][data-side="${side}"][data-part="0"]`
          );
          const expected = view.occurrences[pair[side]].parts[0],
            actual = await state(p);
          check(
            actual.start === expected.start && actual.end === expected.end,
            label + ' exact paired ' + side + ' endpoint'
          );
          const session = await p.evaluate(() => ({
            same: window.savedInspectionOrigin === lyInspectionSession().origin,
            source: lyInspectionSession().sourceOccurrence,
            marks: lyRelationWritingMarks(window.inspectionView(), lyInspectionSession()),
            focus: window.inspectionFocus,
          }));
          check(session.same && session.source === second.id, label + ' source/origin survives Go');
          check(
            session.marks?.occurrences.length === new Set([pair.a, pair.b]).size,
            label + ' selected pair marks only'
          );
          check(
            session.focus.every((f) => !f.dialog),
            label + ' modal closes before editor focus'
          );
          const painted = await p
            .locator('.ly-relation-mark')
            .evaluateAll((nodes) => nodes.flatMap((n) => JSON.parse(n.dataset.occurrences)));
          check(
            JSON.stringify([...new Set(painted)].sort()) ===
              JSON.stringify([...new Set([pair.a, pair.b])].sort()),
            label + ' DOM paints exact selected endpoint IDs'
          );
          await click(p, 'ly-relation-reopen');
          await click(p, 'ly-relation-close');
          await click(p, 'ly-relation-reopen');
        }
        await click(p, 'ly-relation-return');
        const returned = await state(p);
        check(
          JSON.stringify(returned) === JSON.stringify(original),
          label + ' Return restores text selection direction scroll'
        );
        await click(p, 'ly-relations');
        await (await control(p, 'ly-relation-go')).click();
        await settle(p);
        await p.locator('#lyrics-draft').fill(text + '!');
        await p.evaluate(() => {
          uiSaveLyrics();
          lyRefresh(true);
          lyDraft().setSelectionRange(2, 5, 'forward');
          lyDraft().dispatchEvent(new Event('select', { bubbles: true }));
        });
        await settle(p);
        await click(p, 'ly-relation-reopen');
        await (await control(p, 'ly-relation-return')).scrollIntoViewIfNeeded();
        const stale = await state(p);
        await p.evaluate(() => {
          window.staleEvents = [];
          for (const name of [
            'pointerdown',
            'mousedown',
            'focus',
            'blur',
            'click',
            'selectionchange',
          ])
            document.addEventListener(
              name,
              (e) =>
                window.staleEvents.push({
                  type: name,
                  target: e.target.id || e.target.dataset?.ui,
                  start: lyDraft().selectionStart,
                  end: lyDraft().selectionEnd,
                }),
              true
            );
        });
        await click(p, 'ly-relation-return');
        check(
          JSON.stringify(await state(p)) === JSON.stringify(stale),
          label + ' stale Return preserves position'
        );
        check(
          await p.evaluate(() => !!lyInspectionSession().reason),
          label + ' stale Return explains refusal'
        );
        const refused = await state(p);
        await (await control(p, 'ly-relation-stay')).scrollIntoViewIfNeeded();
        const beforeStay = await state(p);
        await click(p, 'ly-relation-stay');
        check(
          JSON.stringify(await state(p)) === JSON.stringify(beforeStay),
          label + ' Stay preserves position'
        );
        const dock = await p.locator(width < 960 ? '#ly-linedock' : '#ly-linebar').boundingBox();
        if (width < 960 && dock) check(dock.height <= 61.5, label + ' ordinary row <=61px');
        await p.screenshot({ path: path.join(out, `journey-${width}-${height}.png`) });
        results.push({
          kind: 'journey',
          width,
          height,
          initialDock,
          original,
          returned,
          stale,
          refused,
          staleEvents: await p.evaluate(() => window.staleEvents),
          beforeStay,
          afterStay: await state(p),
          dock,
        });
      } catch (e) {
        errors.push(label + ': ' + e.message);
        console.error(label, e.message);
        await p.screenshot({ path: path.join(out, `failure-${width}-${height}.png`) });
      } finally {
        await p.finish();
      }
    }

    for (const [width, height] of [
      [1180, 757],
      [390, 508],
    ]) {
      if (process.env.TEST_ONLY === 'stale') continue;
      const p = await open(width, height);
      try {
        const longPrefix = prefix + '\n'.repeat(35),
          longText = longPrefix + evidence.source_text;
        await receive(p, 'transport', true, longText);
        await p.evaluate((start) => {
          lyDraft().focus();
          lyDraft().setSelectionRange(start, start + 3, 'forward');
          lyDraft().dispatchEvent(new Event('select', { bubbles: true }));
        }, longPrefix.length);
        await p.locator('#lyrics-draft').press('ArrowRight');
        await settle(p);
        // Ordinary wheel establishes a nonzero reading position before inspection.
        const editor = await p.locator('#lyrics-draft').boundingBox();
        await p.mouse.move(
          Math.min(width - 40, editor.x + 100),
          Math.min(height - 100, Math.max(200, editor.y + 100))
        );
        await p.mouse.wheel(0, 700);
        await settle(p);
        const before = await state(p);
        check(
          before.scroll.some(([, top]) => top > 0),
          `long ${width} nonzero origin scroll`
        );
        await click(p, 'ly-relations');
        const sessionOrigin = await p.evaluate(() => ({
          start: lyInspectionSession().origin.start,
          end: lyInspectionSession().origin.end,
          scroll: lyInspectionSession().origin.scroll.map((s) => [s.node.id, s.top]),
        }));
        const go = await control(p, 'ly-relation-go');
        await go.click();
        await settle(p);
        await click(p, 'ly-relation-reopen');
        await click(p, 'ly-relation-return');
        const after = await state(p);
        check(
          JSON.stringify(before) === JSON.stringify(after),
          `long ${width} exact Return scroll and selection`
        );
        results.push({ kind: 'long-origin', width, height, before, after, sessionOrigin });
      } catch (e) {
        errors.push('long ' + width + ': ' + e.message);
      } finally {
        await p.finish();
      }
    }
    if (process.env.TEST_ONLY !== 'stale') {
      const p = await open(1180, 757);
      try {
        await receive(p);
        await click(p, 'ly-relations');
        await (await control(p, 'ly-relation-go')).click();
        await settle(p);
        await p.locator('#lyrics-draft').fill(text + '!');
        await p.evaluate(() => {
          uiSaveLyrics();
          lyRefresh(true);
          lyDraft().setSelectionRange(2, 5, 'forward');
          lyDraft().dispatchEvent(new Event('select', { bubbles: true }));
        });
        await settle(p);
        const ret = await control(p, 'ly-relation-return');
        await ret.focus();
        const before = await state(p);
        await ret.press('Enter');
        await settle(p);
        const after = await state(p);
        check(
          JSON.stringify(after) === JSON.stringify(before),
          'keyboard stale Return preserves position'
        );
        const stay = await control(p, 'ly-relation-stay');
        await stay.focus();
        const beforeStay = await state(p);
        await stay.press('Enter');
        await settle(p);
        check(
          JSON.stringify(await state(p)) === JSON.stringify(beforeStay),
          'keyboard Stay preserves position'
        );
        await p.locator('#lyrics-draft').focus();
        await p.keyboard.press('Control+End');
        await p.keyboard.type('z');
        await settle(p);
        check(
          (await state(p)).text === before.text + 'z',
          'next intentional typing survives refusal and Stay'
        );
        results.push({ kind: 'keyboard-stale', before, after });
      } catch (e) {
        errors.push('keyboard-stale: ' + e.message);
      } finally {
        await p.finish();
      }
    }
    if (process.env.TEST_ONLY !== 'stale') {
      const p = await open(390, 508);
      try {
        await receive(p, 'transport', true, prefix + '[VERSE]\ncat bat cat\nhat');
        await click(p, 'ly-relations');
        const view = await p.evaluate(() => window.inspectionView());
        check(view.freshness === 'current', 'sectioned context has authenticated exact projection');
        check(
          await p.evaluate(
            () => LY.run.relationEvidence.evidence.request_binding.source_projection.version === 1
          ),
          'sectioned report supplies actual projection receipt'
        );
        const go = await control(p, 'ly-relation-go', ':enabled');
        const target = await go.evaluate((el) => ({ ...el.dataset }));
        const pair = view.pairs.find((pair) => pair.id === target.pair);
        const expected = view.occurrences[pair[target.side]].parts[Number(target.part)];
        await go.click();
        await settle(p);
        const actual = await state(p);
        check(
          actual.start === expected.start && actual.end === expected.end,
          'sectioned Go selects authenticated exact endpoint'
        );
        results.push({ kind: 'sectioned-projected', expected, actual });
      } catch (e) {
        errors.push('sectioned-projected: ' + e.message);
      } finally {
        await p.finish();
      }
    }
    for (const variant of [
      'none',
      'unmatched',
      'hash',
      'row',
      'range',
      'reader',
      'voices',
      'multipart',
      'history',
    ]) {
      if (process.env.TEST_ONLY === 'stale') continue;
      const p = await open(390, 508);
      try {
        let report = structuredClone(evidence);
        if (variant === 'none') report = null;
        if (variant === 'hash') report.identity.source_sha256 = 'bad';
        if (variant === 'reader') report.identity.provenance.reader_scheme = 'v1';
        if (variant === 'voices') report.identity.provenance.voices = true;
        if (variant === 'row')
          for (const record of report.records)
            for (const side of ['a', 'b'])
              record[side].source_ranges = [{ precision: 'row', utf16_range: [0, 3] }];
        if (variant === 'range')
          for (const record of report.records)
            for (const side of ['a', 'b'])
              record[side].source_ranges = [{ precision: 'exact', utf16_range: [999, 1000] }];
        await receive(p, report, variant !== 'unmatched');
        if (variant === 'history') {
          await p.locator('#ly-mtab-writer').click();
          await settle(p);
          await p.locator('[data-ui="ly-tab"][data-id="history"]:visible').first().click();
          await settle(p);
          const entry = p.locator('#ly-history-relations');
          check(await entry.isVisible(), 'History has actual Relations entry');
          await entry.focus();
          const before = await p.evaluate(() => ({
            tab: LY.tab,
            mobile: LY.mobile,
            active: document.activeElement.id,
            scroll: document.getElementById('ly-body').scrollTop,
          }));
          await entry.click();
          await settle(p);
          await click(p, 'ly-relation-back');
          const after = await p.evaluate(() => ({
            tab: LY.tab,
            mobile: LY.mobile,
            active: document.activeElement.id,
            scroll: document.getElementById('ly-body').scrollTop,
            dialog: document.getElementById('ly-relations-dialog').open,
          }));
          check(
            !after.dialog &&
              before.tab === after.tab &&
              before.mobile === after.mobile &&
              before.active === after.active &&
              before.scroll === after.scroll,
            'Back restores actual History panel focus scroll'
          );
          results.push({ kind: variant, before, after });
        } else {
          await click(p, 'ly-relations');
          if (variant === 'multipart') {
            if (await p.locator('[data-ui="ly-relation-expand"]:visible').count())
              await click(p, 'ly-relation-expand');
            const view = await p.evaluate(() => window.inspectionView());
            const pair = view.pairs.find(
              (pair) => pair.canGo && view.occurrences[pair.a].parts.length > 1
            );
            if (!pair) throw new Error('Actual transport report has no multipart A occurrence');
            const id = pair.id;
            for (const part of [1, 0]) {
              await click(
                p,
                'ly-relation-go',
                `[data-pair="${id}"][data-side="a"][data-part="${part}"]`
              );
              const actual = await state(p),
                expected = view.occurrences[pair.a].parts[part];
              check(
                actual.start === expected.start && actual.end === expected.end,
                'multipart explicit part ' + part + ' selects exact range'
              );
              await click(p, 'ly-relation-reopen');
            }
          } else {
            check(
              (await p.locator('[data-ui="ly-relation-go"]:visible:enabled').count()) === 0,
              variant + ' has no enabled Go'
            );
            check((await p.locator('.ly-relation-mark').count()) === 0, variant + ' has no marks');
          }
          results.push({ kind: variant });
        }
      } catch (e) {
        errors.push(variant + ': ' + e.message);
        console.error(variant, e.message);
      } finally {
        await p.finish();
      }
    }
    // #106 (Jony round 22): the inspector changes form with the layout, a
    // dialog at 390 and an inline panel at 1280. Focus inside it follows it
    // into the new form, onto the same control; it fell to BODY.
    {
      const p = await open(390, 844);
      try {
        await receive(p);
        await click(p, 'ly-relations');
        await (await control(p, 'ly-relation-close')).focus();
        const where = () =>
          p.evaluate(() => {
            const a = document.activeElement;
            return {
              host: a?.closest('#ly-relations-dialog')
                ? 'dialog'
                : a?.closest('#ly-relation-inspector')
                  ? 'inline'
                  : a === document.body
                    ? 'BODY'
                    : a?.id || a?.tagName,
              ui: a?.dataset?.ui || '',
            };
          });
        await p.setViewportSize({ width: 1280, height: 900 });
        await p.waitForTimeout(400);
        const wide = await where();
        check(
          wide.host === 'inline' && wide.ui === 'ly-relation-close',
          '#106 390 -> 1280 keeps focus on Close in the inline inspector: ' + JSON.stringify(wide)
        );
        await p.setViewportSize({ width: 390, height: 844 });
        await p.waitForTimeout(400);
        const narrow = await where();
        check(
          narrow.host === 'dialog' && narrow.ui === 'ly-relation-close',
          '#106 1280 -> 390 keeps focus on Close in the dialog: ' + JSON.stringify(narrow)
        );
        results.push({ kind: 'resize-focus' });
      } finally {
        await p.finish();
      }
    }
    // #108, #109 (Jony, with 3PO's committed replay fixture of 21 relation
    // records): Show all and an occurrence choice keep focus in the list and
    // say what is shown; every Go names its pair and relation.
    const replay = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          'docs/lyrics-evidence-build/integration-checks/transport/sections-blanks-repeated-utf16-go.json'
        ),
        'utf8'
      )
    );
    for (const [width, height] of [
      [1280, 900],
      [390, 844],
    ]) {
      const p = await open(width, height),
        label = `${width}x${height}`;
      try {
        // Kept together and unchanged: the draft, the request's context and
        // id, and the whole reply.
        await p.evaluate(
          ({ text, post, reply }) => {
            lyDraft().value = text;
            uiSaveLyrics();
            pushHistory();
            lyRefresh(true);
            UI.lyricRequest = {
              id: post.request_id,
              text: lyDraft().value,
              submittedContext: post.lyric_context,
            };
            lyReceive(reply, { request_id: post.request_id });
          },
          { text: replay.record.beforeClick.text, post: replay.posts[0], reply: replay.replies[0] }
        );
        // The caret inside the first "cat", as a writer inspecting it: the
        // inspector then offers its occurrences to choose from.
        await p.evaluate(() => {
          const d = lyDraft(),
            at = d.value.indexOf('cat bat cat') + 1;
          d.focus();
          d.setSelectionRange(at, at);
        });
        await settle(p);
        await click(p, 'ly-relations');
        const where = () =>
          p.evaluate(() => {
            const a = document.activeElement;
            const host = a?.closest('#ly-relations-dialog, #ly-relation-inspector');
            return {
              inList: !!host,
              ui: a?.dataset?.ui || a?.tagName || '',
              row: a?.closest('li[data-relation-id]')
                ? [...host.querySelectorAll('li[data-relation-id]')].indexOf(
                    a.closest('li[data-relation-id]')
                  )
                : -1,
            };
          });
        const said = () =>
          p.evaluate(() =>
            [...document.querySelectorAll('[data-relation-said]')]
              .filter((e) => e.getClientRects().length || e.closest('dialog[open]'))
              .map((e) => e.textContent)
              .join('|')
          );
        // An occurrence choice: focus lands on the list's first Go, said.
        const choice = await control(p, 'ly-relation-source', ':not([data-id=""])');
        await choice.focus();
        await p.keyboard.press('Enter');
        await p.waitForTimeout(300);
        const chosen = await where();
        check(
          chosen.inList && chosen.ui === 'ly-relation-go' && chosen.row === 0,
          `#108 ${label} choosing an occurrence lands on the list's first Go: ` +
            JSON.stringify(chosen)
        );
        check(
          / pairs? for .+, L\d/.test(await said()),
          `#108 ${label} choosing an occurrence says what is shown: ` + (await said())
        );
        // All document evidence (21 pairs, 3 shown): its choice is said too,
        // and its list offers Show all.
        await click(p, 'ly-relation-stay');
        await p.evaluate(() => {
          const d = lyDraft(),
            at = d.value.indexOf('cat bat cat') + 1;
          d.focus();
          d.setSelectionRange(at, at);
        });
        await click(p, 'ly-relations');
        await (await control(p, 'ly-relation-source', '[data-id=""]')).focus();
        await p.keyboard.press('Enter');
        await p.waitForTimeout(300);
        const all = await where();
        check(
          all.inList && all.ui === 'ly-relation-go' && all.row === 0,
          `#108 ${label} choosing All document evidence lands on the first Go: ` +
            JSON.stringify(all)
        );
        check(
          /^All document evidence: \d+ pairs$/.test(await said()),
          `#108 ${label} choosing All document evidence says it: ` + (await said())
        );
        // Show all: focus lands on the first newly shown pair's Go, said.
        const expand = await control(p, 'ly-relation-expand');
        check((await expand.count()) === 1, `#108 ${label} offers Show all`);
        await expand.focus();
        await p.keyboard.press('Enter');
        await p.waitForTimeout(300);
        const shown = await where();
        check(
          shown.inList && shown.ui === 'ly-relation-go' && shown.row === 3,
          `#108 ${label} Show all lands on the first newly shown pair: ` + JSON.stringify(shown)
        );
        check(
          /^Showing all \d+ pairs$/.test(await said()),
          `#108 ${label} Show all says it: ` + (await said())
        );
        // #109: every Go's name starts with its words and names its pair.
        const names = await p.evaluate(() =>
          [...document.querySelectorAll('[data-ui="ly-relation-go"]')]
            .filter((b) => b.getClientRects().length)
            .map((b) => [b.textContent.trim(), b.getAttribute('aria-label') || ''])
        );
        check(
          names.length > 3 &&
            names.every(([t, n]) => n.startsWith(t + ', pair ') && n.length > t.length + 8) &&
            new Set(names.map(([, n]) => n)).size === names.length,
          `#109 ${label} each Go names its pair and relation: ` + JSON.stringify(names.slice(0, 3))
        );
        results.push({ kind: 'pair-list-focus-' + label });
      } catch (e) {
        errors.push('pair-list ' + label + ': ' + e.message);
        console.error('pair-list', label, e.message);
      } finally {
        await p.finish();
      }
    }
  } finally {
    await browser.close();
    await backend.close();
    fs.writeFileSync(
      path.join(out, 'results.json'),
      JSON.stringify(
        {
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
