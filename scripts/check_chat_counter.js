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
// lives in four files (the spans in src/index.template.html and the CSS bands
// beside them, its slot in the ask bar's grid in src/workbench.css, the sync in
// src/app.js, and the script writes to the field in src/workbench.js), none of
// which fails loudly if the wiring is dropped. A counter that has quietly
// stopped updating looks the same as a field with room to spare — the original
// bug, wearing the fix as a disguise.
//
// THE LOAD-BEARING ASSERTION is `follows the attribute`. The counter must read
// its ceiling off input.maxLength rather than restating it, because that
// attribute is already pinned to the server's CHAT_MAX_MESSAGE by mcp/test.mjs.
// One source, one gate. Restate the number in app.js and the next raise moves
// the wall while the counter keeps naming the old one — a counter that lies is
// worse than none, since it converts "I wonder why it stopped" into a confident
// wrong answer. So the gate changes maxlength at runtime and demands the
// counter follow. faults.js plants exactly that defect and expects this gate to
// name it.
//
// maxlength binds typing only. The workbench's Edit lyrics button assigns the
// whole draft to the field, which can put the field PAST the wall — so the
// gate also drives that button and demands the counter say "over", not
// "limit reached".
//
// The page is booted for real (embedded build, jsdom, initChatDock and the
// workbench wired by the app's own boot path) and driven with real `input`
// events and real clicks, so this fails if a listener or a sync call is
// dropped, not merely if the function is deleted.
//
// USAGE
//   node scripts/check_chat_counter.js [--verbose]
// Exit 0 if every assertion passes, 1 otherwise.

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');

const VERBOSE = process.argv.includes('--verbose');
const ROOT = path.join(__dirname, '..');

// Kept in step with CHAT_COUNT_AMBER / CHAT_COUNT_RED in src/app.js. Stated
// here rather than imported because src/app.js is a browser script, not a
// module — and because a gate that reads its expectations out of the code it
// checks proves only that the code equals itself.
const AMBER = 0.7;
const RED = 0.9;

function buildTempHtml() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-chatcount-'));
  const file = path.join(dir, 'codex.html');
  // --embedded for the same reason app_recipe_regression.js and
  // check_workbench.js use it: this boots in jsdom with no network, and the
  // lazy shell would sit at its boot-error state — which never reaches
  // _initApp, and therefore never wires the dock.
  execFileSync(
    process.execPath,
    [path.join(__dirname, 'build_html.js'), `--out=${file}`, '--quiet', '--embedded'],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] }
  );
  const html = fs.readFileSync(file, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  return html;
}

