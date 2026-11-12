// #670 row 205. DOM contract scenarios, not host/engine integration.
// Run: node prototype/scenarios/instrument-output/output.cjs
// Optional browser: node prototype/scenarios/instrument-output/output.cjs --browser
// Captured by the source oracle from production fd16719d46217adc9b57ef939c9497e29e77741c.
// The 16 raw strings below retain exact UTF-8 bytes and no trailing newline.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const sourcePath = path.resolve(__dirname, '../../features/instrument-output/output.js');
const cssPath = path.resolve(__dirname, '../../features/instrument-output/output.css');
const source = fs.readFileSync(sourcePath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const digest = (text) => crypto.createHash('sha256').update(text).digest('hex');
const FIXTURES = [
  {
    key: 'oud-default.rich',
    format: 'rich',
    text: 'taqsim-roaming oud: spruce-face walnut-ribs nylon arab-school canonical-mid-tier pyramid tarab-suited full-spectrum vocal-imitating microtonal soft-attack low-mid-rich-spectrum ornamented classical traditional.',
    sha256: '7be89b255063a291f44cedf725af941d88a7c9b5b67d585602b308d0a0cf26bd',
  },
  {
    key: 'oud-default.tags',
    format: 'tags',
    text: 'taqsim-roaming oud: spruce-face walnut-ribs nylon arab-school canonical-mid-tier pyramid tarab-suited full-spectrum vocal-imitating microtonal soft-attack low-mid-rich-spectrum ornamented classical traditional.',
    sha256: '7be89b255063a291f44cedf725af941d88a7c9b5b67d585602b308d0a0cf26bd',
  },
  {
    key: 'oud-default.prose',
    format: 'prose',
    text: 'taqsim-roaming oud: ornamented, microtonal, low-mid-rich-spectrum, vocal-imitating, tarab-suited, full-spectrum, classical, traditional, soft-attack, walnut-ribs, canonical-mid-tier, spruce-face, pyramid, nylon, arab-school',
    sha256: '494e1b907cd1ee2a614f7e5e1918337df785bd4c656c041a6013ac84a44939e5',
  },
  {
    key: 'oud-default.compact',
    format: 'compact',
    text: 'taqsim-roaming oud',
    sha256: 'c9b40556c3e2636b89a84c0a97ca158bb69b3f37beb4b1d8a2466f4b11925348',
  },
  {
    key: 'oud-part-edited.rich',
    format: 'rich',
    text: 'taqsim-roaming oud: spruce-face walnut-ribs nylon arab-school canonical-mid-tier pyramid tarab-suited full-spectrum vocal-imitating soft-attack low-mid-rich-spectrum ornamented sustained classical traditional.',
    sha256: '36490d0d9e52d0e91201e85745f2b94fa3365fbd234025a647a5fe63ca23c04c',
  },
  {
    key: 'oud-part-edited.tags',
    format: 'tags',
    text: 'taqsim-roaming oud: spruce-face walnut-ribs nylon arab-school canonical-mid-tier pyramid tarab-suited full-spectrum vocal-imitating soft-attack low-mid-rich-spectrum ornamented sustained classical traditional.',
    sha256: '36490d0d9e52d0e91201e85745f2b94fa3365fbd234025a647a5fe63ca23c04c',
  },
  {
    key: 'oud-part-edited.prose',
    format: 'prose',
    text: 'taqsim-roaming oud: ornamented, sustained, low-mid-rich-spectrum, vocal-imitating, tarab-suited, full-spectrum, classical, traditional, soft-attack, walnut-ribs, canonical-mid-tier, spruce-face, pyramid, nylon, arab-school',
    sha256: '8ee24aa0ece98f3e3a98d3846420e76f2de0cfc9fa7d2dd95495f590051f4a8d',
  },
  {
    key: 'oud-part-edited.compact',
    format: 'compact',
    text: 'taqsim-roaming oud',
    sha256: 'c9b40556c3e2636b89a84c0a97ca158bb69b3f37beb4b1d8a2466f4b11925348',
  },
  {
    key: 'banjo-bluegrass.rich',
    format: 'rich',
    text: 'bellowing five-string banjo: 3-ply-maple maple-ebony-cap medium-steel calfskin bronze hide bluegrass-setup fixed-height ghs-pf135 gibson-mastertone-canon high-projection mastertone-flathead picks-and-thumbpick scruggs-stelling bluegrass-canon natural-material-resonance rolling loud low-mid-rich-spectrum treble-extended focused ringing projecting vintage traditional, bluegrass-high-lonesome-pentatonic-vocabulary: bluegrass-high-lonesome-vocal breakdown-fast-tempo-200-bpm fiddle-cross-tuning-old-time mandolin-chop-and-tremolo pentatonic-and-mixolydian-mode-vocabulary three-finger-banjo-roll, bristol-sessions-appalachian-pre-commercial-context-1927-onward: appalachian-old-time-and-mountain-music bristol-tennessee-virginia-border electrical-disc-cut-recording pre-commercial-country-foundational victor-talking-machine-co, microphone-rca-77-dx-ribbon-1954: polydirectional-pattern-control top-rolled-off-10k classic-broadcast ribbon body-resonance-low-mid vintage, preamplifier-tube-vintage-character: headroom-modest even-harmonic-rich tube transformer-coupled-output colored vintage, compression-optical-classic-la-2a-school: losangeles-2a 2h-rich long-attack-LDR-thermal program-dependent-release optical compressor tube vintage, equalizer-pultec-style-passive-program: pultec passive-LC-low-shelf-up simultaneous-boost-cut broad-q program-eq vintage, medium-analog-tape-15-ips: tape bias-bump-low-mid head-bump-narrow-format reel-to-reel saturation-distortion-headroom hf-compression-natural analog vintage, console-color-colored-vintage-transformer-iron: transformer-iron iron-bus-saturation summing-bus-saturation transformer-coupled-channel console colored vintage.',
    sha256: 'babfb470eda5e4aa856ace4f0258113d2d52ef95b99170192065847120b28820',
  },
  {
    key: 'banjo-bluegrass.tags',
    format: 'tags',
    text: 'bellowing five-string-banjo: 3-ply-maple maple-ebony-cap medium-steel calfskin bronze hide bluegrass-setup fixed-height ghs-pf135 gibson-mastertone-canon high-projection mastertone-flathead picks-and-thumbpick scruggs-stelling bluegrass-canon natural-material-resonance rolling loud low-mid-rich-spectrum treble-extended focused ringing projecting vintage traditional, bluegrass-high-lonesome-pentatonic-vocabulary: bluegrass-high-lonesome-vocal breakdown-fast-tempo-200-bpm fiddle-cross-tuning-old-time mandolin-chop-and-tremolo pentatonic-and-mixolydian-mode-vocabulary three-finger-banjo-roll, bristol-sessions-appalachian-pre-commercial-context-1927-onward: appalachian-old-time-and-mountain-music bristol-tennessee-virginia-border electrical-disc-cut-recording pre-commercial-country-foundational victor-talking-machine-co, microphone-rca-77-dx-ribbon-1954: polydirectional-pattern-control top-rolled-off-10k classic-broadcast ribbon body-resonance-low-mid vintage, preamplifier-tube-vintage-character: headroom-modest even-harmonic-rich tube transformer-coupled-output colored vintage, compression-optical-classic-la-2a-school: losangeles-2a 2h-rich long-attack-LDR-thermal program-dependent-release optical compressor tube vintage, equalizer-pultec-style-passive-program: pultec passive-LC-low-shelf-up simultaneous-boost-cut broad-q program-eq vintage, medium-analog-tape-15-ips: tape bias-bump-low-mid head-bump-narrow-format reel-to-reel saturation-distortion-headroom hf-compression-natural analog vintage, console-color-colored-vintage-transformer-iron: transformer-iron iron-bus-saturation summing-bus-saturation transformer-coupled-channel console colored vintage.',
    sha256: '933221ff30facf5c2f5b563c0247f030cf5dcf433e9278a2f27231eb53cfccca',
  },
  {
    key: 'banjo-bluegrass.prose',
    format: 'prose',
    text: 'bellowing five-string banjo: loud, treble-extended, projecting, ringing, bronze, low-mid-rich-spectrum, natural-material-resonance, vintage, calfskin, hide, focused, traditional, rolling, bluegrass, 3-ply-maple, gibson-mastertone-canon, high-projection, maple, bluegrass-canon, medium-steel, ghs-pf135, maple-ebony-cap, fixed-height, scruggs-stelling, bluegrass-setup, mastertone-flathead, picks-and-thumbpick · Bluegrass high-lonesome pentatonic vocabulary (bluegrass-high-lonesome-vocal, pentatonic-and-mixolydian-mode-vocabulary, three-finger-banjo-roll, mandolin-chop-and-tremolo, fiddle-cross-tuning-old-time, breakdown-fast-tempo-200-bpm) · Bristol Sessions Appalachian pre-commercial context (1927 onward) (bristol-tennessee-virginia-border, victor-talking-machine-co, pre-commercial-country-foundational, appalachian-old-time-and-mountain-music, electrical-disc-cut-recording) · microphone: RCA 77-DX (ribbon, 1954) (top-rolled-off-10k, body-resonance-low-mid, polydirectional-pattern-control, ribbon, vintage, classic-broadcast) · preamplifier: Tube (vintage character) (even-harmonic-rich, transformer-coupled-output, headroom-modest, tube, vintage, colored) · compression: Optical classic (LA-2A-school) (long-attack-LDR-thermal, program-dependent-release, 2h-rich, optical, losangeles-2a, compressor, ldr, tube, vintage) · equalizer: Pultec-style passive program (passive-LC-low-shelf-up, simultaneous-boost-cut, broad-q, passive, program-eq, pultec, vintage) · medium: Analog tape (15 ips) (bias-bump-low-mid, head-bump-narrow-format, hf-compression-natural, saturation-distortion-headroom, tape, analog, reel-to-reel, vintage) · console color: Colored (vintage transformer-iron) (transformer-coupled-channel, iron-bus-saturation, summing-bus-saturation, console, colored, transformer, vintage, transformer-iron)',
    sha256: '970443c49a8d15bee51e45a1d1d62da65db07a45d493434a6f8d04341a79c8ea',
  },
  {
    key: 'banjo-bluegrass.compact',
    format: 'compact',
    text: 'bellowing five-string banjo · Bluegrass high-lonesome pentatonic vocabulary · Bristol Sessions Appalachian pre-commercial context (1927 onward) · microphone: RCA 77-DX (ribbon, 1954) · preamplifier: Tube (vintage character) · compression: Optical classic (LA-2A-school) · equalizer: Pultec-style passive program · medium: Analog tape (15 ips) · console color: Colored (vintage transformer-iron)',
    sha256: '85a691be9fc76d17a5e3b4566528c4f8bd2ed8a4baf4380c61bd07764321b3a1',
  },
  {
    key: 'voice-default.rich',
    format: 'rich',
    text: 'eye-watering voice: contemporary-commercial continuous-phonation equal-tempered-12-fixed-pitch minimal-AES-narrowing mixed-belt modern-pop-training no-specific-ornament-system plain-direct-line rounded-even-pulse single-lead-single-track-no-stacking single-source-phonation solo-unaccompanied speech-derived speech-quality-modal-neutral-larynx standard-fold-vibration studio-ready syllabic-singing-one-note-per-syllable text-forward unprocessed-natural-acoustic warm-low-mid-resonance slow-rate covered vibrato-rich chest-resonance-low-mid flowing thick ringing western-default classical connected grounded expressive.',
    sha256: 'a97266deb0d5dcfd9c7c27a55fef8ce4f92b6b826661c02da6ee63b1b557e654',
  },
  {
    key: 'voice-default.tags',
    format: 'tags',
    text: 'eye-watering voice: contemporary-commercial continuous-phonation equal-tempered-12-fixed-pitch minimal-AES-narrowing mixed-belt modern-pop-training no-specific-ornament-system plain-direct-line rounded-even-pulse single-lead-single-track-no-stacking single-source-phonation solo-unaccompanied speech-derived speech-quality-modal-neutral-larynx standard-fold-vibration studio-ready syllabic-singing-one-note-per-syllable text-forward unprocessed-natural-acoustic warm-low-mid-resonance slow-rate covered vibrato-rich chest-resonance-low-mid flowing thick ringing western-default classical connected grounded expressive.',
    sha256: 'a97266deb0d5dcfd9c7c27a55fef8ce4f92b6b826661c02da6ee63b1b557e654',
  },
  {
    key: 'voice-default.prose',
    format: 'prose',
    text: 'eye-watering voice: thick, grounded, speech-derived, covered, ringing, vibrato-rich, slow-rate, rounded-even-pulse, warm-low-mid-resonance, chest-resonance-low-mid, expressive, classical, continuous-phonation, connected, flowing, equal-tempered, western-default, modern-pop-training, contemporary-commercial, mixed-belt, studio-ready, single-source-phonation, standard-fold-vibration, speech-quality-modal-neutral-larynx, minimal-AES-narrowing, one-note-per-syllable, text-forward, plain-direct-line, syllabic-singing-one-note-per-syllable, solo-unaccompanied, no-specific-ornament-system, equal-tempered-12-fixed-pitch, unprocessed-natural-acoustic, single-lead-single-track-no-stacking',
    sha256: '94aba9127e454c12815540544bac00d31d286d9df8e58e788c3afa25acf0c91c',
  },
  {
    key: 'voice-default.compact',
    format: 'compact',
    text: 'eye-watering voice',
    sha256: '6d54fe4030853710912658ed86887c6ecbbc29319ee7cc7a833b43572d1de653',
  },
];
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function frozen(value) {
  return Object.freeze({
    status: 'ready',
    error: null,
    instrumentId: 'oud',
    revision: 1,
    format: 'rich',
    text: FIXTURES[0].text,
    ...value,
  });
}
function adapter(initial = frozen(), announce = () => {}) {
  let state = initial;
  const listeners = new Set();
  const calls = [];
  let copying = () => Promise.resolve({ ok: true });
  let directCopyError = null;
  const api = Object.freeze({
    snapshot: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setFormat(...args) {
      assert.equal(args.length, 1, 'setFormat has exactly one argument');
      const [format] = args;
      if (!['rich', 'tags', 'prose', 'compact'].includes(format)) throw new TypeError(format);
      calls.push(['format', format]);
      state = frozen({ ...state, format, revision: state.revision + 1 });
      for (const fn of listeners) fn();
      return undefined;
    },
    copy(...args) {
      assert.equal(args.length, 0, 'copy must not receive guessed revision/text parameters');
      calls.push(['copy']);
      if (directCopyError) throw directCopyError;
      // Host-owned outcome simulation, not the real clipboard adapter.
      let pending;
      try {
        pending = copying();
      } catch (error) {
        pending = Promise.reject(error);
      }
      return Promise.resolve(pending).then(
        (receipt) => {
          announce(receipt.ok ? 'Copied' : 'Copy failed — select the text instead');
          return receipt;
        },
        (error) => {
          // A deliberately faulty rejecting host still must not cause a lane duplicate.
          announce('Copy failed — select the text instead');
          throw error;
        }
      );
    },
  });
  return {
    api,
    calls,
    listeners,
    copyWith(fn) {
      copying = fn;
    },
    throwFromCopy(error) {
      directCopyError = error;
    },
    update(next, notify = true) {
      state = frozen({ ...state, ...next });
      if (notify) for (const fn of [...listeners]) fn();
    },
  };
}

async function run(candidate = source) {
  const mount = new Function(
    candidate.replace('export function mount', 'function mount') + '\nreturn mount;'
  )();
  const dom = new JSDOM(
    '<!doctype html><style></style><button id="outside">Outside</button><div id="a"></div><div id="b"></div>',
    { pretendToBeVisual: true }
  );
  const doc = dom.window.document;
  doc.querySelector('style').textContent = css;
  const host = doc.getElementById('a');
  const second = doc.getElementById('b');
  const controller = new dom.window.AbortController();
  const hostAnnouncements = [];
  const mock = adapter(frozen(), (text) => hostAnnouncements.push(text));
  const announcements = [];
  const ctx = Object.freeze({
    output: mock.api,
    signal: controller.signal,
    announce: (s) => announcements.push(s),
  });
  const handle = mount(host, ctx);
  let checks = 0;
  const check = (condition, message) => {
    assert(condition, message);
    checks++;
  };
  const pre = () => host.querySelector('.io-text');
  const count = () => host.querySelector('.io-foot span');
  const copy = () => host.querySelector('.io-copy');
  function onlyHost(expected, label) {
    assert.deepEqual(hostAnnouncements, expected, label);
    checks++;
    check(announcements.length === 0, label + ': no lane announcement');
    check(
      !host.querySelector('.io-result,[role="status"],[aria-live]'),
      label + ': no duplicate result/status node'
    );
    check(
      !host.textContent.includes('Copied') && !host.textContent.includes('Copy failed'),
      label + ': no duplicate visible outcome'
    );
  }
  try {
    assert.deepEqual(
      [...host.querySelectorAll('[data-output-format]')].map((b) => [
        b.dataset.outputFormat,
        b.textContent,
      ]),
      [
        ['rich', 'Rich'],
        ['tags', 'Tags'],
        ['prose', 'Prose'],
        ['compact', 'Compact'],
      ]
    );
    checks++;
    check(
      host.querySelector('[role="group"]').getAttribute('aria-label') === 'Output format',
      'format group label'
    );
    check(!host.querySelector('[download],a'), 'no downloads');
    for (const fixture of FIXTURES) {
      assert.equal(digest(fixture.text), fixture.sha256, fixture.key);
      checks++;
      mock.update({
        instrumentId: fixture.key.split('.')[0],
        revision: mock.api.snapshot().revision + 1,
        format: fixture.format,
        text: fixture.text,
      });
      assert.deepEqual(Buffer.from(pre().textContent), Buffer.from(fixture.text));
      checks++;
      check(
        count().textContent === `${fixture.text.length.toLocaleString('en')} characters`,
        'UTF16 count'
      );
      check(
        pre().getAttribute('aria-label') === `${fixture.format} output`,
        'pre accessible label'
      );
      check(
        host.querySelectorAll('[aria-pressed="true"]').length === 1 &&
          host.querySelector('[aria-pressed="true"]').dataset.outputFormat === fixture.format,
        'selected format'
      );
    }
    check(
      FIXTURES.some((f) => f.text.length > 1000),
      'real over-ceiling fixture'
    );
    mock.update({ text: '<img src=x onerror=alert(1)> & 🎶\nsecond line', revision: 30 });
    check(!pre().querySelector('*') && pre().textContent.startsWith('<img'), 'text is not HTML');
    check(
      count().textContent === `${mock.api.snapshot().text.length.toLocaleString('en')} characters`,
      'UTF16 supplementary character count'
    );
    mock.update({ text: '', revision: 31 });
    check(
      pre().textContent === 'Nothing configured yet.' &&
        count().textContent === '0 characters' &&
        !copy().disabled,
      'empty-string contract boundary (not a canonical empty card)'
    );
    const tags = host.querySelector('[data-output-format="tags"]');
    tags.focus();
    tags.click();
    check(
      doc.activeElement === tags && mock.calls.at(-1)[1] === 'tags',
      'format action preserves focused node'
    );
    check(mock.api.snapshot().format === 'tags', 'host owns format');
    doc.getElementById('outside').focus();
    mock.update({ revision: 33 });
    check(doc.activeElement.id === 'outside', 'notifications do not steal focus');
    handle.focus();
    check(doc.activeElement === tags, 'focus() selects current format');
    mock.update({ status: 'loading', revision: 34 });
    check(
      host.querySelector('.io-content').hidden && pre().textContent === '' && copy().disabled,
      'loading removes stale output/actions'
    );
    check(
      doc.activeElement === host.querySelector('.io-state'),
      'owned focus survives hidden controls'
    );
    const beforeLoading = mock.calls.length;
    copy().click();
    tags.click();
    check(mock.calls.length === beforeLoading, 'loading actions do not run');
    const supplied = 'Instrument data could not be verified. Retry from the catalog. <safe text>';
    mock.update({
      status: 'error',
      error: Object.freeze({ code: 'CATALOG', message: supplied }),
      revision: 35,
    });
    check(
      host.querySelector('.io-state').textContent === supplied &&
        !host.querySelector('.io-state').children.length,
      'supplied safe error wording'
    );
    mock.update({ status: 'ready', error: null, text: FIXTURES[0].text, revision: 36 });
    check(
      doc.activeElement === tags,
      'loading/error to ready restores owned focus to current format'
    );
    let withinClick = false;
    mock.copyWith(() => {
      check(withinClick, 'copy callback entered synchronously during click dispatch');
      return Promise.resolve({ ok: true });
    });
    const copyNode = copy();
    copyNode.focus();
    withinClick = true;
    copyNode.click();
    withinClick = false;
    await tick();
    const expected = ['Copied'];
    onlyHost(expected, 'success');
    check(doc.activeElement === copyNode, 'success retains focused Copy node');
    mock.copyWith(() => Promise.resolve({ ok: false }));
    copyNode.click();
    await tick();
    expected.push('Copy failed — select the text instead');
    onlyHost(expected, 'false/no-clipboard receipt');
    check(doc.activeElement === copyNode, 'failure retains focused Copy node');
    mock.copyWith(() => Promise.reject(new Error('clipboard denied')));
    copyNode.click();
    await tick();
    expected.push('Copy failed — select the text instead');
    onlyHost(expected, 'defensive rejecting-host case');
    mock.copyWith(() => {
      throw new Error('clipboard unavailable');
    });
    copyNode.click();
    await tick();
    expected.push('Copy failed — select the text instead');
    onlyHost(expected, 'defensive host-operation throw');
    // Unlike the internal operation above, this faulty adapter throws directly
    // from output.copy(), before creating a promise or announcing anything.
    const directError = new Error('direct output.copy() throw');
    const leaked = [];
    const captureError = (event) => {
      leaked.push(event.error);
      event.preventDefault();
    };
    const beforeDirectThrow = host.innerHTML;
    const callsBeforeDirectThrow = mock.calls.length;
    mock.throwFromCopy(directError);
    dom.window.addEventListener('error', captureError);
    try {
      // DOM event dispatch reports listener exceptions via Window error events;
      // doesNotThrow alone would miss that path in both jsdom and browsers.
      assert.doesNotThrow(() => copyNode.click());
      checks++;
      await tick();
      check(mock.calls.length === callsBeforeDirectThrow + 1, 'direct throwing copy was invoked');
      assert.deepEqual(leaked, [], 'no synchronous exception escapes through DOM error reporting');
      checks++;
      onlyHost(expected, 'direct throwing host produces no invented lane outcome');
      check(host.innerHTML === beforeDirectThrow, 'direct throw leaves lane DOM unchanged');
      check(doc.activeElement === copyNode, 'direct throw retains focused Copy node');
    } finally {
      dom.window.removeEventListener('error', captureError);
      mock.throwFromCopy(null);
    }

    mock.copyWith(() => Promise.resolve({ ok: true }));
    copyNode.click();
    await tick();
    copyNode.click();
    await tick();
    expected.push('Copied', 'Copied');
    onlyHost(expected, 'repeated Copy announces once per invocation');
    const older = deferred(),
      newer = deferred();
    mock.copyWith(() => older.promise);
    copyNode.click();
    mock.copyWith(() => newer.promise);
    copyNode.click();
    newer.resolve({ ok: false });
    await tick();
    older.resolve({ ok: true });
    await tick();
    expected.push('Copy failed — select the text instead', 'Copied');
    onlyHost(expected, 'reordered receipts remain exclusively host-owned');
    check(doc.activeElement === copyNode, 'reordered receipts do not move Copy focus');
    const stale = deferred();
    mock.copyWith(() => stale.promise);
    copyNode.click();
    mock.update({ instrumentId: 'voice', revision: 37, text: FIXTURES.at(-1).text });
    const newText = pre().textContent;
    doc.getElementById('outside').focus();
    stale.resolve({ ok: true });
    await tick();
    expected.push('Copied');
    onlyHost(expected, 'stale result has one host announcement and no lane result');
    check(
      pre().textContent === newText && doc.activeElement.id === 'outside',
      'stale receipt leaves current text and external focus alone'
    );
    const unnotified = deferred();
    mock.copyWith(() => unnotified.promise);
    copyNode.click();
    mock.update({ instrumentId: 'oud', revision: 38 }, false);
    const beforeReceipt = host.innerHTML;
    unnotified.resolve({ ok: true });
    await tick();
    expected.push('Copied');
    onlyHost(expected, 'unnotified replacement has no receipt-driven lane output');
    check(host.innerHTML === beforeReceipt, 'copy receipt is not a snapshot notification');
    const beforeStaleClick = mock.calls.length;
    mock.update({ revision: 39 }, false);
    copy().click();
    check(
      mock.calls.length === beforeStaleClick,
      'stale queued click does not copy replacement preview'
    );
    const otherController = new dom.window.AbortController();
    const other = adapter(frozen({ instrumentId: 'voice', text: 'other host' }));
    const otherHandle = mount(
      second,
      Object.freeze({ output: other.api, signal: otherController.signal, announce: ctx.announce })
    );
    check(second.querySelector('.io-text').textContent === 'other host', 'independent host');
    const late = deferred();
    mock.copyWith(() => late.promise);
    const oldButton = copy();
    oldButton.click();
    controller.abort();
    late.resolve({ ok: true });
    await tick();
    expected.push('Copied');
    onlyHost(expected, 'late outcome after abort stays host-owned');
    check(!host.children.length && mock.listeners.size === 0, 'abort removes root/subscription');
    const afterDispose = mock.calls.length;
    oldButton.click();
    mock.update({ revision: 40 });
    handle.focus();
    handle.unmount();
    check(
      mock.calls.length === afterDispose && !host.children.length,
      'detached listeners and disposed handle inert'
    );
    check(second.querySelector('.io-text').textContent === 'other host', 'teardown stays scoped');
    otherHandle.unmount();
    otherHandle.unmount();
    check(other.listeners.size === 0 && !second.children.length, 'idempotent unmount');
    const aborted = new dom.window.AbortController();
    aborted.abort();
    const untouched = adapter();
    mount(host, { output: untouched.api, signal: aborted.signal, announce: ctx.announce });
    check(!host.children.length && untouched.listeners.size === 0, 'already-aborted mount inert');
    check(
      announcements.length === 0,
      'confirmed shell announcement ownership: lane remains silent'
    );
    check(
      dom.window.getComputedStyle(pre() || doc.createElement('pre')) !== null,
      'DOM environment valid'
    );
    check(
      /white-space:\s*pre-wrap/.test(css) && /overflow-wrap:\s*anywhere/.test(css),
      'source wrapping retained'
    );
    check(
      css
        .split('}')
        .filter((s) => s.trim())
        .every((s) =>
          s
            .split('{')[0]
            .split(',')
            .every((selector) => selector.trim().startsWith('.io-output'))
        ),
      'all CSS selectors scoped'
    );
    return checks;
  } finally {
    handle.unmount();
    dom.window.close();
  }
}

async function browser() {
  const { chromium } = require('playwright');
  // Never disable the Chromium sandbox, grant clipboard permissions, or retry
  // a failed launch with weaker settings. This mode qualifies fixture DOM only.
  const instance = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    chromiumSandbox: true,
    headless: true,
  });
  try {
    const page = await instance.newPage();
    await page.setContent('<!doctype html><div id="host"></div>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ type: 'module', content: source + '\nwindow.outputMount = mount;' });
    const results = await page.evaluate(async (fixtures) => {
      const host = document.getElementById('host');
      const controller = new AbortController();
      let snapshot;
      let notify;
      const context = Object.freeze({
        signal: controller.signal,
        announce() {},
        output: Object.freeze({
          snapshot: () => snapshot,
          subscribe(fn) {
            notify = fn;
            return () => {};
          },
          setFormat() {},
          copy: () => Promise.resolve({ ok: false }),
        }),
      });
      snapshot = Object.freeze({
        status: 'ready',
        error: null,
        instrumentId: 'oud',
        revision: 1,
        format: 'rich',
        text: fixtures[0].text,
      });
      const handle = window.outputMount(host, context);
      for (const [i, f] of fixtures.entries()) {
        snapshot = Object.freeze({ ...snapshot, revision: i + 2, format: f.format, text: f.text });
        notify();
        if (host.querySelector('pre').textContent !== f.text)
          throw new Error(f.key + ' browser byte text mismatch');
      }
      handle.unmount();
      return { formatCases: fixtures.length, clipboard: 'not executed; fixture callback only' };
    }, FIXTURES);
    console.log(JSON.stringify({ browser: results }));
  } finally {
    await instance.close();
  }
}

