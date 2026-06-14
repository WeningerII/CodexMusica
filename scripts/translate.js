#!/usr/bin/env node
// Translate a configuration into the descriptor stack.
//
// Format rules:
//   - Modifiers in front, anchor noun at end (descriptor stack pattern)
//   - Period-bounded sentences for category transitions
//   - Comma separation within categories
//   - No labels, no headers, no prose connectives
//   - Drop defaults and absences silently
//   - Translate ids to display tokens (underscores → spaces, no hyphens introduced)
//   - Keep hyphens only where the compound is a real lexical unit
//   - Capitalize proper-noun-derived terms
//   - 1,000-char ceiling with structured trimming when over budget
//   - No axis values printed
//   - No artist/band/composer names anywhere
//
// Usage:
//   cat config.json | node scripts/translate.js
//   node scripts/translate.js --tradition <id>           (run search then translate)

const C = require('./_loader.js');

// ============================================================
// ID-TO-DISPLAY TRANSLATOR
// Handles underscore-to-space, camelCase splitting, and the
// "compound real lexical unit" rule for hyphens.
// ============================================================

// Tokens that should preserve their hyphenation (real compound words).
// Everything else gets hyphens stripped to spaces in display.
const KEEP_HYPHENATED = new Set([
  'blues-shouter', 'chicken-scratch', 'four-on-floor', 'call-and-response',
  'large-diaphragm', 'small-diaphragm', 'figure-8', 'short-scale', 'long-scale',
  'ride-driven', 'jazz-trained', 'brushes-and-sticks', 'fingerstyle',
  'midrange-forward', 'lo-fi', 'hi-fi', 'high-tension', 'low-end',
  'four-track', 'eight-track', 'sixteen-track', 'two-inch', 'half-inch',
  'wall-of-sound', 'pre-war', 'post-war', 'two-piece', 'three-piece',
  'cross-continental', 'pre-amplification', 'in-the-box',
  'afro-diasporic', 'speech-derived', 'edge-heavy',
  'mid-major', 'major-flagship', 'indie-commercial', 'pioneer-electronic',
  'auteur-home-pro', 'vintage-revival', 'isolation-DIY', 'commercial-major',
  'converted-DIY', 'daw-bedroom',
  'mid-range', 'top-end', 'bottom-end', 'flat-wound', 'round-wound',
  'tape-saturated', 'tube-saturated', 'transformer-coupled',
  'jazz-friendly', 'gospel-friendly', 'rock-friendly', 'country-friendly',
  'jazz-canonical', 'gospel-canonical', 'rock-canonical',
  // Phase 6+ chain mechanism vocabulary (fx / amp / comp / eq circuit topologies)
  // FX clipping/saturation:
  'silicon-hard-clip-symmetric', 'germanium-soft-clip-asymmetric',
  'low-headroom-soft-clip', 'asymmetric-clipping', 'asymmetric-soft-clip',
  'midrange-bandpass-clip', 'high-gain-cascading-saturation',
  'dynamic-range-compressed',
  // FX delay/reverb mechanisms:
  'tape-wow-flutter', 'head-feedback-darken-each-pass',
  'bbd-bucket-brigade-darkening', 'low-pass-each-pass',
  'digital-clean-pass', 'no-loss-feedback',
  'spring-mechanical-resonance', 'transient-bouncy-decay',
  'plate-flat-frequency-decay', 'high-density-modal', 'hf-emphasized-tail',
  'long-decay-large-volume-impulse', 'exponential-density-buildup',
  'octave-shifted-tail', 'pitch-shifted-tail',
  // FX modulation mechanisms:
  'small-pitch-modulation-detune', 'stereo-widening',
  'comb-filter-very-short-delay-modulated', 'swept-feedback',
  'all-pass-stage-phase-cancellation', 'swept-notch',
  'amplitude-modulation-low-frequency', 'lfo-amplitude',
  'resonant-bandpass-sweep', 'expressive-pedal-controlled',
  'octave-shifted-summed', 'digital-pitch-shift', 'formant-may-shift',
  'amplitude-modulation-sum-difference-frequencies', 'inharmonic-output',
  'low-ratio-soft-knee', 'sustain-extended',
  // Amp mechanisms:
  'mid-cut-eq-curve', 'treble-presence-emphasized', 'high-headroom-tube',
  'low-headroom-tube', 'early-breakup', 'class-a-tube-overtones',
  'top-end-overtone-rich', 'narrow-bandwidth-presence',
  'high-gain-cascading-tube-stages', 'mid-piled-eq',
  'low-wattage-early-breakup', 'high-headroom', 'low-distortion',
  'digital-modeling-multi-amp', 'low-frequency-tube-saturation',
  'low-mid-thick', '2h-rich-bass', 'fast-transient',
  'doppler-pitch-modulation', 'treble-rotor-fast', 'bass-rotor-slow',
  // Comp mechanisms:
  'long-attack-LDR-thermal', 'program-dependent-release', 'soft-knee',
  'fast-attack-microsecond', 'transient-grab-aggressive',
  'feed-forward-detection', 'variable-mu-tube-curve',
  'slow-bus-time-constant', '2h-rich',
  'sidechain-driven-amplitude-modulation', 'kick-keyed-ducking',
  'fast-attack-overshoot', 'transient-emphasis',
  'parallel-summing-uncompressed-blend', 'transient-preserved',
  // EQ mechanisms:
  'passive-LC-broad-curves', 'no-active-gain-stage', 'broad-q',
  'narrow-q-precise', 'fully-parametric',
  'fixed-bands-iso-frequencies', 'fast-tactile-adjustment',
  'passive-LC-low-shelf-up', 'proportional-q-narrow-at-boost',
  'mid-shift-rich',
  // Bright-cluster mechanism replacements:
  // - 'treble-extended' replaces 'bright' as the spectral descriptor across instruments and rooms
  // - 'forward-resonance' replaces twang_voice's 'bright' (vocal-tract resonance forward)
  // - 'major-mode-pitches' replaces handpan's 'bright' (modal, not spectral)
  'treble-extended', 'forward-resonance', 'major-mode-pitches',
  // Smooth/intimate/punchy/aggressive cluster mechanism replacements:
  'continuous-airflow', 'continuous-phonation', 'frictionless-glide',
  'low-friction-pivot', 'no-resonant-peaks', 'no-attack-transient',
  'low-resonance-default', 'high-resolution',
  'small-volume-close-listening',
  'fast-attack-transient', 'high-gain-saturation',
]);

// Proper-noun-derived terms that should capitalize on display.
const PROPER_NOUNS = new Set([
  'african', 'afro', 'afro-diasporic', 'american', 'arabic', 'arabesk', 'argentine',
  'asian', 'australian', 'baroque', 'beirut', 'belgian', 'berber', 'brazilian',
  'british', 'cajun', 'cantonese', 'caribbean', 'celtic', 'chinese', 'creole',
  'cuban', 'czech', 'detroit', 'dominican', 'dutch', 'east-african', 'egyptian',
  'english', 'european', 'fairchild', 'french', 'gaelic', 'german', 'ghanaian',
  'greek', 'haitian', 'hindustani', 'iranian', 'irish', 'italian', 'jamaican',
  'japanese', 'jewish', 'kingston', 'korean', 'lagos', 'latin', 'lebanese',
  'london', 'manchester', 'maori', 'maghrebi', 'malian', 'mediterranean',
  'mexican', 'moroccan', 'naija', 'neumann', 'new-orleans', 'nigerian', 'pultec',
  'persian', 'polish', 'portuguese', 'puerto-rican', 'punjabi', 'roma', 'russian',
  'scandinavian', 'scottish', 'senegalese', 'sephardic', 'serbian', 'slavic',
  'soho', 'south-african', 'south-asian', 'soviet', 'spanish', 'studer', 'sudanese',
  'sufi', 'swahili', 'swedish', 'syrian', 'tamil', 'telefunken', 'tendai', 'thai',
  'tibetan', 'trinidadian', 'turkish', 'ukrainian', 'venezuelan', 'vietnamese',
  'welsh', 'west-african', 'yoruba', 'emi', 'gretsch', 'fender', 'rickenbacker',
  'gibson', 'leslie', 'hammond', 'wurlitzer', 'rhodes', 'fairchild',
]);

