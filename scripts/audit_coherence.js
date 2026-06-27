#!/usr/bin/env node
// audit_coherence.js — SUBSTANTIVE coherence audit for the tradition catalog.
//
// Where validate.js checks that references RESOLVE and audit.js checks
// token/descriptor health, this auditor checks whether a tradition's fields
// are mutually COHERENT — i.e. it catches the "stamped a generic default and
// never customized it" class of issue that passes every structural gate.
//
// All checks are internal-consistency checks (a field contradicting another
// field, or the referenced vocabulary, in the SAME record). They are designed
// to be high-precision — calibrated against the dataset so that e.g. a
// pentatonic tuning is NOT mistaken for microtonal (pentatonic lives inside
// 12-TET). The auditor never fabricates: every "suggest" target is an id that
// already exists in the relevant vocabulary.
//
// USAGE
//   node scripts/audit_coherence.js            # grouped human report
//   node scripts/audit_coherence.js --full     # no per-section truncation
//   node scripts/audit_coherence.js --json      # machine-readable findings
//   node scripts/audit_coherence.js --section=<name>   # one section only
//   node scripts/audit_coherence.js --quiet --strict   # exit 1 if any finding
//
// EXIT 0 clean (or non-strict); 1 if --strict and findings exist.

'use strict';
const C = require('./_loader.js');

const argv = process.argv.slice(2);
const flags = {
  full: argv.includes('--full'),
  json: argv.includes('--json'),
  quiet: argv.includes('--quiet'),
  strict: argv.includes('--strict'),
};
const sectionArg = (argv.find((a) => a.startsWith('--section=')) || '').split('=')[1] || null;

const T = C.TRADITIONS;
const E = C.TRADITION_EXTRAS;
const byArch = Object.fromEntries(C.CHAIN_ARCHETYPES.map((a) => [a.id, a]));
const findings = [];
const add = (section, tid, detail, extra) =>
  findings.push({ section, tid, detail, ...(extra || {}) });

// ─────────── era model: map a recording medium id → [earliest, latest] year ───────────
// Drawn from the medium vocabulary in 03_rooms_chains_tunings.js. A medium is a
// RECORDING-era choice, so two media in the same record that sit in disjoint
// technology eras are an internal contradiction.
const MEDIUM_ERA = {
  wax_cylinder: [1890, 1915],
  shellac_78: [1900, 1958],
  medium_direct_to_disc_lacquer: [1925, 1955],
  medium_lacquer_test_pressing: [1930, 1960],
  am_radio_broadcast: [1925, 1965],
  tape_15ips: [1948, 1975],
  tape_30ips: [1955, 2000],
  medium_8track_cartridge: [1965, 1982],
  medium_akai_adam_12track_1991: [1988, 1996],
  walkman_dictaphone: [1979, 2000],
  cassette_medium: [1970, 2000],
  medium_cassette_4track_bedroom: [1979, 2000],
  medium_dat_pro_late80s_90s: [1987, 2000],
  medium_minidisc_japan_90s: [1992, 2004],
  vinyl_master_cut: [1948, 1990],
  medium_dub_plate_cut: [1968, 1990],
  medium_vhs_hifi_audio: [1983, 1998],
  medium_indian_lebanese_pressing: [1955, 1990],
  digital_std: [1995, 2026],
  digital_high: [2000, 2026],
  medium_dsd_dsf_high_res: [2000, 2026],
  mp3_lossy_modern: [1998, 2026],
  tape_emulated: [2000, 2026],
};
const eraTech = (id) => {
  if (!id) return null;
  if (/wax_cylinder/.test(id)) return 'acoustic';
  if (/shellac|lacquer|disc|am_radio|78/.test(id)) return 'disc';
  if (/tape_15ips|tape_30ips|8track|reel/.test(id)) return 'tape';
  if (/cassette|walkman|dat|minidisc|vhs/.test(id)) return 'cassette';
  if (/digital|dsd|mp3|emulated|itb/.test(id)) return 'digital';
  if (/vinyl|dub_plate|pressing/.test(id)) return 'vinyl';
  return 'other';
};
const overlaps = (a, b) => a && b && a[0] <= b[1] && b[0] <= a[1];

