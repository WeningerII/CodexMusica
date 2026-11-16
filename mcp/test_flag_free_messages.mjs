// A MESSAGE THE CONNECTOR CAN SEND NAMES A FIELD THE CALLER CAN SEND (stage T).
// A connector caller declares by field, not by command-line flag. So every
// message the grading tool can return on a verb a connector tool runs:
//   1. names no `--flag` the connector builds from a field, unless a row of
//      UNREACHABLE says why no connector call can produce it;
//   2. names in backticks only fields the tool behind that verb accepts in
//      that mode, unless it sends the caller to another tool that does
//      ("on lyric_check", "(lyric_check, lyric_revise or lyric_verify)"), or
//      a row of NOT_ADVICE says why the mention is not advice on that verb.
// The fields are read from the published schemas, the flags from the code
// that spells them, and the messages from the harness source with the verbs
// that can produce each (scripts/message_literals.py). A message assembled
// at run time is only as visible to that scan as its fixed parts, so the
// run-time test sends the real tools well-formed but wrong input and reads
// what comes back. Agreed form: #665 (6921470904, 6921620093).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { LYRIC_TOOL_SCHEMAS } from './lyric_tools.js';
import { buildServer } from './tools.js';

const root = new URL('..', import.meta.url).pathname;
const TOOLS = Object.keys(LYRIC_TOOL_SCHEMAS);
const fieldsOf = (tool) => new Set(Object.keys(LYRIC_TOOL_SCHEMAS[tool]));

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
const CONNECTOR_VERBS = Object.keys(VERB_TOOLS);
// A seeded lyric_revise (`finish`) refuses these and takes them off the plan
// (lyric_tools.js: "a seeded run takes its mandate and its blueprint OFF THE
// PLAN"), so on `finish` the tool does not accept them although its schema
// lists them for a pasted song.
const SEEDED_REFUSED = new Set([
  'scheme',
  'groups',
  'returns',
  'numbering',
  'structures',
  'blueprint',
  'subdivision',
]);
const accepts = (verb, tool, field) =>
  fieldsOf(tool).has(field) && !(verb === 'finish' && SEEDED_REFUSED.has(field));

const ALL_FIELDS = new Set(Object.values(LYRIC_TOOL_SCHEMAS).flatMap((s) => Object.keys(s)));
// The flags the connector builds FROM A FIELD: a `--name` spelled anywhere in
// the connector's own code (lyric_tools.js and every module beside it, such
// as lexicon_basis.js) whose name is a published field's (`_` written `-`;
// `wants` is spelled `--want`). The flags it sets on its own (`--out`,
// `--propose`, ...) are not a caller's to send, so a message naming one is
// not this test's question.
const FLAG = /--([a-z][a-z0-9-]*)/g;
const SPELLED = new Set(
  readdirSync(new URL('.', import.meta.url))
    .filter((f) => f.endsWith('.js') && !f.startsWith('test'))
    .flatMap((f) => [
      ...readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').matchAll(
        /['"`]--([a-z][a-z0-9-]*)/g
      ),
    ])
    .map((m) => m[1])
);
const flagOf = (field) => (field === 'wants' ? 'want' : field.replace(/_/g, '-'));
const CONNECTOR_FLAGS = new Set([...ALL_FIELDS].map(flagOf).filter((f) => SPELLED.has(f)));
const flagsIn = (text) =>
  [...text.matchAll(FLAG)].map((m) => m[1]).filter((f) => CONNECTOR_FLAGS.has(f));

// Messages that name a connector flag and that no connector call can produce,
// each with the reason. A row matches a message containing its phrase (or
// equal to it, with `exact`), and exempts only the flags its phrase names, or
// those in `flags` when the phrase names none.
const ON_ACCEPTING = 'the connector sends this flag only to the verbs that take it';
const TYPED = "the connector's schema types the field, so the harness never gets this value";
const LIST =
  'one entry in the list of known flags of the unknown-flag refusal; the connector sends no flag it does not know';
