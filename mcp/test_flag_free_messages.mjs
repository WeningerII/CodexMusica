// A MESSAGE THE CONNECTOR CAN SEND NAMES A FIELD THE CALLER CAN SEND (stage T).
// A connector caller declares by field, not by command-line flag. So every
// message the grading tool can return on a verb a connector tool runs:
//   1. names no `--flag` the connector builds from a field, unless a row of
//      UNREACHABLE says why no connector call can produce it;
//   2. names in backticks only fields the tool behind that verb accepts, or
//      also names a verb whose tool does.
// The fields are read from the published schemas, the flags from the code
// that spells them, and the messages from the harness source with the verb
// that produces each (scripts/message_literals.py). Agreed form: #665.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { LYRIC_TOOL_SCHEMAS } from './lyric_tools.js';

const root = new URL('..', import.meta.url).pathname;
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
// The words a message may use to name another verb, and that verb's tools.
const VERB_WORDS = {
  check: ['lyric_check'],
  brief: ['lyric_check'],
  grade: ['lyric_grade'],
  revise: ['lyric_revise'],
  verify: ['lyric_verify'],
  recover: ['lyric_recover'],
  plan: ['lyric_plan'],
  sweep: ['lyric_sweep'],
};

const ALL_FIELDS = new Set(Object.values(LYRIC_TOOL_SCHEMAS).flatMap((s) => Object.keys(s)));
// The flags the connector builds FROM A FIELD: a `--name` the tool code spells
// whose name is a published field's (`_` written `-`; `wants` is spelled
// `--want`). The flags it sets on its own (`--out`, `--propose`, ...) are not
// a caller's to send, so a message naming one is not this test's question.
const SPELLED = new Set(
  [
    ...readFileSync(new URL('./lyric_tools.js', import.meta.url), 'utf8').matchAll(
      /`--([a-z][a-z-]+)/g
    ),
  ].map((m) => m[1])
);
const CONNECTOR_FLAGS = new Set(
  [...ALL_FIELDS]
    .map((f) => (f === 'wants' ? 'want' : f.replace(/_/g, '-')))
    .filter((f) => SPELLED.has(f))
);

// Messages that name a connector flag and that no connector call can produce,
// each with the reason. Matched by a phrase of the message, not its line.
const ON_ACCEPTING = 'the connector sends this flag only to the verbs that take it';
const TYPED = "the connector's schema types the field, so the harness never gets this value";
const CLI_ONLY = 'a command-line spelling the connector never builds';
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
    phrase: 'DECLARED  --blueprint=',
    reason: 'a blueprint sent both as a flag and in place; the connector sends one',
  },
  {
    phrase: 'a space-separated `--propose stub`',
    reason: 'the connector spells --propose itself, with `=`',
  },
  {
    phrase: '--blueprint=B',
    reason:
      'the list of known flags in the unknown-flag refusal; the connector sends none it does not know',
  },
  {
    phrase: '--subdivision N',
    reason: 'the same list of known flags, which the connector never needs',
  },
  {
    phrase: '--structures=LABEL:NAME',
    reason: 'the same list of known flags, which the connector never needs',
  },
  {
    phrase: '--group-types=JSON',
    reason: 'the same list of known flags, which the connector never needs',
  },
  {
    phrase: '--relation=NAME',
    reason: 'the same list of known flags, which the connector never needs',
  },
  {
    phrase: 'types W1 -- W2',
    reason: "the types verb's usage line, printed for a malformed command line",
  },
  {
    phrase: 'or: plan --sweep=LO-HI',
    reason: "the plan verb's usage line, printed for a malformed command line",
  },
  { phrase: 'hand in --cliques alone', reason: `${CLI_ONLY} (--cliques)` },
  {
    phrase: 'not as --blueprint=',
    reason: 'lyric_grade passes its blueprint in place, never as a flag',
  },
  {
    phrase: 'DECLARED by --blueprint=',
    reason: 'the same refusal, which lyric_grade never triggers',
  },
  {
    phrase: 'silence it with --relation',
    reason: 'refuses a --relations the connector never sends to finish',
  },
  { phrase: 'finish requires --seed=N', reason: 'lyric_revise always sends finish a seed' },
  {
    phrase: "join groups with ';' inside one --groups=",
    reason: 'refuses a second mandate argument, which the connector never sends',
  },
  {
    phrase: 'this runner has no flag',
    reason: "quality/recover.py's own command line, which the connector never runs",
  },
];
// On lyric_grade the mandate and the meter come from the plan, not from the
// caller, and the plan writes them well-formed: a refusal of a malformed one
// cannot reach a grade caller, so naming these fields there is not advice.
const PLAN_CARRIED = new Set(['groups', 'returns', 'structures', 'blueprint', 'subdivision']);

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
const exemption = (text) => UNREACHABLE.find((row) => text.includes(row.phrase));
const toolsOf = (verbs) => [...new Set(verbs.flatMap((v) => VERB_TOOLS[v] || []))];

function flagFindings(rows) {
  const out = [];
  for (const row of rows) {
    if (isUsage(row.text) || isToken(row.text) || isCommand(row.text)) continue;
    const flags = flagsIn(row.text);
    if (flags.length && !exemption(row.text))
      out.push(
        `${row.file}:${row.line} [${row.verbs}] --${flags.join(', --')}: ${row.text.slice(0, 90)}`
      );
  }
  return out;
}

function fieldFindings(rows) {
  const out = [];
  for (const row of rows) {
    const named = [...row.text.matchAll(/`([a-z_]+)`/g)]
      .map((m) => m[1])
      .filter((n) => ALL_FIELDS.has(n));
    if (!named.length) continue;
    const words = Object.keys(VERB_WORDS).filter((w) => new RegExp(`\\b${w}\\b`).test(row.text));
    const alsoNamed = words.flatMap((w) => VERB_WORDS[w]);
    for (const field of named)
      for (const tool of toolsOf(row.verbs))
        if (tool === 'lyric_grade' && PLAN_CARRIED.has(field)) continue;
        else if (!fieldsOf(tool).has(field) && !alsoNamed.some((t) => fieldsOf(t).has(field)))
          out.push(`${row.file}:${row.line} [${row.verbs}] \`${field}\` is not a field of ${tool}`);
  }
  return out;
}