// Map known catalog id-prefixes to preferred display labels.
const ID_DISPLAY_OVERRIDES = {
  'studio_emi_lagos_african': 'EMI',
  'live_room': 'live tracking',
  'parlor': 'parlor',
  'concert_hall_shoebox': 'shoebox concert hall',
  'open_prairie': 'open air',
  'wooden_country_church': 'country church',
  'stone_parish_church': 'parish church',
  'cathedral': 'cathedral',
  'untreated_bedroom': 'bedroom',
  'treated_studio': 'treated studio',
  'piano_grand': 'grand piano',
  'piano_upright': 'upright piano',
  'voice': '', // voice is implicit when context is "the singer"
  'electric_guitar_single_coil': 'single coil electric guitar',
  'electric_guitar_humbucker': 'humbucker electric guitar',
  'electric_bass': 'electric bass',
  'drum_kit': 'drum kit',
  'tonewheel_organ': 'tonewheel organ',
  'combo_organ': 'combo organ',
  'archtop_jazz': 'archtop',
  'classical_nylon_string_guitar': 'classical nylon-string guitar',
  'acoustic_guitar_dread': 'dreadnought acoustic guitar',
  'acoustic_guitar_parlor': 'parlor acoustic guitar',
  'acoustic_guitar_om': 'acoustic guitar',
  'acoustic_resonator_steel': 'steel resonator guitar',
  'acoustic_resonator_wood': 'wood resonator guitar',
  'lap_steel': 'lap steel',
  'pedal_steel': 'pedal steel',
  'banjo': 'banjo',
  'mandolin': 'mandolin',
  'fiddle': 'fiddle',
  'autoharp': 'autoharp',
  'dulcimer_appalachian': 'mountain dulcimer',
  'fretless_bass': 'fretless bass',
  'baritone_electric': 'baritone electric guitar',
  'saxophone': 'saxophone',
  'trumpet': 'trumpet',
  'harmonica': 'harmonica',
  'upright_bass': 'upright bass',
  'analog_synth': 'analog synth',
  'analog_poly_synth': 'analog poly synth',
  'sampler_classic': 'sampler',
  'drum_machine_808': 'TR-808',
  'drum_machine_909': 'TR-909',
  'drum_machine_707': 'TR-707',
};

const REGION_DISPLAY = {
  'NA': 'North American',
  'NA-LA': 'Los Angeles',
  'NA-S': 'Southern American',
  'NA-NW': 'Pacific Northwest',
  'UK': 'British',
  'EU': 'European',
  'AFR': 'West African',
  'ASIA': 'Asian',
  'trop': 'tropical',
  'global': '',
};

// Curated display map for chain items — produces terse phrases for descriptor stack.
// Each entry: id → display string with proper capitalization/abbreviation.
const CHAIN_DISPLAY = {
  // mic
  'condenser_ldc': 'large-diaphragm condenser',
  'condenser_sdc': 'small-diaphragm pencil condenser',
  'condenser_tube': 'tube condenser',
  'condenser_fet': 'FET condenser',
  'ribbon_passive': 'passive ribbon',
  'ribbon_active': 'active ribbon',
  'dynamic_mic': 'dynamic moving-coil',
  'bullet_mic': 'bullet mic',
  'lavalier_mic': 'lavalier',
  'boundary_mic': 'PZM boundary',
  // pre
  'tube_pre': 'tube pre',
  'tube_modern': 'modern tube pre',
  'transformer_solid_state': 'transformer-coupled solid-state pre',
  'transformerless': 'transformerless solid-state pre',
  'ultra_clean': 'ultra-clean solid-state pre',
  'class_a_discrete': 'class-A discrete pre',
  'pre_neve_1073_input': 'Neve 1073 inductor pre',
  'pre_api_312': 'API 312 op-amp pre',
  'pre_tube_german_v72': 'German V72 tube pre',
  'pre_500_series_modern': '500-series boutique pre',
  'pre_console_inline_strip': 'console-strip pre',
  'pre_field_recorder_portable': 'portable field-recorder pre',
  'pre_ribbon_high_z': 'high-Z ribbon pre',
  // console
  'clean': null, // dropped — default
  'colored': 'colored vintage console',
  'broken': 'broken lo-fi console',
  'console_british_transformer_70s': 'Neve transformer console',
  'console_british_inline_80s': 'SSL inline console',
  'console_american_op_amp': 'API op-amp console',
  'console_british_class_a_70s': 'Trident class-A console',
  'console_broadcast_present': 'BBC broadcast console',
  'console_german_tube_50s': 'German tube console',
  'console_home_portastudio': 'cassette portastudio',
  'console_in_the_box': null, // dropped — modern default
  // comp
  'comp_none': null, // absence
  'comp_optical': 'optical compressor',
  'comp_fet': 'FET compressor',
  'comp_vca': 'VCA compressor',
  'comp_vari_mu': 'vari-mu',
  'comp_pumping': 'pumping sidechain',
  'comp_1176_fet': '1176 FET',
  'comp_la2a_optical': 'LA-2A optical',
  'comp_dbx_160_vca': 'dbx 160 VCA',
  'comp_brick_wall_limiter': 'brick-wall limiter',
  'comp_parallel_blend': 'parallel compression',
  'comp_multiband': 'multiband compressor',
  // eq
  'eq_none': null,
  'eq_passive_program': 'passive program EQ',
  'eq_passive_program_pultec': 'Pultec passive program EQ',
  'eq_active_parametric': 'parametric EQ',
  'eq_graphic': 'graphic EQ',
  'eq_tilt': 'tilt EQ',
  'eq_inductor_iron': 'Neve inductor EQ',
  'eq_proportional_q': 'API proportional-Q EQ',
  'eq_console_surgical': 'SSL surgical EQ',
  'eq_dynamic': 'dynamic EQ',
  'eq_loudness_compensation': 'broadcast loudness EQ',
  'eq_mastering_clean_digital': 'clean digital mastering EQ',
  // medium
  'tape_30ips': 'Studer 30ips tape',
  'tape_15ips': 'tape 15ips',
  'cassette_medium': 'cassette',
  'digital_std': '16-bit digital',
  'digital_high': '24-bit digital',
  'tape_emulated': 'tape-emulated digital',
  'wax_cylinder': 'wax cylinder',
  'shellac_78': '78rpm shellac',
  'vinyl_master_cut': 'vinyl master cut',
  'mp3_lossy_modern': 'lossy MP3',
  'am_radio_broadcast': 'AM-radio broadcast',
  'walkman_dictaphone': 'Walkman cassette',
  // fx — most are descriptive
  'plate_reverb': 'plate reverb',
  'spring_reverb': 'spring reverb',
  'tape_echo': 'tape echo',
  'digital_delay': 'digital delay',
  'pitch_shifter': 'pitch shifter',
  'autotune_aesthetic': 'autotune',
  'ring_mod': 'ring modulator',
  'fuzz_silicon': 'silicon fuzz',
  'fuzz_germanium': 'germanium fuzz',
  'octave_pedal': 'octave pedal',
  'compressor_pedal': 'compressor pedal',
};

// Transform a hyphenated descriptor for display.
// Rule: keep hyphenation if it's a real compound; otherwise spaces.
function displayDescriptor(desc) {
  if (!desc) return '';
  if (KEEP_HYPHENATED.has(desc.toLowerCase())) {
    // Keep hyphenated; capitalize proper-noun parts
    return desc.split('-').map(part => {
      const lc = part.toLowerCase();
      if (UPPERCASE_TOKENS.has(lc)) return lc.toUpperCase();
      if (PROPER_NOUNS.has(lc) || PROPER_NOUNS.has(desc.toLowerCase())) {
        return lc.charAt(0).toUpperCase() + lc.slice(1);
      }
      return lc;
    }).join('-');
  }
  // De-hyphenate; capitalize proper-noun-derived tokens; uppercase known acronyms
  return desc.split('-').map(part => {
    const lc = part.toLowerCase();
    if (UPPERCASE_TOKENS.has(lc)) return lc.toUpperCase();
    return PROPER_NOUNS.has(lc) ? lc.charAt(0).toUpperCase() + lc.slice(1) : lc;
  }).join(' ');
}

// Tokens that should appear ALL CAPS regardless of context.
const UPPERCASE_TOKENS = new Set([
  'emi', 'eq', 'mc', 'rb', 'pa', 'usa', 'uk', 'rca', 'ibc', 'bbc', 'mci',
  'fet', 'tr-808', 'tr-909', 'tr-707', 'sm57', 'sm58',
  'u47', 'u67', 'u87', 'v72', 'v76', 'la-2a', '1176', 'ssl', 'api',
  'ips', 'mhz', 'khz', 'hz', 'db', 'dbx', 'pzm', 'mp3', 'aac',
  'r&b', 'fm', 'am', 'daw', 'midi',
]);

// Strip "X-canonical" tag suffixes — they're internal scoring hints. The "canonical"
// part is dropped; the prefix "X" is kept as a real descriptor.
function stripCanonical(desc) {
  return String(desc).replace(/-canonical$/, '');
}

