/* exported uiLyricsWaiting */
/* global $ui, UI, UILayout, _chatSyncCount, app, chatState, compileRecipeStack, copyToClipboard, esc, icon, pushHistory, showToast, uiButton, uiChatOpen, uiEmptyState, uiFocus, uiNavigate, uiNewTask, uiRegisterPage, uiSaveLyrics, uiSwitchChat */
/* Lyrics page. Owned by the Lyrics page worker; see docs/ui-foundation.md.

   THE DRAFT IS THE ONE SOURCE OF TRUTH. Everything this page shows is read
   from the text in #lyrics-draft (session state, written through the shell's
   uiSaveLyrics) or from the lyric writer's own replies (chatState, src/app.js).
   Nothing here grades a song: the page reports exact text facts (lines,
   sections, verbatim returns, declared headers) and relays what a writer run
   reported, labelled as such and marked stale once the draft moves on.

   The text conventions are the harness's own:
   - a sung line is a nonblank line that is not a whole-line [bracket]
     (mcp/lyric_text.js draftFromText), numbered from 1 in that order;
   - a section header is a bracket, optionally carrying its declared size and
     rhythm the way quality/plan.py builds it:
       [CHORUS — 5 lines — 5 bars of 7/8, one-beat pickup]
   - [FINISHED — seed N — exit E — …] and [GRADED — …] are run stamps;
   - sung tokens follow lyric_harness.line_tokens (parentheses unsung unless
     voices are declared), so a pronunciation binds the same token position
     the harness reads.
   Setup the writer should honour is declared in the text as [SETUP — …]
   lines. Like headers they are not sung (the harness drops whole-line
   brackets), and they travel with the draft through saves, exports and Undo.

   Lyric writing stays separate from recipe generation: the only recipe input
   is the explicit "Use current recipe" prefill, and nothing here writes the
   recipe. Writer work goes through the one AI writer (uiNewTask/uiChatOpen). */
'use strict';

