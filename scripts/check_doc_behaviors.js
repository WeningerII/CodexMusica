#!/usr/bin/env node
// check_doc_behaviors.js — assert the documented BEHAVIORS and OUTPUTS of the
// agent-facing docs, not merely that the commands exit 0.
//
// @covers: documented-behaviors
//
// WHY: the doc gate had a layered blind spot.
//   • check_docs.js          proves the catalog COUNTS in the docs match the data.
//   • check_doc_commands.js  proves every documented command RUNS (exit 0).
//   • regression_recipes.js  snapshots the recipe STRINGS a tradition compiles to.
// None of them checks a documented *argument-parsing contract* or a documented
// *diagnostic-tool output*. That gap let SKILL.md §3f keep warning, as "verified",
// that a bare `--diff <a> <b>` "swallows <a> and dies" long after recipe.js's
// BOOLEAN_FLAGS made every ordering work — a stale dogfooding note no existing gate
// could catch. This closes it: each assertion below pins one documented behavior to
// the SKILL.md section that states it, and fails loudly when reality drifts from the
// prose. Keep the SKILL.md claim and its assertion here updated together.
//
// Usage: node scripts/check_doc_behaviors.js [--verbose]   (exit 0 = all hold)

'use strict';
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const C = require('./_loader.js'); // shipped loader → tradition names without the q.js shim

const ROOT = path.join(__dirname, '..');
const RECIPE = path.join('scripts', 'recipe.js');
const NN = path.join('scripts', 'nearest_neighbor.js');
const PREF = path.join('scripts', 'preface_configure.js');
const VERBOSE = process.argv.includes('--verbose');

