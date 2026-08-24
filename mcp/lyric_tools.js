// lyric_tools.js — the lyric harness as MCP tools: a DISJOINT family.
//
// STANDING RULE 1 OF lyric-harness/CLAUDE.md, HONORED IN THE ARCHITECTURE:
// the recipe engine and the lyrics do not touch. This module imports nothing
// from engine.js or schemas.js, shares no state with the workspace, and runs
// every call as its own short-lived python3 subprocess over the CLI —
// `lyric_harness.py` is the tested entrance (50-suite CI pool), and the
// connector exposes ONLY real entrances (standing rule 3, 2026-08-18: no
// private instruments). No re-implementation of any judgement lives here; a
// tool's answer is the verb's own report, verbatim.
//
// The intended order is PLAN -> WRITE -> REVISE and the writer is OUTSIDE
// the harness: these tools plan shapes and grade words; they never write
// words. Both chat postures land on the same calls — a model writing to a
// brief, or a human pasting lyrics — because the graders do not care where
// a draft came from.
//
// OPERATIONAL SHAPE. Stateless: a plan is a pure function of its seed, so
// grading re-derives it (seed + draft in, verdict out) and nothing is held
// server-side — the same no-handle promise the recipe tools keep. Serial: a
// module-level queue runs ONE python at a time, because each call loads the
// pronunciation lexicon (~10s, a few hundred MB) and the deploy target is a
// small instance; a burst must queue, not OOM. Bounded: every input has a
// ceiling (the same DoS arithmetic schemas.js records for the recipe side).
// Argv-safe: word-like inputs are charset-validated and may not begin with
// "-"; line text never reaches argv — it travels by temp file, deleted in
// finally.

import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const HARNESS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lyric-harness');
const PYTHON = process.env.LYRIC_PYTHON || 'python3';

// ── ceilings (every one refused loudly, none silently clamped) ─────────────
const MAX_WORDS = 12;
const MAX_WORD_CHARS = 40;
const MAX_LINES = 64; // the planner envelope's own total_lines ceiling
const MAX_LINE_CHARS = 200;
const MAX_MANDATE_CHARS = 400;
const SUBPROCESS_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

// A word that reaches argv: letters, apostrophes, internal hyphens. The
// leading character is constrained separately so no input can grow into a
// flag; there is no shell (execFile), so this is belt on top of braces.
const WORD_RE = /^[A-Za-z][A-Za-z''-]*$/;
// Mandate strings (--groups=/--returns=). A member is a LINE NUMBER, or a
// line and a PLACE IN IT since 2026-08-23 — `3.head`, `3.T2`, `3.end`,
// `3.endword`, `3.line`, `3.headrime` (`quality/slots.py`). The owner's
// ruling that closed the end-rhyme-only architecture is the reason this
// spelling exists, and it reaches the connector IN THE SAME COMMIT as the
// coordinate: a declared coordinate the outermost layer cannot spell is this
// repository's single most-repeated defect (CLAUDE.md's `--structures`
// paragraph, M-55, and doctrine 48 at the connector).
//
// The place is matched as a BOUNDED alternation rather than `\w+` so nothing
// input-shaped can grow into a flag; the harness refuses an unknown place by
// name anyway, and this is the belt on top of that.
const SLOT_PLACE = '(?:end|endword|head|headrime|line|T[0-9]{1,3})';
const MEMBER_RE = `[0-9]+(?:\\.${SLOT_PLACE})?`;
const MANDATE_RE = new RegExp(`^${MEMBER_RE}(,${MEMBER_RE})*(;${MEMBER_RE}(,${MEMBER_RE})*)*$`);
// `--returns=` names LINES that are the same line, so a place has no meaning
// there — a return is a whole line repeated, not a span inside one.
const RETURNS_RE = /^[0-9]+(,[0-9]+)*(;[0-9]+(,[0-9]+)*)*$/;
const SCHEME_RE = /^[A-Za-z]{1,64}$/;

