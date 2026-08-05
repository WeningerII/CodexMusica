'use strict';
// _load_app.js — run src/app.js's REAL functions in Node, with no browser.
//
// Extracted from check_app_parity.js so more than one gate can use it. The point
// of every parity gate here is that it calls the app's own code rather than a
// re-implementation of it, and that guarantee is only as good as this loader
// being the single way in — two copies of it would drift, which is precisely the
// failure the gates exist to catch.
//
// Requires _loader.js to have already populated globalThis with the catalog
// (INSTRUMENTS / TRADITIONS / …), because app.js reads them as bare globals.

const fs = require('fs');
const path = require('path');

// Everything a gate might need out of app.js. Adding a name here is free; the
// function has to exist in app.js or the Function constructor throws at build
// time, which is the loud failure we want.
const EXPORTED = [
  'importTradition',
  'compileRecipeStack',
  'app',
  'reconfigureAfterPartEdit',
  'inverseConfigureForPreface',
  'suggestPrefaceForCard',
];

function loadApp() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  // Mirror build_html.js: prepend the card-descriptor harvester (single source
  // scripts/_card_descriptors.js, @inline region) + the _cardDescriptorSet adapter
  // the app's preface dedup calls. We do NOT prepend the family-parts merge snippet:
  // _loader.js already ran mergeFamilyParts on globalThis.INSTRUMENTS, and the merge
  // is not idempotent — re-running it would corrupt the parts both sides read.
  const cdSource = fs.readFileSync(path.join(__dirname, '_card_descriptors.js'), 'utf8');
  const cdMatch = cdSource.match(/\/\* @inline-start[^\n]*\*\/\n([\s\S]*?)\n\/\* @inline-end \*\//);
  if (!cdMatch)
    throw new Error('could not find @inline-start/@inline-end markers in _card_descriptors.js');
  const cardDescriptorsSnippet = `
${cdMatch[1]}
function _cardDescriptorSet(card) {
  return harvestDescriptors(card, {
    inst: (id) => Inst(id),
    tuning: (id) => Tuning(id),
    room: (id) => Room(id),
    chainItem: (stageId, id) => ChainItem(stageId, id),
    signature: (tradId) => _traditionSignatureFor(tradId),
  });
}
`;
  // A self-returning proxy absorbs every DOM call (document.x.y(), addEventListener,
  // etc.) as a no-op so app.js's load-time listeners and any defensive UI calls
  // don't crash. The functions the gates call touch only catalog + app state.
  const sink = new Proxy(function () {}, {
    get: (_t, p) => (p === Symbol.toPrimitive || p === 'toString' ? () => '' : sink),
    apply: () => sink,
    construct: () => sink,
  });
  const factory = new Function(
    'document',
    'window',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'localStorage',
    'navigator',
    'fetch',
    `${cardDescriptorsSnippet}\n${src}\n;return { ${EXPORTED.join(', ')} };`
  );
  return factory(
    sink,
    sink,
    () => 0,
    () => {},
    sink,
    sink,
    () => sink
  );
}

module.exports = { loadApp };