// ─────────── C1. chain medium era clash (archetype vs explicit medium) ───────────
// The browser "Rich" recipe renders the EXPLICIT chain; the CLI prose renderer
// lets the ARCHETYPE override it. When their media sit in disjoint eras, the two
// renderers emit contradictory gear for the same tradition.
function checkChainMediumEra() {
  for (const t of T) {
    if (!t.chain_archetype || !t.chain_medium) continue;
    const a = byArch[t.chain_archetype];
    if (!a || !a.components || !a.components.medium) continue;
    const expM = t.chain_medium,
      arcM = a.components.medium;
    if (expM === arcM) continue;
    const et = eraTech(expM),
      at = eraTech(arcM);
    const ee = MEDIUM_ERA[expM],
      ae = MEDIUM_ERA[arcM];
    // Hard clash: different technology family AND non-overlapping year windows.
    const techClash = et && at && et !== at && !(et === 'vinyl' || at === 'vinyl');
    const yearClash = ee && ae && !overlaps(ee, ae);
    if (techClash && yearClash) {
      add(
        'chain_medium_era_clash',
        t.id,
        `explicit medium ${expM} [${et} ${ee[0]}-${ee[1]}] vs archetype ${a.id} medium ${arcM} [${at} ${ae[0]}-${ae[1]}]`,
        { explicit_medium: expM, archetype: a.id, archetype_medium: arcM }
      );
    }
  }
}

// ─────────── C2. voice multitrack era stamp later than the recording medium ───────────
// e.g. a 2010s Melodyne-microtuned multitrack stack on a tradition cut to shellac.
const MULTITRACK_ERA = {
  voice_multitrack_single_lead: null,
  voice_multitrack_single_track_mono: [1900, 1965],
  voice_multitrack_mid_1960s_double_tracking_era: [1963, 1975],
  voice_multitrack_late_1980s_reverb_saturated_bus: [1983, 1996],
  voice_multitrack_2010s_melodyne_microtuned: [2008, 2026],
  voice_multitrack_2000s_comp_stack: [1999, 2026],
};
function checkVoiceMultitrackEra() {
  for (const t of T) {
    const stack = (t.parts || {}).voice_multitrack_stack;
    const se = MULTITRACK_ERA[stack];
    if (!se || !t.chain_medium) continue;
    const me = MEDIUM_ERA[t.chain_medium];
    if (!me) continue;
    // stack era starts well AFTER the medium era ends → impossible combination
    if (se[0] > me[1] + 5) {
      add(
        'voice_multitrack_era_clash',
        t.id,
        `voice_multitrack_stack ${stack} [${se[0]}-${se[1]}] but medium ${t.chain_medium} [${me[0]}-${me[1]}]`,
        { stack, medium: t.chain_medium }
      );
    }
  }
}

