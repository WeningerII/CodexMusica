// Function-local mangling must preserve the classic-script boundary and names
// used by callbacks, dynamic access and diagnostics. Also run by the existing
// minified-equivalence gate, against separately evaluated source scripts.
'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { minifyJs } = require('./_minify.js');

function checkRuntimeMinify() {
  const blocks = [
    `const SHARED_VALUE = 7;
     let sharedCounter = 0;
     function sharedCallback(value) { const longLocalValue = value + SHARED_VALUE; return longLocalValue; }
     (() => {
       const descriptiveLocalValue = 3;
       function namedCallback() { return descriptiveLocalValue; }
       const arrowCallback = () => descriptiveLocalValue;
       class NamedClass { value() { return descriptiveLocalValue; } }
       globalThis.localAPI = { namedCallback, arrowCallback, NamedClass };
     })();`,
    `const key = 'namedCallback';
     const evaluated = (() => { const visibleToEval = 19; return eval('visibleToEval'); })();
     sharedCounter++;
     globalThis.result = [SHARED_VALUE, sharedCounter, sharedCallback(2),
       globalThis['sharedCallback'](4), localAPI[key](), localAPI.namedCallback.name,
       localAPI.arrowCallback.name, localAPI.NamedClass.name,
       new localAPI.NamedClass().value(), evaluated];`,
  ];
  const run = (code) => {
    const context = vm.createContext({});
    for (const block of code) vm.runInContext(block, context);
    return JSON.stringify(context.result);
  };
  const transformed = blocks.map((code) => minifyJs(code, 'runtime: test'));
  assert.equal(run(transformed), run(blocks));
  assert.equal(run(transformed), '[7,1,9,11,3,"namedCallback","arrowCallback","NamedClass",3,19]');
  assert.ok(
    !transformed[0].includes('longLocalValue'),
    'control: local identifiers actually shorten'
  );
  assert.ok(transformed[0].includes('SHARED_VALUE'), 'cross-script lexical globals retain names');
  assert.ok(
    minifyJs(blocks[0], 'data: test').includes('longLocalValue'),
    'data identifiers unchanged'
  );
  assert.equal(minifyJs(blocks[0], 'runtime: test'), transformed[0], 'deterministic output');
  console.log(
    'RUNTIME MINIFY: PASS — globals, properties, callback/class names, eval and determinism'
  );
}
if (require.main === module) checkRuntimeMinify();
module.exports = checkRuntimeMinify;
