#!/usr/bin/env node
// check_doc_paths.js — every FILE PATH cited in a documented command must
// exist, or the document must say why it does not.
//
// @covers: documented-paths-exist
//
// THE GAP THIS CLOSES, AND IT WAS MEASURED RATHER THAN IMAGINED.
// check_docs.js resolves `scripts/*.js` references and check_doc_commands.js
// EXECUTES the `node scripts/*.js` invocations in four root docs. Neither one
// reads a `$ python3 …` transcript, and neither looks inside
// lyric-harness/**/*.md at all. So on 2026-08-21 four RESULTS documents were
// found citing `examples/cherokee_bill.txt` and
// `examples/never_been_to_a_scene.txt` — deleted ON PURPOSE by `11aa19b` nine
// days earlier — across 49 citations and 17 "REPRODUCES EXACTLY" rows, and
// `npm run check-docs` was GREEN the whole time. It surfaced because somebody
// mistyped a path and the error looked wrong. That is not a method, which is
// why this file exists (doctrine 48: a principle that lives only in prose gets
// followed exactly as often as someone remembers it).
//
// FOUR OUTCOMES, COUNTED APART AND NEVER SUMMED (doctrine 79). Only the last
// fails, and the three that do not fail are printed anyway, because a gate
// that reports one number cannot be told apart from a gate that looked at one
// thing:
//
//   present   the cited file is on disk. Nothing to say.
//   ignored   absent AND git-ignored — a fetched lexicon or a build artifact.
//             Absent from a clean checkout BY DESIGN, so naming it in a
//             command is correct and this is not a defect.
//   declared  absent, not ignored, and the document SAYS SO — in the same
//             fenced block as the command, or within DECLARE_WINDOW lines
//             either side of it. This is the deliberate escape hatch and it
//             is deliberately narrow: it has to be written next to the thing
//             it excuses.
//   MISSING   absent, not ignored, undeclared. The failure.
//
// WHY A DOCUMENT-SIDE MARKER RATHER THAN A SAFELIST IN THIS FILE. A safelist
// here would let a path rot out of the repo and be silenced by an edit a
// reader of the document never sees. The marker travels WITH the transcript,
// so the reader who is about to type the command is the one who is told, and
// silencing this gate costs an edit to the document that admits what happened.
//
// RESOLUTION RULE, DECLARED because a relative path means nothing without one
// (doctrine 1): a path is resolved against the root of its own tree — commands
// in `lyric-harness/**/*.md` are written as run from `lyric-harness/`,
// everything else from the repository root. A path that resolves under neither
// is MISSING rather than quietly skipped.
//
// Usage: node scripts/check_doc_paths.js [--verbose]
// Exit 0 if every cited path is present, ignored or declared; 1 otherwise.

'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

//: The document-side escape hatch. Written inside or beside a command block,
//: it says the command is a RECORD OF A RUN and not an instruction. Matched
//: case-sensitively on purpose — a shouted marker is meant to be conspicuous
//: to a reader, not merely parseable.
//:
//: WHERE THE MARKER MAY SIT, and both halves were forced by this repo's own
//: annotations rather than chosen up front. It looks BOTH WAYS, because
//: inside a fenced block the natural place for the note is the line UNDER
//: `$ command`, where a shell comment sits. And it takes the WHOLE ENCLOSING
//: FENCED BLOCK, not a line count, because the first version used a bare
//: window of 6 and a note that ran to 14 lines fell out of its own window —
//: which would have taught authors to write SHORT explanations of things
//: that need long ones. The block is the honest unit: a marker in the same
//: ``` block as the command is unmissable to the reader who is about to run
//: it. The line window survives for commands written in prose, outside any
//: block.
const DECLARED_RE = /CANNOT RUN FROM A CLEAN CHECKOUT/;
const DECLARE_WINDOW = 6;

