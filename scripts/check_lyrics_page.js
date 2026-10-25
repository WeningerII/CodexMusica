#!/usr/bin/env node
// check_lyrics_page.js — the Lyrics page says only what is true of the draft.
//
// Every writer reply here is a FIXTURE: /chat is routed to a local stub, so
// this gate never reaches a provider or authorizes a paid request, and it
// makes no claim about the live service.
//
//   UNIT (src/pages/lyrics.js in a bare VM)
//   R. Readings saved before the reader's v2 cut rebind by span identity, or
//      are flagged for the writer's decision and stop every send; the marker
//      is written after the migration; a post-release draft is untouched.
//   B. The migration runs only at a boundary (open, import, send), never
//      from the typing refresh; no Undo step of its own; the selection is
//      mapped member by member (a selection in an unchanged member of a
//      rewritten row keeps its characters); every renumbered number stays
//      listed in Review, whole, until dismissed (paged, with Show all; the
//      shipped lyricMetaOf keeps the whole record); no message claims when a
//      row was written; an unchanged-binding row keeps every byte; an
//      identical-cut line whose earlier end anchor looked up other words is a
//      changed line, and no other identical-cut corpus line is (browser 9d:
//      typing, Undo/Redo across an open and an import; 9e: the record stays
//      with its draft across Undo, the Library store and a reload).
//   E. An explicit `N.end` member and a bare `N` keep their identity through
//      migration, Keep, the forms, section reorder, export/import and the
//      wire, untouched sibling groups included; `.end` is never added. In a
//      returns row bare `N` and explicit `N.line` share a word-offset migration
//      exemption but use distinct judges; the harness's own return parser
//      and judges read the page's payload as the classes declared (browser
//      9e: the same through the Library working-copy receiver).
//   O. A form writer applies the unmarked-row policy before it marks: a form
//      then a send, and a send then a form, give the same text and binding.
//   W. What the page sends the writer carries no [SETUP] row: the harness reads
//      every whole-line bracket as a section mark (lyric-harness/quality/
//      recover.py _sections_from_marks), so a [SETUP] row would open a section.
//      Headers and sung lines go unchanged; the declarations travel as JSON;
//      and the harness's own reader finds only the draft's sections.
//
//   BROWSER (the shipped codex.html in Chromium)
//   0. One document: inspector tabs exactly Tools / Writer / Review / History,
//      the six tools with their fixed help, Review navigation and Song actions in the header,
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
// --unit-source=FILE loads historical page source for the VM unit probes.
// --browser-only skips units; --browser-filter=TEXT selects matching browser steps.
// --shots writes screenshots of the states above (and light/dark, desktop/phone).
// Exit 0 if every assertion passes, 1 otherwise, 2 if playwright is missing.

'use strict';
/* global devicePixelRatio, visualViewport, innerHeight, document, localStorage, lyLibraryStore, lyLocalChecks, lyMeta, getComputedStyle, innerWidth, $ui, LY, LY_ACTIONS, UI, _chatSend, app, chatState, lyCheckApply, lyItem, lyReceive, lyRefresh, lyRunStatus, lyScrollToLine, lySyncCaret, lyDraftSet, lyDrafts, lyPendingAll, lyStartConversation, pushHistory, uiNewTask, uiSaveLyrics, lyParse, CMLyricTokens, lyDeclarationsOf, lyReadingValue, lyLibraryImport, CMLibraryImport, uiLyricsOpened, lyEnsureTokenScheme, showToast, HTMLTextAreaElement, sessionStorage, uiChatOpen, requestAnimationFrame, LY_ACTION_TEXT, lySubmitLyricsAction, lyWriterState, lyToolRequestAction, lyInspectionSession, Image, InputEvent, MutationObserver, NodeFilter */
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
// Optional historical source for reproducing the unit regressions without a checkout.
const UNIT_SOURCE = flags['unit-source'] || path.join(ROOT, 'src/pages/lyrics.js');
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

