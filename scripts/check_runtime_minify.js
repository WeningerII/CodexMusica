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
  // Library factories are registered without executing, then consumed by
  // other chunks through named export properties. Exercise that boundary,
  // including shorthand properties and a reflected callback/class name.
  const factories = [
    `CMLibraryDefine('core', function () {
       factoryRuns++;
       const descriptivePrivateValue = SHARED_VALUE + 5;
       function readValue() { return descriptivePrivateValue; }
       const arrowExport = () => descriptivePrivateValue;
       class Reading { value() { return descriptivePrivateValue; } }
       return { readValue, arrowExport, Reading, 'public-key': descriptivePrivateValue };
     });`,
    `CMLibraryDefine('reader', function () {
       const dependencyExports = registeredFactories.core();
       const dynamicExportKey = 'readValue';
       const visibleToEval = 19;
       return [dependencyExports[dynamicExportKey](), dependencyExports['public-key'],
         dependencyExports.readValue.name, dependencyExports.arrowExport.name,
         dependencyExports.Reading.name, new dependencyExports.Reading().value(),
         eval('visibleToEval')];
     });`,
  ];
  const runFactories = (code) => {
    const context = vm.createContext({});
    vm.runInContext(
      `const SHARED_VALUE = 7;
      let factoryRuns = 0;
      const registeredFactories = {};
      function CMLibraryDefine(name, factory) { registeredFactories[name] = factory; }`,
      context
    );
    for (const factory of code) vm.runInContext(factory, context);
    assert.equal(vm.runInContext('factoryRuns', context), 0, 'registration stays lazy');
    const result = vm.runInContext('JSON.stringify(registeredFactories.reader())', context);
    assert.equal(vm.runInContext('factoryRuns', context), 1);
    return result;
  };
  const shortenedFactories = factories.map((code) =>
    minifyJs(code, 'runtime: library chunk: fixture')
  );
  assert.equal(runFactories(shortenedFactories), runFactories(factories));
  assert.equal(
    runFactories(shortenedFactories),
    '[12,12,"readValue","arrowExport","Reading",12,19]'
  );
  assert.ok(!shortenedFactories[0].includes('descriptivePrivateValue'), 'factory locals shorten');
  assert.ok(
    shortenedFactories[0].includes('CMLibraryDefine'),
    'registration global retains its name'
  );
  assert.ok(
    shortenedFactories[0].includes('SHARED_VALUE'),
    'external lexical global retains its name'
  );
  // Exercise the production classification too: reverting only the build's
  // label must fail this control rather than leave a green synthetic fixture.
  const build = require('fs').readFileSync(
    require('path').join(__dirname, 'build_html.js'),
    'utf8'
  );
  assert.ok(build.includes('`runtime: library chunk: src/library/${file}`'));
  console.log(
    'RUNTIME MINIFY: PASS — globals, properties, callback/class names, eval, lazy factories and determinism'
  );
}
if (require.main === module) checkRuntimeMinify();
module.exports = checkRuntimeMinify;
