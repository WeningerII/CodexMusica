#!/usr/bin/env node
// Acceptance probe for P-A (b887e5eff review): a word place saved in a rhyme
// groups / returns / reading row must not silently name a DIFFERENT word after
// the writer flips "parentheses are sung" on the Lyrics page.
//
//     node pa_probe.js TREE > cases.json
//
// TREE is a checkout root. The probe runs TREE's own src/lyric-tokens.js and
// src/pages/lyrics.js source in a node VM context (the stubs
// scripts/check_lyrics_page.js `unitBoundaries` uses, plus stubs for the chat
// shell; nothing is built or imported), then, for every case of the matrix,
// walks the page path:
//
//   1. the row is written, by one of three origins:
//      - "migration": a pre-release (unmarked) row numbered under the page's
//        earlier word cut is opened; the page's open boundary
//        (lyEnsureTokenScheme('open')) migrates it with TREE's own code;
//      - "form": the page's own form writes it (rhymes / repeats-voices placed
//        return / pronunciation);
//      - "b887-stored": the row is already in storage exactly as b887e5eff's
//        migration writes it (`— cut v2`, no numbering mark; the same bytes
//        for every tree), and the page is opened on it;
//   2. the voices setting is changed with the page's own repeats-voices form
//      (or left alone: the control transitions);
//   3. a send is attempted with the page's own lySubmitLyricsAction('review')
//      (its send boundary, its undecided-refusal gate, then lyContext); the
//      chat transport is a stub that captures `context.declarations`.
//
// Each case records the INTENDED word (the occurrence, as character pieces of
// the line, that the row named when it was written), the row bytes at each
// step, whether the send attempt changed the row bytes, the payload (or the
// page's refusal), and -- for a row whose voices basis the row does not record
// -- what token N names under every basis the row could have been numbered
// under. pa_harness.py decides what the payload binds.
//
// This is a node replica of the page's functions, not a browser run.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TREE = path.resolve(process.argv[2] || '.');