// One python at a time (see OPERATIONAL SHAPE above). A rejected run must
// not wedge the chain, so the tail always settles.
let queueTail = Promise.resolve();
function enqueue(fn) {
  const run = queueTail.then(fn, fn);
  queueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function runVerb(args) {
  return enqueue(
    () =>
      new Promise((resolve) => {
        execFile(
          PYTHON,
          ['lyric_harness.py', ...args],
          {
            cwd: HARNESS_DIR,
            timeout: SUBPROCESS_TIMEOUT_MS,
            maxBuffer: MAX_OUTPUT_BYTES,
            env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
          },
          (err, stdout, stderr) => {
            // The CLI's exit codes are the contract: 0 answered clean,
            // 2 REFUSED (the harness did not answer), 3 answered with a
            // FLAG standing. execFile treats any nonzero as `err`, so the
            // codes are read back off the error object.
            const code = err ? (typeof err.code === 'number' ? err.code : -1) : 0;
            resolve({ code, stdout: stdout || '', stderr: stderr || '' });
          }
        );
      })
  );
}

const EXIT_MEANING = {
  0: 'answered — no flag stands',
  2: 'REFUSED — the harness did not answer; the report names why',
  3: 'answered — at least one FLAG stands; the report names the lines',
};

// Pull the two-tier ban's pair findings out of a grade report by their own
// codes. Extraction, not re-implementation: HOMEOTELEUTON and MODAL_RHYME are
// the grader's own pair-scoped findings on MANDATED pairs — the same two
// `screen` relays, and the CLI loop's own MANDATORY_PURSUE set — printed one
// per line as "FINDING [NOTE] CODE: L{i}/L{j} ..." (the L{i}/L{j} spelling
// quality/capacity.py's _grade_group parses identically). WHY THIS SURFACES
// AT ALL: on the CLI the revise loop is FORCED to pursue these notes; the
// connector deliberately wraps no loop, so without this field the enforcement
// half of the two-tier ban does not exist on the chat surface — the
// 2026-08-19 site transcript graded a song whose every rhyme was banned at
// exit 0 and the model presented it as finished.
function extractBannedPairs(report) {
  const out = [];
  const seen = new Set();
  const re = /FINDING \[[A-Z]+\] (HOMEOTELEUTON|MODAL_RHYME): (L(\d+)\/L(\d+)[^\n]*)/g;
  for (let m; (m = re.exec(report)); ) {
    const key = `${m[1]} ${m[3]} ${m[4]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ code: m[1], lines: [Number(m[3]), Number(m[4])], finding: m[2] });
  }
  return out;
}

function verdictOf(r) {
  const banned = extractBannedPairs(r.stdout);
  const v = {
    exit_code: r.code,
    meaning: EXIT_MEANING[r.code] || `subprocess failure (${r.code}): ${r.stderr.slice(0, 400)}`,
  };
  // Before `report`, deliberately: a count buried under a long report is a
  // count a reader in a hurry never reaches.
  if (banned.length) {
    v.banned_pairs = banned.length;
    v.banned_pairs_meaning =
      'UNSKIPPABLE, even at exit 0: these mandated pairs land on the two-tier ban ' +
      '(HOMEOTELEUTON — same spelled ending; MODAL_RHYME — the most predictable partner). ' +
      'A song presented with banned pairs standing is NOT finished: replace the end words ' +
      'on the named lines (screen replacements with lyric_screen first) and grade again.';
    v.banned = banned;
  }
  v.report = r.stdout;
  return v;
}

function refuse(msg) {
  const e = new Error(msg);
  e.isRefusal = true;
  return e;
}

function checkWords(words) {
  if (words.length < 2 || words.length > MAX_WORDS)
    throw refuse(`between 2 and ${MAX_WORDS} words — got ${words.length}`);
  for (const w of words) {
    if (w.length > MAX_WORD_CHARS) throw refuse(`word too long: ${w.slice(0, 20)}…`);
    if (!WORD_RE.test(w))
      throw refuse(
        `'${w}' is not a single bare word (letters/apostrophes/hyphens, no leading '-')`
      );
  }
}

function checkLines(lines) {
  if (lines.length < 1 || lines.length > MAX_LINES)
    throw refuse(`between 1 and ${MAX_LINES} lines — got ${lines.length}`);
  for (const l of lines)
    if (l.length > MAX_LINE_CHARS) throw refuse(`line over ${MAX_LINE_CHARS} chars`);
}

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lyric-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function planArgs(a) {
  const args = [`--seed=${a.seed}`];
  if (a.form) args.push(`--form=${a.form}`);
  if (a.lines != null) args.push(`--lines=${a.lines}`);
  // THE WRITER'S DECLARATION (MISSING.md M-55). Neither is sampled: the
  // planner never picks a relation, it carries the one that was declared.
  // Without these two lines every relation and every roster the CLI accepts
  // is unreachable from this connector -- which is what `--structures` was
  // from the day it shipped, and what makes a coordinate built-and-tested
  // but not reachable.
  if (a.relation) args.push(`--relation=${a.relation}`);
  if (a.functions) args.push(`--functions=${a.functions}`);
  return args;
}

// Pull the rendered song out of `plan --fill`'s report by its own banner.
// Extraction, not re-implementation: the text between the banner and the
// WROTE line is render_song's output byte for byte (pinned in test.mjs).
function extractRender(stdout) {
  const m = stdout.match(/THE SONG, PERFORMANCE ORDER:\n\n([\s\S]*?)\n\s*WROTE /);
  return m ? m[1].trimEnd() : null;
}

// ── the schemas (plain shapes: no unions, no refs — the contract gate's
//    STRUCTURAL scan and Gemini's key allowlist both stay clean) ───────────

const seedField = z
  .number()
  .int()
  .min(-2147483648)
  .max(2147483647)
  .describe(
    'REQUIRED declared seed — any integer. Same seed, same plan, byte for byte; a different seed is a different song shape. Pick one and keep it for the whole song.'
  );

const formField = z
  .enum(['verse-chorus'])
  .optional()
  .describe('Declared form (default verse-chorus; unknown forms refuse by name).');

const linesField = z
  .number()
  .int()
  .min(4)
  .max(MAX_LINES)
  .optional()
  .describe('Exact total line count to request (4-64). Omit to let the planner choose.');

// THE WRITER'S DECLARATION (MISSING.md M-55). Neither is sampled and neither
// has a default: an omitted field means NOBODY SAID, and the harness then
// grades under the coarse two-name admit set exactly as it always has.
const relationField = z
  .string()
  .max(64)
  .optional()
  .describe(
    'Declare ONE rhyme relation every mandated group is judged under, e.g. "type:rime riche", "type:pararhyme", "class:ASSONANCE", "schema:perfect rhyme". Namespace it (type: / class: / schema:) — 26 names live in two namespaces and a bare one refuses by name. All three namespaces are judged: class: is the coarse band, type: is the named-cell engine, schema: is realised over the whole draft (29 of the 77 schemas are end-rhyme and fit a group directly; an INTRA-LINE figure like schema:alliteration REFUSES and names its placement, because it is a property of one line and no pair of lines can stand in it). Omit and the coarse default applies — which since 2026-08-22 admits ALL FOUR classes, so a near relation the band typed is no longer charged as a violation. Ask lyric_types for the vocabulary.'
  );

const functionsField = z
  .string()
  .max(200)
  .optional()
  .describe(
    'Comma-separated ALLOW-LIST of section functions this song may use, e.g. "verse,chorus,bridge,outro". Checked against each function\'s own definition BEFORE any shape is drawn: asking for a prechorus without a chorus REFUSES, because the word means before-the-chorus. A roster permits, it does not compel — functions the draw did not use are reported. Omit to let the planner use its whole roster.'
  );

const draftField = z
  .array(z.string().max(MAX_LINE_CHARS))
  .min(1)
  .max(MAX_LINES)
  .describe(
    'The song lines in performance order, one string per line, repeated sections written out in full. No [SECTION] markers.'
  );

export const LYRIC_TOOL_SCHEMAS = {
  lyric_screen: {
    words: z
      .array(z.string().max(MAX_WORD_CHARS))
      .min(2)
      .max(MAX_WORDS)
      .describe('2-12 bare words; every unordered pair among them is screened.'),
  },
  lyric_plan: {
    seed: seedField,
    form: formField,
    lines: linesField,
    relation: relationField,
    functions: functionsField,
  },
  lyric_grade: {
    seed: seedField,
    form: formField,
    lines: linesField,
    relation: relationField,
    functions: functionsField,
    draft: draftField,
  },
  lyric_check: {
    lines: draftField,
    scheme: z
      .string()
      .max(64)
      .optional()
      .describe("Letter rhyme scheme over the lines, e.g. 'ABAB' (X = free line)."),
    groups: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe(
        "Rhyme groups by 1-based line numbers, e.g. '1,3;2,4' — lines 1&3 rhyme and 2&4 rhyme. Alternative to scheme. A member may also name WHERE in its line the rhyme binds: '1,3.head' asks line 3's first word to answer line 1's last; places are end (default), endword, head, headrime, line, or T<n> for the n-th word."
      ),
    // `lyric_check` builds its own mandate rather than reading a plan, so
    // the relation is a DIRECT parameter here where `lyric_grade` takes it
    // off the plan artifact. Same coordinate, and the difference is which
    // object is the mandate (doctrine 1).
    relation: relationField,
    returns: z
      .string()
      .max(MAX_MANDATE_CHARS)
      .optional()
      .describe(
        "Verbatim-return classes by line numbers, e.g. '5,13;6,14' — line 13 must repeat line 5 word for word. Optional, joins groups."
      ),
  },
  lyric_types: {
    word_a: z.string().max(MAX_WORD_CHARS).describe('First word of the pair.'),
    word_b: z.string().max(MAX_WORD_CHARS).describe('Second word of the pair.'),
  },
};

// ── registration ───────────────────────────────────────────────────────────

export function registerLyricTools(server, tool) {
  tool(
    server,
    'lyric_screen',
    {
      title: 'Screen rhyme pairs before writing',
      description:
        'Is this rhyme pair USABLE? Judged by the song grader itself on a minimal mandated pair — every unordered pair among ' +
        'the words gets a verdict: CLEAN, BANNED (HOMEOTELEUTON — same spelled ending, the laziest true rhyme; MODAL_RHYME — ' +
        "the most predictable partner), an honest non-rhyme, or the grader's own refusal for an unreadable word. A banned " +
        'pair is an ANSWER, not an error. USE THIS BEFORE WRITING: screening end words first is how songs pass grading in one ' +
        'draft. ~10s per call (the pronunciation lexicon loads per process).',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_screen,
    },
    async (a) => {
      checkWords(a.words);
      const r = await runVerb(['screen', ...a.words]);
      return verdictOf(r);
    }
  );

  tool(
    server,
    'lyric_plan',
    {
      title: 'Plan a song shape (seeded, reproducible)',
      description:
        'The PLANNING phase: seed in, a complete song shape out — sections with bars/meter/pickup, a rhyme plan, verbatim-return ' +
        'rules, a hook slot, and a writer brief to write to. Deterministic: the same seed always returns the same plan, and ' +
        'every free choice is disclosed beside the space it was drawn from (meters from a derived cycle grammar — expect 5/8, ' +
        '7/8, 20/8, not always 4/4). It writes NO WORDS: the writer (model or human) writes to the brief, then lyric_grade ' +
        'checks the draft against this same seed. Try a few seeds and pick the shape that sings — the choice of seed is the ' +
        "writer's taste and the plan's own record. The FIRST content block is the plan report and writer brief: when " +
        'showing the shape, keep the bracket header rows exactly as written (they carry lines/bars/meter/pickup). The ' +
        'second block is the verdict.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_plan,
    },
    (a) =>
      withTempDir(async (dir) => {
        const r = await runVerb(['plan', ...planArgs(a), `--out=${path.join(dir, 'plan.json')}`]);
        const verdict = verdictOf(r);
        // Same presentation-first shape as lyric_grade: the report (plan
        // rows + writer brief, headers intact) leads as plain text.
        if (r.code === 0) {
          return {
            content: [
              { type: 'text', text: r.stdout },
              { type: 'text', text: JSON.stringify({ exit_code: 0, meaning: verdict.meaning }) },
            ],
          };
        }
        return verdict;
      })
  );

  tool(
    server,
    'lyric_grade',
    {
      title: 'Grade a draft against its plan',
      description:
        'The whole-song verdict: re-derives the plan from the SAME seed (and form/lines) given to lyric_plan, fills it with ' +
        'the draft, and grades — rhyme mandate, verbatim returns, meter fit, section functions, the slop floor. THE FIRST ' +
        'CONTENT BLOCK OF THE RESULT IS THE FINISHED SONG in performance order: when presenting it, reproduce that block ' +
        "CHARACTER FOR CHARACTER, exactly as you present a recipe string — the bracket headers carry each section's " +
        'lines, bars, meter and pickup, and restyling them to bare [SECTION] deletes the measurements the format exists ' +
        'to carry, and the [GRADED — seed …] stamp line under the song is part of the block. The second block is the ' +
        'grade verdict: FLAGS are defects with line numbers; banned_pairs counts mandated pairs on the two-tier ban ' +
        '(HOMEOTELEUTON / MODAL_RHYME) and is UNSKIPPABLE AT ANY EXIT CODE — banned_pairs above zero means the song is ' +
        'NOT finished, whatever exit_code says: replace those end words (screen replacements with lyric_screen) and ' +
        'grade again; other NOTES are measurements, not defects. Exit 0 clean, 2 refused (e.g. wrong line count), 3 ' +
        'flags standing. Revise the flagged and banned lines only and call again. ~15s.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_grade,
    },
    (a) =>
      withTempDir(async (dir) => {
        checkLines(a.draft);
        const draftPath = path.join(dir, 'draft.txt');
        const bpPath = path.join(dir, 'bp.json');
        const planPath = path.join(dir, 'plan.json');
        await writeFile(draftPath, a.draft.join('\n') + '\n', 'utf8');

        // 1. The plan's own mandate halves, from the plan artifact itself.
        const p1 = await runVerb(['plan', ...planArgs(a), `--out=${planPath}`]);
        if (p1.code !== 0) return verdictOf(p1);
        const plan = JSON.parse(await readFile(planPath, 'utf8'));

        // 2. Fill -> completed blueprint + the rendered song.
        const p2 = await runVerb([
          'plan',
          ...planArgs(a),
          `--fill=${draftPath}`,
          `--out=${bpPath}`,
        ]);
        if (p2.code !== 0) return verdictOf(p2);

        // 3. The grade, exactly as the plan's own GRADE IT line spells it.
        const songArgs = ['song', bpPath, draftPath];
        if (plan.groups) songArgs.push(`--groups=${plan.groups}`);
        if (plan.returns) songArgs.push(`--returns=${plan.returns}`);
        // The relation comes off the PLAN, not off the tool call, for the
        // same reason groups and returns do: the plan is the one artifact
        // that records what was asked for, and grading against anything else
        // would be a second statement of the mandate (doctrine 1).
        if (plan.relation) songArgs.push(`--relation=${plan.relation}`);
        songArgs.push('--subdivision', String(plan.subdivision));
        const p3 = await runVerb(songArgs);
        const render = extractRender(p2.stdout);
        const verdict = verdictOf(p3);
        // The SONG leads as its own plain-text block so a client presents
        // it instead of reformatting escaped JSON — the Wide Room
        // screenshot (2026-08-19) showed a Claude client rewriting the
        // bracket headers to bare [SECTION] when the render arrived as a
        // JSON field. What arrives presentation-ready gets presented.
        //
        // The stamp under the song is SERVER-written so the seed and the
        // verdict reach the user even through a client that reproduces
        // block 0 verbatim and relays nothing else (the 2026-08-19 site
        // transcript: a real plan, a real grade, and the user shown
        // neither). A bracket line is apparatus by the harness's own
        // loader rule, never song text.
        if (render) {
          const nBanned = verdict.banned_pairs || 0;
          const flagsBit =
            verdict.exit_code === 0
              ? 'no FLAG stands'
              : verdict.exit_code === 3
                ? 'FLAGS STANDING'
                : 'refused';
          const stamp =
            `[GRADED — seed ${a.seed} — exit ${verdict.exit_code}, ${flagsBit} — ` +
            `${nBanned} banned pair(s)${nBanned ? ', UNSKIPPABLE — not finished' : ''}]`;
          return {
            content: [
              { type: 'text', text: `${render}\n\n${stamp}` },
              { type: 'text', text: JSON.stringify(verdict) },
            ],
          };
        }
        return { rendered_song: null, ...verdict };
      })
  );

  tool(
    server,
    'lyric_check',
    {
      title: 'Check pasted lyrics against a declared rhyme plan',
      description:
        'For lyrics that were NOT written to a lyric_plan (a human pasting their own song): declare what the lyrics claim — a ' +
        "letter scheme ('ABAB', X = free) OR rhyme groups by line number ('1,3;2,4'), optionally verbatim-return classes — " +
        'and get the same rhyme grading and slop floor the full pipeline runs. A declaration is REQUIRED: nothing declared ' +
        'means nothing mandated, and "nothing flagged" about that would be a vacuous pass. FLAGS are defects with line ' +
        'numbers; banned_pairs counts declared pairs on the two-tier ban (HOMEOTELEUTON / MODAL_RHYME), unskippable at ' +
        'any exit code; other NOTES are measurements. ~10s.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_check,
    },
    (a) =>
      withTempDir(async (dir) => {
        checkLines(a.lines);
        const hasScheme = a.scheme != null && a.scheme !== '';
        const hasGroups = a.groups != null && a.groups !== '';
        if (hasScheme === hasGroups)
          throw refuse(
            "declare exactly one of 'scheme' or 'groups' — the mandate is a choice, not a default"
          );
        if (hasScheme && !SCHEME_RE.test(a.scheme))
          throw refuse("scheme must be letters only, e.g. 'ABAB'");
        if (hasGroups && !MANDATE_RE.test(a.groups))
          throw refuse(
            "groups must be line numbers like '1,3;2,4', each optionally " +
              "naming a place in its line — '1,3.head;2,4' binds line 3's " +
              "FIRST word to line 1's last. Places: end (the default), " +
              'endword, head, headrime, line, or T<n> for the n-th word'
          );
        if (a.returns && !RETURNS_RE.test(a.returns))
          throw refuse("returns must be line numbers like '5,13;6,14'");
        const draftPath = path.join(dir, 'draft.txt');
        await writeFile(draftPath, a.lines.join('\n') + '\n', 'utf8');
        const args = ['brief', draftPath];
        if (hasScheme) args.push(a.scheme);
        if (hasGroups) args.push(`--groups=${a.groups}`);
        if (a.returns) args.push(`--returns=${a.returns}`);
        if (a.relation) args.push(`--relation=${a.relation}`);
        const r = await runVerb(args);
        return verdictOf(r);
      })
  );

  tool(
    server,
    'lyric_types',
    {
      title: 'Classify one rhyme pair (the 9-axis coordinate)',
      description:
        'The full rhyme-type coordinate for one word pair: per-syllable agreement, anchor, identity, stress, boundary, ' +
        'traditional names where the coordinate has one. Taxonomy, not judgement — for the usable-or-banned verdict use ' +
        'lyric_screen. ~10s.',
      inputSchema: LYRIC_TOOL_SCHEMAS.lyric_types,
    },
    async (a) => {
      checkWords([a.word_a, a.word_b]);
      const r = await runVerb(['types', a.word_a, '--', a.word_b]);
      return verdictOf(r);
    }
  );
}

//: The paragraph buildServer appends to the server instructions — the same
//: text the Gemini chat receives as its system prompt (buildSurface reads
//: the live instructions), so the two surfaces stay one description.
export const LYRIC_INSTRUCTIONS =
  ' BESIDE THE RECIPES, AND NEVER TOUCHING THEM, the lyric_* family is a songwriting ' +
  'harness (plan and grade; it writes no words — the writer is you or the user). The working order that ' +
  'produces one-draft songs: (1) lyric_screen candidate end-word pairs BEFORE writing — a banned pair ' +
  '(HOMEOTELEUTON/MODAL_RHYME) is an answer, pick different words; (2) lyric_plan with a declared integer ' +
  'seed for a complete shape (sections, meter — often not 4/4, rhyme plan, hook slot) and write to its ' +
  'brief, honoring the verbatim returns; (3) lyric_grade with the SAME seed and the draft — present the ' +
  'rendered song VERBATIM with its bracket headers, then revise the flagged AND banned lines and grade ' +
  'again. THE BAN IS UNSKIPPABLE: a grade verdict with banned_pairs above zero is the harness answering ' +
  'NO — the song is not finished even at exit 0. Replace the banned end words (screen the replacements ' +
  'with lyric_screen) and grade again; never present a song as finished while banned pairs stand. ' +
  'PRESENTATION IS PART OF THE CONTRACT: the first content block returned by lyric_grade and lyric_plan ' +
  'is the deliverable — reproduce it character for character, exactly as you reproduce a recipe string; ' +
  'the bracket headers ([CHORUS — 3 lines — 6 bars of 6/8, half-beat pickup]) are measurements, ' +
  'restyling them to bare [CHORUS] deletes what the format exists to carry, and the [GRADED — seed …] ' +
  'stamp line under the song is part of the block and reaches the user with it. For lyrics a user ' +
  'pastes, lyric_check with their declared scheme or groups. FLAGS are defects; banned pairs are ' +
  'unskippable whatever their severity; other NOTES are measurements and are not to be "fixed". Recipes ' +
  'describe the SOUND, lyric tools govern the WORDS; the conversation is the only place they meet.';
