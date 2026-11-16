// A MESSAGE THE CONNECTOR CAN SEND NAMES A FIELD THE CALLER CAN SEND (stage T).
// A connector caller declares by field, not by command-line flag. So every
// message the grading tool can return on a verb a connector tool runs:
//   1. names no `--flag` the connector builds from a field, unless a row of
//      UNREACHABLE says why no connector call can produce it;
//   2. names in backticks only fields the tool behind that verb accepts,
//      unless it names, by its tool name, another tool that does, or a row of
//      NOT_ADVICE says why the mention is not advice on that verb.
// The fields are read from the published schemas, the flags from the code
// that spells them, and the messages from the harness source with the verbs
// that can produce each (scripts/message_literals.py). A message assembled
// at run time is only as visible to that scan as its fixed parts, so the
// last test sends the real tools well-formed but wrong input and reads what
// comes back. Agreed form: #665 (6921470904, 6921620093).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { LYRIC_TOOL_SCHEMAS } from './lyric_tools.js';
import { buildServer } from './tools.js';

const root = new URL('..', import.meta.url).pathname;
const fieldsOf = (tool) => new Set(Object.keys(LYRIC_TOOL_SCHEMAS[tool]));
const TOOLS = Object.keys(LYRIC_TOOL_SCHEMAS);

// The connector tool each harness verb runs for (mcp/lyric_tools.js).
const VERB_TOOLS = {
  song: ['lyric_grade'],
  brief: ['lyric_check'],
  finish: ['lyric_revise'],
  revise: ['lyric_revise'],
  verify: ['lyric_verify'],
  recover: ['lyric_recover'],
  screen: ['lyric_screen'],
  types: ['lyric_types'],
  plan: ['lyric_plan', 'lyric_sweep'],
};
const CONNECTOR_VERBS = new Set(Object.keys(VERB_TOOLS));

const ALL_FIELDS = new Set(Object.values(LYRIC_TOOL_SCHEMAS).flatMap((s) => Object.keys(s)));
// The flags the connector builds FROM A FIELD: a `--name` spelled anywhere in
// the connector's own code (lyric_tools.js and every module beside it, such
// as lexicon_basis.js) whose name is a published field's (`_` written `-`;
// `wants` is spelled `--want`). The flags it sets on its own (`--out`,
// `--propose`, ...) are not a caller's to send, so a message naming one is
// not this test's question.
const SPELLED = new Set(
  readdirSync(new URL('.', import.meta.url))
    .filter((f) => f.endsWith('.js') && !f.startsWith('test'))
    .flatMap((f) => [
      ...readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').matchAll(
        /['"`]--([a-z][a-z-]+)/g
      ),
    ])
    .map((m) => m[1])
);
const flagOf = (field) => (field === 'wants' ? 'want' : field.replace(/_/g, '-'));
const CONNECTOR_FLAGS = new Set([...ALL_FIELDS].map(flagOf).filter((f) => SPELLED.has(f)));

// Messages that name a connector flag and that no connector call can produce,
// each with the reason. Matched by a phrase of the message, not its line.
const ON_ACCEPTING = 'the connector sends this flag only to the verbs that take it';
const TYPED = "the connector's schema types the field, so the harness never gets this value";
const LIST =
  'the list of known flags in the unknown-flag refusal; the connector sends none it does not know';
