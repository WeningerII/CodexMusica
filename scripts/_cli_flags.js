'use strict';
// _cli_flags.js — the argument contract every documented CLI script shares.
//
// Each script parses its own flags (their shapes differ, and the documented
// commands depend on them). This module answers the question none of them
// asked afterwards: is every flag one the script reads, and does every value
// flag carry a value? A flag outside the list used to be stored and never
// read, so a typo exited 0 with the output unchanged (`--exclude-instruments`
// left the saxophone in), and a bare value flag became `true` and crashed
// later with a stack trace and exit 1. Both read to an agent as success or as
// an engine crash; both are a bad argument, which these scripts promise as
// exit 2 with a message on stderr.

function refuse(message) {
  console.error(message);
  process.exit(2);
}

// --help prints the running script's header comment, which is where each of
// these scripts documents its usage, to stdout with exit 0. (It used to fall
// through to each script's own missing-argument usage line; listing flags
// would otherwise refuse it as unknown, BB8's review.)
function printHelp() {
  const fs = require('fs');
  const lines = fs.readFileSync(require.main.filename, 'utf8').split('\n');
  const out = [];
  for (const line of lines) {
    if (/^#!/.test(line) || /^'use strict'/.test(line)) continue;
    if (!/^\s*\/\//.test(line)) {
      if (out.length) break;
      continue;
    }
    out.push(line.replace(/^\s*\/\/ ?/, ''));
  }
  process.stdout.write(out.join('\n') + '\n');
  process.exit(0);
}

// boolean: flags that take no value. value: flags that need one.
function checkFlags(flags, { boolean = [], value = [] }) {
  if (flags.help !== undefined || flags.h !== undefined) printHelp();
  const known = [...boolean, ...value];
  for (const name of Object.keys(flags)) {
    if (!known.includes(name)) {
      const near = known.filter((k) => k.startsWith(name) || name.startsWith(k));
      refuse(
        `Unknown flag --${name}.` +
          (near.length ? ` Did you mean ${near.map((k) => '--' + k).join(' or ')}?` : '') +
          ` Known flags: ${known.map((k) => '--' + k).join(', ')}.`
      );
    }
    if (value.includes(name) && (flags[name] === true || flags[name] === '')) {
      refuse(`--${name} needs a value, as --${name}=<value>.`);
    }
  }
}

// A whole number in [min, max], read strictly: `10abc` and `abc` are refused,
// where parseInt read the first as 10 and `parseInt(x) || 5` turned the second
// into a silent default.
function intFlag(flags, name, { min = -Infinity, max = Infinity, fallback } = {}) {
  if (flags[name] === undefined) return fallback;
  const raw = String(flags[name]);
  const n = /^-?\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < min || n > max)
    refuse(
      `--${name} must be a whole number` +
        (min > -Infinity && max < Infinity
          ? ` from ${min} to ${max}`
          : min > -Infinity
            ? ` of at least ${min}`
            : '') +
        `; got "${raw}".`
    );
  return n;
}

// A decimal number in [min, max], read strictly (`0.5abc` is refused).
function numFlag(flags, name, { min = -Infinity, max = Infinity, fallback } = {}) {
  if (flags[name] === undefined) return fallback;
  const raw = String(flags[name]);
  const n = /^-?(\d+\.?\d*|\.\d+)$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < min || n > max)
    refuse(`--${name} must be a number from ${min} to ${max}; got "${raw}".`);
  return n;
}

module.exports = { checkFlags, intFlag, numFlag, refuse };
