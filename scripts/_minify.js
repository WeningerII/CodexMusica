// _minify.js — the one place that decides how shipped JavaScript is squeezed.
//
// WHY THIS EXISTS. codex.html is 6.30 MB and 97.7% of it is JavaScript: nine
// catalog tables printed as object and array literals, plus src/app.js. It was
// shipped exactly as those sources are written — one property per line, indented
// — so a large fraction of what every visitor downloads and every renderer
// parses is leading spaces.
//
// WHAT IT BUYS, measured on this tree (2026-09-14) by building the page both
// ways through this very pipeline -- not by squeezing an already-built file,
// which is a different number:
//
//   raw       6,300,611 -> 5,430,553   (13.8% off)
//   gzipped   1,512,024 -> 1,415,498   ( 6.4% off)
//   brotli    1,148,518 -> 1,071,764   ( 6.7% off)
//
// READ THOSE TWO ROWS IN THAT ORDER, because they do not say the same thing.
// GitHub Pages compresses text on the wire, and gzip already encodes a run of
// twelve spaces in almost nothing — so the bandwidth win is the 6.4% row, not
// the 13.8% one. The 13.8% is the row that matters more: it is text the browser
// must actually parse and hold, after the transfer, and it is the whole reason
// the data is chunked across nineteen <script> tags in the first place (see
// MAX_SCRIPT_CHARS in build_html.js — a renderer was being OOM-killed on a
// single monolithic parse). Minifying makes every one of those chunks smaller
// than the ceiling that exists to keep that from happening again.
//
// WHY NOTHING IS RENAMED OR REWRITTEN, which is the decision this file exists to
// record. The same measurement, run at three settings:
//
//   whitespace only        gzip 1,415,498
//   + compress             gzip 1,414,263   (1,235 bytes better)
//   + compress + mangle    gzip 1,407,495   (8,003 bytes better)
//
// Full compression and mangling buy 0.6% more of an already-compressed page.
// Against that: this page's nineteen <script> tags share one global scope on
// purpose, so a mangler is being asked to rename cross-block globals it cannot
// see all uses of; the catalog is data whose keys are reached dynamically; and
// `compress` merges adjacent declarations, which would delete the literal
// `const CODEX_LAZY_API` that ui_reachability_check.js reads to tell the two
// build variants apart. Eight kilobytes is not worth one of those, let alone
// three. So: parse, reprint without whitespace or comments, change nothing else.
//
// DETERMINISM IS A HARD REQUIREMENT, not a nicety. check_artifact_fresh.js
// byte-compares the committed codex.html against a fresh build, so a minifier
// that emitted different bytes for the same input would turn that gate into a
// coin flip. terser is deterministic for fixed input and fixed options, and the
// version is pinned by package-lock.json — every workflow installs with
// `npm ci`, never `npm install`, so the pin is what runs.
//
// CSS IS SQUEEZED TOO, BY minifyCss BELOW, and for the same reason as the JS:
// by 2026-09-26 the two <style> blocks had grown to ~266 KB, a third of it
// comments and indentation. There is still no CSS parser in this repo and still
// no case for adding one, so minifyCss is a TOKEN-LEVEL squeeze that only
// removes what the CSS grammar never reads: comments, and whitespace that no
// token boundary depends on. It does not reorder, merge, shorten or drop a
// single rule, selector or value — the same "reprint, change nothing else"
// contract terser runs under here. check_minified_equivalence.js parses both
// builds' stylesheets in Chromium and requires identical CSSOM, so a squeeze
// that changed meaning (a lost descendant combinator, `calc(1px+2px)`, a
// merged `and(`) fails that gate rather than shipping.

'use strict';
const { minify_sync } = require('terser');

// Fixed, and fixed deliberately: see the three-row table above. `compress` and
// `mangle` are OFF because they buy 0.6% and cost invariants.
const OPTIONS = {
  compress: false,
  mangle: false,
  format: { comments: false },
};

// Minify one classic-script source. `label` names the file or chunk it came
// from, so a parse failure says which of nineteen blocks was at fault instead of
// reporting a character offset into an anonymous string.
function minifyJs(code, label) {
  if (!code.trim()) return code;
  let result;
  try {
    result = minify_sync(code, OPTIONS);
  } catch (e) {
    const where = e.line != null ? ` at line ${e.line}, col ${e.col}` : '';
    throw new Error(`minify failed for ${label}${where}: ${e.message}`);
  }
  if (result.error) throw new Error(`minify failed for ${label}: ${result.error.message}`);
  if (typeof result.code !== 'string') throw new Error(`minify produced no output for ${label}`);
  return result.code;
}

// Squeeze one stylesheet. Whitespace is dropped only where the tokenizer
// cannot see it: around `{ } ; ,`, after `(` and `:`, before `)` and `!`; the
// last `;` of a block goes too. Everywhere else a run of whitespace becomes one
// space, because there it can be a descendant combinator (`.a .b`), a pseudo
// class boundary (`.a :hover`), or a separator a function token would swallow
// (`and (`, `1px + 2px`). Strings are copied byte-for-byte. A comment is
// removed without a trace unless it was the only thing between two word
// characters, where it becomes a space rather than fusing two tokens.
function minifyCss(css, label) {
  const WS = /[ \t\n\r\f]/;
  const WORD = /[\w-]/;
  const DROP_AROUND = '{};,';
  let out = '';
  let pending = false; // a whitespace run is waiting to be written
  const flush = () => {
    if (pending && out) out += ' ';
    pending = false;
  };
  const n = css.length;
  let i = 0;
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end < 0) throw new Error(`minifyCss failed for ${label}: unterminated comment`);
      if (!pending && WORD.test(out.slice(-1)) && WORD.test(css[end + 2] || '')) pending = true;
      i = end + 2;
      continue;
    }
    if (WS.test(c)) {
      pending = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && css[j] !== c) {
        if (css[j] === '\\') j++;
        else if (css[j] === '\n')
          throw new Error(`minifyCss failed for ${label}: unterminated string`);
        j++;
      }
      if (j >= n) throw new Error(`minifyCss failed for ${label}: unterminated string`);
      flush();
      out += css.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (DROP_AROUND.includes(c)) {
      pending = false;
      if (c === '}' && out.endsWith(';')) out = out.slice(0, -1);
      out += c;
    } else if (c === ')' || c === '!') {
      pending = false;
      out += c;
    } else if (c === '(' || c === ':') {
      flush();
      out += c;
      // Whitespace after these is never read: `( a` is `(a`, `color: red` is
      // `color:red`. Whitespace BEFORE `:` is kept (`.a :hover` is a combinator).
      while (i + 1 < n && WS.test(css[i + 1])) i++;
    } else {
      flush();
      out += c;
    }
    i++;
    if (DROP_AROUND.includes(c)) while (i < n && WS.test(css[i])) i++;
  }
  return out;
}

module.exports = { minifyJs, minifyCss, OPTIONS };