//: Extensions worth checking. A path with no extension is usually a directory
//: or a verb argument, and guessing would produce noise that trains a reader
//: to ignore this gate (doctrine 61 — a rule that fires more often is not a
//: better rule).
const EXTS = new Set([
  '.txt',
  '.json',
  '.tsv',
  '.md',
  '.py',
  '.js',
  '.mjs',
  '.csv',
  '.dict',
  '.yml',
  '.yaml',
]);

//: `node -e '<program>'` takes a PROGRAM, not a path. A `require('./q.js')`
//: inside one is a runtime dependency of a snippet the document tells the
//: reader to create, and SKILL.md does exactly that — so paths inside an
//: inline program are not documented file arguments and are not checked here.
//: `check_doc_commands.js` reaches the same conclusion about `q.js` by naming
//: it in a placeholder pattern; this states the RULE instead of the instance,
//: so a second reader-created helper needs no second edit (doctrine 1).
const INLINE_PROGRAM_RE = /\s(?:-e|--eval)\s/;

//: A line only counts as a command if it looks like one being offered to a
//: reader. Prose that happens to name a file is NOT checked here: this gate is
//: about instructions, and `MISSING.md`-style narrative citations are a
//: different question with a different remedy.
const COMMAND_RE = /^\s*(?:\$\s+)?(?:python3?|node|npm|bash|sh)\s/;

//: Never treated as a real path.
const PLACEHOLDER_RE = /[<>{}$*…]|\.\.\.|^[A-Z][A-Z0-9_]*$|:\/\//;

function sh(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    return e.stdout || '';
  }
}

function docFiles() {
  const out = sh(['ls-files', '*.md', '*.txt']).split('\n').filter(Boolean);
  // llms.txt and friends are documentation; corpus .txt files are not, and
  // sweeping them would put 1,400 lyric files through a documentation gate.
  return out.filter(
    (f) => f.endsWith('.md') || /^(llms|AGENTS|SKILL)\.txt$/.test(path.basename(f))
  );
}

const ignoredCache = new Map();
function isIgnored(rel) {
  if (ignoredCache.has(rel)) return ignoredCache.get(rel);
  let ignored = false;
  try {
    execFileSync('git', ['check-ignore', '-q', '--', rel], { cwd: ROOT, stdio: 'ignore' });
    ignored = true;
  } catch {
    // git check-ignore exits 1 when the path is NOT ignored — and it also
    // fails outside a checkout, where the question cannot be answered at all.
    // Both land here as "not ignored", which is the CONSERVATIVE direction:
    // an absent file then FAILS rather than being quietly excused.
  }
  ignoredCache.set(rel, ignored);
  return ignored;
}

