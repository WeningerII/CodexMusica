#!/usr/bin/env node
// check_chat_counter.js — the ask bar must SAY when it is running out of room.
//
// WHY THIS GATE EXISTS
//
// `maxlength` on #chat-input is a silent wall. At the ceiling the browser stops
// accepting keystrokes and reports nothing: no message, no cursor change, no
// way to tell a full field from a frozen page. That is not a hypothetical —
// it is what someone pasting a real brief actually hit, and their conclusion
// was that the field was capped at a number it had not been capped at for a
// day, because a stale tab and a working tab fail identically when the failure
// is silence.
//
// The counter is the fix, and it is exactly the kind of thing that rots: it
// lives in three files (the span in src/index.template.html, the CSS bands
// beside it, the sync in src/app.js), none of which fails loudly if the wiring
// is dropped. A counter that has quietly stopped updating looks the same as a
// field with room to spare — the original bug, wearing the fix as a disguise.
//
// THE LOAD-BEARING ASSERTION is `follows the attribute`. The counter must read
// its ceiling off input.maxLength rather than restating it, because that
// attribute is already pinned to the server's CHAT_MAX_MESSAGE by mcp/test.mjs.
// One source, one gate. Restate the number in app.js and the next raise moves
// the wall while the counter keeps naming the old one — a counter that lies is
// worse than none, since it converts "I wonder why it stopped" into a confident
// wrong answer. So the gate changes maxlength at runtime and demands the
// counter follow.
//
// The page is booted for real (embedded build, jsdom, initChatDock wired by the
// app's own boot path) and driven with real `input` events, so this fails if
// the listener is dropped, not merely if the function is deleted.
//
// USAGE
//   node scripts/check_chat_counter.js [--verbose]
// Exit 0 if every assertion passes, 1 otherwise.

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const VERBOSE = process.argv.includes('--verbose');

// Kept in step with CHAT_COUNT_AMBER / CHAT_COUNT_RED in src/app.js. Stated
// here rather than imported because src/app.js is a browser script, not a
// module — and because a gate that reads its expectations out of the code it
// checks proves only that the code equals itself.
const AMBER = 0.7;
const RED = 0.9;

function buildTempHtml() {
  const tmp = path.join(os.tmpdir(), `codex_chatcount_${process.pid}.html`);
  // --embedded for the same reason app_recipe_regression.js uses it: this boots
  // in jsdom with no network, and the lazy shell would sit at its boot-error
  // state — which never reaches _initApp, and therefore never wires the dock.
  execFileSync(
    'node',
    [path.join(__dirname, 'build_html.js'), `--out=${tmp}`, '--quiet', '--embedded'],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );
  return tmp;
}

function boot(html) {
  return new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      // initChatDock() asks the backend whether it is configured. jsdom has no
      // fetch, and a bare ReferenceError there would abort the rest of _initApp
      // — so shim it to the "not deployed" answer the dock already handles.
      w.fetch = () => Promise.reject(new Error('offline'));
      w.storage = {
        async get() {
          return null;
        },
        async set() {},
        async delete() {},
        async list() {
          return { keys: [] };
        },
      };
      w.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      });
      w.scrollTo = () => {};
    },
  });
}

// Drive the field the way a person does — assign, then let the app hear about
// it — so a missing listener fails here rather than passing on a direct call.
function type(win, text) {
  const input = win.document.getElementById('chat-input');
  input.value = text;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  const out = win.document.getElementById('chat-count');
  return {
    hidden: out.hidden,
    text: out.textContent,
    amber: out.classList.contains('is-amber'),
    red: out.classList.contains('is-red'),
    sr: win.document.getElementById('chat-count-sr').textContent,
  };
}