// Bare-genre-name tokens that should NOT appear in the output descriptor stack.
// These exist in variant descriptors so the scorer can match them to tradition tokens,
// but they're scoring hints, not user-facing descriptors. The user reading the recipe
// already knows the tradition (it's in sentence 1) — they don't need "afrobeat" repeated
// inside an instrument descriptor.
const BARE_GENRE_TOKENS = new Set([
  'afrobeat', 'funk', 'jazz', 'rock', 'punk', 'metal', 'soul', 'motown', 'reggae',
  'dub', 'fusion', 'gospel', 'country', 'classical', 'hip-hop', 'electronic',
  'shoegaze', 'post-punk', 'doom', 'psych', 'noise', 'disco', 'bossa', 'flamenco',
  'orchestral', 'surf', 'eighties', 'modern', 'twentieth-century', 'twenty-first-century',
  'bebop', 'swing', 'western-swing', 'bluesy', 'blues', 'afro',
  'r&b', 'rnb', 'ska', 'rocksteady', 'mariachi', 'dixieland', 'new-orleans',
  'cool-jazz', 'free-jazz', 'avant', 'blues-rock', 'cool',
]);

function isScoreHintOnly(desc) {
  return BARE_GENRE_TOKENS.has(String(desc).toLowerCase().trim());
}

// Descriptors that describe MUSICAL TECHNIQUE rather than genre/tradition.
// These bypass the trust-token filter because they're tradition-agnostic
// vocabulary describing HOW something is played, not WHAT genre it belongs to.
// They show up in any tradition where the technique applies and shouldn't be
// filtered as "leaks."
const TRUSTED_TECHNIQUE_DESCRIPTORS = new Set([
  'open-tuned', 'fingerpicked', 'fingerstyle', 'flatpicked', 'travis-picked',
  'slide', 'muted', 'palm-muted', 'thumb-muted', 'tremolo',
  'arpeggiated', 'strummed', 'chopped', 'hybrid-picked',
  'overdriven', 'overblown', 'multiphonic', 'split-tone',
  'walking', 'pocket', 'locked', 'slapped', 'popped', 'picked',
  'sticks', 'brushes', 'mallets', 'hands', 'rim-clicks', 'gated',
  'programmed', 'sequenced', 'sampled', 'glitched', 'plucked',
  'sub-bass', 'pad', 'lead',
  'legato', 'staccato', 'spiccato', 'pizzicato', 'sustained',
  'honking', 'breathy', 'cool', 'wailing', 'crying',
  'comped', 'block-chord', 'ostinato',
  'circular-breathing', 'drone-like', 'modal',
  'chord-melody', 'clawhammer', 'frailed',
  'cross-harp',
  'bent', 'pitched',
  // Generic vocal techniques (tradition-agnostic ornamentation/delivery)
  'melismatic', 'ornate', 'declaimed', 'lament-wail',
  // Phase 1 vocal mechanism vocabulary (anatomical / phonatory; tradition-agnostic)
  'fry-bleed', 'creak-onset', 'low-pulse-irregular',
  'pressed', 'supraglottal-constricted', 'strain-audible',
  'false-fold-engaged', 'ventricular-phonation', 'sub-fundamental-buzz',
  'breath-admixed', 'incomplete-closure-active', 'incomplete-closure-resting',
  'soft-onset', 'untrained-fragile',
  'worn-fold', 'irregular-fold-mass', 'age-roughened',
  'chest-mix-belt', 'full-chest-belt', 'thyroarytenoid-dominant',
  'register-blended-up', 'belt-projection', 'sustained-projection',
  'larynx-lowered', 'dark-color-position', 'glottal-articulation',
  'register-break-ornamental', 'voluntary-cracking',
  // Phase 2 chain mechanism vocabulary (microphone / preamp / console / medium)
  // Microphone physical mechanisms
  'top-rolled-off-8k', 'top-rolled-off-12k', 'top-rolled-off-15k',
  'body-resonance-low-mid', 'transformer-coupled-output',
  'full-range-flat', 'hyped-top', 'hyped-mids', 'mid-rolled-off',
  'proximity-bass-buildup', 'off-axis-flat',
  'hf-distortion-prone', 'bandwidth-narrow', 'mouth-close',
  'plosive-resistant', 'boundary-half-space-pickup', 'no-floor-comb',
  // Preamp circuit topologies
  'even-harmonic-rich', 'asymmetric-saturation', 'euphonic-clean',
  'inductor-phase-shift', 'solid-state-clean',
  'transformer-coupled-input', 'discrete-class-a',
  'headroom-generous', 'headroom-modest', 'low-noise',
  'high-input-impedance', 'variable-topology', 'mid-emphasized',
  // Console summing & per-channel character
  'summing-bus-saturation', 'transformer-coupled-channel',
  'class-a-summing', 'tube-stage-equipped-channel', 'clean-summing',
  'iron-bus-saturation', 'op-amp-summing', 'total-recall-clean',
  // Tape / medium physical mechanisms
  'hf-compression-natural', 'bias-bump-low-mid',
  'saturation-distortion-headroom', 'wow-and-flutter-light',
  'wow-and-flutter-noticeable', 'head-bump-narrow-format',
  'head-bump-wide-format',
  // Phase 6+ warm-audit mechanism vocabulary (instrument-side warm replacements)
  'low-mid-rich-spectrum', 'low-fundamental-tuning',
  'low-overtone-rich', 'low-overtone-rich-spectrum',
  'chest-resonance-low-mid', 'analog-drift-character', 'hammer-low-mid-emphasis',
  'treble-rolled-off',
  // Phase 6+ soft-audit mechanism vocabulary (instrument-side soft replacements)
  'breath-tone-airy', 'low-dynamic-level', 'low-tension-strings',
  'low-density-tonewood', 'low-output-magnet', 'low-projection-volume',
  'damped-attack-onset', 'low-overtone-bowing',
  'low-onset-attack', 'no-membrane-buzz',
  'odd-harmonic-rolloff', 'soft-attack-onset', 'bell-clear-sustain',
  'section-blend', 'melodic-countersignature',
  'lead-melodic',
  // Phase 6+ vibes-audit mechanism vocabulary (intimate/lush/open/fat/tight/
  // precise/transparent/rich/clear/organic instrument-side replacements)
  'open-chord-ringing-overtones', 'sustain-rich-overtones',
  'undamped-body-resonance', 'undamped-resonance',
  'low-output-no-compression', 'low-mid-thick',
  'fast-decay-low-resonance', 'fast-decay-focused-low',
  'focused-narrow-output', 'focused-low-end-decay',
  'narrow-q-precise', 'narrow-attack-onset', 'tight-rhythmic-articulation',
  'quick-toggle-mechanism', 'low-coloration-balanced',
  'clean-articulation-low-blur', 'low-mass-responsive',
  'low-blend-articulate', 'low-distortion-low-coloration',
  'overtone-rich-sustained',
  'harmonically-rich-sustained', 'articulate-low-distortion',
  'natural-material-resonance',
  // mechanism-grounded vibe words kept as-is (already specific enough)
  'clean', 'dry', 'dark',
  // Phase 6+ stragglers cleanup: era markers (real classification axes)
  'traditional', 'modern', 'vintage', 'classic',
  // Phase 6+ stragglers cleanup: real performance/mechanism vocabulary
  'mellow', 'snappy', 'growly', 'crisp', 'woody',
  'projecting', 'articulate', 'expressive', 'sustaining', 'cutting',
  'controlled', 'foundational', 'lively', 'thick', 'round', 'chunky', 'slinky',
  'oily-pore-damping', 'slow-attack-decay',
  'silvery', 'frictionless-glide',
  // Sonic-character anchors that aren't genre-specific
  'midrange-forward', 'feedback', 'fuzzed', 'wah-modulated',
  'singing', 'melodic', 'chordal', 'lyrical',
  // Specific sonic terms for variants that would otherwise be unsurfaceable —
  // canonical descriptors of their instrument family but not iconic by name match.
  'piercing', 'buzzy', 'reedy', 'metallic', 'clangy',
  'responsive', 'dialoguing',
]);

function isTrustedTechnique(desc) {
  return TRUSTED_TECHNIQUE_DESCRIPTORS.has(String(desc).toLowerCase().trim());
}

// Genre-bound iconic tokens — descriptors whose meaning is so tightly tied to a
// specific genre family that they READ as a genre identification rather than a
// neutral technique. When a variant's iconic descriptor contains one of these
// tokens, surfacing the descriptor requires direct grounding in the tradition's
// own name/lineage/parent/crossrefs.
//
// Example: `four-on-floor` is iconic for `percussion_disco_four_on_floor`. If a
// tradition inherits "disco" signal only via a misassigned room, the variant
// might score high enough to be picked, but surfacing "four-on-floor drum kit"
// in the recipe would falsely identify the tradition as disco. This list forces
// such cases to be dropped unless the tradition itself contains disco/dance signal.
//
// The list is small and carefully curated — it covers tokens that are
// near-pathognomonic of a specific genre family. Most iconic descriptors
// (chicken-scratch, palm-muted, bottleneck, fingerpicked) are technique
// vocabulary that legitimately reads across many traditions and stay bypassed.
const GENRE_BOUND_ICONIC_TOKENS = new Set([
  'four-on-floor', 'four', 'on', 'floor',  // disco/house signature beat (also caught as split tokens)
  'breakbeat',                              // jungle/dnb signature
  'rave', 'gabber', 'hardstyle',            // hardcore-electronic signatures
  'trap', 'drill',                          // hip-hop subgenre identifiers
  'reggaeton', 'dembow',                    // reggaeton signature
  'twostep', 'two-step',                    // UK garage
  'gqom',                                   // South African gqom
  'cumbia',                                 // Latin-genre identifiers (when iconic-bound)
]);

