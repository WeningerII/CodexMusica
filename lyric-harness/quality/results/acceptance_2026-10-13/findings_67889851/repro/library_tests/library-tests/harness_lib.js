// Loads the helper half (everything before "// ─── Sections") of a tree's
// scripts/check_library_page.js as a module rooted in that tree, so its static
// server, Render stub and page opener can drive OUR scenarios. Assertions are ours.
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
module.exports = function load(tree) {
  const file = path.join(tree, 'scripts', 'check_library_page.js');
  const src = fs.readFileSync(file, 'utf8');
  const cut = src.indexOf('// ─── Sections');
  if (cut < 0) throw Error('no Sections marker in ' + file);
  const body =
    src.slice(0, cut).replace(/^#!.*\n/, '') +
    '\nmodule.exports = { start, openPage, go, settled, headOf, link, chunksIn, API, EPI_A, EPI_B, short };\n';
  const m = new Module(file + '#helpers', module);
  m.filename = path.join(tree, 'scripts', '__bb8_helpers.js');
  m.paths = Module._nodeModulePaths(path.join(tree, 'scripts'));
  m._compile(body, m.filename);
  m.exports.requireFromTree = Module.createRequire(path.join(tree, 'scripts', 'x.js'));
  return m.exports;
};