// ─────────── C3. stamped voice_tradition default on a non-pop tradition ───────────
// modern_pop_vocal_training is the catalog default; on a clearly traditional/
// classical/world/sacred form it is a stamp that was never customized. Suggest a
// palette variant ONLY when a region/style keyword maps unambiguously.
const VT_RULES = [
  [
    /\b(sardinia|corsica|corsican|paghjella|cantu a tenore|tenore)\b/i,
    'mediterranean_demotic_tradition',
  ],
  [
    /\b(greek|greece|rebetiko|nisiotika|moirologi|nanourisma|epirus|pontic|cretan|byzantine)\b/i,
    'mediterranean_demotic_tradition',
  ],
  [
    /\b(klapa|dalmatian|istrian|sevdalinka|bulgarian|macedonian|albanian iso|polyphon)\b/i,
    'mediterranean_demotic_tradition',
  ],
  [
    /\b(mongolia|mongolian|tuvan|tuva|khoomei|kargyraa|sygyt|xoomii|throat-?singing|overtone)\b/i,
    'khoomei_tuvan_tradition',
  ],
  [/\b(inuit|katajjaq)\b/i, 'inuit_katajjaq_tradition'],
  [
    /\b(beijing opera|jingju|cantonese opera|kunqu|sichuan opera|xiqing|huangmei|yu opera|yueju|qinqiang|pingju|chinese (classical|traditional)|mandarin)\b/i,
    'chinese_classical_vocal_tradition',
  ],
  [
    /\b(min'?-?yo|minyo|japanese (folk|min)|warabe|komoriuta|izakaya enka|enka|nagauta|gidayu)\b/i,
    'japanese_min_yo_tradition',
  ],
  [
    /\b(pansori|korean (folk|minsogak)|minsogak|sanjo|gagok|trot|dongyo|baennoraega)\b/i,
    'korean_minsogak_vocal_tradition',
  ],
  [
    /\b(polynesia|hawaiian|maori|tahitian|samoan|tongan|oli|mele|waiata|himene|fijian|meke)\b/i,
    'polynesian_oli_tradition',
  ],
  [/\b(yoruba|oriki|apala|sakara|were|juju)\b/i, 'yoruba_tonal_vocal_tradition'],
  [/\b(mande|jeli|griot|wassoulou|donso|sahel praise|kora)\b/i, 'mande_jeli_vocal_tradition'],
  [/\b(persian|dastgah|rowzeh|avaz|iranian)\b/i, 'persian_dastgah_tradition'],
  [
    /\b(arabic|maqam|tarab|takht|qasida|madh|naha|muwashshah|andalusi|malouf|maluf|chaabi)\b/i,
    'arabic_maqam_tradition',
  ],
  [/\b(flamenco|jondo|siguiriya|solea|buleria|alegria)\b/i, 'flamenco_jondo_tradition'],
  [/\b(sean-?nos|irish (unaccompanied|trad)|caoineadh|gwerz)\b/i, 'sean_nos_tradition'],
  [
    /\b(scottish gaelic|hebridean|taladh|waulking|puirt|coronach|bothy)\b/i,
    'scottish_gaelic_taladh_tradition',
  ],
  [
    /\b(gospel|pentecostal|spiritual|sacred harp|shape note|jubilee|sanctified)\b/i,
    'gospel_pentecostal_tradition',
  ],
  [/\b(dhrupad)\b/i, 'hindustani_dhrupad_tradition'],
  [
    /\b(khayal|khyal|thumri|tappa|hindustani|ghazal|kirtan|bhajan)\b/i,
    'hindustani_khyal_tradition',
  ],
  [
    /\b(carnatic|kriti|tillana|tarana|varnam|telugu kirtana|divya prabandham)\b/i,
    'carnatic_classical_tradition',
  ],
  [/\b(qawwali|sufi (inshad|sama|munajat)|naat|anasheed)\b/i, 'qawwali_tradition'],
  [/\b(opera seria|bel canto|verismo|grand opera|zarzuela|operatic)\b/i, 'operatic_tradition'],
  [/\b(baroque|monteverdi|madrigal|renaissance sacred)\b/i, 'baroque_ornamental_tradition'],
];
// Tree roots whose traditions are NOT modern-commercial-pop by default.
const TRADITIONAL_ROOTS = new Set([
  'ritualDevotional',
  'droneModal',
  'funeralLament',
  'improvOnFrame',
  'artMusic',
  'fieldWork',
  'praiseSong',
  'huntingSong',
  'lullaby',
  'nurseryRhyme',
  'wedding',
  'seaShanty',
  'domesticRhythm',
  'carnivalProcessional',
  'balladPoetry',
]);
// Genres whose NAME trips a VT_RULE but whose vocals are genuinely modern pop —
// web-verified 2026-06: baroque pop is baroque
// INSTRUMENTATION with pop vocals; mandopop_modern / greek_rock / shidaiqu /
// persian_pop_los_angeles / singaporean_xinyao are pop sung with pop technique;
// sfyria_antia is a WHISTLED language, not singing. Allowlisted so the heuristic
// stops re-flagging verified-correct stamps (the other 10 it flagged were fixed).
const VT_VERIFIED_POP = new Set([
  'mandopop_modern',
  'greek_rock',
  'baroque_pop_60s',
  'shidaiqu',
  'persian_pop_los_angeles',
  'singaporean_xinyao',
  'sfyria_antia',
]);
function checkVoiceTradition() {
  for (const t of T) {
    const vt = (t.parts || {}).voice_tradition;
    if (vt !== 'modern_pop_vocal_training') continue;
    if (VT_VERIFIED_POP.has(t.id)) continue; // verified genuinely pop — see note above
    const e = E[t.id];
    const root = ((e && e.parent) || '').split('.')[0];
    // Match the SUGGESTION against id + name only — not the free description.
    // The description routinely names regions/influences (e.g. sacred_steel
    // mentions Hawaiian steel guitar) that would mis-route the vocal tradition.
    const nameHay = `${t.id.replace(/_/g, ' ')} ${t.name}`;
    let target = null;
    for (const [re, val] of VT_RULES) {
      if (re.test(nameHay)) {
        target = val;
        break;
      }
    }
    const traditional = TRADITIONAL_ROOTS.has(root);
    if (target) {
      add(
        'voice_tradition_stamped',
        t.id,
        `voice_tradition=modern_pop_vocal_training → suggest ${target}`,
        { suggest: target, confidence: 'high', root }
      );
    } else if (traditional) {
      add(
        'voice_tradition_review',
        t.id,
        `voice_tradition=modern_pop_vocal_training on ${root} tradition; no unambiguous palette match`,
        { root }
      );
    }
  }
}

// ─────────── C4. tuning twelve_tet but description is explicitly non-12-TET ───────────
// PRECISE terms only. Pentatonic / modal / blues are 12-TET compatible and excluded.
// PRECISE non-12-TET tuning-SYSTEM signals. Deliberately excludes pentatonic/modal
// (12-TET-compatible) and microtonal *techniques* ("microtonal bending/inflection",
// an expressive guitar/vocal ornament over a 12-TET base — not a tuning system).
const NON12 =
  /\bmaqam\b|\bmicrotonal (scale|system|tuning|composition|division|just)|\bmicrotonality\b|\bquarter[- ]?tones?\b|\bquartertones?\b|\b24[- ]?edo\b|\b31[- ]?edo\b|\bshruti\b|\bsruti\b|\bgamelan\b|\bslendro\b|\bpelog\b|\bjust intonation\b|\bmeantone\b|\bwell[- ]?temperament|\bpythagorean (tuning|intonation)\b|\bnon-?tempered (scale|tuning)\b|\bdastgah\b|\bmugham\b/i;
function checkTuningNon12() {
  for (const t of T) {
    if (t.tuning !== 'twelve_tet') continue;
    const e = E[t.id];
    const hay = `${t.lineage || ''} ${(e && e.description) || ''}`;
    const m = hay.match(NON12);
    if (m)
      add('tuning_non12_contradiction', t.id, `tuning=twelve_tet but text says "${m[0]}"`, {
        term: m[0],
      });
  }
}

// ─────────── C5. environment over-collapse (report) ───────────
function checkEnvCollapse() {
  const env = {};
  for (const t of T) {
    const k = [t.room, t.tuning, t.chain_archetype, t.production_aesthetic || ''].join('::');
    (env[k] ||= []).push(t.id);
  }
  Object.entries(env)
    .filter(([, ids]) => ids.length >= 12)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([k, ids]) =>
      add(
        'environment_overcollapse',
        `(${ids.length} traditions)`,
        `[${k}] : ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? ' …' : ''}`,
        { size: ids.length }
      )
    );
}