const USAGE = 'a usage line, printed for a malformed command line the connector never builds';
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
    phrase: 'run `plan --seed=N` on one',
    reason: 'lyric_sweep never sends --fill or --out, the refusal this ends',
  },
  { phrase: 'plan --seed and --lines take integers', reason: TYPED },
  {
    phrase: 're-derives the plan from --seed',
    reason: 'refuses mandate flags the connector never sends to finish',
  },
  {
    phrase: 'declare a different shape by declaring a different plan',
    flags: ['form', 'lines', 'relation', 'group-types', 'functions', 'title', 'narrative'],
    reason: 'the same refusal; finish takes the shape off the plan',
  },
  { phrase: 'finish --seed and --lines take integers', reason: TYPED },
  {
    phrase: 'silence it with --relation',
    reason: 'refuses a --relations the connector never sends to finish',
  },
  { phrase: 'finish requires --seed=N', reason: 'lyric_revise always sends finish a seed' },
  { phrase: '--max-rounds={} — a loop', reason: `${TYPED}: max_rounds has a minimum of 1` },
  { phrase: '--attempts={} — a negative', reason: `${TYPED}: attempts has a minimum of 0` },
  { phrase: '--backtrack={} — a negative', reason: `${TYPED}: backtrack has a minimum of 0` },
  { phrase: '--max-rounds, --attempts and --backtrack take integers', reason: TYPED },
  {
    phrase: 'was declared and no --blueprint was',
    reason:
      'the connector sends --subdivision only beside --blueprint (lyric_tools.js), and lyric_grade sends both off its plan',
  },
  { phrase: 'declare `--blueprint=B` too', reason: 'the same refusal as the line above it' },
  {
    phrase: 'a space-separated `--propose stub`',
    flags: ['fallback'],
    reason: 'the connector spells --propose itself, with `=`',
  },
  { phrase: '--blueprint=B', exact: true, reason: LIST },
  { phrase: '--subdivision N', exact: true, reason: LIST },
  { phrase: '--structures=LABEL:NAME,...', exact: true, reason: LIST },
  { phrase: '--group-types=JSON', exact: true, reason: LIST },
  { phrase: '--relation=NAME', exact: true, reason: LIST },
  {
    phrase: 'hand in --cliques alone',
    flags: ['groups', 'returns'],
    reason: 'refuses a --cliques mandate, which the connector never sends',
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
  { phrase: 'types W1 -- W2', flags: ['position'], reason: USAGE },
  { phrase: 'or: plan --sweep=LO-HI', flags: ['want'], reason: USAGE },
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
    flags: ['placements'],
    reason: "quality/recover.py's own command line, which the connector never runs",
  },
  {
    phrase: '--input-format=literal|source (default: literal):',
    flags: 'all',
    reason:
      "the harness's own --help text (USAGE); the connector never asks for it and sends no malformed command",
  },
  {
    phrase: 'declare one --lexicon-supplement-sha256=<64 hex>',
    reason:
      'the connector sends --lexicon-supplement-sha256 once, in its `=` form (lexicon_basis.js lexiconGlobals)',
  },
  {
    phrase: 'LEXICON_SUPPLEMENT_UNAVAILABLE: --lexicon-supplement-sha256',
    reason:
      'the connector sends the checksum only beside a supplement that is not none (lexicon_basis.js lexiconGlobals)',
  },
];

