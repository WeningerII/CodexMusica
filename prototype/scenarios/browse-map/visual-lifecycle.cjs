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
  const failures = [];
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({
        viewport: { width, height: width === 320 ? 568 : width === 390 ? 844 : 900 },
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${srv.url}/prototype/#browse`);
      await page.locator('.discovery-card').first().waitFor();
      // Real status stays visible. Compare the start keyframe to the live card
      // after two animation frames, not in the click's task.
      for (const index of [0, 1, 2, 3]) {
        const geometry = await page.evaluate(async (i) => {
          const card = document.querySelectorAll('.discovery-card')[i];
          card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const before = card.getBoundingClientRect().top;
          card.click();
          const cue = document.querySelector('.discovery-container-motion');
          // Keep a busy CI host from finishing naturally before our second
          // frame. Playback still advances; native scroll delivery is untouched.
          cue?.getAnimations()[0]?.updatePlaybackRate(0.1);
          const start = cue?.getAnimations()[0].effect.getKeyframes()[0];
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const rect = card.getBoundingClientRect();
          return {
            before,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            start,
            alive: cue?.isConnected,
            visibleStatus: getComputedStyle(document.querySelector('[role="status"]')).visibility,
          };
        }, index);
        try {
          assert.equal(geometry.visibleStatus, 'visible');
          for (const key of ['top', 'left', 'width', 'height'])
            assert.ok(
              Math.abs(parseFloat(geometry.start[key]) - geometry[key]) < 1,
              `${key}: ${geometry.start[key]} vs ${geometry[key]}`
            );
          assert.equal(geometry.alive, true);
          checks += 6;
        } catch (error) {
          failures.push(`open ${width}/${index}: ${error.message}`);
        }
        if (index === 0) {
          assert.notEqual(geometry.before, geometry.top, 'first announcement must exercise reflow');
          checks++;
        }
      }
      // The first four normal selections above need not wrap differently on
      // every installed font. This separate test-only constraint makes wrapping
      // available, then calibrates a real pair from actual catalog announcements.
      // Never synthesize status text or a card box: selection still owns both.
      const wrapped = await page.evaluate(async () => {
        const status = document.querySelector('[role="status"]');
        const originalStyle = status.getAttribute('style');
        status.style.maxWidth = '20ch';
        const cards = [...document.querySelectorAll('.discovery-card')];
        cards[0].click();
        const initialHeight = status.getBoundingClientRect().height;
        const other = cards.slice(1).find((card) => {
          card.click();
          return Math.abs(status.getBoundingClientRect().height - initialHeight) > 1;
        });
        if (!other) throw Error('No catalog announcement pair exercises wrapping');
        cards[0].click();
        other.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        window.scrollTo({ top: 0, behavior: 'instant' });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const before = {
          height: status.getBoundingClientRect().height,
          top: other.getBoundingClientRect().top,
          text: status.textContent,
        };
        other.click();
        const cue = document.querySelector('.discovery-container-motion');
        cue?.getAnimations()[0]?.updatePlaybackRate(0.1);
        const start = cue?.getAnimations()[0].effect.getKeyframes()[0];
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const result = {
          before,
          height: status.getBoundingClientRect().height,
          top: other.getBoundingClientRect().top,
          text: status.textContent,
          startTop: parseFloat(start?.top),
          alive: !!cue?.isConnected,
          visible: getComputedStyle(status).visibility,
          pressed: other.getAttribute('aria-pressed'),
        };
        if (originalStyle === null) status.removeAttribute('style');
        else status.setAttribute('style', originalStyle);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return result;
      });
      try {
        assert.equal(wrapped.visible, 'visible');
        assert.notEqual(wrapped.before.text, wrapped.text);
        assert.ok(
          Math.abs(wrapped.before.height - wrapped.height) > 1,
          'real announcement height changed'
        );
        assert.ok(Math.abs(wrapped.before.top - wrapped.top) > 1, 'real shelf reflow occurred');
        assert.ok(Math.abs(wrapped.startTop - wrapped.top) < 1, 'cue starts at the reflowed card');
        assert.equal(wrapped.alive, true);
        assert.equal(wrapped.pressed, 'true');
        checks += 7;
      } catch (error) {
        failures.push(`wrap ${width}: ${error.message}`);
      }
      for (const position of ['offscreen', 'partial', 'visible']) {
        const result = await page.evaluate(async (where) => {
          const shelf = document.querySelector('.discovery-shelf');
          const card = document.querySelector('.discovery-card');
          card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
          card.click();
          shelf.scrollLeft =
            where === 'offscreen' ? shelf.scrollWidth : where === 'partial' ? 100 : 0;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const before = shelf.scrollLeft;
          document.querySelector('[data-close]').click();
          const cue = document.querySelector('.discovery-container-motion');
          // Keep a busy CI host from finishing naturally before our second
          // frame. Playback still advances; native scroll delivery is untouched.
          cue?.getAnimations()[0]?.updatePlaybackRate(0.1);
          const after = shelf.scrollLeft;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const alive = !!cue?.isConnected;
          const progressed = (cue?.getAnimations()[0]?.currentTime || 0) > 0;
          const focused = document.activeElement === card;
          // Real scroll after the reveal: no dispatched synthetic event and no
          // event suppression. It must still cancel this exact run.
          shelf.scrollBy({ left: 600, behavior: 'instant' });
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          return {
            before,
            after,
            alive,
            progressed,
            focused,
            cancelled: !cue?.isConnected,
            moved: shelf.scrollLeft !== after,
            pressed: card.getAttribute('aria-pressed'),
            hidden: document.querySelector('.discovery-detail').hidden,
          };
        }, position);
        try {
          assert.equal(result.alive, true);
          assert.equal(result.progressed, true);
          assert.equal(result.focused, true);
          assert.equal(result.pressed, 'true');
          assert.equal(result.hidden, true);
          assert.equal(result.moved, true);
          assert.equal(result.cancelled, true);
          if (position === 'visible') assert.equal(result.after, result.before);
          else if (position === 'offscreen' || width === 320)
            assert.ok(result.after < result.before);
          else assert.ok(result.after <= result.before); // Existing proximity-snap behavior is outside this pilot.
          checks += 8;
        } catch (error) {
          failures.push(`close ${width}/${position}: ${error.message}`);
        }
      }
      const earlyScroll = await page.evaluate(async () => {
        const shelf = document.querySelector('.discovery-shelf');
        const card = document.querySelector('.discovery-card');
        card.click();
        shelf.scrollLeft = shelf.scrollWidth;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        document.querySelector('[data-close]').click();
        const cue = document.querySelector('.discovery-container-motion');
        // Keep a busy CI host from finishing naturally before our second
        // frame. Playback still advances; native scroll delivery is untouched.
        cue?.getAnimations()[0]?.updatePlaybackRate(0.1);
        const revealed = shelf.scrollLeft;
        // User movement can race the reveal's queued event in the very same
        // frame. It must not be excused as the internal reveal.
        shelf.scrollBy({ left: 600, behavior: 'instant' });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { moved: shelf.scrollLeft !== revealed, cancelled: !cue?.isConnected };
      });
      assert.equal(earlyScroll.moved, true);
      assert.equal(earlyScroll.cancelled, true);
      checks += 2;
      assert.deepEqual(errors, []);
      checks++;
      await page.close();
    }
    assert.deepEqual(failures, []);
    console.log(
      `Browse visual lifecycle: ${checks}/${checks} asynchronous checks pass; visible status, native scroll, two-frame survival and genuine interruption.`
    );
  } finally {
    await browser.close();
    await srv.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
