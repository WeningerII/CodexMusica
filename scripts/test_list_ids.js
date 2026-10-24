// list.js --ids: bare ids, one per line, in every mode. Its own header promised
// this, but --variants, --aesthetics, --tree, --axes and --inst-axes printed
// their full prose listings with the flag, so a script piping ids got prose.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const LIST = path.join(__dirname, 'list.js');
const MODES = [
  ['--section', 'mic'],
  ['--rooms'],
  ['--instruments'],
  ['--variants', '--instrument=oud'],
  ['--archetypes'],
  ['--aesthetics'],
  ['--traditions'],
  ['--tunings'],
  ['--tree'],
  ['--axes'],
  ['--inst-axes'],
];

for (const mode of MODES) {
  test(`list.js ${mode.join(' ')} --ids prints bare ids`, () => {
    const out = execFileSync(process.execPath, [LIST, ...mode, '--ids'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const lines = out.split('\n').filter(Boolean);
    assert.ok(lines.length > 0, 'some ids');
    const shape = mode[0] === '--variants' ? /^[\w.-]+:[\w.-]+$/ : /^[\w.-]+$/;
    for (const line of lines) assert.match(line, shape, `not a bare id: ${line}`);
    assert.equal(new Set(lines).size, lines.length, 'each id once');
  });
}
