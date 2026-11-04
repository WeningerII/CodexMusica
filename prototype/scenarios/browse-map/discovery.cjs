// Fixture globals assigned on window inside page.evaluate; not Node globals.
/* global beforeWrites:readonly, c2:readonly, c3:readonly, c4:readonly, c5:readonly, controller:readonly, destroyed:writable, detailNode:readonly, echo:readonly, featureHandle:readonly, firstNode:readonly, fixtureContext:readonly, fixtureItems:readonly, h:readonly, highlights:readonly, livePick:readonly, mapCalls:readonly, mapPick:readonly, mountDiscovery:readonly, notices:readonly, pendingCalls:readonly, releases:writable, resolveReady:readonly, userEvents:writable, userMapPick:readonly, writes:readonly */
// Source reconciliation through GitHub connector, P1 2a3d9928078a68eaf8b0c20e76c903a535971cb8:
// workbench.js rows-scroll (1264): .85 viewport steps; uiRowsMeasure: end disabling.
// workbench.css (2822): native overflow/proximity snap; touch arrows hidden (3032).
// genre.js changed since local 72d5a299: reserved place slot, delayed hydration,
// overflow expansion via gpPlaceFit; workbench adds Enter/Space genre-place activation.
// genre.css adds reserved one/two-line slots and expanded labels. NOT implemented here:
// async catalog hydration, place collapse/expansion, progressive row append, photo
// details and full inspectors. P2 739 f7226862072e129a72e9f09b5304d7ea4679f17c
// pins place shape; display its label/region/coordinates and distinguish review levels.
// Verified fixtures below are synthetic: actual P2 has 0 human-verified records.
// Production gpSelect focuses heading; this lane follows Don's explicit no-focus-transfer
// adapter contract. Instant scrolling and visible touch buttons are prototype choices.
// workbench.css, instrument.js, map.js, atlas.js and inventory blobs match local HEAD.
// Settled contract 6640163315: onSelect is user-only; commands never echo.
// The deliberately echoing regression fixture below is adversarial, not compliant.
// Atlas has no required command/event protocol or isolated storage yet: P3 blocked.
// Standalone fixture harness only; no real atlas/catalog or manifest completion.
// NODE_PATH=/path/to/playwright/node_modules node prototype/scenarios/browse-map/discovery.cjs
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const feature = path.resolve(__dirname, '../../features/browse-map');
const server = http.createServer((req, res) => {
  const name = req.url.split('/').pop();
  if (['discovery.js', 'discovery.css'].includes(name)) {
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/css');
    return res.end(fs.readFileSync(path.join(feature, name)));
  }
  res.setHeader('Content-Type', 'text/html');
  res.end(
    '<!doctype html><meta name="viewport" content="width=device-width"><title>Discovery test doubles</title><div id="host"></div><button id="outside">Other route</button>'
  );
});
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  let checks = 0;
  try {
    for (const reducedMotion of ['reduce', 'no-preference'])
      for (const width of [320, 390, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion });
        await page.goto(`http://127.0.0.1:${server.address().port}/prototype/index.html`);
        await page.evaluate(async () => {
          const { mount } = await import('./features/browse-map/discovery.js');
          window.mountDiscovery = mount;
          window.controller = new AbortController();
          window.notices = [];
          window.writes = [];
          window.mapCalls = [];
          window.highlights = [];
          window.destroyed = 0;
          window.fixtureItems = Object.freeze(
            Array.from({ length: 12 }, (_, n) =>
              Object.freeze({
                id: `fixture-${n}`,
                name: `Test tradition ${n}`,
                family: 'Test family',
                place: n
                  ? Object.freeze({
                      lat: 0,
                      lng: 0,
                      label: 'Fixture place with a deliberately long supplied label '.repeat(12),
                      region: 'Fixture region',
                      provenance: Object.freeze({
                        status: ['verified', 'reviewed', 'unreviewed'][n % 3],
                        ...(n === 1 ? { method: 'Synthetic model fixture', on: '2026-11-04' } : {}),
                      }),
                    })
                  : null,
              })
            )
          );
          window.fixtureContext = {
            items: fixtureItems,
            signal: controller.signal,
            storage: {
              read: () => ({ ok: true, value: null }),
              write: (...args) => {
                writes.push(args);
                return { ok: !window.refuse };
              },
            },
            announce: (text) => notices.push(text),
            map: {
              ready: Promise.resolve(),
              select: (id) => {
                mapCalls.push(id);
              },
              highlight: (ids) => highlights.push(ids),
              onSelect: (fn) => {
                let active = true;
                window.mapPick = (id) => {
                  if (active) fn(id);
                };
                return () => {
                  active = false;
                  destroyed++;
                };
              },
            },
          };
          window.featureHandle = mount(document.querySelector('#host'), fixtureContext);
        });
        await page.waitForFunction(
          () =>
            document.querySelector('.discovery-shelf').scrollWidth >
            document.querySelector('.discovery-shelf').clientWidth
        );
        assert(await page.locator('[data-step="-1"]').isDisabled());
        checks++;
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        checks++;
        await page.locator('[data-step="1"]').click();
        await page.waitForFunction(() => document.querySelector('.discovery-shelf').scrollLeft > 0);
        await page.evaluate(() => {
          const s = document.querySelector('.discovery-shelf');
          s.scrollLeft = s.scrollWidth;
        });
        await page.waitForFunction(() => document.querySelector('[data-step="1"]').disabled);
        checks++;
        await page.evaluate(() => {
          const s = document.querySelector('.discovery-shelf');
          s.scrollLeft = 0;
          s.focus();
        });
        await page.keyboard.press('ArrowRight');
        assert(
          await page.evaluate(
            () => document.activeElement === document.querySelectorAll('.discovery-card')[1]
          )
        );
        checks++;
        await page.locator('.discovery-card span').first().click();
        assert(
          await page
            .locator('[data-location]')
            .textContent()
            .then((t) => t.includes('No fixed origin'))
        );
        assert.deepEqual(await page.evaluate(() => mapCalls), ['fixture-0']);
        checks += 2;
        await page.evaluate(() => {
          window.firstNode = document.querySelector('.discovery-card');
          window.detailNode = document.querySelector('.discovery-detail');
          firstNode.focus();
          firstNode.click();
        });
        assert.equal(await page.evaluate(() => writes.length), 1);
        checks++;
        await page.evaluate(() => mapPick('fixture-1'));
        assert(
          await page.evaluate(
            () =>
              document.activeElement === firstNode &&
              firstNode === document.querySelector('.discovery-card') &&
              detailNode === document.querySelector('.discovery-detail')
          )
        );
        checks++;
        assert.match(await page.locator('[data-provenance]').textContent(), /not human verified/);
        checks++;
        assert(
          await page.evaluate(
            () =>
              document
                .querySelector('[data-location]')
                .textContent.includes(fixtureItems[1].place.label) &&
              Object.isFrozen(fixtureItems) &&
              Object.isFrozen(fixtureItems[1].place) &&
              Object.isFrozen(fixtureItems[1].place.provenance)
          )
        );
        checks++;
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        checks++;
        await page.evaluate(() => {
          mapPick('missing');
        });
        assert.equal(await page.locator('.discovery-detail h2').textContent(), 'Test tradition 1');
        checks++;
        // Route hiding preserves nodes and selected state; revealing does not steal focus.
        await page.evaluate(() => {
          const host = document.querySelector('#host');
          host.hidden = true;
          document.querySelector('#outside').focus();
          host.hidden = false;
        });
        assert(
          await page.evaluate(
            () =>
              document.activeElement.id === 'outside' &&
              firstNode === document.querySelector('.discovery-card')
          )
        );
        checks++;
        await page.locator('[data-close]').click();
        assert(
          await page.evaluate(
            () => document.activeElement === document.querySelector('.discovery-card[tabindex="0"]')
          )
        );
        checks++;
        await page.locator('.discovery-card').first().click();
        await page.locator('[data-close]').click();
        assert(await page.evaluate(() => document.activeElement === firstNode));
        checks++;
        // Synthetic provenance fixtures: model review is never human verification.
        await page.locator('.discovery-card').nth(1).click();
        assert.equal(
          await page.locator('[data-provenance]').textContent(),
          'Model reviewed location; not human verified. Method: Synthetic model fixture. Review date: 2026-11-04.'
        );
        checks++;
        assert.equal(
          await page.locator('[data-review-status]').getAttribute('data-review-status'),
          'reviewed'
        );
        checks++;
        await page.locator('.discovery-card').nth(2).click();
        assert.equal(
          await page.locator('[data-provenance]').textContent(),
          'Unreviewed location; not human verified.'
        );
        checks++;
        await page.locator('.discovery-card').nth(3).click();
        assert.equal(
          await page.locator('[data-provenance]').textContent(),
          'Human verified location.'
        );
        checks++;
        await page.locator('.discovery-card').first().click();
        assert.equal(
          await page.locator('[data-provenance]').textContent(),
          'No coordinate review applies.'
        );
        checks++;
        assert.equal(await page.locator('[data-review-status]').count(), 0);
        checks++;
        // Nested controls and text editing never inherit shelf arrow handling.
        assert(
          await page.evaluate(() => {
            const shelf = document.querySelector('.discovery-shelf');
            const input = document.createElement('input');
            shelf.append(input);
            const edit = document.createElement('div');
            edit.contentEditable = 'true';
            shelf.append(edit);
            return [input, edit, firstNode.querySelector('span')].every((target) => {
              const e = new KeyboardEvent('keydown', {
                key: 'ArrowRight',
                bubbles: true,
                cancelable: true,
              });
              return target.dispatchEvent(e) && !e.defaultPrevented;
            });
          })
        );
        checks++;
        await page.evaluate(() => {
          window.refuse = true;
          mapPick('fixture-2');
        });
        assert.match(await page.evaluate(() => notices.at(-1)), /could not be saved/);
        checks++;
        // Abort removes DOM, listeners, adapter; late callback is inert, teardown idempotent.
        await page.evaluate(() => {
          window.beforeWrites = writes.length;
          controller.abort();
          featureHandle.unmount();
          firstNode.click();
          mapPick('fixture-3');
          featureHandle.focus();
        });
        assert.equal(await page.locator('#host').innerHTML(), '');
        assert.equal(await page.evaluate(() => destroyed), 1);
        assert.equal(
          await page.evaluate(() => writes.length),
          await page.evaluate(() => beforeWrites)
        );
        checks += 3;
        await page.evaluate(() => {
          window.h = mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            signal: new AbortController().signal,
            items: [],
            map: null,
          });
        });
        assert(await page.locator('.discovery-empty').isVisible());
        assert(await page.locator('[data-step="1"]').isDisabled());
        checks += 2;
        await page.evaluate(() => h.unmount());
        assert.equal(await page.locator('#host').innerHTML(), '');
        checks++;
        // Explicit unmount, restored selection, and failed storage.
        await page.evaluate(() => {
          window.refuse = false;
          window.c2 = new AbortController();
          window.h = mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            signal: c2.signal,
            storage: {
              read: () => ({ ok: true, value: 'fixture-4' }),
              write: () => ({ ok: true }),
            },
          });
        });
        assert.equal(await page.locator('.discovery-detail h2').textContent(), 'Test tradition 4');
        checks++;
        await page.evaluate(() => {
          h.unmount();
          c2.abort();
        });
        assert.equal(await page.evaluate(() => destroyed), 2);
        checks++;
        await page.evaluate(() => {
          window.h = mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            signal: new AbortController().signal,
            map: null,
            storage: {
              read() {
                throw Error('refused');
              },
              write() {
                throw Error('refused');
              },
            },
          });
        });
        assert.match(await page.evaluate(() => notices.at(-1)), /could not be read/);
        checks++;
        await page.locator('.discovery-card').first().click();
        assert.match(await page.evaluate(() => notices.at(-1)), /could not be saved/);
        checks++;
        await page.evaluate(() => h.unmount());
        assert(
          await page.evaluate(() => {
            const c = new AbortController();
            c.abort();
            mountDiscovery(document.querySelector('#host'), {
              ...fixtureContext,
              signal: c.signal,
            });
            return document.querySelector('#host').children.length === 0;
          })
        );
        checks++;
        // Pending readiness must defer all commands and subscription; teardown cancels it.
        await page.evaluate(() => {
          window.pendingCalls = [];
          window.c3 = new AbortController();
          window.h = mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            signal: c3.signal,
            map: {
              ready: new Promise((r) => {
                window.resolveReady = r;
              }),
              select: (id) => pendingCalls.push(id),
              highlight: (ids) => pendingCalls.push(ids),
              onSelect: () => {
                pendingCalls.push('subscribe');
                return () => pendingCalls.push('unsubscribe');
              },
            },
          });
          document.querySelector('.discovery-card').click();
        });
        assert.deepEqual(await page.evaluate(() => pendingCalls), []);
        checks++;
        await page.evaluate(async () => {
          c3.abort();
          resolveReady();
          await Promise.resolve();
        });
        assert.deepEqual(await page.evaluate(() => pendingCalls), []);
        checks++;
        // Resolve a live adapter: latest selection/highlight is sent with focus unchanged.
        await page.evaluate(() => {
          window.c4 = new AbortController();
          window.pendingCalls = [];
          window.h = mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            signal: c4.signal,
            map: {
              ready: new Promise((r) => {
                window.resolveReady = r;
              }),
              select: (id) => pendingCalls.push(id),
              highlight: (ids) => pendingCalls.push(ids),
              onSelect: (fn) => {
                window.livePick = fn;
                return () => pendingCalls.push('unsubscribe');
              },
            },
          });
          document.querySelectorAll('.discovery-card')[2].click();
          document.querySelector('#outside').focus();
        });
        await page.evaluate(async () => {
          resolveReady();
          await Promise.resolve();
        });
        assert.deepEqual(await page.evaluate(() => pendingCalls), ['fixture-2', ['fixture-2']]);
        checks++;
        assert(await page.evaluate(() => document.activeElement.id === 'outside'));
        checks++;
        await page.evaluate(() => livePick('fixture-3'));
        assert(
          await page.evaluate(
            () =>
              document.activeElement.id === 'outside' &&
              JSON.stringify(pendingCalls.at(-1)) === '["fixture-3"]'
          )
        );
        checks++;
        await page.evaluate(() => h.unmount());
        assert.equal(await page.evaluate(() => pendingCalls.at(-1)), 'unsubscribe');
        checks++;
        // Defensive-only adversarial adapter: forbidden echoes must not reopen closed details.
        await page.evaluate(() => {
          window.h = mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            signal: new AbortController().signal,
            map: {
              ready: new Promise((r) => {
                window.resolveReady = r;
              }),
              onSelect: (fn) => {
                window.echo = fn;
                return () => {};
              },
              select: (id) => echo(id),
              highlight() {},
            },
          });
          document.querySelector('.discovery-card').click();
          document.querySelector('[data-close]').click();
        });
        await page.evaluate(async () => {
          resolveReady();
          await Promise.resolve();
        });
        assert(await page.locator('.discovery-detail').isHidden());
        checks++;
        await page.locator('.discovery-card').first().click();
        assert(await page.locator('.discovery-detail').isVisible());
        checks++;
        await page.evaluate(() => h.unmount());
        // Settled P3 contract fixture: commands emit zero user-selection events.
        await page.evaluate(() => {
          const listeners = new Set();
          window.userEvents = 0;
          window.userMapPick = (id) => {
            for (const fn of listeners) {
              userEvents++;
              fn(id);
            }
          };
          window.h = mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            signal: new AbortController().signal,
            map: {
              ready: Promise.resolve(),
              select() {},
              highlight() {},
              onSelect: (fn) => {
                listeners.add(fn);
                return () => listeners.delete(fn);
              },
            },
          });
        });
        await page.evaluate(() => {
          document.querySelector('#outside').focus();
          document.querySelectorAll('.discovery-card')[0].click();
          document.querySelectorAll('.discovery-card')[1].click();
        });
        assert.equal(await page.evaluate(() => userEvents), 0);
        checks++;
        assert(await page.evaluate(() => document.activeElement.id === 'outside'));
        checks++;
        await page.evaluate(() => userMapPick('fixture-2'));
        assert.equal(await page.evaluate(() => userEvents), 1);
        checks++;
        assert.equal(await page.locator('.discovery-detail h2').textContent(), 'Test tradition 2');
        checks++;
        assert(await page.evaluate(() => document.activeElement.id === 'outside'));
        checks++;
        await page.evaluate(() => {
          h.unmount();
          userMapPick('fixture-3');
        });
        assert.equal(await page.evaluate(() => userEvents), 1);
        checks++;
        // Synchronous abort inside subscription releases the returned subscription once.
        await page.evaluate(async () => {
          window.c5 = new AbortController();
          window.releases = 0;
          mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            signal: c5.signal,
            map: {
              ready: Promise.resolve(),
              select() {
                throw Error('dead');
              },
              highlight() {
                throw Error('dead');
              },
              onSelect() {
                c5.abort();
                return () => {
                  releases++;
                };
              },
            },
          });
          await Promise.resolve();
        });
        assert.equal(await page.evaluate(() => releases), 1);
        checks++;
        assert.equal(await page.locator('#host').innerHTML(), '');
        checks++;
        await page.evaluate(async () => {
          window.h = mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            signal: new AbortController().signal,
            map: { ready: Promise.reject(Error('unavailable')) },
          });
          await Promise.resolve();
          await Promise.resolve();
        });
        assert.match(await page.evaluate(() => notices.at(-1)), /map is unavailable/);
        checks++;
        await page.evaluate(() => h.unmount());
        // Explicitly synthetic full-size catalog; focused card and selected item are independent.
        await page.evaluate(() => {
          window.uxAbort = new AbortController();
          window.uxNotices = [];
          window.uxWrites = [];
          window.uxRefuse = false;
          window.uxItems = Object.freeze(
            Array.from({ length: 7755 }, (_, n) =>
              Object.freeze({
                id: `large-${n}`,
                name:
                  n === 0
                    ? 'Authoritative fixture family'
                    : n === 1
                      ? 'A long tradition name with enough words to span more than two lines on a small card'
                      : `Large tradition ${n}`,
                family: n === 2 ? 'missing_family' : 'large-0',
                place:
                  n === 1
                    ? Object.freeze({
                        lat: 0,
                        lng: 0,
                        label: 'Fixture place',
                        region: 'Fixture region',
                        provenance: Object.freeze({
                          status: 'reviewed',
                          method: 'model',
                          on: '2026-11-04',
                        }),
                      })
                    : null,
              })
            )
          );
          document.querySelector('#outside').focus();
          window.uxHandle = mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            items: window.uxItems,
            signal: window.uxAbort.signal,
            announce: (text) => window.uxNotices.push(text),
            storage: {
              read: () => ({ ok: true, value: 'large-2' }),
              write: (_name, value) => {
                window.uxWrites.push(value);
                return { ok: !window.uxRefuse };
              },
            },
          });
        });
        assert.equal(await page.locator('.discovery-card').count(), 7755);
        checks++;
        assert.equal(await page.locator('.discovery-card[tabindex="0"]').count(), 1);
        checks++;
        assert.equal(await page.locator('.discovery-shelf').getAttribute('tabindex'), '-1');
        checks++;
        assert(
          await page.evaluate(
            () => document.activeElement.id === 'outside' && window.uxNotices.length === 0
          )
        );
        checks++;
        assert.equal(
          await page.locator('.discovery-card[tabindex="0"]').textContent(),
          'Large tradition 2'
        );
        checks++;
        assert.equal(
          await page.locator('[data-description]').textContent(),
          'Family label unavailable (catalog ID: missing_family).'
        );
        checks++;
        await page.evaluate(() => window.uxHandle.focus());
        await page.keyboard.press('Home');
        assert.equal(
          await page.evaluate(() => document.activeElement.textContent),
          'Authoritative fixture family'
        );
        checks++;
        await page.keyboard.press('ArrowLeft');
        assert.equal(
          await page.evaluate(() => document.activeElement.textContent),
          'Authoritative fixture family'
        );
        checks++;
        assert.equal(
          await page.locator('[aria-pressed="true"]').textContent(),
          'Large tradition 2'
        );
        checks++;
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowRight');
        assert.equal(
          await page.evaluate(() => document.activeElement.textContent),
          'Large tradition 7754'
        );
        checks++;
        assert.equal(await page.locator('.discovery-card[tabindex="0"]').count(), 1);
        checks++;
        await page.keyboard.press('Tab');
        assert(await page.locator('[data-close]').evaluate((e) => e === document.activeElement));
        checks++;
        await page.keyboard.press('Shift+Tab');
        assert.equal(
          await page.evaluate(() => document.activeElement.textContent),
          'Large tradition 7754'
        );
        checks++;
        await page.keyboard.press('Enter');
        assert.equal(
          await page.locator('.discovery-detail h2').textContent(),
          'Large tradition 7754'
        );
        checks++;
        assert.equal(await page.evaluate(() => window.uxNotices.length), 1);
        checks++;
        assert.match(
          await page.evaluate(() => window.uxNotices[0]),
          /Large tradition 7754: No fixed origin/
        );
        checks++;
        // Map-origin selection updates detail, not the roving focus; no command echo.
        await page.evaluate(() => mapPick('large-1'));
        assert.equal(
          await page.evaluate(() => document.activeElement.textContent),
          'Large tradition 7754'
        );
        checks++;
        assert.equal(await page.evaluate(() => window.uxNotices.length), 2);
        checks++;
        assert.equal(
          await page.locator('[data-description]').textContent(),
          'Authoritative fixture family'
        );
        checks++;
        assert.equal(
          await page.locator('[data-provenance]').textContent(),
          'Model reviewed location; not human verified. Review date: 2026-11-04.'
        );
        checks++;
        assert.equal(
          await page.locator('.discovery-detail h2').textContent(),
          await page.evaluate(() => window.uxItems[1].name)
        );
        checks++;
        assert.equal(
          await page
            .locator('.discovery-card span')
            .nth(1)
            .evaluate((e) => getComputedStyle(e).webkitLineClamp),
          '2'
        );
        checks++;
        // Actual keyboard selection of the long-name card exposes its full heading.
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        assert.equal(
          await page.locator('.discovery-detail h2').textContent(),
          await page.evaluate(() => window.uxItems[1].name)
        );
        checks++;
        assert(
          (await page.getByRole('button', { name: 'Previous traditions', exact: true }).count()) ===
            1
        );
        checks++;
        assert(
          (await page.getByRole('button', { name: 'Next traditions', exact: true }).count()) === 1
        );
        checks++;
        // One informative announcement includes a refused save, without duplicate messages.
        await page.evaluate(() => {
          window.uxRefuse = true;
          window.uxNotices = [];
        });
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => window.uxNotices.length), 1);
        checks++;
        assert.match(
          await page.evaluate(() => window.uxNotices[0]),
          /Large tradition 2: No fixed origin.*could not be saved/
        );
        checks++;
        await page.evaluate(() => {
          window.uxDetached = document.activeElement;
          window.uxBefore = window.uxWrites.length;
          window.uxAbort.abort();
          window.uxHandle.focus();
          window.uxDetached.click();
          mapPick('large-3');
        });
        assert.equal(await page.locator('#host').innerHTML(), '');
        checks++;
        assert(await page.evaluate(() => window.uxWrites.length === window.uxBefore));
        checks++;
        // Large default fonts must wrap controls rather than overflow the page.
        await page.evaluate(() => {
          window.h = mountDiscovery(document.querySelector('#host'), {
            ...fixtureContext,
            signal: new AbortController().signal,
            map: null,
          });
        });
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32 } });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        checks++;
        await page.evaluate(() => h.unmount());
        await page.close();
      }
    console.log(
      `PASS ${checks} assertions at 320, 390, 1280px with reduced and normal motion. Injected fixtures only; atlas and shell integration unverified.`
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
