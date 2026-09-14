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
// NOT MINIFIED HERE: CSS. The two <style> blocks are 131,445 bytes, 2.1% of the
// page, and squeezing them needs a CSS parser this repo does not have. Adding a
// dependency to chase 2% of the raw bytes -- well under 1% after gzip -- is a
// worse trade than leaving it, and leaving it is reversible.

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

module.exports = { minifyJs, OPTIONS };