// ── E. an explicit `N.end` and a bare `N` keep their identity; whole-line
// and placed returns are separate classes ──────────────────────────────────
// 3PO #519 6163216518: a member written `2.end` names the end explicitly; a
// bare `4` names no place. Every path that writes a member back keeps the
// spelling the writer used -- untouched sibling groups included -- and the
// tools receive exactly that spelling; `.end` is never added.
// 3PO #519 6166749777 (RETURNS): bare `N` is a whole-line return;
// explicit `N.line` is a placed return with place `line`. They use distinct
// harness judges, while sharing exemption from word-offset migration.
// Other placed returns (`N.end`, `N.head`, `N.T<k>`) name word places and
// are carried on changed-cut lines. The classes are checked
// where they matter -- in what the harness reads from the page's payload:
// its own return parser and judges (quality/schemes.py) run on exactly the
// `returns` value the tools would receive. Only valid classes are used (the
// harness refuses a class mixing the two, so `2.end,6` proves nothing).
// Fixture helpers shared with unit O.
function lyricsUnitContext() {
  const src = fs.readFileSync(UNIT_SOURCE, 'utf8');
  const sel = { start: 0, end: 0, dir: 'none' };
  const draft = {
    value: '',
    get selectionStart() {
      return sel.start;
    },
    get selectionEnd() {
      return sel.end;
    },
    get selectionDirection() {
      return sel.dir;
    },
    setSelectionRange(a, b, d = 'none') {
      Object.assign(sel, { start: a, end: b, dir: d });
    },
  };
  const toasts = [];
  const app = { lyricMeta: { version: 1, ui: {} }, history: [], historyIndex: -1, lyrics: '' };
  const ctx = vm.createContext({
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    $ui: (id) => (id === 'lyrics-draft' ? draft : null),
    uiRegisterPage: () => {},
    uiCount: (n, w, many = w + 's') => `${n} ${n === 1 ? w : many}`,
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {},
    app,
    lyricMetaOf: (v) => (v && v.version === 1 ? v : { version: 1, notes: {}, ui: {} }),
    uiAutosave: () => {},
    uiSaveLyrics: () => (app.lyrics = draft.value),
    sessionSnapshot: () => ({ lyrics: app.lyrics, lyricMeta: { ...app.lyricMeta } }),
    pushHistory: () => {},
    showToast: (m, tone) => toasts.push([m, tone]),
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/lyric-tokens.js'), 'utf8'), ctx);
  vm.runInContext(src, ctx, { filename: 'src/pages/lyrics.js' });
  ctx.lyRefresh = () => {};
  const run = (code, vars = {}) => {
    Object.assign(ctx, vars);
    return vm.runInContext(code, ctx);
  };
  return { ctx, run, draft, sel, toasts, app };
}
// The harness's own reading of a `returns` payload over `lines`: its return
// classes (whole-line or placed, with loci) and both judges' findings.
function harnessReturns(lines, returns, voices = false) {
  const py = `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'lyric-harness'))})
import lyric_harness as LH
from quality import schemes as SC
a = json.loads(sys.stdin.read())
m = SC.mandate([], n_lines=len(a["lines"]),
               returns=[[x for x in g.split(",")] for g in a["returns"].split(";")])
lex = LH.Lexicon(reader_scheme="v2", strip_parens=not a["voices"])
print(json.dumps({
  "classes": sorted([list(r.lines), "placed" if r.loci else "whole", list(r.loci)] for r in m.returns),
  "whole": sorted([f[1], f[2], f[3]] for f in m.returns_check(a["lines"])),
  "placed": sorted([f[3], f[4].split(": ", 1)[-1].split(". The rest")[0]] for f in m.placed_returns_check(a["lines"], lex=lex)),
}))`;
  try {
    return JSON.parse(
      execFileSync('python3', ['-c', py], {
        input: JSON.stringify({ lines, returns, voices }),
      }).toString()
    );
  } catch (e) {
    check(false, `the harness could not read returns ${JSON.stringify(returns)}: ${e.message}`);
    return null;
  }
}
const UNIT_OH = 'Oh--oh, oh my love'; // its cut changes: `oh` is word 2, then 3
const UNIT_DOVE = 'You are the one I dream of my dove';
const UNIT_PLAIN = 'we sing it plain tonight';
function unitEndIdentity() {
  stage = 'E. N.end vs bare N; returns classes';
  const { run, draft } = lyricsUnitContext();
  const OH = UNIT_OH,
    DOVE = UNIT_DOVE,
    PLAIN = UNIT_PLAIN;
  const LINES = [OH, DOVE, PLAIN, DOVE, PLAIN, DOVE, PLAIN, DOVE];
  const song = `[VERSE]\n${LINES.slice(0, 4).join('\n')}\n\n[CHORUS]\n${LINES.slice(4).join('\n')}`;
  // A row's members as written, page notes and the cut mark set aside.
  const row = (text, key) => text.split('\n').find((l) => l.startsWith(`[SETUP — ${key} —`)) || '';
  const members = (text, key) =>
    row(text, key)
      .replace(/^\[SETUP — [^—]+ — /, '')
      .replace(/(?: — numbering \S+)? — cut \S+\]$|\]$/, '')
      .split(/[;,]/)
      .map((m) => m.replace(/\s+\(.*\)$/, '').trim());
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // 1. Migration. Rhyme groups: the T member on the changed line is
  //    renumbered; `2.end`, the bare `4` and the untouched sibling groups
  //    keep their spelling; the named `1.end` on the changed line is carried.
  //    Returns: the PLACED `1.head` on the changed line is carried; the
  //    bare `1` and placed `1.line` on that same line are left as written --
  //    no annotation -- and so are the classes on unchanged lines.
  const RET = '2.end,6.end;1,5;1.line,3.line;1.head,7.head;2,4';
  const legacy = `[SETUP — rhyme groups — 2.end,4,1.T2;3.end, 4.head;6.end,8;1.end,5]\n[SETUP — returns — ${RET}]\n\n${song}`;
  const got = run('lyMigrateSavedReadings(__t)', { __t: legacy });
  const mig = got.text;
  const G = ['2.end', '4', '1.T3', '3.end', '4.head', '6.end', '8', '1.end', '5'];
  const R = RET.split(/[;,]/);
  check(same(members(mig, 'rhyme groups'), G), `migration respelled: ${row(mig, 'rhyme groups')}`);
  check(same(members(mig, 'returns'), R), `migration respelled returns: ${row(mig, 'returns')}`);
  check(
    row(mig, 'rhyme groups').includes('1.end (carried across the word-cut change)') &&
      row(mig, 'returns') ===
        '[SETUP — returns — 2.end,6.end;1,5;1.line,3.line;1.head (carried across the word-cut change),7.head;2,4 — cut v2]',
    `the members were not classed: ${row(mig, 'rhyme groups')} | ${row(mig, 'returns')}`
  );
  check(
    JSON.stringify(got.carried.filter((c) => c.key === 'returns')) ===
      JSON.stringify([{ key: 'returns', n: 1, place: 'head' }]),
    `a whole-line return was carried: ${JSON.stringify(got.carried)}`
  );
  // An unmarked returns row of whole-line members only keeps every byte,
  // whatever cut their lines have.
  const quiet = `[SETUP — returns — 1,5;1.line,3.line]\n\n${song}`;
  check(
    run('lyMigrateSavedReadings(__t).text', { __t: quiet }) === quiet,
    'a whole-line returns row was rewritten'
  );
  // Review: one notice per carried member; none for a whole-line return,
  // and no returns notice says "last rhyme" or shows a word for one.
  const notices = (text) =>
    Array.from(run('lyLocalChecks(lyParse(__t))', { __t: text })).filter((x) =>
      /:carried:/.test(x.id)
    );
  const n1 = notices(mig);
  check(
    n1.length === 2 &&
      n1.some((x) => /^rhyme groups:/.test(x.id) && /line 1 · last rhyme/.test(x.title)) &&
      n1.some((x) => /^returns:/.test(x.id) && /line 1 · first word/.test(x.title)),
    `Review notices: ${JSON.stringify(n1.map((x) => x.title))}`
  );
  // The wire: exactly the writer's spelling (page notes never sent) ...
  const wire = run('lyDeclarationsOf(lyParse(__t))', { __t: mig });
  check(
    same(wire.groups.split(/[;,]/), G) && wire.returns === RET,
    `the tools received another spelling: ${wire.groups} | ${wire.returns}`
  );
  // ... and what the harness reads from it: two whole-line classes and three
  // placed ones, each judged by its own judge.
  const WANT = {
    classes: [
      [[1, 3], 'placed', ['line', 'line']],
      [[1, 5], 'whole', []],
      [[1, 7], 'placed', ['head', 'head']],
      [[2, 4], 'whole', []],
      [[2, 6], 'placed', ['end', 'end']],
    ],
    whole: [[1, 5, 'REWRITTEN_RETURN']],
  };
  const h = harnessReturns(LINES, wire.returns);
  check(
    !!h &&
      same(h.classes, WANT.classes) &&
      same(h.whole, WANT.whole) &&
      same(
        h.placed.map((p) => p[0]),
        ['NOT_RETURNED_AT', 'NOT_RETURNED_AT']
      ) &&
      h.placed.some((p) => /L1\.head='Oh', L7\.head='we'/.test(p[1])) &&
      !h.placed.some((p) => /\.end=/.test(p[1])),
    `the harness read other returns from the payload: ${JSON.stringify(h)}`
  );

  // 2. A returns row an earlier version of this page annotated -- a
  //    whole-line member marked carried: Review names it a whole-line
  //    return, with no place word and no endpoint word; Keep drops the note
  //    and keeps the spelling.
  const old = `[SETUP — returns — 1 (carried across the word-cut change),5;1.line (carried across the word-cut change),3.line;2.end,6.end — cut v2]\n\n${song}`;
  const n2 = notices(old);
  check(
    n2.length === 2 &&
      n2.every(
        (x) =>
          /line 1 · whole line/.test(x.title) && !/last rhyme|first word|“/.test(x.title + x.text)
      ),
    `a whole-line return was shown as a word place: ${JSON.stringify(n2.map((x) => [x.title, x.text]))}`
  );
  draft.value = old;
  for (let k = 0; k < 2; k++) {
    const model = run('lyParse(lyDraft().value)');
    const d = run('lySetupOf(__m, "returns")[0]', { __m: model });
    const groups = run('lyRowGroups(__d)', { __d: d });
    const gi = groups.findIndex((g) => g.some((m) => m.carried));
    const mi = groups[gi].findIndex((m) => m.carried);
    run('lyCarriedDecide(__id, true)', { __id: `returns|${d.i}|${gi}|${mi}` });
  }
  check(
    row(draft.value, 'returns') === '[SETUP — returns — 1,5;1.line,3.line;2.end,6.end — cut v2]',
    `Keep respelled a whole-line return: ${row(draft.value, 'returns')}`
  );

  // 3. Keep the link, on both carried members of the migrated text: the
  //    kept member and every sibling keep the writer's spelling.
  draft.value = mig;
  for (const key of ['rhyme groups', 'returns']) {
    const model = run('lyParse(lyDraft().value)');
    const d = run('lySetupOf(__m, __k)[0]', { __m: model, __k: key });
    const groups = run('lyRowGroups(__d)', { __d: d });
    const gi = groups.findIndex((g) => g.some((m) => m.carried));
    const mi = groups[gi].findIndex((m) => m.carried);
    run('lyCarriedDecide(__id, true)', { __id: `${key}|${d.i}|${gi}|${mi}` });
  }
  const kept = draft.value;
  check(
    same(members(kept, 'rhyme groups'), G) && same(members(kept, 'returns'), R),
    `Keep respelled: ${row(kept, 'rhyme groups')} | ${row(kept, 'returns')}`
  );
  check(!/carried across/.test(kept), 'Keep left a carried note');
  const keptWire = run('lyDeclarationsOf(lyParse(__t))', { __t: kept });
  check(
    same(keptWire.groups.split(/[;,]/), G) && keptWire.returns === RET,
    `the tools received another spelling after Keep: ${keptWire.groups} | ${keptWire.returns}`
  );

  // 4. A form edit (the rhymes and repeats forms merge the existing groups
  //    with the new link): the existing members keep their spelling, the
  //    page-made rhyme link is bare, the page-made placed return is placed.
  let formed = run(
    'LY_FORMS.rhymes.apply(lyParse(__t), null, { relation: "", members: [{ line: 3, place: "end" }, { line: 7, place: "end" }] }, ["members"]).text',
    { __t: kept }
  );
  formed = run(
    'LY_FORMS["repeats-voices"].apply(lyParse(__t), null, { voices: "unsung", placed: [{ line: 5, place: "head" }, { line: 7, place: "T2" }] }, ["placed"]).text',
    { __t: formed }
  );
  check(
    same(members(formed, 'rhyme groups'), [...G, '3', '7']) &&
      same(members(formed, 'returns'), [...R, '5.head', '7.T2']),
    `a form edit respelled: ${row(formed, 'rhyme groups')} | ${row(formed, 'returns')}`
  );

  // 5. Section reorder and assembly: lines move, places and classes do not.
  draft.value = formed;
  run('lyEditSections((p) => { p.blocks.reverse(); }, "Sections reordered.")');
  const moved = draft.value;
  const shift = (ms) =>
    ms.map((m) => m.replace(/^\d+/, (n) => String(Number(n) <= 4 ? Number(n) + 4 : Number(n) - 4)));
  check(
    same(members(moved, 'rhyme groups'), shift([...G, '3', '7'])) &&
      same(members(moved, 'returns'), shift([...R, '5.head', '7.T2'])),
    `reorder respelled: ${row(moved, 'rhyme groups')} | ${row(moved, 'returns')}`
  );

  // 6. Export (the draft text, as Download text writes it) and import (.txt):
  //    byte for byte.
  draft.value = '';
  run('lyImportText(__t, "Imported.")', { __t: moved });
  check(draft.value === moved, 'export/import changed the text');

  // 7. A row marked with a cut this page does not read, merged by a form:
  //    its members bind nothing and keep their spelling, `2.end` included.
  const alien = `[SETUP — returns — 2.end,6.end;4,8 — cut v9]\n\n${song}`;
  const merged = run(
    'LY_FORMS["repeats-voices"].apply(lyParse(__t), null, { voices: "unsung", placed: [{ line: 3, place: "head" }, { line: 7, place: "head" }] }, ["placed"]).text',
    { __t: alien }
  );
  check(
    same(members(merged, 'returns'), ['2.end', '6.end', '4', '8', '3.head', '7.head']) &&
      row(merged, 'returns').includes('2.end (marked cut v9: not read here)') &&
      row(merged, 'returns').includes(';4 (marked cut v9: not read here)'),
    `an unknown-cut member was respelled: ${row(merged, 'returns')}`
  );
  const named = run('lyUndecidedMembers(lyParse(__t)).map((m) => m.raw)', { __t: alien });
  check(same(named, ['2.end', '6.end', '4', '8']), `Review names other members: ${named}`);
  // Re-reading the merged row keeps it (no second respelling).
  const again = run(
    'lyGroupsText(lySetupOf(lyParse(__t), "returns").flatMap((d) => lyRowGroups(d)))',
    { __t: merged }
  );
  check(
    again ===
      row(merged, 'returns')
        .replace(/^\[SETUP — returns — /, '')
        .replace(/ — cut v2\]$/, ''),
    `a second pass respelled: ${again}`
  );
}

// ── O. a form writer and a send give the same binding, in either order ────
// BB8 66cef416 (25/25 divergences) and 3PO #519 6166169619: the rhymes and
// repeats forms wrote an UNMARKED row back marked `— cut v2` without reading
// it under the unmarked-row policy, so `[SETUP — rhyme groups — 1.T4,8]` on
// `Oh--oh, oh my love` sent `1.T4` (`my`) when a form came first and `1.T5`
// (`love`) when a send came first, and a placed return's verdict flipped. A
// form writer now applies the policy (rebind by span or block, exactly as
// the boundary does) before it marks; the typing refresh still never
// rewrites the draft. Every writer, both row types: the same final text and
// the same binding in both orders, the renumbering recorded on the Review
// card and said in the form's own message, and the harness's verdict on the
// payload the same.
function unitFormOrder() {
  stage = 'O. form writers vs send order';
  const { run, draft, toasts, app } = lyricsUnitContext();
  const OH = UNIT_OH,
    DOVE = UNIT_DOVE,
    PLAIN = UNIT_PLAIN;
  const LOVE = 'And love above';
  const LINES = [OH, DOVE, PLAIN, DOVE, PLAIN, DOVE, PLAIN, LOVE];
  const song = `[VERSE]\n${LINES.slice(0, 4).join('\n')}\n\n[CHORUS]\n${LINES.slice(4).join('\n')}`;
  const writers = {
    'rhyme groups': {
      row: '[SETUP — rhyme groups — 1.T4,8;2,4]',
      'link a new pair'() {
        run(
          'lyDraftSet("rhymes", "song", "members", [{ line: 3, place: "end" }, { line: 5, place: "end" }]); lyDraftApply("rhymes")'
        );
      },
      'remove a link'() {
        run('LY.picks.linkGroup = 1; LY_ACTIONS["ly-link-remove"]()');
      },
      'remove links that bind no word'() {
        run('LY_ACTIONS["ly-drop-undecided"]("rhyme groups")');
      },
    },
    returns: {
      row: '[SETUP — returns — 1.T4,8.T2]',
      'declare a placed return'() {
        run(
          'lyDraftSet("repeats-voices", "song", "placed", [{ line: 3, place: "head" }, { line: 5, place: "head" }]); lyDraftApply("repeats-voices")'
        );
      },
      'declare an exact repeat'() {
        run('LY_ACTIONS["ly-declare-repeat"]("0:1")');
      },
      'remove links that bind no word'() {
        run('LY_ACTIONS["ly-drop-undecided"]("returns")');
      },
    },
  };
  const fresh = (row) => {
    app.lyricMeta = { version: 1, notes: {}, drafts: {}, ui: {} };
    draft.value = `${row}\n\n${song}`;
    run('LY.model = lyParse(lyDraft().value); LY.picks = LY.picks || {}');
    toasts.length = 0;
  };
  const send = () => run('lyEnsureTokenScheme()');
  const sent = (key) =>
    run('lyDeclarationsOf(lyParse(lyDraft().value))')[key === 'returns' ? 'returns' : 'groups'];
  for (const [key, w] of Object.entries(writers))
    for (const [name, write] of Object.entries(w)) {
      if (name === 'row') continue;
      // Form first, then send.
      fresh(w.row);
      write();
      const formMessage = toasts.map((t) => t[0]).join(' ');
      const card = run('lyRenumberedCheck()');
      send();
      const a = { text: draft.value, wire: sent(key) };
      // Send first, then form.
      fresh(w.row);
      send();
      run('LY.model = lyParse(lyDraft().value)');
      write();
      const b = { text: draft.value, wire: sent(key) };
      check(
        a.text === b.text && a.wire === b.wire,
        `${key} · ${name}: the order changed the text: ${JSON.stringify([a.wire, b.wire])}`
      );
      check(
        a.wire.split(/[;,]/).includes('1.T5') && !a.wire.split(/[;,]/).includes('1.T4'),
        `${key} · ${name}: the form did not apply the unmarked-row policy: ${a.wire}`
      );
      const word = run(
        'lyMemberWord(lyParse(__t), lyParseGroups(lyDeclarationsOf(lyParse(__t))[__f]).flat().find((m) => m.line === 1 && /^T/.test(m.place)))',
        { __t: a.text, __f: key === 'returns' ? 'returns' : 'groups' }
      );
      check(word === 'love', `${key} · ${name}: the form-first binding is “${word}”, not “love”`);
      check(
        /renumbered/.test(formMessage) && !!card && /“love”, line 1: word 4 → 5/.test(card.text),
        `${key} · ${name}: the form renumbered without notice: ${formMessage} | ${card && card.text}`
      );
      if (key === 'returns' && name === 'declare a placed return') {
        // The placed return's verdict, from the harness on the payload:
        // `love` on line 1 against `love` on line 8, clean in both orders.
        const ha = harnessReturns(LINES, a.wire),
          hb = harnessReturns(LINES, b.wire);
        check(
          !!ha &&
            JSON.stringify(ha) === JSON.stringify(hb) &&
            !ha.placed.some((p) => /L1\.T/.test(p[1])),
          `the placed-return verdict depends on the order: ${JSON.stringify([ha, hb])}`
        );
      }
    }
  // The typing refresh is not a boundary: a hand-typed unmarked row stays
  // as typed until a boundary or a form reads it.
  fresh(writers.returns.row);
  run('lyRefresh(true)');
  check(draft.value.startsWith(writers.returns.row + '\n'), 'the typing refresh rewrote the row');
}

// ── W. the writer payload, unit-level ─────────────────────────────────────
function unitWriterPayload() {
  stage = 'W. writer payload';
  const src = fs.readFileSync(UNIT_SOURCE, 'utf8');
  const draft = { value: '' };
  const ctx = vm.createContext({
    console,
    $ui: (id) => (id === 'lyrics-draft' ? draft : null),
    uiRegisterPage: () => {},
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {},
  });
  // The page reads the shared reader the build bundles ahead of it.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/lyric-tokens.js'), 'utf8'), ctx);
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

// ── R. readings saved before the reader's v2 cut, unit-level ──────────────
// A draft saved before this release numbered its [SETUP — reading] rows under
// the page's earlier cut, and its rows carry no `— cut v2` mark. Each reading
// is rebound once by span identity (the old occurrence -> the current token
// over exactly the same characters) and gains the mark; one with no such token
// is flagged as needing the writer's decision, shown, and stops every send. A
// marked row (every row this page writes) is left untouched, wherever the text
// came from, and an unmarked row is migrated wherever it came from.
// P-A (BB8 #527 6193594353, 2026-10-15). A word number depends on whether
// asides are sung. A row records the setting it was counted under
// (`— numbering v2` / `v2+voices`, migration and forms alike), and the page
// reads it into the current setting by raw span. A `— cut v2` row that
// records no setting -- what this page's migration wrote on b887e5ef -- binds
// only where both settings name the same characters, and otherwise stops the
// send with its bytes kept: it is never read under whatever setting the page
// has now, which bound `my` for `love` after a voices toggle.
function unitVoicesBasis() {
  stage = 'V. voices basis';
  const src = fs.readFileSync(UNIT_SOURCE, 'utf8');
  const draft = { value: '' };
  const toasts = [];
  const sends = [];
  const app = { lyricMeta: { version: 1 }, history: ['before'], historyIndex: 0, lyrics: '' };
  const ctx = vm.createContext({
    console,
    $ui: (id) => (id === 'lyrics-draft' ? draft : null),
    uiRegisterPage: () => {},
    uiCount: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`,
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {},
    app,
    lyricMetaOf: (v) => (v && v.version === 1 ? v : { version: 1, notes: {}, ui: {} }),
    uiAutosave: () => {},
    uiSaveLyrics: () => (app.lyrics = draft.value),
    sessionSnapshot: () => ({ lyrics: app.lyrics, lyricMeta: { ...app.lyricMeta } }),
    showToast: (m, tone) => toasts.push([m, tone]),
    _chatSend: (...a) => (sends.push(a), Promise.resolve({ ok: true })),
    uiSwitchChat: () => (sends.push(['switch']), false),
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/lyric-tokens.js'), 'utf8'), ctx);
  vm.runInContext(src, ctx, { filename: 'src/pages/lyrics.js' });
  const run = (code, vars = {}) => {
    Object.assign(ctx, vars);
    return vm.runInContext(code, ctx);
  };
  ctx.lyShowTab = () => {};
  ctx.lyRefresh = () => {};
  ctx.lyCloseMenus = () => {};
  const LINE = 'Oh--oh, (ah) oh my love';
  const song = (rows, voices) =>
    `${rows.join('\n')}\n${voices ? '[SETUP — voices — sung]\n' : ''}\n[VERSE]\n${LINE}\nyou are my dove`;
  const wire = (text) => run('lyDeclarationsOf(lyParse(__t))', { __t: text });
  const word = (text, key = 'rhyme groups') => {
    const m = run('lyParse(__t)', { __t: text });
    const g = run('lyParseGroups(lySetupOf(__m, __k)[0].value)', { __m: m, __k: key });
    return g[0][0].undecided ? null : run('lyMemberWord(__m, __x)', { __m: m, __x: g[0][0] });
  };
  // 1. A legacy row migrated under each setting records that setting.
  for (const voices of [false, true]) {
    const migrated = run('lyMigrateSavedReadings(__t).text', {
      __t: `[SETUP — rhyme groups — 1.T4,2]\n${voices ? '[SETUP — voices — sung]\n' : ''}\n[VERSE]\nOh--oh, oh my love\nyou are my dove`,
    });
    check(
      migrated.split('\n')[0] ===
        `[SETUP — rhyme groups — 1.T5,2 — numbering ${voices ? 'v2+voices' : 'v2'} — cut v2]`,
      `a migrated row did not record its voices setting: ${migrated.split('\n')[0]}`
    );
  }
  // 2. BB8's repro: a row counted with asides unsung, then voices set to
  // sung. It binds love (T6 under v2+voices), never my.
  const counted = '[SETUP — rhyme groups — 1.T5,2.end — numbering v2 — cut v2]';
  check(word(song([counted], false)) === 'love', 'the counted row lost love before the toggle');
  const after = wire(song([counted], true));
  check(
    word(song([counted], true)) === 'love' &&
      after.groups === '1.T6,2.end' &&
      after.numbering === 'v2+voices',
    `after the voices toggle the row was sent as ${JSON.stringify([after.groups, after.numbering])}`
  );
  // 3. The same row as b887e5ef stored it (no setting recorded): under
  // either setting the two plausible counts name different words (love,
  // my), so it is an open decision and nothing is sent; its bytes stay.
  const bare = '[SETUP — rhyme groups — 1.T5,2.end — cut v2]';
  for (const voices of [false, true]) {
    const text = song([bare], voices);
    const w = wire(text);
    check(
      word(text) === null && !w.groups && (w.groups_need_decision || []).length === 1,
      `a row with no recorded setting was guessed (voices ${voices}): ${JSON.stringify(w)}`
    );
  }
  // 4. Where both settings name the same characters, such a row binds.
  const agreed = wire(
    '[SETUP — rhyme groups — 1.T5,2.T4 — cut v2]\n[SETUP — voices — sung]\n\n[VERSE]\nOh--oh, oh my love\nyou are my dove'
  );
  check(
    agreed.groups === '1.T5,2.T4' && agreed.numbering === 'v2+voices',
    `a row both settings agree on was not carried: ${JSON.stringify([agreed.groups, agreed.numbering])}`
  );
  // 5. Readings: a basis that does not hold the saved word there is ruled
  // out; one that names other characters of the same spelling is not.
  const reading = (token, w, line) =>
    `[SETUP — reading — token ${token} ${JSON.stringify(w)} in ${JSON.stringify(line)} — L AH1 V — declared — source: the singer — cut v2]`;
  const r1 = wire(song([reading(5, 'love', LINE)], true)).pronunciations;
  check(
    r1 && r1.length === 1 && r1[0].token === 6 && r1[0].numbering === 'v2+voices',
    `a reading with one plausible basis was not carried: ${JSON.stringify(r1)}`
  );
  const echo = 'oh (oh) oh love';
  const r2 = wire(`${reading(2, 'oh', echo)}\n[SETUP — voices — sung]\n\n[VERSE]\n${echo}`);
  check(
    !r2.pronunciations && (r2.readings_need_decision || []).length === 1,
    `a reading two settings place on different characters was guessed: ${JSON.stringify(r2)}`
  );
  // 7. The refusal and Review say the real reason: no saved sung-asides
  // setting, the row, the member or token, both candidate occurrences --
  // and not the earlier-cut wording, which is a different cause.
  const refusal = run('lyUndecidedRefusal(lyParse(__t))', { __t: song([bare], true) });
  check(
    /has no saved setting for whether parenthesized words were sung/.test(refusal) &&
      /document line 1/.test(refusal) &&
      /1\.T5/.test(refusal) &&
      /choose the occurrence you intended, or remove this declaration/.test(refusal) &&
      !/earlier/.test(refusal),
    `the refusal did not give the sung-asides reason: ${refusal}`
  );
  const cards = run('lyLocalChecks(lyParse(__t))', {
    __t: `${reading(2, 'oh', echo)}\n[SETUP — voices — sung]\n\n[VERSE]\n${echo}`,
  });
  const card = cards.find((c) => /^reading:/.test(c.id));
  check(
    card &&
      /token 2/.test(card.title) &&
      card.title.includes(echo) &&
      /document line 1/.test(card.text) &&
      card.text.includes('oh (oh) [oh] love') &&
      card.text.includes('oh ([oh]) oh love') &&
      /no setting for whether parenthesized words were sung/.test(card.text) &&
      !/earlier word cut/.test(card.text),
    `the reading card does not identify the row, token, line and both occurrences: ${JSON.stringify(card)}`
  );
  // 8. Two ambiguous groups: each has its own card, and removing one
  // removes only that one.
  const two = song(['[SETUP — rhyme groups — 1.T5,2.end;1.T3,2.T4 — cut v2]'], true);
  const groupCards = run('lyLocalChecks(lyParse(__t))', { __t: two }).filter((c) =>
    /^rhyme groups:\d+:undecided:\d+$/.test(c.id)
  );
  check(
    groupCards.length === 2 &&
      groupCards.every((c) =>
        /no saved setting for whether parenthesized words were sung/.test(c.text)
      ) &&
      groupCards[0].text.includes('Oh--oh, (ah) oh my [love]') &&
      groupCards[0].text.includes('Oh--oh, (ah) oh [my] love'),
    `two ambiguous groups did not get one card each: ${JSON.stringify(groupCards.map((c) => [c.id, c.title]))}`
  );
  draft.value = two;
  app.lyrics = two;
  ctx.pushHistory = () => {};
  const firstArg = groupCards[0] && groupCards[0].actions[0][3];
  run('LY.model = lyParse(lyDraft().value); LY_ACTIONS["ly-drop-undecided"](__a)', {
    __a: firstArg,
  });
  const left = draft.value.split('\n')[0];
  check(
    !/1\.T5/.test(left) && /1\.T3/.test(left) && /2\.T4/.test(left),
    `removing one ambiguous link removed the other too: ${left}`
  );
  // 9. A pre-release row the migration blocks for the same ambiguity keeps
  // a marker the parser reads back (no separator inside it), so it is never
  // sent as a plain number.
  const legacyBlocked = run('lyMigrateSavedReadings(__t).text', {
    __t: song(['[SETUP — rhyme groups — 1.T4,2.end]'], false),
  });
  const lw = wire(legacyBlocked);
  check(
    /no saved setting for sung asides/.test(legacyBlocked.split('\n')[0]) &&
      !lw.groups &&
      (lw.groups_need_decision || []).length === 1,
    `a migration-blocked row was sent: ${JSON.stringify([legacyBlocked.split('\n')[0], lw])}`
  );
  check(
    run('LY_MEMBER_MARKERS.every(([m]) => !/[,;]|—/.test(m))'),
    'a member marker holds a separator'
  );
  // 10. Choose again settles the row on either occurrence its card offers,
  // and nothing else: a word it does not offer leaves it standing, and an
  // undecided row on another line stays (3PO #519 6197433772).
  const other = 'ah (ah) ah';
  const choose = (text, line, token, w) =>
    run(
      `LY_FORMS.pronunciation.apply(lyParse(__t), lyReadingKey(__l, __k, __w),
        { kind: 'declared', phones: 'OW1', source: 'the singer' }).text`,
      { __t: text, __l: line, __k: token, __w: w }
    );
  const legacyEcho = run('lyMigrateSavedReadings(__t).text', {
    __t: `[SETUP — reading — token 2 "oh" in ${JSON.stringify(echo)} — OW1 — declared — source: the singer]\n[SETUP — voices — sung]\n\n[VERSE]\n${echo}`,
  });
  check(
    legacyEcho.split('\n')[0].includes('no saved setting for sung asides'),
    `the legacy echo row was not blocked for the sung-asides reason: ${legacyEcho.split('\n')[0]}`
  );
  for (const [label, row, voices, token] of [
    ['cut v2, sung, outside oh', reading(2, 'oh', echo), true, 3],
    ['cut v2, sung, parenthesized oh', reading(2, 'oh', echo), true, 2],
    ['cut v2, not sung, outside oh', reading(2, 'oh', echo), false, 2],
    ['earlier cut, sung, outside oh', legacyEcho.split('\n')[0], true, 3],
    ['earlier cut, sung, parenthesized oh', legacyEcho.split('\n')[0], true, 2],
  ]) {
    const text = `${row}\n${reading(2, 'ah', other)}\n${voices ? '[SETUP — voices — sung]\n' : ''}\n[VERSE]\n${echo}\n${other}`;
    const before = wire(text);
    check(
      (before.readings_need_decision || []).length === 2,
      `${label}: expected two undecided readings before choosing: ${JSON.stringify(before)}`
    );
    const out = choose(text, echo, token, 'oh');
    const w = wire(out);
    const need = (w.readings_need_decision || []).map((x) => x.line);
    check(
      JSON.stringify(need) === JSON.stringify([other]) &&
        (w.pronunciations || []).length === 1 &&
        w.pronunciations[0].line === echo,
      `${label}: Choose again did not settle exactly its row: ${JSON.stringify(w)}`
    );
  }
  const offside = choose(
    `${reading(2, 'oh', echo)}\n[SETUP — voices — sung]\n\n[VERSE]\n${echo}`,
    echo,
    1,
    'oh'
  );
  check(
    (wire(offside).readings_need_decision || []).length === 1,
    `choosing a word the card does not offer removed the undecided row: ${offside.split('\n').slice(0, 3).join(' | ')}`
  );
  // 11. A saved word neither setting's count names ("love" as token 2 of
  // the echo line) offers no occurrence: choosing either "oh" keeps it, and
  // choosing "love" itself settles it (3PO #519 6197775783).
  for (const voices of [false, true]) {
    const text = `${reading(2, 'love', echo)}\n${voices ? '[SETUP — voices — sung]\n' : ''}\n[VERSE]\n${echo}`;
    const loveCard = run('lyLocalChecks(lyParse(__t))', { __t: text }).find((c) =>
      /^reading:/.test(c.id)
    );
    check(
      loveCard &&
        loveCard.text.includes('names “love” under neither setting') &&
        !loveCard.text.includes('[oh]'),
      `voices ${voices}: the card offers occurrences that are not the saved word: ${loveCard && loveCard.text}`
    );
    const ohs = voices ? [1, 2, 3] : [1, 2];
    for (const k of ohs) {
      const kept = wire(choose(text, echo, k, 'oh'));
      check(
        (kept.readings_need_decision || []).some((x) => x.word === 'love'),
        `voices ${voices}: choosing "oh" (token ${k}) removed the unrelated saved "love": ${JSON.stringify(kept)}`
      );
    }
    const settled = wire(choose(text, echo, voices ? 4 : 3, 'love'));
    check(
      !settled.readings_need_decision && (settled.pronunciations || [])[0]?.word === 'love',
      `voices ${voices}: choosing "love" did not settle its saved reading: ${JSON.stringify(settled)}`
    );
  }
  // 6. The page path: an undecided row stops the send and keeps its bytes.
  const stored = song([bare], true);
  draft.value = stored;
  app.lyrics = stored;
  app.lyricMeta.drafts = app.lyricMeta.drafts || {};
  const ok = run('lySubmitLyricsAction("review")');
  return Promise.resolve(ok).then((value) => {
    check(value === false && sends.length === 0, 'a row with no recorded setting was sent');
    check(draft.value === stored, 'a refused send rewrote the stored row');
  });
}
function unitSavedReadings() {
  stage = 'R. saved readings';
  const src = fs.readFileSync(UNIT_SOURCE, 'utf8');
  const draft = { value: '' };
  const toasts = [];
  const sends = [];
  const app = { lyricMeta: { version: 1 }, history: ['before'], historyIndex: 0, lyrics: '' };
  const ctx = vm.createContext({
    console,
    $ui: (id) => (id === 'lyrics-draft' ? draft : null),
    uiRegisterPage: () => {},
    uiCount: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`,
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {},
    app,
    lyricMetaOf: (v) => (v && v.version === 1 ? v : { version: 1, notes: {}, ui: {} }),
    uiAutosave: () => {},
    uiSaveLyrics: () => (app.lyrics = draft.value),
    sessionSnapshot: () => ({ lyrics: app.lyrics, lyricMeta: { ...app.lyricMeta } }),
    showToast: (m, tone) => toasts.push([m, tone]),
    _chatSend: (...a) => (sends.push(a), Promise.resolve({ ok: true })),
    // Reaching the conversation counts as sending: a send path past its
    // guards is recorded, not thrown.
    uiSwitchChat: () => (sends.push(['switch']), false),
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/lyric-tokens.js'), 'utf8'), ctx);
  vm.runInContext(src, ctx, { filename: 'src/pages/lyrics.js' });
  const run = (code, vars = {}) => {
    Object.assign(ctx, vars);
    return vm.runInContext(code, ctx);
  };
  ctx.lyShowTab = () => {};
  ctx.lyRefresh = () => {};
  ctx.lyCloseMenus = () => {};
  const row = (token, word, line) =>
    `[SETUP — reading — token ${token} ${JSON.stringify(word)} in ${JSON.stringify(line)} — L AO1 D IY0 — declared — source: the singer]`;
  // Provenance survives storage as text and is sent in its original coordinate.
  const numbered = (numbering, token, word, line, voices = false) =>
    `${row(token, word, line).slice(0, -1)} — numbering ${numbering} — cut v2]\n${voices ? '[SETUP — voices — sung]\n' : ''}[VERSE]\n${line}`;
  for (const [marker, token, voices, target] of [
    ['v2', 2, true, 3],
    ['v2+voices', 3, false, 2],
    ['v1', 2, true, 3],
    ['v1+voices', 3, false, 2],
  ]) {
    const text = numbered(marker, token, 'love', 'oh (oh) love', voices);
    const parsed = run('lySetupOf(lyParse(__t), "reading")[0]', { __t: text });
    check(!parsed.undecided && parsed.token === target, 'marked reading lost raw-span target');
    const wire = run('lyDeclarationsOf(lyParse(__t)).pronunciations[0]', { __t: text });
    check(wire.numbering === marker && wire.token === token, 'source numbering was relabelled');
    check(
      run('lyMigrateSavedReadings(__t).text', { __t: text }) === text,
      'marked row was migrated twice'
    );
  }
  for (const voices of [false, true]) {
    const text = `${voices ? '[SETUP — voices — sung]\n' : ''}[VERSE]\noh (oh) love`;
    const result = run(
      `LY_FORMS.pronunciation.apply(lyParse(__t),
      lyReadingKey('oh (oh) love', ${voices ? 3 : 2}, 'love'),
      { kind: 'declared', phones: 'L AH1 V', source: 'singer' })`,
      { __t: text }
    );
    const wire = run('lyDeclarationsOf(lyParse(__t)).pronunciations[0]', { __t: result.text });
    check(
      wire.numbering === (voices ? 'v2+voices' : 'v2'),
      'fresh manual choice lost current numbering'
    );
  }
  const dict = run(`LY_FORMS.pronunciation.apply(lyParse('[VERSE]\\noh (oh) love'),
    lyReadingKey('oh (oh) love', 2, 'love'),
    { kind: 'dictionary', phones: 'L AH1 V', source: 'CMUdict', numbering: 'v2+voices', numberingToken: 3 })`);
  const dictWire = run('lyDeclarationsOf(lyParse(__t)).pronunciations[0]', { __t: dict.text });
  check(
    dictWire.token === 3 && dictWire.numbering === 'v2+voices',
    'dictionary option source coordinate was not retained'
  );
  const picked = run(`(() => {
    const savedSet = lyDraftSet, savedApply = lyDraftApply;
    const fields = {};
    try {
      LY.model = lyParse('[VERSE]\\noh (oh) love');
      LY.picks.reading = lyReadingKey('oh (oh) love', 2, 'love');
      LY.results.pronunciation = { numbering: 'v1', items: [{
        line: 'oh (oh) love', token: 3, word: 'love', numbering: 'v2+voices',
        dictionary_readings: [{ phones: ['L', 'AH1', 'V'] }] }] };
      lyDraftSet = (_tool, _key, field, value) => { fields[field] = value; };
      lyDraftApply = () => true;
      LY_ACTIONS['ly-reading-use']('0');
      return fields;
    } finally { lyDraftSet = savedSet; lyDraftApply = savedApply; }
  })()`);
  check(
    picked.numbering === 'v2+voices' && picked.numberingToken === 3,
    'Use reading failed to copy the selected item marker over aggregate provenance'
  );
  const excluded = numbered('v2+voices', 2, 'oh', 'oh (oh) love');
  check(
    run('!!lyDeclarationsOf(lyParse(__t)).readings_need_decision', { __t: excluded }),
    'excluded same-spelling aside rebound to another occurrence'
  );
  for (const voices of [false, true]) {
    const text = `[SETUP — rhyme groups — 1.T1,2.end — cut v2]\n[SETUP — returns — 1.T1,2.T1 — cut v2]\n${voices ? '[SETUP — voices — sung]\n' : ''}[VERSE]\nlove\nlove`;
    const wire = run('lyDeclarationsOf(lyParse(__t))', { __t: text });
    check(
      wire.numbering === (voices ? 'v2+voices' : 'v2') && wire.groups === '1.T1,2.end',
      'word-place numbering missing or named place changed'
    );
  }
  for (const key of ['rhyme groups', 'returns']) {
    const made = run('lySetSetup(__key, ["1.T1,2.end"], "[VERSE]\\n(oh) love love\\nlove")', {
      __key: key,
    });
    check(made.includes('numbering v2'), 'new word-place row omitted voices provenance');
    const voiced = '[SETUP — voices — sung]\n' + made;
    const field = key === 'returns' ? 'returns' : 'groups';
    let wire = run('lyDeclarationsOf(lyParse(__t))', { __t: voiced });
    check(
      wire[field] === '1.T2,2.end' && wire.numbering === 'v2+voices',
      'voices toggle rebound first love to aside or second love'
    );
    const rewritten = run('lySetSetup(__key, [lySetupOf(lyParse(__t), __key)[0].value], __t)', {
      __key: key,
      __t: voiced,
    });
    check(
      rewritten.includes('numbering v2+voices') && rewritten.includes('1.T2,2.end'),
      'rewritten marked group was not normalized before restamping'
    );
    wire = run('lyDeclarationsOf(lyParse(__t))', {
      __t: rewritten.replace('[SETUP — voices — sung]\n', ''),
    });
    check(wire[field] === '1.T1,2.end', 'reverse voices toggle lost original physical word');
    const excluded = made.replace('numbering v2', 'numbering v2+voices');
    check(
      run('!!lyDeclarationsOf(lyParse(__t))[__field + "_need_decision"]', {
        __t: excluded,
        __field: field,
      }),
      'removed aside group occurrence did not block'
    );
    check(
      run('!!lyDeclarationsOf(lyParse(__t))[__field + "_need_decision"]', {
        __t: made.replace('numbering v2', 'numbering future'),
        __field: field,
      }),
      'unknown group numbering was silently accepted'
    );
  }
  const noCut =
    '[SETUP — rhyme groups — 1.T2,2.end — numbering v2+voices]\n[VERSE]\n(oh) love love\nlove';
  check(
    run('lyMigrateSavedReadings(__t).text', { __t: noCut }) === noCut,
    'numbering-only row was double migrated'
  );
  check(
    run('!!lyDeclarationsOf(lyParse(__t)).groups_need_decision', {
      __t: noCut.replace('1.T2', '1.end').replace('numbering v2+voices', 'numbering future'),
    }),
    'unknown numbering on a named-only row escaped refusal'
  );
  const mixed =
    '[SETUP — rhyme groups — 1.T1,2.end — numbering v2 — cut v2]\n' +
    '[SETUP — returns — 1.T2,2.end — numbering v2+voices — cut v2]\n' +
    '[VERSE]\n(oh) love love\nlove';
  const mixedWire = run('lyDeclarationsOf(lyParse(__t))', { __t: mixed });
  check(
    mixedWire.groups === '1.T1,2.end' &&
      mixedWire.returns === '1.T1,2.end' &&
      mixedWire.numbering === 'v2',
    'mixed source group and return markers were not normalized to one wire coordinate'
  );
  const LAWDY = 'U--h, u--h, Lawdy,';
  const OH = 'Oh--oh, oh my love';
  const song = (rows) => `${rows.join('\n')}\n\n[VERSE]\n${LAWDY}\n${OH}\nWe sing it plain`;
  const readings = (text) =>
    run('lySetupOf(lyParse(__t), "reading")', { __t: text }).map((r) => ({
      token: r.token,
      word: r.word,
      line: r.line,
      undecided: !!r.undecided,
    }));
  const tokens = (line) => Array.from(run('lyTokens(__l)', { __l: line }));

  // 1. Rebind success: a dash run renumbers the line's later words.
  const pre = song([row(3, 'Lawdy', LAWDY)]);
  check(tokens(LAWDY)[2] !== 'Lawdy', 'the fixture line no longer renumbers Lawdy');
  let got = run('lyMigrateSavedReadings(__t)', { __t: pre });
  check(
    got.rebound === 1 && got.blocked.length === 0,
    `Lawdy was not rebound: ${JSON.stringify(got)}`
  );
  let r = readings(got.text)[0];
  check(
    r.token === 5 && r.word === 'Lawdy' && tokens(LAWDY)[4] === 'Lawdy',
    'Lawdy rebound to the wrong token'
  );
  check(
    got.text.includes('L AO1 D IY0 — declared — source: the singer'),
    'the rebound row lost its reading'
  );

  // 2. The silent misbind: under the current cut token 2 of OH is still the
  // word "oh" -- the SECOND oh, inside "Oh--oh" -- while the saved row meant
  // the third. Without the migration it would bind there in silence.
  const misbind = song([row(2, 'oh', OH)]);
  check(tokens(OH)[1] === 'oh', 'the fixture no longer shows the silent misbind');
  check(
    run('lyDeclarationsOf(lyParse(__t)).pronunciations[0].token', { __t: misbind }) === 2,
    'unmigrated, the row would not have bound token 2 (the fixture lost its point)'
  );
  got = run('lyMigrateSavedReadings(__t)', { __t: misbind });
  r = readings(got.text)[0];
  const spans = run('CMLyricTokens.readerLine(__l).tokens', { __l: OH });
  check(r.token === 3 && !r.undecided, `the recurring word was bound to token ${r.token}, not 3`);
  check(
    JSON.stringify(spans[r.token - 1].pieces) === JSON.stringify([[8, 10]]),
    'the rebound token is not the physical occurrence the saved row named'
  );

  // 3. Block: no current token covers "U--h"; a row whose old number no longer
  // names its word is blocked too. Neither is dropped or moved.
  const blocked = song([row(1, 'U--h', LAWDY), row(2, 'love', OH), row(3, 'Lawdy', LAWDY)]);
  got = run('lyMigrateSavedReadings(__t)', { __t: blocked });
  const after = readings(got.text);
  check(got.blocked.length === 2 && got.rebound === 1, `block counts ${JSON.stringify(got)}`);
  check(
    after.length === 3 && after[0].undecided && after[1].undecided && !after[2].undecided,
    'a blocked reading was dropped or not flagged'
  );
  check(after[0].token === 1 && after[1].token === 2, 'a blocked reading was renumbered');
  const decl = run('lyDeclarationsOf(lyParse(__t))', { __t: got.text });
  check(
    decl.pronunciations.length === 1 && decl.pronunciations[0].word === 'Lawdy',
    'an undecided reading was sent as a pronunciation'
  );
  check(
    JSON.stringify(decl.readings_need_decision.map((x) => x.word)) === '["U--h","love"]',
    'the undecided readings are absent from the declarations'
  );
  check(
    /Nothing was sent/.test(run('lyUndecidedRefusal(lyParse(__t))', { __t: got.text })),
    'no refusal for undecided readings'
  );
  check(
    run('lyDraftForWriter(__t)', { __t: got.text }).includes('readings_need_decision'),
    'the writer text drops the undecided readings as if absent'
  );
  // The send path stops, with the message, and sends nothing.
  draft.value = got.text;
  const ok = run('lySubmitLyricsAction("review")');
  check(ok === false || (ok && typeof ok.then === 'function'), 'review did not answer');
  return Promise.resolve(ok).then((value) => {
    check(value === false && sends.length === 0, 'a draft with an undecided reading was sent');
    check(
      toasts.some(([m]) => /Nothing was sent/.test(m)),
      'no message said why nothing was sent'
    );

    // 4. The page migrates an unmarked draft once and marks its rows; the
    // migration replaces the current Undo step instead of adding one.
    toasts.length = 0;
    draft.value = pre;
    app.lyrics = pre;
    app.history = ['before'];
    app.historyIndex = 0;
    check(run('lyEnsureTokenScheme()') === true, 'the pre-release draft was not migrated');
    check(
      readings(draft.value)[0].token === 5 && app.lyrics === draft.value,
      'migration not saved'
    );
    check(
      draft.value.split('\n')[0].endsWith(' — source: the singer — numbering v2 — cut v2]') &&
        run('lySetupOf(lyParse(__t), "reading")[0].cut', { __t: draft.value }) === 'v2',
      'the rebound row does not carry the cut it is now numbered under'
    );
    check(
      app.history.length === 1 &&
        app.history[0] !== 'before' &&
        JSON.parse(app.history[0]).lyrics === draft.value,
      'the migration added an Undo step, or left the old numbers in the current one'
    );
    check(run('lyEnsureTokenScheme()') === false, 'a migrated draft was migrated again');

    // 5. A row the page writes is marked, and a marked row is left untouched,
    // even where the earlier cut would have numbered it differently: token 2
    // of OH written today is the "oh" inside "Oh--oh".
    const written = (token, word, line) =>
      run('`[SETUP — reading — ${lyReadingValue(__d)}]`', {
        __d: {
          token,
          word,
          line,
          kind: 'declared',
          phones: ['OW1'],
          basis: 'declared',
          source: 'the singer',
        },
      });
    check(/ — cut v2\]$/.test(written(2, 'oh', OH)), 'a written reading carries no cut mark');
    const post = song([written(5, 'Lawdy', LAWDY), written(2, 'oh', OH)]);
    draft.value = post;
    check(
      run('lyEnsureTokenScheme()') === false && draft.value === post,
      'a post-release draft moved'
    );
    check(
      JSON.stringify(readings(post).map((x) => x.token)) === '[5,2]',
      'a marked row was renumbered'
    );
    // Pre-release text entering a current draft (an imported .txt, a paste):
    // its unmarked row is migrated; the marked rows beside it are not.
    const mixed = song([written(5, 'Lawdy', LAWDY), row(2, 'oh', OH)]);
    draft.value = mixed;
    check(run('lyEnsureTokenScheme()') === true, 'imported pre-release rows were not migrated');
    check(
      JSON.stringify(readings(draft.value).map((x) => [x.token, x.undecided])) ===
        '[[5,false],[3,false]]',
      `the imported row was not rebound to the occurrence it named: ${draft.value}`
    );
    check(
      run('lyDeclarationsOf(lyParse(__t)).pronunciations[1].token', { __t: draft.value }) === 3,
      'the imported reading is declared on the wrong occurrence'
    );
    // A draft with no reading rows is untouched.
    draft.value = 'just a line';
    check(run('lyEnsureTokenScheme()') === false && draft.value === 'just a line', 'no rows');

    // 6. A renumbering is reported, never silent: an unmarked row on a line
    // whose cut moved gets a notice naming the old and new number.
    toasts.length = 0;
    draft.value = song([row(2, 'oh', OH)]);
    check(run('lyEnsureTokenScheme()') === true, 'the unmarked row was not migrated');
    check(
      toasts.length === 1 && /renumbered/.test(toasts[0][0]) && /word 2 → 3/.test(toasts[0][0]),
      `a renumbered reading moved without notice: ${JSON.stringify(toasts)}`
    );

    // 7. Rhyme links and declared returns name words by number too (`N.Tk`,
    // the pre-release "Word N" pickers). An unmarked row's word places are
    // rebound by span identity and the row gains the mark, which the tools
    // never receive. Named places are never converted to a number; on a line
    // whose cut changed (OH's dash run) they are kept named and carried
    // across the change (policy A, section P below).
    const OHS = `[VERSE]\n${OH}\nYou are the one I dream of\n${OH}`;
    const linked = `[SETUP — rhyme groups — 1.T4,2]\n[SETUP — returns — 1.T2,3.T2;1.head,3.head]\n\n${OHS}`;
    const member = (text, key, k) => {
      const m = run('lyParse(__t)', { __t: text });
      const g = run('lyParseGroups(lySetupOf(__m, __k)[0].value)', { __m: m, __k: key });
      return { word: run('lyMemberWord(__m, __x)', { __m: m, __x: g[0][k] }), m: g[0][k] };
    };
    check(
      member(linked, 'rhyme groups', 0).word === 'my' && member(linked, 'returns', 0).word === 'oh',
      'the fixture lost its point: unmigrated, 1.T4 must read "my" under the current cut'
    );
    toasts.length = 0;
    draft.value = linked;
    check(run('lyEnsureTokenScheme()') === true, 'word places were not migrated');
    const rows6 = draft.value.split('\n');
    check(
      rows6[0] === '[SETUP — rhyme groups — 1.T5,2 — numbering v2 — cut v2]' &&
        rows6[1] ===
          '[SETUP — returns — 1.T3,3.T3;1.head (carried across the word-cut change),3.head (carried across the word-cut change) — numbering v2 — cut v2]',
      `word places not rebound and marked: ${JSON.stringify(rows6.slice(0, 2))}`
    );
    const love = member(draft.value, 'rhyme groups', 0);
    const ohRet = member(draft.value, 'returns', 0);
    check(love.word === 'love', `the rhyme link moved to "${love.word}"`);
    check(
      ohRet.word === 'oh' &&
        JSON.stringify(
          run('CMLyricTokens.readerLine(__l).tokens[__k].pieces', {
            __l: OH,
            __k: Number(ohRet.m.place.slice(1)) - 1,
          })
        ) === JSON.stringify([[8, 10]]),
      'the placed return moved to another occurrence of "oh"'
    );
    let d6 = run('lyDeclarationsOf(lyParse(__t))', { __t: draft.value });
    check(
      d6.groups === '1.T5,2' && d6.returns === '1.T3,3.T3;1.head,3.head',
      `the tools would receive ${JSON.stringify([d6.groups, d6.returns])}`
    );
    check(
      toasts.length === 1 && /renumbered/.test(toasts[0][0]),
      'renumbered word places moved without notice'
    );
    check(run('lyEnsureTokenScheme()') === false, 'marked word places were migrated again');
    // A row the page writes is marked; renumbering lines keeps the mark.
    const set = run('lySetSetup("returns", ["1.T2,3.T2"], __t)', { __t: OHS });
    check(
      set.split('\n')[0] === '[SETUP — returns — 1.T2,3.T2 — numbering v2 — cut v2]',
      'a written word place carries no cut mark'
    );
    // Every rhyme groups / returns row the page writes is marked, named
    // places only included (policy A: an unmarked row is legacy by policy).
    check(
      run('lySetSetup("returns", ["1,3"], __t)', { __t: OHS }).split('\n')[0] ===
        '[SETUP — returns — 1,3 — cut v2]',
      'a row the page writes carries no cut mark'
    );
    const moved = run('lyAssemble(lyBlocks(lyParse(__t))).text', { __t: set });
    check(
      moved.split('\n')[0] === '[SETUP — returns — 1.T2,3.T2 — numbering v2 — cut v2]',
      `reassembly dropped the mark: ${moved.split('\n')[0]}`
    );
    // 8. A word place with no current word over its characters keeps its
    // old number, binds nothing, travels as needing a decision and stops
    // every send; removing the link clears the block.
    const lost = `[SETUP — returns — 1.T1,2.T1;1,2]\n\n[VERSE]\n${LAWDY}\n${LAWDY}`;
    toasts.length = 0;
    sends.length = 0;
    draft.value = lost;
    check(run('lyEnsureTokenScheme()') === true, 'a lost word place was not flagged');
    check(
      draft.value.split('\n')[0] ===
        // `1,2` is a whole-line return: never carried (3PO #519 6166749777).
        '[SETUP — returns — 1.T1 (numbered under the earlier cut),2.T1 (numbered under the earlier cut);1,2 — numbering v2 — cut v2]',
      `the lost word place was moved or dropped: ${draft.value.split('\n')[0]}`
    );
    check(member(draft.value, 'returns', 0).word === null, 'a lost word place binds a word');
    d6 = run('lyDeclarationsOf(lyParse(__t))', { __t: draft.value });
    check(
      d6.returns === '1,2' &&
        JSON.stringify(d6.returns_need_decision) ===
          JSON.stringify([
            '1.T1 (numbered under the earlier cut),2.T1 (numbered under the earlier cut)',
          ]),
      `a lost word place was sent as binding: ${JSON.stringify(d6)}`
    );
    check(
      /Nothing was sent.*word places? in a rhyme link or declared return/.test(
        run('lyUndecidedRefusal(lyParse(__t))', { __t: draft.value })
      ),
      'no refusal for a lost word place'
    );
    check(toasts.length === 1 && toasts[0][1] === 'error', 'no notice for a lost word place');
    const review = Array.from(run('lyLocalChecks(lyParse(__t))', { __t: draft.value }));
    check(
      review.some(
        (x) =>
          /^A declared return .* needs your decision$/.test(x.title) &&
          /earlier word cut/.test(x.text) &&
          x.actions.some((a) => a[0] === 'ly-drop-undecided')
      ) && !review.some((x) => /which the draft does not have/.test(x.title)),
      `Review shows no decision card for a lost word place: ${JSON.stringify(review.map((x) => x.title))}`
    );
    // Nor does it mark a word in the document's rhyme annotation.
    const lostLink = run('lyMigrateSavedReadings(__t).text', {
      __t: `[SETUP — rhyme groups — 1.T1,2]\n\n[VERSE]\n${LAWDY}\n${LAWDY}`,
    });
    app.lyricMeta.drafts = app.lyricMeta.drafts || {};
    const marks = run(
      'LY.tool = "rhymes"; const __r = lyRhymeMarks(lyParse(__t)); LY.tool = ""; __r',
      { __t: lostLink }
    );
    check(
      !marks.ends.has('1:1') && marks.ends.has('2:5'),
      `a lost word place marks a word: ${JSON.stringify([...marks.ends.keys()])}`
    );
    const okLost = run('lySubmitLyricsAction("review")');
    return Promise.resolve(okLost).then((value) => {
      check(value === false && sends.length === 0, 'a draft with a lost word place was sent');
      ctx.pushHistory = () => {};
      run(
        'LY.model = lyParse(lyDraft().value); typeof LY_ACTIONS["ly-drop-undecided"] === "function" && LY_ACTIONS["ly-drop-undecided"]("returns")'
      );
      check(
        draft.value.split('\n')[0] === '[SETUP — returns — 1,2 — cut v2]' &&
          run('lyUndecidedRefusal(lyParse(__t))', { __t: draft.value }) === '',
        `removing the link did not clear the block: ${draft.value.split('\n')[0]}`
      );

      // 9. Choosing the reading again, as Review says, clears the block: the
      // new choice replaces the undecided reading of the word it is.
      draft.value = song([row(1, 'U--h', LAWDY), row(2, 'love', OH)]);
      run('lyEnsureTokenScheme()');
      check(
        readings(draft.value).every((x) => x.undecided),
        'the fixture rows are not undecided'
      );
      let res = run(
        'LY_FORMS.pronunciation.apply(lyParse(__t), lyReadingKey(__l, 1, "U"), {kind: "declared", phones: "Y UW1", source: "the singer"})',
        { __t: draft.value, __l: LAWDY }
      );
      check(
        JSON.stringify(readings(res.text).map((x) => [x.word, x.undecided])) ===
          '[["love",true],["U",false]]',
        `choosing "U" again did not replace the undecided "U--h" alone: ${res.text}`
      );
      res = run(
        'LY_FORMS.pronunciation.apply(lyParse(__t), lyReadingKey(__l, 5, "love"), {kind: "declared", phones: "L AH1 V", source: "the singer"})',
        { __t: res.text, __l: OH }
      );
      check(
        run('lyUndecidedRefusal(lyParse(__t))', { __t: res.text }) === '' &&
          readings(res.text).length === 2,
        `choosing each reading again left the draft blocked: ${res.text}`
      );
    });
  });
}

// ── P. rhyme links and returns across the reader's v2 cut (policy A) ──────
// `N.Tk` is a count: rebound by span or blocked. A bare `N` and the named
// places (end, endword, head, headrime, line) are definitions the grader
// applies to the line as it reads it: never converted to a number; on a line
// whose earlier and current cuts differ ANYWHERE they are kept named, marked
// `(carried across the word-cut change)`, still sent, and Review shows one
// notice per member (line, place, the words the page shows under each cut,
// labelled as the page's display) with Keep the link / Remove it. On a line
// whose cut did not change nothing happens. An unknown cut mark blocks the
// row and names the accepted value. The states live in the text, so they
// survive every path the text takes. In a RETURNS row a bare `N` and
// `N.line` use distinct judges but share exemption from word-offset
// migration: neither is carried or noticed on any line (3PO #519 6166749777; unit E).
async function unitPolicyA() {
  stage = 'P. named places';
  const src = fs.readFileSync(UNIT_SOURCE, 'utf8');
  const draft = { value: '' };
  const toasts = [];
  const app = { lyricMeta: { version: 1 }, history: ['before'], historyIndex: 0, lyrics: '' };
  const ctx = vm.createContext({
    console,
    $ui: (id) => (id === 'lyrics-draft' ? draft : null),
    uiRegisterPage: () => {},
    uiCount: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`,
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {},
    app,
    lyricMetaOf: (v) => (v && v.version === 1 ? v : { version: 1, notes: {}, ui: {} }),
    uiAutosave: () => {},
    uiSaveLyrics: () => (app.lyrics = draft.value),
    sessionSnapshot: () => ({ lyrics: app.lyrics, lyricMeta: { ...app.lyricMeta } }),
    showToast: (m, tone) => toasts.push([m, tone]),
    pushHistory: () => {},
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/lyric-tokens.js'), 'utf8'), ctx);
  vm.runInContext(src, ctx, { filename: 'src/pages/lyrics.js' });
  const run = (code, vars = {}) => {
    Object.assign(ctx, vars);
    return vm.runInContext(code, ctx);
  };
  ctx.lyRefresh = () => {};
  const CARRIED = '(carried across the word-cut change)';
  // Sung lines, each chosen for one shape of the cut change.
  const L = {
    dash: 'Oh--oh, oh my love', // internal dash run; a repeated word
    lead: '--and so we go home', // leading dashes: the head moves
    plain: 'we sing it plain tonight', // unchanged
    numeral: 'love 4 love, love me true', // a numeral; repeated words
    tail: 'I counted up to 4', // trailing numeral: the end moves
    bass: 'my bass--line sings low', // an earlier word only ("double bass")
    aside: 'we wait (U--h) for you', // a cut change inside an aside
    plain2: 'You are the one I dream of', // unchanged
    unread: 'we go home 2nite', // a numeral inside the last word
    lawdy: 'U--h, u--h, Lawdy,', // no current word covers "U--h"
  };
  const order = Object.keys(L);
  const n = (k) => order.indexOf(k) + 1;
  const song = (rows, voices = false) =>
    `${voices ? '[SETUP — voices — parentheses are sung]\n' : ''}${rows.join('\n')}\n\n[VERSE]\n${order.map((k) => L[k]).join('\n')}`;
  const changed = (k, voices = false) =>
    run('lyLineCutChanged(__l, __v)', { __l: L[k], __v: voices });
  const migrate = (text) => run('lyMigrateSavedReadings(__t)', { __t: text });
  const checks = (text) => Array.from(run('lyLocalChecks(lyParse(__t))', { __t: text }));
  const carriedNotes = (text) => checks(text).filter((x) => /:carried:/.test(x.id));
  const decl = (text) =>
    JSON.parse(run('JSON.stringify(lyDeclarationsOf(lyParse(__t)))', { __t: text }));
  const refusal = (text) => run('lyUndecidedRefusal(lyParse(__t))', { __t: text });

  // The fixture keeps its point: which lines' cuts changed.
  for (const k of ['dash', 'lead', 'numeral', 'tail', 'bass', 'unread', 'lawdy'])
    check(changed(k), `fixture: the cut of “${L[k]}” no longer changes`);
  for (const k of ['plain', 'plain2', 'aside'])
    check(!changed(k), `fixture: the cut of “${L[k]}” changes`);
  check(changed('aside', true), 'fixture: with voices on, the aside line’s cut does not change');
  // The "double bass" shape: the last word is the same characters under both
  // cuts, and the line still counts as changed.
  const bassCuts = run('lyLineCuts(__l, false)', { __l: L.bass });
  check(
    JSON.stringify(bassCuts.old.at(-1).pieces) === JSON.stringify(bassCuts.cur.at(-1).pieces),
    'fixture: the bass line’s last word moved'
  );

  // 1. Both row types x the seven spellings, a changed line linked with an
  // unchanged one in the same group.
  const NAMED = ['', '.end', '.endword', '.head', '.headrime', '.line'];
  for (const key of ['rhyme groups', 'returns']) {
    for (const sp of NAMED) {
      const label = `${key} ${sp || 'bare N'}`;
      const text = song([`[SETUP — ${key} — ${n('dash')}${sp},${n('plain')}${sp}]`]);
      const got = migrate(text);
      const row = got.text.split('\n')[0];
      if (key === 'returns' && (sp === '' || sp === '.line')) {
        // A whole-line return: the row keeps every byte, nothing is carried
        // or noticed, and the tools receive it as written.
        const d = decl(got.text);
        check(
          got.text === text &&
            got.carried.length === 0 &&
            carriedNotes(got.text).length === 0 &&
            d.returns === `${n('dash')}${sp},${n('plain')}${sp}` &&
            refusal(got.text) === '',
          `${label}: a whole-line return was carried or noticed: ${row} ${JSON.stringify(d)}`
        );
        continue;
      }
      // Only the carried member is rewritten; each member keeps the writer's
      // own spelling (`.end` stays `.end`), and the row gains the mark.
      check(
        row === `[SETUP — ${key} — ${n('dash')}${sp} ${CARRIED},${n('plain')}${sp} — cut v2]`,
        `${label}: not kept named and carried: ${row}`
      );
      check(
        !/\.T\d/.test(row) && got.carried.length === 1 && got.moved.length === 0,
        `${label}: a named place was converted or moved: ${JSON.stringify(got)}`
      );
      const notes = carriedNotes(got.text);
      check(
        notes.length === 1 &&
          notes[0].tone === 'note' &&
          notes[0].lines.join() === String(n('dash')) &&
          notes[0].actions.map((a) => a[1]).join('|') === 'Keep the link|Remove it' &&
          /page's display, not the grader's evidence/.test(notes[0].text),
        `${label}: notice ${JSON.stringify(notes.map((x) => [x.title, x.text]))}`
      );
      // Non-blocking: the member is sent, as declared, without the page note.
      const d = decl(got.text);
      const field = key === 'returns' ? 'returns' : 'groups';
      check(
        d[field] === `${n('dash')}${sp},${n('plain')}${sp}` && !d[`${field}_need_decision`],
        `${label}: the tools would receive ${JSON.stringify(d)}`
      );
      check(refusal(got.text) === '', `${label}: a carried member blocked the send`);
      // On unchanged lines only, nothing happens at all.
      const quiet = song([`[SETUP — ${key} — ${n('plain')}${sp},${n('plain2')}${sp}]`]);
      check(
        migrate(quiet).text === quiet && carriedNotes(quiet).length === 0,
        `${label}: an unchanged-cut line was touched or noticed`
      );
    }
    // T<k>: a count, rebound by span (never carried).
    const t = song([`[SETUP — ${key} — ${n('dash')}.T2,${n('plain')}.T2]`]);
    const gt = migrate(t);
    check(
      gt.text.split('\n')[0] ===
        `[SETUP — ${key} — ${n('dash')}.T3,${n('plain')}.T2 — numbering v2 — cut v2]` &&
        gt.carried.length === 0 &&
        gt.moved.length === 1,
      `${key} Tn: ${gt.text.split('\n')[0]}`
    );
    check(carriedNotes(gt.text).length === 0, `${key} Tn: a counted place got a carried notice`);
    // Missing old binding, narrower overlap (no new binding), changed
    // occurrence: blocked, blocked, rebound.
    const tb = migrate(
      song([
        `[SETUP — ${key} — ${n('dash')}.T9,${n('plain')};${n('lawdy')}.T1,${n('plain2')};${n('numeral')}.T3,${n('plain2')}]`,
      ])
    );
    const tbRow = tb.text.split('\n')[0];
    check(
      tbRow.includes(`${n('dash')}.T9 (numbered under the earlier cut)`) &&
        tbRow.includes(`${n('lawdy')}.T1 (numbered under the earlier cut)`) &&
        tbRow.includes(`${n('numeral')}.T4,`),
      `${key} Tn blocks/rebinds: ${tbRow}`
    );
    check(
      JSON.stringify(run('CMLyricTokens.readerLine(__l).tokens[3].pieces', { __l: L.numeral })) ===
        '[[13,17]]',
      'the rebound repeated "love" is not the occurrence the number named'
    );
  }

  // 2. The words shown under each cut, labelled as display.
  const shown = (k, place) => run('lyPlaceWords(__l, false, __p)', { __l: L[k], __p: place });
  const sw = [
    shown('lead', 'head'),
    shown('tail', 'end'),
    shown('bass', 'end'),
    shown('unread', 'endword'),
    shown('numeral', 'line'),
  ];
  check(
    JSON.stringify(sw) ===
      JSON.stringify([
        { before: '--and', now: 'and' },
        { before: 'to', now: '4' },
        { before: 'low', now: 'low' },
        { before: 'nite', now: '2nite' },
        { before: 'love love love me true', now: 'love 4 love love me true' },
      ]),
    `words shown under each cut: ${JSON.stringify(sw)}`
  );
  // The "double bass" shape and the trailing numeral both fire.
  for (const k of ['bass', 'tail', 'unread', 'lead']) {
    const got = migrate(song([`[SETUP — rhyme groups — ${n(k)},${n('plain')}]`]));
    const notes = carriedNotes(got.text);
    check(
      notes.length === 1 && notes[0].lines.join() === String(n(k)),
      `no notice for the ${k} line: ${got.text.split('\n')[0]}`
    );
  }
  const tailNote = carriedNotes(
    migrate(song([`[SETUP — rhyme groups — ${n('tail')},${n('plain')}]`])).text
  )[0];
  check(
    /“to” under the earlier cut and “4” under the current one/.test(tailNote?.text || ''),
    `the trailing-numeral notice does not show both words: ${tailNote?.text}`
  );

  // 3. Asides: voices off, the aside is not read by either cut (no notice);
  // voices on, the aside's dash run changes the cut (notice).
  const asideOff = song([`[SETUP — returns — ${n('aside')}.end,${n('plain')}.end]`]);
  check(
    migrate(asideOff).text === asideOff,
    'voices off: the aside line was flagged although neither cut reads the aside'
  );
  const asideOn = song([`[SETUP — returns — ${n('aside')}.end,${n('plain')}.end]`], true);
  const gotOn = migrate(asideOn);
  check(
    gotOn.carried.length === 1 && carriedNotes(gotOn.text).length === 1,
    `voices on: no notice for the aside line: ${gotOn.text.split('\n')[1]}`
  );

  // 4. A mixed group with one undecidable member: that group is held back
  // (and the send stops); its carried member is still noticed; another group
  // still goes.
  const mixed = migrate(
    song([
      `[SETUP — rhyme groups — ${n('lawdy')}.T1,${n('dash')},${n('plain')};${n('plain2')},${n('plain')}]`,
    ])
  );
  const dm = decl(mixed.text);
  check(
    dm.groups === `${n('plain2')},${n('plain')}` &&
      dm.groups_need_decision?.length === 1 &&
      dm.groups_need_decision[0].includes('(numbered under the earlier cut)') &&
      /Nothing was sent/.test(refusal(mixed.text)) &&
      carriedNotes(mixed.text).length === 1,
    `mixed group: ${JSON.stringify(dm)}`
  );

  // 5. Unknown marks block, name the accepted value, and are never rewritten
  // as the current cut's -- not by the migration, not by a form merging rows.
  for (const mark of ['v3', 'vX']) {
    const alien = song([`[SETUP — rhyme groups — ${n('dash')},${n('plain')} — cut ${mark}]`]);
    check(migrate(alien).text === alien, `cut ${mark}: the migration rewrote an unknown mark`);
    const da = decl(alien);
    check(
      !da.groups && da.groups_need_decision?.length === 1,
      `cut ${mark}: a row with an unknown mark was sent: ${JSON.stringify(da)}`
    );
    const why = refusal(alien);
    check(
      new RegExp(`marked cut ${mark.toLowerCase()}.*accepts only “cut v2”`).test(why),
      `cut ${mark}: refusal ${why}`
    );
    check(
      checks(alien).some((x) => /does not read/.test(x.title) && /only “cut v2”/.test(x.text)),
      `cut ${mark}: no Review card naming the accepted value`
    );
    // The rhymes form merges every row into one: the alien members stay
    // blocked, each saying the cut it was marked with.
    const res = run(
      'LY_FORMS.rhymes.apply(lyParse(__t), "", { members: [{ line: __a, place: "end" }, { line: __b, place: "end" }] }, ["members"])',
      { __t: alien, __a: n('plain'), __b: n('plain2') }
    );
    check(
      res.text.split('\n')[0] ===
        `[SETUP — rhyme groups — ${n('dash')} (marked cut ${mark.toLowerCase()}: not read here),${n('plain')} (marked cut ${mark.toLowerCase()}: not read here);${n('plain')},${n('plain2')} — cut v2]` &&
        /Nothing was sent/.test(refusal(res.text)),
      `cut ${mark}: the form laundered the unknown mark: ${res.text.split('\n')[0]}`
    );
  }
  const alienReading = song([
    `[SETUP — reading — token 2 "oh" in ${JSON.stringify(L.dash)} — OW1 — declared — source: me — cut v9]`,
  ]);
  check(
    migrate(alienReading).text === alienReading &&
      !decl(alienReading).pronunciations &&
      /“oh” marked cut v9.*accepts only “cut v2”/.test(refusal(alienReading)),
    'a reading with an unknown mark was rewritten or sent'
  );

  // 6. Keep / Remove, and the state through every path the text takes.
  const legacy = song([
    `[SETUP — rhyme groups — ${n('dash')}.head,${n('plain')};${n('tail')},${n('plain2')}]`,
    `[SETUP — returns — ${n('bass')}.end,${n('plain')}.end]`,
  ]);
  draft.value = legacy;
  app.history = ['before'];
  app.historyIndex = 0;
  toasts.length = 0;
  check(run('lyEnsureTokenScheme()') === true, 'the legacy links were not read');
  check(
    toasts.length === 1 && /3 rhyme or return places .* kept as declared/.test(toasts[0][0]),
    `no notice when the links were carried: ${JSON.stringify(toasts)}`
  );
  const migrated = draft.value;
  const notesOf = (t) => carriedNotes(t).map((x) => x.lines.join());
  check(
    notesOf(migrated).join() === [n('dash'), n('tail'), n('bass')].join(),
    `notices: ${notesOf(migrated)}`
  );
  // Save and reopen: the state is in the text; nothing re-reads it.
  check(
    migrate(migrated).text === migrated && run('lyEnsureTokenScheme()') === false,
    'a carried draft was migrated again on reopen'
  );
  // Text export and import: the downloaded text is the draft.
  draft.value = migrated + '';
  check(notesOf(draft.value).length === 3, 'an exported and imported draft lost its notices');
  // A Library working copy round-trip keeps the text byte for byte.
  const LI = require('../src/library-import.js');
  const meta = {
    version: 1,
    libraryOrigin: {
      version: 1,
      handoffId: 'handoff:x',
      digest: '0'.repeat(64),
      adapted: true,
      title: 'Song',
      language: 'eng',
      scope: 'whole',
      provenance: {
        snapshotId: 'snap:1',
        unitId: 'unit:1',
        workId: 'work:1',
        editionId: 'ed:1',
        revisionId: 'rev:1',
      },
      lineage: [],
      declarations: [],
    },
  };
  const env = await LI.makeWorkingCopyEnvelope(migrated, meta, require('crypto').webcrypto);
  const back = LI.importedDraft(
    await LI.validateEnvelope(env, require('crypto').webcrypto),
    1
  ).text;
  check(back === migrated && notesOf(back).length === 3, 'a Library working copy lost the states');
  // Section reorder: the member follows its line, state and mark kept.
  // The song is split before the bass line, and the two sections swapped.
  const split = migrated.replace(`\n${L.bass}\n`, `\n\n[CHORUS]\n${L.bass}\n`);
  check(
    migrate(split).text === split && notesOf(split).length === 3,
    'a section header moved a state'
  );
  const reordered = run(
    '(() => { const p = lyBlocks(lyParse(__t)); p.blocks.reverse(); return lyAssemble(p).text; })()',
    { __t: split }
  );
  const head = order.length - n('bass') + 1; // lines before the bass line, moved after it
  check(
    reordered.split('\n')[0].includes(`${n('dash') + head}.head ${CARRIED}`) &&
      / — cut v2\]$/.test(reordered.split('\n')[0]) &&
      notesOf(reordered).sort().join() ===
        [n('dash') + head, n('tail') + head, 1].map(String).sort().join(),
    `reassembly lost the carried state: ${reordered.split('\n')[0]} ${notesOf(reordered)}`
  );
  // The repeats form merges rows too: the carried member stays carried.
  const viaForm = run(
    'LY_FORMS["repeats-voices"].apply(lyParse(__t), "", { placed: [{ line: __a, place: "head" }, { line: __b, place: "head" }] }, ["placed"]).text',
    { __t: migrated, __a: n('plain'), __b: n('plain2') }
  );
  check(
    viaForm.split('\n')[1] ===
      `[SETUP — returns — ${n('bass')}.end ${CARRIED},${n('plain')}.end;${n('plain')}.head,${n('plain2')}.head — cut v2]`,
    `the repeats form dropped the carried state: ${viaForm.split('\n')[1]}`
  );
  // Keep the link: the notice goes, the link stays, and it does not come back.
  const keepId = carriedNotes(migrated).find((x) => x.lines.join() === String(n('dash')))
    ?.actions[0][3];
  draft.value = migrated;
  run('LY_ACTIONS["ly-carried-keep"](__id)', { __id: keepId });
  const kept = draft.value;
  check(
    kept.split('\n')[0] ===
      `[SETUP — rhyme groups — ${n('dash')}.head,${n('plain')};${n('tail')} ${CARRIED},${n('plain2')} — cut v2]` &&
      notesOf(kept).join() === [n('tail'), n('bass')].join(),
    `Keep did not clear exactly that notice: ${kept.split('\n')[0]}`
  );
  check(
    migrate(kept).text === kept &&
      notesOf(run('lyAssemble(lyBlocks(lyParse(__t))).text', { __t: kept })).join() ===
        [n('tail'), n('bass')].join(),
    'a kept link was flagged again'
  );
  // Remove it: the member goes; a link left with one member goes whole.
  const removeId = carriedNotes(kept).find((x) => x.lines.join() === String(n('bass')))
    ?.actions[1][3];
  run('LY_ACTIONS["ly-carried-remove"](__id)', { __id: removeId });
  check(
    !draft.value.includes('[SETUP — returns') && notesOf(draft.value).join() === String(n('tail')),
    `Remove did not remove the link: ${draft.value.split('\n').slice(0, 2)}`
  );
  check(
    decl(draft.value).groups === `${n('dash')}.head,${n('plain')};${n('tail')},${n('plain2')}`,
    `after Keep/Remove the tools would receive ${JSON.stringify(decl(draft.value))}`
  );
  // No notice anywhere on a draft whose lines' cuts are all unchanged, for
  // every named spelling at once (asides read by neither cut included); a
  // counted place there whose number names the same word keeps every byte
  // (F6: the existing text contract; no mark appended to an unchanged row).
  const allQuiet = song([
    `[SETUP — rhyme groups — ${n('plain')},${n('plain2')};${n('plain')}.end,${n('plain2')}.endword;${n('plain')}.head,${n('plain2')}.headrime;${n('plain')}.line,${n('plain2')}.line]`,
    `[SETUP — returns — ${n('aside')},${n('plain2')};${n('plain')}.head,${n('aside')}.head]`,
  ]);
  draft.value = allQuiet;
  check(
    run('lyEnsureTokenScheme()') === false &&
      draft.value === allQuiet &&
      carriedNotes(allQuiet).length === 0,
    'a notice or rewrite on a draft with no changed cut'
  );
  const quietT = migrate(song([`[SETUP — returns — ${n('plain')}.T2,${n('plain2')}.T3]`]));
  check(
    quietT.text.split('\n')[0] === `[SETUP — returns — ${n('plain')}.T2,${n('plain2')}.T3]` &&
      quietT.moved.length === 0 &&
      carriedNotes(quietT.text).length === 0,
    `a counted place on an unchanged line moved or was noticed: ${quietT.text.split('\n')[0]}`
  );
}

// ── B. where the migration runs, and what it keeps (BB8 #519 6161601064) ──
// F1: the migration runs at a boundary (open, import, send), never from the
// typing refresh, and keeps the existing Undo contract: no step of its own,
// the writer's text recorded first at an in-page boundary, the open or
// import step holding the migrated text, the selection mapped onto the same
// characters. F4: every renumbered number is listed in a Review card that
// stays until dismissed. F5: no message claims when a row was written. F6:
// a row whose binding does not change keeps every byte (no mark); a
// rewritten row respells only the members that changed. A.2: a line whose
// cut is identical but whose earlier end anchor looked up other words
// (an enclitic set apart by punctuation, joined by the earlier re-cut) is a
// changed line, and no other identical-cut line of the corpus is.
async function unitBoundaries() {
  stage = 'B. boundaries';
  const src = fs.readFileSync(UNIT_SOURCE, 'utf8');
  const sel = { start: 0, end: 0, dir: 'none' };
  const draft = {
    value: '',
    get selectionStart() {
      return sel.start;
    },
    get selectionEnd() {
      return sel.end;
    },
    get selectionDirection() {
      return sel.dir;
    },
    setSelectionRange(a, b, d = 'none') {
      Object.assign(sel, { start: a, end: b, dir: d });
    },
  };
  const toasts = [];
  const app = { lyricMeta: { version: 1, ui: {} }, history: [], historyIndex: -1, lyrics: '' };
  const snapshot = () => ({ lyrics: app.lyrics, lyricMeta: { ...app.lyricMeta } });
  const ctx = vm.createContext({
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    $ui: (id) => (id === 'lyrics-draft' ? draft : null),
    uiRegisterPage: () => {},
    uiCount: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`,
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {},
    app,
    lyricMetaOf: (v) => (v && v.version === 1 ? v : { version: 1, notes: {}, ui: {} }),
    uiAutosave: () => {},
    uiSaveLyrics: () => (app.lyrics = draft.value),
    sessionSnapshot: snapshot,
    // src/app.js pushHistory: a step after the change, an identical one merged.
    pushHistory: () => {
      const snap = JSON.stringify(snapshot());
      const prev = app.history[app.historyIndex];
      if (prev && JSON.parse(prev).lyrics === app.lyrics) {
        app.history[app.historyIndex] = snap;
        return;
      }
      app.history = app.history.slice(0, app.historyIndex + 1);
      app.history.push(snap);
      app.historyIndex = app.history.length - 1;
    },
    showToast: (m, tone) => toasts.push([m, tone]),
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/lyric-tokens.js'), 'utf8'), ctx);
  vm.runInContext(src, ctx, { filename: 'src/pages/lyrics.js' });
  const run = (code, vars = {}) => {
    Object.assign(ctx, vars);
    return vm.runInContext(code, ctx);
  };
  ctx.lyRefresh = () => {};
  const steps = () => app.history.map((h) => JSON.parse(h).lyrics);
  const OH = 'Oh--oh, oh my love';
  const DOVE = 'You are the one I dream of my dove';
  const PLAIN = 'we sing it plain tonight';
  const body = `[VERSE]\n${OH}\n${DOVE}\n${OH}\n${PLAIN}`;
  const LEGACY = '[SETUP — returns — 1.T2,3.T2]';
  const MIGRATED = '[SETUP — returns — 1.T3,3.T3 — numbering v2 — cut v2]';

  // 1. F1, an in-page boundary (send, mount): the writer's own text is
  // recorded first, the migrated text replaces that same step, Undo goes to
  // the step before the writer's text, and the selection stays on its words.
  const before = `[SETUP — title — "Song"]\n\n${body}`;
  const typed = `${LEGACY}\n${before}`; // a legacy row pasted in, not yet recorded
  app.history = [];
  app.historyIndex = -1;
  draft.value = before;
  app.lyrics = before;
  run('pushHistory()');
  draft.value = typed;
  const at = typed.indexOf('dream');
  draft.setSelectionRange(at, at + 'dream of'.length, 'backward');
  toasts.length = 0;
  check(run('lyEnsureTokenScheme()') === true, 'the send boundary did not migrate');
  check(draft.value === typed.replace(LEGACY, MIGRATED), `migrated text: ${draft.value}`);
  check(
    draft.value.slice(sel.start, sel.end) === 'dream of' && sel.dir === 'backward',
    `the selection moved off the writer's words: “${draft.value.slice(sel.start, sel.end)}” ${sel.dir}`
  );
  check(
    JSON.stringify(steps()) === JSON.stringify([before, draft.value]) && app.historyIndex === 1,
    `Undo history across the boundary: ${JSON.stringify(steps())}`
  );
  check(!steps().includes(typed), 'a history step holds the unmarked rows');
  check(run('lyEnsureTokenScheme()') === false && app.history.length === 2, 'migrated twice');

  // 1b. F1, member by member (3PO #519 6164274432; BB8 66cef416 found a
  // selection of the unchanged `2.end` collapse to before `]`, [25,30] ->
  // [39,39], and a selection ending in the changed member grow over `2.end`
  // and the mark): inside a rewritten row, a selection or caret in an
  // UNCHANGED member keeps its exact characters, and one on a changed member
  // covers that member's new spelling and nothing more.
  const selected = (row, from, to, dir = 'forward') => {
    const text = `${row}\n${before}`;
    draft.value = text;
    draft.setSelectionRange(from, to, dir);
    run('lyEnsureTokenScheme("open")');
    return { text: draft.value, got: draft.value.slice(sel.start, sel.end), sel: { ...sel } };
  };
  const ONE = '[SETUP — returns — 1.T2, 2.end]';
  let s1 = selected(ONE, ONE.indexOf('2.end'), ONE.indexOf('2.end') + 5);
  check(
    s1.text.startsWith('[SETUP — returns — 1.T3, 2.end — numbering v2 — cut v2]') &&
      s1.got === '2.end' &&
      s1.sel.start === 25,
    `a selection of the unchanged 2.end did not keep its characters: ${JSON.stringify(s1.sel)} “${s1.got}”`
  );
  for (let k = 0; k <= 5; k++) {
    s1 = selected(ONE, ONE.indexOf('2.end') + k, ONE.indexOf('2.end') + k);
    check(
      s1.sel.start === s1.sel.end && s1.sel.start === s1.text.indexOf('2.end') + k,
      `a caret inside 2.end moved: offset ${k} -> ${JSON.stringify(s1.sel)}`
    );
  }
  s1 = selected(ONE, ONE.indexOf('1.T2'), ONE.indexOf('1.T2') + 4, 'backward');
  check(
    s1.got === '1.T3' && s1.sel.dir === 'backward',
    `a selection of the renumbered member grew or moved: “${s1.got}”`
  );
  // P1: both sides of the former 250,000-pair cutoff, and a longer list.
  for (const count of [123, 124, 1000]) {
    const row = '[SETUP — rhyme groups — ' + Array(count).fill('1.T2,2.end').join(';') + ']';
    for (const at of [row.indexOf('2.end'), row.lastIndexOf('2.end')]) {
      const mapped = selected(row, at, at + 5, 'backward');
      check(
        mapped.got === '2.end' && mapped.sel.start === at && mapped.sel.dir === 'backward',
        `P1 ${count} groups: [${at},${at + 5}] became ${JSON.stringify(mapped.sel)}`
      );
    }
  }
  // P6: the narrow-layout Song cache must follow the same migration.
  const mobileText = `${ONE}\n${before}`;
  const mobileAt = mobileText.indexOf('dream');
  run('LY.songCaret = [__at, __at + 8, 73]', { __at: mobileAt });
  draft.value = mobileText;
  run('lyEnsureTokenScheme()');
  const mobileCaret = run('LY.songCaret');
  check(
    draft.value.slice(mobileCaret[0], mobileCaret[1]) === 'dream of' && mobileCaret[2] === 73,
    `P6 cached song selection became ${JSON.stringify(mobileCaret)}`
  );
  run('delete LY.songCaret');
  // The multi-member variant: two renumbered members, a carried one and
  // three unchanged ones, with the writer's own spaces, in one row.
  const MANY = '[SETUP — rhyme groups — 1.T2,2.end;3.T2, 4.head ,2;1.end,4]';
  const wantMany = `[SETUP — rhyme groups — 1.T3,2.end;3.T3, 4.head ,2;1.end ${'(carried across the word-cut change)'},4 — numbering v2 — cut v2]`;
  for (const member of ['2.end', ' 4.head ', '2;1', ',4', '1.T2,2.end;3']) {
    const at = MANY.indexOf(member);
    const m = selected(MANY, at, at + member.length);
    const expect = member === '1.T2,2.end;3' ? '1.T3,2.end;3' : member;
    check(
      m.text.startsWith(wantMany) && m.got === expect,
      `a selection of “${member}” in a rewritten row became “${m.got}” (${m.text.split('\n')[0]})`
    );
  }
  // A selection across a point where the rewrite inserted text (`4]`, the
  // mark inserted before `]`) covers the insertion: nothing is lost from it.
  const at4 = MANY.indexOf('4]');
  check(
    selected(MANY, at4, at4 + 2).got === '4 — numbering v2 — cut v2]',
    'a selection across the inserted mark lost characters'
  );
  delete app.lyricMeta.renumbered; // these probes' own record

  // 2. F1, an open (src/workbench.js / src/app.js call uiLyricsOpened, then
  // record the step): Undo returns to the draft from before the open and
  // Redo to the migrated text; neither holds the unmarked rows.
  const other = `[VERSE]\n${PLAIN}`;
  app.history = [];
  app.historyIndex = -1;
  draft.value = other;
  app.lyrics = other;
  run('pushHistory()');
  const opened = `${LEGACY}\n\n${body}`;
  draft.value = opened;
  check(run('uiLyricsOpened()') === true, 'the open boundary did not migrate');
  check(app.history.length === 1, 'the open boundary recorded a step of its own');
  run('pushHistory()');
  check(
    JSON.stringify(steps()) === JSON.stringify([other, opened.replace(LEGACY, MIGRATED)]),
    `open: ${JSON.stringify(steps())}`
  );

  // 3. F1, a .txt import: one step, holding the migrated text.
  const file = `${opened}\n${PLAIN}`;
  run('lyImportText(__t, "Imported.")', { __t: file });
  check(
    steps().length === 3 && steps()[2] === file.replace(LEGACY, MIGRATED),
    `import: ${JSON.stringify(steps())}`
  );

  // 4. F4: every renumbered number listed in Review until dismissed --
  // after the toast is gone, after a boundary that moves nothing, and after
  // a later import that renumbers more (which the card adds).
  const card = (text) =>
    Array.from(run('lyLocalChecks(lyParse(__t))', { __t: text })).find(
      (x) => x.id === 'renumbered'
    );
  let c = card(draft.value);
  check(
    c &&
      c.tone === 'note' &&
      /a declared return on “oh”, line 1: word 2 → 3/.test(c.text) &&
      /a declared return on “oh”, line 3: word 2 → 3/.test(c.text) &&
      c.actions.some((a) => a[0] === 'ly-renumbered-dismiss'),
    `no persistent card listing the renumbered items: ${JSON.stringify(c)}`
  );
  run('lyEnsureTokenScheme()');
  check(card(draft.value), 'the card went away at a boundary that renumbered nothing');
  const reading = `[SETUP — reading — token 2 "oh" in ${JSON.stringify(OH)} — OW1 — declared — source: me]`;
  const many = `${reading}\n[SETUP — rhyme groups — 1.T4,2.T9,4.T5]\n\n${body}`;
  toasts.length = 0;
  run('lyImportText(__t, "Imported.")', { __t: many });
  c = card(draft.value);
  check(
    c &&
      /the reading for “oh”, lines 1 and 3: word 2 → 3/.test(c.text) &&
      /a rhyme link on “love”, line 1: word 4 → 5/.test(c.text) &&
      /line 3: word 2 → 3/.test(c.text),
    `the card does not list every renumbered item: ${c && c.text}`
  );
  check(
    /Review lists each one until you dismiss it/.test(toasts.map((t) => t[0]).join(' ')),
    `the toast does not point to the card: ${JSON.stringify(toasts)}`
  );
  // F4 RETENTION (3PO #519 6164274432; BB8 66cef416 found one import kept
  // 48-49 of 50, 200 or 500 entries, words cut at 40 characters and lines at
  // 4): ONE import that moves 501 numbers keeps every entry, whole, until
  // Dismiss. The card shows the first page and says how many more; "Show
  // all" lists every one -- the long word uncut, all six lines a reading
  // names. The page context's own lyricMetaOf and lyricMetaHistory
  // (src/app.js, run here as shipped) keep the whole record for saves and
  // for the Undo step.
  const LONG = 'Supercalifragilisticexpialidociousandthensome'; // 45 characters
  const AH = `Ah--oh ${LONG}`; // `LONG` is word 2, then 3
  const bigSong = [
    ...Array.from({ length: 500 }, () => OH),
    ...Array.from({ length: 6 }, () => AH),
  ];
  const bigRows = [
    `[SETUP — reading — token 2 ${JSON.stringify(LONG)} in ${JSON.stringify(AH)} — L AO1 NG — declared — source: me]`,
    `[SETUP — rhyme groups — ${Array.from({ length: 250 }, (_, k) => `${2 * k + 1}.T2,${2 * k + 2}.T2`).join(';')}]`,
  ];
  run('LY_ACTIONS["ly-renumbered-dismiss"]()');
  run('lyImportText(__t, "Imported.")', {
    __t: `${bigRows.join('\n')}\n\n[VERSE]\n${bigSong.join('\n')}`,
  });
  c = card(draft.value);
  const entries = (t) => (t.match(/: word \d+ → \d+/g) || []).length;
  check(
    !!c &&
      /^501 saved word numbers renumbered/.test(c.title) &&
      entries(c.text) === 20 &&
      /; and 481 more \(Show all lists every one\)/.test(c.text) &&
      c.actions.some((a) => a[0] === 'ly-renumbered-all' && a[1] === 'Show all 501'),
    `the card does not page a large import: ${c && c.title} ${c && c.text.slice(-200)}`
  );
  run('typeof LY_ACTIONS["ly-renumbered-all"] === "function" && LY_ACTIONS["ly-renumbered-all"]()');
  c = card(draft.value);
  check(
    !!c &&
      entries(c.text) === 501 &&
      c.text.includes(
        `the reading for “${LONG}”, lines 501, 502, 503, 504, 505 and 506: word 2 → 3`
      ) &&
      /a rhyme link on “oh”, line 500: word 2 → 3/.test(c.text) &&
      !/dropped|no longer listed/.test(c.text),
    `Show all does not list every entry whole: ${c && entries(c.text)} ${c && c.text.slice(0, 300)}`
  );
  const appSrc = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const metaSrc = appSrc.slice(
    appSrc.indexOf('const LYRIC_META_LIMITS='),
    appSrc.indexOf('function sessionSnapshot()')
  );
  const shipped = vm.runInNewContext(`${metaSrc};({ lyricMetaOf, lyricMetaHistory })`, {});
  const stored = shipped.lyricMetaOf(JSON.parse(JSON.stringify(app.lyricMeta)));
  const step = shipped.lyricMetaHistory(stored);
  check(
    stored.renumbered?.items.length === 501 &&
      step.renumbered?.items.length === 501 &&
      stored.renumbered.items.some((m) => m.word === LONG && m.n.length === 6),
    `the saved record or the Undo step lost entries: ${stored.renumbered?.items.length} / ${step.renumbered?.items.length}`
  );
  run('LY_ACTIONS["ly-renumbered-dismiss"]()');
  check(!card(draft.value), 'Dismiss did not remove the card');
  // A record an earlier version of this page kept (ui.renumbered, with a
  // count of evicted entries) is read, and its count still said.
  app.lyricMeta = {
    version: 1,
    ui: {
      renumbered: { items: [{ kind: 'reading', word: 'oh', n: [1], from: 2, to: 3 }], more: 7 },
    },
  };
  c = card(draft.value);
  check(
    !!c &&
      /^8 saved word numbers renumbered/.test(c.title) &&
      /7 earlier entries were dropped by an earlier version of this page/.test(c.text) &&
      !app.lyricMeta.ui.renumbered,
    `an earlier record was not carried over: ${c && c.text}`
  );
  draft.value = `${LEGACY}\n${body}`;
  run('lyEnsureTokenScheme("open")');
  c = card(draft.value);
  check(
    app.lyricMeta.renumbered.more === 7 &&
      app.lyricMeta.renumbered.items.length === 3 &&
      /7 earlier entries were dropped by an earlier version of this page/.test(c.text),
    `P2 appending migration lost legacy missing-entry warning: ${c && c.text}`
  );
  run('LY_ACTIONS["ly-renumbered-dismiss"]()');

  // 5. F5: removing a link that binds no word claims nothing about when the
  // row was written, for a row marked with another cut and for a legacy one.
  for (const [text, want] of [
    [`[SETUP — rhyme groups — 1,2 — cut v9]\n\n${body}`, /cut v9/],
    [
      run('lyMigrateSavedReadings(__t).text', {
        __t: `[SETUP — rhyme groups — 1.T1,2;3,4]\n\n[VERSE]\nU--h, u--h, Lawdy,\n${DOVE}\n${OH}\n${PLAIN}`,
      }),
      /compatibility policy/,
    ],
  ]) {
    draft.value = text;
    toasts.length = 0;
    run('LY.model = lyParse(lyDraft().value); LY_ACTIONS["ly-drop-undecided"]("rhyme groups")');
    const said = toasts.map((t) => t[0]).join(' ');
    check(
      want.test(said) && !/before this release|pre-release|saved before/.test(said),
      `the removal message claims provenance: ${said}`
    );
  }

  // 6. F6: a row whose binding the migration does not change keeps every
  // byte -- the review identity included; a rewritten row respells only the
  // member that changed, in the writer's own spelling and separators.
  const quiet = [
    `[SETUP — reading — token 2 "sing" in ${JSON.stringify(PLAIN)} — S IH1 NG — declared — source: me]`,
    '[SETUP — rhyme groups — 2.end, 4.T5]',
    `\n[VERSE]\n${PLAIN}\n${DOVE}\n${PLAIN}\n${DOVE}`,
  ].join('\n');
  check(
    run('lyMigrateSavedReadings(__t).text', { __t: quiet }) === quiet,
    `an unchanged-binding row changed bytes: ${run('lyMigrateSavedReadings(__t).text', { __t: quiet }).split('\n').slice(0, 2)}`
  );
  draft.value = quiet;
  const id = run('lyIdentity(lyParse(__t))', { __t: quiet });
  check(
    run('lyEnsureTokenScheme()') === false &&
      draft.value === quiet &&
      run('lyIdentity(lyParse(lyDraft().value))') === id,
    'the review identity of an unchanged draft moved'
  );
  check(
    run('lyMigrateSavedReadings(__t).text', {
      __t: `[SETUP — returns — 2.end, 1.T2]\n\n[VERSE]\n${OH}\n${PLAIN}`,
    }).split('\n')[0] === '[SETUP — returns — 2.end, 1.T3 — numbering v2 — cut v2]',
    'a rewritten row respelled a member that did not change'
  );

  // 7. A.2: lines whose cut is identical under both readings and whose end
  // binding still moved, because the earlier end anchor re-cut its own
  // space-joined tokens and joined an enclitic set apart by punctuation.
  const receipt = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'lyric-harness/quality/results/named_place_lookup_2026-10-14/result.json'),
      'utf8'
    )
  );
  const six = [
    "Below the knap, 's a runnèn still;",
    "When in that house M.P.'s divide,",
    '“Also, some few I. O. U.’s and bets,”',
  ];
  for (const line of six) {
    const cuts = run('lyLineCuts(__l, false)', { __l: line });
    check(
      cuts.old.length === cuts.cur.length &&
        cuts.old.every(
          (o, k) =>
            o.text === cuts.cur[k].text &&
            JSON.stringify(o.pieces) === JSON.stringify(cuts.cur[k].pieces)
        ),
      `fixture: the cut of “${line}” is no longer identical`
    );
    check(run('lyLineCutChanged(__l, false)', { __l: line }), `no notice trigger for “${line}”`);
    const got = run('lyMigrateSavedReadings(__t)', {
      __t: `[SETUP — rhyme groups — 1,2]\n\n[VERSE]\n${line}\n${PLAIN}`,
    });
    check(got.carried.length === 1, `“${line}”: the named place was not carried`);
  }
  check(
    receipt.end_changed.filter((x) => x.latin).every((x) => x.lookup_differs),
    'the receipt holds an end-binding change the lookup condition does not explain'
  );
  for (const x of receipt.end_changed.filter((y) => y.latin))
    check(run('lyLineCutChanged(__l, false)', { __l: x.line }), `no trigger for “${x.line}”`);
  // The negative control: every identical-cut line of the English song
  // corpus that the condition does not name stays quiet; the page fires on
  // exactly the receipt's lines and no other.
  const dir = path.join(ROOT, 'lyric-harness/corpus/song');
  const fired = [];
  let identical = 0;
  for (const f of fs
    .readdirSync(dir)
    .filter((x) => /^eng_.*\.txt$/.test(x))
    .sort())
    for (const raw of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      const l = raw.trim();
      if (!l || l.startsWith('#') || l.startsWith('---') || l.startsWith('[')) continue;
      const cuts = run('lyLineCuts(__l, false)', { __l: l });
      if (
        !cuts.old ||
        cuts.old.length !== cuts.cur.length ||
        cuts.old.some(
          (o, k) =>
            o.text !== cuts.cur[k].text ||
            JSON.stringify(o.pieces) !== JSON.stringify(cuts.cur[k].pieces)
        )
      )
        continue;
      identical++;
      if (run('lyLineCutChanged(__l, false)', { __l: l })) fired.push(`${f}\t${l}`);
    }
  const want = receipt.lookup_differs.map((x) => `${x.file}\t${x.line}`);
  check(
    identical === receipt.population.identical_cut &&
      JSON.stringify(fired) === JSON.stringify(want),
    `identical-cut population ${identical} (receipt ${receipt.population.identical_cut}); fired ${fired.length} (receipt ${want.length}): ${JSON.stringify(fired.filter((x) => !want.includes(x)).slice(0, 5))}`
  );
}

// ── H. headers and the document's identity, unit-level ────────────────────
// Every rhythm shape the page writes reads back as the same declaration; a
// review, a certification and a suggestion answer for the whole document —
// headers, section boundaries, setup rows (duplicates kept) and voices — and
// nothing a display preference or a run stamp changes.
function unitHeadersAndIdentity() {
  stage = 'H. headers and identity';
  const src = fs.readFileSync(UNIT_SOURCE, 'utf8');
  const draft = { value: '' };
  const ctx = vm.createContext({
    console,
    $ui: (id) => (id === 'lyrics-draft' ? draft : null),
    uiRegisterPage: () => {},
    uiCount: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`,
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {},
  });
  // The page reads the shared reader the build bundles ahead of it.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/lyric-tokens.js'), 'utf8'), ctx);
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
    if (flags['browser-filter'] && !name.includes(flags['browser-filter'])) return;
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
    // D5: pressing a dock or line-bar button blurs the editor, whose blur
    // pushes history and re-places the bar between pointerdown and pointerup.
    // A button rebuilt there never gets its click: the first press after
    // typing did nothing (Jony's Lyrics #5). One real mouse click each, and
    // the action has to have run.
    await step('D5. first dock click after typing', async () => {
      const TARGETS = {
        'inline Rhyme': ['#ly-linebar:not([hidden]) [data-id="rhymes:1"]', 'rhyme'],
        'dock Rhyme': ['#ly-linedock [data-id="rhymes:1"]', 'rhyme'],
        'Line actions': ['#ly-linedock [aria-controls="ly-menu-line-actions"]', 'menu'],
        Relations: ['#ly-linedock [data-ui="ly-relations"]', 'relations'],
      };
      const ran = {
        rhyme: () => LY.picks.linkLine === 1,
        menu: () => !$ui('ly-menu-line-actions')?.hidden,
        relations: () => !!lyInspectionSession()?.listOpen,
      };
      const seen = new Set();
      for (const [width, height] of [
        [390, 844],
        [1280, 900],
      ]) {
        for (const [label, [selector, effect]] of Object.entries(TARGETS)) {
          for (const typing of label === 'inline Rhyme' ? [true, false] : [true]) {
            const { ctx, page } = await boot({ theme: 'light' });
            await page.setViewportSize({ width, height });
            await setDraft(page, DRAFT);
            await page.evaluate(() => (LY.picks.linkLine = 0));
            const text = await page.locator('#ly-overlay .ly-r[data-n="1"] .ly-t').boundingBox();
            await page.mouse.click(text.x + text.width - 2, text.y + text.height / 2);
            await page.waitForFunction(() => LY.activeLine === 1, null, { timeout: 5000 });
            if (typing) await page.keyboard.type(' now');
            await page.waitForTimeout(300);
            const button = page.locator(selector);
            if (!(await button.count()) || !(await button.first().isVisible())) {
              await ctx.close();
              continue;
            }
            seen.add(`${width} ${label}`);
            const box = await button.first().boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await page.waitForTimeout(200);
            check(
              await page.evaluate(ran[effect]),
              `${width}px: the first click on ${label}${typing ? ' after typing' : ''} did nothing`
            );
            await ctx.close();
          }
        }
      }
      for (const want of ['390 Line actions', '390 Relations', '1280 Relations'])
        check(seen.has(want), `${want} was not on screen to click`);
      check(
        seen.has('1280 inline Rhyme') || seen.has('1280 dock Rhyme'),
        'no Rhyme button was on screen at 1280'
      );
    });

    // H1: reduced CSS viewports are layout probes, not browser zoom.
    await step('H1. short viewport reachability', async () => {
      const results = [];
      for (const [width, height] of [
        [590, 378],
        [720, 450],
        [1180, 757],
        [390, 844],
      ]) {
        const { ctx, page, q } = await boot({ theme: 'light' });
        await page.setViewportSize({ width, height });
        await setDraft(page, DRAFT);
        await page.waitForTimeout(100);
        const geometry = async () =>
          page.evaluate(() => {
            const rect = (el) => {
              const r = el.getBoundingClientRect();
              return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
            };
            const body = $ui('ly-body'),
              draft = $ui('lyrics-draft');
            const rows = [...document.querySelectorAll('#ly-overlay .ly-r-sung .ly-t')];
            const hits = rows.map((row, i) => {
              const r = row.getBoundingClientRect(),
                x = r.x + 10,
                y = r.y + Math.min(12, r.height / 2);
              const hit = document.elementFromPoint(x, y);
              return {
                line: i + 1,
                x,
                y,
                hit: hit?.id || hit?.className || '',
                reachable: hit === draft,
              };
            });
            return {
              body: rect(body),
              nav: rect($ui('ly-mnav')),
              draft: rect(draft),
              bodyScroll: body.scrollTop,
              bodyScrollHeight: body.scrollHeight,
              active: document.activeElement?.id,
              visibleRows: hits.filter((r) => r.reachable),
              firstRow: hits[0],
              lastRow: hits[hits.length - 1],
              viewport: {
                width: innerWidth,
                height: innerHeight,
                dpr: devicePixelRatio,
                scale: visualViewport.scale,
              },
            };
          });
        const initial = await geometry();
        await page.screenshot({ path: `/tmp/ui-eight-evidence/h1/before-${width}x${height}.png` });
        if (height <= 450) {
          await page.mouse.move(width / 2, 200);
          await page.mouse.wheel(0, 750);
          await page.waitForTimeout(100);
          check(
            (await geometry()).visibleRows.length > 0,
            `H1 wheel cannot reach lyrics at ${width}x${height}`
          );
        }
        await page.locator('#lyrics-draft').focus();
        await page.keyboard.press('Control+End');
        const focused = await geometry();
        await page.evaluate(() => {
          const body = $ui('ly-body');
          body.scrollTop = body.scrollHeight;
        });
        const scrolled = await geometry();
        await page.screenshot({
          path: `/tmp/ui-eight-evidence/h1/scrolled-${width}x${height}.png`,
        });
        const reachable = await page.evaluate(() => {
          const draft = $ui('lyrics-draft');
          return [...document.querySelectorAll('#ly-overlay .ly-r-sung .ly-t')].map((row, i) => {
            row.scrollIntoView({ block: 'center' });
            const r = row.getBoundingClientRect(),
              x = r.x + 10,
              y = r.y + 12;
            return { line: i + 1, x, y, hit: document.elementFromPoint(x, y) === draft };
          });
        });
        check(
          reachable.every((r) => r.hit),
          `H1 unreachable rows at ${width}x${height}: ` +
            JSON.stringify(reachable.filter((r) => !r.hit))
        );
        const last = reachable[reachable.length - 1];
        if (last.hit) {
          await page.mouse.click(last.x, last.y);
          check(
            await page.evaluate(
              () =>
                document.activeElement === $ui('lyrics-draft') &&
                $ui('lyrics-draft').selectionStart >= $ui('lyrics-draft').value.lastIndexOf('\n')
            ),
            `H1 last lyric cannot receive the caret at ${width}x${height}`
          );
        }
        check(
          (await page.inputValue('#lyrics-draft')) === DRAFT,
          'H1 navigation changed draft text'
        );
        const review = page.locator('.ly-head [data-ui="ly-tab"][data-id="review"]').first();
        check((await review.count()) === 1, 'H1 header review button missing');
        if (await review.count()) {
          await review.scrollIntoViewIfNeeded();
          check(
            await review.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
            }),
            `H1 header review button unreachable at ${width}x${height}`
          );
        }
        if (width < 960) {
          await page.locator('#ly-mtab-tools').click();
          check(
            await page.evaluate(() => getComputedStyle($ui('ly-main')).display === 'none'),
            `H1 Tools navigation failed at ${width}x${height}`
          );
          await page.locator('#ly-mtab-song').click();
          check(
            await page.evaluate(() => getComputedStyle($ui('ly-main')).display !== 'none'),
            `H1 Song navigation failed at ${width}x${height}`
          );
        }
        await review.focus();
        let tabReached = false;
        for (let n = 0; n < 40; n++) {
          await page.keyboard.press('Tab');
          if (await page.evaluate(() => document.activeElement === $ui('lyrics-draft'))) {
            tabReached = true;
            break;
          }
        }
        check(tabReached, `H1 keyboard Tab cannot reach draft at ${width}x${height}`);
        check(q.calls.length === 0, 'H1 fixture sent chat');
        results.push({ width, height, initial, focused, scrolled, reachable });
        await ctx.close();
      }
      console.log('H1 geometry: ' + JSON.stringify(results));
      const { ctx, page } = await boot();
      const metrics = () =>
        page.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio,
          scale: visualViewport.scale,
        }));
      const before = await metrics();
      await page.keyboard.press('Control++');
      await page.keyboard.press('Control++');
      await page.waitForTimeout(100);
      console.log(
        'H1 native zoom shortcut capability: ' + JSON.stringify({ before, after: await metrics() })
      );
      await ctx.close();
    });

    // ── 0. the shape: one document, fixed tabs and tools, no mode switch ──
    await step(
      'Evidence. Review navigation preserves pending edits and sends nothing',
      async () => {
        const { ctx, page, q } = await boot({ theme: 'light' });
        await setDraft(page, DRAFT);
        const before = await page.evaluate(() => {
          lyDraftSet('rhythm', '0', 'bars', '9');
          LY.tool = '';
          LY_ACTIONS['ly-tab']('tools');
          lyRefresh(true);
          return { draft: $ui('lyrics-draft').value, pending: JSON.stringify(lyMeta().drafts) };
        });
        const callout = page.locator(
          '#ly-panel-tools .ly-callout [data-ui="ly-tab"][data-id="review"]'
        );
        check((await callout.count()) === 1, 'Tools has no explicit Review navigation action');
        await callout.click();
        const after = await page.evaluate(() => ({
          draft: $ui('lyrics-draft').value,
          pending: JSON.stringify(lyMeta().drafts),
          actions: $ui('ly-panel-review').querySelectorAll('[data-ui="ly-run-review"]').length,
          toolSends: $ui('ly-panel-tools').querySelectorAll('[data-ui="ly-run-review"]').length,
        }));
        check(
          after.draft === before.draft && after.pending === before.pending,
          'opening Review changed pending or committed work'
        );
        check(
          after.actions === 1 && after.toolSends === 0,
          'Review action is missing or Tools still sends'
        );
        check(q.calls.length === 0, 'opening Review sent a request');
        const unknown = await page.evaluate(() => {
          chatState.task = { domain: 'lyrics', phase: 'edit' };
          chatState.pending = { request_id: 'fixture-unknown-outcome' };
          chatState.busy = false;
          lyRefresh(true);
          return {
            reviewDisabled: $ui('ly-panel-review').querySelector('[data-ui="ly-run-review"]')
              .disabled,
            retrieve: $ui('ly-panel-review').querySelectorAll('[data-ui="ly-retrieve"]').length,
            options: globalThis.lyToolRequestAction('ly-rhyme-options', 'Options', 'pencil'),
          };
        });
        check(
          unknown.reviewDisabled && unknown.retrieve === 1,
          'unknown outcome did not make Review retrieval primary'
        );
        check(
          /ly-retrieve/.test(unknown.options) && !/ly-rhyme-options/.test(unknown.options),
          'unknown outcome still advertises a new tool request'
        );
        check(q.calls.length === 0, 'rendering unknown recovery dispatched a request');
        await ctx.close();
      }
    );

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
          s.head[1] === 'Review' &&
          s.head[2] === 'Song actions' &&
          s.head.length === 3,
        `header actions are ${JSON.stringify(s.head)}`
      );
      check(s.primary.length === 0, `header primaries: ${JSON.stringify(s.primary)}`);
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

    // ── 2. A line's finding reaches a screen reader ──────────────────────
    // The editor's line marks are aria-hidden: the dock label carries the
    // count, and Show in draft says why focus moved, in a region that
    // exists before its first message.
    await step('2. line finding announced', async () => {
      const { ctx, page, q } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT);
      check(
        await page.evaluate(() => $ui('ly-live')?.getAttribute('role') === 'status'),
        'the Lyrics live region does not exist before its first message'
      );
      await sendReview(page, q, unfinished());
      const n = await page.evaluate(
        () => LY.items.find((i) => !i.stale && i.lines?.length)?.lines[0]
      );
      check(!!n, 'no current finding names a line');
      await page.evaluate((line) => LY_ACTIONS['ly-show-lines'](line), n);
      await page
        .waitForFunction(() => $ui('ly-live').textContent !== '', null, {
          timeout: 2000,
        })
        .catch(() => {});
      const got = await page.evaluate(() => ({
        live: $ui('ly-live').textContent,
        dock: $ui('ly-linedock').getAttribute('aria-label') || '',
        label: $ui('ly-linedock').querySelector('.ly-dock-label')?.textContent || '',
        focus: document.activeElement?.id,
      }));
      check(
        got.live.startsWith(`Line ${n}: `) && got.live.length > `Line ${n}: `.length,
        `Show in draft does not say why focus moved: ${JSON.stringify(got)}`
      );
      check(
        new RegExp(`^Line ${n} actions, \\d+ findings?: .+`).test(got.dock) &&
          / · \d+ findings?$/.test(got.label),
        `the line dock does not name the line's finding: ${JSON.stringify(got)}`
      );
      await ctx.close();
    });
    // ── 6. Tool actions keep focus; a tool opens where its heading is ────
    // Each control is pressed with a real Enter. A re-render must not drop
    // focus to <body>: it returns to the pressed control. Opening a tool
    // focuses its heading where it renders, and Back returns to that tool's
    // row. (Section move, duplicate and remove place focus themselves and
    // are checked on the branch that owns them.)
    await step('6. tool focus', async () => {
      const { ctx, page } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT);
      await page.evaluate(() => LY_ACTIONS['ly-tab']('tools'));
      const where = () =>
        page.evaluate(() => {
          const a = document.activeElement;
          return {
            tag: a?.tagName,
            ui: a?.dataset?.ui || '',
            id: a?.dataset?.id ?? null,
            text: (a?.textContent || '').trim().slice(0, 40),
            main: !!a?.closest('#ly-tool-main'),
          };
        });
      const press = async (selector) => {
        await page.locator(selector).first().focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        return where();
      };
      let w = await press('#surface-lyrics .ly-toolrow[data-id="rhythm"]');
      check(
        w.tag === 'H3' && w.main && /Rhythm/.test(w.text),
        `opening Rhythm does not focus its heading in the centre: ${JSON.stringify(w)}`
      );
      w = await press('[data-ui="ly-rhythm-copy"]');
      check(w.ui === 'ly-rhythm-copy', `Copy to other sections drops focus: ${JSON.stringify(w)}`);
      await page.locator('#ly-r-meter').fill('3/4');
      w = await press('[data-ui="ly-rhythm-save"]');
      check(w.ui === 'ly-rhythm-save', `Save rhythm drops focus: ${JSON.stringify(w)}`);
      w = await press('#surface-lyrics .ly-tool-nav [data-ui="ly-tool"]');
      check(
        w.ui === 'ly-tool' && w.id === 'rhythm',
        `Back to tools does not return to the Rhythm row: ${JSON.stringify(w)}`
      );
      await page.evaluate(() => LY_ACTIONS['ly-tool']('rhymes'));
      w = await press('[data-ui="ly-relation"][aria-pressed="false"]');
      check(w.ui === 'ly-relation', `a rhyme filter drops focus: ${JSON.stringify(w)}`);
      await page.evaluate(() => LY_ACTIONS['ly-line-tool']('pronunciation:3'));
      w = await press('[data-ui="ly-reading-pick"]:not([aria-pressed="true"])');
      check(
        w.ui === 'ly-reading-pick',
        `a pronunciation word chip drops focus: ${JSON.stringify(w)}`
      );
      await page.evaluate(() => LY_ACTIONS['ly-tool']('repeats-voices'));
      w = await press('[data-ui="ly-voices"][data-id="sung"]');
      check(w.ui === 'ly-voices', `Sung second voice drops focus: ${JSON.stringify(w)}`);
      await page.evaluate(() => LY_ACTIONS['ly-tool']('form-story'));
      const names = await page.evaluate(() => ({
        tables: [...document.querySelectorAll('#surface-lyrics table')].map((t) =>
          t.getAttribute('aria-label')
        ),
      }));
      check(
        names.tables.length > 0 && names.tables.every(Boolean),
        `a Lyrics tool table has no name: ${JSON.stringify(names)}`
      );
      await page.evaluate(() => LY_ACTIONS['ly-tool']('word-rules'));
      check(
        (await page.getByLabel('Add an avoided phrase', { exact: true }).count()) === 1,
        'the Word rules avoid field is not labelled "Add an avoided phrase"'
      );
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

    await step('J12. named-action message limit', async () => {
      const { ctx, page, q } = await boot();
      await setDraft(page, DRAFT);
      const proposal = '[VERSE]\n' + 'A long proposed line '.repeat(300) + '\nA second line';
      await sendReview(
        page,
        q,
        {
          ...unfinished(),
          artifact: {
            text: proposal,
            final_draft: proposal.split('\n').slice(1),
            status: 'unfinished',
          },
        },
        () => edit(page, 'The rain has blurred', 'The rain had blurred')
      );
      await pane(page, 'review');
      const snapshot = () =>
        page.evaluate(() =>
          JSON.stringify({
            generation: chatState.generation,
            history: chatState.history,
            sig: chatState.sig,
            archives: chatState.archives,
            task: chatState.task,
            lyric: chatState.lyric,
            request: UI.lyricRequest,
            run: LY.run?.id,
            text: $ui('lyrics-draft').value,
          })
        );
      const before = await snapshot();
      // Local fixture reproduces the server's existing inclusive message ceiling.
      await ctx.route(/mcp\.codexmusica\.com\/chat$/, async (route) => {
        const body = JSON.parse(route.request().postData());
        q.calls.push(body);
        const over = body.message.trim().length > 5000;
        await route.fulfill({
          status: over ? 400 : 200,
          contentType: 'application/json',
          body: JSON.stringify(
            over
              ? { error: 'Keep it under 5000 characters.' }
              : {
                  reply: 'Fixture accepted.',
                  history: [],
                  sig: 'fixture',
                  task: { domain: 'lyrics', phase: 'edit' },
                }
          ),
        });
      });
      await page.locator('#ly-panel-review [data-ui="ly-recheck"]').click();
      await page.waitForFunction(() => !chatState.busy);
      const toast = await page.locator('#toast').innerText();
      check(q.calls.length === 1, 'over-limit Recheck sent a request');
      check(
        /5000-character message limit/.test(toast) &&
          /shorter instruction/.test(toast) &&
          /Edit this draft/.test(toast),
        `J12 missing actionable length feedback: ${toast}`
      );
      check(
        (await snapshot()) === before,
        'over-limit Recheck reset the conversation or changed the draft'
      );
      const boundary = async (length) =>
        page.evaluate(async (size) => {
          const prefix = LY_ACTION_TEXT['recheck-whole']({ proposal: '' });
          return lySubmitLyricsAction('recheck-whole', {
            proposal: 'x'.repeat(size - prefix.length),
          });
        }, length);
      check(
        (await boundary(5001)) === false && q.calls.length === 1,
        '5001-character action was not refused locally'
      );
      check(
        (await boundary(5000)) === true && q.calls.at(-1)?.message.length === 5000,
        'exactly 5000 characters were not accepted'
      );
      await setDraft(page, proposal);
      await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
      check(
        (await page.inputValue('#chat-input')) === 'Edit this draft: ',
        'Edit this draft copied the long document into the message'
      );
      await page.fill('#chat-input', 'Edit this draft: smooth the wording.');
      await page.locator('#chat-send').click();
      await page.waitForFunction(() => !chatState.busy);
      const sent = q.calls.at(-1);
      check(
        sent.message.length < 5000 && sent.lyric_context.document.length > 5000,
        'long Edit draft did not travel separately in structured context'
      );
      check(q.calls.length === 3, `unexpected fixture request count: ${q.calls.length}`);
      await ctx.close();
    });

    // J3: whole-draft suggestions must recheck against today's committed context.
    await step('J3. whole-draft recheck', async () => {
      const { ctx, page, q } = await boot();
      await setDraft(page, DRAFT);
      const proposal = '[VERSE]\nA different first line\nA different second line';
      await sendReview(
        page,
        q,
        {
          ...unfinished(),
          artifact: {
            text: proposal,
            final_draft: proposal.split('\n').slice(1),
            status: 'unfinished',
          },
        },
        () => edit(page, 'The rain has blurred', 'The rain had blurred')
      );
      await pane(page, 'review');
      const before = await page.inputValue('#lyrics-draft');
      check(
        (await page.locator('#ly-panel-review [data-ui="ly-recheck"]').count()) === 1,
        'no Recheck action for the stale whole-draft suggestion'
      );
      const recheckId = await page
        .locator('#ly-panel-review [data-ui="ly-recheck"]')
        .getAttribute('data-id');
      await page.evaluate(async (id) => {
        chatState.busy = true;
        await LY_ACTIONS['ly-recheck'](id);
        chatState.busy = false;
      }, recheckId);
      check(
        q.calls.length === 1 &&
          !(await page.locator('#toast').innerText()).includes('Recheck reply'),
        'blocked Recheck claimed a reply or sent a request'
      );
      q.replies.push({ error: 'Fixture: request rejected.' });
      await page.evaluate((id) => LY_ACTIONS['ly-recheck'](id), recheckId);
      check(
        q.calls.length === 2 &&
          !(await page.locator('#toast').innerText()).includes('Recheck reply'),
        'rejected Recheck claimed a reply'
      );
      q.replies.push({
        reply: 'Fixture: replacement checked, no draft returned.',
        history: [],
        sig: 'rechecked',
        task: { domain: 'lyrics', phase: 'edit' },
      });
      await page.evaluate(async () => {
        const button = document.querySelector('#ly-panel-review [data-ui="ly-recheck"]');
        await LY_ACTIONS['ly-recheck'](button.dataset.id);
      });
      await page.waitForFunction(() => !chatState.busy);
      check(q.calls.length === 3, 'whole-draft Recheck sent no request');
      check(
        (await page.locator('#toast.show').innerText()) === 'Recheck reply is in Writer.',
        'successful whole-draft Recheck did not name Writer in visible feedback'
      );
      const request = q.calls[2];
      check(
        request?.task?.domain === 'lyrics' &&
          request?.task?.phase === 'edit' &&
          request?.message.includes(proposal),
        'whole-draft Recheck lost the proposal or edit phase'
      );
      check(
        request?.lyric_context?.document.includes('The rain had blurred') &&
          !request?.lyric_context?.document.includes('[SETUP') &&
          !!request?.lyric_context?.declarations &&
          !!request?.lyric_context?.binding,
        'whole-draft Recheck did not carry current committed context and declarations'
      );
      check(
        (await page.inputValue('#lyrics-draft')) === before,
        'whole-draft Recheck changed the document without a returned draft'
      );
      await ctx.close();
    });

    await step('J11. new song clears the previous composer prefill', async () => {
      const { ctx, page, q } = await boot();
      await setDraft(page, DRAFT);
      const choose = async (action) => {
        await page.locator('[data-ui="ly-menu"][data-id="song-actions"]').click();
        await page.locator(`#ly-menu-song-actions [data-ui="${action}"]`).click();
      };
      await choose('edit-lyrics');
      check(
        (await page.inputValue('#chat-input')) === 'Edit this draft: ',
        'Edit this draft lost its explicit prefill'
      );
      await choose('new-lyrics');
      check(
        (await page.inputValue('#chat-input')) === '',
        'New song retained the previous Edit this draft prefill'
      );
      check(
        (await page.inputValue('#chat-domain')) === 'lyrics',
        'New song did not select the new-song phase'
      );
      await choose('attach-recipe');
      check(
        (await page.inputValue('#chat-input')).startsWith(
          'Write lyrics for this recording recipe:\n'
        ),
        'Use current recipe lost its explicit prefill'
      );
      await choose('new-lyrics');
      check(
        (await page.inputValue('#chat-input')) === '',
        'New song retained the previous recipe prefill'
      );
      check(
        (await page.inputValue('#lyrics-draft')) === DRAFT && q.calls.length === 0,
        'changing conversation prefills changed the lyrics or sent a request'
      );
      await ctx.close();
    });

    // J2: the explicit conversation choice must work, without bypassing recovery.
    await step('J2. unforced edit conversation keeps its phase', async () => {
      const { ctx, page, q } = await boot();
      await setDraft(page, DRAFT);
      await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
      check(
        await page.evaluate(() => !LY.conflict && $ui('chat-domain').value === 'lyrics-edit'),
        'unforced Edit this draft opened in the new-song phase'
      );
      check(q.calls.length === 0, 'opening the edit conversation sent a request');
      await ctx.close();
    });
    await step('J2. independent conversation', async () => {
      const { ctx, page, q } = await boot();
      await setDraft(page, DRAFT);
      await sendReview(page, q, waiting());
      await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
      await page.locator('[data-ui="ly-conflict-new"]').click();
      const state = await page.evaluate(() => ({
        conflict: LY.conflict,
        waiting: !!chatState.lyric?.state,
        archives: chatState.archives.length,
        choice: $ui('chat-domain').value,
        input: $ui('chat-input').value,
        text: $ui('lyrics-draft').value,
      }));
      check(
        !state.conflict && !state.waiting,
        'explicit independent conversation reopened the warning'
      );
      check(state.archives === 1, 'independent conversation did not archive the waiting run');
      check(
        state.choice === 'lyrics-edit' && state.input === 'Edit this draft: ',
        'independent conversation lost its phase or prefill'
      );
      check(
        state.text === DRAFT && q.calls.length === 1,
        'opening an independent conversation changed lyrics or sent a request'
      );
      await ctx.close();
    });
    await step('J2. new work from interrupted parked run', async () => {
      const { ctx, page, q } = await boot();
      await setDraft(page, DRAFT);
      await sendReview(page, q, waiting());
      await page.evaluate(() => {
        chatState.lyric = { parked: true, open: [3] };
        chatState.disconnected = 'fixture-disconnection';
        lyRefresh(true);
        LY_ACTIONS['ly-tab']('writer');
      });
      await page.locator('[data-ui="ly-new-work"]').click();
      check(
        await page.evaluate(
          () =>
            !LY.conflict &&
            !chatState.lyric &&
            chatState.archives.length === 1 &&
            $ui('chat-domain').value === 'lyrics-edit' &&
            $ui('chat-input').value === 'Continue from the current draft: '
        ),
        'Start new work looped instead of opening an independent edit conversation'
      );
      check(
        q.calls.length === 1 && (await page.inputValue('#lyrics-draft')) === DRAFT,
        'Start new work sent a request or changed the draft'
      );
      await ctx.close();
    });
    await step('J2. forced conversation keeps unknown and busy guards', async () => {
      const { ctx, page, q } = await boot();
      await setDraft(page, DRAFT);
      const state = await page.evaluate(async () => {
        $ui('chat-input').value = 'Keep this unsent request';
        chatState.task = { domain: 'lyrics' };
        chatState.pending = { request_id: 'fixture-unknown', domain: 'lyrics' };
        const unknown = await lyStartConversation('lyrics', '', { force: true });
        const kept = chatState.pending?.request_id;
        chatState.busy = true;
        const busy = await lyStartConversation('lyrics', '', { force: true });
        chatState.busy = false;
        return {
          unknown,
          busy,
          kept,
          pending: chatState.pending?.request_id,
          archives: chatState.archives.length,
          input: $ui('chat-input').value,
        };
      });
      check(
        state.unknown === false &&
          state.busy === false &&
          state.kept === 'fixture-unknown' &&
          state.pending === 'fixture-unknown' &&
          state.archives === 0 &&
          state.input === 'Keep this unsent request',
        'force bypassed the unknown-outcome or busy guard'
      );
      check(q.calls.length === 0, 'blocked conversation sent a request');
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
    // ── 3. the review flow by keyboard: focus never falls to the page ────
    // Each step is pressed with Enter on the real control; during the
    // request and after the reply focus stays on something the person can
    // act on, and a writer's question lands on its answer field.
    const focusAt = (page) =>
      page.evaluate(() => {
        const a = document.activeElement;
        return {
          tag: a?.tagName,
          ui: a?.dataset?.ui || '',
          id: a?.id || '',
          text: (a?.getAttribute('aria-label') || a?.innerText || '').trim().slice(0, 40),
        };
      });
    const press = async (page, sel) => {
      await page.locator(sel).first().focus();
      await page.keyboard.press('Enter');
    };
    await step('3. review flow focus', async () => {
      const { ctx, page, q } = await boot();
      await setDraft(page, DRAFT);
      await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
      q.delay = 1200;
      q.replies.push(waiting());
      await press(page, '#ly-panel-review [data-ui="ly-run-review"]');
      await page.waitForFunction(() => chatState.busy);
      await page.waitForTimeout(200);
      const during = await focusAt(page);
      check(
        during.tag !== 'BODY',
        `Run review drops focus while the request runs: ${JSON.stringify(during)}`
      );
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      await page.waitForTimeout(400);
      const asked = await page.evaluate(() => {
        const a = document.activeElement;
        const ids = (a?.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        return {
          id: a?.id || a?.tagName,
          desc: ids.map((x) => document.getElementById(x)?.textContent || '').join(' '),
        };
      });
      check(
        asked.id === 'ly-answer-3' && /which word should end it/.test(asked.desc),
        `a writer question does not land on its answer field, described by the question: ${JSON.stringify(asked)}`
      );
      // (Shown either way, so the rest of the flow is checked on its own.)
      await page.evaluate(() => {
        if (!$ui('ly-answer-3')?.getClientRects().length) LY_ACTIONS['ly-tab']('writer');
      });
      q.replies.push(unfinished());
      await page.fill('#ly-answer-3', 'I keep one foot upon the chair');
      await press(page, '[data-ui="ly-answer"]');
      await page.waitForFunction(() => chatState.busy);
      await page.waitForTimeout(200);
      const sending = await focusAt(page);
      check(
        sending.tag !== 'BODY',
        `Submit answer drops focus while the request runs: ${JSON.stringify(sending)}`
      );
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      await page.waitForTimeout(400);
      const answered = await focusAt(page);
      check(
        answered.tag !== 'BODY',
        `Submit answer drops focus after the reply: ${JSON.stringify(answered)}`
      );
      q.replies.push(certified());
      await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
      await press(page, '#ly-panel-review [data-ui="ly-run-review"]');
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      await page.waitForTimeout(400);
      const reviewed = await focusAt(page);
      check(
        reviewed.tag !== 'BODY',
        `Run review drops focus after the reply: ${JSON.stringify(reviewed)}`
      );
      await ctx.close();
    });
    await step('3. stale suggestion focus', async () => {
      for (const action of ['ly-keep', 'ly-recheck']) {
        const { ctx, page, q } = await boot();
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
        await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
        q.replies.push({
          reply: 'Fixture: rechecked.',
          history: [],
          sig: 'rechecked',
          task: { domain: 'lyrics', phase: 'edit' },
        });
        await press(page, `#ly-panel-review [data-ui="${action}"]`);
        await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
        await page.waitForTimeout(400);
        const after = await focusAt(page);
        check(
          after.tag !== 'BODY',
          `${action === 'ly-keep' ? 'Keep mine' : 'Recheck suggestion'} drops focus: ${JSON.stringify(after)}`
        );
        await ctx.close();
      }
    });
    // ── 3. a stopped or asking run reads in words, not codes ──────────────
    await step('3. plain words', async () => {
      const { ctx, page, q } = await boot();
      await setDraft(page, DRAFT);
      const read = () =>
        page.evaluate(() => {
          const reply = [...document.querySelectorAll('#chat-log .chat-msg-engine')].pop();
          const titles = [...document.querySelectorAll('#ly-panel-review .ly-item strong')].map(
            (n) => n.textContent
          );
          return {
            verdict: reply?.querySelector('.chat-recipe-foot')?.textContent || '',
            note: reply?.querySelector('.chat-msg-note')?.textContent || '',
            chips: reply?.querySelector('.chat-tools')?.getAttribute('aria-hidden') || '',
            said: reply?.querySelector('.chat-count-sr')?.textContent || '',
            titles,
          };
        });
      await sendReview(page, q, unfinished());
      await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
      const stopped = await read();
      check(
        stopped.verdict === 'Unfinished · not certified',
        `the verdict repeats its word or shows a code: ${JSON.stringify(stopped.verdict)}`
      );
      check(
        !/LYRICS_UNFINISHED/.test(stopped.note) && /stopped before finishing/.test(stopped.note),
        `the stop note reads a raw code: ${JSON.stringify(stopped.note)}`
      );
      check(
        stopped.titles.some((t) => /stopped before finishing/.test(t)) &&
          !stopped.titles.some((t) => /LYRICS_UNFINISHED/.test(t)),
        `a review title reads a raw stop code: ${JSON.stringify(stopped.titles)}`
      );
      check(
        stopped.chips === 'true' &&
          /a check found an open problem/.test(stopped.said) &&
          !/exit|lyric_/.test(stopped.said),
        `the tool line is read as codes: ${JSON.stringify(stopped)}`
      );
      await sendReview(page, q, waiting());
      const asking = await read();
      check(
        /the writer asked a question/.test(asking.said) && !/exit|lyric_/.test(asking.said),
        `a waiting revise is read as codes: ${JSON.stringify(asking.said)}`
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
    await step('5j. placed-return inline validation (J5)', async () => {
      const { ctx, page, q } = await boot({ theme: 'light' });
      await setDraft(page, '[VERSE]\nLove stays here\nLove comes home');
      await page.evaluate(() => {
        LY.activeLine = 1;
        LY_ACTIONS['ly-tool']('repeats-voices');
      });
      await page.getByText('Placed returns', { exact: true }).click();
      await page.click('[data-ui="ly-placed-add"]');
      const before = await page.evaluate(() => ({
        text: $ui('lyrics-draft').value,
        history: app.history.length,
      }));
      await page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
      const failed = await page.evaluate(() => {
        const field = $ui('ly-placed-place');
        const error = document.getElementById(field.getAttribute('aria-describedby'));
        return {
          invalid: field.getAttribute('aria-invalid'),
          error: error?.textContent,
          visible:
            !!error?.getClientRects().length &&
            error.getBoundingClientRect().bottom <=
              $ui('ly-pending-repeats-voices').getBoundingClientRect().top,
          focused: document.activeElement === field,
          text: $ui('lyrics-draft').value,
          history: app.history.length,
          pending: lyDrafts('repeats-voices').length,
        };
      });
      console.log('J5 invalid placed return:', JSON.stringify(failed));
      check(
        failed.invalid === 'true' &&
          failed.error === 'A placed return needs at least two members.' &&
          failed.visible,
        'placed-return refusal has no visible inline error associated with its invalid field'
      );
      check(failed.focused, 'placed-return refusal did not focus its invalid field');
      check(
        failed.text === before.text && failed.history === before.history && failed.pending === 1,
        'invalid placed return committed text/history or lost the pending entry'
      );
      await shot(page, 'j5-placed-return-invalid');
      // A second member repairs the same pending entry; no policy changes.
      await page.evaluate(() => {
        LY.activeLine = 2;
        lyRefresh(true);
      });
      await page.click('[data-ui="ly-placed-add"]');
      check(
        (await page.locator('#ly-err-placed').count()) === 0 &&
          (await page.locator('#ly-placed-place[aria-invalid="true"]').count()) === 0,
        'editing the placed-return members left a stale inline error'
      );
      await page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
      const saved = await page.evaluate(() => ({
        returns: lyDeclarationsOf(LY.model).returns,
        pending: lyDrafts('repeats-voices').length,
        history: app.history.length,
      }));
      check(
        saved.returns === '1.head,2.head' &&
          saved.pending === 0 &&
          saved.history === before.history + 1,
        'corrected placed return did not commit once and clear its pending entry'
      );
      check(q.calls.length === 0, 'local placed-return validation contacted the writer');
      await ctx.close();
    });

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
      const callsWhileBusy = q.calls.length;
      await page.locator('.ly-head [data-ui="ly-tab"][data-id="review"]').click();
      check(
        await page.evaluate(() => LY.tab === 'review'),
        'header Review did not navigate while the writer works'
      );
      check(q.calls.length === callsWhileBusy, 'header Review sent a second request');
      check(
        (await page.locator('#ly-panel-review [data-ui="ly-run-review"]:enabled').count()) === 0,
        'Review offers an enabled send while the writer works'
      );
      const refusedWhileBusy = await page.evaluate(() => LY_ACTIONS['ly-run-review']());
      check(
        refusedWhileBusy === false && q.calls.length === callsWhileBusy,
        'Run review did not refuse a second request while the writer works'
      );
      await page.evaluate(() => LY_ACTIONS['ly-tab']('writer'));
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

    await step('J1 stale pager', async () => {
      const { ctx, page, q } = await boot({ theme: 'light', phone: true });
      const draft = [
        '[VERSE 1]',
        ...Array.from({ length: 8 }, (_, i) => 'Verse lyric ' + (i + 1)),
        '[CHORUS]',
        ...Array.from({ length: 9 }, (_, i) => 'Chorus lyric ' + (i + 1)),
      ].join('\n');
      await setDraft(page, draft);
      await page.evaluate(() => lyScrollToLine(1));
      await page.evaluate(() => lyRefresh(true));
      const snapshot = () =>
        page.evaluate(() => ({
          label: $ui('ly-section-nav').innerText.replace(/\s+/g, ' ').trim(),
          active: LY.activeLine,
          section: LY.model.sung[LY.activeLine - 1]?.section.title,
          prev: $ui('ly-section-nav').querySelector('[data-id="-1"]').disabled,
          next: $ui('ly-section-nav').querySelector('[data-id="1"]').disabled,
          rows: document.querySelectorAll('#ly-overlay .ly-r-sung').length,
          text: $ui('lyrics-draft').value,
          selection: [$ui('lyrics-draft').selectionStart, $ui('lyrics-draft').selectionEnd],
          focused: document.activeElement === $ui('lyrics-draft'),
          // R17 #72: the stepper keeps focus (its replacement, or the
          // position button at either end) instead of moving it into the song.
          onPager: $ui('ly-section-nav').contains(document.activeElement),
        }));
      console.log('J1 initial ' + JSON.stringify(await snapshot()));
      await page.locator('#ly-section-nav [data-id="1"]').click();
      await page.waitForTimeout(200);
      const after = await snapshot();
      console.log('J1 after next ' + JSON.stringify(after));
      check(
        after.section === 'Chorus' && after.active === 9,
        'Next must reach Chorus first sung line'
      );
      check(
        /Chorus.*2 of 2/.test(after.label),
        'Next pager must describe Chorus 2 of 2: ' + after.label
      );
      check(!after.prev && after.next, 'At Chorus Previous must enable and Next disable');
      check(
        after.text === draft && after.rows === 17,
        'Section navigation must preserve whole song'
      );
      const chorusEnd = draft.indexOf('Chorus lyric 1') + 'Chorus lyric 1'.length;
      check(
        after.onPager && after.selection[0] === chorusEnd && after.selection[1] === chorusEnd,
        'Next must keep focus on the pager and put the caret at its destination'
      );
      await page.evaluate(() => lyRefresh(true));
      const refreshed = await snapshot();
      console.log('J1 refresh control ' + JSON.stringify(refreshed));
      check(
        /Chorus.*2 of 2/.test(refreshed.label) && !refreshed.prev && refreshed.next,
        'Full refresh control must show correct Chorus pager'
      );
      await page.locator('#ly-section-nav [data-id="-1"]').click();
      await page.waitForTimeout(200);
      const back = await snapshot();
      console.log('J1 after previous ' + JSON.stringify(back));
      check(
        back.section === 'Verse 1' && back.active === 1,
        'Previous must reach Verse first sung line'
      );
      check(
        /Verse 1.*1 of 2/.test(back.label) && back.prev && !back.next,
        'Previous pager must describe Verse 1 of 2 and endpoints'
      );
      check(
        back.onPager && back.selection[0] === 23 && back.selection[1] === 23 && back.text === draft,
        'Previous must keep focus on the pager, put the caret back and leave the draft unchanged'
      );
      await page.evaluate(() => lyRefresh(true));
      const caretOnly = await page.evaluate(() => {
        const d = $ui('lyrics-draft');
        d.focus({ preventScroll: true });
        const nav = $ui('ly-section-nav'),
          position = nav.querySelector('.ly-sec-pos');
        const offset = d.value.indexOf('Chorus lyric 2');
        d.setSelectionRange(offset, offset);
        lySyncCaret();
        return {
          same: position === nav.querySelector('.ly-sec-pos'),
          focused: document.activeElement === d,
          selection: [d.selectionStart, d.selectionEnd],
          offset,
          label: nav.innerText.replace(/\s+/g, ' ').trim(),
        };
      });
      check(
        caretOnly.same &&
          caretOnly.focused &&
          caretOnly.selection.every((n) => n === caretOnly.offset),
        'Caret-only sync must preserve pager nodes, focus and selection'
      );
      check(
        /Chorus.*2 of 2/.test(caretOnly.label),
        'Caret-only section change must synchronize pager'
      );
      check(q.calls.length === 0, 'No writer calls');
      await ctx.close();
    });

    // ── 7. phone: one view at a time, a bottom bar, no sideways scroll ───
    await step('H2. phone Form action names and reachability', async () => {
      const { ctx, page, q } = await boot({ theme: 'light', phone: true });
      const original = '[VERSE]\nFirst line\n\n[CHORUS]\nSecond line';
      await setDraft(page, original);
      await page.evaluate(() => {
        LY_ACTIONS['ly-mobile']('tools');
        LY_ACTIONS['ly-tool']('form-story');
      });
      const row = page.locator('#ly-form-rows tr').first();
      const names = await row.ariaSnapshot();
      console.log('H2 accessible row:', names);
      for (const name of ['Move up', 'Move down', 'Duplicate section', 'Remove'])
        check(
          (await row.getByRole('button', { name, exact: true }).count()) === 1,
          `phone action has no accessible name: ${name}`
        );
      check(
        await row.locator('[data-id="0:-1"]').isDisabled(),
        'first section Move up must be disabled'
      );
      const down = row.locator('[data-id="0:1"]');
      await down.focus();
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      );
      await down.evaluate((button) => {
        const wrap = button.closest('.ly-table-wrap');
        wrap.scrollLeft = wrap.scrollWidth;
      });
      const reach = await down.evaluate((button) => {
        const wrap = button.closest('.ly-table-wrap');
        const r = button.getBoundingClientRect();
        return {
          scrollLeft: wrap.scrollLeft,
          scrollWidth: wrap.scrollWidth,
          clientWidth: wrap.clientWidth,
          x: r.x,
          right: r.right,
          width: r.width,
          height: r.height,
          hit: button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
        };
      });
      console.log('H2 focused action geometry:', JSON.stringify(reach));
      check(
        reach.scrollWidth > reach.clientWidth &&
          reach.scrollLeft > 0 &&
          reach.hit &&
          reach.x >= 0 &&
          reach.right <= 390,
        `table action is not reachable through horizontal scrolling: ${JSON.stringify(reach)}`
      );
      await page.keyboard.press('Enter');
      check(
        (await page.evaluate(() => $ui('lyrics-draft').value)).indexOf('[CHORUS]') === 0,
        'keyboard Move down did not reorder the sections'
      );
      await page.evaluate(() => $ui('btn-undo').click());
      check(
        (await page.evaluate(() => $ui('lyrics-draft').value)) === original,
        'Undo did not restore the moved draft'
      );
      const duplicate = page.locator('#ly-form-rows tr').first().locator('[data-ui="ly-sec-dup"]');
      await duplicate.click();
      check(
        (await page.evaluate(() => LY.model.sections.length)) === 3,
        'pointer Duplicate did not duplicate the section'
      );
      await page.evaluate(() => $ui('btn-undo').click());
      check(
        (await page.evaluate(() => $ui('lyrics-draft').value)) === original,
        'Undo did not restore the duplicated draft'
      );
      check(q.calls.length === 0, 'local Form actions sent a request');
      await ctx.close();
    });

    // N1/N2: Rhythm has three independently applied forms. A failure must
    // not conceal successful commits, and review must account for all three.
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

    // ── R17. Menus expose their state, Tab leaves them, the badge speaks
    // only on change, and ending an inspection keeps focus (Jony #75, #78,
    // #80, #77 Stay/Back). Real keys throughout.
    await step('R17. menus, badge, inspection end', async () => {
      // A control that is not there fails its own check, by name, in seconds.
      const focusOn = async (loc, label) => {
        try {
          await loc.focus({ timeout: 5000 });
        } catch {
          throw new Error(`cannot focus ${label}`);
        }
      };
      const where = (page) =>
        page.evaluate(() => {
          const a = document.activeElement;
          return {
            tag: a?.tagName,
            ui: a?.dataset?.ui || '',
            id: a?.dataset?.id ?? null,
            expanded: a?.getAttribute('aria-expanded'),
            inMenu: !!a?.closest('.ly-menu'),
          };
        });
      {
        const { ctx, page } = await boot({ theme: 'light' });
        await setDraft(page, DRAFT);
        // #75: Display holds a radio group and a checkbox, named without the tick.
        await focusOn(page.locator('[aria-controls="ly-menu-display"]'), 'Display');
        await page.keyboard.press('Enter');
        const menu = page.locator('#ly-menu-display');
        const radios = await menu.getByRole('menuitemradio').count();
        const checkedRadios = await menu.getByRole('menuitemradio', { checked: true }).count();
        const numbers = await menu
          .getByRole('menuitemcheckbox', { name: 'Line numbers', exact: true })
          .count();
        const normal = await menu
          .getByRole('menuitemradio', { name: 'Normal', exact: true })
          .count();
        const pressed = await menu.locator('[aria-pressed]').count();
        check(
          radios === 3 && checkedRadios === 1 && numbers === 1 && normal === 1 && pressed === 0,
          `Display menu state is not exposed as radios and a checkbox named without the tick: ${JSON.stringify({ radios, checkedRadios, numbers, normal, pressed })}`
        );
        const stops = await menu.evaluate(
          (m) => [...m.querySelectorAll('button')].filter((b) => b.tabIndex >= 0).length
        );
        check(stops === 0, `Display menu items are ${stops} separate Tab stops`);
        // #80 (the same handler serves every menu): Tab leaves and closes it.
        await page.keyboard.press('Tab');
        let w = await where(page);
        const hidden = await menu.evaluate((m) => m.hidden);
        check(
          hidden && !w.inMenu && w.tag !== 'BODY',
          `Tab in the Display menu does not close it and move on: ${JSON.stringify({ hidden, ...w })}`
        );
        // #78: refreshes and a typed edit that leaves the state alone do not
        // rewrite the status region.
        const said = await page.evaluate(() => $ui('ly-badge').innerText.trim());
        await page.evaluate(() => {
          globalThis.__badgeWrites = 0;
          new MutationObserver((records) => (globalThis.__badgeWrites += records.length)).observe(
            $ui('ly-badge'),
            { childList: true, subtree: true, characterData: true }
          );
          lyRefresh(true);
          lyRefresh(true);
        });
        await edit(page, 'Leave the Light On', 'Leave the Light On Now');
        await page.waitForTimeout(100);
        const writes = await page.evaluate(() => globalThis.__badgeWrites);
        const after = await page.evaluate(() => $ui('ly-badge').innerText.trim());
        check(
          said && writes === 0 && after === said,
          `the status badge is rewritten without a change (${writes} writes; "${said}" → "${after}")`
        );
        // #77: Stay and Back end the inspection on the dock's Relations button.
        // Leaving the draft redraws the dock (the dock-first-click branch's
        // subject), so focus steps out of the draft before reaching Relations.
        for (const how of ['stay', 'back']) {
          await focusOn(page.locator('[aria-controls="ly-menu-display"]'), 'Display');
          await focusOn(page.locator('[data-ui="ly-relations"]'), 'Relations');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(200);
          await focusOn(
            page.locator(`#ly-relation-inspector [data-ui="ly-relation-${how}"]`),
            `inspector ${how}`
          );
          await page.keyboard.press('Enter');
          await page.waitForTimeout(200);
          w = await where(page);
          check(
            w.ui === 'ly-relations',
            `wide: ${how === 'stay' ? 'Stay here and end inspection' : 'Back to previous panel'} drops focus: ${JSON.stringify(w)}`
          );
        }
        await ctx.close();
      }
      {
        const { ctx, page } = await boot({ theme: 'light', phone: true });
        await setDraft(page, DRAFT);
        await page.locator('#lyrics-draft').click();
        await page.evaluate(() => {
          const d = $ui('lyrics-draft');
          const i = d.value.indexOf('I leave the porch light on');
          d.setSelectionRange(i, i);
          document.dispatchEvent(new Event('selectionchange'));
        });
        await page.waitForTimeout(400);
        const opener = page.locator('#ly-linedock [aria-controls="ly-menu-line-actions"]');
        await focusOn(opener, 'Line actions');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        let w = await where(page);
        check(
          w.inMenu && w.ui === 'ly-line-tool',
          `phone Line actions opens elsewhere: ${JSON.stringify(w)}`
        );
        // #80: Tab leaves the menu and closes it.
        await page.keyboard.press('Tab');
        w = await where(page);
        const hidden = await page.evaluate(() => $ui('ly-menu-line-actions').hidden);
        check(
          hidden && !w.inMenu && w.tag !== 'BODY',
          `phone: Tab in Line actions does not close it and move on: ${JSON.stringify({ hidden, ...w })}`
        );
        // #80: a tool chosen from the menu lands on that tool, not <body>.
        await focusOn(opener, 'Line actions');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        w = await where(page);
        check(
          w.ui === 'ly-tool' && w.id === 'rhymes' && w.expanded === 'true',
          `phone: Rhyme from Line actions drops focus: ${JSON.stringify(w)}`
        );
        // #77: Stay ends the inspection on the dock's Relations button.
        await page.evaluate(() => LY_ACTIONS['ly-mobile']('song'));
        await page.waitForTimeout(200);
        await focusOn(page.locator('[data-ui="ly-relations"]'), 'Relations');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        await focusOn(
          page.locator('#ly-relations-dialog [data-ui="ly-relation-stay"]'),
          'dialog stay'
        );
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        w = await where(page);
        check(
          w.ui === 'ly-relations',
          `phone: Stay here and end inspection drops focus: ${JSON.stringify(w)}`
        );
        await ctx.close();
      }
    });

    // N1/N2: Rhythm has three independently applied forms. A failure must
    // not conceal successful commits, and review must account for all three.
    await step('N1. partial Rhythm Apply', async () => {
      const { ctx, page, q } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT);
      await page.evaluate(() => {
        LY.picks.rhythmSec = 3;
        LY_ACTIONS['ly-tool']('rhythm');
        lyDraftSet('rhythm', '3', 'meter', '6/8');
        lyDraftSet('placement', '3', 'bar.13', '1'); // incomplete row
        for (const [field, value] of Object.entries({
          meter: '4/4',
          groups: '2+2',
          bars: '1',
          events: '440:8',
        }))
          lyDraftSet('melody', 'song', field, value);
        LY_ACTIONS['ly-draft-apply']('rhythm');
      });
      const state = await page.evaluate(() => ({
        text: $ui('lyrics-draft').value,
        pending: ['rhythm', 'placement', 'melody'].map((t) => lyDrafts(t).length),
        error: lyDrafts('placement')[0]?.errors['bar.13'],
        feedback: document.body.innerText,
      }));
      check(state.text.includes('[BRIDGE — 4 lines — 6/8]'), 'valid header was not applied');
      check(state.text.includes('[SETUP — melody'), 'valid later melody was not applied');
      check(!state.text.includes('[SETUP — placement'), 'invalid placement reached the document');
      check(
        state.pending.join() === '0,1,0' && !!state.error,
        'failed placement was not retained with its error'
      );
      check(
        /Some changes were applied/.test(state.feedback) &&
          !/Nothing was applied/.test(state.feedback),
        'partial Apply feedback concealed a successful commit'
      );
      check(
        /Use Undo to reverse applied changes one form at a time\./.test(state.feedback),
        'partial Apply feedback omitted Undo guidance and its per-form scope'
      );
      check(q.calls.length === 0, 'Apply sent a writer request');
      await page.evaluate(() => $ui('btn-undo').click());
      const undone = await page.evaluate(() => $ui('lyrics-draft').value);
      check(
        !undone.includes('[SETUP — melody') && undone.includes('[BRIDGE — 4 lines — 6/8]'),
        'Undo no longer reverses one form commit at a time'
      );
      await page.evaluate(() => $ui('btn-undo').click());
      check(
        (await page.evaluate(() => $ui('lyrics-draft').value)) === DRAFT,
        'second Undo did not restore the original'
      );
      await ctx.close();
    });
    for (const tool of ['placement', 'melody']) {
      await step(`N2. review with only pending ${tool}`, async () => {
        const { ctx, page, q } = await boot({ theme: 'light' });
        await setDraft(page, DRAFT);
        await page.evaluate((t) => {
          LY.picks.rhythmSec = 3;
          LY_ACTIONS['ly-tool']('rhythm');
          if (t === 'placement') lyDraftSet(t, '3', 'bar.13', '1');
          else {
            lyDraftSet(t, 'song', 'meter', '4/4');
            lyDraftSet(t, 'song', 'events', 'invalid');
          }
          lyRefresh(true);
        }, tool);
        check(
          await page.evaluate(() =>
            [...document.querySelectorAll('.ly-toolrow[data-id="rhythm"] .ly-count')].some(
              (c) => Number(c.textContent) === lyPendingAll() && !c.hidden
            )
          ),
          'Rhythm badge omitted pending subforms'
        );
        await page.evaluate(() => LY_ACTIONS['ly-run-review']());
        check(
          await page.evaluate(() => !!LY.gate && lyPendingAll() > 0),
          'subform-only changes did not open review gate'
        );
        check(q.calls.length === 0, 'review bypassed pending subform');
        // The explicit saved-version choice still sends only committed data.
        await page.evaluate(() => LY_ACTIONS['ly-gate-saved']());
        await page.waitForFunction(() => !chatState.busy);
        check(
          q.calls.length === 1 &&
            !q.calls[0].lyric_context?.declarations?.[
              tool === 'placement' ? 'line_placement' : 'melody'
            ],
          'Review saved version included a pending declaration'
        );
        check(
          await page.evaluate((t) => lyDrafts(t).length === 1, tool),
          'Review saved version discarded pending work'
        );
        await page.evaluate(() => LY_ACTIONS['ly-run-review']());
        await page.evaluate(() => LY_ACTIONS['ly-gate-apply']());
        check(
          q.calls.length === 1 && (await page.evaluate(() => !!LY.gate)),
          'invalid Apply all dispatched or closed the gate'
        );
        check(
          (await page.evaluate(() => $ui('lyrics-draft').value)) === DRAFT,
          'invalid subform changed the saved draft'
        );
        await page.evaluate((t) => {
          if (t === 'placement') {
            lyDraftSet(t, '3', 'beat.13', '1');
            lyDraftSet(t, '3', 'duration.13', '4');
          } else {
            lyDraftSet(t, 'song', 'groups', '2+2');
            lyDraftSet(t, 'song', 'bars', '1');
            lyDraftSet(t, 'song', 'events', '440:8');
          }
        }, tool);
        await page.evaluate(() => LY_ACTIONS['ly-gate-apply']());
        await page.waitForFunction(() => !chatState.busy);
        check(q.calls.length === 2, 'valid Apply all did not send exactly one new review');
        check(
          !!q.calls[1]?.lyric_context?.declarations?.[
            tool === 'placement' ? 'line_placement' : 'melody'
          ],
          'review payload omitted the applied subform'
        );
        check(
          await page.evaluate(() => !LY.gate && lyPendingAll() === 0),
          'applied subform remained pending'
        );
        await ctx.close();
      });
    }
    await step('J10. rhythm saved chip after strip Apply', async () => {
      const { ctx, page, q } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT);
      const chip = () => page.locator('.ly-tool-view .ly-view-status').allTextContents();
      await page.evaluate(() => {
        LY.picks.rhythmSec = 3;
        LY_ACTIONS['ly-tool']('rhythm');
        lyDraftSet('rhythm', '3', 'meter', '6/8');
        LY_ACTIONS['ly-rhythm-save']('3');
      });
      check(
        (await chip()).join('') === '6/8 saved · bars not set',
        'Save rhythm did not show its saved meter and unset bars'
      );
      // A refused Apply leaves both the committed header and receipt intact.
      await page.fill('#ly-r-bars', '0');
      await page.locator('#ly-pending-rhythm [data-ui="ly-draft-apply"]').click();
      check(
        (await chip()).join('') === '6/8 saved · bars not set',
        'invalid Apply discarded the still-correct saved receipt'
      );
      await page.fill('#ly-r-bars', '8');
      await page.locator('#ly-pending-rhythm [data-ui="ly-draft-apply"]').click();
      const header = (await page.inputValue('#lyrics-draft'))
        .split('\n')
        .find((r) => r.startsWith('[BRIDGE'));
      const after = await chip();
      check(header === '[BRIDGE — 4 lines — 8 bars of 6/8]', `strip Apply header: ${header}`);
      check(
        after.length === 0,
        `J10 stale receipt after strip Apply: ${JSON.stringify(after)}; header: ${header}`
      );
      await page.fill('#ly-r-bars', '12');
      await page.locator('[data-ui="ly-rhythm-save"]').click();
      check(
        (await chip()).join('') === '6/8 saved · 12 bars',
        'Save rhythm did not replace the receipt with the newly saved values'
      );
      await page.evaluate(() => {
        lyDraftSet('rhythm', '0', 'meter', '3/4');
        LY_ACTIONS['ly-draft-apply']('rhythm');
      });
      check(
        (await chip()).join('') === '6/8 saved · 12 bars',
        'applying a different section discarded the selected section receipt'
      );
      check(q.calls.length === 0, 'editing rhythm sent a writer request');
      await ctx.close();
    });

    await step('N2. selective save and partial review Apply all', async () => {
      const { ctx, page, q } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT);
      await page.evaluate(() => {
        LY.picks.rhythmSec = 3;
        LY_ACTIONS['ly-tool']('rhythm');
        lyDraftSet('rhythm', '3', 'meter', '6/8');
        lyDraftSet('placement', '3', 'bar.13', '1');
        lyDraftSet('melody', 'song', 'events', 'invalid');
        LY_ACTIONS['ly-rhythm-save']('3');
      });
      check(
        await page.evaluate(
          () =>
            !lyDrafts('rhythm').length &&
            lyDrafts('placement').length === 1 &&
            lyDrafts('melody').length === 1
        ),
        'Save rhythm no longer applies only the selected rhythm form'
      );
      await page.evaluate(() => {
        lyDraftSet('rhythm', '3', 'bars', '8');
        LY_ACTIONS['ly-run-review']();
      });
      await page.evaluate(() => LY_ACTIONS['ly-gate-apply']());
      check(
        q.calls.length === 0 && (await page.evaluate(() => !!LY.gate)),
        'partial Apply all sent a review'
      );
      check(
        await page.evaluate(() =>
          $ui('lyrics-draft').value.includes('[BRIDGE — 4 lines — 8 bars of 6/8]')
        ),
        'valid first form was not selectively applied'
      );
      check(
        /Some changes were applied/.test(await page.locator('body').innerText()),
        'review gate hid partial application'
      );
      check(
        await page.evaluate(
          () => lyDrafts('placement').length === 1 && lyDrafts('melody').length === 1
        ),
        'review gate discarded invalid or unattempted subforms'
      );
      await ctx.close();
    });

    await step('J4. rhyme options version label', async () => {
      const { ctx, page, q } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT);
      const fixture = {
        reply: 'Screened.',
        history: [],
        sig: 'fixture',
        task: { domain: 'lyrics', phase: 'edit' },
        tools: [
          {
            name: 'lyric_screen',
            pairs: [{ a: 'you', b: 'blue', codes: [], refused: false, relations: ['RHYME'] }],
          },
        ],
      };
      await page.evaluate(() => {
        lyScrollToLine(1);
        LY_ACTIONS['ly-line-tool']('rhymes:1');
      });
      const label = () => page.locator('.ly-result .ly-help').innerText();
      const stale = (text) => text.includes('asked about an earlier version');
      q.replies.push(fixture);
      await page.evaluate(() => LY_ACTIONS['ly-rhyme-options']());
      check(!stale(await label()), 'fresh rhyme options were labelled stale');
      check((await page.inputValue('#lyrics-draft')) === DRAFT, 'rhyme options changed the draft');
      await edit(page, 'The rain has blurred', 'The rain had blurred');
      check(stale(await label()), `J4 edit after reply has no stale label: ${await label()}`);
      await edit(page, 'The rain had blurred', 'The rain has blurred');
      check(!stale(await label()), 'restoring the requested version left the stale label');
      // Version identity includes headers, not just sung lines.
      await edit(page, '[BRIDGE — 4 lines]', '[BRIDGE — 4 lines — 6/8]');
      check(stale(await label()), `J4 header edit has no stale label: ${await label()}`);
      await setDraft(page, DRAFT);
      q.delay = 1000;
      q.replies.push(fixture);
      const sent = page.evaluate(() => LY_ACTIONS['ly-rhyme-options']());
      await page.waitForFunction(() => chatState.busy);
      await edit(page, 'The rain has blurred', 'The rain had blurred');
      await sent;
      check(
        stale(await label()),
        `J4 reply to earlier version has no stale label: ${await label()}`
      );
      check(q.calls.length === 2, `expected two fixture requests, got ${q.calls.length}`);
      check(
        // The pair reads "you ~ blue" on screen, "you with blue" aloud (R22).
        /you\s*~\s*(with\s*)?blue/.test(await page.locator('.ly-options').innerText()),
        'stale status changed or removed the returned pair'
      );
      // A recovered result without its request has no known version to compare.
      await page.evaluate((f) => {
        lyReceive(f, null);
        lyRefresh(true);
      }, fixture);
      check(!stale(await label()), 'an unbound recovered result claimed a known earlier version');
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

    // ── 9. readings saved before the reader's v2 cut, in the shipped page ─
    await step('9. saved readings', async () => {
      const { ctx, page, q } = await boot();
      const LAWDY = 'U--h, u--h, Lawdy,';
      const row = (token, word) =>
        `[SETUP — reading — token ${token} ${JSON.stringify(word)} in ${JSON.stringify(LAWDY)} — L AO1 D IY0 — declared — source: the singer]`;
      const pre = `${row(3, 'Lawdy')}\n${row(1, 'U--h')}\n\n[VERSE]\n${LAWDY}\nWe sing it plain`;
      // A draft saved before this release: its rows carry no cut mark.
      const got = await page.evaluate((t) => {
        $ui('lyrics-draft').value = t;
        // Opened as the shell opens a saved session: the open boundary,
        // then the step.
        uiLyricsOpened();
        uiSaveLyrics();
        pushHistory();
        lyRefresh(true);
        return {
          text: $ui('lyrics-draft').value,
          saved: JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyrics,
        };
      }, pre);
      check(
        /token 5 "Lawdy".* — cut v2\]/.test(got.text),
        'the saved Lawdy reading was not rebound to token 5 and marked'
      );
      check(
        /token 1 "U--h".*needs a decision: numbered under the earlier word cut/.test(got.text),
        'the unmatchable saved reading was not flagged for a decision'
      );
      check(got.saved === got.text, 'the autosaved session does not hold the migrated rows');
      const review = await pane(page, 'review');
      check(
        /The reading for “U--h”, token 1 in .* needs your decision/.test(review),
        'Review does not show it'
      );
      // Neither send path reaches /chat while it is undecided.
      const calls = q.calls.length;
      const sent = await page.evaluate(async () => ({
        review: await LY_ACTIONS['ly-run-review'](),
        typed: await _chatSend('Tighten line 2', { choice: 'lyrics-edit' }),
        log: $ui('chat-log')?.innerText || '',
      }));
      check(q.calls.length === calls, 'a draft with an undecided reading reached /chat');
      check(sent.typed?.reason === 'declarations', 'the typed request was not refused');
      check(
        /Nothing was sent/.test(sent.log),
        'the conversation does not say why nothing was sent'
      );
      // A post-release draft (its rows marked with the cut) is left as it is.
      const post = await page.evaluate(
        (t) => {
          $ui('lyrics-draft').value = t;
          // Opened as the shell opens a saved session: the open boundary,
          // then the step.
          uiLyricsOpened();
          uiSaveLyrics();
          pushHistory();
          lyRefresh(true);
          return $ui('lyrics-draft').value;
        },
        `${row(5, 'Lawdy').replace(/\]$/, ' — cut v2]')}\n\n[VERSE]\n${LAWDY}`
      );
      check(
        post.includes('token 5 "Lawdy"') && !/needs a decision/.test(post),
        'post-release moved'
      );
      await ctx.close();
    });

    // ── 9b. the text paths: a pre-release .txt imported into a current page,
    // and a current Library working copy downloaded and imported again ─────
    await step('9b. saved readings through text', async () => {
      const OH = 'Oh--oh, oh my love';
      const row = (token, word, line) =>
        `[SETUP — reading — token ${token} ${JSON.stringify(word)} in ${JSON.stringify(line)} — OW1 — declared — source: the singer]`;
      {
        // The page's own Download text, from before this release, imported
        // with Import: token 2 then meant the standalone "oh" (chars 8-10).
        const { ctx, page, q } = await boot();
        const pre = `${row(2, 'oh', OH)}\n\n[VERSE]\n${OH}\nWe sing it plain tonight`;
        await page.setInputFiles('#ly-file', {
          name: 'pre-release-song.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from(pre, 'utf8'),
        });
        await page.waitForFunction((line) => $ui('lyrics-draft').value.includes(line), OH, {
          timeout: 10000,
        });
        await page.evaluate(() => lyRefresh(true));
        const st = await page.evaluate((line) => {
          const m = lyParse($ui('lyrics-draft').value);
          const toks = CMLyricTokens.readerLine(line, { stripParens: true }).tokens;
          const d = lyDeclarationsOf(m);
          return {
            row: $ui('lyrics-draft').value.split('\n')[0],
            token: d.pronunciations?.[0]?.token,
            pieces: toks[(d.pronunciations?.[0]?.token || 0) - 1]?.pieces,
            need: d.readings_need_decision || null,
          };
        }, OH);
        check(
          st.token === 3 && JSON.stringify(st.pieces) === '[[8,10]]' && !st.need,
          `the imported reading binds token ${st.token} ${JSON.stringify(st.pieces)}, not the standalone "oh"`
        );
        check(/ — cut v2\]$/.test(st.row), 'the imported row was not marked after rebinding');
        const calls = q.calls.length;
        await page.evaluate(async () => LY_ACTIONS['ly-run-review']());
        await page.waitForTimeout(300);
        const sent = q.calls
          .slice(calls)
          .map((c) => c.lyric_context?.declarations?.pronunciations?.[0]?.token);
        check(
          sent.length === 1 && sent[0] === 3,
          `the review sent token ${JSON.stringify(sent)}, not 3`
        );
        await ctx.close();
      }
      {
        // A reading chosen today, in a Library working copy downloaded with
        // "Download text and sources" and imported again: its number is the
        // current cut's, and it stays where it is.
        const { ctx, page } = await boot();
        const LINE = 'Oh--oh, oh, oh my love';
        const r = await page.evaluate(async (line) => {
          const reading = `[SETUP — reading — ${lyReadingValue({
            token: 2,
            word: 'oh',
            line,
            kind: 'declared',
            phones: ['OW1'],
            basis: 'declared',
            source: 'the singer',
          })}]`;
          const text = `${reading}\n\n[VERSE]\n${line}\nWe sing it plain tonight`;
          const meta = {
            version: 1,
            brief: '',
            notes: {},
            drafts: {},
            ui: {},
            libraryOrigin: {
              version: 1,
              handoffId: 'handoff:' + crypto.randomUUID(),
              digest: '0'.repeat(64),
              importedAt: Date.now(),
              adapted: false,
              title: 'Song',
              language: 'eng',
              scope: 'whole',
              provenance: {
                snapshotId: 'snap:1',
                unitId: 'unit:1',
                workId: 'work:1',
                editionId: 'ed:1',
                revisionId: 'rev:1',
              },
              lineage: [],
              declarations: [],
            },
          };
          let err = null;
          try {
            await lyLibraryImport(await CMLibraryImport.makeWorkingCopyEnvelope(text, meta));
          } catch (e) {
            err = e.message;
          }
          await new Promise((res) => setTimeout(res, 800));
          lyRefresh(true);
          const d = lyDeclarationsOf(lyParse($ui('lyrics-draft').value));
          return { err, row: reading, text: $ui('lyrics-draft').value, decl: d.pronunciations };
        }, LINE);
        check(r.err === null, `the working copy did not import: ${r.err}`);
        check(
          r.text.includes(r.row) && r.decl?.[0]?.token === 2,
          `the re-imported reading moved: ${JSON.stringify(r.decl)}`
        );
        await ctx.close();
      }
    });

    // ── 9b2. Choose again on a reading with no saved sung-asides setting,
    // clicked through the shipped page: either occurrence its Review card
    // offers settles that row, and only that row (3PO #519 6197433772) ─────
    await step('9b2. choose again on an undecided reading', async () => {
      const ECHO = 'oh (oh) oh love';
      const OTHER = 'ah (ah) ah';
      const row = (word, line) =>
        `[SETUP — reading — token 2 ${JSON.stringify(word)} in ${JSON.stringify(line)} — OW1 — declared — source: the singer — cut v2]`;
      const text = `${row('oh', ECHO)}\n${row('ah', OTHER)}\n[SETUP — voices — sung]\n\n[VERSE]\n${ECHO}\n${OTHER}`;
      // Chip k of line 1 is token k+1 with asides sung: 1 is the
      // parenthesized "oh", 2 the outside third one.
      for (const [label, chip, token] of [
        ['parenthesized oh', 1, 2],
        ['outside oh', 2, 3],
      ]) {
        const { ctx, page, q } = await boot();
        await setDraft(page, text);
        const review = await pane(page, 'review');
        check(
          review.includes('oh ([oh]) oh love') && review.includes('oh (oh) [oh] love'),
          `${label}: the Review card does not offer both occurrences`
        );
        await page
          .locator('#ly-panel-review [data-ui="ly-tool"][data-id="pronunciation"]')
          .first()
          .click();
        await page.locator('[data-ui="ly-reading-pick"]').nth(chip).click();
        await page.locator('[data-ui="ly-reading-kind"][data-id="declared"]').click();
        await page.fill('#ly-phones', 'OW1');
        await page.fill('#ly-source', 'the singer');
        await page.locator('[data-ui="ly-draft-apply"][data-id="pronunciation"]').click();
        const st = await page.evaluate(() => {
          const d = lyDeclarationsOf(lyParse($ui('lyrics-draft').value));
          return {
            pron: d.pronunciations || [],
            need: (d.readings_need_decision || []).map((x) => x.line),
            cards: LY.items.filter((i) => /^reading:/.test(i.id)).map((i) => i.title),
          };
        });
        check(
          st.pron.length === 1 &&
            st.pron[0].line === ECHO &&
            st.pron[0].token === token &&
            JSON.stringify(st.need) === JSON.stringify([OTHER]),
          `${label}: Choose again left ${JSON.stringify(st)}`
        );
        check(
          st.cards.length === 1 && st.cards[0].includes(OTHER),
          `${label}: Review still shows ${JSON.stringify(st.cards)}`
        );
        const calls = q.calls.length;
        await page.evaluate(async () => LY_ACTIONS['ly-run-review']());
        check(q.calls.length === calls, `${label}: the other undecided reading stopped no send`);
        await ctx.close();
      }
    });

    // A saved "love" neither setting's count names: choosing either "oh"
    // through the page keeps it (3PO #519 6197775783).
    await step('9b2. choose again keeps an unrelated reading', async () => {
      const ECHO = 'oh (oh) oh love';
      const text = `[SETUP — reading — token 2 "love" in ${JSON.stringify(ECHO)} — L AH1 V — declared — source: the singer — cut v2]\n[SETUP — voices — sung]\n\n[VERSE]\n${ECHO}`;
      for (const chip of [1, 2]) {
        const { ctx, page } = await boot();
        await setDraft(page, text);
        await pane(page, 'review');
        await page
          .locator('#ly-panel-review [data-ui="ly-tool"][data-id="pronunciation"]')
          .first()
          .click();
        await page.locator('[data-ui="ly-reading-pick"]').nth(chip).click();
        await page.locator('[data-ui="ly-reading-kind"][data-id="declared"]').click();
        await page.fill('#ly-phones', 'OW1');
        await page.fill('#ly-source', 'the singer');
        await page.locator('[data-ui="ly-draft-apply"][data-id="pronunciation"]').click();
        const st = await page.evaluate(() => {
          const d = lyDeclarationsOf(lyParse($ui('lyrics-draft').value));
          return {
            pron: (d.pronunciations || []).map((x) => x.word),
            need: (d.readings_need_decision || []).map((x) => x.word),
          };
        });
        check(
          JSON.stringify(st.pron) === '["oh"]' && JSON.stringify(st.need) === '["love"]',
          `choosing "oh" chip ${chip} touched the unrelated saved "love": ${JSON.stringify(st)}`
        );
        await ctx.close();
      }
    });

    // ── 9c. a rhyme link's named place across the word-cut change, in the
    // shipped page: the notice, Keep / Remove, Undo / Redo, reload ─────────
    await step('9c. named places carried across the cut', async () => {
      const { ctx, page, q } = await boot();
      const OH = 'Oh--oh, oh my love';
      const pre = `[SETUP — rhyme groups — 1.head,2]\n\n[VERSE]\n${OH}\nWe sing it plain tonight\nThe dark comes early on`;
      const CARRIED = '1.head (carried across the word-cut change),2 — cut v2]';
      const state = () =>
        page.evaluate(() => ({
          row: $ui('lyrics-draft').value.split('\n')[0],
          items: LY.items.filter((i) => /:carried:/.test(i.id)).map((i) => i.id),
          saved: JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyrics || '',
        }));
      await page.evaluate((t) => {
        $ui('lyrics-draft').value = t;
        // Opened as the shell opens a saved session: the open boundary,
        // then the step.
        uiLyricsOpened();
        uiSaveLyrics();
        pushHistory();
        lyRefresh(true);
      }, pre);
      let st = await state();
      check(st.row.endsWith(CARRIED), `the head place was not carried: ${st.row}`);
      check(st.items.length === 1, `Review notices: ${JSON.stringify(st.items)}`);
      const review = await pane(page, 'review');
      check(
        /carried across the word-cut change/.test(review) &&
          /“Oh--oh” under the earlier cut and “Oh” under the current one/.test(review) &&
          /not the grader's evidence/.test(review) &&
          /Keep the link/.test(review) &&
          /Remove it/.test(review),
        'Review does not show the carried notice with both words and both actions'
      );
      // It is sent, as declared, and nothing blocks the send.
      const calls = q.calls.length;
      q.replies.push({ reply: 'ok', history: [], sig: 'x' });
      await page.evaluate(async () => LY_ACTIONS['ly-run-review']());
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      const sent = q.calls.slice(calls).map((c) => c.lyric_context?.declarations?.groups);
      check(
        sent.length === 1 && sent[0] === '1.head,2',
        `the carried link was not sent as declared: ${JSON.stringify(sent)}`
      );
      // Reload: the state is in the saved text and comes back as it was.
      await page.reload();
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, {
        timeout: 60000,
      });
      await page.evaluate(() => lyRefresh(true));
      st = await state();
      check(
        st.row.endsWith(CARRIED) && st.items.length === 1,
        `the carried state did not survive a reload: ${st.row}`
      );
      // Keep the link, then Undo and Redo.
      const id = st.items[0];
      await page.evaluate((i) => {
        const item = LY.items.find((x) => x.id === i);
        LY_ACTIONS['ly-carried-keep'](item.actions[0][3]);
      }, id);
      st = await state();
      check(
        st.row === '[SETUP — rhyme groups — 1.head,2 — cut v2]' && st.items.length === 0,
        `Keep did not clear the state: ${st.row}`
      );
      await page.evaluate(() => $ui('btn-undo').click());
      await page.evaluate(() => lyRefresh(true));
      st = await state();
      check(
        st.row.endsWith(CARRIED) && st.items.length === 1,
        `Undo did not restore the carried state: ${st.row}`
      );
      await page.evaluate(() => $ui('btn-redo').click());
      await page.evaluate(() => lyRefresh(true));
      st = await state();
      check(
        st.row === '[SETUP — rhyme groups — 1.head,2 — cut v2]' && st.items.length === 0,
        `Redo did not keep the link: ${st.row}`
      );
      check(st.saved.split('\n')[0] === st.row, 'the kept link was not saved');
      // Remove it, from the restored state: the two-member link goes whole.
      await page.evaluate(() => $ui('btn-undo').click());
      await page.evaluate(() => lyRefresh(true));
      await page.evaluate(() => {
        const item = LY.items.find((x) => /:carried:/.test(x.id));
        LY_ACTIONS['ly-carried-remove'](item.actions[1][3]);
      });
      st = await state();
      check(
        !/rhyme groups/.test(await page.evaluate(() => $ui('lyrics-draft').value)) &&
          st.items.length === 0,
        `Remove did not remove the link: ${st.row}`
      );
      await ctx.close();
    });

    await step('9d. real send selection', async () => {
      for (const mode of ['mouse', 'tab-mouse', 'tab-caret-mouse', 'keyboard', 'dock', 'phone']) {
        const { ctx, page, q } = await boot({ phone: mode === 'phone' });
        const text =
          '[SETUP — rhyme groups — 1.T2,2.end]\n[VERSE]\nOh--oh, oh my love\nwe sing it plain tonight';
        await setDraft(page, text);
        const collapsed = mode === 'tab-caret-mouse';
        await page.evaluate((caret) => {
          const d = $ui('lyrics-draft');
          d.focus();
          const at = d.value.indexOf('sing it');
          d.setSelectionRange(caret ? at + 2 : at, caret ? at + 2 : at + 7, 'backward');
        }, collapsed);
        if (mode.startsWith('tab-')) {
          await page.keyboard.press('Tab');
          const retained = await page.evaluate((caret) => {
            const d = $ui('lyrics-draft');
            return (
              document.activeElement !== d &&
              (caret
                ? d.selectionStart === d.value.indexOf('sing it') + 2 &&
                  d.selectionEnd === d.selectionStart
                : d.value.slice(d.selectionStart, d.selectionEnd) === 'sing it')
            );
          }, collapsed);
          check(retained, 'P5 Tab moved focus away while retaining the textarea selection');
        }
        q.replies.push({ reply: 'Fixture review only', history: [], sig: 'fixture' });
        if (mode === 'phone') await page.locator('#ly-mtab-review').click();
        else if (mode !== 'dock') {
          const callsBeforeNavigation = q.calls.length;
          await page.locator('.ly-head [data-ui="ly-tab"][data-id="review"]').click();
          check(
            q.calls.length === callsBeforeNavigation,
            'P5 header Review navigation sent a request'
          );
        }
        if (mode === 'dock') {
          await page.evaluate(() => {
            LY_ACTIONS['ly-tab']('writer');
            uiChatOpen();
            $ui('chat-domain').value = 'lyrics-edit';
          });
          await page.fill('#chat-input', 'Review the committed document');
          await page.locator('#chat-send').click();
        } else {
          const button = page.locator('#ly-panel-review [data-ui="ly-run-review"]:visible').first();
          if (mode === 'keyboard') {
            await button.focus();
            await page.keyboard.press('Enter');
          } else await button.click();
        }
        await page.waitForFunction(() => !chatState.busy && chatState.sig === 'fixture', null, {
          timeout: 20000,
        });
        if (mode === 'phone') {
          await page.locator('#ly-mtab-song').click();
          await page.evaluate(() => new Promise(requestAnimationFrame));
        }
        const got = await page.evaluate(() => {
          const d = $ui('lyrics-draft');
          return {
            text: d.value,
            start: d.selectionStart,
            end: d.selectionEnd,
            selected: d.value.slice(d.selectionStart, d.selectionEnd),
          };
        });
        check(
          q.calls.length === 1 &&
            (collapsed
              ? got.start === got.text.indexOf('sing it') + 2 && got.end === got.start
              : got.selected === 'sing it'),
          `P5/P6 ${mode} selection: ${JSON.stringify(got)}; calls ${q.calls.length}`
        );
        check(
          got.text.endsWith('Oh--oh, oh my love\nwe sing it plain tonight'),
          `P6 ${mode} merged sung lines`
        );
        if (mode === 'phone') {
          await page.locator('#lyrics-draft').focus();
          await page.keyboard.insertText('sing it');
          check(
            (await page.inputValue('#lyrics-draft')) === got.text,
            'P6 typing over the restored selection changed or merged sung lines'
          );
        }
        await ctx.close();
      }
    });

    // ── 9d. the migration runs at a boundary, never while the writer types
    // (BB8 #519 6161601064 F1); Undo/Redo across an open and an import that
    // migrated; the renumbered card outlives the toast and a reload (F4) ──
    await step('9d. migration boundaries', async () => {
      const { ctx, page } = await boot();
      const OH = 'Oh--oh, oh my love';
      const DOVE = 'You are the one I dream of my dove';
      const base = `[SETUP — title — "Song"]\n\n[VERSE]\n${DOVE}\n${OH}`;
      await setDraft(page, base);
      // Rows without the cut mark, written in by hand (the state a draft
      // holds between boundaries): one above the lines, one after them.
      const TOP = '[SETUP — rhyme groups — 2.T4,1.T2]';
      const END = '[SETUP — returns — 2.T2,1.T2]';
      const held = `${TOP}\n${base}\n${END}`;
      await page.evaluate((t) => {
        const d = $ui('lyrics-draft');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(d, t);
        d.dispatchEvent(new Event('input'));
      }, held);
      // BB8's worst case: '--oh my' typed after "dove", a key at a time, each
      // slower than the page's 120 ms refresh. Rewriting the draft under the
      // writer sent the caret to the end, so the keys landed after the last
      // row's `]` and that declaration stopped being one.
      await page.evaluate((w) => {
        const d = $ui('lyrics-draft');
        d.focus();
        const at = d.value.indexOf(w) + w.length;
        d.setSelectionRange(at, at);
      }, DOVE);
      await page.keyboard.type('--oh my', { delay: 200 });
      await page.waitForTimeout(400);
      const typed = held.replace(DOVE, `${DOVE}--oh my`);
      const caretAt = typed.indexOf('--oh my') + '--oh my'.length;
      let st = await page.evaluate(() => {
        const d = $ui('lyrics-draft');
        const decl = lyDeclarationsOf(lyParse(d.value));
        return {
          text: d.value,
          caret: [d.selectionStart, d.selectionEnd],
          groups: decl.groups || null,
          returns: decl.returns || null,
        };
      });
      check(st.text === typed, `typing was rewritten under the writer: ${JSON.stringify(st.text)}`);
      check(
        st.caret[0] === caretAt && st.caret[1] === caretAt,
        `the caret moved while typing: ${st.caret} (want ${caretAt})`
      );
      check(
        st.groups === '2.T4,1.T2' && st.returns === '2.T2,1.T2',
        `a declaration was lost while typing: ${JSON.stringify([st.groups, st.returns])}`
      );
      // The send boundary migrates, keeps the caret on the same character,
      // and records no step of its own: Undo returns to the draft from
      // before the writer's typing, Redo to the migrated text.
      st = await page.evaluate(() => {
        const changed = lyEnsureTokenScheme();
        const d = $ui('lyrics-draft');
        return { changed, text: d.value, caret: [d.selectionStart, d.selectionEnd] };
      });
      const migrated = typed
        .replace(TOP, '[SETUP — rhyme groups — 2.T5,1.T2 — numbering v2 — cut v2]')
        .replace(END, '[SETUP — returns — 2.T3,1.T2 — numbering v2 — cut v2]');
      check(st.changed && st.text === migrated, `the send boundary: ${JSON.stringify(st.text)}`);
      const shifted = migrated.indexOf('--oh my') + '--oh my'.length;
      check(
        st.caret[0] === shifted && st.caret[1] === shifted,
        `the caret was not mapped through the rewrite: ${st.caret} (want ${shifted})`
      );
      const undoRedo = async () => {
        await page.evaluate(() => $ui('btn-undo').click());
        const u = await page.evaluate(() => $ui('lyrics-draft').value);
        await page.evaluate(() => $ui('btn-redo').click());
        const r = await page.evaluate(() => $ui('lyrics-draft').value);
        return [u, r];
      };
      let [u, r] = await undoRedo();
      check(
        u === base,
        `Undo after the boundary restored ${JSON.stringify(u)}, not the draft before`
      );
      check(r === migrated, `Redo did not return to the migrated text: ${JSON.stringify(r)}`);
      // An import that migrates: Undo restores the draft before it, exactly,
      // and does not bring back (or re-migrate) the unmarked row; Redo
      // returns to the migrated import.
      const reading = `[SETUP — reading — token 2 "oh" in ${JSON.stringify(OH)} — OW1 — declared — source: me]`;
      const file = `${reading}\n\n[VERSE]\n${OH}\n${DOVE}`;
      await page.setInputFiles('#ly-file', {
        name: 'old-song.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(file, 'utf8'),
      });
      await page.waitForFunction((l) => $ui('lyrics-draft').value.includes(l), DOVE, {
        timeout: 10000,
      });
      const imported = await page.evaluate(() => $ui('lyrics-draft').value);
      const wantImported = file.replace(
        reading,
        `[SETUP — reading — token 3 "oh" in ${JSON.stringify(OH)} — OW1 — declared — source: me — numbering v2 — cut v2]`
      );
      check(imported === wantImported, `the import was not migrated: ${JSON.stringify(imported)}`);
      [u, r] = await undoRedo();
      check(u === migrated, `Undo across the import restored ${JSON.stringify(u)}`);
      check(r === wantImported, `Redo across the import restored ${JSON.stringify(r)}`);
      // F4: the card lists the renumbered reading after the toast is gone.
      await page.evaluate(() => showToast('Something else', 'success'));
      const card = () =>
        page.evaluate(() => {
          lyRefresh(true);
          const i = LY.items.find((x) => x.id === 'renumbered');
          return i ? i.text : null;
        });
      let c = await card();
      check(
        !!c && /the reading for “oh”, line 1: word 2 → 3/.test(c),
        `no persistent Review card after the import: ${c}`
      );
      check(
        /renumbered to the current word cut/.test(await pane(page, 'review')),
        'Review does not show the renumbered card'
      );
      // A reload keeps it (the page context's display state).
      await page.waitForFunction(
        () => /renumbered/.test(localStorage.getItem('codex-workbench-v1') || ''),
        null,
        { timeout: 5000 }
      );
      await page.reload();
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, {
        timeout: 60000,
      });
      c = await card();
      check(!!c && /word 2 → 3/.test(c), `the card did not survive a reload: ${c}`);
      await page.evaluate(() => LY_ACTIONS['ly-renumbered-dismiss']());
      check((await card()) === null, 'Dismiss did not remove the card');
      // A Library working copy with an unmarked reading: the same card.
      const lib = await page.evaluate(async (text) => {
        const meta = {
          version: 1,
          brief: '',
          notes: {},
          drafts: {},
          ui: {},
          libraryOrigin: {
            version: 1,
            handoffId: 'handoff:' + crypto.randomUUID(),
            digest: '0'.repeat(64),
            importedAt: Date.now(),
            adapted: false,
            title: 'Song',
            language: 'eng',
            scope: 'whole',
            provenance: {
              snapshotId: 'snap:1',
              unitId: 'unit:1',
              workId: 'work:1',
              editionId: 'ed:1',
              revisionId: 'rev:1',
            },
            lineage: [],
            declarations: [],
          },
        };
        let err = null;
        try {
          await lyLibraryImport(await CMLibraryImport.makeWorkingCopyEnvelope(text, meta));
        } catch (e) {
          err = e.message;
        }
        await new Promise((res) => setTimeout(res, 800));
        return { err, text: $ui('lyrics-draft').value };
      }, file);
      check(
        lib.err === null && lib.text === wantImported,
        `the Library working copy was not migrated: ${JSON.stringify(lib)}`
      );
      c = await card();
      check(
        !!c && /the reading for “oh”, line 1: word 2 → 3/.test(c),
        `no persistent card after a Library working-copy import: ${c}`
      );
      // An open through the shell: a stored session with an unmarked row is
      // migrated at start, before the first step (nothing to Undo into).
      const stored = `${END}\n\n[VERSE]\n${DOVE}\n${OH}`;
      await page.evaluate((t) => {
        for (const store of [localStorage, sessionStorage]) {
          const key = store === localStorage ? 'codex-workbench-v1' : 'codex-workbench-recovery';
          const s = JSON.parse(store.getItem(key) || localStorage.getItem('codex-workbench-v1'));
          s.lyrics = t;
          store.setItem(key, JSON.stringify(s));
        }
      }, stored);
      await page.reload();
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, {
        timeout: 60000,
      });
      st = await page.evaluate(() => ({
        text: $ui('lyrics-draft').value,
        steps: app.history.map((h) => JSON.parse(h).lyrics),
      }));
      const openedWant = stored.replace(
        END,
        '[SETUP — returns — 2.T3,1.T2 — numbering v2 — cut v2]'
      );
      check(
        st.text === openedWant && st.steps.length === 1 && st.steps[0] === openedWant,
        `the stored session was not migrated at open: ${JSON.stringify(st)}`
      );
      await ctx.close();
    });

    // ── 9e. the renumbering record belongs to its draft across Undo, the
    // Library store and a reload (BB8 66cef416, 3PO #519 6166169619); whole-
    // line and placed returns through the Library working-copy receiver
    // (3PO #519 6166749777) ──
    await step('9e. per-draft evidence and returns classes', async () => {
      const { ctx, page } = await boot();
      const OH = 'Oh--oh, oh my love';
      const DOVE = 'You are the one I dream of my dove';
      const PLAIN = 'we sing it plain tonight';
      const card = () =>
        page.evaluate(() => {
          lyRefresh(true);
          const i = LY.items.find((x) => x.id === 'renumbered');
          return i ? i.text : null;
        });
      // Draft A: a .txt import that renumbers a reading on "oh".
      const readingA = `[SETUP — reading — token 2 "oh" in ${JSON.stringify(OH)} — OW1 — declared — source: me]`;
      await page.setInputFiles('#ly-file', {
        name: 'a.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(`${readingA}\n\n[VERSE]\n${OH}\n${DOVE}`, 'utf8'),
      });
      await page.waitForFunction((l) => $ui('lyrics-draft').value.includes(l), DOVE, {
        timeout: 10000,
      });
      const textA = await page.evaluate(() => $ui('lyrics-draft').value);
      let c = await card();
      check(!!c && /the reading for “oh”/.test(c), `draft A has no record: ${c}`);
      // Draft B: a Library working copy whose unmarked rows renumber a rhyme
      // link and hold whole-line and placed returns on changed-cut lines.
      const linesB = [OH, DOVE, OH, PLAIN];
      const RET = '1,3;1.line,3.line;1.head,3.head;2.end,4.end';
      const textB = `[SETUP — rhyme groups — 1.T4,4]\n[SETUP — returns — ${RET}]\n\n[VERSE]\n${linesB.join('\n')}`;
      const lib = await page.evaluate(async (text) => {
        const meta = {
          version: 1,
          brief: '',
          notes: {},
          drafts: {},
          ui: {},
          libraryOrigin: {
            version: 1,
            handoffId: 'handoff:' + crypto.randomUUID(),
            digest: '0'.repeat(64),
            importedAt: Date.now(),
            adapted: false,
            title: 'Song B',
            language: 'eng',
            scope: 'whole',
            provenance: {
              snapshotId: 'snap:1',
              unitId: 'unit:1',
              workId: 'work:1',
              editionId: 'ed:1',
              revisionId: 'rev:1',
            },
            lineage: [],
            declarations: [],
          },
        };
        let err = null;
        try {
          await lyLibraryImport(await CMLibraryImport.makeWorkingCopyEnvelope(text, meta));
        } catch (e) {
          err = e.message;
        }
        await new Promise((res) => setTimeout(res, 800));
        const model = lyParse($ui('lyrics-draft').value);
        return {
          err,
          text: $ui('lyrics-draft').value,
          draftId: lyMeta().draftId,
          wire: lyDeclarationsOf(model),
          notices: lyLocalChecks(model)
            .filter((x) => /:carried:/.test(x.id))
            .map((x) => [x.id, x.title, x.text]),
        };
      }, textB);
      check(lib.err === null, `the Library working copy was refused: ${lib.err}`);
      check(
        lib.text.startsWith(
          '[SETUP — rhyme groups — 1.T5,4 — numbering v2 — cut v2]\n[SETUP — returns — 1,3;1.line,3.line;1.head (carried across the word-cut change),3.head (carried across the word-cut change);2.end,4.end — cut v2]\n'
        ),
        `the Library receiver did not class the returns: ${JSON.stringify(lib.text.split('\n').slice(0, 2))}`
      );
      check(
        lib.wire.groups === '1.T5,4' && lib.wire.returns === RET,
        `the tools would receive ${JSON.stringify([lib.wire.groups, lib.wire.returns])}`
      );
      check(
        lib.notices.length === 2 &&
          lib.notices.every(([id, title]) => /^returns:/.test(id) && /· first word/.test(title)),
        `Review notices after the Library import: ${JSON.stringify(lib.notices.map((x) => x[1]))}`
      );
      const h = harnessReturns(linesB, lib.wire.returns);
      check(
        !!h &&
          JSON.stringify(h.classes) ===
            JSON.stringify([
              [[1, 3], 'placed', ['head', 'head']],
              [[1, 3], 'placed', ['line', 'line']],
              [[1, 3], 'whole', []],
              [[2, 4], 'placed', ['end', 'end']],
            ]) &&
          h.whole.length === 0 &&
          h.placed.length === 1 &&
          /L2\.end=.*L4\.end=/.test(h.placed[0][1]),
        `the harness read other returns from the Library payload: ${JSON.stringify(h)}`
      );
      c = await card();
      check(
        !!c && /a rhyme link on “love”, line 1: word 4 → 5/.test(c) && !/“oh”/.test(c),
        `draft B's card shows another draft's record: ${c}`
      );
      // B's record reaches its own Library store entry.
      const idB = lib.draftId;
      await page.waitForFunction(
        async (id) => {
          const r = await lyLibraryStore.getDraft(id);
          return !!r && /love/.test(JSON.stringify(r.meta?.renumbered || null));
        },
        idB,
        { timeout: 10000 }
      );
      // Undo: draft A's text and draftId come back WITH A's record.
      await page.evaluate(() => $ui('btn-undo').click());
      const back = await page.evaluate(() => ({
        text: $ui('lyrics-draft').value,
        draftId: lyMeta().draftId,
      }));
      check(back.text === textA, `Undo did not return to draft A: ${JSON.stringify(back.text)}`);
      c = await card();
      check(
        !!c && /the reading for “oh”/.test(c) && !/love/.test(c),
        `after Undo the card shows another draft's record: ${c}`
      );
      // Persistence after Undo (the page re-saves the restored draft): A's
      // stored record holds A's entries, B's still holds B's.
      await page.waitForTimeout(2500);
      const stored = await page.evaluate(
        async ([a, b]) => ({
          a: JSON.stringify((await lyLibraryStore.getDraft(a))?.meta?.renumbered || null),
          b: JSON.stringify((await lyLibraryStore.getDraft(b))?.meta?.renumbered || null),
          session: JSON.stringify(
            JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyricMeta?.renumbered ||
              null
          ),
        }),
        [back.draftId, idB]
      );
      check(
        /“?oh/.test(stored.a) && !/love/.test(stored.a),
        `draft A's stored record holds another draft's entries: ${stored.a}`
      );
      check(
        /love/.test(stored.b) && !/"word":"oh"/.test(stored.b),
        `draft B's stored record lost its own entries: ${stored.b}`
      );
      check(
        /"word":"oh"/.test(stored.session) && !/love/.test(stored.session),
        `the saved session holds another draft's record: ${stored.session}`
      );
      // A reload keeps A's record with A, and B's with B.
      await page.reload();
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, {
        timeout: 60000,
      });
      c = await card();
      check(
        !!c && /the reading for “oh”/.test(c) && !/love/.test(c),
        `after a reload draft A shows: ${c}`
      );
      await page.evaluate((id) => LY_ACTIONS['ly-library-restore'](id), idB);
      await page.waitForFunction((id) => lyMeta().draftId === id, idB, { timeout: 10000 });
      c = await card();
      check(
        !!c && /a rhyme link on “love”/.test(c) && !/“oh”/.test(c),
        `reopened draft B shows: ${c}`
      );
      await ctx.close();
    });

    // 10. A saved request the server no longer keeps never strands the page.
    // The page re-arms the last exchange's receipt on every load; receipts
    // expire, and a 404 used to leave "outcome unknown" forever, hiding
    // "Get dictionary options". A 503 (persistence down) still holds the ticket.
    // New conversation also drops the copy kept when switching writers, and the
    // panel redraws at once.
    // R17 #72: the phone's section stepper keeps focus, moves the caret
    // without focusing the draft and says where the song now is, so a second
    // Enter steps again instead of typing a blank line into the song.
    await step('R17a. section stepper keeps focus', async () => {
      const { ctx, page } = await boot({ theme: 'light', phone: true });
      await setDraft(page, DRAFT);
      await page.evaluate(() => LY_ACTIONS['ly-mobile']('song'));
      const before = await page.evaluate(() => $ui('lyrics-draft').value);
      await page.focus('#ly-section-nav [data-ui="ly-sec-step"][data-id="1"]');
      const said = [];
      for (let i = 0; i < 2; i++) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        said.push(
          await page.evaluate(() => ({
            focus: document.activeElement?.dataset?.ui || document.activeElement?.tagName,
            live: $ui('ly-live')?.textContent || '',
            pos: document.querySelector('.ly-sec-pos > span')?.textContent || '',
          }))
        );
      }
      const after = await page.evaluate(() => $ui('lyrics-draft').value);
      check(after === before, 'a second Enter on Next section typed into the song');
      check(
        said.every((s) => s.focus === 'ly-sec-step'),
        `Next section did not keep focus: ${JSON.stringify(said)}`
      );
      check(
        /^.+, 2 of \d+$/.test(said[0].live) && /^.+, 3 of \d+$/.test(said[1].live),
        `the section step was not announced: ${JSON.stringify(said)}`
      );
      await ctx.close();
    });

    // R17 #73: the phone's Sections sheet is a modal dialog: Tab stays in
    // it, and Escape or Collapse returns focus to the visible opener.
    await step('R17b. Sections sheet is modal and returns focus', async () => {
      const { ctx, page } = await boot({ theme: 'light', phone: true });
      await setDraft(page, DRAFT);
      await page.evaluate(() => LY_ACTIONS['ly-mobile']('song'));
      const state = () =>
        page.evaluate(() => {
          const panel = $ui('ly-outline-panel');
          const a = document.activeElement;
          return {
            role: panel.getAttribute('role'),
            modal: panel.getAttribute('aria-modal'),
            mainInert: $ui('ly-main').inert,
            inPanel: panel.contains(a),
            focus: a === document.body ? 'BODY' : a?.className || a?.tagName,
            visible: !!a?.getClientRects().length,
          };
        });
      for (const close of ['Escape', 'Collapse']) {
        await page.focus('#ly-section-nav .ly-sec-pos');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        const open = await state();
        check(
          open.role === 'dialog' && open.modal === 'true' && open.mainInert && open.inPanel,
          `the open Sections sheet is not a modal dialog: ${JSON.stringify(open)}`
        );
        const walked = [];
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press('Tab');
          walked.push((await state()).inPanel || (await state()).focus);
        }
        check(
          walked.every((w) => w === true),
          `Tab left the Sections sheet: ${JSON.stringify(walked)}`
        );
        if (close === 'Escape') await page.keyboard.press('Escape');
        else {
          await page.focus('#ly-outline-panel .ly-outline-close');
          await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(100);
        const shut = await state();
        check(
          /ly-sec-pos/.test(shut.focus) && shut.visible && !shut.mainInert && !shut.modal,
          `${close} on the Sections sheet: ${JSON.stringify(shut)}`
        );
      }
      await ctx.close();
    });

    // R17 #74: typing in Find lands on the first match, marked as the
    // current one; Enter goes to the second and Shift+Enter comes back.
    await step('R17c. Find starts on the first match', async () => {
      const { ctx, page } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT);
      await page.click('[data-ui="ly-find-open"]');
      await page.keyboard.type('rain');
      await page.waitForTimeout(100);
      const where = () =>
        page.evaluate(() => {
          const d = $ui('lyrics-draft');
          const line = d.value.slice(0, d.selectionStart).split('\n').length - 1;
          return {
            count: $ui('ly-find-count').textContent,
            selected: d.value.slice(d.selectionStart, d.selectionEnd),
            line: LY.model.rows[line]?.n || 0,
            current: [
              ...new Set(
                [...document.querySelectorAll('#ly-overlay .ly-hit-current')].map(
                  (e) => e.closest('.ly-r')?.dataset.n
                )
              ),
            ],
            focus: document.activeElement?.id,
          };
        });
      const typed = await where();
      check(
        typed.count === '1 of 2 lines' &&
          typed.selected === 'rain' &&
          typed.line === 2 &&
          JSON.stringify(typed.current) === '["2"]' &&
          typed.focus === 'ly-find-input',
        `typing in Find did not land on match 1: ${JSON.stringify(typed)}`
      );
      await page.keyboard.press('Enter');
      const next = await where();
      check(
        next.count === '2 of 2 lines' &&
          next.line === 9 &&
          JSON.stringify(next.current) === '["9"]',
        `the first Enter in Find did not go to match 2: ${JSON.stringify(next)}`
      );
      await page.keyboard.press('Shift+Enter');
      const back = await where();
      check(
        back.count === '1 of 2 lines' &&
          back.line === 2 &&
          JSON.stringify(back.current) === '["2"]',
        `Shift+Enter in Find did not come back to match 1: ${JSON.stringify(back)}`
      );
      // A phrase marks every word it spans (it marked none: each word was
      // tested for the whole query on its own), the current line's as current.
      await page.fill('#ly-find-input', 'rain has blur');
      await page.waitForTimeout(150);
      const phrase = await page.evaluate(() => {
        const words = (sel) =>
          [...document.querySelectorAll(`#ly-overlay .ly-r[data-n="2"] ${sel}`)].map((e) =>
            e.textContent.trim()
          );
        return {
          count: $ui('ly-find-count').textContent,
          hit: words('.ly-hit'),
          current: words('.ly-hit-current'),
        };
      });
      check(
        phrase.count === '1 of 1 line' &&
          JSON.stringify(phrase.hit) === '["rain","has","blurred"]' &&
          JSON.stringify(phrase.current) === '["rain","has","blurred"]',
        `a Find phrase did not mark the words it spans: ${JSON.stringify(phrase)}`
      );
      await ctx.close();
    });
    // R20. Jony's round 20, Lyrics parts. #97/#98: in forced colours the
    // draft's own text was forced visible with a readability backplate over
    // the read layer, so every header showed twice and the Find marks behind
    // it vanished; #98 also asks a non-colour cue on the current section.
    // #95: at 320×256 the Sections sheet's list was 0 px. #100: rotating with
    // Find's field focused left it off-screen.
    await step('R20. forced colours, short sheet, rotation', async () => {
      // The colour the page shows at the centre of an element, read from a
      // screenshot decoded in the page (no image library in this repo).
      const pixel = async (page, selector) => {
        await page.$eval(selector, (e) => e.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(100);
        const box = await (await page.$(selector)).boundingBox();
        const shot = await page.screenshot({
          clip: {
            x: box.x + box.width / 2 - 1,
            y: box.y + box.height / 2 - 1,
            width: 2,
            height: 2,
          },
        });
        return page.evaluate(async (b64) => {
          const img = new Image();
          img.src = 'data:image/png;base64,' + b64;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const g = c.getContext('2d');
          g.drawImage(img, 0, 0);
          return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        }, shot.toString('base64'));
      };
      const rgb = (css) => (css.match(/\d+/g) || []).slice(0, 3).map(Number);
      const near = (a, b) => a.every((v, k) => Math.abs(v - b[k]) <= 24);
      for (const phone of [false, true]) {
        const { ctx, page } = await boot({ theme: 'light', phone });
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'forced-colors', value: 'active' }],
        });
        await setDraft(page, DRAFT);
        if (phone) await page.evaluate(() => LY_ACTIONS['ly-mobile']('song'));
        await page.evaluate(() => {
          LY.find = { q: 'rain', at: 0, open: true };
          lyRefresh(true);
        });
        await page.waitForTimeout(200);
        const tag = phone ? '390' : '1280';
        const mark = '#ly-overlay .ly-hit:not(.ly-hit-current)';
        const want = rgb(await page.$eval(mark, (e) => getComputedStyle(e).backgroundColor));
        const seen = await pixel(page, mark);
        const draft = await page.$eval('#lyrics-draft', (d) => getComputedStyle(d).color);
        check(
          near(seen, want) && rgb(draft).length === 3 && /rgba\(.*,\s*0\)$/.test(draft),
          `${tag} forced colours: a Find mark shows ${seen}, not its ${want}, and the draft's own text is ${draft}`
        );
        // The draft's selection still shows, in Highlight: a whole line selected
        // with Find closed, sampled over its text.
        await page.evaluate(() => {
          LY.find = { q: '', at: 0, open: false };
          lyRefresh(true);
        });
        await page.focus('#lyrics-draft');
        const hl = rgb(
          await page.evaluate(() => {
            const probe = document.createElement('span');
            probe.style.color = 'Highlight';
            document.body.append(probe);
            const c = getComputedStyle(probe).color;
            probe.remove();
            return c;
          })
        );
        await page.evaluate(() => {
          const d = $ui('lyrics-draft');
          const line = LY.model.sung[1];
          const rows = d.value.split('\n');
          const start = rows.slice(0, line.i).reduce((t, r) => t + r.length + 1, 0);
          d.setSelectionRange(start, start + rows[line.i].length);
        });
        const at = await pixel(page, '#ly-overlay .ly-r[data-n="2"] .ly-t');
        check(
          near(at, hl),
          `${tag} forced colours: the draft's selection shows ${at}, not Highlight ${hl}`
        );
        await ctx.close();
      }
      // The current section: a cue that is not colour, everywhere, and a
      // Highlight outline in forced colours.
      {
        const { ctx, page } = await boot({ theme: 'light' });
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'forced-colors', value: 'active' }],
        });
        await setDraft(page, DRAFT);
        await page.evaluate(() => {
          LY.railOpen = true;
          lyScrollToLine(2);
          lyRefresh(true);
        });
        await page.waitForTimeout(200);
        const cur = await page.evaluate(() => {
          const b = document.querySelector('#ly-sections .ly-sec[aria-current]');
          const cs = b && getComputedStyle(b);
          return b ? { weight: Number(cs.fontWeight), outline: cs.outlineStyle } : null;
        });
        check(
          cur && cur.weight >= 600 && cur.outline === 'solid',
          `the current section has no cue but colour: ${JSON.stringify(cur)}`
        );
        await ctx.close();
      }
      // #95: the sheet at 320×256 keeps a list and scrolls as a whole.
      {
        const { ctx, page } = await boot({ theme: 'light', phone: true });
        await page.setViewportSize({ width: 320, height: 256 });
        await setDraft(page, DRAFT);
        await page.evaluate(() => LY_ACTIONS['ly-mobile']('song'));
        await page.focus('#ly-section-nav .ly-sec-pos');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        const sheet = await page.evaluate(() => {
          const list = $ui('ly-sections');
          const outline = document.querySelector('.ly-outline');
          const last = [...list.querySelectorAll('.ly-sec')].at(-1);
          last.focus();
          const r = last.getBoundingClientRect();
          return {
            list: list.getBoundingClientRect().height,
            modal: $ui('ly-outline-panel').getAttribute('aria-modal'),
            lastVisible: r.top >= 0 && r.bottom <= innerHeight,
            scrolls: outline.scrollHeight > outline.clientHeight,
          };
        });
        check(
          sheet.list >= 88 && sheet.modal === 'true' && sheet.lastVisible,
          `the Sections sheet at 320×256: ${JSON.stringify(sheet)}`
        );
        await ctx.close();
      }
      // #100: Find's field stays in view across a rotation.
      {
        const { ctx, page } = await boot({ theme: 'light', phone: true });
        await setDraft(page, DRAFT);
        await page.click('[data-ui="ly-find-open"]');
        await page.waitForSelector('#ly-find-input', { state: 'visible' });
        await page.focus('#ly-find-input');
        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(400);
        const where = await page.evaluate(() => {
          const r = $ui('ly-find-input').getBoundingClientRect();
          return {
            focus: document.activeElement?.id,
            inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
            top: Math.round(r.top),
          };
        });
        check(
          where.focus === 'ly-find-input' && where.inView,
          `after rotating, Find's focused field is off-screen: ${JSON.stringify(where)}`
        );
        await ctx.close();
      }
    });
    // R22 (Jony #107): a pair of words, "a ~ b", is heard "a with b"; the
    // tilde is for the eye only (it was read "tilde"). Both places that print
    // one: the declared groups in Rhymes and the checked pairs under them.
    await step('R22. pair separator is spoken as "with"', async () => {
      const { ctx, page } = await boot({ theme: 'light' });
      await setDraft(page, DRAFT);
      await page.evaluate(() => {
        LY.results.rhymes = {
          pairs: [{ a: 'night', b: 'light', refused: false, codes: [], relations: ['perfect'] }],
          baseId: null,
        };
        LY_ACTIONS['ly-tool']('rhymes');
        lyRefresh(true);
      });
      await page.waitForTimeout(150);
      const seps = await page.evaluate(() => {
        const out = [];
        const walk = document.createTreeWalker($ui('surface-lyrics'), NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          if (!n.nodeValue.includes('~') || !n.parentElement.getClientRects().length) continue;
          const hidden = n.parentElement.closest('[aria-hidden="true"]');
          out.push({
            text: n.parentElement.closest('strong, small')?.textContent.trim() || n.nodeValue,
            hidden: !!hidden,
            spoken: hidden?.nextElementSibling?.matches('.ly-sr')
              ? hidden.nextElementSibling.textContent
              : '',
          });
        }
        return out;
      });
      check(
        seps.length >= 2 && seps.every((s) => s.hidden && s.spoken.trim() === 'with'),
        `a pair separator is read as "tilde": ${JSON.stringify(seps.slice(0, 4))}`
      );
      await ctx.close();
    });

    await step('10. expired saved request and New conversation', async () => {
      const KEY = 'codex-musica-chat-v2:https://mcp.codexmusica.com';
      const stuck = async ({ status, backup = false }) => {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const id = (status === 404 ? 'e' : 'f').repeat(64);
        await ctx.route(/mcp\.codexmusica\.com/, (r) => {
          if (/\/chat\/jobs\//.test(r.request().url()))
            return r.fulfill({
              status,
              contentType: 'application/json',
              body: JSON.stringify({
                error: status === 404 ? 'No retained receipt.' : 'Unavailable.',
              }),
            });
          return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
        });
        await ctx.addInitScript(
          ([key, id, backup]) => {
            if (sessionStorage.getItem('seeded')) return;
            sessionStorage.setItem('seeded', '1');
            const v = JSON.stringify({
              task: { domain: 'lyrics', phase: 'edit' },
              continuationId: id,
            });
            localStorage.setItem(key, v);
            if (backup) localStorage.setItem(key + ':lyrics', v);
          },
          [KEY, id, backup]
        );
        const page = await ctx.newPage();
        page.on('pageerror', (e) => pageErrors.push(e.message));
        await page.goto(url);
        await page.waitForFunction(
          () => typeof UI !== 'undefined' && UI.ready && !!LY.model,
          null,
          {
            timeout: 60000,
          }
        );
        await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
        return { ctx, page, id };
      };
      const state = (page) =>
        page.evaluate((key) => {
          LY_ACTIONS['ly-tab']('writer');
          return {
            unknown: lyWriterState().unknown,
            pending: chatState.pending?.request_id || null,
            archived: chatState.archives.map((a) => a.request_id),
            options: lyToolRequestAction('ly-pron-options', 'Get dictionary options', 'search'),
            writer: $ui('ly-writer-status')?.innerText || '',
            backup: localStorage.getItem(key + ':lyrics'),
          };
        }, KEY);
      const reload = async (page) => {
        await page.reload();
        await page.waitForFunction(
          () => typeof UI !== 'undefined' && UI.ready && !!LY.model,
          null,
          {
            timeout: 60000,
          }
        );
        await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      };

      {
        const { ctx, page, id } = await stuck({ status: 404 });
        let s = await state(page);
        check(
          !s.unknown && !s.pending,
          'an expired receipt (404) still leaves the outcome unknown'
        );
        check(s.archived.includes(id), 'an expired receipt was dropped instead of set aside');
        check(
          /Get dictionary options/.test(s.options),
          'pronunciation options stay hidden after a 404'
        );
        await reload(page);
        s = await state(page);
        check(!s.unknown && !s.pending, 'an expired receipt re-arms on the next load');
        await ctx.close();
      }
      {
        const { ctx, page, id } = await stuck({ status: 503 });
        const s = await state(page);
        check(
          s.unknown && s.pending === id,
          'a 503 (persistence down) dropped an unsettled ticket'
        );
        await ctx.close();
      }
      {
        const { ctx, page } = await stuck({ status: 503, backup: true });
        let s = await state(page);
        check(
          s.unknown && /Outcome unknown/.test(s.writer),
          'the stuck fixture did not start stuck'
        );
        await page.locator('#chat-reset').click();
        // Read the open Writer panel before anything else renders it.
        const shown = await page.evaluate(() => $ui('ly-writer-status')?.innerText || '');
        check(!/Outcome unknown/.test(shown), 'New conversation left the panel unredrawn');
        s = await state(page);
        check(!s.unknown, 'New conversation left the outcome unknown');
        check(s.backup === null, 'New conversation kept the writer-switch copy');
        await reload(page);
        s = await state(page);
        check(
          !s.unknown && !s.pending,
          'the old request came back after New conversation and a reload'
        );
        check(
          /Get dictionary options/.test(s.options),
          'pronunciation options hidden after New conversation'
        );
        await ctx.close();
      }
    });

    // U. Undo in the draft is the page's one history, a typing run per step
    // (Jony #79: the read layer's redraw broke Chromium's native typing group,
    // so Ctrl+Z took back one character a press); Undo and Redo say what they
    // did, and a toolbar button that runs out hands focus on (Jony #76).
    await step('U. draft undo runs, announcements and focus', async () => {
      const { ctx, page } = await boot({ theme: 'light' });
      const BASE = 'Hold the light\nRiver runs';
      await setDraft(page, BASE);
      const live = async () => {
        await page.waitForTimeout(120);
        return page.evaluate(() => $ui('ly-live')?.textContent || '');
      };
      const state = () =>
        page.evaluate(() => {
          const d = $ui('lyrics-draft');
          const a = document.activeElement;
          return {
            value: d.value,
            caret: d.selectionStart,
            focus: a === d ? 'draft' : a === document.body ? 'BODY' : a?.dataset?.ui || a?.tagName,
          };
        });
      await page.click('#lyrics-draft');
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' word', { delay: 30 });
      await page.keyboard.press('Control+z');
      let s = await state();
      check(
        s.value === BASE,
        `Ctrl+Z after typing " word" left ${JSON.stringify(s.value.slice(-8))}, not the text before the run`
      );
      check(s.focus === 'draft', `Ctrl+Z moved focus to ${s.focus}`);
      check(s.caret === BASE.length, `Ctrl+Z put the caret at ${s.caret}, not where the run was`);
      check((await live()) === 'Undone', 'Ctrl+Z in the draft did not say "Undone"');
      await page.keyboard.press('Control+Shift+z');
      s = await state();
      check(s.value === BASE + ' word', `Ctrl+Shift+Z gave ${JSON.stringify(s.value.slice(-8))}`);
      check((await live()) === 'Redone', 'Ctrl+Shift+Z in the draft did not say "Redone"');
      // A pause closes the run: the second run goes back alone.
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' again', { delay: 30 });
      await page.waitForTimeout(1300);
      await page.keyboard.type(' more', { delay: 30 });
      await page.keyboard.press('Control+z');
      s = await state();
      check(
        s.value === BASE + ' word again',
        `after a pause Ctrl+Z gave ${JSON.stringify(s.value.slice(-12))}, not the run before it`
      );
      // A paste is a step of its own.
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' x', { delay: 30 });
      await page.evaluate(() => {
        const d = $ui('lyrics-draft');
        const ev = new InputEvent('beforeinput', {
          inputType: 'insertFromPaste',
          data: ' pasted',
          bubbles: true,
          cancelable: true,
        });
        if (d.dispatchEvent(ev)) {
          d.setRangeText(' pasted', d.selectionStart, d.selectionEnd, 'end');
          d.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
        }
      });
      await page.keyboard.press('Control+z');
      s = await state();
      check(
        s.value === BASE + ' word again x',
        `Ctrl+Z after a paste gave ${JSON.stringify(s.value.slice(-14))}, not the text before the paste`
      );
      // The toolbar: Undo to the oldest step and Redo to the newest by keys;
      // focus is never left on the page, and each step is said.
      const press = async (act) => {
        const seen = [];
        await page.focus(`#ly-toolbar [data-ui="${act}"]`);
        for (let k = 0; k < 80; k++) {
          const off = await page.evaluate(
            (a) => document.querySelector(`#ly-toolbar [data-ui="${a}"]`).disabled,
            act
          );
          if (off) break;
          await page.keyboard.press('Enter');
          seen.push((await state()).focus);
        }
        return seen;
      };
      const undos = await press('ly-undo');
      check(undos.length > 0, 'toolbar Undo was never available');
      check(!undos.includes('BODY'), `toolbar Undo dropped focus to BODY (${undos.join(' ')})`);
      check(undos.at(-1) === 'ly-redo', `the last Undo left focus on ${undos.at(-1)}, not Redo`);
      check((await live()) === 'Undone', 'toolbar Undo did not say "Undone"');
      const redos = await press('ly-redo');
      check(!redos.includes('BODY'), `toolbar Redo dropped focus to BODY (${redos.join(' ')})`);
      check(redos.at(-1) === 'ly-undo', `the last Redo left focus on ${redos.at(-1)}, not Undo`);
      check((await live()) === 'Redone', 'toolbar Redo did not say "Redone"');
      check(
        (await state()).value === BASE + ' word again x pasted',
        'Redo to the newest step did not restore the pasted text'
      );
      await ctx.close();
    });

    // U2. Two edges of the typing runs (second review of b7ba5a0f2): text
    // moved by dragging it inside the draft is one Undo step (Chromium sends
    // deleteByDrag, then insertFromDrop; each was a step, so one Undo left
    // the moved words deleted), and while a new run is open the toolbar does
    // not offer the Redo that run has already replaced.
    await step('U2. drag-move is one step; an open run drops Redo', async () => {
      const { ctx, page } = await boot({ theme: 'light' });
      const BASE = 'Hold the light\nRiver runs';
      const val = () => page.evaluate(() => $ui('lyrics-draft').value);
      const edit = (type, text, from, to) =>
        page.evaluate(
          ([type, text, from, to]) => {
            const d = $ui('lyrics-draft');
            d.setSelectionRange(from < 0 ? d.value.length : from, to < 0 ? d.value.length : to);
            const ev = new InputEvent('beforeinput', {
              inputType: type,
              data: text,
              bubbles: true,
              cancelable: true,
            });
            if (!d.dispatchEvent(ev)) return;
            d.setRangeText(text, d.selectionStart, d.selectionEnd, 'end');
            d.dispatchEvent(
              new InputEvent('input', { inputType: type, data: text, bubbles: true })
            );
          },
          [type, text, from, to]
        );
      await setDraft(page, BASE);
      await page.click('#lyrics-draft');
      await edit('deleteByDrag', '', 0, 5);
      await edit('insertFromDrop', ' Hold', -1, -1);
      const moved = await val();
      await page.keyboard.press('Control+z');
      const back = await val();
      check(
        moved === 'the light\nRiver runs Hold' && back === BASE,
        `one Undo after moving "Hold " by drag gave ${JSON.stringify(back)}, not the text before the move`
      );
      await page.keyboard.press('Control+Shift+z');
      check((await val()) === moved, 'Redo did not bring the moved text back in one step');
      // Undo, then type: the new run replaces the Redo step at once.
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' r1', { delay: 30 });
      await page.keyboard.press('Control+z');
      await page.keyboard.type(' r2', { delay: 30 });
      const typing = await page.evaluate(() => ({
        redo: document.querySelector('#ly-toolbar [data-ui="ly-redo"]')?.disabled,
        undo: document.querySelector('#ly-toolbar [data-ui="ly-undo"]')?.disabled,
      }));
      check(
        typing.redo === true && typing.undo === false,
        `while a new run is open the toolbar offered Redo=${!typing.redo}, Undo=${!typing.undo}`
      );
      await page.keyboard.press('Control+Shift+z');
      await page.waitForTimeout(120);
      check(
        (await val()).endsWith(' r2') &&
          (await page.evaluate(() => $ui('ly-live').textContent)) === 'Nothing to redo',
        'Redo after new typing did not keep the typing and say "Nothing to redo"'
      );
      await ctx.close();
    });
    // M2. The phone's Line actions menu lives in the line dock, which is
    // redrawn whenever the history moves: its own Undo, or any step while it
    // is open, replaced the item in focus (focus to <body>, the menu shut
    // under the person, LY.menu left set). It stays open, on that item. A
    // tool chosen from it closes it (LY.menu was left 'line-actions').
    // Second review of lyrics-menus-sr 0dda776ba.
    await step('M2. Line actions survives a dock redraw', async () => {
      for (const how of ['keyboard', 'pointer']) {
        const { ctx, page } = await boot({ theme: 'light', phone: true });
        const where = () =>
          page.evaluate(() => {
            const a = document.activeElement;
            const menu = $ui('ly-menu-line-actions');
            return {
              inMenu: !!menu && !menu.hidden && menu.contains(a),
              item: a?.dataset?.ui || (a === document.body ? 'BODY' : a?.tagName),
              menu: LY.menu,
              open: [...document.querySelectorAll('#surface-lyrics .ly-menu:not([hidden])')].length,
            };
          });
        const sel = '#ly-linedock [aria-controls="ly-menu-line-actions"]';
        const press = async (selector) => {
          if (how === 'keyboard') {
            await page.focus(selector);
            await page.keyboard.press('Enter');
          } else await page.click(selector);
          await page.waitForTimeout(200);
        };
        const song = () =>
          page.evaluate(() => {
            LY_ACTIONS['ly-mobile']('song');
            lyScrollToLine(2);
            lySyncCaret();
            lyRefresh(true);
          });
        await setDraft(page, DRAFT);
        await page.evaluate(() => {
          const d = $ui('lyrics-draft');
          d.value += '\nOne more line';
          uiSaveLyrics();
          pushHistory();
        });
        await song();
        await press(sel);
        await press('#ly-menu-line-actions [data-ui="ly-undo"]');
        const undone = await where();
        check(
          undone.inMenu && undone.menu === 'line-actions',
          `${how}: Undo from Line actions dropped focus or shut the menu: ${JSON.stringify(undone)}`
        );
        await page.evaluate(() => {
          app.workspaceName = 'Renamed while the menu is open';
          pushHistory();
          lyRefresh(true);
        });
        await page.waitForTimeout(200);
        const moved = await where();
        check(
          moved.inMenu && moved.menu === 'line-actions',
          `${how}: a history step under the open Line actions dropped it: ${JSON.stringify(moved)}`
        );
        await page.keyboard.press('Escape');
        await song();
        await press(sel);
        await press('#ly-menu-line-actions [data-ui="ly-line-tool"]');
        const tool = await where();
        check(
          tool.menu === '' && tool.open === 0 && tool.item === 'ly-tool',
          `${how}: a tool chosen from Line actions left the menu set: ${JSON.stringify(tool)}`
        );
        await ctx.close();
      }
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
  if (!flags['browser-only']) {
    unitWriterPayload();
    await unitSavedReadings();
    await unitVoicesBasis();
    await unitPolicyA();
    await unitBoundaries();
    unitEndIdentity();
    unitFormOrder();
    unitHeadersAndIdentity();
  }
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
  if (flags['browser-only'] || flags['browser-filter']) {
    console.log(
      `LYRICS PAGE: PASS — ${checks} assertions (fixture replies, no provider; browser filter: ${flags['browser-filter'] || 'all'}; units ${flags['browser-only'] ? 'skipped' : 'included'})`
    );
    process.exit(0);
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