function candidatePaths(line) {
  const out = [];
  for (let tok of line.split(/[\s`'"()|]+/)) {
    tok = tok.replace(/[.,;:]+$/, '');
    // A PATH GIVEN AS A FLAG VALUE IS STILL A PATH. `--fill=songs/x.txt` is
    // one token, and reading it whole made this checker look for a file
    // literally named `--fill=songs/x.txt` — reporting MISSING on a file that
    // is right there. This repo documents `--blueprint=`, `--out=`, `--fill=`
    // and `--subdivision` all over CLAUDE.md, so the next person to write one
    // hits the identical wall; it is the checker that mis-parses, not the doc
    // that mis-cites. Strip the flag and judge what it names.
    tok = tok.replace(/^--[A-Za-z0-9][A-Za-z0-9-]*=/, '');
    if (!tok || PLACEHOLDER_RE.test(tok)) continue;
    if (!EXTS.has(path.extname(tok))) continue;
    if (tok.startsWith('/') || tok.startsWith('http')) continue;
    out.push(tok);
  }
  return out;
}

const counts = { present: 0, ignored: 0, declared: 0, missing: 0 };
const missing = [];
const declared = [];
const seen = new Set();

for (const rel of docFiles()) {
  const abs = path.join(ROOT, rel);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  // Map each line to its enclosing ``` block, so a declaration anywhere in
  // the block covers every command in it. -1 = not inside a block.
  const block = new Array(lines.length).fill(-1);
  {
    let open = -1;
    lines.forEach((l, k) => {
      if (/^\s*```/.test(l)) {
        if (open === -1) {
          open = k;
        } else {
          for (let t = open; t <= k; t++) block[t] = open;
          open = -1;
        }
      }
    });
  }
  // DECLARED RESOLUTION RULE: a doc under lyric-harness/ writes its commands
  // as run from lyric-harness/.
  const base = rel.startsWith('lyric-harness/') ? path.join(ROOT, 'lyric-harness') : ROOT;

  lines.forEach((line, i) => {
    if (!COMMAND_RE.test(line)) return;
    if (INLINE_PROGRAM_RE.test(line)) return;
    // A redirection target is an OUTPUT and is not required to pre-exist; a
    // trailing `# …` is prose. RESULTS_SONG_FLOOR.md:33 is the worked case for
    // the second — `--check    # exit 1 if floor.py has drifted` names
    // `floor.py` in a comment, and reading it as an argument charges a
    // documentation gate with a file the command never opens.
    const cmd = line.replace(/\s+#.*$/, '').split('>')[0];
    for (const p of candidatePaths(cmd)) {
      const onDisk = path.join(base, p);
      const relToRoot = path.relative(ROOT, onDisk);
      const key = `${rel}:${i + 1}:${p}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (fs.existsSync(onDisk)) {
        counts.present++;
        continue;
      }
      if (isIgnored(relToRoot)) {
        counts.ignored++;
        continue;
      }

      let from = Math.max(0, i - DECLARE_WINDOW);
      let to = Math.min(lines.length, i + 1 + DECLARE_WINDOW);
      if (block[i] !== -1) {
        from = Math.min(from, block[i]);
        let end = block[i];
        while (end < lines.length && block[end] === block[i]) end++;
        to = Math.max(to, end);
      }
      const window = lines.slice(from, to).join('\n');
      if (DECLARED_RE.test(window)) {
        counts.declared++;
        declared.push({ file: rel, line: i + 1, p });
        continue;
      }
      counts.missing++;
      missing.push({ file: rel, line: i + 1, p, tried: relToRoot });
    }
  });
}

console.log('=== Documented path existence ===');
console.log(
  `  present ${counts.present}   ignored ${counts.ignored}   ` +
    `declared-unreproducible ${counts.declared}   MISSING ${counts.missing}`
);
console.log('  (four counts, never summed — doctrine 79)');

if (counts.present + counts.ignored + counts.declared + counts.missing === 0) {
  console.log(
    'FAIL — this gate examined NO path at all, which reads exactly ' +
      'like a pass. Either the doc set or the command pattern is ' +
      'broken (doctrine 20).'
  );
  process.exit(1);
}

if (VERBOSE && declared.length) {
  console.log('\n  declared unreproducible (recorded, not a failure):');
  for (const d of declared) console.log(`    ${d.file}:${d.line}  ${d.p}`);
}

if (missing.length) {
  console.log(
    '\n  MISSING — cited in a command, absent from the checkout, ' +
      'not git-ignored, and the document does not say why:'
  );
  for (const m of missing) {
    console.log(`    ${m.file}:${m.line}  ${m.p}`);
    console.log(`        looked for ${m.tried}`);
  }
  console.log(
    '\n  Fix the path, or — if the file is gone on purpose — say so ' +
      'in the document — anywhere in the same ``` block as the ' +
      'command, or within ' +
      DECLARE_WINDOW +
      ' lines either side ' +
      'of it — in these words: "CANNOT RUN FROM A CLEAN CHECKOUT".'
  );
  console.log(`FAIL — ${missing.length} documented path(s) do not exist.`);
  process.exit(1);
}

console.log(
  'PASS — every documented path is present, git-ignored, or ' + 'declared unreproducible.'
);
process.exit(0);
