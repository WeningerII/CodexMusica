'use strict';
// test_cli_contract.js — the argument contract the documented CLI scripts share
// (_cli_flags.js). A user mistake exits 2 with one line on stderr and nothing
// on stdout, never exit 0 with unchanged or empty output and never a stack
// trace; and the documented forms keep working.
//
// Usage: node --test scripts/test_cli_contract.js

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const run = (args) => {
  const r = spawnSync('node', args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 64 << 20, // expand.js prints over 1 MB for a full tradition
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const refused = (args, why) => {
  const r = run(args);
  assert.equal(r.code, 2, `${args.join(' ')} exits 2 (got ${r.code}): ${r.err}`);
  assert.match(r.err, why, args.join(' '));
  assert.doesNotMatch(r.err, /\n\s+at |node:internal/, `${args.join(' ')} prints no stack`);
  assert.equal(r.out, '', `${args.join(' ')} prints nothing on stdout`);
};

test('C1: a bare value flag or a missing file is a named usage error, not a stack trace', () => {
  refused(['scripts/recipe.js', '--axis-target'], /--axis-target needs a value/);
  refused(['scripts/placement_check.js', '--id', 'new_x', '--parent'], /--parent needs a value/);
  refused(['scripts/_apply_trad_edits.js', '/nonexistent.json', '--dry-run'], /no such file/);
});

test('C2: an unknown id or a malformed value is refused, not answered with a default', () => {
  refused(
    [
      'scripts/preface_configure.js',
      '--instrument',
      'voice',
      '--preface',
      'liturgical',
      '--tradition',
      'nope',
    ],
    /Unknown tradition id: nope/
  );
  refused(
    ['scripts/inspect.js', '--tradition=bluegrass', '--instrument=nope'],
    /Unknown instrument/
  );
  refused(['scripts/list.js', '--traditions', '--family=nope'], /Unknown family/);
  refused(['scripts/list.js', '--variants', '--instrument=voice', '--part=nope'], /has no part/);
  refused(['scripts/list.js', '--tree', '--root=nope'], /not a tree node/);
  refused(['scripts/list.js', '--tree', '--depth=abc'], /--depth must be a whole number/);
  refused(['scripts/nearest_neighbor.js', '--id', 'bluegrass', '--limit=abc'], /--limit/);
  refused(['scripts/nearest_neighbor.js', '--axes', 'garbage'], /--axes: "garbage"/);
  refused(['scripts/recipe.js', '--axis-target', 'harm:9'], /--axis-target: "harm:9"/);
  refused(['scripts/recipe.js', '--tradition', 'bluegrass', '--max-chars=10abc'], /--max-chars/);
  refused(
    ['scripts/recipe.js', '--diff', '--weight=0.5abc', 'bluegrass', 'delta_blues'],
    /--weight/
  );
});

test('C3: a misspelled, unsupported or conflicting flag is refused by name', () => {
  refused(
    ['scripts/recipe.js', '--tradition', 'afrobeat', '--exclude-instruments=saxophone'],
    /Unknown flag --exclude-instruments\. Did you mean --exclude-instrument\?/
  );
  refused(
    ['scripts/recipe.js', '--tradition', 'afrobeat', '--traditions', 'post_punk'],
    /Choose one of/
  );
  refused(['scripts/stack.js', '--tradition=bluegrass', '--json'], /Unknown flag --json/);
  refused(['scripts/inspect.js', '--tradition=bluegrass', '--json'], /Unknown flag --json/);
  refused(['scripts/stack.js', '--tradition=bluegrass', '--mod=cloud'], /Did you mean --mode\?/);
  refused(['scripts/nearest_neighbor.js', '--typ', 'tradition', '--keyword', 'blues'], /--type\?/);
  refused(['scripts/fingerprint.js', 'khayal', 'bluegrass'], /takes one tradition id/);
});

test("--help prints the script's usage on stdout and exits 0", () => {
  for (const f of [
    'recipe',
    'stack',
    'inspect',
    'fingerprint',
    'nearest_neighbor',
    'list',
    'placement_check',
    'preface_configure',
  ]) {
    const r = run([`scripts/${f}.js`, '--help']);
    assert.equal(r.code, 0, `${f} --help: ${r.err}`);
    assert.match(r.out, /\S/, `${f} --help prints its usage`);
  }
});

test('an out-of-range or fractional axis and two list modes are refused', () => {
  refused(['scripts/nearest_neighbor.js', '--axes', 'harm:1.5'], /whole number from -2 to 2/);
  refused(['scripts/nearest_neighbor.js', '--axes', 'harm:9'], /whole number from -2 to 2/);
  refused(['scripts/list.js', '--rooms', '--tunings'], /Choose one of --rooms, --tunings/);
});

test('expand.js and compare.js share the contract; a dry run with errors fails', () => {
  refused(['scripts/expand.js', '--tradition'], /--tradition needs a value/);
  refused(['scripts/expand.js', '--traditon', 'bluegrass'], /Unknown flag --traditon/);
  refused(
    ['scripts/compare.js', '--tradition', 'bluegrass', 'thrash_metal'],
    /Unknown flag --tradition\. Did you mean --traditions\?/
  );
  // The unknown id is named, not just "Unknown tradition".
  refused(
    ['scripts/compare.js', '--traditions', 'bluegrass', 'nope_x'],
    /Unknown tradition: nope_x/
  );
  for (const script of ['scripts/expand.js', 'scripts/compare.js']) {
    const help = run([script, '--help']);
    assert.equal(help.code, 0, `${script} --help: ${help.err}`);
    assert.match(help.out, /Usage:/, `${script} --help prints its usage`);
  }
  // --dry-run is how an edits file is checked: its errors exit 1, as a write does.
  const fs = require('fs');
  const os = require('os');
  const bad = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-')), 'edits.json');
  fs.writeFileSync(
    bad,
    JSON.stringify({ bluegrass: [{ field: 'chain_archetype', from: 'WRONG', to: 'x' }] })
  );
  const dry = run(['scripts/_apply_trad_edits.js', bad, '--dry-run']);
  assert.equal(dry.code, 1, `a dry run with errors exits 1 (got ${dry.code})`);
  assert.match(dry.err, /NO_MATCH/);
});

test('the documented forms still run', () => {
  for (const args of [
    ['scripts/recipe.js', '--tradition', 'afrobeat', '--exclude-instrument=saxophone,trumpet'],
    ['scripts/recipe.js', '--diff', '--weight=0.6', 'bluegrass', 'thrash_metal'],
    ['scripts/recipe.js', '--axis-target', 'harm:1,density:2,intensity:2'],
    ['scripts/fingerprint.js', '--tradition', 'afrobeat'],
    ['scripts/nearest_neighbor.js', '--id', 'bluegrass', '--limit=3'],
    ['scripts/list.js', '--tree', '--depth=1'],
    ['scripts/expand.js', '--tradition', 'afrobeat'],
    ['scripts/compare.js', '--traditions=afrobeat,highlife'],
    ['scripts/compare.js', '--traditions', 'afrobeat', 'gamelan'],
    [
      'scripts/preface_configure.js',
      '--instrument',
      'voice',
      '--preface',
      'liturgical',
      '--tradition',
      'bluegrass',
    ],
  ]) {
    const r = run(args);
    assert.equal(r.code, 0, `${args.join(' ')}: ${r.err}`);
    assert.ok(r.out.length > 0, args.join(' '));
  }
});