// Generic stem tokens that appear in many variant ids and parent paths but carry
// no genre information. When checking whether a variant id is "directly grounded"
// in a tradition's context, matches on these tokens don't count — they're noise.
// Examples: percussion_disco_four_on_floor — `percussion` matches every percussion
// tradition's parent path, so a match on `percussion` alone shouldn't satisfy the
// genre-bound trust check.
const GENRE_NEUTRAL_STEM_TOKENS = new Set([
  'percussion', 'technique', 'drum', 'kit', 'bass', 'guitar', 'voice',
  'electric', 'acoustic', 'string', 'wind', 'brass', 'reed',
  'mode', 'modes', 'style', 'styles', 'pattern', 'beat', 'rhythm',
  'low', 'mid', 'high', 'fast', 'slow', 'loud', 'soft',
]);

// Check if a descriptor is a pure-default token to drop entirely.
// IMPORTANT: only drop descriptors that are PURELY meta-tags. Compound descriptors
// like "jazz-canonical" carry the "jazz" information after stripCanonical and must
// NOT be dropped here.
function isDefaultDescriptor(desc) {
  const d = String(desc).toLowerCase().trim();
  return d === 'canonical' || d === 'standard' || d === 'default' ||
         d === 'unmarked' || d === 'normal' || d === 'plain' ||
         d === 'none' || d === 'minimal';
}

function displayInstrumentName(instId) {
  if (ID_DISPLAY_OVERRIDES[instId] !== undefined) return ID_DISPLAY_OVERRIDES[instId];
  // Default: underscore → space, lowercase, except known-proper tokens
  return instId.replace(/_/g, ' ').toLowerCase();
}

function displayRoomLabel(roomId) {
  if (ID_DISPLAY_OVERRIDES[roomId] !== undefined) return ID_DISPLAY_OVERRIDES[roomId];
  // Strip "studio_" prefix and translate
  return roomId.replace(/^studio_/, '').replace(/_/g, ' ').toLowerCase();
}

// Common abbreviation expansions in the tree-node camelCase ids
const ABBREV_EXPANSIONS = {
  'elec': 'electric',
  'rb': 'R&B',
  'mc': 'MC',
  'rnb': 'R&B',
  'pa': 'PA',
  'sa': 'South Asian',
  'na': 'North African',
  'sea': 'Southeast Asian',
};

// Translate camelCase tree-node id like "groovePercussion.afroDiasporicElec"
// into "Afro-diasporic electric branch".
// For digit-suffix segments like "confessional60s", split off the digit-prefix
// and put it FIRST as the leading temporal qualifier: "confessional60s" → "60s confessional".
// When a digit-prefix is present, drop the "branch" suffix — the era-tag already
// signals the sub-category position.
function displayTreeNode(nodeId) {
  if (!nodeId) return '';
  const segs = nodeId.split('.');
  const last = segs[segs.length - 1];

  // First split on camelCase boundaries
  let words = last.replace(/([A-Z])/g, ' $1').trim().toLowerCase().split(/\s+/);

  // Then split each word on digit-boundaries: "confessional60s" → ["confessional", "60s"]
  const splitWords = [];
  for (const w of words) {
    const parts = w.split(/(\d+s?)/).filter(Boolean);
    for (const p of parts) splitWords.push(p);
  }

  // Reorder: pull any digit-suffix (like "60s") to the FRONT as a temporal qualifier
  const digitTokens = [];
  const wordTokens = [];
  for (const t of splitWords) {
    if (/^\d+s?$/.test(t)) digitTokens.push(t);
    else wordTokens.push(t);
  }
  const hasDigitPrefix = digitTokens.length > 0;
  const reordered = [...digitTokens, ...wordTokens];

  // Apply abbreviation expansions + Afro-X compounding + proper-noun capitalization
  const expanded = reordered.map(w => ABBREV_EXPANSIONS[w] || w);
  const compounded = [];
  for (let i = 0; i < expanded.length; i++) {
    const w = expanded[i];
    if (w === 'afro' && i + 1 < expanded.length) {
      const next = expanded[i + 1];
      compounded.push('Afro-' + next);
      i++;
    } else {
      compounded.push(PROPER_NOUNS.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w);
    }
  }
  // "branch" suffix appears for sub-nodes (depth >= 1), but NOT when a digit-prefix
  // is present (the era-tag itself already signals sub-category position).
  const isSubNode = segs.length > 1;
  if (isSubNode && !hasDigitPrefix) {
    return compounded.join(' ') + ' branch';
  }
  return compounded.join(' ');
}

// For crossRefs, render the full path joined into a phrase rather than just the leaf.
// "improvOnFrame.americanJazz.fusion" → "American jazz fusion"
// "mcRhythm.afroDiasporic" → "Afro-diasporic MC rhythm"
function displayCrossRef(refId) {
  if (!refId) return '';
  const segs = refId.split('.');
  // For each segment, split camelCase and expand abbreviations
  const segWords = segs.map(seg => {
    const words = seg.replace(/([A-Z])/g, ' $1').trim().toLowerCase().split(/\s+/);
    return words.map(w => ABBREV_EXPANSIONS[w] || w);
  });

  // Reconstruct with a heuristic that puts qualifiers before the head noun.
  // Pattern: root_seg becomes the noun-phrase head, leaf_segs are qualifiers preceding it.
  // "improvOnFrame.americanJazz.fusion" — root="improv on frame", mid="american jazz", leaf="fusion"
  // → "American jazz fusion" (drops "improv on frame" because the leaf+mid carry the meaning)
  // "mcRhythm.afroDiasporic" — root="MC rhythm", leaf="afro diasporic"
  // → "Afro-diasporic MC rhythm"
  if (segWords.length === 1) {
    return formatTokens(segWords[0]);
  }
  if (segWords.length === 2) {
    // leaf modifies root — leaf comes first
    const root = formatTokens(segWords[0]);
    const leaf = formatTokens(segWords[1]);
    return leaf + ' ' + root;
  }
  // 3+ segments: leaf modifies mid (drop root which is the category)
  // "functionalSong.country.outlaw" — root="functional song", mid="country", leaf="outlaw"
  // → "outlaw country" (leaf-modifies-mid, drop root-category)
  // "improvOnFrame.americanJazz.fusion" — root="improv on frame", mid="american jazz", leaf="fusion"
  // → "American jazz fusion" (special-case: when mid contains a region/style modifier
  //   already, leaf chains as terminus — "fusion" is itself a noun-modifier-of-jazz here)
  const mid = formatTokens(segWords[1]);
  const leaf = formatTokens(segWords[segWords.length - 1]);
  // If mid is a multi-word phrase (containing a space), leaf chains after it.
  // If mid is a single word, leaf comes before as modifier.
  if (mid.includes(' ')) {
    return mid + ' ' + leaf;
  }
  return leaf + ' ' + mid;
}

function formatTokens(words) {
  // Apply Afro-X compounding and proper-noun capitalization
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 'afro' && i + 1 < words.length) {
      const next = words[i + 1];
      out.push('Afro-' + next);
      i++;
    } else {
      out.push(PROPER_NOUNS.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w);
    }
  }
  return out.join(' ');
}

// Translate a tree-node parent path's first segment for the opening sentence.
// Preserves camelCase capitalization to indicate category-defining nouns
// (groovePercussion → "groove Percussion", droneModal → "drone Modal").
function displayTreeRoot(nodeId) {
  if (!nodeId) return '';
  const root = nodeId.split('.')[0];
  // Split on capital-letter boundaries but preserve the capital
  const segments = root.replace(/([A-Z])/g, ' $1').trim().split(/\s+/);
  // First segment: lowercase; rest: keep their capital from the camelCase
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    if (i === 0) out.push(segments[i].toLowerCase());
    else out.push(segments[i].charAt(0).toUpperCase() + segments[i].slice(1).toLowerCase());
  }
  return out.join(' ');
}

// ============================================================
// CONFIG → DESCRIPTOR STACK
// ============================================================