test('every exemption names a connector flag, a reason, and a message that exists', () => {
  const rows = literals();
  for (const row of UNREACHABLE) {
    assert.ok(row.reason && row.reason.length > 20, `${row.phrase}: a reason`);
    const hits = rows.filter((r) => r.text.includes(row.phrase));
    assert.ok(hits.length, `${row.phrase}: still a message`);
    assert.ok(
      hits.some((r) => flagsIn(r.text).length),
      `${row.phrase}: names a connector flag, or it needs no exemption`
    );
  }
});

test('no message a connector verb can send names a flag the connector builds', () => {
  assert.deepEqual(flagFindings(literals()), []);
});

test("a field a message names is one its verb's tool accepts", () => {
  assert.deepEqual(fieldFindings(literals()), []);
});

test('the two rules catch a planted message of each kind', () => {
  const planted = [
    {
      file: 'x',
      line: 1,
      verbs: ['song'],
      text: 'declare one with --blueprint= to grade the meter',
    },
    { file: 'x', line: 2, verbs: ['screen'], text: 'declare the mandate as `groups`' },
    {
      file: 'x',
      line: 3,
      verbs: ['screen'],
      text: 'declare the mandate as `groups` on check or revise',
    },
    { file: 'x', line: 4, verbs: ['recover'], text: 'declare `placements` again' },
  ];
  assert.equal(flagFindings(planted).length, 1);
  assert.deepEqual(
    fieldFindings(planted).map((f) => f.split(' ')[0]),
    ['x:2']
  );
  // The scanner reads the harness: it finds messages on every connector verb.
  const verbs = new Set(literals().flatMap((r) => r.verbs));
  for (const v of Object.keys(VERB_TOOLS)) assert.ok(verbs.has(v), `messages found for ${v}`);
});
