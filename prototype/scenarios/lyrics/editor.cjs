'use strict';
// Local, temporary harness only. No shell registration or manifest completion.
// The same-origin server exposes only the two reserved feature files.
// No fixture accesses persistence directly: the injected P0-shaped adapter records calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const feature = path.resolve(__dirname, '../../features/lyrics');
const sample =
  '[SETUP — title: Café]\n[Verse]\nDon’t erase—“a-b”… ♭ 𝄞 👩🏽‍🎤\nRain, rain!\n[Chorus]\nRain returns.\n';
let checks = 0;
const check = (value, message) => {
  assert(value, message);
  checks++;
};
const harness = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lyrics editor test harness</title><button id="outside">Outside</button><main id="host"></main><p id="status" role="status"></p><script type="module">
import { mount } from '/editor.js';
window.calls = []; window.changed = []; window.saved = null; window.fail = false; window.abortOnChange = false; window.announcements = [];
window.observers = []; window.typingTimers = new Set(); window.timerFires = 0;
const NativeResizeObserver = window.ResizeObserver;
window.ResizeObserver = class {
  constructor(callback) { this.active = false; this.fire = () => callback([], this); this.native = new NativeResizeObserver(callback); observers.push(this); }
  observe(node) { this.active = true; this.native.observe(node); }
  disconnect() { this.active = false; this.native.disconnect(); }
};
const nativeSetTimeout = window.setTimeout.bind(window), nativeClearTimeout = window.clearTimeout.bind(window);
window.setTimeout = (fn, delay, ...args) => {
  let handle;
  handle = nativeSetTimeout(() => { typingTimers.delete(handle); if (delay === 1000) timerFires++; fn(...args); }, delay);
  if (delay === 1000) typingTimers.add(handle);
  return handle;
};
window.clearTimeout = handle => { typingTimers.delete(handle); nativeClearTimeout(handle); };