async function main() {
  if (process.argv.includes('--browser')) return browser();
  const checks = await run();
  const mutations = [
    ['truncate', 'pre.textContent = next.text ||', 'pre.textContent = next.text.slice(0, 1000) ||'],
    [
      'UTF8 count',
      "next.text.length.toLocaleString('en')",
      "new TextEncoder().encode(next.text).length.toLocaleString('en')",
    ],
    ['HTML injection', 'pre.textContent = next.text ||', 'pre.innerHTML = next.text ||'],
    [
      'deferred copy',
      'const pending = output.copy();',
      'const pending = Promise.resolve().then(() => output.copy());',
    ],
    [
      'guessed copy argument',
      'const pending = output.copy();',
      'const pending = output.copy(shown.revision);',
    ],
    [
      'synchronous copy exception escapes',
      '} catch {\n      // The contract resolves',
      '} catch (error) {\n      throw error;\n      // The contract resolves',
    ],
    ['missing unsubscribe', 'unsubscribe?.();', '/* missing unsubscribe */'],
    ['lost ready focus', 'if (stateFocused) {', 'if (false) {'],
    [
      'duplicate lane announcement',
      'const pending = output.copy();',
      "const pending = output.copy(); ctx.announce('Copied');",
    ],
    [
      'duplicate visual result',
      'const pending = output.copy();',
      "const pending = output.copy(); const duplicate = doc.createElement('p'); duplicate.textContent = 'Copied'; root.append(duplicate);",
    ],
    [
      'receipt steals focus',
      'Promise.resolve(pending).catch(() => {});',
      'Promise.resolve(pending).then(() => copyButton.focus(), () => {});',
    ],
  ];
  const caught = [];
  for (const [name, from, to] of mutations) {
    assert(source.includes(from), `mutation anchor ${name}`);
    await assert.rejects(run(source.replace(from, to)), undefined, `mutation must fail: ${name}`);
    caught.push(name);
  }
  console.log(
    JSON.stringify(
      {
        checks,
        realFixtureCases: FIXTURES.length,
        mutationsCaught: caught,
        browser: 'not run in DOM mode',
        clipboard: 'mock callback only; no system clipboard evidence',
      },
      null,
      2
    )
  );
}

if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { run, FIXTURES };
