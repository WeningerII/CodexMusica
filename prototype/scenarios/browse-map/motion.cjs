const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { start } = require('../../../scripts/_pages_server.js');

(async () => {
  const srv = await start({ root: path.resolve(__dirname, '../../..') });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  let checks = 0;
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: true,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${srv.url}/prototype/#browse`);
      const cards = page.locator('.discovery-card');
      await cards.first().waitFor();
      const detail = page.locator('.discovery-detail');
      const bridge = page.locator('.discovery-container-motion');
      // Catalog-backed cards, using native touch and keyboard activation.
      for (let index = 0; index < 3; index++) {
        const card = cards.nth(index);
        await card.focus();
        if (index === 1) await card.tap();
        else await page.keyboard.press(index === 2 ? 'Space' : 'Enter');
        assert.equal(await detail.locator('h2').textContent(), await card.textContent());
        assert.equal(await card.getAttribute('aria-pressed'), 'true');
        assert.equal(new URL(page.url()).hash, '#browse');
        await page.waitForFunction(() => !document.querySelector('.discovery-container-motion'));
        await detail.locator('[data-close]').click();
        assert.equal(await detail.isVisible(), false);
        assert.equal(await card.evaluate((el) => el === document.activeElement), true);
        assert.equal(await card.getAttribute('aria-pressed'), 'true');
        checks += 6;
      }
      // Observe the actual animated bridge synchronously, then interrupt at
      // different points without letting Playwright wait for visual stability.
      for (const progress of [0.25, 0.5, 0.75]) {
        const result = await page.evaluate((fraction) => {
          const shelf = document.querySelector('.discovery-shelf');
          const buttons = document.querySelectorAll('.discovery-card');
          buttons[0].click();
          const node = document.querySelector('.discovery-container-motion');
          const animation = node?.getAnimations()[0];
          const animated = !!animation;
          if (animation) animation.currentTime = animation.effect.getTiming().duration * fraction;
          shelf.scrollLeft = 120;
          shelf.dispatchEvent(new Event('scroll'));
          buttons[1].click();
          buttons[1].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
          const beforeClose = shelf.scrollLeft;
          document.querySelector('[data-close]').click();
          return {
            animated,
            beforeClose,
            hidden: document.querySelector('.discovery-detail').hidden,
            pressed: [...buttons].filter((b) => b.getAttribute('aria-pressed') === 'true').length,
            selected: buttons[1].getAttribute('aria-pressed'),
            focus: document.activeElement === buttons[1],
            scroll: shelf.scrollLeft,
          };
        }, progress);
        assert.equal(result.animated, true);
        assert.equal(result.hidden, true);
        assert.equal(result.pressed, 1);
        assert.equal(result.selected, 'true');
        assert.equal(result.focus, true);
        assert.equal(result.scroll, result.beforeClose);
        checks += 6;
      }
      await page.evaluate(() => {
        document.querySelector('.discovery-card').click();
        document.querySelector('.discovery-container-motion').getAnimations()[0].pause();
      });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !document.querySelector('.discovery-container-motion'));
      await page.evaluate(() => document.querySelector('[data-close]').click());
      await cards.nth(2).evaluate((el) => el.click());
      assert.equal(await bridge.count(), 0);
      assert.equal(await detail.isVisible(), true);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await cards.first().evaluate((el) => {
        el.click();
        document.querySelector('.discovery-container-motion').getAnimations()[0].pause();
      });
      await page.setViewportSize({ width: width + 10, height: 850 });
      await page.waitForFunction(() => !document.querySelector('.discovery-container-motion'));
      checks += 3;
      await page.setViewportSize({ width, height: 900 });
      // Close must reveal an offscreen opener, but preserve an already-visible one.
      for (const offscreen of [false, true]) {
        const result = await page.evaluate((hideOpener) => {
          const shelf = document.querySelector('.discovery-shelf');
          const card = document.querySelector('.discovery-card');
          card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
          card.click();
          if (hideOpener) shelf.scrollLeft = shelf.scrollWidth;
          const before = shelf.scrollLeft;
          const oldRect = card.getBoundingClientRect();
          const shelfRect = shelf.getBoundingClientRect();
          const wasOffscreen = oldRect.right <= shelfRect.left;
          document.querySelector('[data-close]').click();
          const rect = card.getBoundingClientRect();
          const cue = document.querySelector('.discovery-container-motion');
          return {
            before,
            after: shelf.scrollLeft,
            wasOffscreen,
            visible: rect.left >= shelfRect.left - 1 && rect.right <= shelfRect.right + 1,
            focus: document.activeElement === card,
            pressed: card.getAttribute('aria-pressed'),
            target: cue ? Number.parseFloat(cue.style.left) : null,
            left: rect.left,
          };
        }, offscreen);
        assert.equal(result.wasOffscreen, offscreen);
        assert.equal(result.visible, true);
        assert.equal(result.focus, true);
        assert.equal(result.pressed, 'true');
        assert.equal(result.target, result.left, 'return geometry measured after reveal');
        if (offscreen) assert.ok(result.after < result.before);
        else assert.equal(result.after, result.before);
        checks += 6;
      }
      // Absent and throwing animation APIs must leave the same instant UI.
      for (const mode of ['absent', 'throw']) {
        await page.evaluate((value) => {
          Element.prototype.animate =
            value === 'absent'
              ? undefined
              : () => {
                  throw Error('unavailable');
                };
          document.querySelector('[data-close]').click();
        }, mode);
        await cards.nth(1).evaluate((el) => el.click());
        assert.equal(await bridge.count(), 0);
        assert.equal(await detail.isVisible(), true);
        assert.equal(await detail.locator('h2').textContent(), await cards.nth(1).textContent());
        checks += 3;
      }
      assert.deepEqual(errors, []);
      checks++;
      await context.close();
    }
    console.log(
      `Browse motion: ${checks}/${checks} assertions pass (real catalog; 320/390/1280; Chromium touch emulation and keyboard).`
    );
  } finally {
    await browser.close();
    await srv.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