window.adapter = {read(name) { calls.push(['read', name]); if (fail) throw Error('blocked'); return {ok:true,value:saved}; },write(name,value) { calls.push(['write',name,value]); if(fail) return {ok:false}; saved=value; return {ok:true}; }};
window.remount = (text) => { window.controller = new AbortController(); window.editor = mount(document.querySelector('#host'), {text,onChange:value=>{ changed.push(value); if (abortOnChange) controller.abort(); },storage:adapter, announce:message=>{ announcements.push(message); document.querySelector('#status').textContent=message; }, signal:controller.signal}); };
remount(${JSON.stringify(sample)});
</script></html>`;
const server = http.createServer((req, res) => {
  if (req.url === '/') return (res.setHeader('Content-Type', 'text/html'), res.end(harness));
  const file = { '/editor.js': 'editor.js', '/editor.css': 'editor.css' }[req.url];
  if (!file) return res.writeHead(404).end();
  res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
  res.end(fs.readFileSync(path.join(feature, file)));
});
(async () => {
  // P0 static rules apply to both shipped feature files. This Node scenario
  // supplies no browser persistence access or external network allowance.
  const bannedStorage =
    /\b(localStorage|sessionStorage|indexedDB|caches|serviceWorker)\b|document\.cookie/;
  for (const filename of [path.join(feature, 'editor.js'), path.join(feature, 'editor.css')]) {
    const source = fs.readFileSync(filename, 'utf8');
    check(!bannedStorage.test(source), 'P0 storage names: ' + filename);
    check(!/(?:https?:)?\/\/[\w-]+\.[\w.-]+\//i.test(source), 'P0 URL prohibition: ' + filename);
    check(
      !/\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(source),
      'P0 network channel prohibition: ' + filename
    );
    // The implementation and scenario contain no fetch calls at all.
    check(!/\bfetch\s*\(/.test(source), 'No feature fetch calls: ' + filename);
  }
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http:' + '/' + '/' + '127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    for (const width of [320, 390, 640, 1100, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
        permissions: ['clipboard-read', 'clipboard-write'],
      });
      const requests = [],
        errors = [];
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin || !['/', '/editor.js', '/editor.css'].includes(url.pathname)) {
          requests.push(url.pathname);
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(origin);
      const draft = page.locator('textarea');
      await draft.waitFor();
      check((await draft.inputValue()) === sample, 'Exact notation/punctuation initial text');
      check(
        await page.evaluate(() => document.activeElement === document.body),
        'Mount does not steal focus'
      );
      await draft.focus();
      await page.keyboard.press('Control+End');
      await page.keyboard.type('abc');
      await page.keyboard.press('Control+z');
      check((await draft.inputValue()) === sample, 'Typing run is one undo');
      await page.keyboard.press('Control+Shift+z');
      check((await draft.inputValue()) === sample + 'abc', 'Grouped redo');
      await page.waitForTimeout(1100);
      await page.keyboard.type('def');
      await page.keyboard.press('Control+z');
      check((await draft.inputValue()) === sample + 'abc', 'Pause splits typing run');
      await page.keyboard.press('Control+z');
      check((await draft.inputValue()) === sample, 'Earlier typing group intact');
      await page.keyboard.type('xy');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Control+z');
      check((await draft.inputValue()) === sample + 'xy', 'Deletion is distinct from insertion');
      await page.keyboard.press('Control+z');
      check((await draft.inputValue()) === sample, 'Undo insertion after undo deletion');
      await page.keyboard.press('Control+End');
      await page.keyboard.type('typed');
      await page.evaluate(() => navigator.clipboard.writeText('—paste ♯'));
      await page.keyboard.press('Control+v');
      check(
        (await draft.inputValue()) === sample + 'typed—paste ♯',
        'Native paste preserves notation'
      );
      await page.keyboard.press('Control+z');
      check((await draft.inputValue()) === sample + 'typed', 'Paste is its own undo step');
      await page.keyboard.press('Control+z');
      check((await draft.inputValue()) === sample, 'Typing before paste remains grouped');
      await page.evaluate(() => {
        const d = document.querySelector('textarea');
        window.originalNode = d;
        d.setSelectionRange(0, 0);
      });
      await page.keyboard.press('ArrowRight');
      await page.keyboard.type('!');
      await page.keyboard.press('Control+z');
      check((await draft.inputValue()) === sample, 'Selection movement splits history');
      check(
        await page.evaluate(() => originalNode === document.querySelector('textarea')),
        'Draft node stable'
      );
      await page.locator('[data-action=find]').click();
      const query = page.locator('input[type=search]');
      await query.fill('rain');
      await page.keyboard.press('Shift+Enter');
      check(
        (await draft.evaluate((d) => d.value.slice(d.selectionStart, d.selectionEnd))) === 'Rain' &&
          (await draft.evaluate((d) => d.selectionStart)) === sample.lastIndexOf('Rain'),
        'Initial reverse Find starts at last match'
      );
      await query.focus();
      await query.fill('');
      await query.fill('rain');
      await page.keyboard.press('Enter');
      check(
        (await draft.evaluate((d) => d.value.slice(d.selectionStart, d.selectionEnd))) === 'Rain',
        'Find exact first range'
      );
      await page.locator('[data-action=next]').click();
      check(
        (await draft.evaluate((d) => d.value.slice(d.selectionStart, d.selectionEnd))) === 'Rain',
        'Find next exact range'
      );
      check(
        await query.evaluate((n) => document.activeElement === n),
        'Find retains search-field focus for repeated navigation'
      );
      check(
        (await page.locator('output').textContent()) === '2 of 2 lines',
        'Find counts sung lines, not occurrences'
      );
      await page.keyboard.press('Escape');
      check(
        await page.locator('[data-action=find]').evaluate((b) => document.activeElement === b),
        'Find Escape restores trigger'
      );
      await page.locator('[data-action=find]').click();
      await query.fill('👩🏽‍🎤');
      await page.keyboard.press('Enter');
      check(
        (await draft.evaluate((d) => d.value.slice(d.selectionStart, d.selectionEnd))) === '👩🏽‍🎤',
        'Unicode exact selection'
      );
      await page.locator('[data-action=close-find]').click();
      await page.locator('[data-action=outline]').click();
      check(
        (await page.locator('aside nav button').count()) === 2,
        'Setup excluded from section outline'
      );
      await page.locator('aside nav button').nth(1).click();
      check(
        await draft.evaluate((d) => d.value.slice(d.selectionStart).startsWith('[Chorus]')),
        'Outline jump exact'
      );
      check(
        (await page.locator('aside nav [aria-current]').textContent()) === 'Chorus · 1 lines',
        'Caret section marked'
      );
      await page.locator('[data-action=close-outline]').click();
      check(
        await page.locator('[data-action=outline]').evaluate((b) => document.activeElement === b),
        'Outline close restores trigger'
      );
      await page.locator('[data-action=display]').click();
      await page.locator('select').selectOption('1.5');
      await page.locator('input[type=checkbox]').check();
      check((await draft.inputValue()) === sample, 'Display leaves raw text unchanged');
      check(
        (await page.locator('.pl-numbers div').count()) === sample.split('\n').length,
        'Logical line numbers'
      );
      check(
        await page.evaluate(() => calls.every((c) => c[1] === 'display')),
        'Only bounded display storage key'
      );
      await page.locator('[data-action=close-display]').click();
      // Explicit text enlargement separate from the 640 CSS px zoom-equivalent viewport.
      await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        ),
        '200% text no page overflow @' + width
      );
      check(
        (await draft.evaluate((d) => parseFloat(getComputedStyle(d).fontSize))) >= 48,
        'Text enlargement takes effect'
      );
      await page.evaluate(() => (document.documentElement.style.fontSize = ''));
      check(
        await page.evaluate(() =>
          [...document.querySelectorAll('.pl-editor button')]
            .filter((b) => b.getClientRects().length)
            .every((b) => b.getBoundingClientRect().height >= 44)
        ),
        '44px button height'
      );
      // Hiding routes leaves the node, selection and history intact.
      await draft.focus();
      await page.keyboard.press('Control+End');
      await page.keyboard.type('route');
      await page.evaluate(() => {
        const host = document.querySelector('#host');
        window.beforeHide = document.querySelector('textarea');
        host.hidden = true;
        document.querySelector('#outside').focus();
        host.hidden = false;
      });
      check(
        await page.evaluate(() => beforeHide === document.querySelector('textarea')),
        'Route hide/show retains node'
      );
      await page.evaluate(() => editor.focus());
      await page.keyboard.press('Control+z');
      check((await draft.inputValue()) === sample, 'History survives hide/show');
      await page.locator('[data-action=find]').click();
      await query.focus();
      await query.fill('');
      await page.keyboard.type('native');
      await page.keyboard.press('Control+z');
      check((await query.inputValue()) !== 'native', 'Find field has native undo');
      await page.keyboard.press('Control+Shift+z');
      check((await query.inputValue()) === 'native', 'Find field has native redo');
      check((await draft.inputValue()) === sample, 'Find field undo does not change document');
      await page.locator('[data-action=close-find]').click();
      await page.evaluate(() => {
        const d = document.querySelector('textarea');
        d.style.height = '600px';
      });
      await page.waitForFunction(
        () =>
          Math.abs(
            document.querySelector('textarea').getBoundingClientRect().height -
              document.querySelector('.pl-numbers').getBoundingClientRect().height
          ) < 2
      );
      check(
        (await draft.evaluate((d) =>
          Math.abs(
            d.getBoundingClientRect().height -
              document.querySelector('.pl-numbers').getBoundingClientRect().height
          )
        )) < 2,
        'Gutter follows resized editor'
      );
      // Independent review regression: deleting one normalized newline must not
      // change the byte representation of its untouched adjacent neighbour.
      for (const selected of [
        [1, 2],
        [2, 3],
      ]) {
        await page.evaluate(() => {
          editor.unmount();
          remount('A\r\n\nB');
        });
        await draft.focus();
        await draft.evaluate((d, range) => d.setSelectionRange(...range), selected);
        await page.keyboard.press('Backspace');
        check(
          (await page.evaluate(() => changed.at(-1))) === (selected[0] === 1 ? 'A\nB' : 'A\r\nB'),
          'Delete exact mixed newline selection'
        );
        await page.keyboard.press('Control+z');
        check(
          (await page.evaluate(() => changed.at(-1))) === 'A\r\n\nB',
          'Undo exact mixed newline deletion'
        );
      }
      // Mixed source newline bytes survive edits and grouped undo through onChange.
      await page.evaluate(() => {
        editor.unmount();
        remount('[Verse]\r\nCafé\nNext\rEnd');
      });
      await draft.focus();
      await page.keyboard.press('Control+End');
      await page.keyboard.type('!');
      check(
        (await page.evaluate(() => changed.at(-1))) === '[Verse]\r\nCafé\nNext\rEnd!',
        'Mixed newline source preserved'
      );
      await page.keyboard.press('Control+z');
      check(
        (await page.evaluate(() => changed.at(-1))) === '[Verse]\r\nCafé\nNext\rEnd',
        'Undo restores exact raw source'
      );
      // Interrupted host navigation: destroy cancels listeners/timers; remount is clean.
      await page.evaluate(() => {
        editor.unmount();
        editor.unmount();
        remount('fresh');
      });
      await draft.focus();
      await page.keyboard.press('Control+End');
      await page.keyboard.type('!');
      await page.keyboard.press('Control+z');
      check(
        (await draft.inputValue()) === 'fresh',
        'Remount does not retain old history or listeners'
      );
      await page.evaluate(() => {
        editor.unmount();
        fail = true;
        remount('blocked');
      });
      check(
        /unavailable/i.test(await page.locator('#status').textContent()),
        'Read failure visible'
      );
      await page.locator('[data-action=display]').click();
      await page.locator('select').selectOption('1.25');
      check(
        /not saved/i.test(await page.locator('#status').textContent()),
        'Write failure visible'
      );
      await draft.focus();
      await page.keyboard.press('Control+End');
      await page.keyboard.type('!');
      check((await draft.inputValue()) === 'blocked!', 'Editing works with unavailable storage');
      check(
        (await page.evaluate(() => typingTimers.size)) === 1,
        'Typing timer armed before abort'
      );
      await page.evaluate(() => {
        window.retiredRoot = document.querySelector('.pl-editor');
        window.retiredDraft = document.querySelector('textarea');
        window.retiredObserver = observers.at(-1);
        window.firesBeforeAbort = timerFires;
        window.changesBeforeAbort = changed.length;
        controller.abort();
      });
      check(
        (await page.evaluate(() => typingTimers.size)) === 0,
        'Abort immediately clears typing timer'
      );
      check(
        await page.evaluate(() => !retiredObserver.active),
        'Abort immediately disconnects resize observer'
      );
      check(
        (await page.locator('#host').evaluate((h) => h.children.length)) === 0,
        'Abort removes owned nodes and stylesheet without unmount'
      );
      await page.evaluate(() => {
        // Reattach the captured DOM to make a stale focus/observer callback
        // observable; detached DOM alone would make focus() appear harmless.
        document.querySelector('#host').append(retiredRoot);
        document.querySelector('#outside').focus();
        window.focusBefore = document.activeElement;
        window.mutations = [];
        window.gutterObserver = new MutationObserver((records) => mutations.push(...records));
        gutterObserver.observe(retiredRoot.querySelector('.pl-numbers'), {
          attributes: true,
          childList: true,
          subtree: true,
        });
        retiredDraft.style.height = '777px';
        editor.focus();
        retiredObserver.fire(); // a delivery queued before disconnect
        retiredDraft.value += ' after abort';
        retiredDraft.dispatchEvent(
          new InputEvent('input', { bubbles: true, inputType: 'insertText' })
        );
      });
      await page.waitForTimeout(1100);
      check(
        await page.evaluate(() => timerFires === firesBeforeAbort),
        'Aborted typing timer never fires'
      );
      check(
        (await page.evaluate(() => mutations.length + gutterObserver.takeRecords().length)) === 0,
        'No gutter updates after abort, resize or queued callback'
      );
      check(
        await page.evaluate(() => document.activeElement === focusBefore),
        'focus() is inert after abort even with reattached DOM'
      );
      check(
        await page.evaluate(() => changed.length === changesBeforeAbort),
        'Aborted input listener emits no changes'
      );
      await page.evaluate(() => {
        gutterObserver.disconnect();
        retiredRoot.remove();
        editor.unmount();
        controller.abort();
        editor.unmount();
      });
      check(
        (await page.locator('#host').evaluate((h) => h.children.length)) === 0,
        'Abort then repeated unmount is idempotent'
      );
      await page.evaluate(() => {
        fail = false;
        remount('unmount first');
        editor.unmount();
        controller.abort();
        editor.unmount();
      });
      check(
        await page.evaluate(
          () => observers.every((observer) => !observer.active) && typingTimers.size === 0
        ),
        'Unmount then abort cleans observers and timers'
      );
      check(
        (await page.locator('#host').evaluate((h) => h.children.length)) === 0,
        'Unmount then abort leaves host empty'
      );
      for (const operation of ['edit', 'undo']) {
        await page.evaluate(() => {
          abortOnChange = false;
          remount('reentrant');
        });
        await draft.focus();
        await page.keyboard.press('Control+End');
        if (operation === 'undo') await page.keyboard.type('!');
        await page.evaluate(() => {
          window.reentrantRoot = document.querySelector('.pl-editor');
          window.reentrantMutations = [];
          window.reentrantObserver = new MutationObserver((records) =>
            reentrantMutations.push(...records)
          );
          reentrantObserver.observe(reentrantRoot.querySelector('.pl-numbers'), {
            attributes: true,
            childList: true,
            subtree: true,
          });
          window.announcementsBefore = announcements.length;
          window.savedOnAbort = null;
          controller.signal.addEventListener(
            'abort',
            () => {
              reentrantObserver.takeRecords();
              reentrantMutations.length = 0;
              savedOnAbort = document.activeElement;
            },
            { once: true }
          );
          abortOnChange = true;
        });
        await page.keyboard.press(operation === 'undo' ? 'Control+z' : 'x');
        check(
          (await page.locator('#host').evaluate((h) => h.children.length)) === 0,
          'Reentrant ' + operation + ' abort removes mount'
        );
        check(
          (await page.evaluate(
            () => reentrantMutations.length + reentrantObserver.takeRecords().length
          )) === 0,
          'No DOM updates after reentrant ' + operation + ' abort'
        );
        check(
          await page.evaluate(() => announcements.length === announcementsBefore),
          'No announcement after reentrant ' + operation + ' abort'
        );
        check(
          await page.evaluate(() => document.activeElement === savedOnAbort),
          'No focus change after reentrant ' + operation + ' abort'
        );
        check(
          await page.evaluate(() => typingTimers.size === 0 && observers.every((o) => !o.active)),
          'Reentrant abort clears resources'
        );
        await page.evaluate(() => {
          reentrantObserver.disconnect();
          editor.unmount();
          abortOnChange = false;
        });
      }
      check((await page.locator('#outside').count()) === 1, 'Unmount preserves sibling content');
      check(errors.length === 0, 'No browser errors: ' + errors.join());
      check(requests.length === 0, 'No requests outside harness');
      await context.close();
    }
    console.log(
      `Lyrics editor: ${checks} checks passed (isolated harness; no integrated row completion).`
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