const problems = [];
function check(label, fn) {
  try {
    fn();
    if (VERBOSE) console.log(`  ok    ${label}`);
  } catch (err) {
    problems.push(`${label}: ${err.message}`);
    console.log(`  FAIL  ${label} — ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const tmp = buildTempHtml();
  const dom = boot(fs.readFileSync(tmp, 'utf8'));
  const win = dom.window;
  // _initApp runs off the catalog boot; give it a turn to finish wiring.
  await new Promise((r) => setTimeout(r, 1500));

  const doc = win.document;
  const input = doc.getElementById('chat-input');
  const out = doc.getElementById('chat-count');
  const sr = doc.getElementById('chat-count-sr');

  if (!input || !out || !sr) {
    console.log('FAIL — the ask bar is missing #chat-input, #chat-count or #chat-count-sr');
    win.close();
    fs.unlinkSync(tmp);
    process.exitCode = 1;
    return;
  }

  const max = input.maxLength;
  console.log(`chat counter — ceiling read from the field: ${max}`);

  check('the field declares a ceiling at all', () => {
    assert(max > 0, `maxLength is ${max}; without one there is nothing to count against`);
  });

  check('quiet below the first band', () => {
    for (const len of [0, 1, Math.floor(max * 0.5), Math.floor(max * AMBER) - 1]) {
      const s = type(win, 'x'.repeat(len));
      assert(s.hidden, `at ${len}/${max} the counter is showing; it should stay out of the way`);
    }
  });

  check('appears, in amber, at the first band', () => {
    const s = type(win, 'x'.repeat(Math.ceil(max * AMBER)));
    assert(!s.hidden, 'the counter is still hidden at the amber threshold');
    assert(s.amber && !s.red, `bands wrong at amber: amber=${s.amber} red=${s.red}`);
  });

  check('turns red at the second band', () => {
    const s = type(win, 'x'.repeat(Math.ceil(max * RED)));
    assert(!s.hidden, 'the counter is hidden at the red threshold');
    assert(s.red && !s.amber, `bands wrong at red: amber=${s.amber} red=${s.red}`);
  });

  check('reads "used / ceiling"', () => {
    const len = Math.ceil(max * 0.8);
    const s = type(win, 'x'.repeat(len));
    assert(s.text === `${len} / ${max}`, `counter reads "${s.text}", expected "${len} / ${max}"`);
  });

  check('says so at the wall', () => {
    const s = type(win, 'x'.repeat(max));
    assert(s.text === `${max} / ${max}`, `counter reads "${s.text}" at the ceiling`);
    assert(s.red, 'the counter is not red at the ceiling');
    assert(/limit reached/i.test(s.sr), `screen readers hear "${s.sr}" at the ceiling`);
  });

  // The whole point. See the header.
  check('follows the attribute rather than restating it', () => {
    const original = input.maxLength;
    try {
      input.maxLength = 40;
      // 30/40 is 0.75 — amber against the NEW ceiling, and nowhere near any
      // band against the old one, so the bands have to have re-derived too.
      const s = type(win, 'x'.repeat(30));
      assert(
        s.text === '30 / 40',
        `counter reads "${s.text}" after maxlength moved to 40 — it is naming a ceiling of its own`
      );
      assert(!s.hidden && s.amber, 'bands did not re-derive against the new ceiling');
    } finally {
      input.maxLength = original;
    }
  });

  check('announces band crossings, not keystrokes', () => {
    type(win, 'x'.repeat(Math.ceil(max * AMBER)));
    const first = doc.getElementById('chat-count-sr').textContent;
    assert(first.trim() !== '', 'nothing was announced on entering the amber band');
    const s = type(win, 'x'.repeat(Math.ceil(max * AMBER) + 1));
    assert(
      s.sr === first,
      'the live region re-announced inside the same band — that is one utterance per keystroke'
    );
  });

  check('clears when the field is emptied', () => {
    const s = type(win, '');
    assert(s.hidden, 'the counter is still visible over an empty field');
  });

  win.close();
  fs.unlinkSync(tmp);

  if (problems.length) {
    console.log(`\nFAIL — ${problems.length} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('PASS — the ask bar counts, bands and announces against the field’s own ceiling');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