function makePage(root) {
  const sel = { start: 0, end: 0, dir: 'none' };
  const draft = {
    value: '',
    get selectionStart() { return sel.start; },
    get selectionEnd() { return sel.end; },
    get selectionDirection() { return sel.dir; },
    setSelectionRange(a, b, d = 'none') { Object.assign(sel, { start: a, end: b, dir: d }); },
  };
  const domain = { value: '' };
  const app = { lyricMeta: { version: 1, ui: {} }, history: [], historyIndex: -1, lyrics: '' };
  const snapshot = () => ({ lyrics: app.lyrics, lyricMeta: JSON.parse(JSON.stringify(app.lyricMeta)) });
  const toasts = [];
  const sends = [];
  const ctx = vm.createContext({
    console, setTimeout: () => 0, clearTimeout: () => {}, Date,
    $ui: (id) => (id === 'lyrics-draft' ? draft : id === 'chat-domain' ? domain : null),
    uiRegisterPage: () => {},
    uiCount: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`,
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {}, app,
    lyricMetaOf: (v) => Object.assign({ version: 1, notes: {}, brief: '', ui: {} }, v && v.version === 1 ? v : {}),
    uiAutosave: () => {},
    uiSaveLyrics: () => (app.lyrics = draft.value),
    sessionSnapshot: snapshot,
    pushHistory: () => {},
    showToast: (m, tone) => toasts.push([String(m), tone]),
    // The chat shell, stubbed: the send is captured, never transmitted.
    uiSwitchChat: () => true,
    uiUpdatePrompt: () => {},
    _chatReset: () => {},
    _chatSend: (message, opts) => { sends.push(JSON.parse(JSON.stringify(opts || {}))); return Promise.resolve({ ok: true }); },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lyric-tokens.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/pages/lyrics.js'), 'utf8'), ctx, { filename: 'lyrics.js' });
  // DOM-only helpers the send path calls.
  vm.runInContext('lyRefresh = () => {}; lyCloseMenus = () => {}; lyShowTab = () => {};', ctx);
  const run = (code, vars = {}) => { Object.assign(ctx, vars); return vm.runInContext(code, ctx); };
  return { run, draft, app, toasts, sends };
}

const page = makePage(TREE);
const { run } = page;
const J = (x) => JSON.parse(JSON.stringify(x)); // out of the VM realm

const SECOND = 'we sing it plain tonight';
const VOICES_ROW = '[SETUP — voices — parentheses are sung]';
const PHONES = { love: 'L AH1 V', home: 'HH OW1 M', bye: 'B AY1', on: 'AA1 N', ah: 'AA1' };

// Lines, and the target occurrence on each: `at` is the target's character
// offset in the line (it fixes WHICH occurrence, for echoed words).
const LINES = [
  { id: 'ohoh', line: 'Oh--oh, (ah) oh my love', why: 'dash join + aside before the target (the review repro)', targets: [{ word: 'love', at: 19 }, { word: 'ah', at: 9, asideOnly: true }] },
  { id: 'byebye', line: 'Bye--bye (bye) bye, my love', why: 'dash join + echoed aside: the shifted number lands on the same spelling', targets: [{ word: 'bye', at: 15 }] },
  { id: 'enclitic', line: "the cat 's (meow meow) gone home", why: "spaced enclitic ('s) + two-word aside before the target", targets: [{ word: 'home', at: 28 }] },
  { id: 'holdon', line: 'Hold on (hold on) hold on to me', why: 'voices only (earlier and current cuts agree): echoed aside, same spelling', targets: [{ word: 'on', at: 23 }] },
];

const TRANSITIONS = [
  { id: 'off->sung', from: false, to: true },
  { id: 'sung->off', from: true, to: false },
  { id: 'off->off', from: false, to: false, control: true },
  { id: 'sung->sung', from: true, to: true, control: true },
];
const KINDS = ['groups', 'returns', 'reading'];
const ORIGINS = ['migration', 'form', 'b887-stored'];

// Tokens of `line` under each cut, as {text, pieces:[[a,b],...]}.
const cuts = (line, voices) => ({
  legacy: (run('lyV1MigrationSpans(__l, __v)', { __l: line, __v: voices }) || []).map((s) => ({ text: s.text, pieces: [[s.from, s.to]] })),
  v1: J(run('CMLyricTokens.v1GraderSpans(__l, __s) || []', { __l: line, __s: !voices })).map((t) => ({ text: t.text, pieces: t.pieces })),
  v2: J(run('CMLyricTokens.readerLine(__l, {stripParens: __s}).tokens', { __l: line, __s: !voices })).map((t) => ({ text: t.text, pieces: t.pieces })),
});
const covers = (tok, at) => tok.pieces.some(([a, b]) => a <= at && at < b);
const indexOf = (toks, word, at) => {
  const i = toks.findIndex((t) => covers(t, at));
  return i >= 0 && toks[i].text === word ? i + 1 : null;
};
const BASES = {
  'page legacy': (l) => cuts(l, false).legacy, 'page legacy+voices': (l) => cuts(l, true).legacy,
  v2: (l) => cuts(l, false).v2, 'v2+voices': (l) => cuts(l, true).v2,
};

const hasFn = (name) => run(`typeof ${name} === 'function'`);
const FEATURES = {
  lyNumbering: hasFn('lyNumbering'),
  lyNumberingTarget: hasFn('lyNumberingTarget'),
  lyEnsureTokenScheme: hasFn('lyEnsureTokenScheme'),
  lySubmitLyricsAction: hasFn('lySubmitLyricsAction'),
  token_scheme: run('typeof LY_TOKEN_SCHEME === "string" ? LY_TOKEN_SCHEME : CMLyricTokens.SCHEME'),
};

const declRows = (text) => text.split('\n').filter((r) => /^\[SETUP/.test(r) && !/^\[SETUP — voices/.test(r));
const rowMark = (rows) => {
  const s = rows.join(' ');
  return /— numbering \S+/.test(s) ? 'numbering+cut' : /— cut v2\b/.test(s) ? 'cut v2 only' : 'unmarked';
};

function openPage(text) {
  page.draft.value = text;
  page.app.lyricMeta = { version: 1, notes: {}, brief: '', ui: {} };
  run('lyEnsureTokenScheme("open")');
  return page.draft.value;
}
const voicesForm = (text, sung) =>
  run(`LY_FORMS['repeats-voices'].apply(lyParse(__t), null, { voices: __v }, ['voices'])`, { __t: text, __v: sung ? 'sung' : 'unsung' });

// The page's own send attempt; -> { payload | refusal, text_after }.
async function attemptSend(text) {
  page.draft.value = text;
  page.app.lyricMeta = { version: 1, notes: {}, brief: '', ui: {} };
  page.toasts.length = 0;
  page.sends.length = 0;
  run('chatState.busy = false; chatState.pending = null; LY.run = null; LY.conflict = null;');
  const ok = await run('lySubmitLyricsAction("review")');
  const out = { text_after: page.draft.value, ok: !!ok, toasts: page.toasts.slice() };
  if (page.sends.length) out.payload = page.sends[0].context ? page.sends[0].context.declarations : null;
  else out.refusal = (page.toasts.find(([, t]) => t === 'error') || page.toasts[0] || ['(no message)'])[0];
  return out;
}

function writeWithForm(kind, song, token, word, line) {
  let res;
  if (kind === 'groups')
    res = run(`LY_FORMS.rhymes.apply(lyParse(__t), null, { members: [{ line: 1, place: 'T${token}' }, { line: 2, place: 'end' }] }, ['members'])`, { __t: song });
  else if (kind === 'returns')
    res = run(`LY_FORMS['repeats-voices'].apply(lyParse(__t), null, { placed: [{ line: 1, place: 'T${token}' }, { line: 2, place: 'end' }] }, ['placed'])`, { __t: song });
  else
    res = run(`LY_FORMS.pronunciation.apply(lyParse(__t), lyReadingKey(__l, ${token}, __w), { kind: 'declared', phones: __p, source: 'the singer' })`, { __t: song, __l: line, __w: word, __p: PHONES[word] });
  if (!res || res.errors) throw new Error(`form refused: ${JSON.stringify(res && res.errors)}`);
  return res.text;
}

function plainRow(kind, token, word, line, mark = '') {
  if (kind === 'groups') return `[SETUP — rhyme groups — 1.T${token},2.end${mark}]`;
  if (kind === 'returns') return `[SETUP — returns — 1.T${token},2.end${mark}]`;
  return `[SETUP — reading — token ${token} ${JSON.stringify(word)} in ${JSON.stringify(line)} — ${PHONES[word]} — declared — source: the singer${mark}]`;
}

// For a row that does not record its voices basis: the occurrence its stored
// token names under every basis it could have been numbered under. A basis
// is implausible where the token does not exist or (a reading) holds another
// word than the one the row stores.
function plausibleBases(kind, row, mark, line, word) {
  const m = kind === 'reading' ? /token (\d+) /.exec(row) : /\b1\.T(\d+)\b/.exec(row);
  if (!m) return null;
  const n = Number(m[1]);
  const names = mark === 'unmarked' ? ['page legacy', 'page legacy+voices'] : ['v2', 'v2+voices'];
  const each = {};
  for (const b of names) {
    const t = BASES[b](line)[n - 1];
    each[b] = !t ? null : kind === 'reading' && t.text !== word ? { word: t.text, pieces: t.pieces, implausible: 'stored word differs' } : { word: t.text, pieces: t.pieces };
  }
  const live = Object.values(each).filter((x) => x && !x.implausible);
  const agree = live.length > 0 && live.every((x) => JSON.stringify(x.pieces) === JSON.stringify(live[0].pieces));
  return { token: n, bases: each, agree };
}

async function main() {
  const cases = [];
  for (const L of LINES)
    for (const T of L.targets)
      for (const tr of TRANSITIONS) {
        if (T.asideOnly && !tr.from) continue; // an aside word cannot be named while asides are unsung
        for (const kind of KINDS)
          for (const origin of ORIGINS) {
            const id = `${L.id}.${T.word}.${kind}.${origin}.${tr.id}`;
            const c = { id, line_id: L.id, line: L.line, why: L.why, kind, origin, transition: tr.id, control: !!tr.control };
            try {
              const at = cuts(L.line, tr.from);
              const writeCut = origin === 'migration' ? at.legacy : at.v2;
              const token = indexOf(writeCut, T.word, T.at);
              if (!token) throw new Error(`target ${T.word}@${T.at} is not a token of the write cut`);
              c.intended = { word: T.word, at: T.at, pieces: writeCut[token - 1].pieces };
              c.written = { token, under: origin === 'migration' ? `page legacy cut${tr.from ? '+voices' : ''}` : `v2${tr.from ? '+voices' : ''}` };
              c.numbers = {};
              for (const b of Object.keys(BASES)) c.numbers[b] = indexOf(BASES[b](L.line), T.word, T.at);
              c.numbers.v1 = indexOf(cuts(L.line, false).v1, T.word, T.at);
              c.numbers['v1+voices'] = indexOf(cuts(L.line, true).v1, T.word, T.at);
              const song = `${tr.from ? VOICES_ROW + '\n' : ''}[VERSE]\n${L.line}\n${SECOND}`;
              const steps = [];
              let text;
              if (origin === 'form') {
                text = writeWithForm(kind, song, token, T.word, L.line);
                steps.push({ step: 'written by the page form', rows: declRows(text) });
              } else {
                const stored = `${plainRow(kind, token, T.word, L.line, origin === 'b887-stored' ? ' — cut v2' : '')}\n${song}`;
                steps.push({ step: origin === 'migration' ? 'pre-release row in storage' : 'row in storage as b887 migrated it', rows: declRows(stored) });
                text = openPage(stored);
                steps.push({ step: 'after the open boundary', rows: declRows(text) });
              }
              // The row's own provenance, as first persisted by this tree.
              c.row_written = declRows(text);
              c.row_written_mark = origin === 'b887-stored' ? 'cut v2 only' : rowMark(c.row_written);
              c.basis_recorded = c.row_written_mark === 'numbering+cut';
              if (!c.basis_recorded)
                c.plausible = plausibleBases(kind, c.row_written[0] || '', c.row_written_mark, L.line, T.word);
              if (tr.from !== tr.to) {
                text = voicesForm(text, tr.to).text;
                steps.push({ step: `voices set ${tr.to ? 'sung' : 'unsung'} with the repeats-voices form`, rows: declRows(text) });
              }
              c.row_before_send = declRows(text);
              const sent = await attemptSend(text);
              c.row_after_send = declRows(sent.text_after);
              c.row_bytes_unchanged_by_send = JSON.stringify(c.row_before_send) === JSON.stringify(c.row_after_send);
              c.row_bytes_unchanged_since_written = JSON.stringify(c.row_written) === JSON.stringify(c.row_after_send);
              steps.push({ step: 'after the send attempt', rows: c.row_after_send });
              c.steps = steps;
              const model = run('lyParse(__t)', { __t: sent.text_after });
              c.sung_lines = J(run('lySungTexts(__m)', { __m: model }));
              c.voices_at_send = !!model.voices;
              if (sent.payload) c.payload = J(sent.payload);
              else c.page_refusal = sent.refusal;
            } catch (e) {
              c.probe_error = String((e && e.stack) || e);
            }
            cases.push(c);
          }
      }
  let commit = null;
  try {
    commit = require('child_process').execFileSync('git', ['-C', TREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch { /* not a checkout */ }
  process.stdout.write(JSON.stringify({ probe: 'pa_voices/pa_probe.js', page_tree: TREE, page_commit: commit, page_features: FEATURES, replica: 'node VM over the tree source (not a browser)', cases }, null, 1) + '\n');
}
main().catch((e) => { console.error(e); process.exit(2); });