function extractEraFromText(text) {
  if (!text) return null;
  // Pre-strip tokens that read as "lineage from X" rather than "era is X" — e.g.
  // "1960s-derived chimey-guitar pop" reads as a stylistic-lineage reference, not an era.
  // Without this strip, jangle_pop's lineage "1960s-derived" leaks "mid-1960s" into the
  // era display even though the tradition is post-1980 by every other signal.
  const cleanedText = String(text).replace(/\b\d{4}s?[-\s]+(derived|influenced|inspired|rooted|adjacent|tradition|heritage|lineage|era)\b/gi, '');
  // Match "(2001–2010)" or "(1962-1968)" or "1962–1968"
  const range = cleanedText.match(/\b(\d{4})\s*[–-]\s*(\d{4})\b/);
  if (range) return { start: parseInt(range[1]), end: parseInt(range[2]) };
  // Match "X-present" or "X-onward" (open-ended ranges) — treat as modern-onward, no specific end year
  const openEnded = cleanedText.match(/\b(\d{4})\s*[–-]\s*(present|onward|now)\b/i);
  if (openEnded) {
    const start = parseInt(openEnded[1]);
    return { start, end: 2030, qualifier: 'modern' };  // sentinel end-year, qualifier signals "post-X / modern"
  }
  // Match "early-1960s", "mid-1970s", "late-2000s", "1950s"
  const decadeWithQual = cleanedText.match(/\b(early|mid|late)[-\s]+(\d{4})s\b/i);
  if (decadeWithQual) {
    const d = parseInt(decadeWithQual[2]);
    const qual = decadeWithQual[1].toLowerCase();
    if (qual === 'early') return { start: d, end: d + 3, qualifier: 'early' };
    if (qual === 'mid') return { start: d + 4, end: d + 6, qualifier: 'mid' };
    if (qual === 'late') return { start: d + 7, end: d + 9, qualifier: 'late' };
  }
  const decade = cleanedText.match(/\b(\d{4})s\b/);
  if (decade) {
    const d = parseInt(decade[1]);
    return { start: d, end: d + 9 };
  }
  // Match a single year
  const year = cleanedText.match(/\b(\d{4})\b/);
  if (year) return { start: parseInt(year[1]), end: parseInt(year[1]) };
  return null;
}

function buildSentence1(config) {
  // "classic West African mid-1970s afrobeat, groove Percussion, Afro-diasporic electric branch, American jazz fusion, Afro-diasporic MC rhythm."
  const primaryId = config.traditions[0];
  const t = C.TRADITIONS.find(x => x.id === primaryId);
  const e = C.TRADITION_EXTRAS[primaryId] || {};
  if (!t) return '';

  // Era: prefer tradition name/lineage for tradition-era; fall back to archetype/room
  const arch = config.archetype ? C.CHAIN_ARCHETYPES.find(a => a.id === config.archetype) : null;
  const room = config.room ? C.ROOMS.find(r => r.id === config.room) : null;
  const traditionEra = extractEraFromText(t.name) || extractEraFromText(t.lineage);
  const equipmentEra = arch?.era || room?.era || null;
  // Use tradition era if found; else equipment era as fallback
  const eraRange = traditionEra || (equipmentEra ? extractEraFromText(equipmentEra) : null);
  const region = arch?.region || room?.region || null;

  const parts = [];
  // Modifier: "classic" - we'll add this if the tradition's family or lineage suggests
  parts.push('classic');

  // Region modifier
  if (region && REGION_DISPLAY[region]) parts.push(REGION_DISPLAY[region]);

  // Era modifier — but skip if tradition name itself already contains era reference
  const tradNameLower = t.name.toLowerCase();
  const nameAlreadyHasEra = /\b(early|mid|late)?[-\s]?\d{4}s?\b/.test(tradNameLower);
  if (eraRange && !nameAlreadyHasEra) {
    const ay = eraRange.start;
    const by = eraRange.end;
    // Open-ended modern range (X-present): display as 'modern' not specific decade
    if (eraRange.qualifier === 'modern') {
      parts.push('modern');
    } else if (by - ay >= 5 && by - ay <= 25) {
      const mid = Math.round((ay + by) / 2);
      const decade = Math.floor(mid / 10) * 10;
      parts.push(`mid-${decade}s`);
    } else if (by - ay > 25) {
      const decade = Math.floor(ay / 10) * 10;
      parts.push(`early-${decade}s`);
    } else if (by === ay) {
      const decade = Math.floor(ay / 10) * 10;
      const yearInDecade = ay - decade;
      if (yearInDecade <= 3) parts.push(`early-${decade}s`);
      else if (yearInDecade <= 6) parts.push(`mid-${decade}s`);
      else parts.push(`late-${decade}s`);
    } else {
      parts.push(`${ay}-${by}`);
    }
  }

  // Tradition name (lowercased, since "afrobeat" is the anchor)
  // Strip parenthetical gloss like "Khayal (Hindustani classical vocal)" → "khayal"
  let tradName = t.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  parts.push(tradName.toLowerCase());

  // Now append parent-tree-node + crossRefs as additional structural-position commas
  const positionTerms = [];
  // Track tokens already-surfaced so crossRefs don't repeat parent path content
  const surfacedTokens = new Set();
  const recordTokens = (s) => {
    if (!s) return;
    for (const t of s.toLowerCase().split(/\s+/)) {
      if (t.length > 2) surfacedTokens.add(t);
    }
  };
  if (e.parent) {
    const root = displayTreeRoot(e.parent);
    if (root) { positionTerms.push(root); recordTokens(root); }
    if (e.parent.includes('.')) {
      const leaf = displayTreeNode(e.parent);
      if (leaf && leaf.toLowerCase() !== root.toLowerCase()) {
        positionTerms.push(leaf); recordTokens(leaf);
      }
    }
  }
  for (const cr of (e.crossRefs || [])) {
    const crRef = typeof cr === 'string' ? cr : (cr && cr.ref);
    if (!crRef) continue;
    const crDisplay = displayCrossRef(crRef);
    if (!crDisplay) continue;
    // Skip a crossRef that's effectively duplicating the parent path. If every
    // significant token in the crossRef display is already surfaced, drop it.
    const crTokens = crDisplay.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (crTokens.length > 0 && crTokens.every(t => surfacedTokens.has(t))) continue;
    positionTerms.push(crDisplay);
    recordTokens(crDisplay);
  }

  // Collect stapled traditions separately. They append as a single space-joined trailing
  // phrase to the last position-term (no comma, no symbol) — they read as one continuous
  // lineage chain rather than separate categorical clauses.
  const stapleTerms = [];
  if (Array.isArray(config.traditions) && config.traditions.length > 1) {
    for (let i = 1; i < config.traditions.length; i++) {
      const stapleId = config.traditions[i];
      const stapleT = C.TRADITIONS.find(x => x.id === stapleId);
      if (!stapleT) continue;
      let stapleName = stapleT.name.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
      // Skip if the stapled tradition's name overlaps existing position terms (would be redundant)
      const stapleTokens = stapleName.split(/\s+/).filter(w => w.length > 3);
      const isRedundant = positionTerms.some(pt => {
        const ptLower = pt.toLowerCase();
        return stapleTokens.every(st => ptLower.includes(st));
      });
      if (isRedundant) continue;
      // Also skip if already in stapleTerms (multiple staples with same name)
      if (stapleTerms.includes(stapleName)) continue;
      stapleTerms.push(stapleName);
    }
  }

  const sentence = parts.join(' ');
  if (positionTerms.length === 0 && stapleTerms.length === 0) return sentence + '.';
  // Position terms are comma-separated. Staples merge into the last term via space-join.
  let positionStr;
  if (stapleTerms.length === 0) {
    positionStr = positionTerms.join(', ');
  } else if (positionTerms.length === 0) {
    positionStr = stapleTerms.join(' ');
  } else {
    // Last position term gets staples appended via space
    const allButLast = positionTerms.slice(0, -1);
    const last = positionTerms[positionTerms.length - 1];
    const lastWithStaples = [last, ...stapleTerms].join(' ');
    positionStr = [...allButLast, lastWithStaples].join(', ');
  }
  return sentence + ', ' + positionStr + '.';
}

function buildSentence2_voice(config, _trustedTokens) {
  // "blues-shouter, narrative."
  // Take the IDENTIFYING descriptor (the iconic name) from each scoring part.
  // Just voice descriptors, no noun.
  const voiceSlot = (config.instruments || []).find(i => i.id === 'voice');
  if (!voiceSlot) return null;
  const voice = C.INSTRUMENTS.find(i => i.id === 'voice');
  if (!voice) return null;
  const descriptors = [];
  for (const part of (voice.parts || [])) {
    const variantId = (voiceSlot.slots || {})[part.id];
    if (!variantId) continue;
    // Skip uninformed picks. Threshold tuned post-substring-bleed structural fix:
    // pre-fix scores were inflated by subtoken overlap (every shared subtoken
    // added prose/singles credit through the unified weights map). With bleed
    // removed by the type-separated matching surface, absolute scores
    // are compressed — a confident pick like aspirated_voice for samba now
    // sits at ~0.9 where it used to be ~3.5. The 0.5 threshold preserves the
    // intent (drop uninformed picks) without losing legitimate surfacings.
    const score = (voiceSlot.scores || {})[part.id];
    if (score !== undefined && score < 0.5) continue;
    const variant = part.variants.find(v => v.id === variantId);
    if (!variant) continue;
    // Take the iconic descriptor only — usually the first non-default, non-score-hint descriptor
    // (e.g., "blues-shouter" from blues_shouter_voice, "narrative" from narrative_voice).
    // canonical_tags are scoring-only structural metadata; they no longer surface in prose
    // (see earlier surgical fix at entryRenderDescs/buildStackParts in the HTML embed).
    const allDescs = [...(variant.descriptors || [])];
    for (const d of allDescs) {
      if (isDefaultDescriptor(d)) continue;
      const stripped = stripCanonical(d);
      if (isScoreHintOnly(stripped)) continue;
      descriptors.push(displayDescriptor(stripped));
      break; // one per variant — the iconic name
    }
  }
  if (descriptors.length === 0) return null;
  const unique = [...new Set(descriptors)].slice(0, 4);
  return unique.join(', ') + '.';
}

