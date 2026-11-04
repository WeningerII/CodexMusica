// test_prompt_provenance.mjs — what every surface SENDS a model, held to a
// provenance contract (#671 layer 1).
//
// WHY. #629 removed the worked examples, the "e.g." genre and lyric phrases and
// the ban wording from connector text, and #682 rewrote the lyric instructions.
// The only guard was mcp/test.mjs's AGENTS.md check, which reads one document;
// the text a model actually receives — every tool description and schema field
// on every connector surface, the initialize instructions, and the website
// chat's system instruction — had no regression protection at all. A removed
// example could come back in any of them and nothing would fail.
//
// WHAT IS READ. Live, never re-typed: each surface is built and listed through
// an in-memory MCP client (the same round-trip scripts/check_connector_contract.js
// uses), and the chat's system instruction comes from the ONE function that
// builds it (`buildSystemInstruction`), for the task and run states listed in
// CHAT_STATES. Strings read: initialize instructions; every tool's description
// and title; every `description`, `title`, `default` and `examples` node in
// every input schema.
//
// WHAT IS NOT READ (each is named so nobody reads this as complete):
//   * /.well-known/mcp.json — its text is built inline in server_http.js;
//   * gemini_proposer.py's prompt templates (Python; a separate surface);
//   * tool RESULTS and refusal texts, which depend on the call;
//   * the suspended-run reminder, which needs an encoded run state;
//   * AGENTS.md, which mcp/test.mjs already pins.
//
// THE CONTRACT. It states what kind of text may reach a model, not a list of
// banned lyric words (#671 safeguards 3 and 5: historical words are leads, never
// bans):
//   1. No example framing ("e.g.", "for example", "such as", …) unless the
//      reviewed list admits that exact fragment, and an admitted fragment is
//      placeholders and ids only.
//   2. Every quoted literal is mechanical — a tool name, an input field, an
//      enum value, a CODE, a snake_case or dotted field, a JSON key, or text
//      with no words in it — or a reviewed row covers THAT occurrence.
//   3. An unquoted "a, b, c, …" list of words is covered by reviewed rows.
//   4. No numeric song shape ("N lines", "lines<=N", …) is stated.
//   5. A stated default form is DEFAULT_FORM, and DEFAULT_FORM is `open`.
//   6. No word list or ban is stated to the writer (#627).
//   7. Nothing #629 removed comes back, anywhere in this text.
//   8. search_prefaces descriptions name no catalog preface ids (#671).
//
// THE REVIEWED LIST (mcp/fixtures/model_visible_provenance.json) admits an
// OCCURRENCE, never a word: each row binds one literal to the locations it was
// reviewed at (`at`: "instructions", "systemInstruction", or "<tool> <field
// path>") and to the reviewed text around it (`contexts`), so the same word in
// a new sentence, or in another tool, is not covered. It is not a way back in
// for genre, theme or lyric examples (#671 safeguard 3): the categories are
// closed and checked here — a field or value must be declared in the source
// that produces it, an id must resolve, a placeholder must hold one, a quoted
// check must sit beside what it names, a pending removal must name its issue —
// every row must still occur where it says, and #629's removals cannot be
// entered at all.
//
// WHAT THIS CATCHES, AND WHAT IT DOES NOT. It is syntactic: example framing,
// quoted text, "a, b, c, …" lists, numeric shapes, default-form statements,
// ban phrasing and #629's exact literals. An unframed, unquoted sentence that
// carries a theme is NOT caught; the source diff is where that is seen.
//
// A `field-or-value` row names its declaring file, its role there, and for a
// value the field it is a value OF; the test finds the literal in that file
// in that role. A reviewer still judges whether that occurrence really is the
// field: a source file can hold demo or example strings that happen to sit
// near a field name.
//
// PROVENANCE_PRINT=1 prints a row skeleton (literal, at, contexts) for every
// uncovered occurrence (PROVENANCE_PRINT=<file> writes them there), so a
// reviewer sees exactly what a new row would admit.
//
// A FAILURE MEANS model-visible text changed in a way this contract asks a
// person to look at. Fix the text, or — for a genuinely mechanical literal —
// add a row with its category and reason, and let review see the row.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { buildWorkflowServer } from './workflow_tools.js';
import { WorkflowSessions } from './workflow_sessions.js';
import { JobStore } from './job_store.js';
import { _agentInternals } from './gemini_agent.js';
import { DEFAULT_FORM } from './lyric_workflow.js';
import { PLAN_FORMS } from './lyric_tools.js';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../scripts/_loader.js');

