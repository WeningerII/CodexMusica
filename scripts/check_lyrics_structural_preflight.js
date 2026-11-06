'use strict';
// Real page parser/actions in a VM; host save/focus/render effects are recorded.
// This is not browser, screen-reader or durable-storage qualification.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..');

async function checkStructural(sourcePath = path.join(ROOT, 'src/pages/lyrics.js')) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  let checks = 0;
  const eq = (a, b) => {
    checks++;
    assert.deepEqual(a === undefined ? a : JSON.parse(JSON.stringify(a)), b);
  };
  const ok = (v, message) => {
    checks++;
    assert.ok(v, message);
  };
  function context(text, src = source) {
    const draft = { value: text, selectionStart: 7, selectionEnd: 9 };
    const calls = [],
      toasts = [],
      focused = { id: 'initiator' };
    const app = {
      lyrics: text,
      lyricMeta: { version: 1, draftId: 'draft:test', ui: {}, notes: {} },
      cards: [],
      history: [],
      historyIndex: -1,
    };
    const c = vm.createContext({
      console,
      setTimeout: () => 0,
      clearTimeout() {},
      $ui: (id) => (id === 'lyrics-draft' ? draft : null),
      uiRegisterPage() {},
      uiCount: (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`,
      app,
      UI: {},
      chatState: { generation: 0, busy: false, lyric: null },
      lyricMetaOf: (x) => JSON.parse(JSON.stringify(x)),
      uiChatSessions: new Map(),
      document: {
        activeElement: focused,
        getElementById: (id) => (id === 'lyrics-draft' ? draft : null),
      },
      uiSaveLyrics() {
        calls.push('save');
        app.lyrics = draft.value;
      },
      pushHistory() {
        calls.push('history');
        app.history.push(draft.value);
      },
      showToast(message, tone) {
        calls.push('toast');
        toasts.push({ message, tone });
      },
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/lyric-tokens.js'), 'utf8'), c);
    vm.runInContext(src, c);
    const run = (s, vars = {}) => {
      Object.assign(c, vars);
      return vm.runInContext(s, c);
    };
    c.lyRefresh = () => {
      calls.push('refresh');
      run('LY.model = lyParse(lyDraft().value)');
    };
    c.lyFocusSectionControl = (index) => {
      calls.push('focus');
      c.document.activeElement = { index };
    };
    run('LY.model = lyParse(lyDraft().value); LY.picks.formSec = 0');
    const start = src.indexOf("surface.addEventListener('drop', (e) => {");
    const end = src.indexOf("\n  document.addEventListener('click'", start);
    assert(start >= 0 && end > start);
    run(src.slice(start, end), {
      surface: {
        addEventListener: (_, handler) => {
          c.drop = handler;
        },
      },
    });
    return { c, run, draft, calls, toasts, app, focused };
  }
  const song =
    '[CHORUS]\nI lead you home\nWe watch the rain\n\n[VERSE]\nThe road bends east\nA lantern lights the lane\n\n[CHORUS]\nI lead you home\nWe watch the rain';
  const decl = '[SETUP — rhyme groups — 2,4,6]\n[SETUP — returns — 1,5;2,6]\n';
  const full = decl + song;
  // Failing-before behavior, independent of the new return-value API.
  const loss = context(full);
  loss.run("LY_ACTIONS['ly-sec-remove']('1')");
  eq(loss.draft.value, full);
  eq(loss.app.lyrics, full);
  eq(loss.app.history, []);
  const moved = context(full);
  eq(moved.run('lyEditSections(({blocks}) => { blocks.push(blocks.shift()); }, "Moved.")'), {
    applied: true,
    refused: [],
  });
  eq(moved.run('lyDeclarationsOf(lyParse(lyDraft().value))'), {
    groups: '6,2,4',
    returns: '5,3;6,4',
  });
  eq(moved.calls, ['save', 'history', 'refresh', 'toast']);
  eq(moved.toasts, [{ message: 'Moved.', tone: 'success' }]);
  const control = context(full);
  control.run('lyEditSections(({blocks}) => { blocks.push(blocks.splice(1,1)[0]); }, "Moved.")');
  eq(control.run('lyDeclarationsOf(lyParse(lyDraft().value))'), {
    groups: '2,6,4',
    returns: '1,3;2,4',
  });
  const placed = context(
    '[SETUP — rhyme groups — 2.T2,4.T2,6.T2 — numbering v2 — cut v2]\n[SETUP — returns — 1.head,5.head]\n' +
      song
  );
  placed.run('lyEditSections(({blocks}) => { blocks.push(blocks.shift()); }, "Moved.")');
  eq(placed.run('lyDeclarationsOf(lyParse(lyDraft().value))'), {
    groups: '6.T2,2.T2,4.T2',
    returns: '5.head,3.head',
    numbering: 'v2',
  });

  const refusal = (h, operation, named) => {
    const before = h.draft.value,
      saved = h.app.lyrics;
    const result = h.run(operation);
    eq(result.applied, false);
    ok(
      result.refused.some((x) => x.includes(named)),
      JSON.stringify(result)
    );
    eq(h.draft.value, before);
    eq(h.app.lyrics, saved);
    eq(h.app.history, []);
    eq(h.calls, ['toast']);
    eq(h.toasts.length, 1);
    eq(h.toasts[0].tone, 'error');
    eq(h.run('LY.picks.formSec'), 0);
    ok(h.c.document.activeElement === h.focused, 'refusal changed focus');
    eq([h.draft.selectionStart, h.draft.selectionEnd], [7, 9]);
  };
  refusal(context(full), "LY_ACTIONS['ly-sec-dup']('0')", 'returns');
  refusal(context(full), "LY_ACTIONS['ly-sec-remove']('0')", 'returns');
  refusal(context(full), "LY_ACTIONS['ly-sec-remove']('1')", 'rhyme groups');
  refusal(context(full), "LY_ACTIONS['ly-make-return']('2:0')", 'returns');
  // Setup parsing trims surrounding whitespace; occurrence counting must use
  // the same identity without changing raw serialization or losing duplicates.
  for (const padding of ['  ', '\t']) {
    const padded = context(`${padding}[SETUP — title — Test]${padding}\n` + song);
    eq(padded.run("LY_ACTIONS['ly-sec-move']('0:1').applied"), true);
    eq(padded.run("lySetupOf(LY.model, 'title').map(d => d.value)"), ['Test']);
    ok(padded.draft.value.includes(`${padding}[SETUP — title — Test]${padding}`));
    for (const op of ["LY_ACTIONS['ly-sec-remove']('0')", "LY_ACTIONS['ly-sec-dup']('0')"]) {
      const duplicate = context(
        '[SETUP — title — Test]\n[VERSE]\nHello\n' +
          `${padding}[SETUP — title — Test]${padding}\n[CHORUS]\nWorld`
      );
      refusal(duplicate, op, 'title: Test');
    }
  }
  // Empty declarations must not disappear in serialization; an unknown cut
  // cannot acquire freshly interpreted physical members through an edit.
  for (const [row, named] of [
    ['[SETUP — returns — ]', 'returns'],
    ['[SETUP — returns — ;]', 'returns'],
    ['[SETUP — rhyme groups — ]', 'rhyme groups'],
    ['[SETUP — placement — ]', 'placement'],
    ['[SETUP — placement — broken]', 'placement'],
    ['[SETUP — placement — 1:1:1:4;broken]', 'placement'],
    ['[SETUP — returns — broken]', 'returns'],
    ['[SETUP — returns — 1]', 'returns'],
    ['[SETUP — returns — 1,5 — cut alien]', 'returns'],
    ['[SETUP — rhyme groups — 2,4 — numbering alien]', 'rhyme groups'],
  ]) {
    for (const action of ["LY_ACTIONS['ly-label-stanzas']()", "LY_ACTIONS['ly-sec-move']('0:1')"]) {
      refusal(context(row + '\n' + song), action, named);
    }
  }
  for (const [row, named] of [
    ['[SETUP — future — payload]', 'future: payload'],
    ['[SETUP — returns — 0,2]', 'returns'],
    ['[SETUP — returns — 999999999999999999999999,2]', 'returns'],
    ['[SETUP — returns — broken]', 'returns'],
    ['[SETUP — placement — broken]', 'timing: broken'],
    ['[SETUP — reading — ]', 'reading'],
    ['[SETUP — hook — ]', 'hook'],
    ['[SETUP — narrative — ]', 'narrative'],
  ]) {
    refusal(context(row + '\n' + song), "LY_ACTIONS['ly-sec-move']('0:1')", named);
  }
  for (const header of ['[INTRO — unrecognized payload]', '[INTRO — ]']) {
    refusal(context(header + '\n' + song), "LY_ACTIONS['ly-sec-remove']('0')", header);
  }
  const timed = '[SETUP — placement — 3:5:1:4]\n' + song;
  refusal(context(timed), "LY_ACTIONS['ly-sec-move']('0:1')", 'timing');
  const drag = context(timed);
  drag.run('LY.dragFrom = 0');
  refusal(drag, "drop({target:{closest:()=>({dataset:{sec:'2'}})},preventDefault(){}})", 'timing');
  refusal(
    context('[SETUP — narrative — ANCHOR,ESTABLISH/THEREFORE,ANCHOR/THEREFORE]\n' + song),
    "LY_ACTIONS['ly-sec-move']('0:1')",
    'narrative'
  );
  for (const operation of [
    "LY_ACTIONS['ly-sec-remove']('0')",
    "LY_ACTIONS['ly-sec-move']('0:1')",
    "LY_ACTIONS['ly-sec-dup']('0')",
  ]) {
    refusal(context('[INTRO — 4 bars]\n' + song), operation, '[INTRO — 4 bars]');
  }
  const emptyDrag = context('[INTRO — 4 bars]\n' + song);
  emptyDrag.run('LY.dragFrom = 0');
  refusal(
    emptyDrag,
    "drop({target:{closest:()=>({dataset:{sec:'2'}})},preventDefault(){}})",
    '[INTRO — 4 bars]'
  );
  for (const operation of [
    "LY_ACTIONS['ly-sec-remove']('0')",
    "LY_ACTIONS['ly-sec-move']('0:1')",
  ]) {
    eq(context('[INTRO]\n' + song).run(operation).applied, true);
  }
  eq(context('[INTRO — 4 bars]\n' + song).run("LY_ACTIONS['ly-sec-dup']('3').applied"), true);
  // Build the declaration through the actual form, then validate its parser.
  const narrative = context(song);
  const storyText = narrative.run(`(() => {
    const v = {'atom.0':'ANCHOR','atom.1':'ESTABLISH','junction.1':'THEREFORE','atom.2':'ANCHOR','junction.2':'THEREFORE'};
    const result = LY_FORMS['form-story'].apply(lyParse(lyDraft().value), null, v, Object.keys(v), {});
    return result.text;
  })()`);
  ok(typeof storyText === 'string', 'story form must produce text');
  const story = context(storyText);
  eq(story.run("lyParseNarrative(lySetupOf(LY.model, 'narrative')[0].value).ok"), true);
  const assignments =
    'lySungSections(lyParse(lyDraft().value)).map(s => [s.sung.map(r=>r.text), lyStorySteps(lyParse(lyDraft().value)).steps.get(s.index)])';
  const originalStory = JSON.parse(JSON.stringify(story.run(assignments)));
  eq(story.run("LY_ACTIONS['ly-label-stanzas']().applied"), true);
  eq(story.run(assignments), originalStory);
  refusal(context(storyText), "LY_ACTIONS['ly-make-return']('2:0')", 'narrative');
  eq(
    context('[SETUP — narrative — off]\n' + song).run("LY_ACTIONS['ly-sec-move']('0:1').applied"),
    true
  );
  eq(context(song).run("LY_ACTIONS['ly-label-stanzas']().applied"), true);
  // Same valid import envelope as test_library_import.js, through validation.
  const api = require('../src/library-import.js');
  const { webcrypto } = require('node:crypto');
  const envelope = {
    protocol: api.PROTOCOL,
    version: 1,
    handoffId: 'handoff:one',
    draftId: 'draft:imported',
    createdAt: '2026-10-08T00:00:00Z',
    payload: {
      text: 'The evening wind\nReturns the song',
      title: 'Test reading',
      language: 'eng',
      scope: 'whole',
      provenance: {
        snapshotId: 'snapshot:one',
        unitId: 'unit:one',
        workId: 'work:one',
        editionId: 'edition:one',
        revisionId: 'revision:one',
        rights: { attribution: 'Source credit', notices: ['First notice', 'Second notice'] },
      },
      lineage: [{ row: 1, sourceLine: 12, sourceStart: 100, sourceEnd: 116 }],
      declarations: [],
    },
  };
  envelope.digest = await api.envelopeDigest(envelope, webcrypto);
  const importedDraft = api.importedDraft(await api.validateEnvelope(envelope, webcrypto), 1);
  const imported = context(importedDraft.text);
  imported.app.lyricMeta = importedDraft.meta;
  const importedMeta = JSON.parse(JSON.stringify(imported.app.lyricMeta));
  refusal(imported, "LY_ACTIONS['ly-label-stanzas']()", 'Library source details');
  eq(imported.app.lyricMeta, importedMeta);

  // Unreferenced clone/delete must work, not just the refusal controls.
  const extra = '\n\n[VERSE]\nClouds gather above the hill\nThe gate stands open';
  for (const action of ['ly-sec-dup', 'ly-sec-remove']) {
    const h = context(full + extra);
    eq(h.run(`LY_ACTIONS['${action}']('3').applied`), true);
    eq(h.run('lyDeclarationsOf(lyParse(lyDraft().value))'), {
      groups: '2,4,6',
      returns: '1,5;2,6',
    });
    eq(h.run('lyParse(lyDraft().value).sung.length'), action === 'ly-sec-dup' ? 10 : 6);
    eq(h.app.history.length, 1);
    eq(h.toasts.length, 1);
    eq(h.toasts[0].tone, 'success');
  }
  const read =
    '[SETUP — reading — token 2 "lead" in "I lead you home" — L IY1 D — declared — source: fixture — numbering v2 — cut v2]';
  const hook = '[SETUP — hook — "I lead you home"]';
  const readings = context(read + '\n' + hook + '\n' + song);
  const beforeRead = readings.run('lyDeclarationsOf(LY.model)');
  readings.run('lyEditSections(({blocks}) => { blocks.push(blocks.shift()); }, "Moved.")');
  eq(readings.run('lyDeclarationsOf(LY.model)'), JSON.parse(JSON.stringify(beforeRead)));
  eq(readings.run('lyDeclarationsOf(LY.model).pronunciations.length'), 1);
  refusal(context(read + '\n' + song), "LY_ACTIONS['ly-sec-remove']('0')", 'reading');
  refusal(context(hook + '\n' + song), "LY_ACTIONS['ly-sec-dup']('0')", 'hook');
  const unique = context(
    read.replace('I lead you home', 'I lead the chorus') +
      '\n' +
      song.replace('The road bends east', 'I lead the chorus')
  );
  unique.run('lyEditSections(({blocks}) => { blocks.push(blocks.splice(1,1)[0]); }, "Moved.")');
  eq(unique.run('lyDeclarationsOf(LY.model).pronunciations.map(r => [r.line,r.token])'), [
    ['I lead the chorus', 2],
  ]);

  // Force a refusal at the seam: each caller must propagate it and must not
  // do its post-success selection/focus work. Removing any guard fails here.
  const callers = [
    "LY_ACTIONS['ly-sec-move']('0:1')",
    "LY_ACTIONS['ly-sec-dup']('0')",
    "LY_ACTIONS['ly-sec-remove']('0')",
    "LY_ACTIONS['ly-label-stanzas']()",
    "LY_ACTIONS['ly-make-return']('2:0')",
    "drop({target:{closest:()=>({dataset:{sec:'2'}})},preventDefault(){}})",
  ];
  for (const action of callers) {
    const h = context(song);
    h.run('LY.dragFrom = 0; lyEditSections = () => ({applied:false,refused:["sentinel"]})');
    eq(h.run(action), { applied: false, refused: ['sentinel'] });
    eq(h.calls, []);
    eq(h.run('LY.picks.formSec'), 0);
    ok(h.c.document.activeElement === h.focused);
  }
  // Successful label/make-return controls exercise the other two callers.
  for (const action of [
    "LY_ACTIONS['ly-label-stanzas']()",
    "LY_ACTIONS['ly-make-return']('1:0')",
  ]) {
    const h = context(song);
    eq(h.run(action).applied, true);
    eq(h.app.history.length, 1);
  }

  // Staleness is the actual identity consumer, not a second review-state flag.
  const stale = context(full);
  stale.run(
    'LY.run = {artifact:{certified:true},completion:{certified:true},resultId:lyIdentity(LY.model),final:lySungTexts(LY.model),baseModel:LY.model,resultModel:LY.model}'
  );
  eq(stale.run('lyRunStatus(LY.run).certified'), true);
  stale.run('lyEditSections(({blocks}) => { blocks.push(blocks.shift()); }, "Moved.")');
  eq(stale.run('lyRunStatus(LY.run).word'), 'Last run certified an earlier draft');
  // Library document serialization/reparse is separate from saved-session text.
  const runRecord = stale.run('lyLibraryRunOut(LY.run)');
  const restored = context(stale.app.lyrics);
  restored.run('LY.run = lyLibraryRunIn(record)', {
    record: JSON.parse(JSON.stringify(runRecord)),
  });
  eq(restored.run('lyRunStatus(LY.run).word'), 'Last run certified an earlier draft');
  eq(restored.run('lyDeclarationsOf(LY.model)'), { groups: '6,2,4', returns: '5,3;6,4' });
  // Saved-session text uses a fresh page parse independently of Library run data.
  const session = context(JSON.parse(JSON.stringify({ lyrics: stale.app.lyrics })).lyrics);
  eq(session.run('lyDeclarationsOf(LY.model)'), { groups: '6,2,4', returns: '5,3;6,4' });

  // Execute the shipped history serializer/Undo/Redo, with only recipe/DOM
  // painting dependencies stubbed. No alternate history implementation.
  const appSource = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const historySource = appSource.slice(
    appSource.indexOf('const LYRIC_META_LIMITS='),
    appSource.indexOf('function updateHistoryButtons()')
  );
  const history = context(full);
  history.run(historySource, {
    _CARD_TRANSIENTS: {},
    HISTORY_MAX: 50,
    musicalWorkspaceKey: () => '',
    recipeEditSnapshot() {},
    updateHistoryButtons() {},
    _historyFocusHandoff() {},
    renderAll: () => history.run('LY.model = lyParse(lyDraft().value)'),
  });
  history.run('pushHistory()');
  history.run('lyEditSections(({blocks}) => { blocks.push(blocks.shift()); }, "Moved.")');
  const after = history.draft.value;
  eq(history.app.history.length, 2);
  history.run('undo()');
  eq(history.draft.value, full);
  eq(history.run('lyDeclarationsOf(LY.model)'), { groups: '2,4,6', returns: '1,5;2,6' });
  history.run('redo()');
  eq(history.draft.value, after);
  eq(history.run("LY_ACTIONS['ly-sec-remove']('2').applied"), false);
  eq(history.app.history.length, 2);
  history.run('undo()');
  eq(history.draft.value, full);

  // Saved-session boot restore is its actual consumer; storage is a string
  // double, not a claim of browser persistence or a reload journey.
  const workbench = fs.readFileSync(path.join(ROOT, 'src/workbench.js'), 'utf8');
  const restoreSource = workbench.slice(
    workbench.indexOf('function uiRestoreSession()'),
    workbench.indexOf('function uiAutosave()')
  );
  for (const text of [full, after]) {
    const h = context('');
    const record = JSON.stringify({ cards: [], lyrics: text, lyricMeta: { version: 1 } });
    h.run(restoreSource, {
      localStorage: { getItem: () => record },
      sessionStorage: { getItem: () => null },
      storedSessionText: () => record,
      normalizeWorkspaceCards: (x) => x,
    });
    h.run('uiRestoreSession(); LY.model = lyParse(lyDraft().value)');
    eq(h.draft.value, text);
    eq(h.app.lyrics, text);
    eq(h.run('lyDeclarationsOf(LY.model).returns'), text === full ? '1,5;2,6' : '5,3;6,4');
    eq(h.run('LY.run'), null); // boot never invents a current certification
  }

  // Library capture/activation is independent of the session boot consumer.
  // The store and navigation are doubles; declaration parsing and migration
  // are real, as are run document serialization and stale-review evaluation.
  const libraryRecord = stale.run('lyLibraryCapture()');
  const library = context('');
  library.run('lyLibraryDetachWriter = () => {}; lyLibraryStore = {listDrafts: async () => []}', {
    uiAutosave() {},
    uiNavigate() {},
  });
  await library.run('lyLibraryActivate(record, {restored:true})', {
    record: JSON.parse(JSON.stringify(libraryRecord)),
  });
  eq(library.draft.value, stale.draft.value);
  eq(library.run('lyDeclarationsOf(LY.model).returns'), '5,3;6,4');
  eq(library.run('lyRunStatus(LY.run).word'), 'Last run certified an earlier draft');
  // Import the current engine, not extracted/reimplemented classification.
  // No dictionary, timing or stub expansion is requested by this fixture.
  const variation = JSON.parse(
    execFileSync(
      'python3',
      [
        '-B',
        '-c',
        `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'lyric-harness'))})