// A field named where a verb's tool does not take it, and why that mention is
// not advice to a caller of that verb. Scoped to the verbs it names.
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
  { phrase: 'was handed in beside', verbs: ['song', 'finish'], reason: PLAN_MANDATE },
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
  {
    phrase: '`subdivision` wants a positive whole number',
    verbs: CONNECTOR_VERBS,
    reason:
      'refuses the value of the field it names, which only a tool that sends that field can supply',
  },
  {
    phrase: '`melody` requires a valid phrase JSON object',
    verbs: CONNECTOR_VERBS,
    reason:
      'refuses the value of the field it names, which only a tool that sends that field can supply',
  },
  {
    phrase: '`group_types` requires a JSON list',
    verbs: CONNECTOR_VERBS,
    reason:
      'refuses the value of the field it names, which only a tool that sends that field can supply',
  },
  {
    phrase: '`narrative` reads ATOM,ATOM/JUNCTION',
    verbs: CONNECTOR_VERBS,
    reason:
      'refuses the value of the field it names, which only a tool that sends that field can supply',
  },
  {
    phrase: 'so the registry is not searched song-wide',
    verbs: ['recover', 'screen', 'types', 'plan'],
    reason:
      'the candidate-pair wall (relations.realise) is reached only by grading a whole draft; recover counts pairs under its own limit, screen and types judge one pair, plan grades no draft',
  },
  {
    phrase: 'so the registry is not searched song-wide',
    verbs: ['song', 'finish'],
    reason:
      'names a `groups` mandate only as the condition for `group_types`; on these two verbs the plan supplies the mandate',
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
// A usage line, printed for a malformed command line: it starts with `usage:`.
const isUsage = (text) => /^\s*(REFUSED — )?usage:/i.test(text);
// Argument-parsing constants (`'--lines='`), not sentences.
const isToken = (text) => /^\s*(--[a-z][a-z0-9-]*(=(\{\})?)?\s*)+$/.test(text);
// A shell command the connector itself rewrites into the tool's name
// (publishedReport in lyric_tools.js) before a caller reads it.
const isCommand = (text) => /^\s*(NEXT: )?python3 lyric_harness\.py /.test(text);
const verbsOf = (row) =>
  row.verbs.includes('*') ? CONNECTOR_VERBS : row.verbs.filter((v) => v in VERB_TOOLS);
const matches = (rule, text) => (rule.exact ? text === rule.phrase : text.includes(rule.phrase));
const exempted = (rule) =>
  new Set(rule.flags === 'all' ? CONNECTOR_FLAGS : rule.flags || flagsIn(rule.phrase));

function flagFindings(rows) {
  const out = [];
  for (const row of rows) {
    if (!verbsOf(row).length || isUsage(row.text) || isToken(row.text) || isCommand(row.text))
      continue;
    const covered = new Set(
      UNREACHABLE.filter((r) => matches(r, row.text)).flatMap((r) => [...exempted(r)])
    );
    const flags = flagsIn(row.text).filter((f) => !covered.has(f));
    if (flags.length)
      out.push(
        `${row.file}:${row.line} [${row.verbs}] --${flags.join(', --')}: ${row.text.slice(0, 90)}`
      );
  }
  return out;
}

// A tool the message SENDS the caller to: "on/to/with/for/through/use/call
// lyric_x", or a list in parentheses. A tool merely mentioned is no target.
const sendsTo = (text, tool) =>
  new RegExp(
    `(?:\\b(?:on|to|with|for|through|use|call)\\s+|\\()(?:lyric_[a-z]+(?:,\\s*|\\s+(?:and|or)\\s+))*${tool}\\b`
  ).test(text);

function fieldFindings(rows) {
  const out = [];
  for (const row of rows) {
    const named = [...row.text.matchAll(/`([a-z_]+)`/g)]
      .map((m) => m[1])
      .filter((n) => ALL_FIELDS.has(n));
    if (!named.length) continue;
    const targets = TOOLS.filter((t) => sendsTo(row.text, t));
    for (const field of named)
      for (const verb of verbsOf(row))
        for (const tool of VERB_TOOLS[verb]) {
          if (accepts(verb, tool, field) || targets.some((t) => accepts(t, t, field))) continue;
          if (NOT_ADVICE.find((r) => r.verbs.includes(verb) && row.text.includes(r.phrase)))
            continue;
          out.push(
            `${row.file}:${row.line} [${verb}] \`${field}\` is not a field of ${tool}${verb === 'finish' ? ' (seeded)' : ''}`
          );
        }
  }
  return out;
}

test('every exemption has a reason and still matches a message it is needed for', () => {
  const rows = literals();
  for (const rule of UNREACHABLE) {
    assert.ok(rule.reason && rule.reason.length > 20, `${rule.phrase}: a reason`);
    assert.ok(exempted(rule).size, `${rule.phrase}: names the flags it exempts`);
    const hits = rows.filter((r) => matches(rule, r.text));
    assert.ok(hits.length, `${rule.phrase}: still a message`);
    assert.ok(
      hits.some((r) => flagsIn(r.text).some((f) => exempted(rule).has(f))),
      `${rule.phrase}: the message still names a flag it exempts`
    );
  }
  for (const rule of NOT_ADVICE) {
    assert.ok(rule.reason && rule.reason.length > 20, `${rule.phrase}: a reason`);
    assert.ok(
      rows.some(
        (r) => r.text.includes(rule.phrase) && verbsOf(r).some((v) => rule.verbs.includes(v))
      ),
      `${rule.phrase}: still a message on ${rule.verbs}`
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
    { file: 'x', line: 3, verbs: ['song'], text: 'declare it with --blueprint=B on the song' },
    { file: 'x', line: 4, verbs: ['song'], text: 'the usage of --blueprint is wrong' },
    { file: 'x', line: 5, verbs: ['song'], text: 'P6 declare --lexicon-supplement-sha256=abc' },
    { file: 'x', line: 11, verbs: ['song'], text: 'declare the mandate as `groups`' },
    { file: 'x', line: 12, verbs: ['song'], text: 'declare `groups` with lyric_check' },
    { file: 'x', line: 13, verbs: ['recover'], text: 'check this error and declare `blueprint`' },
    { file: 'x', line: 14, verbs: ['recover'], text: 'declare `blueprint` on lyric_check' },
    { file: 'x', line: 15, verbs: ['recover'], text: 'declare `placements` again' },
    {
      file: 'x',
      line: 16,
      verbs: ['song'],
      text: 'lyric_check refused `numbering`; on song declare it another way',
    },
    { file: 'x', line: 17, verbs: ['finish'], text: 'declare `groups` again' },
    { file: 'x', line: 18, verbs: ['revise'], text: 'declare `groups` again' },
    { file: 'x', line: 19, verbs: ['*'], text: 'declare `placements` again' },
  ];
  assert.deepEqual(
    flagFindings(planted).map((f) => f.split(' ')[0]),
    ['x:1', 'x:2', 'x:3', 'x:4', 'x:5']
  );
  const fields = fieldFindings(planted).map((f) => f.split(' ')[0]);
  for (const hit of ['x:11', 'x:13', 'x:16', 'x:17', 'x:19']) assert.ok(fields.includes(hit), hit);
  for (const ok of ['x:12', 'x:14', 'x:15', 'x:18']) assert.ok(!fields.includes(ok), ok);
  // A flag built in another connector module, and one with a digit, are in the set.
  for (const f of ['lexicon-supplement', 'lexicon-supplement-sha256', 'pronunciations', 'want'])
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
// The planner's own refusals (quality/plan.py) still name flags. That file is
// Andrej's under the planner-file rule, and he rewords these after stage 3
// (#665, 6921620093); until then they are listed here, run, and reported.
const PLANNER_CASES = [
  ['lyric_plan', { seed: 3, functions: 'nosuchfn' }],
  ['lyric_sweep', { seed_from: 1, count: 2, functions: 'nosuchfn' }],
  ['lyric_plan', { seed: 3, form: 'verse-chorus', functions: 'verse' }],
  ['lyric_plan', { seed: 3, relation: 'class:NO_SUCH_RELATION' }],
];

async function realClient() {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'flag-free', version: '1' }, { capabilities: {} });
  await client.connect(b);
  return { client, close: async () => (await client.close(), await server.close()) };
}
async function refusedWithoutFlag(client, cases) {
  for (const [name, args] of cases) {
    const r = await client.callTool({ name, arguments: args });
    const text = r.content.map((x) => x.text || '').join('\n');
    const exit = /"exit_code":\s*(\d+)/.exec(text)?.[1];
    const what = `${name} ${JSON.stringify(args)}`;
    assert.ok(
      r.isError || (exit != null && exit !== '0'),
      `${what} is refused: ${text.slice(0, 200)}`
    );
    assert.deepEqual(flagsIn(text), [], `${what}: ${text.slice(0, 300)}`);
  }
}

test('the real tools, sent wrong input, answer without a flag', { timeout: 600_000 }, async () => {
  const { client, close } = await realClient();
  try {
    await refusedWithoutFlag(client, CASES);
  } finally {
    await close();
  }
});

test(
  "the planner's refusals, sent wrong input, answer without a flag",
  {
    timeout: 600_000,
    todo: "quality/plan.py's messages: Andrej rewords them after stage 3 (planner-file rule)",
  },
  async () => {
    const { client, close } = await realClient();
    try {
      await refusedWithoutFlag(client, PLANNER_CASES);
    } finally {
      await close();
    }
  }
);