const UNREACHABLE = [
  { phrase: '--pronunciations is supported on song', reason: ON_ACCEPTING },
  { phrase: '--numbering applies to groups and returns', reason: ON_ACCEPTING },
  {
    phrase: 'no `--position=` was declared',
    reason: 'lyric_types always sends a position, `end` by default',
  },
  { phrase: 'plan --lines takes an integer', reason: TYPED },
  {
    phrase: 'plan takes --seed OR --sweep',
    reason: 'lyric_plan sends a seed and lyric_sweep a range, never both',
  },
  {
    phrase: 'a sweep returns SEEDS and no plan',
    reason: 'lyric_sweep never sends --fill or --out',
  },
  { phrase: 'plan --seed and --lines take integers', reason: TYPED },
  {
    phrase: 're-derives the plan from --seed',
    reason: 'refuses mandate flags the connector never sends to finish',
  },
  {
    phrase: 'declare a different shape by declaring a different plan',
    reason: 'the same refusal; finish takes the shape off the plan',
  },
  { phrase: 'finish --seed and --lines take integers', reason: TYPED },
  {
    phrase: 'silence it with --relation',
    reason: 'refuses a --relations the connector never sends to finish',
  },
  { phrase: 'finish requires --seed=N', reason: 'lyric_revise always sends finish a seed' },
  {
    phrase: 'a loop that may run no round at all',
    reason: `${TYPED}: max_rounds has a minimum of 1`,
  },
  { phrase: 'a negative attempt count', reason: `${TYPED}: attempts has a minimum of 0` },
  { phrase: 'a negative width declares nothing', reason: `${TYPED}: backtrack has a minimum of 0` },
  { phrase: '--max-rounds, --attempts and --backtrack take integers', reason: TYPED },
  {
    phrase: 'was declared and no --blueprint was',
    reason: 'lyric_grade sends the blueprint its plan made, with its subdivision',
  },
  { phrase: 'declare `--blueprint=B` too', reason: 'the same refusal as the line above it' },
  {
    phrase: 'a space-separated `--propose stub`',
    reason: 'the connector spells --propose itself, with `=`',
  },
  { phrase: '--blueprint=B', reason: LIST },
  { phrase: '--subdivision N', reason: LIST },
  { phrase: '--structures=LABEL:NAME', reason: LIST },
  { phrase: '--group-types=JSON', reason: LIST },
  { phrase: '--relation=NAME', reason: LIST },
  {
    phrase: 'hand in --cliques alone',
    reason: 'a command-line spelling the connector never builds (--cliques)',
  },
  {
    phrase: "join groups with ';' inside one --groups=",
    reason: 'refuses a second mandate argument, which the connector never sends',
  },
  {
    phrase: 'not as --blueprint=',
    reason: 'lyric_grade passes its blueprint in place, never as a flag',
  },
  {
    phrase: 'DECLARED by --blueprint=',
    reason: 'the same refusal, which lyric_grade never triggers',
  },
  {
    phrase: 'types W1 -- W2',
    reason: "the types verb's usage line, printed for a malformed command line",
  },
  {
    phrase: 'or: plan --sweep=LO-HI',
    reason: "the plan verb's usage line, printed for a malformed command line",
  },
  {
    phrase: 'the same shape `--fallback=bogus` already holds',
    reason: 'refuses a --propose value; the connector spells --propose itself',
  },
  {
    phrase: 'the same way `--subdivision` does',
    reason: 'refuses a --propose=call: spelling; the connector spells --propose itself',
  },
  {
    phrase: "--fallback wants 'high' or 'low'",
    reason: `${TYPED}: lyric_tools.js sends --fallback only as high or low`,
  },
  {
    phrase: 'declare one --lexicon-supplement',
    reason: 'refuses a second --lexicon-supplement; the connector sends one',
  },
  {
    phrase: 'use one --pronunciations=<JSON> declaration',
    reason: 'refuses a second --pronunciations; the connector sends one',
  },
  {
    phrase: 'use one --numbering=',
    reason: 'refuses a second --numbering; the connector sends one',
  },
  {
    phrase: 'this runner has no flag',
    reason: "quality/recover.py's own command line, which the connector never runs",
  },
];

// A field named where its verb's tool does not take it, and why that mention
// is not advice to a caller of that verb. Scoped to the verbs it names.
const PLAN_MANDATE =
  'lyric_grade and a seeded lyric_revise take the mandate off the plan, which writes it well-formed, so this refusal of a malformed one cannot reach their callers';