// ─────────── C6. single-instrument sparsity (report) ───────────
function checkSparsity() {
  for (const t of T) {
    if ((t.instruments || []).length !== 1) continue;
    const e = E[t.id];
    const root = ((e && e.parent) || '').split('.')[0];
    add('single_instrument', t.id, `only instrument: ${t.instruments[0]} (root=${root})`, {
      instrument: t.instruments[0],
      root,
    });
  }
}

const ALL = {
  chain_medium_era_clash: checkChainMediumEra,
  voice_multitrack_era_clash: checkVoiceMultitrackEra,
  voice_tradition: checkVoiceTradition,
  tuning_non12_contradiction: checkTuningNon12,
  environment_overcollapse: checkEnvCollapse,
  single_instrument: checkSparsity,
};
for (const [name, fn] of Object.entries(ALL)) {
  if (sectionArg && !name.startsWith(sectionArg) && name !== sectionArg) {
    // voice_tradition produces two sections; allow --section=voice_tradition* etc.
    if (!(sectionArg === 'voice_tradition' && name === 'voice_tradition')) continue;
  }
  fn();
}

// ─────────── output ───────────
if (flags.json) {
  console.log(JSON.stringify(findings, null, 2));
  process.exit(0);
}

const bySection = {};
for (const f of findings) (bySection[f.section] ||= []).push(f);
const order = [
  'chain_medium_era_clash',
  'voice_multitrack_era_clash',
  'voice_tradition_stamped',
  'voice_tradition_review',
  'tuning_non12_contradiction',
  'environment_overcollapse',
  'single_instrument',
];
const sections = [...new Set([...order, ...Object.keys(bySection)])].filter((s) => bySection[s]);

if (findings.length === 0) {
  console.log('COHERENCE CLEAN — no coherence findings.');
  process.exit(0);
}
const limit = flags.full ? Infinity : 15;
console.log(`COHERENCE — ${findings.length} finding(s) across ${sections.length} section(s):\n`);
for (const s of sections) {
  const items = bySection[s];
  console.log(`[${s}] ${items.length}`);
  for (const it of items.slice(0, limit)) console.log(`  ${it.tid}  ${it.detail}`);
  if (items.length > limit) console.log(`  ... +${items.length - limit} more (use --full)`);
  console.log('');
}
if (flags.strict && findings.length > 0) process.exit(1);
process.exit(0);