const REGISTRY = JSON.parse(
  readFileSync(new URL('./fixtures/model_visible_provenance.json', import.meta.url), 'utf8')
);

// ── collection ──────────────────────────────────────────────────────────────

async function listed(built) {
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'prompt-provenance', version: '0' }, { capabilities: {} });
  await Promise.all([built.connect(s), client.connect(c)]);
  try {
    return { tools: (await client.listTools()).tools, instructions: client.getInstructions() };
  } finally {
    await client.close();
    await built.close();
  }
}

// Every connector surface a host is given, plus the website chat's own server.
// The tool counts keep the collection from passing by reading nothing.
const SERVERS = [
  ['raw engine (stdio)', () => buildServer(), 18],
  ['raw /mcp/recipe', () => buildServer({ task: { domain: 'recipe' } }), 9],
  ['raw /mcp/lyrics', () => buildServer({ task: { domain: 'lyrics' } }), 9],
  ["website chat's server", () => buildServer({ kitchen: true }), 18],
];
const sessions = new WorkflowSessions({ store: new JobStore() });
const WORKFLOWS = [
  ['/mcp', { domain: null, compatibility: true }, 21],
  ['/mcp/chatgpt', { domain: null, compatibility: false }, 21],
  ['/mcp/chatgpt/recipe', { domain: 'recipe', compatibility: false }, 11],
  ['/mcp/chatgpt/lyrics', { domain: 'lyrics', compatibility: false }, 12],
];

// A user's own words are explicit input, never system-authored text: the
// sentinel marks where they go, and is removed before the contract is read.
const USER_WORDS = 'USER-SUPPLIED-BRIEF-SENTINEL';
const CHAT_STATES = [
  ['no task', null, null, null],
  ['recipe, browse', null, null, { domain: 'recipe', phase: 'browse' }],
  ['recipe, create', null, null, { domain: 'recipe', phase: 'create' }],
  ['lyrics, empty transcript', null, new Set(), { domain: 'lyrics', phase: 'create' }],
  [
    'lyrics, page context with a brief',
    null,
    new Set(),
    {
      domain: 'lyrics',
      phase: 'create',
      lyric_context: { intent: 'write', brief: USER_WORDS, notes: [USER_WORDS] },
    },
  ],
  [
    'lyrics, edit (review)',
    null,
    new Set(),
    { domain: 'lyrics', phase: 'edit', lyric_context: { intent: 'review' } },
  ],
  ['parked run', { parked: true, seed: 7, open: ['3'] }, new Set(), { domain: 'lyrics' }],
  ['uncertain proposal', { uncertain_proposal: true }, new Set(), { domain: 'lyrics' }],
  ['resumable run', { resumable: true }, new Set(), { domain: 'lyrics' }],
];

const strings = []; // { surface, where, text }
const vocabulary = new Set(); // tool names, input fields, enum values
let chatServer = null;