const NOT_ADVICE = [
  {
    phrase: 'declare the whole mandate as `groups`',
    verbs: ['song', 'finish'],
    reason: PLAN_MANDATE,
  },
  {
    phrase: 'was handed in with no groups to annotate',
    verbs: ['song', 'finish'],
    reason: PLAN_MANDATE,
  },
  { phrase: '`group_types` names group', verbs: ['song', 'finish'], reason: PLAN_MANDATE },
  {
    phrase: 'a group is numbered by its place in',
    verbs: ['song', 'finish'],
    reason: PLAN_MANDATE,
  },
  { phrase: '`structures` entry', verbs: ['song', 'finish'], reason: PLAN_MANDATE },
  {
    phrase: 'declared (`groups`)',
    verbs: ['song', 'finish'],
    reason:
      'a provenance label printed for a mandate the caller sent; on these two verbs the plan sent it',
  },
  {
    phrase: '`subdivision` declared to brief, verify or revise',
    verbs: ['song', 'finish'],
    reason: 'the provenance of a subdivision; on these two verbs it comes off the plan',
  },
  {
    phrase: 'DECLARED  `blueprint`',
    verbs: ['song', 'finish'],
    reason: 'labels a blueprint the caller sent; on these two verbs it comes off the plan',
  },
];