// Run a node script; return { code, out }. Never throws on non-zero exit.
function run(args) {
  try {
    const out = execFileSync('node', args, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status == null ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

// Run a node script keeping stdout and stderr apart: { code, out, err }.
function runSplit(args) {
  const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}
// The `note: ` lines recipe.js wrote to stderr.
const stderrNotes = (r) => r.err.split('\n').filter((line) => line.startsWith('note: '));

const tradName = (id) => (C.TRADITIONS.find((t) => t.id === id) || {}).name || id;
const allEqual = (arr) => arr.length > 0 && arr.every((x) => x.length > 0 && x === arr[0]);

const checks = [];
const assert = (section, claim, fn) => checks.push({ section, claim, fn });

// ── §3f — the `--diff` argument-parsing contract (the note that actually rotted) ──
assert(
  '§3f',
  '--diff: every argument ordering is byte-identical, and bare form == default --weight=0.5',
  () => {
    const A = 'delta_blues',
      B = 'detroit_techno';
    const w07 = [
      run([RECIPE, '--diff', '--weight=0.7', A, B]).out, // documented "safe" form
      run([RECIPE, '--diff', A, B, '--weight=0.7']).out, // bare form, weight after
      run([RECIPE, '--diff', A, '--weight=0.7', B]).out, // weight wedged between the ids
    ];
    const w05 = [
      run([RECIPE, '--diff', '--weight=0.5', A, B]).out, // explicit default
      run([RECIPE, '--diff', A, B]).out, // bare, no weight → default 0.5
    ];
    const ok = allEqual(w07) && allEqual(w05) && w07[0] !== w05[0];
    return {
      ok,
      detail: ok
        ? `0.7 group identical (${w07[0].length}b), 0.5 group identical (${w05[0].length}b, bare==explicit-0.5)`
        : `diverged: 0.7 distinct=${new Set(w07).size}/3, 0.5 distinct=${new Set(w05).size}/2, weightMatters=${w07[0] !== w05[0]}`,
    };
  }
);

assert('§3f', '--swap-variant with an unknown variant id is rejected with exit 2', () => {
  const r = run([
    RECIPE,
    '--tradition',
    'delta_blues',
    '--swap-variant=voice:voice_register:__bogus__',
  ]);
  return { ok: r.code === 2, detail: `exit ${r.code}` };
});

// The other half of the swap contract: a VALID swap has to reach the recipe.
// SKILL.md lists this exact command as a verified example of customizing a
// part, and it exited 0 while rendering none of falsetto's words, because the
// voice sentence's score threshold dropped the low-scoring pick the caller had
// named. The words come from the catalog, so a renamed descriptor cannot turn
// this into a silent pass.
assert('§3f', 'a valid --swap-variant reaches the recipe (the documented falsetto swap)', () => {
  const voice = C.INSTRUMENTS.find((i) => i.id === 'voice');
  const part = voice && voice.parts.find((p) => p.id === 'voice_register');
  const variant = part && part.variants.find((v) => v.id === 'falsetto');
  const words = ((variant && variant.descriptors) || []).map((d) => d.replace(/-/g, ' '));
  const r = run([
    RECIPE,
    '--tradition',
    'delta_blues',
    '--swap-variant=voice:voice_register:falsetto',
  ]);
  const shown = words.filter((w) => r.out.toLowerCase().includes(w.toLowerCase()));
  return {
    ok: r.code === 0 && words.length > 0 && shown.length > 0,
    detail: `exit ${r.code}; falsetto words ${JSON.stringify(words)} shown ${JSON.stringify(shown)}`,
  };
});

// The same contract on an instrument part, which goes through a second filter:
// clawhammer scores above the threshold, yet none of its words matched its id
// or passed the trust filter, so the swap exited 0 with the recipe unchanged.
assert('§3f', 'a valid --swap-variant on an instrument part changes the recipe', () => {
  const base = run([RECIPE, '--tradition', 'bluegrass']);
  const r = run([
    RECIPE,
    '--tradition',
    'bluegrass',
    '--swap-variant=banjo_5_string:banjo_play:clawhammer',
  ]);
  return {
    ok: base.code === 0 && r.code === 0 && r.out !== base.out,
    detail: `exit ${r.code}; recipe ${r.out === base.out ? 'unchanged' : 'changed'}`,
  };
});

// A valid swap can still print none of its words, and then it has to say so
// (#671; BB8 6646430850). mpc_modern's only word is the BARE token `modern`,
// which this renderer never prints, so stdout is byte-identical to the run
// without the swap. stdout stays exactly that; stderr names the card and the
// descriptor, and a run without a swap says nothing of the kind. The note says
// where the word is missing from, the card's part of the recipe, and not
// `filtered out of the recipe`, which is false when another card or the header
// prints the same word (BB8 6676262617, call 3).
assert(
  '§3f',
  'a swap whose words the recipe filters out is named on stderr; stdout is unchanged',
  () => {
    const base = runSplit([RECIPE, '--tradition', 'gangsta_rap']);
    const r = runSplit([
      RECIPE,
      '--tradition',
      'gangsta_rap',
      '--swap-variant=sampler_classic:sampler_archetypes:mpc_modern',
    ]);
    const [note = ''] = stderrNotes(r);
    const ok =
      base.code === 0 &&
      r.code === 0 &&
      r.out === base.out &&
      stderrNotes(base).length === 0 &&
      stderrNotes(r).length === 1 &&
      note ===
        "note: --swap-variant descriptor(s) not printed in the sampler_classic card's part of the recipe: modern (sampler_archetypes:mpc_modern)";
    return {
      ok,
      detail: `exit ${r.code}; stdout ${r.out === base.out ? 'unchanged' : 'changed'}; note ${JSON.stringify(note)}`,
    };
  }
);

// The note decides "printed" by the connector's rule (#671): a whole word,
// hyphen as a boundary, anywhere in that card's own clause, whichever part
// printed it. The named set has to be exactly the swap's catalog words absent,
// by an independent whole-word test, from the card's clause on stdout (the
// clause that ends in the card's name), plus any word that clause prints only
// from another card's phrase it pools. Each case checks first that it still
// shows the distinction it is here for:
// - italogaze edge_round: `fundamental` is printed in `low fundamental tuning`
//   (the note used to name it, testing each word against the stack's printed
//   descriptors one by one);
// - the same at --max-chars=270: the trim cuts the drum-kit clause, so every
//   word is named;
// - tanzanian_traditional mubvamaropa: `wood` is printed only inside
//   `hardwood`, which is not the word;
// - quiet_storm khomus_forged_steel: `bright` is printed, but in the
//   semi-hollow guitar's clause, not the Rhodes card's;
// - tropicalia celtic_gut: the humbucker's phrase is pooled into one clause
//   with the classical guitar's, and `classical` there is the classical
//   guitar's name, not the humbucker card's own phrase.
assert(
  '§3f',
  "the swap note names only words its card's own clause does not print as whole words",
  () => {
    const edge = '[\\p{L}\\p{N}\\p{M}_]';
    const whole = (text, w) =>
      new RegExp(`(?<!${edge})${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!${edge})`, 'iu').test(
        text
      );
    const printedIn = (text, d) => [d, d.replace(/-/g, ' ')].some((f) => whole(text, f));
    const cases = [
      {
        tradition: 'italogaze',
        swap: 'drum_kit:bearing_edges:edge_round',
        noun: 'drum kit',
        holds: (clause) => clause !== '' && printedIn(clause, 'fundamental'),
      },
      {
        tradition: 'italogaze',
        extra: ['--max-chars=270'],
        swap: 'drum_kit:bearing_edges:edge_round',
        noun: 'drum kit',
        holds: (clause, out) => clause === '' && !/\bdrum kit\b/.test(out),
      },
      {
        tradition: 'tanzanian_traditional',
        swap: 'acoustic_guitar_om:back_sides:mubvamaropa',
        noun: 'acoustic guitar',
        holds: (clause) => /hardwood/.test(clause) && !printedIn(clause, 'wood'),
      },
      {
        tradition: 'quiet_storm',
        swap: 'rhodes_electric:rhodes_tine_material:khomus_forged_steel',
        noun: 'rhodes electric',
        holds: (clause, out) =>
          clause !== '' && printedIn(out, 'bright') && !printedIn(clause, 'bright'),
      },
      {
        tradition: 'tropicalia',
        swap: 'electric_guitar_humbucker:string_material:celtic_gut',
        noun: 'humbucker electric guitar',
        notOwn: ['classical'],
        holds: (clause) => /\bclassical nylon-string\b/.test(clause),
      },
    ];
    const details = [];
    let ok = true;
    for (const c of cases) {
      const [instId, partId, variantId] = c.swap.split(':');
      const inst = C.INSTRUMENTS.find((i) => i.id === instId);
      const part = inst && inst.parts.find((p) => p.id === partId);
      const variant = part && part.variants.find((v) => v.id === variantId);
      const words = (variant && variant.descriptors) || [];
      const r = runSplit([
        RECIPE,
        '--tradition',
        c.tradition,
        ...(c.extra || []),
        `--swap-variant=${c.swap}`,
      ]);
      const ends = new RegExp(`\\b${c.noun}$`, 'i');
      const clause = r.out.split(/[.,] /).find((x) => ends.test(x)) || '';
      const notes = stderrNotes(r).filter((n) =>
        n.startsWith(`note: --swap-variant descriptor(s) not printed in the ${instId} card's `)
      );
      const m = (notes[0] || '').match(new RegExp(`: ([^:]*) \\(${partId}:${variantId}\\)$`));
      const named = m ? m[1].split(', ') : [];
      const expected = words.filter((d) => !printedIn(clause, d) || (c.notOwn || []).includes(d));
      const caseOk =
        r.code === 0 &&
        words.length > 0 &&
        c.holds(clause, r.out) &&
        notes.length === (expected.length ? 1 : 0) &&
        JSON.stringify(named) === JSON.stringify(expected);
      ok = ok && caseOk;
      details.push(
        `${c.tradition} ${(c.extra || []).join(' ')} ${c.swap}: ${caseOk ? 'ok' : 'FAIL'}; exit ${r.code}; clause ${JSON.stringify(clause)}; named ${JSON.stringify(named)}; expected ${JSON.stringify(expected)}`
      );
    }
    return { ok, detail: details.join(' | ') };
  }
);

// A swap on an instrument the recipe does not have has no card to apply to.
// banjo_5_string is not in gangsta_rap's roster, and --exclude-instrument
// drops sampler_classic. Both exited 0 with stdout byte-identical to the run
// without the swap and nothing on stderr. stdout stays exactly that; stderr
// gets one note per swap with its reason. The exclude is the reason only when
// it removed the instrument: excluding banjo_5_string removes nothing. Under
// --json stdout is the config, unchanged, and stderr gets the same notes;
// under --why-json and --why-prefaces-json stderr is JSON, and the notes are in
// it (the next assertion).
assert(
  '§3f',
  'a swap on an instrument not in the recipe is named on stderr as not applied; stdout is unchanged',
  () => {
    const banjo = ['banjo_5_string:banjo_back:resonator', 'banjo_5_string:tone_ring:tubaphone'];
    const note = (swap, removed) => {
      const instrument = swap.split(':')[0];
      const why = removed
        ? '--exclude-instrument removed it'
        : `add it with --add-instrument=${instrument}`;
      return `note: ${instrument} is not in the recipe, so --swap-variant ${swap} was not applied (${why})`;
    };
    const cases = [
      { base: [], swaps: banjo, removed: false, modes: true },
      {
        base: ['--exclude-instrument=sampler_classic'],
        swaps: ['sampler_classic:sampler_archetypes:mpc_modern'],
        removed: true,
      },
      { base: ['--exclude-instrument=banjo_5_string'], swaps: [banjo[0]], removed: false },
    ];
    const isJson = (text) => {
      try {
        return typeof JSON.parse(text) === 'object';
      } catch {
        return false;
      }
    };
    const details = [];
    let ok = true;
    for (const c of cases) {
      const args = [RECIPE, '--tradition', 'gangsta_rap', ...c.base];
      const swapFlag = `--swap-variant=${c.swaps.join(';')}`;
      const want = JSON.stringify(c.swaps.map((s) => note(s, c.removed)));
      const base = runSplit(args);
      const r = runSplit([...args, swapFlag]);
      let caseOk =
        base.code === 0 &&
        r.code === 0 &&
        r.out === base.out &&
        stderrNotes(base).length === 0 &&
        JSON.stringify(stderrNotes(r)) === want;
      const detail = [`notes ${JSON.stringify(stderrNotes(r))}`];
      if (c.modes) {
        const jsonBase = runSplit([...args, '--json']);
        const json = runSplit([...args, '--json', swapFlag]);
        const jsonOk =
          json.code === 0 &&
          json.out === jsonBase.out &&
          JSON.stringify(stderrNotes(json)) === want;
        detail.push(`--json ${jsonOk ? 'ok' : 'FAIL'}`);
        caseOk = caseOk && jsonOk;
        for (const mode of ['--why-json', '--why-prefaces-json']) {
          const w = runSplit([...args, mode, swapFlag]);
          const wOk = w.code === 0 && w.out === base.out && isJson(w.err);
          detail.push(`${mode} stderr ${wOk ? 'is JSON' : 'FAIL'}`);
          caseOk = caseOk && wOk;
        }
      }
      ok = ok && caseOk;
      details.push(
        `${c.base.join(' ')} ${c.swaps.join(';')}: ${caseOk ? 'ok' : 'FAIL'}; exit ${r.code}; stdout ${r.out === base.out ? 'unchanged' : 'changed'}; ${detail.join('; ')}`
      );
    }
    return { ok, detail: details.join(' | ') };
  }
);

// Under --why-json and --why-prefaces-json stderr is pure JSON, so a note line
// there would break it, and leaving the notes out meant a JSON consumer was
// never told (BB8 6676262617, call 1). The same strings go in a top-level
// `notes` array, added after the existing keys, which do not change: empty
// without a note, the filtered note for mpc_modern, the two not-applied notes
// for the banjo swaps (whose JSON is otherwise the run without them). Under
// --json nothing is rendered, so only the not-applied notes are given.
assert(
  '§3f',
  'under --why-json / --why-prefaces-json the swap notes are in the JSON as `notes`',
  () => {
    const KEYS = {
      '--why-json': ['traditions', 'finalScore', 'breakdown', 'trace', 'slots'],
      '--why-prefaces-json': ['tradition', 'prefaces'],
    };
    const gangsta = [RECIPE, '--tradition', 'gangsta_rap'];
    const banjo = ['banjo_5_string:banjo_back:resonator', 'banjo_5_string:tone_ring:tubaphone'];
    const notApplied = (s) =>
      `note: banjo_5_string is not in the recipe, so --swap-variant ${s} was not applied (add it with --add-instrument=banjo_5_string)`;
    const cases = [
      { extra: [], notes: [] },
      {
        extra: ['--swap-variant=sampler_classic:sampler_archetypes:mpc_modern'],
        notes: [
          "note: --swap-variant descriptor(s) not printed in the sampler_classic card's part of the recipe: modern (sampler_archetypes:mpc_modern)",
        ],
      },
      { extra: [`--swap-variant=${banjo.join(';')}`], notes: banjo.map(notApplied), same: true },
      {
        extra: ['--json', `--swap-variant=${banjo.join(';')}`],
        notes: banjo.map(notApplied),
        same: true,
      },
    ];
    const parse = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };
    const without = (j) => JSON.stringify({ ...j, notes: undefined });
    const details = [];
    let ok = true;
    for (const mode of Object.keys(KEYS)) {
      const base = runSplit([...gangsta, mode]);
      const baseJson = parse(base.err);
      for (const c of cases) {
        const r = runSplit([...gangsta, mode, ...c.extra]);
        const plain = runSplit([...gangsta, ...c.extra]);
        const j = parse(r.err);
        const caseOk =
          r.code === 0 &&
          r.out === plain.out &&
          j !== null &&
          JSON.stringify(Object.keys(j)) === JSON.stringify([...KEYS[mode], 'notes']) &&
          JSON.stringify(j.notes) === JSON.stringify(c.notes) &&
          (!c.same || (baseJson !== null && without(j) === without(baseJson)));
        ok = ok && caseOk;
        details.push(
          `${mode} ${c.extra.join(' ') || '(no swap)'}: ${caseOk ? 'ok' : 'FAIL'}; exit ${r.code}; keys ${j ? JSON.stringify(Object.keys(j)) : 'not JSON'}; notes ${j ? JSON.stringify(j.notes) : '-'}`
        );
      }
    }
    return { ok, detail: details.join(' | ') };
  }
);

// A part swapped twice keeps the later variant, as a card keeps its last pick,
// and the earlier swap used to vanish: `edge_round;edge_45` printed what
// `edge_45` alone prints, stdout and stderr, and nothing named edge_round
// (BB8 6676262617, call 4). It is not refused; the earlier swap gets a note,
// first, and the run otherwise matches the last swap alone, stdout, exit and
// every other note, also in the JSON's `notes` and for an instrument the
// recipe does not have. Each other variant the part was given is named once,
// with the variant used (`a;b;a` names only b, `a;b;c` names a and b, each
// replaced by c); a repeat of the variant used replaces nothing.
assert('§3f', 'a part swapped twice keeps the last swap and names the one it replaced', () => {
  const replacedNote = (inst, part, was, now) =>
    `note: --swap-variant ${inst}:${part}:${was} was replaced by a later --swap-variant for the same part (${now})`;
  const edge = (v) => `drum_kit:bearing_edges:${v}`;
  const banjo = (v) => `banjo_5_string:banjo_back:${v}`;
  const cases = [
    {
      tradition: 'italogaze',
      swaps: [edge('edge_round'), edge('edge_45')],
      alone: edge('edge_45'),
      replaced: [replacedNote('drum_kit', 'bearing_edges', 'edge_round', 'edge_45')],
    },
    {
      tradition: 'italogaze',
      swaps: [edge('edge_round'), edge('edge_45'), edge('edge_round')],
      alone: edge('edge_round'),
      replaced: [replacedNote('drum_kit', 'bearing_edges', 'edge_45', 'edge_round')],
    },
    {
      tradition: 'italogaze',
      swaps: [edge('edge_round'), edge('edge_45'), edge('edge_30')],
      alone: edge('edge_30'),
      replaced: [
        replacedNote('drum_kit', 'bearing_edges', 'edge_round', 'edge_30'),
        replacedNote('drum_kit', 'bearing_edges', 'edge_45', 'edge_30'),
      ],
    },
    {
      tradition: 'italogaze',
      swaps: [edge('edge_45'), edge('edge_45')],
      alone: edge('edge_45'),
      replaced: [],
    },
    {
      tradition: 'gangsta_rap',
      swaps: [banjo('resonator'), banjo('open_back')],
      alone: banjo('open_back'),
      replaced: [replacedNote('banjo_5_string', 'banjo_back', 'resonator', 'open_back')],
    },
  ];
  const details = [];
  let ok = true;
  for (const c of cases) {
    const args = [RECIPE, '--tradition', c.tradition];
    const r = runSplit([...args, `--swap-variant=${c.swaps.join(';')}`]);
    const alone = runSplit([...args, `--swap-variant=${c.alone}`]);
    const want = [...c.replaced, ...stderrNotes(alone)];
    let caseOk =
      r.code === 0 &&
      alone.code === 0 &&
      r.out === alone.out &&
      JSON.stringify(stderrNotes(r)) === JSON.stringify(want) &&
      r.err
        .split('\n')
        .filter((l) => !l.startsWith('note: '))
        .join('\n') ===
        alone.err
          .split('\n')
          .filter((l) => !l.startsWith('note: '))
          .join('\n');
    const j = runSplit([...args, '--why-json', `--swap-variant=${c.swaps.join(';')}`]);
    let notes = null;
    try {
      notes = JSON.parse(j.err).notes;
    } catch {
      notes = null;
    }
    caseOk = caseOk && j.out === alone.out && JSON.stringify(notes) === JSON.stringify(want);
    ok = ok && caseOk;
    details.push(
      `${c.tradition} ${c.swaps.join(';')}: ${caseOk ? 'ok' : 'FAIL'}; exit ${r.code}; notes ${JSON.stringify(stderrNotes(r))}; want ${JSON.stringify(want)}; --why-json notes ${JSON.stringify(notes)}`
    );
  }
  return { ok, detail: details.join(' | ') };
});

// A flag given twice keeps its last value, as it always has, and the earlier
// one used to vanish: two --swap-variant flags printed what the last one alone
// prints, and nothing named the first, even when it swapped another part
// (#814 review; already so on 0888a1610). stdout and the exit code still match
// the last flag alone; each other value the flag was given gets a note first,
// also in the JSON's `notes`, and the same value twice says nothing. The `;`
// form, which applies every swap, differs from the last swap alone.
assert('§3f', 'a flag given twice reads the last one and names the one it did not read', () => {
  const unread = (name, value, sep) =>
    `note: only the last --${name} is read, so --${name}=${value} was not` +
    (sep ? ` (to give several, separate them with '${sep}' in one --${name})` : '');
  const falsetto = 'voice:voice_register:falsetto';
  const edge = (v) => `drum_kit:bearing_edges:${v}`;
  const cases = [
    {
      args: [
        '--tradition',
        'grunge',
        `--swap-variant=${falsetto}`,
        `--swap-variant=${edge('edge_45')}`,
      ],
      alone: ['--tradition', 'grunge', `--swap-variant=${edge('edge_45')}`],
      unread: [unread('swap-variant', falsetto, ';')],
      joined: ['--tradition', 'grunge', `--swap-variant=${falsetto};${edge('edge_45')}`],
    },
    {
      args: [
        '--tradition',
        'italogaze',
        '--swap-variant',
        edge('edge_round'),
        '--swap-variant',
        edge('edge_45'),
      ],
      alone: ['--tradition', 'italogaze', `--swap-variant=${edge('edge_45')}`],
      unread: [unread('swap-variant', edge('edge_round'), ';')],
    },
    {
      args: [
        '--tradition',
        'italogaze',
        `--swap-variant=${edge('edge_45')}`,
        `--swap-variant=${edge('edge_45')}`,
      ],
      alone: ['--tradition', 'italogaze', `--swap-variant=${edge('edge_45')}`],
      unread: [],
    },
    {
      args: ['--tradition', 'afrobeat', '--tradition', 'italogaze'],
      alone: ['--tradition', 'italogaze'],
      unread: [unread('tradition', 'afrobeat')],
    },
  ];
  const details = [];
  let ok = true;
  for (const c of cases) {
    const r = runSplit([RECIPE, ...c.args]);
    const alone = runSplit([RECIPE, ...c.alone]);
    const want = [...c.unread, ...stderrNotes(alone)];
    let notes = null;
    const j = runSplit([RECIPE, ...c.args, '--why-json']);
    try {
      notes = JSON.parse(j.err).notes;
    } catch {
      notes = null;
    }
    const joined = c.joined ? runSplit([RECIPE, ...c.joined]) : null;
    const caseOk =
      r.code === 0 &&
      alone.code === 0 &&
      r.out === alone.out &&
      JSON.stringify(stderrNotes(r)) === JSON.stringify(want) &&
      j.code === 0 &&
      j.out === alone.out &&
      JSON.stringify(notes) === JSON.stringify(want) &&
      (!joined || (joined.code === 0 && joined.out !== alone.out));
    ok = ok && caseOk;
    details.push(
      `${c.args.join(' ')}: ${caseOk ? 'ok' : 'FAIL'}; exit ${r.code}; notes ${JSON.stringify(stderrNotes(r))}; want ${JSON.stringify(want)}; --why-json notes ${JSON.stringify(notes)}` +
        (joined ? `; ';' form differs from the last alone: ${joined.out !== alone.out}` : '')
    );
  }
  return { ok, detail: details.join(' | ') };
});

// SKILL.md's flag contract: a misspelled flag is refused by name, not
// stored and ignored with the recipe unchanged and exit 0.
assert('§3f', 'a misspelled flag exits 2 and names the flag it meant', () => {
  const r = run([RECIPE, '--tradition', 'afrobeat', '--exclude-instruments=saxophone']);
  return {
    ok: r.code === 2 && /Did you mean --exclude-instrument\?/.test(r.out),
    detail: `exit ${r.code}`,
  };
});

assert(
  '§3f',
  'stapling order sets the lead: `a,b` vs `b,a` differ and each leads with its first id',
  () => {
    const A = 'delta_blues',
      B = 'detroit_techno',
      nA = tradName(A),
      nB = tradName(B);
    const oab = run([RECIPE, '--traditions', `${A},${B}`]).out;
    const oba = run([RECIPE, '--traditions', `${B},${A}`]).out;
    const leadsWith = (out, lead, other) => {
      const i = out.toLowerCase().indexOf(lead.toLowerCase());
      const j = out.toLowerCase().indexOf(other.toLowerCase());
      return i >= 0 && (j < 0 || i < j);
    };
    const ok = oab !== oba && leadsWith(oab, nA, nB) && leadsWith(oba, nB, nA);
    return {
      ok,
      detail: ok ? `"${A},${B}"→leads ${nA}; reversed→leads ${nB}` : 'order did not move the lead',
    };
  }
);

// ── §8 — nearest-neighbor top hits the docs cite as "Verified" ──
assert(
  '§8',
  'nearest_neighbor top neighbor: instrument voice→spoken_dramatic_cast, tradition delta_blues→hill_country_blues',
  () => {
    const firstNeighbor = (out) => {
      const m = out.match(/^\s+([a-z0-9_]+)\s+score=/m);
      return m ? m[1] : null;
    };
    const a = firstNeighbor(run([NN, '--type', 'instrument', '--id', 'voice']).out);
    const b = firstNeighbor(run([NN, '--type', 'tradition', '--id', 'delta_blues']).out);
    return {
      ok: a === 'spoken_dramatic_cast' && b === 'hill_country_blues',
      detail: `instrument→${a}, tradition→${b}`,
    };
  }
);

// ── §3g — the preface inverse outputs the docs cite as "Verified" ──
assert(
  '§3g',
  'preface_configure: voice+liturgical covers 0/13→4/13; voice+caressing moves Room→Front parlor',
  () => {
    const lit = run([PREF, '--instrument', 'voice', '--preface', 'liturgical']).out;
    const car = run([PREF, '--instrument', 'voice', '--preface', 'caressing']).out;
    const litOk = /0\/13\s*→\s*4\/13/.test(lit),
      carOk = /Front parlor/.test(car);
    return {
      ok: litOk && carOk,
      detail: `liturgical(0/13→4/13)=${litOk}, caressing(Room→Front parlor)=${carOk}`,
    };
  }
);

// ── §9.1 — arrangement is CLI-only and injects a clause the default recipe lacks ──
assert(
  '§9.1',
  'recipe.js --arrangement injects a clause the default recipe lacks (arrangement is CLI-only)',
  () => {
    const withArr = run([
      RECIPE,
      '--tradition',
      'delta_blues',
      '--arrangement=twelve_bar_blues_repeated',
    ]).out;
    const without = run([RECIPE, '--tradition', 'delta_blues']).out;
    const hasClause = (s) => /twelve.bar/i.test(s);
    return {
      ok: hasClause(withArr) && !hasClause(without),
      detail: `with=${hasClause(withArr)}, without=${hasClause(without)}`,
    };
  }
);

// ── §9.2 — fx_extras ARE a rendered chain stage. Regression guard for the
//    `fx_`-prefix bug: 18 traditions carried `chain_fx: ['fx_spring_reverb', …]`
//    that didn't resolve to the fx section (real id `spring_reverb`) and were
//    silently dropped at render. surf rock without its spring reverb is wrong. ──
assert(
  '§9.2',
  'fx_extras render into the recipe: surf_rock shows its spring reverb + tremolo',
  () => {
    const out = run([RECIPE, '--tradition', 'surf_rock']).out;
    const spring = /spring reverb/i.test(out),
      trem = /tremolo/i.test(out);
    return { ok: spring && trem, detail: `spring reverb=${spring}, tremolo=${trem}` };
  }
);

// ── §3d — the voice/preface lexicon tokens the docs print verbatim ──
assert('§3d', 'PREFACE_LEXICON "belting" → the 8 tokens documented in §3d', () => {
  const b = C.PREFACE_LEXICON.find((p) => p.id === 'belting');
  const expected =
    'projecting, chest-resonance-low-mid, vibrato-rich, late-Romantic-onward, ringing, blues-shouter, characteristic-cry, choir-blendable';
  const got = b ? (b.tokens || []).slice(0, 8).join(', ') : '(belting not found)';
  return { ok: got === expected, detail: got === expected ? '8 tokens match' : `got: ${got}` };
});

let fail = 0;
const results = [];
for (const c of checks) {
  let res;
  try {
    res = c.fn();
  } catch (e) {
    res = { ok: false, detail: 'threw: ' + e.message };
  }
  if (res.ok) results.push(`  ✓ ${c.section}  ${c.claim}`);
  else {
    fail++;
    results.push(`  ✗ ${c.section}  ${c.claim}\n      → ${res.detail}`);
  }
}

console.log(`=== Documented behavior assertions (${checks.length}) ===`);
if (VERBOSE || fail) for (const r of results) console.log(r);
if (fail === 0) {
  console.log(`PASS — all ${checks.length} documented behaviors hold.`);
  process.exit(0);
}
console.error(
  `FAIL — ${fail} documented behavior(s) drifted from the docs. Fix the code or update the SKILL.md claim + its assertion together.`
);
process.exit(1);
