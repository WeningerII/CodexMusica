// Page-side fixture globals created by boot() or page.evaluate(), not Node globals.
/* global calls, controller: writable, ctx: writable, detachedRoot, feature: writable, finishAction, finishLoad, finishPlay, finishRead, finishWrite, firstCard, focusAtStop, lastSubscriber, loadCalls, messages, mountFeature, notifySelection, oldButton, oldCard, oldMore, oldPlay, releases: writable, resolveLoad, saved: writable, selected, subscribers, writes */
// Standalone injected-fixture harness, NOT an integrated manifest scenario.
// Run: node prototype/scenarios/library/explore.cjs
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');

(async () => {
  const server = http.createServer((req, res) => {
    const files = {
      '/explore.js': ['features/library/explore.js', 'text/javascript'],
      '/explore.css': ['features/library/explore.css', 'text/css'],
    };
    if (files[req.url]) {
      const [file, type] = files[req.url];
      res.setHeader('Content-Type', type);
      res.end(fs.readFileSync(path.join(root, file)));
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<!doctype html><html lang="en"><meta charset="utf-8"><title>Library fixture harness</title><style>body{margin:8px} #host{min-width:0}</style><h1>Library fixture harness</h1><div id="host"></div>'
      );
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  let passed = 0;
  async function test(name, fn) {
    await fn();
    console.log(`PASS ${name}`);
    passed++;
  }
  const boot = async (options = {}) => {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async (options) => {
      const { mount } = await import('/explore.js');
      window.mountFeature = mount;
      window.messages = [];
      window.calls = [];
      window.writes = [];
      window.loadCalls = [];
      window.saved = options.position ?? null;
      window.controller = new AbortController();
      const collections = Array.from({ length: 41 }, (_, i) => ({
        id: `c${i}`,
        title: `Collection ${i} with a long readable title`,
        readable: 2,
        recorded: 3,
        language: 'eng',
        languageLabel: 'English',
        first: `r${i}-first`,
        art: i === 0 ? 'art-first' : null,
      }));
      collections.push({
        id: 'held',
        title: 'Held metadata',
        language: 'eng',
        readable: 0,
        recorded: 1,
      });
      collections[1].first = null; // The shell resolves appended/null-first cards too.
      collections.push(
        ...collections
          .slice(0, 2)
          .map((c) => ({ ...c, id: `fas-${c.id}`, language: 'fas', languageLabel: 'Persian' }))
      );
      window.selected = { c0: 'some' };
      window.subscribers = new Set();
      window.releases = 0;
      window.notifySelection = () => subscribers.forEach((fn) => fn());
      window.ctx = {
        signal: controller.signal,
        shelves: Object.freeze(
          ['eng', 'fas'].map((language) => {
            const rows = collections.filter((c) => c.language === language && c.readable > 0);
            return Object.freeze({
              language,
              languageLabel: language === 'eng' ? 'English' : 'Persian',
              total: language === 'eng' ? options.total || rows.length : rows.length,
              cards: Object.freeze(rows.slice(0, 12).map(Object.freeze)),
            });
          })
        ),
        announce: (text) => messages.push(text),
        storage: {
          read: (key) =>
            options.deferredRead
              ? new Promise((resolve) => {
                  window.finishRead = resolve;
                })
              : options.blocked
                ? { ok: false }
                : { ok: true, value: key.endsWith('eng') ? saved : null },
          write: (key, value) => {
            writes.push([key, value]);
            saved = value;
            return options.full ? { ok: false, reason: 'quota' } : { ok: true };
          },
        },
      };
      const cursor = { eng: 12, fas: 2 };
      ctx.loadMore = (language, count) => {
        loadCalls.push([language, count]);
        const rows = collections.filter((c) => c.language === language && c.readable > 0);
        const response = () => {
          if (options.rejectLoad)
            throw { code: options.rejectLoad, message: 'Catalog changed. Reload to continue.' };
          const cards = rows
            .slice(cursor[language], cursor[language] + count)
            .map((c) => Object.freeze({ ...c, first: null }));
          cursor[language] += cards.length;
          return { cards, total: language === 'eng' ? options.total || rows.length : rows.length };
        };
        return options.deferredLoad
          ? new Promise((resolve, reject) => {
              window.finishLoad = () => {
                try {
                  resolve(response());
                } catch (e) {
                  reject(e);
                }
              };
              window.resolveLoad = resolve;
            })
          : Promise.resolve().then(response);
      };
      if (!options.noActions)
        Object.assign(ctx, {
          openCollection: (id) => {
            calls.push(['open', id]);
            if (options.deferredAction)
              return new Promise((resolve) => {
                window.finishAction = resolve;
              });
          },
          openReading: (id) => {
            calls.push(['play', id]);
            const result = () => {
              if (options.playError)
                throw { code: options.playError, message: `Supplied ${options.playError} message` };
              return {
                get unitId() {
                  window.unitReads = (window.unitReads || 0) + 1;
                  return 'reading-resolved';
                },
              };
            };
            return options.deferredPlay
              ? new Promise((resolve, reject) => {
                  window.finishPlay = () => {
                    try {
                      resolve(result());
                    } catch (error) {
                      reject(error);
                    }
                  };
                })
              : Promise.resolve().then(result);
          },
          showCredit: (id) => calls.push(['credit', id]),
          selection: {
            state: (id) => selected[id] || 'none',
            toggle: (id) => {
              calls.push(['select', id]);
              selected[id] = 'all';
              notifySelection();
            },
            subscribe: (fn) => {
              subscribers.add(fn);
              window.lastSubscriber = fn;
              return () => {
                subscribers.delete(fn);
                releases++;
              };
            },
          },
        });
      window.feature = mount(document.querySelector('#host'), ctx);
    }, options);
    await page.waitForFunction(() => !!document.querySelector('link')?.sheet);
    if (!options.deferredRead) await page.waitForTimeout(30);
  };
  const shelf = () => page.locator('[data-language="eng"]');
  const scroll = () => shelf().locator('.library-prototype-scroll');
  try {
    await test('catalog order, readable counts and vertical feed', async () => {
      await boot();
      assert.equal(await shelf().locator('article').count(), 12);
      assert.match(await shelf().textContent(), /12 of 41 collections/);
      assert.match(await shelf().textContent(), /2 readable · 3 recorded units/);
      assert.deepEqual(
        await shelf()
          .locator('article')
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.collection)),
        Array.from({ length: 12 }, (_, i) => `c${i}`)
      );
      assert.equal(await page.locator('[data-collection="held"]').count(), 0);
      const boxes = await page
        .locator('section')
        .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()));
      assert.ok(boxes[1].top >= boxes[0].bottom);
    });
    await test('stable nodes, intermediate and final Show more focus', async () => {
      await page.evaluate(() => {
        window.firstCard = document.querySelector('article');
        window.moreNode = document.querySelector('.library-prototype-more');
      });
      const more = shelf().getByRole('button', { name: /Show/ });
      await more.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () =>
          document.querySelector('[data-language=eng]').querySelectorAll('article').length === 36
      );
      assert.equal(await shelf().locator('article').count(), 36);
      assert.ok(
        await page.evaluate(
          () =>
            document.activeElement.dataset.collection === 'c12' &&
            firstCard === document.querySelector('article')
        )
      );
      await more.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () =>
          document.querySelector('[data-language=eng]').querySelectorAll('article').length === 41
      );
      assert.equal(await shelf().locator('article').count(), 41);
      assert.equal(
        await page.evaluate(() => document.activeElement.closest('article')?.dataset.collection),
        'c36'
      );
      assert.ok(await page.evaluate(() => firstCard === document.querySelector('article')));
      assert.match(await page.evaluate(() => messages.at(-1)), /41 of 41/);
    });
    await test('Arrow keys scroll only the shelf, excluding nested and modified keys', async () => {
      await boot();
      await scroll().focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(60);
      assert.ok(await scroll().evaluate((n) => n.scrollLeft > 100));
      const prevented = await scroll().evaluate((n) => {
        const nested = new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        });
        n.querySelector('button').dispatchEvent(nested);
        const modified = new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        n.dispatchEvent(modified);
        return [nested.defaultPrevented, modified.defaultPrevented];
      });
      assert.deepEqual(prevented, [false, false]);
    });
    await test('saved index beyond first batch restores and survives remount', async () => {
      await boot({ position: 16 });
      assert.ok((await shelf().locator('article').count()) > 16);
      assert.ok(await scroll().evaluate((n) => n.scrollLeft > 2000));
      await scroll().evaluate((n) => {
        n.scrollLeft = 1200;
      });
      await page.waitForTimeout(650);
      const saved = await page.evaluate(() => saved);
      assert.ok(saved > 0 && saved < 16);
      await page.evaluate(() => {
        feature.unmount();
        feature = mountFeature(document.querySelector('#host'), ctx);
      });
      await page.waitForTimeout(100);
      assert.ok(await scroll().evaluate((n) => n.scrollLeft > 500));
    });
    await test('blocked reads and full writes report unsaved without losing browsing', async () => {
      await boot({ blocked: true, full: true });
      assert.match(await shelf().textContent(), /position unsaved/);
      await scroll().evaluate((n) => {
        n.scrollLeft = 500;
      });
      await page.waitForTimeout(650);
      assert.ok(await page.evaluate(() => writes.length > 0));
      assert.match(await shelf().textContent(), /position unsaved/);
      await shelf().getByRole('button', { name: /Show/ }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('[data-language=eng]').querySelectorAll('article').length === 36
      );
      assert.equal(await shelf().locator('article').count(), 36);
      assert.equal(
        await page.evaluate(
          () => messages.filter((m) => m.startsWith('English position unsaved')).length
        ),
        1
      );
    });
    await test('eligibility, mixed selection, first-reading order and missing adapters', async () => {
      await boot();
      const first = shelf().locator('article').first();
      assert.equal(
        await first
          .getByRole('button', { name: 'Select readable units' })
          .getAttribute('aria-pressed'),
        'mixed'
      );
      await first.getByRole('button', { name: 'Select readable units' }).click();
      assert.equal(
        await first
          .getByRole('button', { name: 'Select readable units' })
          .getAttribute('aria-pressed'),
        'true'
      );
      await first.getByRole('button', { name: 'Play first reading' }).click();
      assert.deepEqual(await page.evaluate(() => calls), [
        ['select', 'c0'],
        ['play', 'c0'],
      ]);
      assert.equal(
        await shelf()
          .locator('article')
          .nth(1)
          .getByRole('button', { name: 'Play first reading' })
          .isDisabled(),
        false
      );
      assert.equal(
        await shelf()
          .locator('article')
          .nth(1)
          .getByRole('button', { name: 'Select readable units' })
          .isDisabled(),
        false
      );
      await first.getByRole('button', { name: 'Artwork credit' }).click();
      assert.deepEqual(await page.evaluate(() => calls.at(-1)), ['credit', 'art-first']);
      await boot({ noActions: true });
      assert.equal(await shelf().locator('article button:enabled').count(), 0);
    });
    await test('frozen catalog, no recipe, external selection and immediate subscription release', async () => {
      await boot();
      assert.ok(
        await page.evaluate(
          () =>
            Object.isFrozen(ctx.shelves) &&
            ctx.shelves.every(
              (s) =>
                Object.isFrozen(s) && Object.isFrozen(s.cards) && s.cards.every(Object.isFrozen)
            ) &&
            !('recipe' in ctx)
        )
      );
      assert.ok(
        await page.evaluate(() => {
          try {
            mountFeature(document.createElement('div'), { ...ctx, recipe: {} });
          } catch (error) {
            return error instanceof TypeError;
          }
          return false;
        })
      );
      const select = shelf()
        .locator('article')
        .first()
        .getByRole('button', { name: 'Select readable units' });
      await select.focus();
      await page.evaluate(() => {
        selected.c0 = 'none';
        notifySelection();
      });
      assert.equal(await select.getAttribute('aria-pressed'), 'false');
      assert.ok(await select.evaluate((n) => n === document.activeElement));
      await page.evaluate(() => {
        selected.c0 = 'all';
        notifySelection();
      });
      assert.equal(await select.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => subscribers.size), 1);
      await page.evaluate(() => controller.abort());
      assert.deepEqual(await page.evaluate(() => [subscribers.size, releases]), [0, 1]);
      await page.evaluate(() => {
        selected.c0 = 'some';
        lastSubscriber();
      });
      assert.equal(await select.getAttribute('aria-pressed'), 'true');
      await page.evaluate(() => feature.unmount());
      assert.equal(await page.evaluate(() => releases), 1);
      await boot();
      await page.evaluate(() => feature.unmount());
      assert.deepEqual(await page.evaluate(() => [subscribers.size, releases]), [0, 1]);
      await page.evaluate(() => controller.abort());
      assert.equal(await page.evaluate(() => releases), 1);
    });
    await test('incomplete selection adapter and final expansion without actions stay usable', async () => {
      await boot({ noActions: true });
      await page.evaluate(() => {
        feature.unmount();
        ctx.selection = {};
        feature = mountFeature(document.querySelector('#host'), ctx);
      });
      const more = shelf().getByRole('button', { name: /Show/ });
      await more.focus();
      await page.keyboard.press('Enter');
      await more.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement.dataset.collection === 'c36');
      await page.waitForFunction(
        () =>
          document.querySelector('[data-language=eng]').querySelectorAll('article').length === 41
      );
      assert.equal(await shelf().locator('article').count(), 41);
    });
    await test('late write result and synchronous subscribe abort are inert', async () => {
      await boot();
      await page.evaluate(() => {
        ctx.storage.write = () =>
          new Promise((resolve) => {
            window.finishWrite = resolve;
          });
      });
      await scroll().evaluate((n) => {
        n.scrollLeft = 500;
      });
      await page.waitForFunction(() => typeof finishWrite === 'function');
      await page.evaluate(() => {
        feature.unmount();
        finishWrite({ ok: false });
      });
      await page.waitForTimeout(30);
      assert.equal(await page.evaluate(() => messages.length), 0);
      await boot();
      await page.evaluate(() => {
        feature.unmount();
        controller = new AbortController();
        ctx.signal = controller.signal;
        releases = 0;
        ctx.selection.subscribe = () => {
          controller.abort();
          return () => {
            releases++;
          };
        };
        feature = mountFeature(document.querySelector('#host'), ctx);
      });
      assert.equal(await page.evaluate(() => releases), 1);
      await page.evaluate(() => feature.unmount());
      assert.equal(await page.evaluate(() => releases), 1);
    });
    await test('quota refusal transitions to unsaved and successful retry recovers', async () => {
      await boot({ full: true });
      await page.waitForTimeout(650); // Initial CSS snap must not write device state.
      assert.equal(await page.evaluate(() => writes.length), 0);
      assert.doesNotMatch(await shelf().textContent(), /position unsaved/);
      await scroll().evaluate((n) => {
        n.scrollLeft = 500;
      });
      await page.waitForTimeout(650);
      assert.match(await shelf().textContent(), /position unsaved/);
      assert.ok(
        await page.evaluate(() => messages.includes('English position unsaved on this device.'))
      );
      await page.evaluate(() => {
        ctx.storage.write = () => ({ ok: true });
      });
      await scroll().evaluate((n) => {
        n.scrollLeft = 900;
      });
      await page.waitForTimeout(650);
      assert.doesNotMatch(await shelf().textContent(), /position unsaved/);
      assert.ok(await page.evaluate(() => messages.includes('English position saved.')));
    });
    await test('English preview 12 of 2195, one concurrent load, stable append and null targets', async () => {
      await boot({ total: 2195, deferredLoad: true });
      assert.match(await shelf().textContent(), /12 of 2195 collections/);
      await page.evaluate(() => {
        window.oldCard = document.querySelector('article');
        window.oldMore = document.querySelector('.library-prototype-more');
      });
      const more = shelf().locator('.library-prototype-more');
      await more.click();
      assert.ok(await more.isDisabled());
      await page.evaluate(() => {
        oldMore.dispatchEvent(new Event('click'));
        oldMore.dispatchEvent(new Event('click'));
      });
      assert.deepEqual(await page.evaluate(() => loadCalls), [['eng', 24]]);
      await page.evaluate(() => finishLoad());
      await page.waitForFunction(() => document.activeElement.dataset.collection === 'c12');
      assert.ok(
        await page.evaluate(
          () =>
            oldCard === document.querySelector('article') &&
            oldMore === document.querySelector('.library-prototype-more')
        )
      );
      assert.match(await shelf().textContent(), /36 of 2195 collections/);
      assert.equal(
        await shelf()
          .locator('[data-collection=c12]')
          .getByRole('button', { name: 'Play first reading' })
          .isDisabled(),
        false
      );
    });
    await test('empty/partial/duplicate/changed-total batches retain honest totals and stable nodes', async () => {
      await boot({ total: 2195, deferredLoad: true });
      const more = shelf().locator('.library-prototype-more');
      await more.click();
      await page.evaluate(() => resolveLoad({ cards: [], total: 2195 }));
      await page.waitForFunction(
        () =>
          document.querySelector('.library-prototype-more').getAttribute('aria-busy') === 'false'
      );
      assert.equal(await shelf().locator('article').count(), 12);
      assert.equal(await more.isHidden(), false);
      assert.match(await page.evaluate(() => messages.at(-1)), /No additional/);
      await more.click();
      await page.evaluate(() =>
        resolveLoad({
          cards: [{ ...ctx.shelves[0].cards[0], id: 'new-card', first: null }],
          total: 2195,
        })
      );
      await page.waitForFunction(() => document.querySelector('[data-collection="new-card"]'));
      assert.equal(await shelf().locator('article').count(), 13);
      await more.click();
      await page.evaluate(() => resolveLoad({ cards: [ctx.shelves[0].cards[0]], total: 2195 }));
      await page.waitForFunction(
        () =>
          document.querySelector('.library-prototype-more').getAttribute('aria-busy') === 'false'
      );
      assert.equal(await shelf().locator('article').count(), 13);
      assert.match(await page.evaluate(() => messages.at(-1)), /Invalid shelf response/);
      await more.click();
      await page.evaluate(() => resolveLoad({ cards: [], total: 2196 }));
      await page.waitForFunction(
        () =>
          document.querySelector('.library-prototype-more').getAttribute('aria-busy') === 'false'
      );
      assert.match(await shelf().textContent(), /13 of 2195/);
    });
    await test('DATA_CHANGED refusal preserves button/cards; retry and nested focus stay intact', async () => {
      await boot({ rejectLoad: 'DATA_CHANGED' });
      await page.evaluate(() => {
        window.oldCard = document.querySelector('article');
        window.oldMore = document.querySelector('.library-prototype-more');
      });
      await shelf().locator('.library-prototype-more').click();
      await page.waitForFunction(() => messages.some((m) => m.includes('DATA_CHANGED')));
      assert.match(
        await page.evaluate(() => messages.at(-1)),
        /DATA_CHANGED: Catalog changed. Reload to continue./
      );
      assert.ok(
        await page.evaluate(
          () =>
            oldCard === document.querySelector('article') &&
            oldMore === document.querySelector('.library-prototype-more')
        )
      );
      assert.equal(await shelf().locator('article').count(), 12);
      assert.equal(await shelf().locator('.library-prototype-more').isDisabled(), false);
      await boot({ deferredLoad: true });
      await shelf().locator('.library-prototype-more').click();
      const nested = shelf()
        .locator('article')
        .first()
        .getByRole('button', { name: 'Open collection' });
      await nested.focus();
      await page.evaluate(() => finishLoad());
      await page.waitForFunction(
        () => document.querySelectorAll('[data-language=eng] article').length === 36
      );
      assert.ok(await nested.evaluate((n) => n === document.activeElement));
    });
    await test('restore loads first, retains focus, and stops on empty or rejected data', async () => {
      await boot({ position: 30, deferredLoad: true });
      await page.waitForFunction(() => loadCalls.length === 1);
      assert.ok(await scroll().evaluate((n) => n.scrollLeft <= 6)); // Native snap may align the 6px padding.
      const nested = shelf()
        .locator('article')
        .first()
        .getByRole('button', { name: 'Open collection' });
      await nested.focus();
      await page.evaluate(() => finishLoad());
      await page.waitForFunction(
        () => document.querySelector('.library-prototype-scroll').scrollLeft > 4000
      );
      assert.ok(await nested.evaluate((n) => n === document.activeElement));
      await boot({ position: 30, deferredLoad: true });
      await page.waitForFunction(() => loadCalls.length === 1);
      await page.evaluate(() => resolveLoad({ cards: [], total: 41 }));
      await page.waitForFunction(() => messages.some((m) => m.includes('could not be restored')));
      assert.equal(await page.evaluate(() => loadCalls.length), 1);
      await boot({ position: 30, rejectLoad: 'DATA_CHANGED' });
      await page.waitForFunction(() => messages.some((m) => m.includes('could not be restored')));
      assert.equal(await shelf().locator('article').count(), 12);
    });
    await test('late load responses after abort/unmount never append, focus or announce', async () => {
      for (const method of ['abort', 'unmount']) {
        await boot({ deferredLoad: true });
        await shelf().locator('.library-prototype-more').click();
        await page.evaluate((method) => {
          window.detachedRoot = document.querySelector('.prototype-library-explore');
          method === 'abort' ? controller.abort() : feature.unmount();
          finishLoad();
        }, method);
        await page.waitForTimeout(30);
        assert.equal(
          await page.evaluate(
            () =>
              detachedRoot.querySelector('[data-language=eng]').querySelectorAll('article').length
          ),
          12
        );
        assert.equal(await page.evaluate(() => messages.length), 0);
      }
    });
    await test('Play always passes collection IDs, including null-first cards; return ignored', async () => {
      await boot();
      for (const id of ['c0', 'c1'])
        await shelf()
          .locator(`[data-collection=${id}]`)
          .getByRole('button', { name: 'Play first reading' })
          .click();
      await shelf().locator('.library-prototype-more').click();
      await page.waitForFunction(() => document.querySelector('[data-collection=c12]'));
      await shelf()
        .locator('[data-collection=c12]')
        .getByRole('button', { name: 'Play first reading' })
        .click();
      assert.deepEqual(await page.evaluate(() => calls), [
        ['play', 'c0'],
        ['play', 'c1'],
        ['play', 'c12'],
      ]);
      assert.equal(await page.evaluate(() => window.unitReads || 0), 0);
      assert.equal(
        await page.evaluate(() => document.activeElement.closest('article').dataset.collection),
        'c12'
      );
    });
    await test('all four Play failures announce supplied messages and retain originating focus', async () => {
      for (const code of ['NO_READABLE', 'NOT_FOUND', 'LOAD_FAILED', 'DATA_CHANGED']) {
        await boot({ playError: code, deferredPlay: true });
        const play = shelf()
          .locator('article')
          .first()
          .getByRole('button', { name: 'Play first reading' });
        await play.click();
        assert.ok(await play.isDisabled());
        assert.ok(await play.evaluate((n) => n === document.activeElement));
        await play.evaluate((n) => {
          n.dispatchEvent(new Event('click'));
          n.dispatchEvent(new Event('click'));
        });
        assert.deepEqual(await page.evaluate(() => calls), [['play', 'c0']]);
        await page.evaluate(() => finishPlay());
        await page.waitForFunction(() => messages.length === 1);
        assert.deepEqual(await page.evaluate(() => messages), [`Supplied ${code} message`]);
        assert.ok(await play.evaluate((n) => n === document.activeElement));
        assert.equal(await play.isDisabled(), false);
        assert.equal(await play.getAttribute('aria-busy'), null);
      }
    });
    await test('pending Play never steals moved focus and late outcomes are inert', async () => {
      await boot({ playError: 'LOAD_FAILED', deferredPlay: true });
      await shelf()
        .locator('article')
        .first()
        .getByRole('button', { name: 'Play first reading' })
        .click();
      const other = shelf()
        .locator('article')
        .nth(1)
        .getByRole('button', { name: 'Open collection' });
      await other.focus();
      await page.evaluate(() => finishPlay());
      await page.waitForFunction(() => messages.length === 1);
      assert.ok(await other.evaluate((n) => n === document.activeElement));
      for (const method of ['abort', 'unmount'])
        for (const playError of [null, 'DATA_CHANGED']) {
          await boot({ playError, deferredPlay: true });
          await shelf()
            .locator('article')
            .first()
            .getByRole('button', { name: 'Play first reading' })
            .click();
          await page.evaluate((method) => {
            window.oldPlay = document.querySelector('article button:nth-of-type(2)');
            method === 'abort' ? controller.abort() : feature.unmount();
            window.focusAtStop = document.activeElement;
            finishPlay();
          }, method);
          await page.waitForTimeout(30);
          assert.deepEqual(
            await page.evaluate(() => [
              messages.length,
              calls.length,
              document.activeElement === focusAtStop,
              window.unitReads || 0,
            ]),
            [0, 1, true, 0]
          );
          assert.equal(await page.evaluate(() => oldPlay.getAttribute('aria-busy')), 'true');
          await page.evaluate(() => oldPlay.dispatchEvent(new Event('click')));
          assert.equal(await page.evaluate(() => calls.length), 1);
        }
    });
    await test('320px, 200% text, native horizontal overflow and reduced motion', async () => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await boot();
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
      });
      const geometry = await page.evaluate(() => {
        const s = document.querySelector('.library-prototype-scroll');
        const card = s.querySelector('article');
        return {
          page: document.documentElement.scrollWidth,
          width: innerWidth,
          scrolls: s.scrollWidth > s.clientWidth,
          card: card.getBoundingClientRect().width,
          available: s.clientWidth,
          inside: card.scrollWidth <= card.clientWidth,
          overflow: getComputedStyle(s).overflowX,
          motion: getComputedStyle(s).scrollBehavior,
        };
      });
      assert.ok(geometry.page <= geometry.width);
      assert.ok(geometry.card <= geometry.available && geometry.inside && geometry.scrolls);
      assert.equal(geometry.overflow, 'auto');
      assert.equal(geometry.motion, 'auto');
    });
    await test('abort blocks new callbacks and pending action completion', async () => {
      await boot({ deferredAction: true });
      const button = shelf()
        .locator('article')
        .first()
        .getByRole('button', { name: 'Open collection' });
      await button.click();
      await page.evaluate(() => {
        controller.abort();
        finishAction();
      });
      await page.waitForTimeout(30);
      assert.ok(await button.isDisabled());
      await shelf().getByRole('button', { name: /Show/ }).click();
      assert.equal(await shelf().locator('article').count(), 12);
      assert.equal(await page.evaluate(() => calls.length), 1);
    });
    await test('unmount removes listeners, cancels saves and ignores delayed reads', async () => {
      await boot();
      await scroll().evaluate((n) => {
        n.scrollLeft = 400;
        n.dispatchEvent(new Event('scroll'));
      });
      await page.evaluate(() => {
        window.oldButton = document.querySelector('article button');
        feature.unmount();
        oldButton.click();
      });
      await page.waitForTimeout(650);
      assert.equal(await page.evaluate(() => writes.length + calls.length), 0);
      assert.equal(await page.locator('#host > *').count(), 0);
      await boot({ deferredRead: true });
      await page.evaluate(() => {
        feature.unmount();
        finishRead({ ok: false });
      });
      await page.waitForTimeout(30);
      assert.equal(await page.evaluate(() => messages.length), 0);
      assert.equal(await page.locator('#host > *').count(), 0);
    });
    assert.deepEqual(failures, []);
    console.log(
      `${passed}/${passed} standalone scenario groups passed; integrated rows remain pending.`
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