const literals = () =>
  JSON.parse(
    execFileSync('python3', ['-I', '-W', 'ignore', 'scripts/message_literals.py', root], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  );
const isUsage = (text) => /\busage\b/i.test(text);
// Argument-parsing constants (`'--lines='`), not sentences.
const isToken = (text) => /^\s*(--[a-z][a-z-]*(=(\{\})?)?\s*)+$/.test(text);
// A shell command the connector itself rewrites into the tool's name
// (publishedReport in lyric_tools.js) before a caller reads it.
const isCommand = (text) => /^\s*(NEXT: )?python3 lyric_harness\.py /.test(text);
const flagsIn = (text) =>
  [...text.matchAll(/--([a-z][a-z-]+)/g)].map((m) => m[1]).filter((f) => CONNECTOR_FLAGS.has(f));
const reachable = (row) => row.verbs.includes('*') || row.verbs.some((v) => CONNECTOR_VERBS.has(v));

function flagFindings(rows) {
  const out = [];
  for (const row of rows) {
    if (!reachable(row) || isUsage(row.text) || isToken(row.text) || isCommand(row.text)) continue;
    const flags = flagsIn(row.text);
    if (flags.length && !UNREACHABLE.find((r) => row.text.includes(r.phrase)))
      out.push(
        `${row.file}:${row.line} [${row.verbs}] --${flags.join(', --')}: ${row.text.slice(0, 90)}`
      );
  }
  return out;
}

function fieldFindings(rows) {
  const out = [];
  for (const row of rows) {
    if (row.verbs.includes('*')) continue; // which tool sends it is not known here
    const named = [...row.text.matchAll(/`([a-z_]+)`/g)]
      .map((m) => m[1])
      .filter((n) => ALL_FIELDS.has(n));
    if (!named.length) continue;
    // A target counts only when named as a tool, never by an ordinary word.
    const targets = TOOLS.filter((t) => new RegExp(`\\b${t}\\b`).test(row.text));
    for (const field of named)
      for (const verb of row.verbs.filter((v) => CONNECTOR_VERBS.has(v)))
        for (const tool of VERB_TOOLS[verb]) {
          if (fieldsOf(tool).has(field) || targets.some((t) => fieldsOf(t).has(field))) continue;
          if (NOT_ADVICE.find((r) => r.verbs.includes(verb) && row.text.includes(r.phrase)))
            continue;
          out.push(`${row.file}:${row.line} [${verb}] \`${field}\` is not a field of ${tool}`);
        }
  }
  return out;
}

test('every exemption has a reason and still matches a message it is needed for', () => {
  const rows = literals();
  for (const row of UNREACHABLE) {
    assert.ok(row.reason && row.reason.length > 20, `${row.phrase}: a reason`);
    const hits = rows.filter((r) => r.text.includes(row.phrase));
    assert.ok(hits.length, `${row.phrase}: still a message`);
    assert.ok(
      hits.some((r) => flagsIn(r.text).length),
      `${row.phrase}: names a connector flag, or it needs no row`
    );
  }
  for (const row of NOT_ADVICE) {
    assert.ok(row.reason && row.reason.length > 20, `${row.phrase}: a reason`);
    assert.ok(
      rows.some((r) => r.text.includes(row.phrase) && row.verbs.some((v) => row.verbs.includes(v))),
      `${row.phrase}: still a message`
    );
  }
});

test('no message a connector verb can send names a flag the connector builds', () => {
  assert.deepEqual(flagFindings(literals()), []);
});

test("a field a message names is one its verb's tool accepts", () => {
  assert.deepEqual(fieldFindings(literals()), []);
});

test('the rules catch planted messages of each kind', () => {
  const planted = [
    {
      file: 'x',
      line: 1,
      verbs: ['song'],
      text: 'declare one with --blueprint= to grade the meter',
    },
    { file: 'x', line: 2, verbs: ['*'], text: 'declare --lexicon-supplement= again' },
    { file: 'x', line: 3, verbs: ['song'], text: 'declare the mandate as `groups`' },
    { file: 'x', line: 4, verbs: ['song'], text: 'declare `groups` with lyric_check' },
    { file: 'x', line: 5, verbs: ['recover'], text: 'check this error and declare `blueprint`' },
    { file: 'x', line: 6, verbs: ['recover'], text: 'declare `blueprint` on lyric_check' },
    { file: 'x', line: 7, verbs: ['recover'], text: 'declare `placements` again' },
  ];
  assert.deepEqual(
    flagFindings(planted).map((f) => f.split(' ')[0]),
    ['x:1', 'x:2']
  );
  assert.deepEqual(
    fieldFindings(planted).map((f) => f.split(' ')[0]),
    ['x:3', 'x:5']
  );
  // A flag built in another connector module is in the set.
  for (const f of ['lexicon-supplement', 'pronunciations', 'want'])
    assert.ok(CONNECTOR_FLAGS.has(f), f);
  // The scanner reads the harness: it finds messages on every connector verb,
  // and a `cmd != X` branch is not attributed to X.
  const rows = literals();
  for (const v of CONNECTOR_VERBS)
    assert.ok(
      rows.some((r) => r.verbs.includes(v)),
      `messages found for ${v}`
    );
  const neq = rows.find((r) =>
    r.text.includes('repair candidate menus are generated when a writer question')
  );
  assert.ok(
    neq && !neq.verbs.includes('brief') && neq.verbs.includes('song'),
    'a cmd != "brief" branch'
  );
});

// RUN TIME. Well-formed calls a caller can send, each wrong in one way that a
// refusal answers. Whatever refuses them, connector or harness, what comes
// back names no flag. Each case must actually be refused, or it tests nothing.
const two = ['Placeholder line one', 'Placeholder line two'];
const CASES = [
  ['lyric_check', { lines: two, scheme: 'AA', returns: '1,2' }],
  ['lyric_check', { lines: two, groups: '1,2', group_types: [{ group: 3, type: 0 }] }],
  ['lyric_check', { lines: two, groups: '1,2', structures: 'nocolon' }],
  [
    'lyric_check',
    { lines: two, groups: '1,2', blueprint: '{"lines": [], "sections": []}', subdivision: 4 },
  ],
  ['lyric_recover', { lines: two, placements: 'nowhere' }],
  ['lyric_screen', { words: ['stove', 'coat'], relation: 'class:NO_SUCH_RELATION' }],
  ['lyric_plan', { seed: 3, melody: 'not a phrase' }],
  ['lyric_plan', { seed: 3, narrative: 'ESTABLISH/BUT' }],
];
test('the real tools, sent wrong input, answer without a flag', { timeout: 600_000 }, async () => {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'flag-free', version: '1' }, { capabilities: {} });
  await client.connect(b);
  try {
    for (const [name, args] of CASES) {
      const r = await client.callTool({ name, arguments: args });
      const text = r.content.map((x) => x.text || '').join('\n');
      const exit = /"exit_code":\s*(\d+)/.exec(text)?.[1];
      assert.ok(
        r.isError || (exit != null && exit !== '0'),
        `${name} ${JSON.stringify(args)} is refused: ${text.slice(0, 200)}`
      );
      assert.deepEqual(flagsIn(text), [], `${name} ${JSON.stringify(args)}: ${text.slice(0, 300)}`);
    }
  } finally {
    await client.close();
    await server.close();
  }
});