function boot(html, errors) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    if (!/Not implemented/.test(e.message)) errors.push(e.message);
  });
  return new JSDOM(html, {
    // A real origin, so localStorage exists: the dock saves a request for
    // recovery before it clears the field, and refuses to send without it.
    url: 'https://codexmusica.com/codex.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      // No network. The dock and the workbench's AI status line both handle an
      // offline backend, which is the state every assertion below runs in.
      w.fetch = () => Promise.reject(new Error('offline'));
      w.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      });
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.AbortSignal.timeout = () => new w.AbortController().signal;
    },
  });
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
  const errors = [];
  const dom = boot(buildTempHtml(), errors);
  const win = dom.window;
  const doc = win.document;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // _initApp runs off DOMContentLoaded and ends by starting the workbench; wait
  // for that rather than for a fixed interval, so a slow machine is not a red.
  const ready = () =>
    win.eval("document.readyState==='complete'&&(typeof UI==='undefined'||UI.ready)");
  for (let i = 0; i < 500 && !ready(); i++) await sleep(20);
  if (!ready()) {
    console.log('FAIL — the page never finished booting');
    for (const e of errors) console.log(`  ${e}`);
    win.close();
    process.exitCode = 1;
    return;
  }

  const input = doc.getElementById('chat-input');
  const out = doc.getElementById('chat-count');
  const sr = doc.getElementById('chat-count-sr');
  const read = () => ({
    hidden: out.hidden,
    text: out.textContent,
    amber: out.classList.contains('is-amber'),
    red: out.classList.contains('is-red'),
    sr: sr.textContent,
  });
  // Drive the field the way a person does — assign, then let the app hear about
  // it — so a missing listener fails here rather than passing on a direct call.
  const type = (text) => {
    input.value = text;
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    return read();
  };

  if (!input || !out || !sr) {
    console.log('FAIL — the ask bar is missing #chat-input, #chat-count or #chat-count-sr');
    win.close();
    process.exitCode = 1;
    return;
  }

  const max = input.maxLength;
  console.log(`chat counter — ceiling read from the field: ${max}`);

  check('the field declares a ceiling at all', () => {
    assert(max > 0, `maxLength is ${max}; without one there is nothing to count against`);
  });

  check('the visible counter is kept out of the accessibility tree', () => {
    assert(
      out.getAttribute('aria-hidden') === 'true',
      '#chat-count is exposed to screen readers — they would hear every keystroke'
    );
    assert(
      sr.getAttribute('aria-live') === 'polite',
      '#chat-count-sr is not a polite live region, so nothing is announced'
    );
  });

  check('quiet below the first band', () => {
    for (const len of [0, 1, Math.floor(max * 0.5), Math.floor(max * AMBER) - 1]) {
      const s = type('x'.repeat(len));
      assert(s.hidden, `at ${len}/${max} the counter is showing; it should stay out of the way`);
    }
  });

  check('appears, in amber, at the first band', () => {
    const s = type('x'.repeat(Math.ceil(max * AMBER)));
    assert(!s.hidden, 'the counter is still hidden at the amber threshold');
    assert(s.amber && !s.red, `bands wrong at amber: amber=${s.amber} red=${s.red}`);
  });

  check('turns red at the second band', () => {
    const s = type('x'.repeat(Math.ceil(max * RED)));
    assert(!s.hidden, 'the counter is hidden at the red threshold');
    assert(s.red && !s.amber, `bands wrong at red: amber=${s.amber} red=${s.red}`);
  });

  check('reads "used / ceiling"', () => {
    const len = Math.ceil(max * 0.8);
    const s = type('x'.repeat(len));
    assert(s.text === `${len} / ${max}`, `counter reads "${s.text}", expected "${len} / ${max}"`);
  });

  check('says so at the wall', () => {
    const s = type('x'.repeat(max));
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
      const s = type('x'.repeat(30));
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
    type('');
    const first = type('x'.repeat(Math.ceil(max * AMBER))).sr;
    assert(first.trim() !== '', 'nothing was announced on entering the amber band');
    const s = type('x'.repeat(Math.ceil(max * AMBER) + 1));
    assert(
      s.sr === first,
      'the live region re-announced inside the same band — that is one utterance per keystroke'
    );
  });

  check('clears when the field is emptied', () => {
    const s = type('');
    assert(s.hidden, 'the counter is still visible over an empty field');
    assert(s.sr === '', `the live region still says "${s.sr}" over an empty field`);
  });

  // maxlength does not bind a script write, and Edit lyrics writes the whole
  // draft into the field. No `input` event fires, so this also proves the
  // prefill syncs the counter itself. The action is async (it may first ask
  // before resetting a waiting writer run), so the write lands after click()
  // returns: wait for it, bounded, before reading.
  const editButton = doc.querySelector('[data-ui="edit-lyrics"]');
  const editDraft = doc.getElementById('lyrics-draft');
  if (editButton && editDraft) {
    editDraft.value = 'x'.repeat(max);
    editButton.click();
    for (let i = 0; i < 40 && input.value.length <= max; i++) await sleep(50);
  }
  check('names a script write past the wall as over, not as "limit reached"', () => {
    const button = editButton;
    const draft = editDraft;
    assert(button && draft, 'the workbench has no Edit lyrics button to drive');
    const len = input.value.length;
    assert(len > max, `Edit lyrics put ${len} characters in the field; expected more than ${max}`);
    const s = read();
    assert(
      s.text === `${len} / ${max}`,
      `after Edit lyrics the counter reads "${s.text}", expected "${len} / ${max}"`
    );
    assert(!s.hidden && s.red, 'the counter is not showing red over a field past its ceiling');
    assert(
      new RegExp(`${len - max} characters over`).test(s.sr) && !/limit reached/i.test(s.sr),
      `screen readers hear "${s.sr}" with ${len - max} characters past the ceiling`
    );
  });

  // Last, because it leaves a request pending: the offline fetch sends the dock
  // into recovery. Clearing the field is also a script write.
  check('clears when the message is sent', () => {
    type('x'.repeat(Math.ceil(max * 0.8)));
    doc
      .getElementById('chat-form')
      .dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    assert(input.value === '', 'submitting did not clear the field — nothing was sent');
    const s = read();
    assert(s.hidden, `the counter still reads "${s.text}" over the field it just emptied`);
  });

  // Let the offline recovery settle before tearing the window down.
  await sleep(100);
  win.close();

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