// ── Text model ──────────────────────────────────────────────────────────────
const LY_DASH = ' — ';
// lyric_harness.LATIN_SCRIPT / _TOKEN_RUN: À-ɏ is U+00C0–U+024F, Ḁ-ỿ U+1E00–U+1EFF.
const LY_LETTER = /[A-Za-zÀ-ɏḀ-ỿ]/;
const LY_TOKEN = /(?:[A-Za-zÀ-ɏḀ-ỿ]|['-])+/g;
const LY_STAMP = /^\[(FINISHED|GRADED)\b/i;
const LY_SETUP = /^\[SETUP\s+—\s+/i;
const LY_BRACKET = /^\[[^\]]*\]$/;
const LY_ARPABET_VOWELS = 'AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split(' ');
const LY_ARPABET_CONSONANTS = 'B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH'.split(' ');
// The harness's placement vocabulary for a rhyme-group member (quality/slots.py).
const LY_PLACES = {
  end: 'last rhyme',
  endword: 'last word',
  head: 'first word',
  headrime: 'first rhyme',
  line: 'whole line',
};
const LY_SECTION_NAMES = [
  'Verse',
  'Pre-chorus',
  'Chorus',
  'Bridge',
  'Intro',
  'Outro',
  'Hook',
  'Refrain',
];

function lyTokens(text, voices = false) {
  let t = String(text).replace(/[’‘]/g, "'");
  if (!voices) t = t.replace(/\([^)]*\)/g, ' ');
  return (t.match(LY_TOKEN) || []).filter((w) => LY_LETTER.test(w));
}
// Word-by-word spans of a line for display: every run is a token of the
// harness's reading; parenthesised runs are marked unsung unless voices say so.
function lyWordSpans(text, voices) {
  const out = [];
  let depth = 0,
    last = 0,
    index = 0;
  const re = /(?:[A-Za-zÀ-ɏḀ-ỿ]|['’‘-])+|[()]/g;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ gap: text.slice(last, m.index) });
    last = m.index + m[0].length;
    if (m[0] === '(') depth++;
    if (m[0] === ')') depth = Math.max(0, depth - 1);
    if (m[0] === '(' || m[0] === ')') {
      out.push({ gap: m[0] });
      continue;
    }
    const word = m[0];
    const sung = voices || depth === 0;
    const letter = LY_LETTER.test(word);
    out.push({ word, token: sung && letter ? ++index : null, aside: !sung });
  }
  if (last < text.length) out.push({ gap: text.slice(last) });
  return out;
}
const lyNorm = (s) => lyTokens(s, true).map((w) => w.toLowerCase().replace(/’/g, "'"));
const lyCap = (s) => (s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);
const lyPlural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const lyQuote = (s) => JSON.stringify(String(s));
const lyUnquote = (s) => {
  try {
    const v = JSON.parse(s);
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
};

// [NAME — n lines — m bars of X/Y, pickup] → its declared parts. Anything the
// page does not recognise is kept verbatim in `extra`, never dropped.
function lyParseHeader(raw) {
  const parts = raw.slice(1, -1).split(/\s+—\s+/);
  const head = {
    name: parts[0].trim(),
    lines: null,
    bars: null,
    meter: null,
    pickup: null,
    extra: [],
  };
  for (const part of parts.slice(1)) {
    const p = part.trim();
    let m;
    if ((m = /^(\d+) lines?$/i.exec(p))) head.lines = Number(m[1]);
    else if ((m = /^(\d+) bars? of (\d+\/\d+)(?:,\s*(.+))?$/i.exec(p))) {
      head.bars = Number(m[1]);
      head.meter = m[2];
      head.pickup = m[3] ? m[3].trim() : null;
    } else if ((m = /^(\d+) bars?$/i.exec(p))) head.bars = Number(m[1]);
    else head.extra.push(p);
  }
  return head;
}
function lyHeaderText(h) {
  const parts = [h.name || 'SECTION'];
  if (h.lines != null) parts.push(lyPlural(h.lines, 'line'));
  if (h.bars != null || h.meter)
    parts.push(
      (h.bars != null ? lyPlural(h.bars, 'bar') : '') +
        (h.meter ? `${h.bars != null ? ' of ' : ''}${h.meter}` : '') +
        (h.pickup ? `, ${h.pickup}` : '')
    );
  parts.push(...h.extra);
  return `[${parts.join(LY_DASH)}]`;
}
function lyParseSetup(raw) {
  const body = raw.slice(1, -1).replace(/^SETUP\s+—\s+/i, '');
  const cut = body.indexOf(LY_DASH);
  const key = (cut < 0 ? body : body.slice(0, cut)).trim().toLowerCase();
  const value = cut < 0 ? '' : body.slice(cut + LY_DASH.length).trim();
  const item = { key, value, raw };
  if (key === 'reading') {
    const m = /^token (\d+) ("(?:[^"\\]|\\.)*") in ("(?:[^"\\]|\\.)*")(?:\s+—\s+(.*))?$/.exec(
      value
    );
    if (m) {
      item.token = Number(m[1]);
      item.word = lyUnquote(m[2]);
      item.line = lyUnquote(m[3]);
      const rest = (m[4] || '').split(/\s+—\s+/).map((s) => s.trim());
      item.state = 'choice';
      for (const r of rest) {
        if (/^needs a (dictionary )?choice$/i.test(r)) item.state = 'choice';
        else if (/^uncertain$/i.test(r)) item.state = 'uncertain';
        else if (/^(dictionary|declared)$/i.test(r)) item.basis = r.toLowerCase();
        else if (/^source:\s*/i.test(r)) item.source = r.replace(/^source:\s*/i, '');
        else if (/^[A-Z]{1,2}[012]?(\s+[A-Z]{1,2}[012]?)*$/.test(r)) item.phones = r.split(/\s+/);
      }
      if (item.phones && item.basis && item.source) item.state = 'declared';
    } else item.malformed = true;
  }
  if (key === 'hook') item.line = lyUnquote(value);
  return item;
}

// The whole draft, read once per change.
function lyParse(text) {
  const rows = String(text || '').split('\n');
  const model = {
    text: String(text || ''),
    rows: [],
    sung: [],
    sections: [],
    setup: [],
    stamps: [],
    voices: false,
  };
  const hasHeaders = rows.some((r) => {
    const t = r.trim();
    return LY_BRACKET.test(t) && !LY_STAMP.test(t) && !LY_SETUP.test(t);
  });
  let section = null;
  const open = (header, row) => {
    section = { index: model.sections.length, header, headerRow: row, rows: [], sung: [] };
    model.sections.push(section);
    return section;
  };
  rows.forEach((raw, i) => {
    const t = raw.trim();
    const row = { i, raw, text: t, kind: 'sung' };
    model.rows.push(row);
    if (!t) {
      row.kind = 'blank';
      // Without headers a blank line ends a stanza.
      if (!hasHeaders && section && section.sung.length) section = null;
      if (section) section.rows.push(row);
      return;
    }
    if (LY_BRACKET.test(t)) {
      if (LY_STAMP.test(t)) {
        row.kind = 'stamp';
        const m = /seed (\d+)/i.exec(t),
          e = /exit (\d+)/i.exec(t);
        model.stamps.push({
          i,
          raw: t,
          kind: LY_STAMP.exec(t)[1].toUpperCase(),
          seed: m ? Number(m[1]) : null,
          exit: e ? Number(e[1]) : null,
        });
      } else if (LY_SETUP.test(t)) {
        row.kind = 'setup';
        const item = lyParseSetup(t);
        item.i = i;
        model.setup.push(item);
      } else {
        row.kind = 'section';
        row.section = open(lyParseHeader(t), row);
      }
      return;
    }
    if (!section) open(null, null);
    row.n = model.sung.length + 1;
    row.section = section;
    section.rows.push(row);
    section.sung.push(row);
    model.sung.push(row);
  });
  model.sections = model.sections.filter((s) => s.header || s.sung.length);
  model.sections.forEach((s, k) => (s.index = k));
  model.voices = model.setup.some(
    (s) => s.key === 'voices' && /sung/i.test(s.value) && !/unsung/i.test(s.value)
  );
  // Names: a bare repeated name is numbered (Verse 1, Verse 2) as it reads.
  const seen = {},
    totals = {};
  for (const s of model.sections) {
    const base = s.header ? lyCap(s.header.name) : 'Stanza';
    s.base = base;
    totals[base] = (totals[base] || 0) + 1;
  }
  for (const s of model.sections) {
    seen[s.base] = (seen[s.base] || 0) + 1;
    s.title = !s.header
      ? `${hasHeaders ? 'Untitled' : 'Stanza'} ${hasHeaders ? '' : seen[s.base]}`.trim()
      : /\d/.test(s.base) || totals[s.base] === 1
        ? s.base
        : `${s.base} ${seen[s.base]}`;
    s.key = s.sung.map((r) => r.text).join('\n');
  }
  // Exact returns: a section whose sung lines equal an earlier one's.
  const firstByKey = new Map();
  for (const s of model.sections) {
    if (!s.sung.length) continue;
    const first = firstByKey.get(s.key);
    if (first) {
      s.returnOf = first;
      first.uses = (first.uses || 1) + 1;
    } else firstByKey.set(s.key, s);
  }
  // Repeated lines, anywhere.
  const byText = new Map();
  for (const r of model.sung) byText.set(r.text, [...(byText.get(r.text) || []), r.n]);
  model.repeats = [...byText]
    .filter(([, ns]) => ns.length > 1)
    .map(([text, ns]) => ({ text, lines: ns }));
  return model;
}

// ── Page state (private to this file) ─────────────────────────────────────
const LY = {
  model: null,
  text: null,
  view: 'read', // 'read' | 'edit'
  pane: 'review', // 'review' | 'history' | 'writer' | '' (closed)
  reviewTab: 'issue', // 'issue' | 'input' | 'note'
  reviewAt: 0,
  songTab: 'sections', // 'sections' | 'plan'
  tool: 'structure',
  toolsOpen: false,
  activeLine: 0,
  menu: '',
  find: { q: '', at: 0 },
  // The latest lyric reply this page saw, and what the draft was when it was asked.
  run: null,
  // Per-decision results: id → { state: 'applied'|'failed'|'kept', message }.
  outcomes: {},
  own: {}, // decision id → the user's own line while writing it
  picks: { readingLine: 0, readingToken: 0, linkMembers: [] },
  prefs: null,
};
const LY_TONES = {
  issue: { label: 'Issues', one: 'Issue', icon: 'circle-alert' },
  input: { label: 'Needs input', one: 'Needs input', icon: 'circle-question-mark' },
  note: { label: 'Notes', one: 'Note', icon: 'info' },
};
const LY_TOOLS = [
  ['structure', 'Structure & story', 'list'],
  ['rhymes', 'Rhymes & word rules', 'link'],
  ['rhythm', 'Rhythm & placement', 'music'],
  ['pronunciation', 'Language & readings', 'globe'],
  ['returns', 'Returns & voices', 'repeat'],
  ['checks', 'All checks', 'circle-check'],
  ['export', 'Export', 'download'],
];

const lyDraft = () => $ui('lyrics-draft');
const lySungTexts = (model) => model.sung.map((r) => r.text);
const lySame = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const lySetupOf = (model, key) => model.setup.filter((s) => s.key === key);
const lyLineRef = (ns) =>
  ns.length === 1
    ? `line ${ns[0]}`
    : ns.length === 2
      ? `lines ${ns[0]} and ${ns[1]}`
      : `lines ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`;
const lySectionOfLine = (model, n) => model.sung[n - 1]?.section || null;

// A rhyme-group or returns spelling ('1,3.head;2,4') → groups of members.
function lyParseGroups(value) {
  return String(value || '')
    .split(';')
    .map((g) =>
      g
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
        .map((m) => {
          const mm = /^(\d+)(?:\.(end|endword|head|headrime|line|T\d{1,3}))?$/.exec(m);
          return mm
            ? { line: Number(mm[1]), place: mm[2] || 'end', raw: m }
            : { raw: m, bad: true };
        })
    )
    .filter((g) => g.length);
}
const lyGroupsText = (groups) =>
  groups
    .map((g) =>
      g.map((m) => (m.place && m.place !== 'end' ? `${m.line}.${m.place}` : `${m.line}`)).join(',')
    )
    .join(';');
function lyMemberWord(model, m) {
  const row = model.sung[m.line - 1];
  if (!row) return null;
  const toks = lyTokens(row.text, model.voices);
  if (/^T\d+$/.test(m.place)) return toks[Number(m.place.slice(1)) - 1] || null;
  if (m.place === 'head' || m.place === 'headrime') return toks[0] || null;
  if (m.place === 'line') return row.text;
  return toks[toks.length - 1] || null;
}
const lyMemberLabel = (m) =>
  /^T\d+$/.test(m.place) ? `word ${m.place.slice(1)}` : LY_PLACES[m.place] || m.place;

// A declared melody (lyric-harness/MELODY.md), written in the draft without
// brackets inside the line: '4/4 — groups 2+2 — 2 bars — subdivision 2 —
// 432.5:3 rest:1 487.2:4'. Returns the harness JSON shape, or an error that
// names the rule it breaks; nothing is simplified or filled in.
function lyParseMelody(value) {
  const parts = String(value || '')
    .split(/\s+—\s+/)
    .map((p) => p.trim());
  const out = { meter: null, bars: null, subdivision: null, notes: [] };
  for (const p of parts) {
    let m;
    if ((m = /^(\d{1,2})\/(\d{1,2})$/.exec(p)))
      out.meter = { beats: Number(m[1]), unit: Number(m[2]), groups: null };
    else if ((m = /^groups? ([\d+]+)$/i.exec(p))) out.groups = m[1].split('+').map(Number);
    else if ((m = /^(\d+) bars?$/i.exec(p))) out.bars = Number(m[1]);
    else if ((m = /^subdivision (\d+)$/i.exec(p))) out.subdivision = Number(m[1]);
    else if (p)
      out.notes = p.split(/\s+/).map((tok) => {
        const n = /^(rest|[\d.]+):(\d+)$/i.exec(tok);
        return n
          ? { pitch_hz: /^rest$/i.test(n[1]) ? null : Number(n[1]), ticks: Number(n[2]) }
          : { bad: tok };
      });
  }
  const fail = (error) => ({ error });
  if (!out.meter) return fail('Declare the meter as beats/unit, e.g. 4/4.');
  const groups =
    out.groups || (out.meter.beats % 3 === 0 ? Array(out.meter.beats / 3).fill(3) : null);
  if (
    !groups ||
    groups.some((g) => g !== 2 && g !== 3) ||
    groups.reduce((t, g) => t + g, 0) !== out.meter.beats
  )
    return fail(`Beat groups must be 2s and 3s that sum to ${out.meter.beats} (e.g. groups 2+2).`);
  out.meter.groups = groups;
  if (!Number.isInteger(out.bars) || out.bars < 1)
    return fail('Bars per line must be a whole number of at least 1.');
  if (![1, 2, 4].includes(out.subdivision)) return fail('Subdivision is 1, 2 or 4 ticks per beat.');
  const bad = out.notes.find(
    (n) =>
      n.bad ||
      !(n.pitch_hz === null || (Number.isFinite(n.pitch_hz) && n.pitch_hz > 0)) ||
      !Number.isInteger(n.ticks) ||
      n.ticks < 1
  );
  if (!out.notes.length || bad)
    return fail(
      `Write each event as hertz:ticks or rest:ticks${bad?.bad ? ` (“${bad.bad}” is not one)` : ''}.`
    );
  if (!out.notes.some((n) => n.pitch_hz !== null))
    return fail('A phrase needs at least one pitched note.');
  const want = out.bars * out.meter.beats * out.subdivision;
  const got = out.notes.reduce((t, n) => t + n.ticks, 0);
  if (got !== want)
    return fail(
      `The events last ${got} ticks; ${out.bars} × ${out.meter.beats} × ${out.subdivision} = ${want} are needed.`
    );
  delete out.groups;
  return { melody: out };
}
const lyMelodyText = (m) =>
  [
    `${m.meter.beats}/${m.meter.unit}`,
    `groups ${m.meter.groups.join('+')}`,
    lyPlural(m.bars, 'bar'),
    `subdivision ${m.subdivision}`,
    m.notes.map((n) => `${n.pitch_hz === null ? 'rest' : n.pitch_hz}:${n.ticks}`).join(' '),
  ].join(LY_DASH);
// The story plan (the harness's `narrative`): one atom per sung section, a
// junction before every atom after the first. A record, not a gate.
const LY_ATOMS = [
  'ESTABLISH',
  'COMPLICATE',
  'TURN',
  'DWELL',
  'ANCHOR',
  'JUDGE',
  'RESOLVE',
  'DEPART',
];
const LY_JUNCTIONS = ['THEREFORE', 'BUT', 'AND_THEN', 'MEANWHILE', 'ELABORATE', 'JUXTAPOSE'];
function lyParseNarrative(value) {
  const v = String(value || '').trim();
  if (/^off$/i.test(v)) return { off: true, steps: [] };
  const steps = v.split(',').map((p, k) => {
    const [atom, junction] = p.trim().split('/');
    return {
      atom,
      junction: junction || null,
      ok: LY_ATOMS.includes(atom) && (k === 0 ? !junction : LY_JUNCTIONS.includes(junction)),
    };
  });
  return { steps, ok: steps.every((x) => x.ok) };
}

// Everything declared on this page, as the exact values the lyric tools take,
// so the writer never has to reinterpret a [SETUP] line.
function lyWriterDeclarations(model) {
  const one = (key) => lySetupOf(model, key)[0]?.value;
  const d = {};
  if (one('title')) d.title = one('title');
  const hook = lySetupOf(model, 'hook')[0];
  if (hook?.line) d.hook_line = hook.line;
  if (one('narrative')) d.narrative = one('narrative');
  const mel = one('melody') && lyParseMelody(one('melody'));
  if (mel?.melody) d.melody = mel.melody; // the tools take this object as a JSON string
  if (one('relation')) d.relation = one('relation');
  if (one('rhyme groups')) d.groups = one('rhyme groups');
  if (one('returns')) d.returns = one('returns');
  if (model.voices) d.voices = true;
  const readings = lySetupOf(model, 'reading').filter((r) => !r.malformed);
  const chosen = readings
    .filter((r) => r.state === 'declared')
    .map((r) => ({
      line: r.line,
      token: r.token,
      word: r.word,
      phones: r.phones,
      basis: r.basis,
      source: r.source,
    }));
  if (chosen.length) d.pronunciations = chosen;
  const open = readings
    .filter((r) => r.state !== 'declared')
    .map((r) => ({
      line: r.line,
      token: r.token,
      word: r.word,
      state: r.state === 'uncertain' ? 'uncertain' : 'needs a choice',
    }));
  if (open.length) d.readings_not_chosen = open;
  const req = lySetupOf(model, 'require').map((x) => x.value),
    avoid = lySetupOf(model, 'avoid').map((x) => x.value);
  if (req.length) d.must_include = req;
  if (avoid.length) d.avoid = avoid;
  return Object.keys(d).length
    ? `\n\nDeclared on the Lyrics page (exact values for the lyric tools; never guess a reading that is not chosen):\n${JSON.stringify(d)}`
    : '';
}

// Title in a line: the harness's normalised word-subsequence test, either way.
function lyContainsRun(hay, needle) {
  if (!needle.length || needle.length > hay.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++)
    if (needle.every((w, k) => hay[i + k] === w)) return true;
  return false;
}

// ── Local checks: exact facts about the current text ───────────────────────
function lyLocalChecks(model) {
  const items = [];
  const add = (item) => items.push({ source: 'page', ...item });
  for (const s of model.sections) {
    if (s.header && s.header.lines != null && s.header.lines !== s.sung.length)
      add({
        id: `count:${s.index}`,
        tone: 'issue',
        category: 'Structure',
        title: `${s.title} declares ${lyPlural(s.header.lines, 'line')} but has ${s.sung.length}`,
        where: s.title,
        lines: s.sung.map((r) => r.n),
        text: 'The header states the section size the writer plans against. Change the header or the lines so they agree.',
        actions: [
          [
            'ly-fix-count',
            `Set the header to ${lyPlural(s.sung.length, 'line')}`,
            'pencil',
            s.index,
          ],
        ],
      });
  }
  // Near returns: a section named like an earlier one whose words differ.
  for (const s of model.sections) {
    if (!s.header || s.returnOf || !s.sung.length) continue;
    const first = model.sections.find(
      (o) =>
        o.index < s.index &&
        o.base.toLowerCase() === s.base.toLowerCase() &&
        o.sung.length &&
        !o.returnOf
    );
    if (!first || first.key === s.key) continue;
    const diff = s.sung.filter((r, k) => first.sung[k]?.text !== r.text).map((r) => r.n);
    const sameSize = first.sung.length === s.sung.length;
    // Only a mostly repeated section reads as a return that changed; two
    // verses with different words are simply two verses.
    if (diff.length * 2 > Math.max(first.sung.length, s.sung.length)) continue;
    add({
      id: `near:${s.index}`,
      tone: 'note',
      category: 'Return',
      title: `${s.title} differs from ${first.title}`,
      where: s.title,
      lines: diff.length ? diff : s.sung.map((r) => r.n),
      text: sameSize
        ? `${lyPlural(diff.length, 'line')} differ (${lyLineRef(diff)}). Only identical sections count as an exact return; a changed line may be intentional.`
        : `${first.title} has ${lyPlural(first.sung.length, 'line')}; this one has ${s.sung.length}. Only identical sections count as an exact return.`,
      actions: [
        ['ly-make-return', `Make it match ${first.title}`, 'repeat', `${s.index}:${first.index}`],
      ],
    });
  }
  // Readings bound to exact line text.
  for (const r of lySetupOf(model, 'reading')) {
    if (r.malformed) {
      add({
        id: `reading:${r.i}`,
        tone: 'input',
        category: 'Pronunciation',
        title: 'A reading declaration cannot be read',
        where: `Setup line ${r.i + 1}`,
        lines: [],
        text: r.raw,
        actions: [['ly-remove-setup', 'Remove it', 'trash-2', r.i]],
      });
      continue;
    }
    const lines = model.sung.filter((x) => x.text === r.line).map((x) => x.n);
    const toks = lyTokens(r.line, model.voices);
    if (!lines.length || toks[r.token - 1] !== r.word)
      add({
        id: `reading:${r.i}`,
        tone: 'input',
        category: 'Pronunciation',
        title: `The reading for “${r.word}” no longer matches the draft`,
        where: lines.length ? lyLineRef(lines) : 'No matching line',
        lines,
        text: !lines.length
          ? 'Its exact line is no longer in the draft. A changed line never inherits an old reading: choose again for the new text, or remove it.'
          : `Word ${r.token} of that line is now “${toks[r.token - 1] || 'missing'}”.`,
        actions: [
          ['ly-tool', 'Choose again', 'globe', 'pronunciation'],
          ['ly-remove-setup', 'Remove it', 'trash-2', r.i],
        ],
      });
    else if (r.state === 'choice')
      add({
        id: `reading:${r.i}`,
        tone: 'input',
        category: 'Pronunciation',
        title: `Choose how “${r.word}” is read`,
        where: lyLineRef(lines),
        lines,
        text: 'A reading is required here and none is chosen. Supply one with its source, or ask the writer for the dictionary options.',
        actions: [['ly-tool', 'Choose a reading', 'globe', 'pronunciation']],
      });
    else if (r.state === 'uncertain')
      add({
        id: `reading:${r.i}`,
        tone: 'note',
        category: 'Pronunciation',
        title: `“${r.word}” is marked uncertain`,
        where: lyLineRef(lines),
        lines,
        text: 'Kept as an explicit uncertainty; nothing assumes a reading for it.',
        actions: [['ly-tool', 'Open readings', 'globe', 'pronunciation']],
      });
  }
  // Rhyme links and declared returns that point outside the draft.
  for (const key of ['rhyme groups', 'returns'])
    for (const d of lySetupOf(model, key)) {
      const bad = lyParseGroups(d.value)
        .flat()
        .filter((m) => m.bad || !model.sung[m.line - 1] || !lyMemberWord(model, m));
      if (bad.length)
        add({
          id: `${key}:${d.i}`,
          tone: 'input',
          category: key === 'returns' ? 'Return' : 'Rhyme',
          title: `${key === 'returns' ? 'A declared return' : 'A rhyme link'} points at ${bad.map((m) => m.raw).join(', ')}, which the draft does not have`,
          where: `Declared as ${d.value}`,
          lines: [],
          text: 'Line numbers are the harness’s own spelling; they no longer match the text. Choose the members again.',
          actions: [
            [
              'ly-tool',
              key === 'returns' ? 'Open returns' : 'Open rhyme links',
              key === 'returns' ? 'repeat' : 'link',
              key === 'returns' ? 'returns' : 'rhymes',
            ],
          ],
        });
    }
  // Word rules: exact word checks this page can make on its own.
  const words = model.sung.map((r) => ({ n: r.n, toks: lyNorm(r.text) }));
  for (const d of lySetupOf(model, 'require')) {
    const w = lyNorm(d.value);
    if (w.length && !words.some((x) => lyContainsRun(x.toks, w)))
      add({
        id: `require:${d.i}`,
        tone: 'issue',
        category: 'Word rule',
        title: `Required “${d.value}” does not appear`,
        where: 'Whole draft',
        lines: [],
        text: 'Checked on this page by exact word match.',
        actions: [['ly-tool', 'Open word rules', 'link', 'rhymes']],
      });
  }
  for (const d of lySetupOf(model, 'avoid')) {
    const w = lyNorm(d.value);
    const hits = words.filter((x) => lyContainsRun(x.toks, w)).map((x) => x.n);
    if (w.length && hits.length)
      add({
        id: `avoid:${d.i}`,
        tone: 'issue',
        category: 'Word rule',
        title: `“${d.value}” is set to avoid but appears`,
        where: lyLineRef(hits),
        lines: hits,
        text: 'Checked on this page by exact word match.',
        actions: [['ly-tool', 'Open word rules', 'link', 'rhymes']],
      });
  }
  const hook = lySetupOf(model, 'hook')[0];
  const hookLines = hook ? model.sung.filter((r) => r.text === hook.line).map((r) => r.n) : [];
  if (hook && !hookLines.length)
    add({
      id: 'hook',
      tone: 'input',
      category: 'Hook',
      title: 'The declared hook line is not in the draft',
      where: hook.line || hook.value,
      lines: [],
      text: 'The hook binds an exact line. Choose it again from the current lines.',
      actions: [['ly-tool', 'Choose the hook', 'link', 'rhymes']],
    });
  const title = lySetupOf(model, 'title')[0];
  if (title && hook && hookLines.length) {
    const t = lyNorm(title.value),
      h = lyNorm(hook.line);
    if (!lyContainsRun(h, t) && !lyContainsRun(t, h))
      add({
        id: 'title-hook',
        tone: 'note',
        category: 'Hook',
        title: 'The title is not a run of words in the hook',
        where: lyLineRef(hookLines),
        lines: hookLines,
        text: 'A declared title is expected inside the hook line (or the hook inside the title). The harness decides this when it grades; this is the same word test, made here as a note.',
        actions: [],
      });
  }
  // Rhythm: declared only. A mixed song is noted, never filled in.
  const sized = model.sections.filter((s) => s.header);
  const metered = sized.filter((s) => s.header.meter);
  if (metered.length && metered.length < sized.length)
    add({
      id: 'rhythm-mixed',
      tone: 'note',
      category: 'Rhythm',
      title: `Rhythm is declared for ${metered.length} of ${sized.length} sections`,
      where: 'Rhythm & placement',
      lines: [],
      text: 'Undeclared sections stay undeclared: no tempo or meter is assumed for them.',
      actions: [['ly-tool', 'Open rhythm', 'music', 'rhythm']],
    });
  const melody = lySetupOf(model, 'melody')[0];
  if (melody) {
    const m = lyParseMelody(melody.value);
    if (m.error)
      add({
        id: 'melody',
        tone: 'input',
        category: 'Melody',
        title: 'The declared melody cannot be used',
        where: 'Rhythm & placement',
        lines: [],
        text: m.error,
        actions: [['ly-tool', 'Open rhythm', 'music', 'rhythm']],
      });
    else {
      const clash = model.sections.filter(
        (s) =>
          s.header?.meter && s.header.meter !== `${m.melody.meter.beats}/${m.melody.meter.unit}`
      );
      if (clash.length)
        add({
          id: 'melody-meter',
          tone: 'note',
          category: 'Melody',
          title: `The melody is in ${m.melody.meter.beats}/${m.melody.meter.unit}; ${lyPlural(clash.length, 'section header')} declare another meter`,
          where: clash.map((s) => s.title).join(', '),
          lines: [],
          text: 'The harness takes the meter from a declared melody, which repeats for every line. Both are kept as written.',
          actions: [['ly-tool', 'Open rhythm', 'music', 'rhythm']],
        });
    }
  }
  const story = lySetupOf(model, 'narrative')[0];
  if (story) {
    const n = lyParseNarrative(story.value);
    const sung = model.sections.filter((s) => s.sung.length).length;
    if (!n.off && (!n.ok || n.steps.length !== sung))
      add({
        id: 'narrative',
        tone: 'input',
        category: 'Story',
        title: !n.ok
          ? 'The story plan cannot be read'
          : `The story plan names ${lyPlural(n.steps.length, 'section')}; the song has ${sung}`,
        where: 'Structure & story',
        lines: [],
        text: 'One story job per sung section, with a junction before every job after the first. Change the plan or the sections so they agree.',
        actions: [['ly-tool', 'Open story', 'list', 'structure']],
      });
  }
  for (const st of model.stamps)
    add({
      id: `stamp:${st.i}`,
      tone: 'note',
      category: 'Run stamp',
      title: `The draft carries a ${st.kind} stamp${st.exit != null ? ` (exit ${st.exit})` : ''}`,
      where: `Text line ${st.i + 1}`,
      lines: [],
      text: `${st.raw} — it describes the run that wrote it${st.seed != null ? ` (seed ${st.seed})` : ''}. This page has not checked it, and edits since then are not covered by it.`,
      actions: [],
    });
  return items;
}

// ── What the writer's last reply reported ──────────────────────────────────
// Read from the reply the shell hands to uiReceiveReply (see lyReceive) and
// from chatState. `base` is the draft when the request was sent: only a
// suggestion made against a known base can be checked line by line.
function lyRunLines(artifact) {
  if (!artifact) return null;
  if (Array.isArray(artifact.final_draft)) return artifact.final_draft.map((l) => String(l).trim());
  if (typeof artifact.text === 'string') return lyParse(artifact.text).sung.map((r) => r.text);
  return null;
}
function lyRunStatus(run) {
  if (!run) return null;
  const a = run.artifact;
  if (run.recoveryExport) return { tone: 'warning', word: 'Recovered export · not graded' };
  if (a?.certified === true && run.completion?.certified === true)
    return { tone: 'success', word: 'Finished · certified' };
  if (a)
    return {
      tone: 'warning',
      word: `Unfinished · ${String(a.status || run.stopped || 'not certified').replace(/_/g, ' ')}`,
    };
  if (run.error) return { tone: 'danger', word: 'Stopped with an error' };
  return { tone: '', word: 'Reply without a draft' };
}
function lyRunChecks(model) {
  const run = LY.run;
  const items = [];
  if (!run) return items;
  const current = lySungTexts(model);
  const stale =
    !!run.final && !lySame(current, run.final) && !(run.base && lySame(current, run.base));
  const add = (item) => items.push({ source: 'run', stale, ...item });
  const lyric = run.lyric || {};
  const standing = Array.isArray(lyric.standing) ? lyric.standing : [];
  const reasonsFor = (n) => standing.filter((s) => new RegExp(`\\bL${n}\\b`).test(String(s)));
  // Suggestions: the writer's accepted lines against the draft it was given.
  if (run.final && run.base && run.final.length === run.base.length) {
    run.final.forEach((line, k) => {
      if (line === run.base[k]) return;
      const n = k + 1;
      const id = `p:${run.id}:${n}`;
      const out = LY.outcomes[id];
      if (out?.state === 'applied' || out?.state === 'kept') return;
      if (current[k] === line && !out) return; // already in the draft (the shell applied it)
      add({
        id,
        tone: 'issue',
        category: 'Suggested change',
        title: `The writer suggests a new line ${n}`,
        where: `${lySectionOfLine(model, n)?.title || 'Line'} · line ${n}`,
        lines: [n],
        text:
          reasonsFor(n).join(' ') ||
          `From the writer’s run (${lyRunStatus(run).word}). Check & apply compares it with your current draft first.`,
        original: run.base[k],
        proposal: line,
        decision: { run: run.id, n },
        stale: false,
      });
    });
  } else if (
    run.final &&
    !(run.base && lySame(run.final, run.base)) &&
    !lySame(run.final, current)
  ) {
    const id = `w:${run.id}`;
    if (!LY.outcomes[id] || LY.outcomes[id].state === 'failed')
      add({
        id,
        tone: 'issue',
        category: 'Writer draft',
        title: `The writer returned a ${lyPlural(run.final.length, 'line')} draft`,
        where: 'Whole draft',
        lines: [],
        text: run.base
          ? `Your draft had ${lyPlural(run.base.length, 'sung line')} when you asked; the lines do not correspond one to one, so this can only be taken whole.`
          : 'This reply was recovered without the draft it was asked about, so it cannot be compared line by line. It can only be taken whole.',
        whole: run.final,
        decision: { run: run.id, whole: true },
        stale: false,
      });
  }
  // Lines the run left open, and its standing findings.
  const open = Array.isArray(lyric.open) ? lyric.open : [];
  for (const n of open)
    add({
      id: `open:${n}`,
      tone: 'issue',
      category: 'Open line',
      title: `Line ${n} is still open in the writer's run`,
      where: lySectionOfLine(model, n)?.title || `Line ${n}`,
      lines: [n],
      text: reasonsFor(n).join(' ') || 'The run stopped with this line unresolved.',
      actions: [['ly-open-writer', 'Continue with the writer', 'message-circle', '']],
    });
  const tied = new Set(open.flatMap((n) => reasonsFor(n)));
  standing
    .filter((s) => !tied.has(s))
    .slice(0, 12)
    .forEach((s, k) => {
      const ns = [...String(s).matchAll(/\bL(\d+)\b/g)].map((m) => Number(m[1]));
      add({
        id: `standing:${k}`,
        tone: 'issue',
        category: 'Finding',
        title: String(s).slice(0, 140),
        where: ns.length ? lyLineRef(ns) : 'Whole draft',
        lines: ns,
        text: 'A finding standing when the run stopped.',
        actions: [],
      });
    });
  for (const code of Array.isArray(lyric.whole) ? lyric.whole : [])
    add({
      id: `whole:${code}`,
      tone: 'issue',
      category: 'Whole draft',
      title: `Whole-draft flag: ${code}`,
      where: 'Whole draft',
      lines: [],
      text: 'Reported by the writer’s run for the draft as a whole.',
      actions: [],
    });
  for (const t of run.tools || []) {
    if (typeof t.banned_pairs === 'number' && t.banned_pairs > 0)
      add({
        id: `banned:${t.name}`,
        tone: 'issue',
        category: 'Banned pairs',
        title: `${lyPlural(t.banned_pairs, 'banned pair')} standing`,
        where: t.name,
        lines: [],
        text: 'The two-tier ban is unskippable: this song is not finished while they stand.',
        actions: [],
      });
    if (t.error)
      add({
        id: `error:${t.name}`,
        tone: 'issue',
        category: 'Writer error',
        title: `${t.name} failed`,
        where: 'Writer run',
        lines: [],
        text: String(t.error).slice(0, 300),
        actions: [],
      });
    if (t.refusal)
      add({
        id: `refusal:${t.name}`,
        tone: 'input',
        category: 'Refused',
        title: `${t.name} refused`,
        where: 'Writer run',
        lines: [],
        text: String(t.refusal).slice(0, 300),
        actions: [['ly-open-writer', 'Open the writer', 'message-circle', '']],
      });
  }
  // Coverage: what the run could not judge is missing input, not a defect.
  const coverage = run.coverage;
  if (coverage && Array.isArray(coverage.obligations)) {
    const refused = coverage.obligations.filter((o) => o.status === 'refused');
    refused.slice(0, 12).forEach((o) => {
      const pron = /^pronunciation:/.test(o.id) || o.layer === 'pronunciation';
      add({
        id: `cov:${o.id}`,
        tone: 'input',
        category: pron ? 'Pronunciation' : 'Coverage',
        title: pron
          ? `A reading is needed${o.word ? ` for “${o.word}”` : ''}`
          : `Not judged: ${o.id}`,
        where:
          Array.isArray(o.matching_lines) && o.matching_lines.length
            ? lyLineRef(o.matching_lines)
            : 'Writer run',
        lines: Array.isArray(o.matching_lines) ? o.matching_lines : [],
        text:
          o.detail ||
          o.reason ||
          'The run could not judge this obligation, so its coverage is incomplete. That is missing input, not a pass or a failure.',
        actions: pron
          ? [['ly-tool', 'Open readings', 'globe', 'pronunciation']]
          : [['ly-tool', 'See all checks', 'circle-check', 'checks']],
      });
    });
    if (refused.length > 12)
      add({
        id: 'cov:more',
        tone: 'input',
        category: 'Coverage',
        title: `${refused.length - 12} more obligations were not judged`,
        where: 'Writer run',
        lines: [],
        text: 'All of them are listed under All checks.',
        actions: [['ly-tool', 'See all checks', 'circle-check', 'checks']],
      });
    const unasked = coverage.obligations.filter((o) => o.status === 'not_requested');
    if (unasked.length)
      add({
        id: 'cov:unasked',
        tone: 'note',
        category: 'Coverage',
        title: `${lyPlural(unasked.length, 'check')} not requested`,
        where: 'Writer run',
        lines: [],
        text: 'Disclosed by the run and not asked of this song; they are neither passed nor failed.',
        actions: [['ly-tool', 'See all checks', 'circle-check', 'checks']],
      });
  }
  for (const t of run.tools || [])
    for (const f of [].concat(t.folded || []))
      if (f && f.verdict === 'rejected') {
        const ns = [f.line, ...(f.members || [])].filter((x) => typeof x === 'number');
        add({
          id: `folded:${t.name}:${ns.join(',')}:${f.round ?? ''}`,
          tone: 'issue',
          category: 'Rejected answer',
          title: `The writer's answer for ${ns.length ? lyLineRef(ns) : 'a line'} was rejected`,
          where: 'Writer run',
          lines: ns,
          text:
            [f.answer ? `It answered “${f.answer}”.` : '', ...(f.reasons || [])]
              .filter(Boolean)
              .join(' ') || 'Rejected by the run’s verification.',
          actions: [['ly-open-writer', 'Open the writer', 'message-circle', '']],
        });
      }
  const asked = [...(run.tools || [])].reverse().find((t) => t.asked)?.asked;
  const askedLines = asked
    ? [asked.line, ...(asked.lines || []), ...(asked.members || [])].filter(
        (x) => typeof x === 'number'
      )
    : [];
  if (lyric.state && lyric.resumable !== false && !chatState.busy)
    add({
      id: 'waiting',
      tone: 'input',
      category: 'Writer',
      title: askedLines.length
        ? `The writer is waiting for an answer about ${lyLineRef(askedLines)}`
        : 'The writer is waiting for an answer',
      where: 'Writer run',
      lines: askedLines,
      text: 'The run asked a question and is paused until it gets an answer. Nothing continues on its own.',
      actions: [['ly-open-writer', 'Answer in the writer', 'message-circle', '']],
    });
  if (run.stopped && !run.recoveryExport)
    add({
      id: 'stopped',
      tone: 'note',
      category: 'Writer',
      title:
        run.stopped === 'MAX_STEPS'
          ? 'The writer stopped after its maximum number of steps'
          : `The writer stopped early (${run.stopped})`,
      where: 'Writer run',
      lines: [],
      text: 'The reply is incomplete for that reason, not finished.',
      actions: [['ly-open-writer', 'Open the writer', 'message-circle', '']],
    });
  const status = lyRunStatus(run);
  if (status?.tone === 'success' && run.final && lySame(run.final, current))
    add({
      id: 'certified',
      tone: 'note',
      category: 'Writer',
      title: 'The writer’s run finished with its requested checks passed',
      where: 'Writer run',
      lines: [],
      text: 'It passed the checks it was asked, under its declared readings, for exactly this draft. It is not a quality score or a performed-rhythm guarantee.',
      actions: [],
    });
  return items;
}

function lyItems() {
  const model = LY.model;
  const items = [...lyRunChecks(model), ...lyLocalChecks(model)];
  const order = { issue: 0, input: 1, note: 2 };
  return items.sort((a, b) => order[a.tone] - order[b.tone]);
}

// ── Check & apply ─────────────────────────────────────────────────────────
// Verifies the exact suggestion against the CURRENT draft and its
// declarations, then commits it as one undoable change — or keeps the
// original and says why. Nothing is cached between the check and the write.
function lyCheckApply(item) {
  const run = LY.run;
  const fail = (message) => {
    LY.outcomes[item.id] = { state: 'failed', message };
    lyRenderReview();
    return false;
  };
  if (!run || item.decision?.run !== run.id)
    return fail('This suggestion belongs to an earlier writer reply. Nothing was changed.');
  const model = lyParse(lyDraft().value);
  const current = lySungTexts(model);
  if (item.decision.whole) {
    if (run.base && !lySame(current, run.base))
      return fail(
        'Your draft changed after you asked the writer, so its draft would overwrite those edits. Your draft was kept. Ask the writer to review the current draft, or copy what you need from Compare.'
      );
    lyCommit(
      lyReplaceSung(model, item.whole, lyKeepSetup(model, run.wholeText || item.whole.join('\n'))),
      'The writer’s draft is in place. Undo restores yours.'
    );
    LY.outcomes[item.id] = {
      state: 'applied',
      message: 'Applied as one change. Undo restores your draft.',
    };
    lyRenderReview();
    return true;
  }
  const n = item.decision.n,
    k = n - 1;
  if (current.length !== run.base.length)
    return fail(
      `Your draft now has ${lyPlural(current.length, 'sung line')}; the suggestion was made for ${run.base.length}. Line numbers no longer line up, so nothing was changed.`
    );
  if (current[k] !== run.base[k])
    return fail(
      `Line ${n} changed after the writer suggested this (it now reads “${current[k]}”). Your line was kept.`
    );
  const text = String(item.proposal);
  if (!text.trim() || /[\r\n]/.test(text) || LY_BRACKET.test(text.trim()))
    return fail('The suggestion is not a single sung line. Nothing was changed.');
  // Declarations bound to the old text stop applying once it changes.
  const notes = [];
  const others = current.filter((t, j) => j !== k && t === run.base[k]).length;
  if (!others) {
    for (const r of lySetupOf(model, 'reading'))
      if (r.line === run.base[k])
        notes.push(
          `The reading for “${r.word}” no longer applies to this line; choose again if it is needed.`
        );
    const hook = lySetupOf(model, 'hook')[0];
    if (hook && hook.line === run.base[k])
      notes.push('This was the hook line; choose the hook again.');
  }
  const row = model.sung[k];
  const rows = model.text.split('\n');
  rows[row.i] = rows[row.i].replace(row.text, () => text.trim());
  lyCommit(rows.join('\n'), `Line ${n} updated. Undo restores it.`);
  LY.outcomes[item.id] = {
    state: 'applied',
    message: ['Applied. Undo restores the original.', ...notes].join(' '),
  };
  LY.activeLine = n;
  lyRenderReview();
  return true;
}
// Replace the sung lines of a draft with `lines` while keeping its headers and
// setup where the counts allow; otherwise the writer's text replaces it whole.
function lyReplaceSung(model, lines, whole) {
  if (model.sung.length !== lines.length) return whole;
  const rows = model.text.split('\n');
  model.sung.forEach((r, k) => (rows[r.i] = lines[k]));
  return rows.join('\n');
}
// A writer's text does not carry this page's [SETUP] lines; keep them.
function lyKeepSetup(model, text) {
  if (!model.setup.length || lyParse(text).setup.length) return text;
  return model.setup.map((d) => d.raw).join('\n') + '\n\n' + text;
}
function lyCommit(text, message) {
  const draft = lyDraft();
  draft.value = text;
  uiSaveLyrics();
  pushHistory();
  lyRefresh(true);
  if (message)
    showToast(message, 'success', { label: 'Undo', run: () => $ui('btn-undo')?.click() });
}

// ── Editing the text ──────────────────────────────────────────────────────
// Every structural edit rebuilds the text from rows that remember their old
// sung number, so line-number declarations (rhyme groups, returns — the
// harness's own spelling) follow their lines; members whose line is removed
// are dropped and reported, never silently re-pointed.
function lyBlocks(model) {
  const rows = model.rows.map((r) => ({ raw: r.raw, n: r.n || null, kind: r.kind }));
  const starts = model.sections.map((s) => (s.headerRow ? s.headerRow.i : s.rows[0].i));
  if (!starts.length) return { prefix: rows, blocks: [], suffix: [] };
  let lastContent = starts[starts.length - 1];
  for (let i = lastContent; i < rows.length; i++)
    if (rows[i].kind === 'sung' || rows[i].kind === 'section') lastContent = i;
  const trim = (block) => {
    while (block.length && !block[block.length - 1].raw.trim()) block.pop();
    return block;
  };
  const blocks = starts.map((start, k) =>
    trim(rows.slice(start, k + 1 < starts.length ? starts[k + 1] : lastContent + 1))
  );
  return { prefix: trim(rows.slice(0, starts[0])), blocks, suffix: rows.slice(lastContent + 1) };
}
function lyAssemble({ prefix, blocks, suffix }) {
  const out = [...prefix];
  for (const b of blocks) {
    if (out.length && out[out.length - 1].raw.trim()) out.push({ raw: '' });
    out.push(...b);
  }
  const first = suffix.findIndex((r) => r.raw.trim());
  if (first >= 0) {
    if (out.length) out.push({ raw: '' });
    out.push(...suffix.slice(first));
  }
  // Renumber: old sung n → new sung n.
  const map = new Map();
  let n = 0;
  for (const r of out) {
    const t = r.raw.trim();
    if (!t || LY_BRACKET.test(t)) continue;
    n++;
    if (r.n && !map.has(r.n)) map.set(r.n, n);
  }
  let dropped = 0;
  const rows = out.map((r) => {
    const t = r.raw.trim();
    if (!LY_SETUP.test(t)) return r.raw;
    const item = lyParseSetup(t);
    if (item.key !== 'rhyme groups' && item.key !== 'returns') return r.raw;
    const groups = lyParseGroups(item.value)
      .map((g) =>
        g.filter((m) => {
          if (m.bad) return true;
          if (!map.has(m.line)) {
            dropped++;
            return false;
          }
          m.line = map.get(m.line);
          return true;
        })
      )
      .filter((g) => g.length > 1);
    return groups.length ? `[SETUP${LY_DASH}${item.key}${LY_DASH}${lyGroupsText(groups)}]` : null;
  });
  return { text: rows.filter((r) => r !== null).join('\n'), dropped };
}
function lyEditSections(mutate, message) {
  const model = lyParse(lyDraft().value);
  const parts = lyBlocks(model);
  if (mutate(parts, model) === false) return;
  const { text, dropped } = lyAssemble(parts);
  lyCommit(
    text,
    message +
      (dropped
        ? ` ${lyPlural(dropped, 'declared link member')} pointed at removed lines and ${dropped === 1 ? 'was' : 'were'} removed.`
        : '')
  );
}
// Replace every [SETUP — key — …] row with `values` (in order), placed with
// the other setup rows (or at the top, before the song).
function lySetSetup(key, values) {
  const model = lyParse(lyDraft().value);
  const rows = model.text ? model.text.split('\n') : [];
  const own = model.setup.filter((s) => s.key === key).map((s) => s.i);
  const anchor = own.length
    ? own[0]
    : model.setup.length
      ? model.setup[model.setup.length - 1].i + 1
      : 0;
  const fresh = values.map((v) => `[SETUP${LY_DASH}${key}${v === '' ? '' : LY_DASH + v}]`);
  const kept = rows.filter((_, i) => !own.includes(i));
  const at = anchor - own.filter((i) => i < anchor).length;
  kept.splice(at, 0, ...fresh);
  // Keep one blank line between the setup block and the song.
  const lastSetup = at + fresh.length - 1;
  if (
    !model.setup.length &&
    fresh.length &&
    kept[lastSetup + 1] !== undefined &&
    kept[lastSetup + 1].trim()
  )
    kept.splice(lastSetup + 1, 0, '');
  if (!fresh.length && at === 0) while (kept.length && !kept[0].trim()) kept.shift();
  return kept.join('\n');
}
function lySetupCommit(key, values, message) {
  lyCommit(lySetSetup(key, values), message);
}
function lyRewriteHeader(sectionIndex, change, message) {
  const model = lyParse(lyDraft().value);
  const s = model.sections[sectionIndex];
  if (!s) return;
  const rows = model.text.split('\n');
  const header = s.header
    ? { ...s.header, extra: [...s.header.extra] }
    : { name: 'SECTION', lines: null, bars: null, meter: null, pickup: null, extra: [] };
  change(header, s);
  const text = lyHeaderText(header);
  if (s.headerRow) rows[s.headerRow.i] = text;
  else rows.splice(s.rows[0].i, 0, text);
  lyCommit(rows.join('\n'), message);
}

// ── Rendering helpers ─────────────────────────────────────────────────────
const lyBtn = (act, label, ic, { id = '', cls = 'cm-btn', extra = '', hideLabel = false } = {}) =>
  `<button type="button" class="${cls}" data-ui="${act}"${id !== '' ? ` data-id="${esc(String(id))}"` : ''} ${hideLabel ? `aria-label="${esc(label)}" title="${esc(label)}"` : ''} ${extra}>${ic ? icon(ic, 18) : ''}${hideLabel ? '' : `<span>${esc(label)}</span>`}</button>`;
const lyMenu = (
  id,
  label,
  ic,
  items,
  { cls = 'cm-btn', align = 'start', hideLabel = false } = {}
) =>
  `<div class="ly-menu-wrap"><button type="button" class="${cls}" data-ui="ly-menu" data-id="${id}" aria-haspopup="true" aria-expanded="false" aria-controls="ly-menu-${id}"${hideLabel ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}>${ic ? icon(ic, 18) : ''}${hideLabel ? '' : `<span>${esc(label)}</span>${icon('chevron-down', 16)}`}</button><div class="cm-menu ly-menu" data-align="${align}" id="ly-menu-${id}" hidden>${items}</div></div>`;
const lyMenuItem = (act, label, ic, id = '', extra = '') =>
  lyBtn(act, label, ic, { id, cls: 'ly-menu-item', extra: `role="menuitem" ${extra}` });
const lyStatus = (tone, word, ic) =>
  `<span class="cm-status" data-tone="${tone}">${icon(ic || (tone === 'success' ? 'circle-check' : tone === 'danger' ? 'circle-alert' : tone === 'warning' ? 'triangle-alert' : 'info'), 14)}<span>${esc(word)}</span></span>`;
function lyWordCount(text) {
  return lyTokens(text, LY.model?.voices).length;
}

function lyMountMarkup() {
  const sectionItems =
    LY_SECTION_NAMES.map((name) => lyMenuItem('ly-add-section', name, 'plus', name)).join('') +
    '<div class="cm-menu-sep"></div>' +
    lyMenuItem('ly-add-section', 'Other name…', 'pencil', '');
  return `<div class="ly-page">
<header class="ly-head">
  <div class="ly-head-title"><span class="ly-doc-icon">${icon('file-text', 22)}</span><div class="ly-head-text"><h2 id="ly-title">Untitled song</h2><p id="ly-meta" class="ly-meta"></p></div></div>
  <div class="ly-head-actions">
    ${lyBtn('ly-pane', 'History & recovery', 'refresh-cw', { id: 'history', cls: 'cm-btn cm-btn-outline ly-history-btn' })}
    ${lyMenu('export', 'Export', 'download', lyMenuItem('copy-lyrics', 'Copy with headers', 'copy') + lyMenuItem('ly-copy-sung', 'Copy sung lines only', 'clipboard') + lyMenuItem('ly-download', 'Download as text', 'download'), { cls: 'cm-btn cm-btn-outline', align: 'end' })}
    ${lyMenu('ai', 'Write with AI', 'sparkles', lyMenuItem('new-lyrics', 'New song', 'file-plus') + lyMenuItem('edit-lyrics', 'Edit this draft', 'edit-3') + lyMenuItem('attach-recipe', 'Use current recipe', 'layers') + '<div class="cm-menu-sep"></div>' + lyMenuItem('ly-pane', 'Open the writer', 'message-circle', 'writer'), { cls: 'cm-btn cm-btn-outline', align: 'end' })}
    ${lyBtn('ly-review', 'Review draft', 'check', { cls: 'cm-btn cm-btn-primary' })}
  </div>
</header>
<div class="ly-body" id="ly-body">
  <aside class="ly-song" id="ly-song" aria-label="Song outline and setup">
    <div class="ly-song-scroll">
      <section class="ly-card" aria-labelledby="ly-song-h">
        <div class="ly-card-head"><h3 id="ly-song-h">Song</h3>${lyBtn('ly-collapse', 'Collapse song outline', 'chevron-down', { id: 'song', cls: 'cm-btn cm-btn-icon ly-collapse', hideLabel: true, extra: 'aria-expanded="true"' })}</div>
        <div class="ly-collapsible" id="ly-song-part">
          <div class="ly-tabs" role="tablist" aria-label="Song">${lyBtn('ly-song-tab', 'Sections', '', { id: 'sections', cls: 'cm-tab', extra: 'role="tab"' })}${lyBtn('ly-song-tab', 'Plan', '', { id: 'plan', cls: 'cm-tab', extra: 'role="tab"' })}</div>
          <div id="ly-song-body" role="tabpanel"></div>
        </div>
      </section>
      <section class="ly-card" aria-labelledby="ly-setup-h">
        <div class="ly-card-head"><h3 id="ly-setup-h">Song setup</h3>${lyBtn('ly-collapse', 'Collapse song setup', 'chevron-down', { id: 'setup', cls: 'cm-btn cm-btn-icon ly-collapse', hideLabel: true, extra: 'aria-expanded="true"' })}</div>
        <div class="ly-collapsible" id="ly-setup-part"><div id="ly-setup-list"></div></div>
      </section>
    </div>
    <div class="ly-song-foot">${lyMenu('start', 'New song or import…', 'file-plus', lyMenuItem('new-lyrics', 'New song with the writer', 'sparkles') + lyMenuItem('ly-import', 'Import a text file', 'upload') + lyMenuItem('ly-blank', 'Start a blank draft', 'file'), { cls: 'cm-btn ly-start' })}</div>
  </aside>
  <main class="ly-doc-col" id="ly-doc-col">
    <div class="ly-toolbar" role="toolbar" aria-label="Document">
      <div class="cm-segmented ly-mode" role="group" aria-label="Mode">${lyBtn('ly-view', 'Read', 'eye', { id: 'read', cls: '' })}${lyBtn('ly-view', 'Edit', 'pencil', { id: 'edit', cls: '' })}</div>
      ${lyMenu('section', 'Section', 'plus', sectionItems)}
      ${lyBtn('ly-find-open', 'Find', 'search', { extra: 'aria-controls="ly-find"' })}
      ${lyMenu('display', 'Display', 'sliders-horizontal', '<div class="cm-menu-label">Text size</div>' + ['Normal', 'Large', 'Larger'].map((l, k) => lyMenuItem('ly-text-size', l, '', String(k), 'aria-pressed="false"')).join('') + '<div class="cm-menu-sep"></div>' + lyMenuItem('ly-numbers', 'Line numbers', '', '', 'aria-pressed="true"') + lyMenuItem('ly-setup-rows', 'Setup and stamps in Read', '', '', 'aria-pressed="true"'), { align: 'end' })}
    </div>
    <div class="ly-find" id="ly-find" hidden role="search"><input id="ly-find-input" class="cm-input" type="search" placeholder="Find in lyrics" aria-label="Find in lyrics" autocomplete="off"><span id="ly-find-count" class="ly-find-count" role="status" aria-live="polite"></span>${lyBtn('ly-find-step', 'Previous match', 'arrow-up', { id: '-1', cls: 'cm-btn cm-btn-icon', hideLabel: true })}${lyBtn('ly-find-step', 'Next match', 'arrow-down', { id: '1', cls: 'cm-btn cm-btn-icon', hideLabel: true })}${lyBtn('ly-find-close', 'Close find', 'x', { cls: 'cm-btn cm-btn-icon', hideLabel: true })}</div>
    <div class="ly-doc-scroll" id="ly-doc-scroll">
      <div class="ly-doc" id="ly-doc"></div>
      <div class="lyrics-editor" id="lyrics-editor" hidden><label for="lyrics-draft" class="ly-sr">Lyrics draft</label><textarea id="lyrics-draft" placeholder="Write here. A line in [brackets] starts a section, e.g. [Verse 1] or [CHORUS — 4 lines — 4 bars of 4/4]." spellcheck="true"></textarea></div>
    </div>
    <div class="ly-status" id="ly-status"></div>
    <div class="ly-tools" id="ly-tools">
      <div class="ly-tools-bar" role="toolbar" aria-label="Writing tools">
        ${lyBtn('ly-tools-toggle', 'Writing tools', 'list', { cls: 'cm-btn ly-tools-main', extra: 'aria-expanded="false" aria-controls="ly-tools-drawer"' })}
        <span class="ly-tools-sep" aria-hidden="true"></span>
        ${lyBtn('ly-tool', 'Rhyme links', 'link', { id: 'rhymes', cls: 'cm-btn ly-tool-short', extra: 'title="Rhyme links"' })}
        ${lyBtn('ly-tool', 'Rhythm & placement', 'music', { id: 'rhythm', cls: 'cm-btn ly-tool-short', extra: 'title="Rhythm &amp; placement"' })}
        ${lyBtn('ly-tool', 'Pronunciation', 'volume-2', { id: 'pronunciation', cls: 'cm-btn ly-tool-short', extra: 'title="Pronunciation"' })}
        ${lyBtn('ly-tool', 'Returns & voices', 'repeat', { id: 'returns', cls: 'cm-btn ly-tool-short', extra: 'title="Returns &amp; voices"' })}
        ${lyBtn('ly-tools-toggle', 'Show or hide writing tools', 'chevron-down', { cls: 'cm-btn cm-btn-icon ly-tools-chevron', hideLabel: true, extra: 'aria-expanded="false" aria-controls="ly-tools-drawer"' })}
      </div>
      <div class="ly-tools-drawer" id="ly-tools-drawer" hidden>
        <div class="ly-tabs ly-tool-tabs" role="tablist" aria-label="Writing tools">${LY_TOOLS.map(([id, label, ic]) => lyBtn('ly-tool', label, ic, { id, cls: 'cm-tab', extra: 'role="tab"' })).join('')}</div>
        <div class="ly-tool-body" id="ly-tool-body" role="tabpanel"></div>
      </div>
    </div>
  </main>
  <aside class="ly-side" id="ly-side" aria-label="Review, history and writer">
    <div class="ly-side-head">
      <div class="ly-side-tabs" role="tablist" aria-label="Panel">${lyBtn('ly-pane', 'Review', 'circle-alert', { id: 'review', cls: 'cm-tab', extra: 'role="tab"' })}${lyBtn('ly-pane', 'History', 'refresh-cw', { id: 'history', cls: 'cm-tab', extra: 'role="tab"' })}${lyBtn('ly-pane', 'Writer', 'message-circle', { id: 'writer', cls: 'cm-tab', extra: 'role="tab"' })}</div>
      ${lyBtn('ly-pane', 'Close panel', 'x', { id: '', cls: 'cm-btn cm-btn-icon', hideLabel: true })}
    </div>
    <div class="ly-side-view" id="ly-review" role="tabpanel" aria-label="Review"></div>
    <div class="ly-side-view" id="ly-history" role="tabpanel" aria-label="History and recovery" hidden></div>
    <div class="ly-side-view ly-writer" id="ly-writer" role="tabpanel" aria-label="Writer" hidden>
      <div class="ly-writer-actions">${lyBtn('new-lyrics', 'New song', 'file-plus', { cls: 'cm-btn cm-btn-tonal' })}${lyBtn('edit-lyrics', 'Edit this draft', 'edit-3', { cls: 'cm-btn cm-btn-outline' })}${lyBtn('attach-recipe', 'Use current recipe', 'layers', { cls: 'cm-btn cm-btn-outline' })}</div>
      <p class="ly-note">The writer is a separate AI conversation on the Codex Musica service. Nothing is sent until you press Ask, and lyric work never changes your recipe.</p>
      <div id="lyrics-chat"></div>
    </div>
  </aside>
</div>
<input type="file" id="ly-file" accept=".txt,.md,text/plain" hidden>
</div>`;
}

// ── Header, outline and setup ─────────────────────────────────────────────
function lyRenderHead() {
  const model = LY.model;
  const title = lySetupOf(model, 'title')[0]?.value;
  $ui('ly-title').textContent = title || 'Untitled song';
  const status = lyRunStatus(LY.run);
  const bits = [
    `Session: ${app.workspaceName || 'Untitled session'}`,
    lyPlural(model.sung.length, 'line'),
  ];
  $ui('ly-meta').innerHTML =
    bits.map(esc).join(' · ') +
    (chatState.busy && chatState.task?.domain === 'lyrics'
      ? ' ' + lyStatus('info', 'Writer running', 'loader')
      : status
        ? ' ' + lyStatus(status.tone, status.word)
        : '');
}
function lySectionMeta(s) {
  const parts = [lyPlural(s.sung.length, 'line')];
  if (s.header?.bars != null) parts.push(lyPlural(s.header.bars, 'bar'));
  if (s.header?.meter) parts.push(s.header.meter);
  if (s.returnOf) parts.push(`Same as ${s.returnOf.title}`);
  else if (s.uses > 1) parts.push(`Used ${s.uses} times`);
  return parts.join(' · ');
}
function lyRenderSong(items) {
  const model = LY.model;
  document
    .querySelectorAll('[data-ui="ly-song-tab"]')
    .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === LY.songTab)));
  const body = $ui('ly-song-body');
  if (LY.songTab === 'plan') body.innerHTML = lyPlanHtml();
  else {
    const active = lySectionOfLine(model, LY.activeLine);
    const flagged = new Map();
    for (const it of items)
      for (const n of it.lines || []) {
        const s = lySectionOfLine(model, n);
        if (s && (!flagged.has(s.index) || it.tone === 'issue')) flagged.set(s.index, it.tone);
      }
    const rows = model.sections
      .map((s) => {
        const tone = flagged.get(s.index);
        const menu = lyMenu(
          `sec-${s.index}`,
          `${s.title} actions`,
          'ellipsis',
          lyMenuItem(
            'ly-sec-move',
            'Move up',
            'arrow-up',
            `${s.index}:-1`,
            s.index === 0 ? 'disabled' : ''
          ) +
            lyMenuItem(
              'ly-sec-move',
              'Move down',
              'arrow-down',
              `${s.index}:1`,
              s.index === model.sections.length - 1 ? 'disabled' : ''
            ) +
            lyMenuItem('ly-sec-dup', 'Duplicate', 'copy', s.index) +
            lyMenuItem('ly-sec-rhythm', 'Rhythm…', 'music', s.index) +
            '<div class="cm-menu-sep"></div>' +
            lyMenuItem('ly-sec-remove', 'Remove', 'trash-2', s.index),
          { cls: 'cm-btn cm-btn-icon', align: 'end', hideLabel: true }
        );
        return `<li class="ly-sec-row${active === s ? ' is-active' : ''}"><button type="button" class="ly-sec-main" data-ui="ly-goto" data-id="${s.index}"${active === s ? ' aria-current="true"' : ''}><span class="ly-sec-num">${s.index + 1}</span><span class="ly-sec-text"><strong>${esc(s.title)}</strong><small>${esc(lySectionMeta(s))}</small></span>${s.returnOf ? `<span class="ly-sec-link" title="Exact return of ${esc(s.returnOf.title)}">${icon('repeat', 16)}</span>` : ''}${tone ? `<span class="ly-dot" data-tone="${tone}" title="${esc(LY_TONES[tone].one)}"><span class="ly-sr">${esc(LY_TONES[tone].one)}</span></span>` : ''}</button>${menu}</li>`;
      })
      .join('');
    const bars = model.sections.filter((s) => s.sung.length);
    const allBars = bars.length && bars.every((s) => s.header?.bars != null);
    body.innerHTML =
      (model.sections.length
        ? `<ol class="ly-outline">${rows}</ol>`
        : `<p class="ly-note ly-pad">No sections yet. A line in [brackets] starts one; without brackets, blank lines separate stanzas.</p>`) +
      lyMenu(
        'add',
        'Add section',
        'plus',
        LY_SECTION_NAMES.map((name) => lyMenuItem('ly-add-section', name, 'plus', name)).join('') +
          '<div class="cm-menu-sep"></div>' +
          lyMenuItem('ly-add-section', 'Other name…', 'pencil', ''),
        { cls: 'cm-btn ly-add' }
      ) +
      `<p class="ly-totals">${esc(lyPlural(model.sung.length, 'line'))} · ${
        allBars
          ? esc(
              lyPlural(
                bars.reduce((t, s) => t + s.header.bars, 0),
                'bar'
              )
            )
          : 'bars not declared'
      }</p>`;
  }
  // Song setup summaries: declared values only.
  const setup = [
    [
      'structure',
      'Structure & story',
      'file-text',
      model.sections.length
        ? `${[...new Set(model.sections.map((s) => s.base))].join(' – ')} · ${lyPlural(model.sections.length, 'section')}`
        : 'No sections yet',
      'violet',
    ],
    [
      'rhythm',
      'Rhythm & timing',
      'music',
      (() => {
        const m = [...new Set(model.sections.map((s) => s.header?.meter).filter(Boolean))];
        return m.length ? `${m.join(', ')} declared` : 'Not declared';
      })(),
      'amber',
    ],
    [
      'rhymes',
      'Rhymes & word rules',
      'link',
      (() => {
        const bits = [];
        const rel = lySetupOf(model, 'relation')[0];
        if (rel) bits.push(rel.value);
        const g = lySetupOf(model, 'rhyme groups').flatMap((d) => lyParseGroups(d.value));
        if (g.length) bits.push(lyPlural(g.length, 'link'));
        if (lySetupOf(model, 'title').length) bits.push('title');
        if (lySetupOf(model, 'hook').length) bits.push('hook');
        const w = lySetupOf(model, 'require').length + lySetupOf(model, 'avoid').length;
        if (w) bits.push(lyPlural(w, 'word rule'));
        return bits.join(' · ') || 'Nothing declared';
      })(),
      'pink',
    ],
    [
      'pronunciation',
      'Language & readings',
      'globe',
      (() => {
        const r = lySetupOf(model, 'reading');
        const need = r.filter((x) => x.state !== 'declared').length;
        return r.length
          ? `${lyPlural(r.length - need, 'reading')} chosen${need ? ` · ${need} open` : ''}`
          : 'No readings declared';
      })(),
      'blue',
    ],
  ];
  $ui('ly-setup-list').innerHTML = setup
    .map(
      ([id, label, ic, sum, hue]) =>
        `<button type="button" class="ly-setup-row" data-ui="ly-tool" data-id="${id}"><span class="ly-setup-icon" data-hue="${hue}">${icon(ic, 18)}</span><span class="ly-setup-text"><strong>${esc(label)}</strong><small>${esc(sum)}</small></span>${icon('chevron-right', 16)}</button>`
    )
    .join('');
}
function lyPlanHtml() {
  const task = LY.run?.task || chatState.task;
  const lyric = LY.run?.lyric || chatState.lyric;
  const w = task?.domain === 'lyrics' ? task.workflow : null;
  const decl = lyric?.decl && typeof lyric.decl === 'object' ? lyric.decl : null;
  if (!w && !decl)
    return `<div class="ly-pad">${uiEmptyState({ title: 'No writer plan yet', text: 'Plans come from the writer: it sweeps seeds, screens rhyme pairs and then draws a plan. An inspection-only plan can be looked at but cannot qualify a production song.', actions: lyBtn('new-lyrics', 'New song with the writer', 'sparkles', { cls: '' }) })}</div>`;
  const steps = w
    ? [
        ['Sweep', w.sweeps?.length ? `${lyPlural(w.sweeps.length, 'sweep')}` : ''],
        ['Screen', w.screen ? 'done' : ''],
        ['Plan', w.plan ? 'done' : ''],
        ['Grade', w.grade ? 'done' : ''],
        ['Revise', task.artifact ? task.artifact.status || 'run' : ''],
      ]
    : [];
  const fields = decl
    ? Object.entries(decl)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .slice(0, 24)
        .map(
          ([k, v]) =>
            `<dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc((typeof v === 'string' ? v : JSON.stringify(v)).slice(0, 400))}</dd>`
        )
        .join('')
    : '';
  return `<div class="ly-pad"><p class="ly-note">Planning information from the writer’s current conversation. It records what was planned and declared; it does not certify the story or the song.</p>${
    steps.length
      ? `<ol class="ly-steps">${steps.map(([name, st]) => `<li data-done="${st ? 'true' : 'false'}">${icon(st ? 'circle-check' : 'circle', 16)}<span>${name}</span><small>${esc(st || 'not yet')}</small></li>`).join('')}</ol>`
      : ''
  }${fields ? `<h4 class="ly-h4">Declared for the run</h4><dl class="ly-dl">${fields}</dl>` : ''}</div>`;
}

// ── The document ──────────────────────────────────────────────────────────
function lyLineHtml(row, model, marks, focus) {
  const spans = lyWordSpans(row.text, model.voices)
    .map((p) => {
      if (p.gap !== undefined) return esc(p.gap);
      const cls = [
        p.aside ? 'ly-aside' : '',
        LY.find.q && p.word.toLowerCase().includes(LY.find.q.toLowerCase()) ? 'ly-hit' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<span${cls ? ` class="${cls}"` : ''}${p.aside ? ' title="Unsung aside (parentheses are not sung unless voices are declared)"' : ''}>${esc(p.word)}</span>`;
    })
    .join('');
  const tone = marks.get(row.n);
  const active = LY.activeLine === row.n;
  let html = `<li class="ly-line${active ? ' is-active' : ''}${focus.has(row.n) ? ' is-focus' : ''}"${tone ? ` data-tone="${tone}"` : ''} data-n="${row.n}"><button type="button" class="ly-line-btn" data-ui="ly-line" data-id="${row.n}" aria-pressed="${active}"><span class="ly-num" aria-hidden="true">${row.n}</span><span class="ly-sr">Line ${row.n}${tone ? `, ${LY_TONES[tone].one}` : ''}: </span><span class="ly-text">${spans}</span>${tone ? `<span class="ly-mark" data-tone="${tone}">${icon(LY_TONES[tone].icon, 16)}</span>` : ''}</button></li>`;
  if (active) {
    const repeated = model.repeats.find((r) => r.text === row.text);
    html += `<li class="ly-line-tools" role="toolbar" aria-label="Line ${row.n} tools">${lyBtn('ly-line-tool', 'Rhyme link', 'link', { id: `rhymes:${row.n}` })}${lyBtn('ly-line-tool', 'Rhythm', 'music', { id: `rhythm:${row.n}` })}${lyBtn('ly-line-tool', 'Pronunciation', 'volume-2', { id: `pronunciation:${row.n}` })}${repeated ? lyBtn('ly-line-tool', `Used ${repeated.lines.length} times`, 'repeat', { id: `returns:${row.n}` }) : ''}${lyBtn('ly-line-tool', 'Edit line', 'pencil', { id: `edit:${row.n}` })}</li>`;
  }
  return html;
}
function lyRenderDoc(items, current) {
  const model = LY.model;
  const doc = $ui('ly-doc');
  const editing = LY.view === 'edit';
  doc.hidden = editing;
  $ui('lyrics-editor').hidden = !editing;
  document
    .querySelectorAll('[data-ui="ly-view"]')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === LY.view)));
  if (editing) return;
  if (!model.text.trim()) {
    doc.innerHTML = uiEmptyState({
      title: 'No lyrics yet',
      text: 'Write the draft yourself in Edit, import a text file, or start a new song with the writer. Section headers such as [Verse 1] or [CHORUS — 4 lines — 4 bars of 4/4] shape the outline.',
      actions:
        lyBtn('ly-view', 'Start writing', 'pencil', { id: 'edit', cls: '' }) +
        lyBtn('new-lyrics', 'New song with the writer', 'sparkles', { cls: '' }) +
        lyBtn('ly-import', 'Import a text file', 'upload', { cls: '' }),
    });
    return;
  }
  const marks = new Map();
  for (const it of items)
    for (const n of it.lines || []) if (!marks.has(n) || it.tone === 'issue') marks.set(n, it.tone);
  const focus = new Set(current?.lines || []);
  const prefs = LY.prefs;
  let html = '';
  if (prefs.setupRows.get() && model.setup.length)
    html += `<div class="ly-setup-block"><div class="ly-block-label">${icon('settings', 14)}<span>Declared for the writer</span>${lyBtn('ly-tool', 'Edit', '', { id: 'rhymes', cls: 'ly-link-btn' })}</div><ul>${model.setup.map((d) => `<li>${esc(d.raw.slice(1, -1).replace(/^SETUP\s+—\s+/i, ''))}</li>`).join('')}</ul></div>`;
  for (const s of model.sections) {
    const meta = [lyPlural(s.sung.length, 'line')];
    if (s.header?.bars != null || s.header?.meter)
      meta.push(
        `${s.header.bars != null ? lyPlural(s.header.bars, 'bar') : ''}${s.header.meter ? `${s.header.bars != null ? ' of ' : ''}${s.header.meter}` : ''}${s.header.pickup ? `, ${s.header.pickup}` : ''}`
      );
    const ret = s.returnOf
      ? lyBtn('ly-goto', `Same as ${s.returnOf.title}`, 'repeat', {
          id: s.returnOf.index,
          cls: 'ly-chip-link',
        })
      : s.uses > 1
        ? lyBtn('ly-tool', `Used ${s.uses} times`, 'repeat', { id: 'returns', cls: 'ly-chip-link' })
        : '';
    const count =
      s.header?.lines != null && s.header.lines !== s.sung.length
        ? lyStatus('danger', `declares ${s.header.lines}`)
        : '';
    html += `<section class="ly-sec" id="ly-sec-${s.index}" aria-labelledby="ly-sec-h-${s.index}"><header class="ly-sec-head"><h3 id="ly-sec-h-${s.index}">${esc(s.title)}</h3>${ret}<span class="ly-sec-meta">${esc(meta.join(' · '))}</span>${count}</header>`;
    html += s.sung.length
      ? `<ol class="ly-lines${prefs.numbers.get() ? '' : ' no-numbers'}">${s.sung.map((r) => lyLineHtml(r, model, marks, focus)).join('')}</ol>`
      : `<p class="ly-note">No lines yet. ${lyBtn('ly-edit-at', 'Write in this section', 'pencil', { id: s.headerRow ? s.headerRow.i : 0, cls: 'ly-link-btn' })}</p>`;
    html += '</section>';
  }
  if (prefs.setupRows.get() && model.stamps.length)
    html += `<div class="ly-setup-block">${model.stamps.map((st) => `<div class="ly-block-label">${icon('bookmark', 14)}<span>Run stamp</span></div><p>${esc(st.raw)}</p>`).join('')}</div>`;
  doc.innerHTML = html;
  doc.dataset.size = prefs.size.get();
}
function lyCaret() {
  const draft = lyDraft();
  const before = draft.value.slice(0, draft.selectionStart);
  const rowIndex = before.split('\n').length - 1;
  const row = LY.model.rows[rowIndex];
  const col = before.length - before.lastIndexOf('\n') - 1;
  let word = '';
  if (row && row.kind === 'sung') {
    const m = [...row.raw.matchAll(/(?:[A-Za-zÀ-ɏḀ-ỿ]|['’-])+/g)].find(
      (x) => x.index <= col && x.index + x[0].length >= col
    );
    word = m ? m[0] : '';
  }
  return { row, word };
}
function lyRenderStatus() {
  const model = LY.model;
  let left = '';
  if (LY.view === 'edit') {
    const { row, word } = lyCaret();
    if (row?.kind === 'sung')
      left = [
        row.section?.title,
        `Line ${row.n}`,
        lyPlural(lyWordCount(row.text), 'word'),
        word && `Word: ${word}`,
      ]
        .filter(Boolean)
        .join(' · ');
    else if (row?.kind === 'section') left = `Section header · ${row.section.title}`;
    else if (row?.kind === 'setup') left = 'Setup line (not sung)';
    else if (row?.kind === 'stamp') left = 'Run stamp (not sung)';
    else left = 'Blank line';
  } else if (LY.activeLine && model.sung[LY.activeLine - 1]) {
    const row = model.sung[LY.activeLine - 1];
    const readings = lySetupOf(model, 'reading').filter((r) => r.line === row.text).length;
    left = [
      row.section?.title,
      `Line ${row.n}`,
      lyPlural(lyWordCount(row.text), 'word'),
      readings && lyPlural(readings, 'reading'),
    ]
      .filter(Boolean)
      .join(' · ');
  } else left = 'Select a line to see its tools';
  $ui('ly-status').innerHTML =
    `<span>${esc(left)}</span><span>${esc(`${lyPlural(model.sung.length, 'line')} · ${lyPlural(model.sections.length, 'section')}`)}</span>`;
}

// ── Review: one active decision at a time ─────────────────────────────────
function lyRecoveryState() {
  const lyric = chatState.lyric || LY.run?.lyric || null;
  const lyricChat = (chatState.task?.domain || chatState.pending?.domain) === 'lyrics' || !!lyric;
  const s = {
    busy: chatState.busy && lyricChat,
    pending: lyricChat && !!chatState.pending && !chatState.busy,
    archives: chatState.archives || [],
    lyric,
    retryAt: chatState.retryAt || 0,
  };
  s.attention =
    s.pending ||
    !!lyric?.uncertain_proposal ||
    !!lyric?.new_run_required ||
    LY.run?.artifact?.status === 'interrupted';
  return s;
}
function lyItemHtml(item, count, index) {
  const tone = LY_TONES[item.tone];
  const out = LY.outcomes[item.id];
  const own = LY.own[item.id];
  let html = `<article class="ly-item" data-tone="${item.tone}" aria-labelledby="ly-item-title"><div class="ly-item-cat">${icon(tone.icon, 16)}<span>${esc(item.category)}</span><span class="ly-sr">(${esc(tone.one)})</span></div>`;
  if (item.stale)
    html += `<p class="ly-stale">${lyStatus('warning', 'From the writer’s last run')} Your draft has changed since, so this may no longer apply. ${lyBtn('ly-ask-review', 'Ask the writer to review the current draft', '', { cls: 'ly-link-btn' })}</p>`;
  else if (item.source === 'run') html += `<p class="ly-source">From the writer’s last reply</p>`;
  html += `<h3 id="ly-item-title">${esc(item.title)}</h3><p class="ly-item-where">${esc(item.where)}${item.lines?.length ? ` · ${lyBtn('ly-show-lines', 'Show in draft', '', { id: item.lines[0], cls: 'ly-link-btn' })}` : ''}</p>`;
  if (item.text) html += `<p class="ly-item-text">${esc(item.text)}</p>`;
  if (item.original !== undefined) {
    const n = item.decision.n;
    html += `<div class="ly-compare"><div class="ly-orig"><span>Original</span><p>${esc(item.original)}</p></div><div class="ly-sugg"><span>Suggested</span><p>${esc(item.proposal)}</p></div></div><p class="ly-meta">${esc(`${lyPlural(lyWordCount(item.original), 'word')} → ${lyPlural(lyWordCount(item.proposal), 'word')}`)}</p>`;
    if (out?.state === 'failed')
      html += `<div class="ly-outcome" data-tone="danger" role="alert">${icon('circle-alert', 16)}<span><strong>Not applied.</strong> ${esc(out.message)}</span></div>`;
    if (own !== undefined)
      html += `<div class="ly-own"><label for="ly-own-input">Your line ${n}</label><input id="ly-own-input" class="cm-input" data-id="${esc(item.id)}" value="${esc(own)}"><div class="ly-actions">${lyBtn('ly-own-check', 'Ask the writer to check it', 'sparkles', { id: item.id, cls: 'cm-btn cm-btn-tonal' })}${lyBtn('ly-own-put', 'Put it in my draft (unchecked)', 'pencil', { id: item.id, cls: 'cm-btn cm-btn-outline' })}${lyBtn('ly-own-cancel', 'Cancel', '', { id: item.id, cls: 'cm-btn' })}</div><p class="ly-note">The writer checks it against the current draft and its declarations; putting it in yourself is an ordinary edit that nothing has checked.</p></div>`;
    else
      html += `<div class="ly-actions">${lyBtn('ly-apply', 'Check & apply', 'check', { id: item.id, cls: 'cm-btn cm-btn-primary' })}${lyBtn('ly-own', 'Write my own', 'pencil', { id: item.id, cls: 'cm-btn cm-btn-outline' })}${lyBtn('ly-keep', 'Keep mine', '', { id: item.id, cls: 'cm-btn' })}</div><p class="ly-note">Check & apply compares this suggestion with your current draft and its declarations first. If the line or its numbering changed, your original stays and the reason is shown.</p>`;
    const partners = lyPartners(n);
    html += `<div class="ly-actions ly-secondary">${lyBtn('ly-explore', 'Explore rhyme words', 'search', { id: n, cls: 'ly-link-btn' })}${partners.length ? lyBtn('ly-rewrite-group', partners.length === 1 ? 'Rewrite both lines' : 'Rewrite the linked lines', 'repeat', { id: [n, ...partners].join(','), cls: 'ly-link-btn' }) : ''}</div>`;
  } else if (item.whole) {
    if (out?.state === 'failed')
      html += `<div class="ly-outcome" data-tone="danger" role="alert">${icon('circle-alert', 16)}<span><strong>Not applied.</strong> ${esc(out.message)}</span></div>`;
    html += `<details class="ly-whole"><summary>Compare with your draft</summary><div class="ly-compare ly-compare-whole"><div class="ly-orig"><span>Your draft</span><pre>${esc(lySungTexts(LY.model).join('\n'))}</pre></div><div class="ly-sugg"><span>Writer’s draft</span><pre>${esc(item.whole.join('\n'))}</pre></div></div></details><div class="ly-actions">${lyBtn('ly-apply', 'Check & apply', 'check', { id: item.id, cls: 'cm-btn cm-btn-primary' })}${lyBtn('ly-keep', 'Keep mine', '', { id: item.id, cls: 'cm-btn' })}</div><p class="ly-note">Applies only if your draft is still the one you asked about, as one change that Undo reverses.</p>`;
  }
  if (item.actions?.length)
    html += `<div class="ly-actions">${item.actions.map(([act, label, ic, id]) => lyBtn(act, label, ic, { id, cls: 'cm-btn cm-btn-outline' })).join('')}</div>`;
  if (out?.state === 'applied')
    html += `<div class="ly-outcome" data-tone="success" role="status">${icon('circle-check', 16)}<span>${esc(out.message)}</span></div>`;
  return html + `<span class="ly-sr">Item ${index + 1} of ${count}</span></article>`;
}
function lyPartners(n) {
  const model = LY.model;
  const out = new Set();
  for (const d of lySetupOf(model, 'rhyme groups'))
    for (const g of lyParseGroups(d.value))
      if (g.some((m) => m.line === n)) g.forEach((m) => m.line !== n && !m.bad && out.add(m.line));
  return [...out].sort((a, b) => a - b);
}
function lyRenderReview(itemsIn) {
  const items = itemsIn || lyItems();
  LY.items = items;
  const box = $ui('ly-review');
  if (!box) return;
  const counts = { issue: 0, input: 0, note: 0 };
  items.forEach((i) => counts[i.tone]++);
  const list = items.filter((i) => i.tone === LY.reviewTab);
  if (LY.reviewAt >= list.length) LY.reviewAt = Math.max(0, list.length - 1);
  const item = list[LY.reviewAt];
  const tabs = Object.entries(LY_TONES)
    .map(
      ([tone, t]) =>
        `<button type="button" class="cm-tab ly-rtab" role="tab" data-ui="ly-rtab" data-id="${tone}" data-tone="${tone}" aria-selected="${LY.reviewTab === tone}">${icon(t.icon, 16)}<span>${t.label}</span><span class="ly-count">${counts[tone]}</span></button>`
    )
    .join('');
  let html = `<div class="ly-rtabs" role="tablist" aria-label="Review">${tabs}</div>`;
  if (item) {
    html += `<div class="ly-pager">${lyBtn('ly-rstep', 'Previous', 'arrow-left', { id: '-1', cls: 'cm-btn cm-btn-icon', hideLabel: true, extra: LY.reviewAt === 0 ? 'disabled' : '' })}<span role="status">${LY.reviewAt + 1} of ${list.length}</span>${lyBtn('ly-rstep', 'Next', 'arrow-right', { id: '1', cls: 'cm-btn cm-btn-icon', hideLabel: true, extra: LY.reviewAt >= list.length - 1 ? 'disabled' : '' })}${lyBtn('ly-tool', 'All feedback', 'chevron-right', { id: 'checks', cls: 'ly-link-btn ly-all' })}</div>`;
    html += lyItemHtml(item, list.length, LY.reviewAt);
    const next = list[LY.reviewAt + 1];
    if (next)
      html += `<button type="button" class="ly-row ly-next" data-ui="ly-rstep" data-id="1" data-tone="${next.tone}">${icon(LY_TONES[next.tone].icon, 18)}<span><strong>Up next: ${esc(next.title)}</strong><small>${esc(next.where)}</small></span>${icon('chevron-right', 16)}</button>`;
  } else {
    const text = !LY.model.sung.length
      ? 'There is no draft to review yet.'
      : LY.reviewTab === 'issue'
        ? 'Nothing to fix from this page’s exact checks or the writer’s last reply. This is not a grade: rhyme, meter and coverage are judged only by a writer run.'
        : LY.reviewTab === 'input'
          ? 'No missing input is known: no open readings, broken links or waiting questions.'
          : 'No notes.';
    html += `<div class="ly-pad">${uiEmptyState({ title: `No ${LY_TONES[LY.reviewTab].label.toLowerCase()}`, text, actions: LY.model.sung.length ? lyBtn('ly-ask-review', 'Ask the writer to review', 'sparkles', { cls: '' }) : '' })}</div>`;
  }
  html += `<button type="button" class="ly-row" data-ui="ly-tool" data-id="checks">${icon('circle-check', 18)}<span><strong>All checks & coverage</strong><small>${esc(`${lyPlural(counts.issue, 'issue')} · ${counts.input} need input · ${lyPlural(counts.note, 'note')}`)}</small></span>${icon('chevron-right', 16)}</button>`;
  const rec = lyRecoveryState();
  if (rec.attention || rec.busy)
    html += `<button type="button" class="ly-row" data-ui="ly-pane" data-id="history" data-tone="${rec.busy ? 'info' : 'warning'}">${icon(rec.busy ? 'loader' : 'triangle-alert', 18)}<span><strong>${rec.busy ? 'Writer running' : 'Earlier run interrupted'}</strong><small>${rec.busy ? 'Its progress stays in the writer conversation.' : 'Accepted work is kept; open History to recover it safely.'}</small></span><span class="ly-row-link">Open history</span>${icon('arrow-right', 16)}</button>`;
  box.innerHTML = html;
  lyRenderDocFocus(item);
}
// Outline marks follow the active item without re-rendering the document.
function lyRenderDocFocus(item) {
  const focus = new Set(item?.lines || []);
  document
    .querySelectorAll('#ly-doc .ly-line')
    .forEach((li) => li.classList.toggle('is-focus', focus.has(Number(li.dataset.n))));
}

// ── History & recovery ────────────────────────────────────────────────────
// Everything here is the AI writer's real state (src/app.js chatState): the
// saved request, the run record, the saved runs. Recovery runs the writer's
// own recovery path (#chat-recover); nothing here repeats uncertain work.
function lyRenderHistory() {
  const box = $ui('ly-history');
  if (!box) return;
  const rec = lyRecoveryState();
  const run = LY.run;
  const lyric = rec.lyric;
  const cards = [];
  const card = (tone, ic, title, text, actions = '') =>
    cards.push(
      `<div class="ly-hcard" data-tone="${tone}"><div class="ly-hcard-head">${icon(ic, 18)}<strong>${esc(title)}</strong></div>${text ? `<p>${esc(text)}</p>` : ''}${actions ? `<div class="ly-actions">${actions}</div>` : ''}</div>`
    );
  if (rec.busy)
    card(
      'info',
      'loader',
      'Running',
      'A lyric request is in progress. Its progress stays in the writer conversation; this page updates when it replies.',
      lyBtn('ly-pane', 'Open the writer', 'message-circle', {
        id: 'writer',
        cls: 'cm-btn cm-btn-outline',
      })
    );
  else if (rec.pending)
    card(
      'warning',
      'triangle-alert',
      'Interrupted',
      'A saved lyric request did not finish in this tab. Recovering reads its saved outcome from the service; it does not send the request again.',
      lyBtn('ly-recover', 'Recover the saved request', 'refresh-cw', {
        cls: 'cm-btn cm-btn-primary',
      })
    );
  if (rec.retryAt > Date.now())
    card(
      'warning',
      'triangle-alert',
      'Waiting',
      `The service asked to wait until ${new Date(rec.retryAt).toLocaleTimeString()} before continuing.`
    );
  if (lyric?.uncertain_proposal)
    card(
      'danger',
      'circle-alert',
      'Uncertain proposal — not resumable',
      'The interrupted proposal may already have been charged. Its receipt is kept; it will not be repeated automatically. Keep its accepted draft and start explicit new work if needed.'
    );
  if (lyric?.new_run_required)
    card(
      'danger',
      'circle-alert',
      'This run cannot continue',
      'It reached its journal capacity. Its accepted draft is kept; continuing needs a new run.'
    );
  if (lyric?.parked)
    card(
      'warning',
      'triangle-alert',
      `Parked with ${lyPlural((lyric.open || []).length, 'open line')}`,
      'The run stopped with lines unresolved. The next step is a rewritten draft for those lines.',
      lyBtn('ly-pane', 'Continue in the writer', 'message-circle', {
        id: 'writer',
        cls: 'cm-btn cm-btn-outline',
      })
    );
  if (lyric?.state && lyric.resumable !== false && !rec.busy)
    card(
      'info',
      'circle-question-mark',
      'Waiting for your answer',
      'The run asked a question. It stays paused until it gets an answer.',
      lyBtn('ly-pane', 'Answer in the writer', 'message-circle', {
        id: 'writer',
        cls: 'cm-btn cm-btn-outline',
      })
    );
  if (run) {
    const status = lyRunStatus(run);
    const accepted = run.final;
    card(
      status.tone || 'info',
      status.tone === 'success' ? 'circle-check' : 'file-text',
      `Last writer reply: ${status.word}`,
      `${new Date(run.at).toLocaleTimeString()} · ${accepted ? `accepted draft of ${lyPlural(accepted.length, 'line')}` : 'no draft in this reply'}${run.base ? '' : ' · asked about an unknown draft'}.`,
      accepted && !lySame(accepted, lySungTexts(LY.model))
        ? lyBtn('ly-review-run', 'Review its changes', 'circle-alert', {
            cls: 'cm-btn cm-btn-outline',
          })
        : ''
    );
  }
  if (!cards.length)
    card(
      '',
      'info',
      'No writer run in this tab',
      'Replies from the writer, interrupted requests and saved runs appear here.',
      lyBtn('new-lyrics', 'New song with the writer', 'sparkles', { cls: 'cm-btn cm-btn-outline' })
    );
  const archives = rec.archives.filter((a) => a && (a.domain === 'lyrics' || !a.domain));
  let html = `<div class="ly-pad"><h3 class="ly-h3">Writer status</h3>${cards.join('')}`;
  html += `<h3 class="ly-h3">Saved runs</h3>`;
  if (archives.length)
    html += `<ul class="ly-archives">${archives
      .slice()
      .reverse()
      .map(
        (a) =>
          `<li>${icon('bookmark', 16)}<span><strong>${esc((a.message || 'Saved conversation').slice(0, 80))}</strong><small>${a.created_at ? esc(new Date(a.created_at).toLocaleString()) : 'Saved conversation'}</small></span></li>`
      )
      .join(
        ''
      )}</ul><div class="ly-actions">${lyBtn('ly-recover', 'Recover the most recent', 'refresh-cw', { cls: 'cm-btn cm-btn-outline', extra: rec.busy || rec.pending ? 'disabled' : '' })}</div><p class="ly-note">Recovery reads the saved outcome; accepted text comes back to review, never as a finished song.</p>`;
  else
    html += `<p class="ly-note">No saved lyric runs in this browser. Starting new work saves the previous conversation here.</p>`;
  html += `<h3 class="ly-h3">Draft history</h3><p class="ly-note">Undo and Redo in the header step through draft changes, including every change applied from this page.</p>`;
  if (LY.model.stamps.length)
    html += `<h3 class="ly-h3">Stamps in the draft</h3><ul class="ly-archives">${LY.model.stamps.map((st) => `<li>${icon('bookmark', 16)}<span><strong>${esc(st.kind)}${st.exit != null ? ` · exit ${st.exit}` : ''}</strong><small>${esc(st.raw)}</small></span></li>`).join('')}</ul><p class="ly-note">A stamp describes the run that wrote it. It is not re-checked here.</p>`;
  box.innerHTML = html + '</div>';
}

// ── Writing tools ─────────────────────────────────────────────────────────
const lyLineOptions = (model, selected, { distinct = false } = {}) => {
  const seen = new Set();
  return model.sung
    .filter((r) => (distinct ? !seen.has(r.text) && seen.add(r.text) : true))
    .map(
      (r) =>
        `<option value="${r.n}"${r.n === selected ? ' selected' : ''}>${r.n} · ${esc(r.text.slice(0, 60))}</option>`
    )
    .join('');
};
function lyToolStructure(model) {
  const headerless = model.sections.length && model.sections.every((s) => !s.header);
  const form = model.sections.map((s) => s.title).join(' – ');
  const rows = model.sections
    .map(
      (s) =>
        `<tr><td><input class="cm-input ly-in" data-field="name" data-sec="${s.index}" value="${esc(s.header ? s.header.name : s.title)}" aria-label="${esc(s.title)} name"${s.header ? '' : ' placeholder="Add a header"'}></td><td><input class="cm-input ly-in ly-num-in" type="number" min="0" max="999" data-field="lines" data-sec="${s.index}" value="${s.header?.lines ?? ''}" placeholder="—" aria-label="${esc(s.title)} declared lines"></td><td>${s.sung.length}${s.returnOf ? ` <small>same as ${esc(s.returnOf.title)}</small>` : ''}</td><td class="ly-row-actions">${lyBtn('ly-sec-move', 'Move up', 'arrow-up', { id: `${s.index}:-1`, cls: 'cm-btn cm-btn-icon', hideLabel: true, extra: s.index === 0 ? 'disabled' : '' })}${lyBtn('ly-sec-move', 'Move down', 'arrow-down', { id: `${s.index}:1`, cls: 'cm-btn cm-btn-icon', hideLabel: true, extra: s.index === model.sections.length - 1 ? 'disabled' : '' })}${lyBtn('ly-sec-dup', 'Duplicate', 'copy', { id: s.index, cls: 'cm-btn cm-btn-icon', hideLabel: true })}${lyBtn('ly-sec-remove', 'Remove', 'trash-2', { id: s.index, cls: 'cm-btn cm-btn-icon', hideLabel: true })}</td></tr>`
    )
    .join('');
  return `<p><strong>Form:</strong> ${esc(form || 'no sections yet')}</p>${headerless ? `<p class="ly-note">These stanzas have no headers. ${lyBtn('ly-label-stanzas', 'Add a header to each stanza', 'plus', { cls: 'ly-link-btn' })}</p>` : ''}${
    model.sections.length
      ? `<div class="ly-table-wrap"><table class="ly-table"><thead><tr><th>Section</th><th>Declared lines</th><th>Lines</th><th><span class="ly-sr">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : ''
  }<p class="ly-note">Names and declared sizes are written into each section header, where the writer reads them.</p>${lyStoryHtml(model)}`;
}
function lyStoryHtml(model) {
  const sung = model.sections.filter((s) => s.sung.length);
  const d = lySetupOf(model, 'narrative')[0];
  const plan = d ? lyParseNarrative(d.value) : null;
  const opt = (list, value, blank) =>
    `<option value="">${blank}</option>` +
    list.map((x) => `<option${x === value ? ' selected' : ''}>${x}</option>`).join('');
  const rows = sung
    .map((s, k) => {
      const step = plan && !plan.off ? plan.steps[k] : null;
      return `<tr data-story="${k}"><th scope="row">${esc(s.title)}</th><td>${k ? `<select class="cm-select" data-story-field="junction" aria-label="${esc(s.title)} enters by">${opt(LY_JUNCTIONS, step?.junction, '—')}</select>` : '<span class="ly-note">first</span>'}</td><td><select class="cm-select" data-story-field="atom" aria-label="${esc(s.title)} story job">${opt(LY_ATOMS, step?.atom, 'Not declared')}</select></td></tr>`;
    })
    .join('');
  return `<h4 class="ly-h4">Story plan</h4><p class="ly-note">${plan?.off ? 'Declared off: no story layer.' : d ? `Declared: ${esc(d.value)}` : 'Not declared: a new plan from the writer draws one job per sung section.'} A record for the writer, not a gate — nothing grades a draft against its story plan, and the page does not judge the plot.</p>${
    sung.length
      ? `<div class="ly-table-wrap"><table class="ly-table"><thead><tr><th>Section</th><th>Enters by</th><th>Job</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : ''
  }<div class="ly-actions">${lyBtn('ly-story-save', 'Save story plan', 'check', { cls: 'cm-btn cm-btn-tonal', extra: sung.length ? '' : 'disabled' })}${lyBtn('ly-story-off', 'Turn the story layer off', '', { cls: 'cm-btn cm-btn-outline' })}${d ? lyBtn('ly-story-clear', 'Clear', '', { cls: 'cm-btn' }) : ''}</div><p class="ly-note" id="ly-story-error" role="alert"></p>`;
}
function lyToolRhymes(model) {
  const rel = lySetupOf(model, 'relation')[0]?.value || '';
  const known = ['class:RHYME', 'class:ASSONANCE', 'class:CONSONANCE'];
  const relSel = `<select class="cm-select" id="ly-relation" aria-label="Rhyme relation"><option value="">Not declared — any relation may satisfy a link</option>${known.map((k) => `<option${rel === k ? ' selected' : ''}>${k}</option>`).join('')}<option value="other"${rel && !known.includes(rel) ? ' selected' : ''}>Other (namespaced)…</option></select><input class="cm-input" id="ly-relation-other" placeholder="e.g. type:rime riche or schema:perfect rhyme" value="${esc(rel && !known.includes(rel) ? rel : '')}" aria-label="Other relation"${rel && !known.includes(rel) ? '' : ' hidden'}>`;
  const groups = lySetupOf(model, 'rhyme groups').flatMap((d) =>
    lyParseGroups(d.value).map((g) => ({ g, d }))
  );
  const linkList = groups.length
    ? `<ul class="ly-links">${groups
        .map(
          ({ g }, k) =>
            `<li><span class="ly-chips">${g.map((m) => `<span class="cm-chip ly-member">L${m.line} · ${esc(lyMemberLabel(m))}${lyMemberWord(model, m) ? ` · “${esc(String(lyMemberWord(model, m)).slice(0, 40))}”` : ' · missing'}</span>`).join(`<span aria-hidden="true">~</span>`)}</span>${lyBtn('ly-link-remove', 'Remove link', 'trash-2', { id: k, cls: 'cm-btn cm-btn-icon', hideLabel: true })}</li>`
        )
        .join('')}</ul>`
    : `<p class="ly-note">No rhyme links declared.</p>`;
  const pick = LY.picks;
  const line = model.sung[pick.linkLine - 1] ? pick.linkLine : model.sung[0]?.n || 0;
  const toks = line ? lyTokens(model.sung[line - 1].text, model.voices) : [];
  const places =
    Object.entries(LY_PLACES)
      .map(([v, l]) => `<option value="${v}">${esc(l)}</option>`)
      .join('') +
    toks.map((t, i) => `<option value="T${i + 1}">word ${i + 1} · ${esc(t)}</option>`).join('');
  const pending = pick.linkMembers.length
    ? `<span class="ly-chips">${pick.linkMembers.map((m) => `<span class="cm-chip ly-member">L${m.line} · ${esc(lyMemberLabel(m))} · “${esc(String(lyMemberWord(model, m) || '').slice(0, 40))}”</span>`).join('<span aria-hidden="true">~</span>')}</span>`
    : '<span class="ly-note">No members yet.</span>';
  const title = lySetupOf(model, 'title')[0]?.value || '';
  const hook = lySetupOf(model, 'hook')[0]?.line || '';
  const hookN = model.sung.find((r) => r.text === hook)?.n || 0;
  const words = (key) =>
    lySetupOf(model, key)
      .map(
        (d) =>
          `<span class="cm-chip">${esc(d.value)}${lyBtn('ly-word-remove', `Remove ${d.value}`, 'x', { id: d.i, cls: 'ly-chip-x', hideLabel: true })}</span>`
      )
      .join('') || '<span class="ly-note">None.</span>';
  return `<div class="ly-tool-grid">
<section><h4 class="ly-h4">Rhyme relation</h4><div class="ly-form">${relSel}${lyBtn('ly-relation-save', 'Save relation', 'check', { cls: 'cm-btn cm-btn-outline' })}</div><p class="ly-note">Undeclared, the writer’s run judges every link against every relation and a link stands when any one holds. Declaring one narrows it to that relation.</p></section>
<section><h4 class="ly-h4">Rhyme links</h4>${linkList}<div class="ly-form"><select class="cm-select" id="ly-link-line" aria-label="Line">${lyLineOptions(model, line)}</select><select class="cm-select" id="ly-link-place" aria-label="Place in the line">${places}</select>${lyBtn('ly-link-add', 'Add member', 'plus', { cls: 'cm-btn cm-btn-outline', extra: line ? '' : 'disabled' })}</div><div class="ly-pending">${pending}</div><div class="ly-actions">${lyBtn('ly-link-save', 'Save link', 'link', { cls: 'cm-btn cm-btn-tonal', extra: pick.linkMembers.length > 1 ? '' : 'disabled' })}${lyBtn('ly-link-clear', 'Clear', '', { cls: 'cm-btn', extra: pick.linkMembers.length ? '' : 'disabled' })}</div><p class="ly-note">A link binds two or more places — any word, not only line ends. Links may overlap: a line can belong to several, at different places. Saved in the harness’s own spelling (line numbers), so an edit that moves lines is shown here.</p></section>
<section><h4 class="ly-h4">Word rules</h4><div class="ly-form"><label class="ly-label" for="ly-title-in">Title</label><input class="cm-input" id="ly-title-in" value="${esc(title)}" placeholder="Not declared">${lyBtn('ly-title-save', 'Save title', 'check', { cls: 'cm-btn cm-btn-outline' })}</div><div class="ly-form"><label class="ly-label" for="ly-hook-in">Hook line</label><select class="cm-select" id="ly-hook-in"><option value="">Not declared</option>${lyLineOptions(model, hookN, { distinct: true })}</select>${lyBtn('ly-hook-save', 'Save hook', 'check', { cls: 'cm-btn cm-btn-outline' })}</div>
<div class="ly-form"><label class="ly-label" for="ly-require-in">Must include</label><input class="cm-input" id="ly-require-in" placeholder="a word or phrase">${lyBtn('ly-word-add', 'Add', 'plus', { id: 'require', cls: 'cm-btn cm-btn-outline' })}</div><div class="ly-chips">${words('require')}</div>
<div class="ly-form"><label class="ly-label" for="ly-avoid-in">Avoid</label><input class="cm-input" id="ly-avoid-in" placeholder="a word or phrase">${lyBtn('ly-word-add', 'Add', 'plus', { id: 'avoid', cls: 'cm-btn cm-btn-outline' })}</div><div class="ly-chips">${words('avoid')}</div><p class="ly-note">Must include and Avoid are checked on this page by exact word match. The hook binds an exact line, so its repeats share it.</p></section>
<section><h4 class="ly-h4">Explore rhyme words</h4><div class="ly-form"><input class="cm-input" id="ly-explore-in" placeholder="a word to rhyme with" value="${esc(pick.explore || '')}"><input class="cm-input" id="ly-explore-with" placeholder="optional: must also (e.g. two syllables)" value=""></div><div class="ly-actions">${lyBtn('ly-explore-ask', 'Ask the writer', 'sparkles', { cls: 'cm-btn cm-btn-tonal' })}</div><p class="ly-note">The writer screens candidates against every requirement at once; its answer arrives in the Writer panel. A partial match is listed as partial — it does not satisfy every requirement.</p></section>
</div>`;
}
function lyToolRhythm(model) {
  const pickups = [
    '',
    'quarter-beat pickup',
    'half-beat pickup',
    'one-beat pickup',
    'two-beat pickup',
  ];
  const rows = model.sections
    .map((s) => {
      const h = s.header || {};
      const custom = h.pickup && !pickups.includes(h.pickup);
      return `<tr data-sec="${s.index}"${LY.picks.rhythmSec === s.index ? ' class="is-picked"' : ''}><th scope="row">${esc(s.title)}</th><td><input class="cm-input ly-in" data-rhythm="meter" value="${esc(h.meter || '')}" placeholder="Not declared" pattern="\\d+/\\d+" aria-label="${esc(s.title)} meter, e.g. 4/4"></td><td><input class="cm-input ly-in ly-num-in" type="number" min="1" max="999" data-rhythm="bars" value="${h.bars ?? ''}" placeholder="—" aria-label="${esc(s.title)} bars"></td><td><select class="cm-select" data-rhythm="pickup" aria-label="${esc(s.title)} pickup">${pickups.map((p) => `<option value="${esc(p)}"${(h.pickup || '') === p ? ' selected' : ''}>${esc(p || 'No pickup declared')}</option>`).join('')}${custom ? `<option selected value="${esc(h.pickup)}">${esc(h.pickup)}</option>` : ''}</select></td><td>${lyBtn('ly-rhythm-save', 'Save', 'check', { id: s.index, cls: 'cm-btn cm-btn-outline' })}</td></tr>`;
    })
    .join('');
  return `${model.sections.length ? `<div class="ly-table-wrap"><table class="ly-table"><thead><tr><th>Section</th><th>Meter</th><th>Bars</th><th>Pickup</th><th><span class="ly-sr">Save</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="ly-note">Add a section first; rhythm is declared per section header.</p>'}<p class="ly-note">Declared values only. No tempo is assumed and no performed rhythm is inferred from the words; leave a field empty to keep it undeclared. The declaration is written into the section header the way the harness writes it (e.g. [CHORUS — 5 lines — 5 bars of 7/8, one-beat pickup]).</p>${lyMelodyHtml(model)}`;
}
function lyMelodyHtml(model) {
  const d = lySetupOf(model, 'melody')[0];
  const parsed = d ? lyParseMelody(d.value) : null;
  const m = parsed?.melody;
  const draft =
    LY.picks.melody ||
    (m
      ? {
          meter: `${m.meter.beats}/${m.meter.unit}`,
          groups: m.meter.groups.join('+'),
          bars: String(m.bars),
          subdivision: String(m.subdivision),
          events: m.notes
            .map((n) => `${n.pitch_hz === null ? 'rest' : n.pitch_hz}:${n.ticks}`)
            .join(' '),
        }
      : { meter: '', groups: '', bars: '', subdivision: '2', events: '' });
  const status = !d
    ? lyStatus('', 'Not declared')
    : m
      ? lyStatus('success', 'Declared')
      : lyStatus('warning', 'Cannot be used');
  return `<details class="cm-accordion ly-melody"${d || LY.picks.melodyOpen ? ' open' : ''}><summary>Declared melody (optional, advanced) ${status}</summary>
<p class="ly-note">One repeating monophonic phrase, sung once per line. The writer plans meter, phrase length and subdivision from it. It is an instruction, not a recording: pitch, underlay and performance are not certified by any grade.</p>
<div class="ly-form"><label class="ly-label" for="ly-mel-meter">Meter, beat groups, bars per line and ticks per beat</label><input class="cm-input ly-num-in" id="ly-mel-meter" placeholder="4/4" value="${esc(draft.meter)}" aria-label="Meter"><input class="cm-input ly-num-in" id="ly-mel-groups" placeholder="2+2" value="${esc(draft.groups)}" aria-label="Beat groups (2s and 3s)"><input class="cm-input ly-num-in" id="ly-mel-bars" type="number" min="1" placeholder="bars" value="${esc(draft.bars)}" aria-label="Bars per line"><select class="cm-select" id="ly-mel-sub" aria-label="Ticks per beat">${['1', '2', '4'].map((v) => `<option${draft.subdivision === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
<div class="ly-form"><label class="ly-label" for="ly-mel-events">Events in order: hertz:ticks, or rest:ticks</label><input class="cm-input" id="ly-mel-events" placeholder="440:4 rest:2 493.9:2 440:8" value="${esc(draft.events)}"></div>
<p class="ly-note" id="ly-mel-status" role="status">${esc(parsed?.error || (m ? `${m.notes.reduce((t, n) => t + n.ticks, 0)} ticks · ${lyPlural(m.notes.filter((n) => n.pitch_hz !== null).length, 'note')}, ${lyPlural(m.notes.filter((n) => n.pitch_hz === null).length, 'rest')}` : ''))}</p>
<div class="ly-actions">${lyBtn('ly-melody-save', 'Save melody', 'check', { cls: 'cm-btn cm-btn-tonal' })}${d ? lyBtn('ly-melody-clear', 'Remove melody', 'trash-2', { cls: 'cm-btn' }) : ''}</div></details>`;
}
function lyToolPronunciation(model) {
  const readings = lySetupOf(model, 'reading');
  const list = readings.length
    ? `<ul class="ly-readings">${readings
        .map((r) => {
          const lines = r.malformed
            ? []
            : model.sung.filter((x) => x.text === r.line).map((x) => x.n);
          const ok = lines.length && lyTokens(r.line, model.voices)[r.token - 1] === r.word;
          const what = r.malformed
            ? 'Cannot be read'
            : r.state === 'declared'
              ? `${r.phones.join(' ')} · ${r.basis} · source: ${r.source}`
              : r.state === 'uncertain'
                ? 'Marked uncertain'
                : 'Needs a choice';
          return `<li><span><strong>“${esc(r.word || '?')}”</strong> <small>word ${r.token || '?'} of ${ok ? esc(lyLineRef(lines)) : 'no matching line'}</small><small>${esc(what)}</small></span>${ok ? lyStatus(r.state === 'declared' ? 'success' : 'warning', r.state === 'declared' ? 'Bound' : 'Open') : lyStatus('danger', 'Stale')}${lyBtn('ly-remove-setup', 'Remove reading', 'trash-2', { id: r.i, cls: 'cm-btn cm-btn-icon', hideLabel: true })}</li>`;
        })
        .join('')}</ul>`
    : `<p class="ly-note">No readings declared.</p>`;
  const pick = LY.picks;
  const line = model.sung[pick.readingLine - 1] ? pick.readingLine : model.sung[0]?.n || 0;
  const row = model.sung[line - 1];
  const toks = row ? lyTokens(row.text, model.voices) : [];
  const chips = toks
    .map(
      (t, i) =>
        `<button type="button" class="cm-chip" data-ui="ly-reading-token" data-id="${i + 1}" aria-pressed="${pick.readingToken === i + 1}">${i + 1} · ${esc(t)}</button>`
    )
    .join('');
  const kind = pick.readingKind || 'choice';
  const radio = (v, label) =>
    `<label class="ly-radio"><input type="radio" name="ly-reading-kind" value="${v}"${kind === v ? ' checked' : ''}> ${esc(label)}</label>`;
  return `<div class="ly-tool-grid"><section><h4 class="ly-h4">Readings</h4>${list}<p class="ly-note">A reading binds an exact line and one sung word position. Identical lines — a returning chorus — share it. A changed line never inherits it: it shows as stale until you choose again.</p>${readings.some((r) => r.state === 'choice') ? lyBtn('ly-reading-ask', 'Ask the writer for dictionary options', 'sparkles', { cls: 'cm-btn cm-btn-tonal' }) : ''}</section>
<section><h4 class="ly-h4">Add a reading</h4>${
    row
      ? `<div class="ly-form"><select class="cm-select" id="ly-reading-line" aria-label="Line">${lyLineOptions(model, line, { distinct: true })}</select></div><div class="ly-chips" role="group" aria-label="Sung word">${chips || '<span class="ly-note">No sung words on this line.</span>'}</div>
<fieldset class="ly-fieldset"><legend>Reading</legend>${radio('choice', 'Needs a choice — the writer lists the dictionary options')}${radio('declared', 'Supply a reading')}${radio('uncertain', 'Mark as uncertain')}</fieldset>
<div class="ly-form"${kind === 'declared' ? '' : ' hidden'} id="ly-reading-supply"><input class="cm-input" id="ly-phones" placeholder="ARPABET, e.g. R EH1 K ER0 D" aria-label="ARPABET phones" autocapitalize="characters"><select class="cm-select" id="ly-basis" aria-label="Basis"><option value="dictionary">dictionary (CMUdict reading)</option><option value="declared">declared (supplied, with a source)</option></select><input class="cm-input" id="ly-source" placeholder="Who chose it and why, or its source" aria-label="Source"></div>
<div class="ly-actions">${lyBtn('ly-reading-save', 'Save reading', 'check', { cls: 'cm-btn cm-btn-tonal', extra: pick.readingToken ? '' : 'disabled' })}</div><p class="ly-note" id="ly-reading-error" role="alert"></p>`
      : '<p class="ly-note">Write some lines first.</p>'
  }<p class="ly-note">Language: the harness reads Latin-script words; letters outside that repertoire are not read as words. Parentheses are ${model.voices ? 'declared sung' : 'unsung asides'} (see Returns & voices).</p></section></div>`;
}
function lyPlacedHtml(model) {
  const pick = LY.picks;
  const line = model.sung[pick.placedLine - 1] ? pick.placedLine : model.sung[0]?.n || 0;
  const toks = line ? lyTokens(model.sung[line - 1].text, model.voices) : [];
  const places =
    [
      ['head', 'first word'],
      ['line', 'whole line'],
      ['endword', 'last word'],
    ]
      .map(([v, l]) => `<option value="${v}">${l}</option>`)
      .join('') +
    toks.map((t, i) => `<option value="T${i + 1}">word ${i + 1} · ${esc(t)}</option>`).join('');
  const members = pick.placedMembers || [];
  return `<h4 class="ly-h4">Placed returns</h4><p class="ly-note">The same words at a place in different lines — a head that returns while the tail changes. Declared in the harness’s spelling (e.g. 1.head,3.head); the writer’s run judges them by placement.</p><div class="ly-form"><select class="cm-select" id="ly-placed-line" aria-label="Line">${lyLineOptions(model, line)}</select><select class="cm-select" id="ly-placed-place" aria-label="Place">${places}</select>${lyBtn('ly-placed-add', 'Add member', 'plus', { cls: 'cm-btn cm-btn-outline', extra: line ? '' : 'disabled' })}</div><div class="ly-pending">${members.length ? `<span class="ly-chips">${members.map((m) => `<span class="cm-chip ly-member">L${m.line} · ${esc(lyMemberLabel(m))} · “${esc(String(lyMemberWord(model, m) || '').slice(0, 40))}”</span>`).join('<span aria-hidden="true">=</span>')}</span>` : '<span class="ly-note">No members yet.</span>'}</div><div class="ly-actions">${lyBtn('ly-placed-save', 'Save placed return', 'repeat', { cls: 'cm-btn cm-btn-tonal', extra: members.length > 1 ? '' : 'disabled' })}${lyBtn('ly-placed-clear', 'Clear', '', { cls: 'cm-btn', extra: members.length ? '' : 'disabled' })}</div>`;
}
function lyToolReturns(model) {
  const sectionReturns = model.sections.filter((s) => s.uses > 1);
  const repeats = model.repeats;
  const declared = lySetupOf(model, 'returns')[0]?.value || '';
  const parens = model.sung.filter((r) => /\(/.test(r.text));
  return `<div class="ly-tool-grid"><section><h4 class="ly-h4">Exact returns</h4>${
    sectionReturns.length
      ? `<ul class="ly-plain">${sectionReturns
          .map(
            (s) =>
              `<li>${lyBtn('ly-goto', s.title, 'repeat', { id: s.index, cls: 'ly-link-btn' })} — used ${s.uses} times (${esc(
                model.sections
                  .filter((o) => o === s || o.returnOf === s)
                  .map((o) => `section ${o.index + 1}`)
                  .join(', ')
              )})</li>`
          )
          .join('')}</ul>`
      : '<p class="ly-note">No section returns word for word.</p>'
  }<h4 class="ly-h4">Repeated lines</h4>${
    repeats.length
      ? `<ul class="ly-plain">${repeats.map((r) => `<li>“${esc(r.text.slice(0, 80))}” — ${esc(lyLineRef(r.lines))}</li>`).join('')}</ul>`
      : '<p class="ly-note">No line repeats word for word.</p>'
  }<p class="ly-note">Counted by exact text on this page. Intentional repeats are kept as they are.</p><p><strong>Declared returns:</strong> ${esc(declared || 'none')}</p><div class="ly-actions">${lyBtn('ly-returns-declare', 'Declare these exact returns', 'repeat', { cls: 'cm-btn cm-btn-outline', extra: repeats.length ? '' : 'disabled' })}${declared ? lyBtn('ly-returns-clear', 'Clear', '', { cls: 'cm-btn' }) : ''}</div>${lyPlacedHtml(model)}</section>
<section><h4 class="ly-h4">Voices</h4><fieldset class="ly-fieldset"><legend>Parenthesised text</legend><label class="ly-radio"><input type="radio" name="ly-voices" value="unsung"${model.voices ? '' : ' checked'}> Unsung asides (default)</label><label class="ly-radio"><input type="radio" name="ly-voices" value="sung"${model.voices ? ' checked' : ''}> Sung — a second voice or call-and-response</label></fieldset>${
    parens.length
      ? `<ul class="ly-plain">${parens.map((r) => `<li>Line ${r.n}: ${esc(r.text.slice(0, 80))} <small>(${model.voices ? 'second voice, sung' : 'aside, unsung'})</small></li>`).join('')}</ul>`
      : '<p class="ly-note">No line has parentheses.</p>'
  }<p class="ly-note">Unsung asides carry no end word, so a line that is only an aside has no rhyme to judge.</p></section></div>`;
}
function lyToolChecks(model, items) {
  const group = (tone) => items.filter((i) => i.tone === tone);
  const listOf = (arr) =>
    arr.length
      ? `<ul class="ly-plain">${arr.map((i) => `<li>${esc(i.title)} <small>${esc(i.where)}${i.stale ? ' · stale' : ''}</small></li>`).join('')}</ul>`
      : '<p class="ly-note">None.</p>';
  const run = LY.run;
  let runHtml = '<p class="ly-note">No writer reply in this tab yet.</p>';
  if (run) {
    const status = lyRunStatus(run);
    const cov = run.coverage;
    const tools = (run.tools || []).filter((t) => /^lyric_/.test(t.name));
    runHtml = `<p>${lyStatus(status.tone, status.word)} ${run.final && !lySame(run.final, lySungTexts(model)) ? lyStatus('warning', 'Your draft has changed since') : ''}</p>`;
    if (tools.length)
      runHtml += `<ul class="ly-plain">${tools.map((t) => `<li><code>${esc(t.name)}</code>${typeof t.exit_code === 'number' ? ` · exit ${t.exit_code}` : ''}${t.status ? ` · ${esc(t.status)}` : ''}${t.error ? ' · error' : ''}</li>`).join('')}</ul>`;
    if (cov && Array.isArray(cov.obligations)) {
      const by = (st) => cov.obligations.filter((o) => o.status === st);
      const ob = (arr) =>
        arr.length
          ? `<ul class="ly-plain ly-small">${arr
              .slice(0, 60)
              .map(
                (o) =>
                  `<li><code>${esc(o.id)}</code>${o.detail ? ` — ${esc(String(o.detail).slice(0, 160))}` : ''}</li>`
              )
              .join('')}${arr.length > 60 ? `<li>…and ${arr.length - 60} more</li>` : ''}</ul>`
          : '<p class="ly-note">None.</p>';
      runHtml += `<p class="ly-note">Rhyme pairs: ${cov.pairs_mandated ?? '?'} requested · ${cov.pairs_judged ?? '?'} judged · ${cov.pairs_refused ?? '?'} not judged. Coverage ${cov.certified === true ? 'complete for what was requested' : 'incomplete'}.</p><details class="cm-accordion" open><summary>Answered (${by('answered').length})</summary>${ob(by('answered'))}</details><details class="cm-accordion"${by('refused').length ? ' open' : ''}><summary>Not judged — needs input (${by('refused').length})</summary>${ob(by('refused'))}</details><details class="cm-accordion"><summary>Not requested (${by('not_requested').length})</summary>${ob(by('not_requested'))}</details>`;
    } else runHtml += '<p class="ly-note">This reply carried no coverage record.</p>';
  }
  return `<div class="ly-tool-grid"><section><h4 class="ly-h4">From this page</h4><p class="ly-note">Exact text facts only: declared sizes, returns, readings, links and word rules.</p><h5>Issues</h5>${listOf(group('issue').filter((i) => i.source === 'page'))}<h5>Needs input</h5>${listOf(group('input').filter((i) => i.source === 'page'))}<h5>Notes</h5>${listOf(group('note').filter((i) => i.source === 'page'))}</section><section><h4 class="ly-h4">From the writer’s last reply</h4>${runHtml}<p class="ly-note">There is no overall score. Requested, answered, not judged and not requested are reported separately; a run that stopped or was interrupted is never shown as finished.</p>${model.sung.length ? lyBtn('ly-ask-review', 'Ask the writer to review this draft', 'sparkles', { cls: 'cm-btn cm-btn-tonal' }) : ''}</section></div>`;
}
function lyToolExport() {
  return `<div class="ly-actions">${lyBtn('copy-lyrics', 'Copy with headers', 'copy', { cls: 'cm-btn cm-btn-outline' })}${lyBtn('ly-copy-sung', 'Copy sung lines only', 'clipboard', { cls: 'cm-btn cm-btn-outline' })}${lyBtn('ly-download', 'Download as text', 'download', { cls: 'cm-btn cm-btn-outline' })}</div><p class="ly-note">“With headers” is the exact draft: section headers (with their declared sizes and rhythm), setup lines and run stamps. “Sung lines only” drops every whole-line bracket, the way the harness reads a draft. The whole session (recipe and lyrics) is exported from More → Export.</p>`;
}
function lyRenderTools(items) {
  const open = LY.toolsOpen;
  $ui('ly-tools-drawer').hidden = !open;
  document
    .querySelectorAll('[data-ui="ly-tools-toggle"]')
    .forEach((b) => b.setAttribute('aria-expanded', String(open)));
  document.querySelectorAll('#ly-tools [data-ui="ly-tool"]').forEach((b) => {
    if (b.getAttribute('role') === 'tab')
      b.setAttribute('aria-selected', String(b.dataset.id === LY.tool));
    else b.setAttribute('aria-pressed', String(open && b.dataset.id === LY.tool));
  });
  if (!open) return;
  // Bring the selected tab into view inside its own scrolling row.
  const tab = document.querySelector(`.ly-tool-tabs [data-id="${LY.tool}"]`);
  const row = tab?.parentElement;
  if (tab && row) {
    const r = tab.getBoundingClientRect(),
      p = row.getBoundingClientRect();
    if (r.left < p.left || r.right > p.right) row.scrollLeft += r.left - p.left - 12;
  }
  const model = LY.model;
  const body = $ui('ly-tool-body');
  const html = {
    structure: () => lyToolStructure(model),
    rhymes: () => lyToolRhymes(model),
    rhythm: () => lyToolRhythm(model),
    pronunciation: () => lyToolPronunciation(model),
    returns: () => lyToolReturns(model),
    checks: () => lyToolChecks(model, items),
    export: () => lyToolExport(),
  }[LY.tool]();
  // Keep what someone is typing: a text field the user is in is not replaced.
  const active = document.activeElement;
  if (
    active &&
    body.contains(active) &&
    active.matches('input[type="text"], input:not([type]), input[type="search"]')
  )
    return;
  body.innerHTML = html;
}

// ── Refresh ───────────────────────────────────────────────────────────────
let lyTimer = 0;
function lyRefresh(now = false) {
  if (!now) {
    clearTimeout(lyTimer);
    lyTimer = setTimeout(() => lyRefresh(true), 120);
    return;
  }
  clearTimeout(lyTimer);
  const draft = lyDraft();
  if (!draft) return;
  if (draft.value !== LY.text) {
    const prev = LY.model;
    const next = lyParse(draft.value);
    // The shell puts a writer's lyrics in place whole (automatically, or by
    // "Use these lyrics"); that text has no [SETUP] lines. Put the person's
    // declarations back, visibly, once per reply, so Undo can step past it.
    if (
      prev?.setup.length &&
      !next.setup.length &&
      next.sung.length &&
      LY.run?.final &&
      !LY.run.setupKept &&
      lySame(lySungTexts(next), LY.run.final)
    ) {
      LY.run.setupKept = true;
      LY.text = draft.value;
      LY.model = next;
      lyCommit(
        lyKeepSetup(prev, draft.value),
        'The writer’s lyrics are in; your setup lines were kept.'
      );
      return;
    }
    LY.text = draft.value;
    LY.model = next;
    // A text change can invalidate an earlier check result; failures are
    // re-derived on the next attempt, never kept as a verdict on new text.
    for (const [id, out] of Object.entries(LY.outcomes))
      if (out.state === 'failed') delete LY.outcomes[id];
  }
  if (!LY.model) LY.model = lyParse(draft.value);
  if (LY.activeLine > LY.model.sung.length) LY.activeLine = 0;
  const items = lyItems();
  LY.items = items;
  const list = items.filter((i) => i.tone === LY.reviewTab);
  const current = list[Math.min(LY.reviewAt, Math.max(0, list.length - 1))];
  lyRenderHead();
  lyRenderSong(items);
  lyRenderDoc(items, current);
  lyRenderStatus();
  lyRenderPane(items);
  lyRenderTools(items);
}
function lyRenderPane(items) {
  const page = document.querySelector('#surface-lyrics .ly-page');
  if (!page) return;
  page.dataset.pane = LY.pane || 'closed';
  for (const id of ['review', 'history', 'writer']) $ui('ly-' + id).hidden = LY.pane !== id;
  document
    .querySelectorAll('.ly-side-tabs [data-ui="ly-pane"]')
    .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === LY.pane)));
  if (LY.pane === 'review') lyRenderReview(items);
  if (LY.pane === 'history') lyRenderHistory();
}
function lyShowPane(pane, { focus = false } = {}) {
  LY.pane = pane;
  LY.prefs.pane.set(pane);
  lyRefresh(true);
  if (pane && focus) {
    const view = $ui('ly-' + pane);
    view?.scrollIntoView?.({ block: 'nearest' });
    uiFocus(document.querySelector(`.ly-side-tabs [data-id="${pane}"]`));
  }
}
function lySetView(view) {
  LY.view = view;
  lyRefresh(true);
}
function lyScrollToLine(n, { edit = false } = {}) {
  const model = LY.model;
  const row = model.sung[n - 1];
  if (!row) return;
  LY.activeLine = n;
  if (edit) {
    lySetView('edit');
    const draft = lyDraft();
    const rows = draft.value.split('\n');
    const start = rows.slice(0, row.i).reduce((t, r) => t + r.length + 1, 0);
    draft.focus({ preventScroll: true });
    draft.setSelectionRange(start + rows[row.i].length, start + rows[row.i].length);
    LY.caretRow = row.i;
    const lineHeight = parseFloat(getComputedStyle(draft).lineHeight) || 28;
    draft.scrollTop = Math.max(0, row.i * lineHeight - draft.clientHeight / 3);
    lyRenderStatus();
    return;
  }
  if (LY.view !== 'read') LY.view = 'read';
  lyRefresh(true);
  const li = document.querySelector(`#ly-doc .ly-line[data-n="${n}"]`);
  li?.scrollIntoView?.({ block: 'center' });
}

// The writer's replies. The shell forwards each reply to uiReceiveReply; this
// page reads the same payload afterwards (see Shell requests in the PR: a page
// hook would replace this wrapper). Only lyric replies are kept.
let lyRunSeq = 0;
function lyReceive(payload, request) {
  if (!payload || typeof payload !== 'object') return;
  const task = payload.task || chatState.task;
  const isLyric =
    !!payload.artifact ||
    !!payload.lyric ||
    task?.domain === 'lyrics' ||
    (Array.isArray(payload.tools) && payload.tools.some((t) => /^lyric_/.test(t?.name || '')));
  if (!isLyric) return;
  const final =
    lyRunLines(payload.artifact) ||
    (payload.stopped === 'RECOVERY_EXPORTED' && typeof payload.reply === 'string'
      ? lyParse(payload.reply).sung.map((r) => r.text)
      : null);
  const matches = request?.request_id && UI.lyricRequest?.id === request.request_id;
  const tools = Array.isArray(payload.tools) ? payload.tools : [];
  const coverageTool = [...tools]
    .reverse()
    .find((t) => t?.coverage && typeof t.coverage === 'object');
  LY.run = {
    id: ++lyRunSeq,
    at: Date.now(),
    artifact: payload.artifact || null,
    completion: payload.completion || null,
    lyric: payload.lyric || chatState.lyric || null,
    task: task || null,
    tools,
    coverage: coverageTool?.coverage || payload.lyric?.coverage || null,
    stopped: payload.stopped || null,
    error: payload.error || null,
    recoveryExport: payload.stopped === 'RECOVERY_EXPORTED',
    final,
    wholeText:
      typeof payload.artifact?.text === 'string'
        ? payload.artifact.text
        : final
          ? final.join('\n')
          : null,
    base: matches ? lyParse(UI.lyricRequest.text || '').sung.map((r) => r.text) : null,
  };
  LY.reviewTab = 'issue';
  LY.reviewAt = 0;
  lyRefresh(true);
}

// ── Writer prompts (sent only when the person presses Ask) ─────────────────
function lyAskWriter(domain, message) {
  lyShowPane('writer');
  if (!uiNewTask(domain)) return false;
  $ui('chat-input').value = message;
  // A script write fires no input event; see _chatSyncCount in src/app.js.
  _chatSyncCount();
  $ui('chat-input').focus();
  return true;
}
const lyDraftForWriter = () => lyDraft().value + lyWriterDeclarations(lyParse(lyDraft().value));

// ── Menus ─────────────────────────────────────────────────────────────────
function lyCloseMenus(except = '') {
  document.querySelectorAll('#surface-lyrics .ly-menu').forEach((m) => {
    if (m.id === 'ly-menu-' + except) return;
    m.hidden = true;
    document
      .querySelector(`#surface-lyrics [aria-controls="${m.id}"]`)
      ?.setAttribute('aria-expanded', 'false');
  });
  if (!except) LY.menu = '';
}
function lyToggleMenu(id, button) {
  const menu = $ui('ly-menu-' + id);
  if (!menu) return;
  const open = menu.hidden;
  lyCloseMenus(open ? id : '');
  menu.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  LY.menu = open ? id : '';
  if (open) {
    LY.menuOpener = button;
    menu.querySelector('button:not([disabled])')?.focus();
  }
}
function lySyncDisplayMenu() {
  document
    .querySelectorAll('[data-ui="ly-text-size"]')
    .forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.id === String(LY.prefs.size.get())))
    );
  document
    .querySelector('[data-ui="ly-numbers"]')
    ?.setAttribute('aria-pressed', String(!!LY.prefs.numbers.get()));
  document
    .querySelector('[data-ui="ly-setup-rows"]')
    ?.setAttribute('aria-pressed', String(!!LY.prefs.setupRows.get()));
}

// ── Actions ───────────────────────────────────────────────────────────────
const lyItem = (id) => (LY.items || []).find((i) => i.id === id);
const lyReadingValue = ({ token, word, line, kind, phones, basis, source }) =>
  `token ${token} ${lyQuote(word)} in ${lyQuote(line)}${LY_DASH}${kind === 'declared' ? `${phones.join(' ')}${LY_DASH}${basis}${LY_DASH}source: ${source.replace(/[\]\n]/g, ' ')}` : kind === 'uncertain' ? 'uncertain' : 'needs a choice'}`;
function lyValidPhones(phones) {
  if (!phones.length || phones.length > 128) return 'Enter at least one ARPABET phone.';
  const bad = phones.find(
    (p) =>
      !(
        LY_ARPABET_CONSONANTS.includes(p) ||
        (p.length > 1 && '012'.includes(p.slice(-1)) && LY_ARPABET_VOWELS.includes(p.slice(0, -1)))
      )
  );
  if (bad)
    return `“${bad}” is not an ARPABET phone. Vowels carry a stress digit (EH1); consonants carry none (K).`;
  if (!phones.some((p) => LY_ARPABET_VOWELS.includes(p.slice(0, -1))))
    return 'A reading needs at least one vowel (a syllable nucleus).';
  return '';
}
function lyInsertSection(name) {
  const model = lyParse(lyDraft().value);
  const header = `[${name}]`;
  const rows = model.text ? model.text.split('\n') : [];
  let at;
  if (LY.view === 'edit' && LY.caretRow != null && LY.caretRow <= rows.length) {
    // In Edit the header goes where the caret was, before that line.
    at = LY.caretRow;
    rows.splice(at, 0, header);
  } else {
    const after = lySectionOfLine(model, LY.activeLine);
    const parts = lyBlocks(model);
    const block = [{ raw: header }];
    if (after) parts.blocks.splice(after.index + 1, 0, block);
    else parts.blocks.push(block);
    const { text } = lyAssemble(parts);
    lyCommit(text, `Added ${name}. Write its lines in Edit.`);
    return;
  }
  lyCommit(rows.join('\n'), `Added ${name}.`);
}
const LY_ACTIONS = {
  'view-running'() {
    uiNavigate('genre');
    document.body.classList.add('assistant-open');
  },
  'new-lyrics'() {
    lyCloseMenus();
    lyShowPane('writer');
    uiNewTask('lyrics');
  },
  'edit-lyrics'() {
    lyCloseMenus();
    lyShowPane('writer');
    if (!uiNewTask('lyrics-edit')) return;
    $ui('chat-input').value = 'Edit these lyrics:\n' + lyDraftForWriter();
    // maxlength does not bind a script write, so a long draft lands PAST
    // the wall; the counter is what says so before the server refuses it.
    _chatSyncCount();
  },
  'attach-recipe'() {
    lyCloseMenus();
    lyShowPane('writer');
    if (!uiSwitchChat('lyrics')) {
      showToast('Wait for the active recipe request to finish.', 'error');
      return;
    }
    $ui('chat-input').value =
      'Write lyrics for this recording recipe:\n' +
      compileRecipeStack(app.cards, 'rich', { ceiling: 1000 });
    _chatSyncCount();
    $ui('chat-input').focus();
  },
  'copy-lyrics'() {
    lyCloseMenus();
    copyToClipboard(lyDraft().value, 'Lyrics copied with headers', 'Could not copy');
  },
  'ly-copy-sung'() {
    lyCloseMenus();
    copyToClipboard(lySungTexts(LY.model).join('\n'), 'Sung lines copied', 'Could not copy');
  },
  'ly-download'() {
    lyCloseMenus();
    const name =
      (lySetupOf(LY.model, 'title')[0]?.value || app.workspaceName || 'lyrics')
        .replace(/[^\w\- ]+/g, '')
        .trim() || 'lyrics';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lyDraft().value], { type: 'text/plain;charset=utf-8' }));
    a.download = name + '.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  'ly-import'() {
    lyCloseMenus();
    $ui('ly-file').click();
  },
  'ly-blank'() {
    lyCloseMenus();
    if (!lyDraft().value) return showToast('The draft is already blank', 'success');
    lyCommit('', 'Started a blank draft. Undo restores the previous one.');
  },
  'ly-menu'(id, b) {
    lyToggleMenu(id, b);
    if (id === 'display') lySyncDisplayMenu();
  },
  'ly-pane'(id) {
    lyCloseMenus();
    lyShowPane(id, { focus: !!id });
    if (!id) uiFocus(document.querySelector('[data-ui="ly-review"]'));
  },
  'ly-review'() {
    LY.reviewAt = 0;
    const items = lyItems();
    if (!items.some((i) => i.tone === LY.reviewTab))
      LY.reviewTab =
        ['issue', 'input', 'note'].find((t) => items.some((i) => i.tone === t)) || 'issue';
    lyShowPane('review', { focus: true });
  },
  'ly-collapse'(id, b) {
    const part = $ui(`ly-${id}-part`);
    part.hidden = !part.hidden;
    b.setAttribute('aria-expanded', String(!part.hidden));
    b.classList.toggle('is-collapsed', part.hidden);
  },
  'ly-song-tab'(id) {
    LY.songTab = id;
    lyRefresh(true);
  },
  'ly-goto'(id) {
    const s = LY.model.sections[Number(id)];
    if (!s) return;
    if (s.sung.length) lyScrollToLine(s.sung[0].n);
    else {
      lySetView('read');
      $ui(`ly-sec-${s.index}`)?.scrollIntoView?.({ block: 'start' });
    }
  },
  'ly-add-section'(name) {
    lyCloseMenus();
    if (name) return lyInsertSection(name.toUpperCase());
    lyInsertSection('SECTION');
    LY.tool = 'structure';
    LY.toolsOpen = true;
    lyRefresh(true);
    const inputs = document.querySelectorAll('#ly-tool-body input[data-field="name"]');
    const last = [...inputs].find((i) => i.value === 'SECTION') || inputs[inputs.length - 1];
    last?.focus();
    last?.select();
  },
  'ly-sec-move'(id) {
    lyCloseMenus();
    const [k, d] = id.split(':').map(Number);
    lyEditSections(
      ({ blocks }) => {
        const j = k + d;
        if (j < 0 || j >= blocks.length) return false;
        [blocks[k], blocks[j]] = [blocks[j], blocks[k]];
      },
      `Moved section ${d < 0 ? 'up' : 'down'}.`
    );
  },
  'ly-sec-dup'(id) {
    lyCloseMenus();
    const k = Number(id);
    lyEditSections(({ blocks }) => {
      blocks.splice(
        k + 1,
        0,
        blocks[k].map((r) => ({ raw: r.raw }))
      );
    }, 'Duplicated the section as an exact return.');
  },
  'ly-sec-remove'(id) {
    lyCloseMenus();
    const k = Number(id);
    const title = LY.model.sections[k]?.title || 'section';
    lyEditSections(({ blocks }) => {
      blocks.splice(k, 1);
    }, `Removed ${title}.`);
  },
  'ly-sec-rhythm'(id) {
    lyCloseMenus();
    LY.picks.rhythmSec = Number(id);
    LY_ACTIONS['ly-tool']('rhythm', null, null, true);
  },
  'ly-label-stanzas'() {
    lyEditSections(({ blocks }) => {
      blocks.forEach((b, k) => b.unshift({ raw: `[Stanza ${k + 1}]` }));
    }, 'Each stanza now has a header. Rename them in Structure & story.');
  },
  'ly-view'(id) {
    lySetView(id);
    if (id === 'edit') {
      const n = LY.activeLine;
      if (n) lyScrollToLine(n, { edit: true });
      else lyDraft().focus();
    }
  },
  'ly-edit-at'(id) {
    lySetView('edit');
    const draft = lyDraft();
    const rows = draft.value.split('\n');
    const i = Math.min(Number(id), rows.length - 1);
    const pos = rows.slice(0, i + 1).reduce((t, r) => t + r.length + 1, 0) - 1;
    draft.focus();
    draft.setSelectionRange(Math.max(0, pos), Math.max(0, pos));
    LY.caretRow = i;
  },
  'ly-find-open'() {
    $ui('ly-find').hidden = false;
    lySetView('read');
    $ui('ly-find-input').focus();
    $ui('ly-find-input').select();
  },
  'ly-find-step'(id) {
    lyFindStep(Number(id));
  },
  'ly-find-close'() {
    lyFindClose();
  },
  'ly-text-size'(id) {
    LY.prefs.size.set(id);
    lySyncDisplayMenu();
    lyRefresh(true);
  },
  'ly-numbers'() {
    LY.prefs.numbers.set(!LY.prefs.numbers.get());
    lySyncDisplayMenu();
    lyRefresh(true);
  },
  'ly-setup-rows'() {
    LY.prefs.setupRows.set(!LY.prefs.setupRows.get());
    lySyncDisplayMenu();
    lyRefresh(true);
  },
  'ly-tools-toggle'() {
    LY.toolsOpen = !LY.toolsOpen;
    lyRefresh(true);
  },
  'ly-tool'(id, b, _e, force) {
    lyCloseMenus();
    const isTab = b?.getAttribute('role') === 'tab';
    if (!force && !isTab && LY.toolsOpen && LY.tool === id && b?.closest('.ly-tools-bar'))
      LY.toolsOpen = false;
    else {
      LY.tool = id;
      LY.toolsOpen = true;
    }
    lyRefresh(true);
    if (LY.toolsOpen) {
      $ui('ly-tools')?.scrollIntoView?.({ block: 'nearest' });
      if (LY.activeLine)
        document
          .querySelector(`#ly-doc .ly-line[data-n="${LY.activeLine}"]`)
          ?.scrollIntoView?.({ block: 'nearest' });
      if (!isTab && !b?.closest('.ly-tools-bar'))
        uiFocus(document.querySelector(`.ly-tool-tabs [data-id="${id}"]`));
    }
  },
  'ly-line'(id) {
    const n = Number(id);
    LY.activeLine = LY.activeLine === n ? 0 : n;
    lyRefresh(true);
    uiFocus(document.querySelector(`#ly-doc .ly-line[data-n="${n}"] .ly-line-btn`));
  },
  'ly-line-tool'(id) {
    const [tool, n] = [id.split(':')[0], Number(id.split(':')[1])];
    if (tool === 'edit') return lyScrollToLine(n, { edit: true });
    if (tool === 'rhymes') {
      LY.picks.linkLine = n;
      LY.picks.explore = lyTokens(LY.model.sung[n - 1]?.text || '', LY.model.voices).pop() || '';
    }
    if (tool === 'rhythm') LY.picks.rhythmSec = lySectionOfLine(LY.model, n)?.index;
    if (tool === 'pronunciation') {
      LY.picks.readingLine =
        LY.model.sung.find((r) => r.text === LY.model.sung[n - 1]?.text)?.n || n;
      LY.picks.readingToken = 0;
    }
    LY_ACTIONS['ly-tool'](tool, null, null, true);
  },
  'ly-rtab'(id) {
    LY.reviewTab = id;
    LY.reviewAt = 0;
    lyRefresh(true);
    uiFocus(document.querySelector(`[data-ui="ly-rtab"][data-id="${id}"]`));
  },
  'ly-rstep'(id) {
    LY.reviewAt = Math.max(0, LY.reviewAt + Number(id));
    lyRefresh(true);
    const it = LY.items.filter((i) => i.tone === LY.reviewTab)[LY.reviewAt];
    if (it?.lines?.length && LY.view === 'read')
      document
        .querySelector(`#ly-doc .ly-line[data-n="${it.lines[0]}"]`)
        ?.scrollIntoView?.({ block: 'center' });
    uiFocus(document.querySelector('#ly-item-title')) ||
      uiFocus(document.querySelector('.ly-pager [data-ui="ly-rstep"]:not([disabled])'));
  },
  'ly-apply'(id) {
    const item = lyItem(id);
    if (!item) return;
    const ok = lyCheckApply(item);
    uiFocus(
      document.querySelector(ok ? '.ly-outcome, .ly-pager span, #ly-review .cm-tab' : '.ly-outcome')
    );
  },
  'ly-own'(id) {
    const item = lyItem(id);
    if (!item) return;
    LY.own[id] = item.proposal;
    lyRenderReview();
    $ui('ly-own-input')?.focus();
  },
  'ly-own-cancel'(id) {
    delete LY.own[id];
    lyRenderReview();
  },
  'ly-own-check'(id) {
    const item = lyItem(id);
    const text = ($ui('ly-own-input')?.value || '').trim();
    if (!item || !text) return;
    const n = item.decision.n;
    lyAskWriter(
      'lyrics-edit',
      `Check this replacement for line ${n} against the current draft and its declarations. If it fails, keep the original line and say why.\nLine ${n} now: ${lySungTexts(LY.model)[n - 1] ?? item.original}\nReplacement: ${text}\n\nCurrent draft:\n${lyDraftForWriter()}`
    );
  },
  'ly-own-put'(id) {
    const item = lyItem(id);
    const text = ($ui('ly-own-input')?.value || '').trim();
    if (!item || !text) return;
    if (lyCheckApply({ ...item, proposal: text })) {
      LY.outcomes[id].message =
        'Your own line is in the draft. Nothing has checked it; Undo restores the original.';
      delete LY.own[id];
      lyRenderReview();
    }
  },
  'ly-keep'(id) {
    LY.outcomes[id] = { state: 'kept', message: 'Kept your line.' };
    showToast('Kept your line', 'success');
    lyRefresh(true);
  },
  'ly-explore'(id) {
    LY.picks.explore =
      lyTokens(LY.model.sung[Number(id) - 1]?.text || '', LY.model.voices).pop() || '';
    LY_ACTIONS['ly-tool']('rhymes', null, null, true);
    $ui('ly-explore-in')?.focus();
  },
  'ly-rewrite-group'(id) {
    const ns = id.split(',').map(Number);
    lyAskWriter(
      'lyrics-edit',
      `Rewrite ${lyLineRef(ns)} together so they keep their rhyme link and every other declaration. Change no other line.\n\nCurrent draft:\n${lyDraftForWriter()}`
    );
  },
  'ly-show-lines'(id) {
    lyScrollToLine(Number(id));
  },
  'ly-ask-review'() {
    lyAskWriter(
      'lyrics-edit',
      `Review these lyrics against their section headers and [SETUP] declarations. Report every finding, what could not be judged, and what input is missing. Do not rewrite anything yet.\n\n${lyDraftForWriter()}`
    );
  },
  'ly-fix-count'(id) {
    lyRewriteHeader(Number(id), (h, s) => (h.lines = s.sung.length), 'Header updated.');
  },
  'ly-make-return'(id) {
    const [k, first] = id.split(':').map(Number);
    lyEditSections(({ blocks }) => {
      const src = blocks[first],
        dst = blocks[k];
      if (!src || !dst) return false;
      const header = dst[0] && LY_BRACKET.test(dst[0].raw.trim()) ? [dst[0]] : [];
      const body = src
        .filter((r, i) => !(i === 0 && LY_BRACKET.test(r.raw.trim())))
        .map((r) => ({ raw: r.raw }));
      blocks[k] = [...header, ...body];
    }, 'The section now returns word for word.');
  },
  'ly-remove-setup'(id) {
    const rows = lyDraft().value.split('\n');
    const i = Number(id);
    if (!LY_SETUP.test((rows[i] || '').trim())) return;
    rows.splice(i, 1);
    lyCommit(rows.join('\n'), 'Declaration removed.');
  },
  'ly-open-writer'() {
    lyShowPane('writer');
    uiChatOpen();
  },
  'ly-recover'() {
    lyShowPane('writer');
    $ui('chat-recover')?.click();
  },
  'ly-review-run'() {
    LY.reviewTab = 'issue';
    LY.reviewAt = 0;
    lyShowPane('review', { focus: true });
  },
  'ly-relation-save'() {
    const sel = $ui('ly-relation').value;
    const v = sel === 'other' ? $ui('ly-relation-other').value.trim() : sel;
    if (sel === 'other' && !/^(type|class|schema):\S/.test(v))
      return showToast('Name the relation with its namespace: type:, class: or schema:', 'error');
    lySetupCommit(
      'relation',
      v ? [v] : [],
      v ? `Relation declared: ${v}.` : 'Relation no longer declared.'
    );
  },
  'ly-link-add'() {
    const line = Number($ui('ly-link-line').value);
    const place = $ui('ly-link-place').value;
    if (!line) return;
    const m = { line, place };
    if (!LY.picks.linkMembers.some((x) => x.line === line && x.place === place))
      LY.picks.linkMembers.push(m);
    LY.picks.linkLine = line;
    lyRefresh(true);
    uiFocus($ui('ly-link-line'));
  },
  'ly-link-clear'() {
    LY.picks.linkMembers = [];
    lyRefresh(true);
  },
  'ly-link-save'() {
    const members = LY.picks.linkMembers;
    if (members.length < 2) return;
    const groups = lySetupOf(LY.model, 'rhyme groups').flatMap((d) => lyParseGroups(d.value));
    groups.push(members);
    LY.picks.linkMembers = [];
    lySetupCommit('rhyme groups', [lyGroupsText(groups)], 'Rhyme link saved.');
  },
  'ly-link-remove'(id) {
    const groups = lySetupOf(LY.model, 'rhyme groups').flatMap((d) => lyParseGroups(d.value));
    groups.splice(Number(id), 1);
    lySetupCommit(
      'rhyme groups',
      groups.length ? [lyGroupsText(groups)] : [],
      'Rhyme link removed.'
    );
  },
  'ly-title-save'() {
    const v = $ui('ly-title-in')
      .value.replace(/[\]\n]/g, ' ')
      .trim();
    lySetupCommit('title', v ? [v] : [], v ? 'Title declared.' : 'Title no longer declared.');
  },
  'ly-hook-save'() {
    const n = Number($ui('ly-hook-in').value);
    const text = LY.model.sung[n - 1]?.text;
    if (text?.includes(']'))
      return showToast(
        'This line contains “]”, which cannot be kept inside a setup line.',
        'error'
      );
    lySetupCommit(
      'hook',
      text ? [lyQuote(text)] : [],
      text ? 'Hook declared.' : 'Hook no longer declared.'
    );
  },
  'ly-word-add'(id) {
    const input = $ui(`ly-${id}-in`);
    const v = input.value.replace(/[\]\n]/g, ' ').trim();
    if (!v) return;
    const values = [...lySetupOf(LY.model, id).map((d) => d.value), v];
    lySetupCommit(
      id,
      values,
      id === 'require' ? `“${v}” must be included.` : `“${v}” is set to avoid.`
    );
  },
  'ly-word-remove'(id) {
    LY_ACTIONS['ly-remove-setup'](id);
  },
  'ly-explore-ask'() {
    const w = $ui('ly-explore-in').value.trim();
    const also = $ui('ly-explore-with').value.trim();
    if (!w) return $ui('ly-explore-in').focus();
    LY.picks.explore = w;
    lyAskWriter(
      'lyrics-edit',
      `Screen rhyme candidates for “${w}”${also ? ` that also ${also}` : ''} in this draft. List full matches separately from partial matches, and say which requirement each partial match misses. Do not change the draft.\n\n${lyDraftForWriter()}`
    );
  },
  'ly-rhythm-save'(id) {
    const k = Number(id);
    const tr = document.querySelector(`#ly-tool-body tr[data-sec="${k}"]`);
    const meter = tr.querySelector('[data-rhythm="meter"]').value.trim();
    const bars = tr.querySelector('[data-rhythm="bars"]').value.trim();
    const pickup = tr.querySelector('[data-rhythm="pickup"]').value;
    if (meter && !/^\d{1,2}\/\d{1,2}$/.test(meter))
      return showToast('Write the meter as beats/unit, e.g. 4/4 or 7/8', 'error');
    if (bars && !/^\d{1,3}$/.test(bars)) return showToast('Bars must be a whole number', 'error');
    if (pickup && !meter) return showToast('Declare a meter with the pickup', 'error');
    LY.picks.rhythmSec = k;
    lyRewriteHeader(
      k,
      (h) => {
        h.meter = meter || null;
        h.bars = bars ? Number(bars) : null;
        h.pickup = pickup || null;
      },
      'Rhythm declared.'
    );
  },
  'ly-reading-token'(id) {
    LY.picks.readingToken = Number(id);
    lyRefresh(true);
  },
  'ly-reading-save'() {
    const model = LY.model;
    const n = Number($ui('ly-reading-line').value);
    const row = model.sung[n - 1];
    const token = LY.picks.readingToken;
    const word = row && lyTokens(row.text, model.voices)[token - 1];
    const err = $ui('ly-reading-error');
    if (!row || !word) return (err.textContent = 'Choose a sung word.');
    if (row.text.includes(']'))
      return (err.textContent =
        'This line contains “]”, which cannot be kept inside a setup line. Declare its reading to the writer in the conversation instead.');
    const kind = document.querySelector('input[name="ly-reading-kind"]:checked')?.value || 'choice';
    const data = { token, word, line: row.text, kind };
    if (kind === 'declared') {
      data.phones = $ui('ly-phones').value.trim().toUpperCase().split(/\s+/).filter(Boolean);
      data.basis = $ui('ly-basis').value;
      data.source = $ui('ly-source').value.trim();
      const bad =
        lyValidPhones(data.phones) ||
        (!data.source
          ? 'State who chose this reading and why, or its source. A reading is never silently guessed.'
          : '');
      if (bad) return (err.textContent = bad);
    }
    const others = lySetupOf(model, 'reading')
      .filter((r) => !(r.line === row.text && r.token === token))
      .map((r) => r.value);
    LY.picks.readingToken = 0;
    lySetupCommit(
      'reading',
      [...others, lyReadingValue(data)],
      `Reading for “${word}” saved for ${lyLineRef(model.sung.filter((r) => r.text === row.text).map((r) => r.n))}.`
    );
  },
  'ly-reading-ask'() {
    lyAskWriter(
      'lyrics-edit',
      `List the dictionary pronunciation options (pronunciation_options) for the words whose [SETUP — reading] says “needs a choice”. Do not choose for me and do not rewrite the lyrics.\n\n${lyDraftForWriter()}`
    );
  },
  'ly-returns-declare'() {
    const placed = lySetupOf(LY.model, 'returns')
      .flatMap((d) => lyParseGroups(d.value))
      .filter((g) => g.some((m) => m.place && m.place !== 'end'));
    const exact = LY.model.repeats.map((r) => r.lines.map((line) => ({ line, place: 'end' })));
    if (!exact.length) return;
    lySetupCommit(
      'returns',
      [lyGroupsText([...exact, ...placed])],
      placed.length ? 'Exact returns declared; placed returns kept.' : 'Exact returns declared.'
    );
  },
  'ly-melody-save'() {
    const v = (id) => $ui(id).value.trim();
    const text = [
      v('ly-mel-meter'),
      v('ly-mel-groups') && `groups ${v('ly-mel-groups')}`,
      v('ly-mel-bars') && `${v('ly-mel-bars')} bars`,
      `subdivision ${v('ly-mel-sub')}`,
      v('ly-mel-events'),
    ]
      .filter(Boolean)
      .join(LY_DASH);
    LY.picks.melody = {
      meter: v('ly-mel-meter'),
      groups: v('ly-mel-groups'),
      bars: v('ly-mel-bars'),
      subdivision: v('ly-mel-sub'),
      events: v('ly-mel-events'),
    };
    LY.picks.melodyOpen = true;
    const m = lyParseMelody(text);
    if (m.error) {
      $ui('ly-mel-status').textContent = m.error;
      return;
    }
    LY.picks.melody = null;
    lySetupCommit('melody', [lyMelodyText(m.melody)], 'Melody declared.');
  },
  'ly-melody-clear'() {
    LY.picks.melody = null;
    lySetupCommit('melody', [], 'Melody removed.');
  },
  'ly-story-save'() {
    const rows = [...document.querySelectorAll('#ly-tool-body tr[data-story]')];
    const steps = rows.map((tr, k) => ({
      atom: tr.querySelector('[data-story-field="atom"]').value,
      junction: k ? tr.querySelector('[data-story-field="junction"]').value : '',
    }));
    const missing = steps.findIndex((x, k) => !x.atom || (k && !x.junction));
    if (missing >= 0) {
      $ui('ly-story-error').textContent =
        `Choose a job${missing ? ' and how it enters' : ''} for every sung section (row ${missing + 1} is incomplete).`;
      return;
    }
    lySetupCommit(
      'narrative',
      [steps.map((x, k) => (k ? `${x.atom}/${x.junction}` : x.atom)).join(',')],
      'Story plan declared.'
    );
  },
  'ly-story-off'() {
    lySetupCommit('narrative', ['off'], 'The story layer is declared off.');
  },
  'ly-story-clear'() {
    lySetupCommit('narrative', [], 'Story plan no longer declared.');
  },
  'ly-placed-add'() {
    const line = Number($ui('ly-placed-line').value);
    const place = $ui('ly-placed-place').value;
    if (!line) return;
    LY.picks.placedMembers = LY.picks.placedMembers || [];
    if (!LY.picks.placedMembers.some((x) => x.line === line && x.place === place))
      LY.picks.placedMembers.push({ line, place });
    LY.picks.placedLine = line;
    lyRefresh(true);
    uiFocus($ui('ly-placed-line'));
  },
  'ly-placed-clear'() {
    LY.picks.placedMembers = [];
    lyRefresh(true);
  },
  'ly-placed-save'() {
    const members = LY.picks.placedMembers || [];
    if (members.length < 2) return;
    const groups = lySetupOf(LY.model, 'returns').flatMap((d) => lyParseGroups(d.value));
    groups.push(members);
    LY.picks.placedMembers = [];
    lySetupCommit('returns', [lyGroupsText(groups)], 'Placed return declared.');
  },
  'ly-returns-clear'() {
    lySetupCommit('returns', [], 'Returns no longer declared.');
  },
};

