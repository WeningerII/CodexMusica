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
//      enum value, a CODE, or text with no words in it — or it is in the
//      reviewed list with a category the test itself can check.
//   3. An unquoted "a, b, c, …" list of words is in the reviewed list.
//   4. No numeric song shape ("N lines", "lines<=N", …) is stated.
//   5. A stated default form is DEFAULT_FORM, and DEFAULT_FORM is `open`.
//   6. No word list or ban is stated to the writer (#627).
//   7. Nothing #629 removed comes back, anywhere in this text.
//
// THE REVIEWED LIST (mcp/fixtures/model_visible_provenance.json) records what
// is admitted under 1–3. It is NOT a way back in for genre, theme or lyric
// examples (#671 safeguard 3): the categories are closed, each is checked here
// (an id must resolve, a field must be an identifier, a placeholder must hold
// one), every entry must still occur in the text it was admitted for, and the
// #629 removals may not be entered at all. A new system-authored theme fails
// this test; it cannot be fixed by adding a row.
//
// A FAILURE MEANS model-visible text changed in a way this contract asks a
// person to look at. Fix the text, or — for a genuinely mechanical literal —
// add a row with its category and reason, and let review see the row.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  ['recipe, customize', null, null, { domain: 'recipe', phase: 'customize' }],
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
  ['lyrics, review', null, new Set(), { domain: 'lyrics', lyric_context: { intent: 'review' } }],
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
const unique = () => {
  const by = new Map();
  for (const s of strings) if (!by.has(s.text)) by.set(s.text, s);
  return [...by.values()];
};
const rows = (category) => REGISTRY.entries.filter((e) => e.category === category);

// A quoted literal: "…", '…' or `…`, where a single quote is not an apostrophe
// (no letter immediately outside it).
const QUOTED = /"([^"\n]{1,80})"|(?<![A-Za-z])'([^'\n]{1,80})'(?![A-Za-z])|`([^`\n]{1,80})`/g;
const PLACEHOLDER = /<[^<>]+>|\b[A-Z]\b|…/;
const mechanical = (lit, text = '') =>
  vocabulary.has(lit) ||
  /^[a-z][a-z0-9]*(?:[_.][a-z0-9]+)+(?:: true)?$/.test(lit) || // a field: snake_case or dotted
  text.includes(`"${lit}":`) || // a key in JSON shown to the model
  text.includes(`:"${lit}"`) || // a value in JSON shown to the model
  text.includes(`{"${lit}"`) || // a member of a JSON shape shown to the model
  text.includes(`,"${lit}"`) ||
  /^[A-Z][A-Z0-9_]+$/.test(lit) || // a CODE
  !/[a-z]{3,}/.test(lit) || // no word in it: '4/4', '=', '#', '<id>'
  (PLACEHOLDER.test(lit) && lit.split(/[^a-z]+/).every((w) => w.length < 3 || vocabulary.has(w)));

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
  const ok = rows('framing');
  for (const e of ok)
    assert.ok(
      PLACEHOLDER.test(e.literal),
      `framing row ${JSON.stringify(e.literal)} holds no placeholder`
    );
  const bad = [];
  for (const s of unique())
    for (const m of s.text.matchAll(FRAMING)) {
      const window = s.text.slice(m.index, m.index + 160);
      if (!ok.some((e) => window.includes(e.literal)))
        bad.push(`${where(s)}: …${window.slice(0, 90)}…`);
    }
  assert.deepEqual(bad, [], 'example framing reached a model');
});

test('2. every quoted literal is mechanical or reviewed', () => {
  const reviewed = new Set(REGISTRY.entries.map((e) => e.literal));
  const bad = new Map();
  for (const s of unique())
    for (const m of s.text.matchAll(QUOTED)) {
      const lit = (m[1] ?? m[2] ?? m[3]).trim();
      if (!lit || mechanical(lit, s.text) || reviewed.has(lit)) continue;
      if (!bad.has(lit)) bad.set(lit, where(s));
    }
  assert.deepEqual(
    [...bad].map(([lit, at]) => `${JSON.stringify(lit)} (${at})`),
    [],
    'quoted literal with no provenance — fix the text, or add a reviewed row'
  );
});

test('3. an unquoted "a, b, c, …" list of words is reviewed', () => {
  const ok = rows('catalog-id').map((e) => e.literal);
  const bad = [];
  for (const s of unique())
    for (const m of s.text.matchAll(WORD_LIST)) {
      const items = m[0].split(/,\s*/).filter((w) => w && w !== '…');
      const loose = items.filter((w) => !vocabulary.has(w) && !ok.includes(w));
      if (loose.length) bad.push(`${where(s)}: ${m[0]}`);
    }
  assert.deepEqual(bad, [], 'a list of example words reached a model');
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
    `\\bdefault:?\\s+(${PLAN_FORMS.map((f) => f.replace('-', '\\-')).join('|')})\\b`,
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

test('the reviewed list is closed, checkable and current', () => {
  const CATEGORIES = new Set([
    'framing',
    'field-or-value',
    'placeholder',
    'catalog-id',
    'quoted-check',
  ]);
  const all = unique().map((s) => s.text);
  const prefaces = new Set((C.PREFACE_LEXICON || []).map((p) => p.id));
  for (const e of REGISTRY.entries) {
    const tag = JSON.stringify(e.literal);
    assert.ok(
      CATEGORIES.has(e.category),
      `${tag}: category ${e.category} is not one of ${[...CATEGORIES]}`
    );
    assert.ok(typeof e.reason === 'string' && e.reason.length > 10, `${tag}: needs a reason`);
    assert.ok(
      all.some((t) => t.includes(e.literal)),
      `${tag}: no longer in any model-visible text — remove the row`
    );
    assert.ok(
      !REMOVED_BY_629.some((r) => e.literal.includes(r.replaceAll('"', ''))),
      `${tag}: #629 removed this; it cannot be re-admitted`
    );
    if (e.category === 'field-or-value')
      assert.match(e.literal, /^[a-z_][a-z0-9_.]*$/, `${tag}: a field or value is an identifier`);
    if (e.category === 'placeholder')
      assert.ok(PLACEHOLDER.test(e.literal), `${tag}: a placeholder row holds no placeholder`);
    if (e.category === 'catalog-id')
      assert.ok(prefaces.has(e.literal), `${tag}: not a real catalog id`);
    if (e.category === 'quoted-check') {
      // A phrase the engine quotes to name one of its own checks or failure
      // modes: it must sit beside the code or field it explains, in the same
      // string, so it cannot drift into free-standing example text.
      assert.ok(e.about, `${tag}: a quoted check names what it is about`);
      assert.ok(
        all.some((t) => t.includes(e.literal) && t.includes(e.about)),
        `${tag}: never appears beside ${JSON.stringify(e.about)}`
      );
    }
  }
});