function collect(surface, { tools, instructions }) {
  strings.push({ surface, where: 'instructions', text: instructions || '' });
  for (const t of tools) {
    vocabulary.add(t.name);
    strings.push({ surface, where: `${t.name} description`, text: t.description || '' });
    if (t.title) strings.push({ surface, where: `${t.name} title`, text: t.title });
    const walk = (node, at) => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${at}[${i}]`));
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if ((k === 'description' || k === 'title') && typeof v === 'string')
          strings.push({ surface, where: `${t.name} ${at}.${k}`, text: v });
        else if (k === 'default' || k === 'examples')
          strings.push({ surface, where: `${t.name} ${at}.${k}`, text: JSON.stringify(v) });
        else if (k === 'properties' && v && typeof v === 'object') {
          for (const p of Object.keys(v)) vocabulary.add(p);
          walk(v, `${at}.properties`);
        } else if (k === 'enum' && Array.isArray(v)) {
          for (const e of v) if (typeof e === 'string') vocabulary.add(e);
        } else walk(v, `${at}.${k}`);
      }
    };
    walk(t.inputSchema, 'input');
  }
}

const counts = {};
test.before(async () => {
  for (const [label, build, n] of SERVERS) {
    const got = await listed(build());
    counts[label] = [got.tools.length, n];
    collect(label, got);
    if (label === "website chat's server") chatServer = got;
  }
  for (const [label, opts, n] of WORKFLOWS) {
    const got = await listed(await buildWorkflowServer({ ...opts, sessions }));
    counts[label] = [got.tools.length, n];
    collect(label, got);
  }
  const surface = { instructions: chatServer.instructions };
  for (const [label, lyr, record, task] of CHAT_STATES) {
    const si = _agentInternals.buildSystemInstruction(surface, lyr, record, task);
    const text = (si?.parts || []).map((p) => p.text).join('\n');
    strings.push({
      surface: `chat system instruction (${label})`,
      where: 'systemInstruction',
      text: text.split(USER_WORDS).join(' '),
    });
  }
});

// ── helpers ─────────────────────────────────────────────────────────────────

const where = (s) => `${s.surface} → ${s.where}`;
// One entry per (location, text): the same words at two locations are two
// occurrences a row must each cover.
const unique = (list = strings) => {
  const by = new Map();
  for (const s of list)
    if (!by.has(`${s.where}\u0000${s.text}`)) by.set(`${s.where}\u0000${s.text}`, s);
  return [...by.values()];
};

// A quoted literal: "…", '…' or `…`, where a single quote is not an apostrophe
// (no letter immediately outside it). No length cap: a long quoted passage is
// exactly the kind of text this rule exists to see.
const QUOTED = /"([^"\n]+)"|(?<![A-Za-z])'([^'\n]+)'(?![A-Za-z])|`([^`\n]+)`/g;

// Is `lit` a KEY in JSON shown to the model? A key is followed by ':' or is a
// member of a key-list shape ({"a","b"}). A JSON VALUE is never mechanical by
// position: a worked example's values are where a theme would sit.
function jsonKey(lit, text) {
  if (text.includes(`"${lit}":`)) return true;
  const q = `"${lit}"`;
  for (let i = text.indexOf(q); i >= 0; i = text.indexOf(q, i + 1)) {
    const before = text[i - 1];
    const after = text[i + q.length];
    if (!'{,'.includes(before) || !',}'.includes(after)) continue;
    // The innermost open bracket decides: inside [...] it is an array value.
    let depth = 0;
    for (let j = i - 1; j >= 0; j--) {
      const c = text[j];
      if (c === '}' || c === ']') depth++;
      else if (c === '{' || c === '[') {
        if (depth === 0) {
          if (c === '{') return true;
          break;
        }
        depth--;
      }
    }
  }
  return false;
}

const PLACEHOLDER = /<[^<>]+>|\b[A-Z]\b|…/;
const mechanical = (lit, text = '') =>
  vocabulary.has(lit) ||
  /^[a-z][a-z0-9]*(?:[_.][a-z0-9]+)+(?:: true)?$/.test(lit) || // a field: snake_case or dotted
  jsonKey(lit, text) ||
  /^[A-Z][A-Z0-9_]+$/.test(lit) || // a CODE
  !/[a-z]{3,}/.test(lit) || // no word in it: '4/4', '=', '#', '<id>'
  (PLACEHOLDER.test(lit) && lit.split(/[^a-z]+/).every((w) => w.length < 3 || vocabulary.has(w)));

// Does a row cover the occurrence of `lit` at `index` in this string? Only a
// row for that literal, reviewed at this location, whose reviewed context
// contains this very occurrence.
function covered(registry, lit, s, index, categories = null) {
  return registry.entries.some((r) => {
    if (r.literal !== lit) return false;
    if (categories && !categories.includes(r.category)) return false;
    if (!(r.at || []).includes(s.where)) return false;
    return (r.contexts || []).some((ctx) => {
      if (!ctx.includes(lit)) return false;
      for (let c = s.text.indexOf(ctx); c >= 0; c = s.text.indexOf(ctx, c + 1))
        if (index >= c && index + lit.length <= c + ctx.length) return true;
      return false;
    });
  });
}

// The reviewed text around an occurrence, cut at word boundaries, for the
// row skeleton PROVENANCE_PRINT prints.
function contextOf(text, index, length) {
  let a = Math.max(0, index - 40);
  let b = Math.min(text.length, index + length + 40);
  while (a > 0 && /\S/.test(text[a - 1])) a--;
  while (b < text.length && /\S/.test(text[b])) b++;
  return text.slice(a, b).trim();
}
const skeletons = [];
function report(lit, s, index) {
  if (process.env.PROVENANCE_PRINT && s.surface !== 'synthetic')
    skeletons.push({
      literal: lit,
      at: [s.where],
      contexts: [contextOf(s.text, index, lit.length)],
    });
  return `${JSON.stringify(lit)} (${where(s)})`;
}

const FRAMING = /\b(?:e\.g\.|for example|for instance|example:|such as)/gi;
const WORD_LIST = /(?:\b[a-z][a-z-]+, ){2,}…/g;
const SHAPE = [
  /\b\d+\s*[- ]?(?:lines?|bars?|verses?|chorus(?:es)?|sections?|syllables?|stanzas?)\b/i,
  /\b(?:lines|bars|sections|lines_per_section|group)\s*(?:<=|>=|=)\s*\d+/i,
];
const BANS =
  /\b(?:clich[eé]s?|banned words?|forbidden words?|avoid (?:the |these )?words?|never use (?:the |these )?words?|word ?list)\b/i;

// The literals #629 (eb679a94b5) removed from connector text. A regression pin
// on that removal, not a word ban: these exact phrases are the ones that went.
const REMOVED_BY_629 = [
  'garage rock fuzz',
  'worn bitter struggling',
  'nylon gut',
  'phosphor bronze',
  'verse,chorus,bridge,outro',
  'lines<=30',
  'group<=4',
  'heart/start',
  'sky/fly',
  'sixty-six',
  'writer: record means the disc',
  'kalevala-alliteration',
  'A:pararhyme,B:skothending',
  'type:rime riche',
  '"mahogany"',
];

// ── the checks, as functions over (strings, registry) ───────────────────────
// They take their inputs so the negative cases below can run them on a
// synthetic corpus with the same code the live checks use.

function framingViolations(list, registry) {
  const bad = [];
  for (const s of unique(list))
    for (const m of s.text.matchAll(FRAMING)) {
      const ok = registry.entries.some(
        (r) =>
          r.category === 'framing' &&
          (r.at || []).includes(s.where) &&
          s.text.slice(m.index, m.index + 160).includes(r.literal) &&
          covered(registry, r.literal, s, s.text.indexOf(r.literal, m.index), ['framing'])
      );
      if (!ok) bad.push(`${where(s)}: …${s.text.slice(m.index, m.index + 90)}…`);
    }
  return bad;
}

function quotedViolations(list, registry) {
  const bad = new Set();
  for (const s of unique(list))
    for (const m of s.text.matchAll(QUOTED)) {
      const raw = m[1] ?? m[2] ?? m[3];
      const lit = raw.trim();
      const index = m.index + 1 + raw.indexOf(lit);
      if (!lit || mechanical(lit, s.text) || covered(registry, lit, s, index)) continue;
      bad.add(report(lit, s, index));
    }
  return [...bad];
}

function wordListViolations(list, registry) {
  const bad = [];
  for (const s of unique(list))
    for (const m of s.text.matchAll(WORD_LIST)) {
      let offset = m.index;
      for (const item of m[0].split(', ')) {
        const at = s.text.indexOf(item, offset);
        offset = at + item.length;
        if (!item || item === '…' || vocabulary.has(item)) continue;
        if (!covered(registry, item, s, at, ['pending-removal'])) bad.push(report(item, s, at));
      }
    }
  return bad;
}

// Whole identifier tokens, case-insensitive: punctuation/quotes delimit an id,
// while a longer word, snake_case field or hyphenated id is not a substring hit.
// This is specific to the published description, never to user inputs/results.
const PREFACE_IDS = new Set(C.PREFACE_LEXICON.map((p) => p.id.toLowerCase()));
function prefaceDescriptionViolations(list) {
  const bad = [];
  for (const s of list.filter((s) => s.where === 'search_prefaces description')) {
    const tokens = s.text.toLowerCase().match(/[\p{L}\p{N}_]+(?:-[\p{L}\p{N}_]+)*/gu) || [];
    for (const id of new Set(tokens))
      if (PREFACE_IDS.has(id)) bad.push(`${JSON.stringify(id)} (${where(s)})`);
  }
  return bad;
}

// Where a field or value is declared. A row names the file that produces the
// field (`declared_in: [{file, as}]`) and the role it has there: `key` (an
// object or dict key, or an assigned property) or `value` (a compared,
// assigned or enumerated string). Only that file is read, never a test file:
// a word quoted somewhere in the codebase — a fixture's "love", a test's
// "river" — is not evidence that it is a field.
const ROOT = new URL('../', import.meta.url);
function declaredIn(lit, { file, as, field }) {
  if (typeof file !== 'string' || !/^(?:mcp|lyric-harness)\/[\w./-]+\.(?:js|mjs|py)$/.test(file))
    return `declared_in names no source file (${JSON.stringify(file)})`;
  if (/(?:^|\/)test_[^/]*$/.test(file)) return `declared_in names a test file (${file})`;
  let src;
  try {
    src = readFileSync(new URL(file, ROOT), 'utf8');
  } catch {
    return `declared_in names a missing file (${file})`;
  }
  const e = lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re =
    as === 'key'
      ? new RegExp(
          `(['"])${e}\\1\\s*:|(?:^|[\\s{,])${e}\\s*:(?!:)|\\.${e}\\s*=(?!=)|\\[(['"])${e}\\2\\]\\s*=(?!=)`,
          'm'
        )
      : as === 'value'
        ? new RegExp(`(?:===?|!==?|:|=|\\bin\\s*\\[|,|\\[)\\s*(['"])${e}\\1`)
        : null;
  if (!re) return `declared_in.as is ${JSON.stringify(as)}, not key or value`;
  if (as !== 'value') return re.test(src) ? null : `is not declared as a ${as} in ${file}`;
  // A value is checked as a value OF a named field: the quoted literal must
  // sit on, or within a few lines after, a line naming that field. Without
  // it, a file's demo strings ("rain", "day" in lyric_harness.py) qualified.
  if (typeof field !== 'string' || !/^[A-Za-z_][\w.]*$/.test(field))
    return `declared_in names no field for the value (as: "value" needs field)`;
  const lines = src.split('\n');
  const fieldRe = new RegExp(`\\b${field.replace(/[.]/g, '\\.')}\\b`);
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    for (let j = Math.max(0, i - 8); j <= i; j++) if (fieldRe.test(lines[j])) return null;
  }
  return `is not declared as a value of ${field} in ${file}`;
}

const CATEGORIES = new Set([
  'framing',
  'field-or-value',
  'placeholder',
  'pending-removal',
  'quoted-check',
]);
function registryProblems(list, registry) {
  const bad = [];
  const prefaces = new Set((C.PREFACE_LEXICON || []).map((p) => p.id));
  const all = unique(list);
  for (const e of registry.entries) {
    const tag = JSON.stringify(e.literal);
    const fail = (why) => bad.push(`${tag}: ${why}`);
    if (!CATEGORIES.has(e.category))
      fail(`category ${e.category} is not one of ${[...CATEGORIES]}`);
    if (!(typeof e.reason === 'string' && e.reason.length > 10)) fail('needs a reason');
    if (!Array.isArray(e.at) || !e.at.length) fail('names no location (`at`)');
    if (!Array.isArray(e.contexts) || !e.contexts.length) fail('names no reviewed context');
    for (const ctx of e.contexts || []) {
      if (!ctx.includes(e.literal))
        fail(`context ${JSON.stringify(ctx)} does not hold the literal`);
      if (!all.some((s) => (e.at || []).includes(s.where) && s.text.includes(ctx)))
        fail(
          `context ${JSON.stringify(ctx)} is no longer at ${JSON.stringify(e.at)} — remove or update the row`
        );
    }
    if (REMOVED_BY_629.some((r) => e.literal.includes(r.replaceAll('"', ''))))
      fail('#629 removed this; it cannot be re-admitted');
    if (e.category === 'framing' && !PLACEHOLDER.test(e.literal))
      fail('a framing row holds no placeholder');
    if (e.category === 'field-or-value') {
      if (!/^[a-z_][a-z0-9_.]*$/.test(e.literal)) fail('a field or value is an identifier');
      const where = Array.isArray(e.declared_in) ? e.declared_in : [];
      if (!where.length) fail('names no declaring source (`declared_in`)');
      for (const d of where) {
        const why = declaredIn(e.literal, d);
        if (why) fail(why);
      }
    }
    if (e.category === 'placeholder' && !PLACEHOLDER.test(e.literal))
      fail('a placeholder row holds no placeholder');
    if (e.category === 'pending-removal') {
      // Pre-existing text the team has decided should go, kept green only
      // until the text PR removes it.
      if (!prefaces.has(e.literal)) fail('not a real catalog id');
      if (!/^#\d+/.test(String(e.tracked || ''))) fail('names no issue tracking its removal');
    }
    if (e.category === 'quoted-check') {
      // A phrase the engine quotes to name one of its own checks or failure
      // modes: its reviewed context holds the code or field it explains.
      if (!e.about) fail('a quoted check names what it is about');
      else if (
        !(e.contexts || []).every((c) =>
          c.split(e.literal).join(' ').toLowerCase().includes(e.about.toLowerCase())
        )
      )
        fail(`a reviewed context does not hold ${JSON.stringify(e.about)}`);
    }
  }
  return bad;
}

// ── the contract ────────────────────────────────────────────────────────────

test('every surface was read (no vacuous pass)', () => {
  for (const [label, [got, want]] of Object.entries(counts))
    assert.equal(got, want, `${label} lists ${got} tools, expected ${want}`);
  assert.equal(
    strings.filter((s) => s.surface.startsWith('chat system')).length,
    CHAT_STATES.length
  );
  for (const s of strings.filter(
    (x) => x.where === 'instructions' || x.where === 'systemInstruction'
  ))
    assert.ok(s.text.length > 200, `${where(s)} is nearly empty`);
});

test('1. no example framing except reviewed, placeholder-only fragments', () => {
  assert.deepEqual(framingViolations(strings, REGISTRY), [], 'example framing reached a model');
});

test('2. every quoted literal is mechanical or a reviewed occurrence', () => {
  assert.deepEqual(
    quotedViolations(strings, REGISTRY),
    [],
    'quoted literal with no provenance — fix the text, or add a reviewed row (PROVENANCE_PRINT=1 prints one)'
  );
});

test('3. an unquoted "a, b, c, …" list of words is covered by reviewed rows', () => {
  assert.deepEqual(
    wordListViolations(strings, REGISTRY),
    [],
    'a list of example words reached a model'
  );
});

test('4. no numeric song shape is stated', () => {
  const bad = [];
  for (const s of unique())
    for (const re of SHAPE) {
      const m = s.text.match(re);
      if (m) bad.push(`${where(s)}: ${m[0]}`);
    }
  assert.deepEqual(bad, [], 'a line count or shape was stated to a model');
});

test('5. a stated default form is DEFAULT_FORM, and that is open', () => {
  assert.equal(
    DEFAULT_FORM,
    'open',
    'the undeclared form must be open (no unrequested verse-chorus)'
  );
  const re = new RegExp(
    `\\bdefaults?(?:\\s+(?:form\\s+)?(?:is|to|of))?:?\\s+[\`'"]?(${PLAN_FORMS.map((f) => f.replace('-', '\\-')).join('|')})\\b`,
    'gi'
  );
  const said = [];
  for (const s of unique()) for (const m of s.text.matchAll(re)) said.push([m[1], where(s)]);
  assert.ok(said.length > 0, 'no surface states the default form; this check reads nothing');
  for (const [form, at] of said) assert.equal(form, DEFAULT_FORM, `${at} states default ${form}`);
});

test('6. no word list or ban is stated to the writer (#627)', () => {
  const bad = unique()
    .filter((s) => BANS.test(s.text))
    .map((s) => `${where(s)}: ${s.text.match(BANS)[0]}`);
  assert.deepEqual(bad, []);
});

test('7. nothing #629 removed comes back', () => {
  const bad = [];
  for (const s of unique())
    for (const lit of REMOVED_BY_629) if (s.text.includes(lit)) bad.push(`${lit} in ${where(s)}`);
  assert.deepEqual(bad, []);
});

test('8. published search_prefaces descriptions contain no catalog preface ids', () => {
  const descriptions = strings.filter((s) => s.where === 'search_prefaces description');
  assert.deepEqual(
    descriptions.map((s) => s.surface).sort(),
    [
      'raw engine (stdio)',
      'raw /mcp/recipe',
      "website chat's server",
      '/mcp',
      '/mcp/chatgpt',
      '/mcp/chatgpt/recipe',
    ].sort(),
    'every recipe-capable surface must publish the description'
  );
  assert.ok(PREFACE_IDS.size > 0, 'the real preface catalog was loaded');
  for (const s of descriptions) assert.ok(s.text.length > 200, `${where(s)} is nearly empty`);
  assert.deepEqual(
    prefaceDescriptionViolations(descriptions),
    [],
    'a catalog preface id reached a description'
  );
});

test('the description guard catches every catalog id, including quoted and uppercase ids', () => {
  for (const id of PREFACE_IDS) {
    for (const text of [id, `"${id}"`, `(${id.toUpperCase()}).`]) {
      const corpus = [{ surface: 'synthetic', where: 'search_prefaces description', text }];
      assert.equal(prefaceDescriptionViolations(corpus).length, 1, `missed ${text}`);
    }
  }
});

test('the description guard respects identifier boundaries and its published location', () => {
  const id = [...PREFACE_IDS][0];
  assert.ok(id, 'a real id is needed for the controls');
  for (const text of [`prefix${id}suffix`, `field_${id}`, `${id}_field`, `prefix-${id}-suffix`]) {
    assert.deepEqual(
      prefaceDescriptionViolations([
        { surface: 'synthetic', where: 'search_prefaces description', text },
      ]),
      [],
      `substring is not a whole catalog id: ${text}`
    );
  }
  assert.deepEqual(
    prefaceDescriptionViolations([
      { surface: 'synthetic', where: 'search_prefaces result', text: id },
    ]),
    [],
    'catalog results and explicit choices remain legitimate'
  );
});

test('the reviewed list is closed, checkable and current', () => {
  assert.deepEqual(registryProblems(strings, REGISTRY), []);
});

// ── negative cases: a row admits its occurrence, not its word ──────────────
// The same check functions, run on a synthetic corpus. Each case is a way an
// exception could be stretched into new writer guidance (#688 review).

test('a reviewed id does not license the same word in a new sentence', () => {
  // Synthetic historical occurrence: keep proving occurrence scoping after
  // the live examples and their production registry rows have been removed.
  const live = {
    surface: 'synthetic',
    where: 'search_prefaces description',
    text: 'Reviewed prefaces: satirical, keening, brooding, …',
  };
  const registry = {
    entries: ['satirical', 'keening', 'brooding'].map((literal) => ({
      literal,
      category: 'pending-removal',
      at: [live.where],
      contexts: [live.text],
      tracked: '#671',
      reason: 'Synthetic historical occurrence used only to test registry scoping.',
    })),
  };
  assert.deepEqual(registryProblems([live], registry), []);
  assert.equal(wordListViolations([live], { entries: [] }).length, 3, 'the control needs its rows');
  const corpus = [
    live, // the reviewed occurrence stays covered
    {
      surface: 'synthetic',
      where: 'lyric_plan description',
      text: 'Write the song in a "brooding" mood.',
    },
    {
      surface: 'synthetic',
      where: 'search_prefaces description',
      text: 'Write the song in a "brooding" mood.',
    },
    { surface: 'synthetic', where: 'lyric_plan description', text: 'Moods: dark, brooding, …' },
  ];
  assert.deepEqual(wordListViolations([live], registry), [], 'the justified list is covered');
  const quoted = quotedViolations(corpus, registry);
  assert.equal(quoted.length, 2, `both new quoted uses are uncovered: ${quoted}`);
  const listed = wordListViolations(corpus, registry);
  assert.ok(
    listed.some((x) => x.includes('"brooding"') && x.includes('lyric_plan')),
    `${listed}`
  );
});

test('a field-or-value row must name something the code declares', () => {
  const corpus = [
    {
      surface: 'synthetic',
      where: 'lyric_plan description',
      text: 'The song must concern "lighthouses".',
    },
  ];
  const row = {
    literal: 'lighthouses',
    category: 'field-or-value',
    reason: 'An attempt to admit a theme as if it were a result field.',
    at: ['lyric_plan description'],
    contexts: ['The song must concern "lighthouses".'],
    declared_in: [{ file: 'mcp/lyric_tools.js', as: 'key' }],
  };
  const registry = { entries: [...REGISTRY.entries, row] };
  assert.deepEqual(quotedViolations(corpus, registry), [], 'the row would cover it');
  assert.ok(
    registryProblems([...strings, ...corpus], registry).some(
      (x) => x.startsWith('"lighthouses"') && x.includes('is not declared as a key')
    ),
    'but the row itself is refused'
  );
});

test('a word quoted in a test fixture is not a declared field', () => {
  // `love` is quoted in the test suites (a fixture word), which a source-wide
  // search would have taken as a declaration. Neither declaring file works.
  const corpus = [
    {
      surface: 'synthetic',
      where: 'lyric_plan description',
      text: 'The song must concern "love".',
    },
  ];
  const row = (declared_in) => ({
    literal: 'love',
    category: 'field-or-value',
    reason: 'An attempt to admit a theme found in a test fixture.',
    at: ['lyric_plan description'],
    contexts: ['The song must concern "love".'],
    declared_in,
  });
  for (const [declared, why] of [
    [[{ file: 'lyric-harness/quality/test_relations.py', as: 'value' }], 'names a test file'],
    [[{ file: 'mcp/lyric_tools.js', as: 'key' }], 'is not declared as a key'],
    [[{ file: 'mcp/lyric_tools.js', as: 'value' }], 'needs field'],
    [
      [{ file: 'mcp/lyric_tools.js', as: 'value', field: 'measurement_status' }],
      'is not declared as a value of measurement_status',
    ],
    [[], 'names no declaring source'],
  ]) {
    const registry = { entries: [...REGISTRY.entries, row(declared)] };
    assert.deepEqual(quotedViolations(corpus, registry), [], 'the row would cover it');
    const problems = registryProblems([...strings, ...corpus], registry);
    assert.ok(
      problems.some((x) => x.startsWith('"love"') && x.includes(why)),
      `${JSON.stringify(declared)}: expected "${why}" in ${problems}`
    );
  }
});

test('a demo string in a declaring file is not a value of a named field', () => {
  // Jony's residual (#688): lyric_harness.py quotes demo and rhyme words
  // ("rain", "day"). As a bare value they matched; as a value OF a named field
  // they must sit beside that field, and they do not.
  const corpus = [
    {
      surface: 'synthetic',
      where: 'lyric_plan description',
      text: 'The song must concern "rain".',
    },
  ];
  const row = (declared_in) => ({
    literal: 'rain',
    category: 'field-or-value',
    reason: 'An attempt to admit a theme from a demo string in a source file.',
    at: ['lyric_plan description'],
    contexts: ['The song must concern "rain".'],
    declared_in,
  });
  for (const [declared, why] of [
    [[{ file: 'lyric-harness/lyric_harness.py', as: 'value' }], 'needs field'],
    [
      [{ file: 'lyric-harness/lyric_harness.py', as: 'value', field: 'measurement_status' }],
      'is not declared as a value of measurement_status',
    ],
  ]) {
    const registry = { entries: [...REGISTRY.entries, row(declared)] };
    const problems = registryProblems([...strings, ...corpus], registry);
    assert.ok(
      problems.some((x) => x.startsWith('"rain"') && x.includes(why)),
      `${JSON.stringify(declared)}: expected "${why}" in ${problems}`
    );
  }
});

test('a quoted check does not license the same phrase elsewhere', () => {
  const corpus = [
    { surface: 'synthetic', where: 'lyric_grade description', text: 'Stop when it "looks done".' },
  ];
  assert.equal(quotedViolations(corpus, REGISTRY).length, 1);
});

test.after(() => {
  if (!skeletons.length) return;
  const out = JSON.stringify(skeletons, null, 2);
  // PROVENANCE_PRINT=<file> writes the skeletons there; =1 prints them.
  if (process.env.PROVENANCE_PRINT === '1') console.log(out);
  else writeFileSync(process.env.PROVENANCE_PRINT, out + '\n');
});