from quality.grid import compare_returns
from quality.schemes import parse_returns
a = ['I lead you home', 'We watch the rain', 'We wait until dawn']
b = ['I lead you home', 'We watch the rain']
out = []
for first, again in [(a,b), (b,a)]:
    r = compare_returns(first, again, stub_test=lambda line: False)
    out.append([r.kind, r.describe().splitlines()[0], r.line_distance, r.token_distance,
                r.rhyme_scheme_preserved, r.tune_slot_preserved, [f.code for f in r.refusals]])
assert [r.pairs() for r in parse_returns('5,3;6,4', n_lines=6)] == [[(3,5)],[(4,6)]]
print(json.dumps(out))
`,
      ],
      { encoding: 'utf8' }
    )
  );
  eq(variation, [
    [
      'TRUNCATED_RETURN',
      'return: TRUNCATED_RETURN -- the return is a strict sub-sequence of the first, every kept line verbatim -- the last-chorus cut',
      1,
      4,
      null,
      null,
      ['NO_RHYME_KEY'],
    ],
    [
      'EXTENDED_RETURN',
      'return: EXTENDED_RETURN -- the first is a strict sub-sequence of the return -- the added bar on the last return',
      1,
      4,
      null,
      null,
      ['NO_RHYME_KEY'],
    ],
  ]);
  // Bounded exhaustive VM regression: 3 declaration locations × 2 timing
  // modes × (5! permutations + 5 deletions + 5 × 6 clone insertion slots).
  // Oracle IDs are declared here, not recovered from production parsing or
  // its remapping helper. A1 and A2 deliberately have identical words.
  const sectionRows = [
    ['[CHORUS]', 'I lead you home', 'We watch the rain'],
    ['[VERSE]', 'The road bends east', 'A lantern lights the lane'],
    ['[CHORUS]', 'I lead you home', 'We watch the rain'],
    ['[INTRO]'],
    ['[VERSE]', 'Clouds gather above the hill', 'The gate stands open'],
  ];
  const occurrenceIds = [[1, 2], [3, 4], [5, 6], [], [7, 8]];
  const groupMembers = [
    [
      [1, 'T2'],
      [3, 'head'],
      [5, 'end'],
    ],
    [
      [2, 'end'],
      [6, 'end'],
    ],
  ];
  const returnMembers = [
    [
      [1, 'end'],
      [5, 'end'],
    ],
    [
      [2, 'head'],
      [6, 'head'],
    ],
  ];
  const declarationRows = [
    '[SETUP — rhyme groups — 1.T2,3.head,5.end;2.end,6.end — numbering v2 — cut v2]',
    '[SETUP — returns — 1.end,5.end;2.head,6.head — numbering v2 — cut v2]',
  ];
  function* permutations(ids) {
    if (!ids.length) yield [];
    for (const id of ids)
      for (const rest of permutations(ids.filter((other) => other !== id))) yield [id, ...rest];
  }
  const sectionIds = [0, 1, 2, 3, 4];
  const operations = [...permutations(sectionIds)].map((order) => ({ kind: 'permute', order }));
  for (const section of sectionIds) {
    operations.push({ kind: 'delete', order: sectionIds.filter((id) => id !== section) });
    for (let at = 0; at <= sectionIds.length; at++) {
      const order = sectionIds.slice();
      order.splice(at, 0, section);
      operations.push({ kind: 'clone', at, order });
    }
  }
  const totals = { cases: 0, applied: 0, refused: 0 };
  for (const timed of [false, true]) {
    const setup = [...declarationRows, ...(timed ? ['[SETUP — placement — 1:1:1:4;3:5:1:4]'] : [])];
    const body = sectionRows.map((rows) => rows.join('\n')).join('\n\n');
    for (const layout of ['prefix', 'suffix', 'split']) {
      const text =
        layout === 'prefix'
          ? setup.join('\n') + '\n\n' + body
          : layout === 'suffix'
            ? body + '\n\n' + setup.join('\n')
            : setup[0] + '\n\n' + body + '\n\n' + setup.slice(1).join('\n');
      for (const operation of operations) {
        // List positions give an independent oracle, without the production
        // Map/row.n logic. A declared endpoint must occur exactly once.
        const sequence = operation.order.flatMap((id) => occurrenceIds[id]);
        const once = (id) =>
          sequence.includes(id) && sequence.indexOf(id) === sequence.lastIndexOf(id);
        const unsafe =
          [1, 2, 3, 5, 6].some((id) => !once(id)) ||
          (timed && [1, 3].some((id) => sequence.indexOf(id) + 1 !== id));
        const h = context(text);
        try {
          const result = h.run(
            `lyEditSections(({blocks}) => {
            const originals = blocks.slice();
            blocks.splice(0, blocks.length, ...operation.order.map((id, at) =>
              operation.kind === 'clone' && at === operation.at
                ? originals[id].map(row => ({...row})) : originals[id]));
          }, 'Moved.')`,
            { operation }
          );
          eq(result.applied, !unsafe);
          if (unsafe) {
            eq(h.draft.value, text);
            eq(h.app.lyrics, text);
            eq(h.app.history, []);
            eq(h.calls, ['toast']);
            eq(h.toasts.length, 1);
            eq(h.toasts[0].tone, 'error');
            ok(h.c.document.activeElement === h.focused, 'refusal changed focus');
            eq([h.draft.selectionStart, h.draft.selectionEnd], [7, 9]);
            eq(h.run('LY.picks.formSec'), 0);
            totals.refused++;
          } else {
            const expected = (groups) =>
              groups
                .map((members) =>
                  members.map(([id, place]) => `${sequence.indexOf(id) + 1}.${place}`).join(',')
                )
                .join(';');
            const declarations = h.run('lyDeclarationsOf(lyParse(lyDraft().value))');
            eq(declarations.groups, expected(groupMembers));
            eq(declarations.returns, expected(returnMembers));
            eq(
              h.run('lyParse(lyDraft().value).sung.map(row => row.text)'),
              operation.order.flatMap((id) => sectionRows[id].slice(1))
            );
            eq(h.calls, ['save', 'history', 'refresh', 'toast']);
            eq(h.app.history.length, 1);
            eq(h.app.lyrics, h.draft.value);
            if (timed)
              eq(
                h.run("lySetupOf(lyParse(lyDraft().value), 'placement')[0].value"),
                '1:1:1:4;3:5:1:4'
              );
            totals.applied++;
          }
          totals.cases++;
        } catch (error) {
          error.message = `exhaustive ${JSON.stringify({ timed, layout, ...operation })}: ${error.message}`;
          throw error;
        }
      }
    }
  }
  eq(totals, { cases: 930, applied: 468, refused: 462 });
  return checks;
}
module.exports = checkStructural;
if (require.main === module)
  checkStructural(process.argv[2])
    .then((n) =>
      console.log(`STRUCTURAL PREFLIGHT: ${n} assertions passed (VM, no browser/storage claim)`)
    )
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