// ── Find ──────────────────────────────────────────────────────────────────
function lyFindMatches() {
  const q = LY.find.q.toLowerCase();
  return q ? LY.model.sung.filter((r) => r.text.toLowerCase().includes(q)).map((r) => r.n) : [];
}
function lyFindUpdate() {
  const hits = lyFindMatches();
  if (LY.find.at >= hits.length) LY.find.at = 0;
  $ui('ly-find-count').textContent = LY.find.q
    ? hits.length
      ? `${LY.find.at + 1} of ${lyPlural(hits.length, 'line')}`
      : 'No matches'
    : '';
  return hits;
}
function lyFindStep(d) {
  const hits = lyFindMatches();
  if (!hits.length) return lyFindUpdate();
  LY.find.at = (LY.find.at + d + hits.length) % hits.length;
  lyFindUpdate();
  lyScrollToLine(hits[LY.find.at]);
  $ui('ly-find-input').focus();
}
function lyFindClose() {
  LY.find = { q: '', at: 0 };
  $ui('ly-find-input').value = '';
  $ui('ly-find').hidden = true;
  lyFindUpdate();
  lyRefresh(true);
  uiFocus(document.querySelector('[data-ui="ly-find-open"]'));
}

// ── Page ──────────────────────────────────────────────────────────────────
function uiLyricsWaiting() {
  if ($ui('lyrics-wait')) return;
  const note = document.createElement('div');
  note.id = 'lyrics-wait';
  note.innerHTML =
    '<p>Your recipe request is still running.</p>' +
    uiButton('view-running', 'View request', 'message-circle');
  $ui('lyrics-chat').append(note);
}
function lyWire(surface) {
  const draft = lyDraft();
  // Every script write to the draft (Undo, a restored or imported session, a
  // writer's lyrics) must reach this view; none of them fires `input`.
  const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  Object.defineProperty(draft, 'value', {
    configurable: true,
    get() {
      return proto.get.call(this);
    },
    set(v) {
      proto.set.call(this, v);
      lyRefresh();
    },
  });
  draft.addEventListener('input', () => {
    uiSaveLyrics();
    lyRefresh();
  });
  draft.addEventListener('blur', () => pushHistory());
  for (const ev of ['keyup', 'click', 'select'])
    draft.addEventListener(ev, () => {
      LY.caretRow = draft.value.slice(0, draft.selectionStart).split('\n').length - 1;
      if (LY.model) lyRenderStatus();
    });
  $ui('ly-find-input').addEventListener('input', (e) => {
    LY.find = { q: e.target.value, at: 0 };
    const hits = lyFindUpdate();
    lyRefresh(true);
    if (hits.length)
      document
        .querySelector(`#ly-doc .ly-line[data-n="${hits[0]}"]`)
        ?.scrollIntoView?.({ block: 'center' });
  });
  $ui('ly-find-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lyFindStep(e.shiftKey ? -1 : 1);
    }
  });
  $ui('ly-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = (await file.text()).replace(/\r\n?/g, '\n');
      lyCommit(text, `Imported ${file.name}. Undo restores the previous draft.`);
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
  });
  surface.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'ly-relation') $ui('ly-relation-other').hidden = t.value !== 'other';
    else if (t.id === 'ly-link-line') {
      LY.picks.linkLine = Number(t.value);
      lyRefresh(true);
      uiFocus($ui('ly-link-line'));
    } else if (t.id === 'ly-placed-line') {
      LY.picks.placedLine = Number(t.value);
      lyRefresh(true);
      uiFocus($ui('ly-placed-line'));
    } else if (t.id === 'ly-reading-line') {
      LY.picks.readingLine = Number(t.value);
      LY.picks.readingToken = 0;
      lyRefresh(true);
      uiFocus($ui('ly-reading-line'));
    } else if (t.name === 'ly-reading-kind') {
      LY.picks.readingKind = t.value;
      $ui('ly-reading-supply').hidden = t.value !== 'declared';
    } else if (t.name === 'ly-voices')
      lySetupCommit(
        'voices',
        t.value === 'sung' ? ['parentheses are sung'] : [],
        t.value === 'sung' ? 'Parentheses are declared sung.' : 'Parentheses are unsung asides.'
      );
    else if (t.dataset.field && t.dataset.sec !== undefined) {
      const k = Number(t.dataset.sec);
      if (t.dataset.field === 'name') {
        const v = t.value.replace(/[[\]\n—]/g, ' ').trim();
        if (!v) return;
        lyRewriteHeader(k, (h) => (h.name = v), 'Section renamed.');
      } else {
        const v = t.value.trim();
        if (v && !/^\d{1,3}$/.test(v)) return;
        lyRewriteHeader(
          k,
          (h) => (h.lines = v ? Number(v) : null),
          v ? 'Declared size updated.' : 'Declared size removed.'
        );
      }
    }
  });
  // Close a page menu on an outside click.
  document.addEventListener('click', (e) => {
    if (LY.menu && !e.target.closest('.ly-menu-wrap')) lyCloseMenus();
  });
  // Arrow keys inside an open page menu.
  surface.addEventListener('keydown', (e) => {
    const menu = e.target.closest('.ly-menu');
    if (!menu || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = [...menu.querySelectorAll('button:not([disabled])')];
    const i = items.indexOf(e.target);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
    e.preventDefault();
  });
  // The shell hands every writer reply to uiReceiveReply; read it after.
  const shellReceive = window.uiReceiveReply;
  if (typeof shellReceive === 'function' && !shellReceive.lyWrapped) {
    const wrapped = function (payload, request) {
      const result = shellReceive.apply(this, arguments);
      try {
        lyReceive(payload, request);
      } catch (err) {
        console.error('Lyrics page could not read the reply:', err);
      }
      return result;
    };
    wrapped.lyWrapped = true;
    window.uiReceiveReply = wrapped;
  }
}
uiRegisterPage({
  id: 'lyrics',
  mount(surface) {
    LY.prefs = {
      size: UILayout.remember('lyrics-text-size', '0'),
      numbers: UILayout.remember('lyrics-line-numbers', true),
      setupRows: UILayout.remember('lyrics-setup-rows', true),
      pane: UILayout.remember('lyrics-pane', 'review'),
    };
    LY.pane = LY.prefs.pane.get();
    surface.innerHTML = lyMountMarkup();
    lyWire(surface);
    // On a phone the document comes first: the outline and setup start folded.
    if (matchMedia('(max-width: 699px)').matches)
      for (const id of ['song', 'setup']) {
        $ui(`ly-${id}-part`).hidden = true;
        const b = document.querySelector(`[data-ui="ly-collapse"][data-id="${id}"]`);
        b.setAttribute('aria-expanded', 'false');
        b.classList.add('is-collapsed');
      }
    LY.model = lyParse(lyDraft().value);
    LY.text = lyDraft().value;
    lyRefresh(true);
  },
  render() {
    // Replies recovered on load, before this page saw them, are still the
    // writer's latest state; show their status without a base draft.
    if (!LY.run && chatState.task?.domain === 'lyrics' && chatState.task.artifact)
      lyReceive(
        { artifact: chatState.task.artifact, lyric: chatState.lyric, task: chatState.task },
        null
      );
    lyRefresh(true);
  },
  // Page geometry: the song outline and the side panel resize from their
  // inner edges (drag or arrow keys; Home resets), above 1100px.
  layout() {
    const body = $ui('ly-body');
    UILayout.splitter({
      container: body,
      panel: $ui('ly-song'),
      key: 'lyrics-song',
      property: '--ly-song-width',
      title: 'Resize song outline',
      limits: () => [220, Math.min(420, body.clientWidth * 0.3)],
      enabled: () => innerWidth >= 900 && body.clientWidth >= 1000,
    });
    UILayout.splitter({
      container: body,
      panel: $ui('ly-side'),
      key: 'lyrics-side',
      property: '--ly-side-width',
      title: 'Resize review panel',
      side: 'left',
      limits: () => [300, Math.min(560, body.clientWidth * 0.45)],
      enabled: () => innerWidth >= 900 && body.clientWidth >= 760 && !!LY.pane,
    });
  },
  resetLayout() {
    LY.pane = LY.prefs.pane.get();
    lyRefresh(true);
  },
  escape() {
    if (LY.menu) {
      const opener = LY.menuOpener;
      lyCloseMenus();
      return uiFocus(opener);
    }
    if (!$ui('ly-find').hidden) return lyFindClose();
    if (LY.toolsOpen) {
      LY.toolsOpen = false;
      lyRefresh(true);
      return uiFocus(document.querySelector('.ly-tools-main'));
    }
    if (LY.activeLine) {
      const n = LY.activeLine;
      LY.activeLine = 0;
      lyRefresh(true);
      return uiFocus(document.querySelector(`#ly-doc .ly-line[data-n="${n}"] .ly-line-btn`));
    }
  },
  actions: LY_ACTIONS,
});