// Render an arrangement descriptor sentence from config.arrangement.
// Pulls the arrangement record's name and a small selection of its
// characteristic_techniques, surfaces as a compact descriptor line.
// Returns null if no arrangement is configured.
function buildSentenceArrangement(config) {
  if (!config || !config.arrangement) return null;
  const arr = (C.ARRANGEMENTS || []).find(a => a.id === config.arrangement);
  if (!arr) return null;
  // Name is a human-readable phrase; downcase and lightly normalize for tag flow.
  const nameTokens = arr.name.toLowerCase()
    .replace(/[/()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Pull the top 2-3 most distinctive characteristic_techniques.
  const techniques = (arr.characteristic_techniques || [])
    .filter(t => !/^(meter-|no-|voice-|verse-by-verse)/.test(t))
    .slice(0, 3)
    .map(t => t.replace(/-/g, ' '));
  const parts = [nameTokens];
  if (techniques.length) parts.push(techniques.join(', '));
  return parts.join(', ') + '.';
}

// Collapse repeated trailing-noun nouns across multiple phrases. Saves bytes
// against the 1,000-char ceiling so the budget can fund more descriptors.
//
// Two collapse cases:
//   (a) Same instrument across multiple phrases (e.g., "rustling voice" +
//       "hiraeth voice" → "rustling hiraeth voice"). Identified by exact
//       match of the canonical instrument display-name suffix.
//   (b) Different instruments that share a trailing word AND that trailing
//       word is not itself a canonical full instrument display-name
//       (e.g., "parlor acoustic guitar" + "single coil electric guitar"
//       → "parlor acoustic single coil electric guitar"; the word "guitar"
//       alone is not an instrument display-name). Preserves all body-shape
//       and pickup-type qualifiers — only the trailing repetition is dropped.
//
// Exclusion: if the trailing word IS a canonical instrument display-name
// (e.g., "choir" if 'choir' is a standalone catalog entry), do NOT collapse
// across different instruments — they're meaningfully different sounds
// even though they share a trailing token.
//
// Phrase format on input: "<descriptors> <instrument-display-name>", where
// descriptors may be empty. Order of phrases is preserved in output, with
// each collapse group replacing its first occurrence and removing the rest.
function collapseRepeatedNouns(phrases) {
  if (!phrases || phrases.length < 2) return phrases;

  // Build the set of canonical instrument display-names. We use this both
  // to find the longest-matching instrument-suffix in each phrase AND to
  // veto cross-instrument collapse when the trailing word is itself a name.
  const dispToId = new Map(); // display-name → instrument-id
  for (const inst of C.INSTRUMENTS) {
    const disp = displayInstrumentName(inst.id);
    if (disp) dispToId.set(disp, inst.id);
  }
  // Sorted longest-first for greedy suffix-matching: "single coil electric
  // guitar" must win over "guitar" alone (which isn't even a key, but the
  // principle holds for cases like "choir" vs "choir ensemble").
  const dispsLongestFirst = [...dispToId.keys()].sort((a, b) => b.length - a.length);

  // Identify each phrase's longest-matching canonical instrument suffix.
  // Everything before that suffix is descriptors (already-collapsed within
  // the per-instrument phrase build).
  const parsed = phrases.map((p, idx) => {
    for (const disp of dispsLongestFirst) {
      if (p === disp) {
        return { idx, phrase: p, descriptors: '', instDisp: disp, trailingWord: lastWord(disp) };
      }
      if (p.endsWith(' ' + disp)) {
        return {
          idx,
          phrase: p,
          descriptors: p.slice(0, p.length - disp.length - 1),
          instDisp: disp,
          trailingWord: lastWord(disp),
        };
      }
    }
    // Fallback: phrase didn't match any canonical instrument display-name
    // (e.g., proper-noun-only name with no descriptors and a non-standard
    // form). Leave it alone — single-element group, won't collapse.
    return { idx, phrase: p, descriptors: '', instDisp: p, trailingWord: lastWord(p) };
  });

  // Group by trailing word, preserving first-occurrence order.
  const groupOrder = [];
  const byTrailing = new Map();
  for (const item of parsed) {
    if (!byTrailing.has(item.trailingWord)) {
      byTrailing.set(item.trailingWord, []);
      groupOrder.push(item.trailingWord);
    }
    byTrailing.get(item.trailingWord).push(item);
  }

  // Walk the original phrase order. For each phrase, emit either:
  //   - the collapsed group output (only on the first occurrence of that group)
  //   - the original phrase (if its group is singleton OR collapse is vetoed)
  //   - nothing (if this is a non-first member of a collapsed group)
  const emitted = new Set();
  const result = [];
  for (const item of parsed) {
    const group = byTrailing.get(item.trailingWord);
    if (group.length < 2) {
      result.push(item.phrase);
      continue;
    }
    if (emitted.has(item.trailingWord)) continue; // already emitted the collapsed form
    emitted.add(item.trailingWord);

    const allSameInst = group.every(g => g.instDisp === group[0].instDisp);
    if (allSameInst) {
      // case (a): collapse descriptors, single noun
      const descs = group.map(g => g.descriptors).filter(d => d).join(' ');
      result.push(descs ? `${descs} ${group[0].instDisp}` : group[0].instDisp);
      continue;
    }

    // case (b) eligibility: trailing word must NOT itself be a canonical
    // instrument display-name. If "choir" alone is a catalog entry, then
    // "choir" + "cogic choir" stay separate (they're different instruments).
    if (dispToId.has(item.trailingWord)) {
      // veto: emit each phrase separately
      for (const g of group) {
        result.push(g.phrase);
      }
      continue;
    }

    // case (b): collapse trailing word, keep each prefix intact
    const segments = group.map(g => {
      const instWithoutTrailing = g.instDisp.slice(0, -item.trailingWord.length - 1);
      return g.descriptors
        ? `${g.descriptors} ${instWithoutTrailing}`
        : instWithoutTrailing;
    });
    result.push(`${segments.join(' ')} ${item.trailingWord}`);
  }

  return result;
}

function lastWord(s) {
  const trimmed = s.trim();
  const idx = trimmed.lastIndexOf(' ');
  return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

function buildSentence3_instruments(config, trustedTokens) {
  const phrases = [];
  for (const inst of (config.instruments || [])) {
    if (inst.id === 'voice') continue; // handled in sentence 2
    const cataInst = C.INSTRUMENTS.find(i => i.id === inst.id);
    if (!cataInst) continue;

    // Collect 1-2 ICONIC descriptors per scoring part. Iconic = the first non-default,
    // non-score-hint descriptor in the catalog list (which is by convention the variant's
    // identifying name, e.g. "chicken-scratch", "honking", "wide-drawbars").
    // Technique-bearing parts go LAST in the stack so the strongest descriptor lands
    // closest to the instrument anchor noun.
    const partGroups = [];
    for (const part of (cataInst.parts || [])) {
      const variantId = (inst.slots || {})[part.id];
      if (!variantId) continue;
      const score = (inst.scores || {})[part.id];
      // Family-derived parts get a higher confidence bar — they're inherited
      // vocabulary, not authored for this specific instrument, so they need
      // to score strongly to surface (avoids weak family-variants leaking in).
      const threshold = part._fromFamily ? 3.0 : 1.0;
      if (score !== undefined && score < threshold) continue;
      const variant = part.variants.find(v => v.id === variantId);
      if (!variant) continue;
      // Compute identity-token set for iconic detection: variant id tokens AND
      // variant name tokens (lowercased, split on common separators). A descriptor
      // is iconic if any of its tokens matches any identity token. Including
      // name tokens matches the audit's permissiveness — variants that name
      // their identity in name field rather than id still get to surface.
      const idTokens = new Set(variantId.toLowerCase().split('_'));
      const nameTokens = ((variant.name || '').toLowerCase().split(/[\s\-(),/]+/).filter(t => t.length >= 3));
      for (const t of nameTokens) idTokens.add(t);
      // Score each descriptor: descriptors that share a token with the variant id or name are iconic.
      // canonical_tags are scoring-only structural metadata; they no longer surface in prose
      // (see earlier surgical fix at entryRenderDescs/buildStackParts in the HTML embed).
      const scored = [];
      const allDescs = [...(variant.descriptors || [])];
      for (const d of allDescs) {
        if (isDefaultDescriptor(d)) continue;
        const stripped = stripCanonical(d);
        if (isScoreHintOnly(stripped)) continue;
        const dTokens = stripped.toLowerCase().split(/[-\s]/);
        let iconicMatch = false;
        for (const dTok of dTokens) {
          if (idTokens.has(dTok)) { iconicMatch = true; break; }
        }
        // Trust filtering:
        // - Non-iconic descriptors: filter against tradition's `all` trusted-tokens
        //   (rooms/archetypes no longer inherit genre tokens).
        // - Iconic descriptors normally bypass the trust filter — they're the
        //   variant's identifying name and should surface when the variant is picked.
        // - EXCEPTION: a small set of iconic descriptors are GENRE-BOUND — their
        //   meaning is tightly tied to a specific tradition family (e.g. "four-on-floor"
        //   reads as disco/house). These require direct-context grounding (in the
        //   tradition's own name/lineage/parent/crossrefs, NOT inherited from a
        //   misassigned room). This prevents leaks where a variant scores high via
        //   the iconic word gives away the wrong genre identity.
        // - Trusted-technique whitelist (open-tuned, fingerpicked, ...) bypasses everything.
        if (isTrustedTechnique(stripped)) {
          // bypass — technique vocabulary is tradition-agnostic
        } else if (iconicMatch) {
          const isGenreBoundIconic = dTokens.some(t => GENRE_BOUND_ICONIC_TOKENS.has(t));
          if (isGenreBoundIconic) {
            const direct = trustedTokens && trustedTokens.direct;
            if (direct && direct.size > 0) {
              // Check: any descriptor token in direct context?
              let directlyGrounded = false;
              for (const dTok of dTokens) {
                if (direct.has(dTok)) { directlyGrounded = true; break; }
              }
              // Fallback: any DISTINCTIVE variant id token in direct context?
              // Stem tokens like "percussion", "technique", "drum", "kit", "bass"
              // appear in every tradition's parent path so they grant nothing.
              // Exclude them so the check actually filters.
              if (!directlyGrounded) {
                for (const idTok of idTokens) {
                  if (idTok.length > 2 && !GENRE_NEUTRAL_STEM_TOKENS.has(idTok) && direct.has(idTok)) {
                    directlyGrounded = true; break;
                  }
                }
              }
              if (!directlyGrounded) continue; // drop the descriptor entirely
            }
          }
        } else {
          // Non-iconic character descriptor: permissive check against `all`.
          const all = trustedTokens && trustedTokens.all;
          if (all && all.size > 0) {
            let trusted = false;
            for (const dTok of dTokens) {
              if (all.has(dTok)) { trusted = true; break; }
            }
            if (!trusted) continue;
          }
        }
        scored.push({ d: displayDescriptor(stripped), iconic: iconicMatch });
      }
      const iconics = scored.filter(s => s.iconic);
      if (iconics.length === 0) continue;
      const characters = scored.filter(s => !s.iconic).slice(0, 2);
      const isTechniquePart = /technique|articulation|mute|mouthpiece|drawbar|rotary|percussion_setting|attack|quality/.test(part.id);
      partGroups.push({
        characters: characters.map(s => s.d),
        iconics: iconics.map(s => s.d),
        isTechniquePart,
        partId: part.id,
      });
    }
    // Order: physical-construction first, technique last
    partGroups.sort((a, b) => {
      if (a.isTechniquePart === b.isTechniquePart) return 0;
      return a.isTechniquePart ? 1 : -1;
    });

    // Two-pass budget allocation:
    // - If only 1 part contributes (e.g., guitar with just chicken_scratch), take its iconics + 2 chars.
    // - If multiple parts contribute (e.g., tonewheel_organ with drawbars+rotary), take iconics ONLY
    //   from each part to keep the descriptor stack tight.
    const cap = 5;
    const finalDescs = [];

    if (partGroups.length === 1) {
      // Single-part contributor: use its characters too
      const g = partGroups[0];
      for (const c of g.characters) if (!finalDescs.includes(c)) finalDescs.push(c);
      for (const ic of g.iconics) if (!finalDescs.includes(ic)) finalDescs.push(ic);
    } else if (partGroups.length > 1) {
      // Multi-part contributor: iconics ONLY (keeps stack tight)
      for (const g of partGroups) {
        for (const ic of g.iconics) if (!finalDescs.includes(ic)) finalDescs.push(ic);
      }
    }
    const trimmed = finalDescs.slice(0, cap);
    const instName = displayInstrumentName(inst.id);
    if (!instName) continue;
    if (trimmed.length === 0) {
      phrases.push(instName);
    } else {
      phrases.push(trimmed.join(' ') + ' ' + instName);
    }
  }
  if (phrases.length === 0) return null;
  const collapsed = collapseRepeatedNouns(phrases);
  return collapsed.join(', ') + '.';
}

function buildSentence4_room(config) {
  // "large tropical 1965-1985 mid-major EMI."
  if (!config.room) return null;
  const room = C.ROOMS.find(r => r.id === config.room);
  if (!room) return null;

  // For commercial_studio rooms, build modifier stack
  if (room.cluster === 'commercial_studio') {
    const label = displayRoomLabel(room.id);
    const labelLower = (label || '').toLowerCase();
    const mods = [];
    // Only the first non-default descriptor — others tend to be filler
    const firstDesc = (room.descriptors || []).find(d => {
      if (isDefaultDescriptor(d)) return false;
      const disp = displayDescriptor(stripCanonical(d));
      // Skip descriptors that contain the label (would print "EMI ... EMI")
      if (labelLower && disp.toLowerCase().includes(labelLower)) return false;
      return true;
    });
    if (firstDesc) mods.push(displayDescriptor(stripCanonical(firstDesc)));
    if (room.era) {
      const eraDisp = String(room.era).replace(/[–]/g, '-');
      mods.push(eraDisp);
    }
    if (room.scale_tier) mods.push(displayDescriptor(room.scale_tier));
    if (label) {
      return mods.join(' ') + ' ' + label + '.';
    }
  }
  // Generic rooms
  const label = displayRoomLabel(room.id);
  if (!label) return null;
  return label + '.';
}

function buildSentence5_chain(config) {
  // "large-diaphragm condenser, German V72 tube pre, German tube console, vari-mu, Pultec passive program EQ."
  // When archetype is set, archetype components win — they're period-curated. The
  // inline_chain values are treated as fallback for traditions without an archetype.
  // (To override individual archetype components, the user must edit the archetype
  // or omit it entirely and use inline_chain.)
  let components = null;
  if (config.archetype) {
    const arch = C.CHAIN_ARCHETYPES.find(a => a.id === config.archetype);
    if (arch) components = arch.components;
  }
  if (!components && config.inline_chain) {
    components = {
      mic: config.inline_chain.mic,
      pre: config.inline_chain.pre,
      console: config.inline_chain.console,
      comp: config.inline_chain.comp,
      eq: config.inline_chain.eq,
      amp: config.inline_chain.amp,
      medium: config.inline_chain.medium,
    };
  }
  if (!components) return null;

  const parts = [];
  const order = ['mic', 'pre', 'amp', 'console', 'comp', 'eq'];
  for (const sec of order) {
    const itemId = components[sec];
    if (!itemId) continue;
    if (Array.isArray(itemId)) continue;
    if (CHAIN_DISPLAY[itemId] === null) continue;
    const sectionData = C.CHAIN_SECTIONS.find(s => s.id === sec);
    if (!sectionData) continue;
    const item = sectionData.items.find(x => x.id === itemId);
    if (!item) continue;
    const display = displayChainItem(item);
    if (display) parts.push(display);
  }
  if (parts.length === 0) return null;
  return parts.join(', ') + '.';
}

function displayChainItem(item) {
  // Use curated display map first
  if (CHAIN_DISPLAY[item.id] !== undefined) return CHAIN_DISPLAY[item.id];
  // Fallback: strip parentheticals from name, lowercase, preserve known proper nouns
  const name = item.name || item.id;
  let display = name.replace(/\s*\([^)]*\)/g, '').trim();
  const tokens = display.split(/(\s+|-)/);
  return tokens.map(tok => {
    if (tok === ' ' || tok === '-' || /^\s+$/.test(tok)) return tok;
    const lc = tok.toLowerCase();
    if (PROPER_NOUNS.has(lc)) return lc.charAt(0).toUpperCase() + lc.slice(1);
    if (/^[A-Z0-9]+$/.test(tok)) return tok;
    return lc;
  }).join('');
}

function buildSentence6_medium_fx(config) {
  // "Studer 30ips tape  echo plate reverb."
  // When archetype is set, archetype components win — they're period-curated. The
  // inline_chain.medium is treated as fallback for traditions without an archetype.
  // FX from archetype are augmented (not overridden) by seed.fx_extras.
  const parts = [];
  let mediumIsTape = false;
  let medium = null;
  let fx = [];

  if (config.archetype) {
    const arch = C.CHAIN_ARCHETYPES.find(a => a.id === config.archetype);
    if (arch) {
      medium = arch.components.medium;
      if (Array.isArray(arch.components.fx)) fx = [...arch.components.fx];
    }
  }
  if (!medium && config.inline_chain) {
    medium = config.inline_chain.medium;
  }
  // fx_extras append to archetype's fx (deduped)
  if (Array.isArray(config.fx_extras)) {
    for (const fxId of config.fx_extras) {
      if (!fx.includes(fxId)) fx.push(fxId);
    }
  }

  if (medium && CHAIN_DISPLAY[medium] !== null) {
    const sec = C.CHAIN_SECTIONS.find(s => s.id === 'medium');
    const item = sec?.items.find(x => x.id === medium);
    if (item) {
      const d = displayChainItem(item);
      parts.push(d);
      if (d && d.toLowerCase().includes('tape')) mediumIsTape = true;
    }
  }
  // Order fx: tape-related first (extension of medium), then reverbs/spatial
  if (Array.isArray(fx)) {
    const tapeFirst = [];
    const rest = [];
    for (const fxId of fx) {
      if (fxId.startsWith('tape_')) tapeFirst.push(fxId);
      else rest.push(fxId);
    }
    for (const fxId of [...tapeFirst, ...rest]) {
      const fxSection = C.CHAIN_SECTIONS.find(s => s.id === 'fx');
      const item = fxSection?.items.find(x => x.id === fxId);
      if (!item) continue;
      let display = displayChainItem(item);
      if (mediumIsTape && display && display.toLowerCase().startsWith('tape ')) {
        display = display.slice(5);
      }
      parts.push(display);
    }
  }
  if (parts.length === 0) return null;
  return parts.join(' ') + '.';
}

// ============================================================
// ASSEMBLE & TRIM TO BUDGET
// ============================================================

function buildTraditionContextTokens(config) {
  // Returns { all, direct }:
  //   - `all`     — tokens from tradition name/lineage/family/parent/crossrefs/desc
  //                 PLUS room.descriptors only (genre_tags removed).
  //                 Used as a permissive trust filter on character descriptors.
  //   - `direct`  — tokens ONLY from the tradition itself (name/lineage/family/parent/
  //                 crossrefs/desc, plus stapled traditions). Used as a stricter
  //                 trust filter on iconic descriptors so that a genre-bound iconic
  //                 term (e.g. "four-on-floor" iconic for percussion_disco_four_on_floor)
  //                 doesn't leak into a tradition that only inherits dance/disco
  //                 signal via a misassigned room or archetype.
  //
  // NOTE — sibling token-harvester: `score.js:_buildContextUncached()` enumerates
  // the SAME prose sources (name/lineage/family/parent/crossRefs/description)
  // and additionally room.region/era/scale_tier + arch.region/era. The two
  // harvesters use different tokenizers — score.js decomposes camelCase paths
  // and weights by source, while this one applies a uniform splitter with a
  // length>2 filter. If you add a new prose source here, audit score.js's
  // _buildContextUncached for whether scoring should see it too.
  const all = new Set();
  const direct = new Set();
  const harvest = (s, sets) => {
    if (!s) return;
    for (const t of String(s).toLowerCase().split(/[\s\-_,.()/]+/)) {
      if (t && t.length > 2) for (const set of sets) set.add(t);
    }
  };
  const tradIds = config.traditions || [];
  for (const tid of tradIds) {
    const t = C.TRADITIONS.find(x => x.id === tid);
    if (!t) continue;
    // Tradition-direct tokens go into BOTH sets
    harvest(t.name,    [all, direct]);
    harvest(t.lineage, [all, direct]);
    harvest(t.family,  [all, direct]);
    const e = C.TRADITION_EXTRAS[tid] || {};
    harvest(e.parent,      [all, direct]);
    harvest(e.description, [all, direct]);
    for (const cr of (e.crossRefs || [])) {
      const ref = typeof cr === 'string' ? cr : (cr && cr.ref);
      if (ref) harvest(ref, [all, direct]);
    }
  }
  // Inherited tokens (room / archetype) go into `all` only — NOT `direct`.
  // Rooms and archetypes are physical/gear patterns, not genre classifiers;
  // genre signal comes from the tradition's own name/lineage/parent/crossrefs.
  const room = C.ROOMS.find(r => r.id === config.room);
  if (room) {
    for (const d of (room.descriptors || [])) harvest(d, [all]);
  }
  const arch = config.archetype && C.CHAIN_ARCHETYPES.find(a => a.id === config.archetype);
  // arch contributes no descriptor bag — its identity is fully captured by
  // the constituent chain components (mic, pre, medium, console, comp, eq).
  void arch;
  return { all, direct };
}

function translate(config, options = {}) {
  const ceiling = options.ceiling || 1000;
  const trustedTokens = buildTraditionContextTokens(config);
  const sentences = [];
  const s1 = buildSentence1(config); if (s1) sentences.push(s1);
  const s2 = buildSentence2_voice(config, trustedTokens); if (s2) sentences.push(s2);
  const s2b = buildSentenceArrangement(config); if (s2b) sentences.push(s2b);
  const s3 = buildSentence3_instruments(config, trustedTokens); if (s3) sentences.push(s3);
  const s4 = buildSentence4_room(config); if (s4) sentences.push(s4);
  const s5 = buildSentence5_chain(config); if (s5) sentences.push(s5);
  const s6 = buildSentence6_medium_fx(config); if (s6) sentences.push(s6);

  // Budget trim — graded, never over the ceiling.
  //
  // The old loop popped WHOLE sentences from the end, so going 45 chars over
  // budget cost the entire signal-chain sentence (and canonical afrobeat shipped
  // with no chain at all). These recipes are comma-lists ordered head-first by
  // identity value, so the cheapest honest cut is the LAST clause of the LAST
  // sentence: trailing fx before the chain head, trailing instruments before the
  // roster head. A sentence is popped only once it's down to a single clause.
  // If the sole surviving sentence still exceeds the ceiling, hard-cut at a word
  // boundary — the ceiling is a documented CONTRACT (api promise, --max-chars)
  // and is never exceeded, where the old guard silently returned sentence 1
  // however long it was.
  const lastClauseCut = (s) => {
    const body = s.endsWith('.') ? s.slice(0, -1) : s;
    const cut = Math.max(body.lastIndexOf(', '), body.lastIndexOf('; '));
    return cut > 0 ? body.slice(0, cut).replace(/[,;:\s]+$/, '') + '.' : null;
  };
  let output = sentences.join(' ');
  while (output.length > ceiling && sentences.length > 0) {
    const trimmed = lastClauseCut(sentences[sentences.length - 1]);
    if (trimmed !== null) {
      sentences[sentences.length - 1] = trimmed;
    } else if (sentences.length > 1) {
      sentences.pop(); // single-clause sentence and still over — drop it whole
    } else {
      // One single-clause sentence left and it alone exceeds the ceiling.
      let s = sentences[0].slice(0, Math.max(0, ceiling - 1));
      const sp = s.lastIndexOf(' ');
      if (sp > 0) s = s.slice(0, sp);
      output = s.replace(/[,;:\s]+$/, '') + '.';
      return output;
    }
    output = sentences.join(' ');
  }
  return output;
}

// === CLI ===
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else {
      const next = args[i + 1];
      if (next && !next.startsWith('--')) { flags[a.slice(2)] = next; i++; }
      else flags[a.slice(2)] = true;
    }
  }
}

if (require.main === module) {
  let config = null;
  if (flags.tradition) {
    const { search, seedFromTradition } = require('./search.js');
    const seed = seedFromTradition(flags.tradition);
    if (!seed) { console.error(`Unknown tradition: ${flags.tradition}`); process.exit(2); }
    config = search(seed).config;
  } else if (flags.config) {
    config = JSON.parse(require('fs').readFileSync(flags.config, 'utf8'));
  } else if (!process.stdin.isTTY) {
    let buf = '';
    process.stdin.on('data', c => buf += c);
    process.stdin.on('end', () => {
      config = JSON.parse(buf);
      const out = translate(config);
      console.log(out);
      console.error(`(${out.length} chars)`);
    });
    return;
  } else {
    console.error('Usage: translate.js --tradition <id>');
    console.error('   or: translate.js --config <path>');
    console.error('   or: cat config.json | translate.js');
    process.exit(2);
  }
  const out = translate(config);
  console.log(out);
  console.error(`(${out.length} chars)`);
}

module.exports = { translate };
