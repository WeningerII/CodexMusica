'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { minify } = require('terser');
const check = require('./_check_card_descriptor_semantics.js');
const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const sources = {
  prodNodeSrc: read('scripts/_card_descriptors.js'),
  auditNodeSrc: read('scripts/_matcher.js'),
};
const core = sources.prodNodeSrc
  .split('/* @inline-start')[1]
  .split('\n')
  .slice(1)
  .join('\n')
  .split('/* @inline-end */')[0];
const pretty = `${core}\nfunction _cardDescriptorSet(card) { return harvestDescriptors(card, lookups); }`;

for (const [name, build] of [
  ['source formatting', async () => pretty],
  ['minified parameter names', async () => (await minify(pretty)).code],
  ['shipped HTML', async () => read('codex.html')],
]) {
  test(`descriptor semantics gate accepts ${name} and rejects semantic mutations`, async () => {
    const builtHtml = await build();
    assert.match(check({ ...sources, builtHtml }), /divergence preserved/);
    assert.throws(
      () =>
        check({
          ...sources,
          builtHtml: builtHtml.replace(
            /function harvestDescriptors\(/,
            'function missingHarvester('
          ),
        }),
      /harvestDescriptors not found/
    );
    assert.throws(
      () =>
        check({
          ...sources,
          builtHtml: builtHtml.replace(/function _cardDescriptorSet\(/, 'function missingAdapter('),
        }),
      /browser adapter not found/
    );
    assert.throws(
      () =>
        check({
          ...sources,
          builtHtml: builtHtml.replace(
            /function harvestDescriptors\([^)]*\)\s*\{/,
            '$& void "match_tokens";'
          ),
        }),
      /HTML _cardDescriptorSet references match_tokens/
    );
    assert.throws(
      () =>
        check({
          ...sources,
          builtHtml,
          prodNodeSrc: sources.prodNodeSrc + '\nvoid "match_tokens";',
        }),
      /_card_descriptors.js references match_tokens/
    );
    assert.throws(
      () =>
        check({
          ...sources,
          builtHtml,
          auditNodeSrc: sources.auditNodeSrc.replaceAll('match_tokens', 'descriptors'),
        }),
      /no longer pools match_tokens/
    );
  });
}
