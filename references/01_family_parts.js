// ============================================================
// INSTRUMENT FAMILY PARTS — shared vocabulary inherited by every
// instrument in a family.
// ============================================================
//
// Every instrument in a family inherits the family's parts. Per-instrument
// `parts[]` declarations add bespoke parts on top, and an instrument-level part
// with the SAME id as a family part replaces the family version (override).
//
// The loader merges family parts into each instrument at load time. The engine
// sees the merged parts list and works as before — zero engine changes needed.
//
// Authoring discipline:
//   - Family parts carry the GENERIC vocabulary every instrument in the family
//     can reasonably express (technique, articulation, dynamics).
//   - Per-instrument parts carry SPECIFIC vocabulary unique to that instrument
//     (sax_size for saxophone, drawbar_setting for tonewheel_organ).
//   - When an instrument has a more specific technique vocabulary than the
//     family-default, override by declaring a same-id part on the instrument.
//
// Variant descriptors follow the same iconic-vs-character convention as the
// rest of the catalog: descriptors that share a token with the variant id are
// "iconic" (chicken-scratch in chicken_scratch); other descriptors are
// "character"; -suffixed tokens are scoring hints.

const INSTRUMENT_FAMILY_PARTS = {

  // ─────────────── ACOUSTIC STRINGS ───────────────
  // Acoustic guitars, mandolins, banjos, dulcimers, etc.
  acoustic_strings: [
    { id: 'acoustic_technique', name: 'Playing technique', variants: [
      { id: 'acoustic_fingerpicked', name: 'Fingerpicked', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor', 'classical_nylon_string_guitar', 'acoustic_resonator_steel', 'mountain_dulcimer', 'cittern'], descriptors: ['fingerpicked', 'narrative'], match_tokens: ['acoustic-only'], canonical_tags: ['singer-songwriter', 'folk', 'folk-revival', 'confessional', 'ballad-poetry'] },
      { id: 'acoustic_flatpicked', name: 'Flatpicked single-note', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'mandolin', 'mandola', 'cittern', 'acoustic_guitar_parlor', 'upright_bass'], descriptors: ['flatpicked', 'articulated'], match_tokens: ['acoustic-only'], canonical_tags: ['bluegrass', 'old-time'] },
      { id: 'acoustic_strummed_ringing', default: true, name: 'Open-chord strumming (ringing)', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor', 'classical_nylon_string_guitar', 'mandolin', 'mandola', 'autoharp', 'celtic_harp', 'cittern'], descriptors: ['strummed', 'open-chord-ringing-overtones'], match_tokens: ['acoustic-only', 'ringing'], canonical_tags: ['folk-revival', 'pop'] },
      { id: 'acoustic_bottleneck_slide', name: 'Bottleneck slide', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor', 'acoustic_resonator_steel'], descriptors: ['slide', 'open-tuned'], match_tokens: ['acoustic-only'], canonical_tags: ['delta', 'blues-canonical', 'country-blues'] },
      { id: 'acoustic_travis_picking', name: 'Travis picking', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor', 'classical_nylon_string_guitar'], descriptors: ['travis-picked', 'alternating-thumb'], match_tokens: ['acoustic-only', 'picked'], canonical_tags: ['country', 'folk'] },
      { id: 'acoustic_drone_modal', name: 'Drop-tuned drone', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'mandolin', 'mandola', 'mountain_dulcimer', 'cittern', 'autoharp'], descriptors: ['drone-like', 'modal'], match_tokens: ['acoustic-only', 'drone-foundation'], canonical_tags: ['celtic', 'britfolk'] },
      { id: 'acoustic_chord_melody', name: 'Chord-melody', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor', 'classical_nylon_string_guitar', 'mandolin', 'upright_bass'], descriptors: ['chord-melody'], match_tokens: ['acoustic-only', 'chordal', 'block-chord', 'lead-melody'], canonical_tags: ['jazz-canonical'] },
      { id: 'acoustic_clawhammer', name: 'Clawhammer / frailing', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'mountain_dulcimer'], descriptors: ['clawhammer', 'frailed'], match_tokens: ['acoustic-only'], canonical_tags: ['old-time', 'appalachian'] },
    ] },
    // String tuning — what the open strings are tuned to. Standard tuning
    // is silent in the output (its descriptors are empty) but carries broad
    // canonical_tags so the scorer prefers it for the dominant case across
    // folk/pop/rock/country/singer-songwriter etc. Open and modal tunings
    // surface as adjectives ("open-e-tuning slide acoustic guitar") and
    // claim narrower tags so they only win where they're actually
    // genre-canonical: open D/E/G for slide blues, DADGAD for britfolk,
    // drop-D for american-primitive.
    { id: 'string_tuning', name: 'String tuning', variants: [
      { id: 'standard_tuning',   default: true, name: 'Standard (EADGBE)', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor', 'classical_nylon_string_guitar', 'acoustic_resonator_steel'], descriptors: [],                                                  match_tokens: ['acoustic-only', 'standard-tuned'] },
      { id: 'drop_d',                            name: 'Drop D',           applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor', 'acoustic_resonator_steel'],                                descriptors: ['drop-d-tuning'],                                  match_tokens: ['acoustic-only', 'drone-foundation', 'modal', 'open-bass'],                  canonical_tags: ['american-primitive', 'fingerstyle-soloist', 'modern-rock'] },
      { id: 'open_d',                            name: 'Open D (DADF♯AD)', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor', 'acoustic_resonator_steel'],                                descriptors: ['open-d-tuning'],                                  match_tokens: ['acoustic-only', 'drone-foundation', 'modal', 'open-tuned'],canonical_tags: ['slide-blues', 'country-blues'] },
      { id: 'open_e',                            name: 'Open E (EBEG♯BE)', applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor', 'acoustic_resonator_steel'],                                descriptors: ['open-e-tuning'],                                  match_tokens: ['acoustic-only', 'drone-foundation', 'modal', 'open-tuned'],canonical_tags: ['slide-blues', 'country-blues', 'gospel-blues'] },
      { id: 'open_g',                            name: 'Open G (DGDGBD)',  applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor', 'acoustic_resonator_steel'],                                descriptors: ['open-g-tuning'],                                  match_tokens: ['acoustic-only', 'drone-foundation', 'modal', 'open-tuned'],canonical_tags: ['delta', 'slide-blues', 'piedmont-blues'] },
      { id: 'dadgad',                            name: 'DADGAD',           applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor'],                                                            descriptors: ['dadgad-tuning'],                                  match_tokens: ['acoustic-only', 'drone-foundation', 'modal', 'open-tuned'],                  canonical_tags: ['britfolk', 'celtic', 'irish-traditional', 'scottish'] },
      { id: 'eb_standard',                       name: 'E♭ standard',      applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor'],                                                            descriptors: ['half-step-down-tuning'],                          match_tokens: ['acoustic-only', 'lowered-tuning'],                                           canonical_tags: ['blues-rock', 'hard-rock'] },
      { id: 'd_standard',                        name: 'D standard',       applies_to: ['acoustic_guitar_dread', 'acoustic_guitar_om', 'acoustic_guitar_parlor'],                                                            descriptors: ['whole-step-down-tuning'],                         match_tokens: ['acoustic-only', 'lowered-tuning', 'detuned'],                                canonical_tags: ['stoner-rock', 'doom'] },
    ] },
  ],

  // ─────────────── ELECTRIC STRINGS ───────────────
  // Electric guitars, basses, lap-steel, pedal-steel.
  // Variants without `applies_to` are family-wide. Variants with `applies_to`
  // are filtered at merge time to only the listed instrument ids.
  electric_strings: [
    { id: 'electric_technique', name: 'Playing technique', variants: [
      { id: 'electric_clean_strummed', default: true, name: 'Clean strummed', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'twelve_string_electric', 'archtop_jazz', 'semi_hollow', 'baritone_electric'], descriptors: ['clean', 'strummed'], match_tokens: ['electric', 'open-chord-ringing-overtones', 'picked'], canonical_tags: ['pop', 'rhythm'] },
      { id: 'electric_chicken_scratch', name: 'Chicken-scratch (muted comp)', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker'], descriptors: ['chicken-scratch', 'midrange-forward', 'clean'], match_tokens: ['electric', 'picked'], canonical_tags: ['funk', 'afrobeat', 'soul'] },
      { id: 'electric_overdriven_lead', name: 'Overdriven single-note lead', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker'], descriptors: ['overdriven', 'singing'], match_tokens: ['electric', 'lead', 'lead-melody', 'picked'], canonical_tags: ['rock-canonical', 'blues-rock'] },
      { id: 'electric_palm_muted_chug', name: 'Palm-muted chug', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'baritone_electric'], descriptors: ['palm-muted', 'percussive'], match_tokens: ['electric', 'muted', 'chugging-rhythm', 'picked'], canonical_tags: ['metal', 'punk'] },
      { id: 'electric_power_chord', name: 'Power-chord rhythm', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker'], descriptors: ['power-chord', 'distorted'], match_tokens: ['electric', 'chordal', 'block-chord', 'picked'], canonical_tags: ['rock-canonical', 'metal'] },
      { id: 'electric_fuzz_riff', name: 'Fuzz-driven riff', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'electric_bass', 'semi_hollow_bass'], descriptors: ['fuzzed', 'riff-driven'], match_tokens: ['electric', 'fuzzy-saturation', 'picked'], canonical_tags: ['psychedelic', 'doom'] },
      { id: 'electric_jazz_comping', name: 'Jazz comping', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'archtop_jazz', 'semi_hollow'], descriptors: ['comped', 'clean'], match_tokens: ['electric', 'jazz-trained', 'comping'], canonical_tags: ['jazz-canonical'] },
      { id: 'electric_arpeggiated_clean', name: 'Arpeggiated clean', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'twelve_string_electric', 'archtop_jazz', 'semi_hollow', 'baritone_electric'], descriptors: ['arpeggiated', 'clean'], match_tokens: ['electric', 'arpeggio-decoration', 'picked'], canonical_tags: ['shoegaze', 'post-punk', 'indie'] },
      { id: 'electric_wah_funk', name: 'Wah-pedal funk', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker'], descriptors: ['wah-modulated'], match_tokens: ['electric', 'funky', 'picked'], canonical_tags: ['funk'] },
      { id: 'electric_tremolo_picking', name: 'Tremolo picking', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker'], descriptors: ['tremolo', 'sustained'], match_tokens: ['electric', 'rapid-tremolo', 'picked'], canonical_tags: ['surf', 'shoegaze'] },
      { id: 'electric_feedback_drone', name: 'Feedback drone', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker'], descriptors: ['feedback', 'sustained'], match_tokens: ['electric', 'drone-like', 'drone-foundation', 'picked'], canonical_tags: ['noise', 'shoegaze'] },
      { id: 'electric_slide_blues', name: 'Slide / bottleneck blues', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'pedal_steel'], descriptors: ['slide', 'bluesy'], match_tokens: ['electric', 'blues-derived', 'blues-inflected', 'picked'], canonical_tags: ['blues-canonical'] },
      { id: 'electric_country_chicken_pickin', name: 'Country chicken-pickin\'', applies_to: ['electric_guitar_single_coil'], descriptors: ['hybrid-picked', 'twangy'], match_tokens: ['electric', 'picked'], canonical_tags: ['country', 'telecaster'] },
      { id: 'electric_fingerstyle_country', name: 'Fingerstyle country/folk', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker'], descriptors: ['fingerpicked', 'narrative'], match_tokens: ['electric', 'picked'], canonical_tags: ['country'] },
      { id: 'electric_bass_walking', name: 'Walking bass line', applies_to: ['electric_bass', 'semi_hollow_bass', 'fretless_bass', 'short_scale_bass'], descriptors: ['walking'], match_tokens: ['electric', 'picked'], canonical_tags: ['jazz-canonical'] },
      { id: 'electric_bass_pocket', name: 'Pocket fingerstyle locked', applies_to: ['electric_bass', 'semi_hollow_bass', 'fretless_bass'], descriptors: ['pocket', 'fingerstyle', 'locked'], match_tokens: ['electric', 'rhythm-section-pocket', 'picked'], canonical_tags: ['soul', 'funk', 'afrobeat'] },
      { id: 'electric_bass_pick_aggressive', name: 'Pick aggressive', applies_to: ['electric_bass', 'semi_hollow_bass', 'short_scale_bass'], descriptors: ['picked', 'high-gain-saturation'], match_tokens: ['electric'], canonical_tags: ['rock-canonical', 'punk'] },
      { id: 'electric_bass_slap_pop', name: 'Slap-and-pop', applies_to: ['electric_bass', 'semi_hollow_bass', 'fretless_bass'], descriptors: ['slapped', 'popped', 'percussive'], match_tokens: ['electric', 'slappy', 'percussive-attack'], canonical_tags: ['funk'] },
      { id: 'electric_bass_thumb_muted', name: 'Thumb-muted dub', applies_to: ['electric_bass', 'semi_hollow_bass'], descriptors: ['thumb-muted'], match_tokens: ['electric', 'muted', 'picked'], canonical_tags: ['reggae', 'dub'] },
      { id: 'electric_steel_pedal_swells', name: 'Pedal-steel volume swells', applies_to: ['pedal_steel'], descriptors: ['volume-swells', 'crying', 'steel'], match_tokens: ['electric', 'picked'], canonical_tags: ['country', 'pedal-steel'] },
    ] },
    // Amp make / archetype — which amplifier the electric instrument runs through.
    // Default is silent (amp_unspecified produces no descriptors) so the recipe
    // doesn't surface noise when the amp isn't a defining character. Named amp
    // archetypes carry tradition canonicals — Selmer/Vox AC for British 60s,
    // Fender tweed/blackface for American 50s-60s, Marshall for British rock,
    // Ampeg B-15/SVT for bass-amp character, modeling for modern.
    { id: 'amp_make', name: 'Amplifier archetype', variants: [
      { id: 'amp_unspecified',           default: true, name: 'Unspecified',                                applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'archtop_jazz', 'twelve_string_electric', 'baritone_electric', 'electric_bass', 'semi_hollow_bass', 'short_scale_bass', 'fretless_bass', 'pedal_steel'], descriptors: [],                                                                  match_tokens: ['electric'] },
      { id: 'amp_british_60s_selmer',                   name: 'Selmer (Twin Selectortone, Truvoice — British 60s)', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'archtop_jazz', 'twelve_string_electric', 'electric_bass', 'semi_hollow_bass', 'short_scale_bass'], descriptors: ['selmer-amp', 'british-60s-amp', 'midrange-honk', 'push-button-tone-select'], match_tokens: ['electric', 'midrange-forward', 'tube-amplification'], canonical_tags: ['british-invasion', 'british-invasion', 'british-beat-boom-canonical'] },
      { id: 'amp_british_60s_vox_ac',                   name: 'Vox AC15 / AC30 / Top Boost (British 60s chime)',   applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'archtop_jazz', 'twelve_string_electric'],                                                  descriptors: ['vox-ac-amp', 'british-60s-amp', 'top-boost-chime', 'blue-alnico-speaker'], match_tokens: ['electric', 'chimey', 'top-end-extension', 'tube-amplification'], canonical_tags: ['british-invasion', 'british-invasion', 'british-beat-boom-canonical', 'jangle-pop'] },
      { id: 'amp_british_late_60s_marshall_plexi',      name: 'Marshall Plexi / JTM (British late-60s rock)',      applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'electric_bass', 'semi_hollow_bass', 'short_scale_bass'],                                                       descriptors: ['marshall-plexi-amp', 'british-rock-amp', 'crunch-breakup', 'cranked-tube'], match_tokens: ['electric', 'overdriven', 'tube-amplification'], canonical_tags: ['british-blues-rock', 'arena-rock'] },
      { id: 'amp_american_fender_tweed',                name: 'Fender Tweed (Bassman / Deluxe — American 50s)',     applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'archtop_jazz', 'electric_bass', 'semi_hollow_bass', 'short_scale_bass'],                                       descriptors: ['fender-tweed-amp', 'american-50s-amp', 'tweed-breakup', 'thick-midrange'], match_tokens: ['electric', 'tube-amplification'], canonical_tags: ['blues-canonical', 'rockabilly', 'country', 'early-rock-and-roll'] },
      { id: 'amp_american_fender_blackface',            name: 'Fender Blackface (Twin / Deluxe Reverb — American 60s)', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'archtop_jazz', 'twelve_string_electric', 'pedal_steel'],                              descriptors: ['fender-blackface-amp', 'american-60s-amp', 'spring-reverb-bright', 'scooped-clean'], match_tokens: ['electric', 'clean-with-reverb', 'tube-amplification'], canonical_tags: ['surf', 'country', 'soul', 'funk', 'rhythm-and-blues'] },
      { id: 'amp_american_ampeg_b15',                   name: 'Ampeg B-15 flip-top (American 60s bass)',           applies_to: ['electric_bass', 'semi_hollow_bass', 'short_scale_bass', 'fretless_bass'],                                                                                                                  descriptors: ['ampeg-b15-amp', 'american-60s-bass-amp', 'flip-top-character', 'rounded-low-end'], match_tokens: ['electric', 'low-register', 'tube-amplification'], canonical_tags: ['soul', 'rhythm-and-blues', 'motown', 'jazz-canonical'] },
      { id: 'amp_american_ampeg_svt',                   name: 'Ampeg SVT (American post-69 bass rock)',            applies_to: ['electric_bass', 'semi_hollow_bass', 'fretless_bass'],                                                                                                                                       descriptors: ['ampeg-svt-amp', 'rock-bass-amp', '300-watt-stack', 'high-headroom'], match_tokens: ['electric', 'low-register', 'tube-amplification'], canonical_tags: ['arena-rock'] },
      { id: 'amp_modern_modeling',                      name: 'Modeling amplifier (Kemper / Fractal / Katana)',     applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'archtop_jazz', 'twelve_string_electric', 'baritone_electric', 'electric_bass', 'semi_hollow_bass', 'short_scale_bass', 'fretless_bass'], descriptors: ['modeled-amp', 'digital-amplification', 'profile-based', 'modern-rig'],     match_tokens: ['electric'] , canonical_tags: ['djent', 'modern-metal'] },
      { id: 'amp_british_marshall_jcm800',              name: 'Marshall JCM800 master-volume (British 80s metal/punk stack)', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'baritone_electric'],                                                                                          descriptors: ['marshall-jcm800-amp', 'british-80s-rock-amp', 'master-volume-overdrive', 'el34-stack-saturation'], match_tokens: ['electric', 'high-gain', 'overdriven', 'tube-amplification'], canonical_tags: ['thrash-metal', 'hair-metal', 'punk', 'hardcore-punk'] },
      { id: 'amp_british_hiwatt',                       name: 'Hiwatt DR103 (British clean-headroom 100W)',                   applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'electric_bass'],                                                                                                                            descriptors: ['hiwatt-amp', 'british-clean-amp', 'high-wattage-headroom', 'partridge-iron-transformers'],         match_tokens: ['electric', 'clean-headroom', 'tube-amplification'],         canonical_tags: ['progressive-rock', 'arena-rock', 'hard-rock'] },
      { id: 'amp_british_orange',                       name: 'Orange OR120 / Rockerverb (British heavy crunch)',             applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'baritone_electric', 'electric_bass'],                                                                                                       descriptors: ['orange-amp', 'british-heavy-crunch', 'thick-mid-low', 'sludgy-character'],                         match_tokens: ['electric', 'overdriven', 'tube-amplification'],             canonical_tags: ['stoner-metal', 'sludge', 'doom', 'noise-rock'] },
      { id: 'amp_roland_jc120',                         name: 'Roland JC-120 Jazz Chorus (Japanese solid-state stereo, 1975)', applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'archtop_jazz', 'twelve_string_electric'],                                                                                                  descriptors: ['roland-jc120-amp', 'solid-state-stereo-chorus', 'pristine-clean', 'transistor-clean'],              match_tokens: ['electric', 'clean-chorused', 'solid-state-amplification'],  canonical_tags: ['post-punk', 'dream-pop', 'jazz-fusion', 'new-wave'] },
      { id: 'amp_mesa_dual_rectifier',                  name: 'Mesa/Boogie Dual Rectifier (modern California high-gain)',      applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'baritone_electric'],                                                                                                                       descriptors: ['mesa-dual-rectifier-amp', 'california-modern-saturation', 'scooped-mid-modern-metal', 'multi-mode-rectifier'], match_tokens: ['electric', 'high-gain', 'overdriven', 'tube-amplification'], canonical_tags: ['nu-metal', 'modern-metal', 'djent'] },
      { id: 'amp_soldano_slo100',                       name: 'Soldano SLO-100 (boutique high-gain, 1987)',                   applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker'],                                                                                                                                                              descriptors: ['soldano-slo-amp', 'boutique-high-gain', 'cascading-preamp-saturation', 'modified-marshall-derived'], match_tokens: ['electric', 'high-gain', 'overdriven', 'tube-amplification'], canonical_tags: ['hair-metal', 'modern-rock', 'modern-metal'] },
      { id: 'amp_american_fender_champ',                name: 'Fender Champ / Princeton (low-watt American tweed/blackface)',  applies_to: ['electric_guitar_single_coil', 'electric_guitar_humbucker', 'semi_hollow', 'archtop_jazz'],                                                                                                                            descriptors: ['fender-champ-amp', 'low-wattage-studio-grit', 'easily-cranked', 'natural-power-tube-breakup'],      match_tokens: ['electric', 'overdriven', 'tube-amplification'],             canonical_tags: ['blues-canonical', 'studio-grit', 'rockabilly'] },
    ] },
  ],

  // ─────────────── WIND ───────────────
  // Saxophones, trumpets, trombones, flutes, clarinets, oboes, recorders, etc.
  // Plus shofars, didgeridoos, and other ethnic winds.
  // Variants without `applies_to` are family-wide.
  wind: [
    { id: 'wind_articulation', name: 'Articulation / phrasing', variants: [
      { id: 'wind_continuous_legato', default: true, name: 'Continuous legato', applies_to: ['saxophone', 'trumpet', 'trombone', 'cornet', 'clarinet', 'flute', 'alto_flute', 'bass_flute', 'piccolo', 'oboe', 'english_horn', 'bassoon', 'contrabassoon', 'french_horn', 'tuba', 'euphonium', 'flugelhorn', 'recorder', 'duduk', 'mey', 'bansuri', 'dizi', 'shakuhachi', 'ney', 'kaval', 'quena', 'xiao', 'suling', 'hichiriki_double_reed', 'gaita_colombiana'], descriptors: ['continuous-airflow', 'legato'], match_tokens: ['wind-driven', 'continuous-phonation', 'sustained-tone', 'articulated'], canonical_tags: ['jazz-canonical', 'classical'] },
      { id: 'wind_honking_attack', name: 'Honking attack', applies_to: ['saxophone', 'trumpet', 'trombone'], descriptors: ['honking', 'attack'], match_tokens: ['wind-driven', 'honking-attack', 'articulated'], canonical_tags: ['r&b', 'afrobeat', 'soul'] },
      { id: 'wind_punchy_ensemble', name: 'Punchy ensemble', applies_to: ['saxophone', 'trumpet', 'trombone'], descriptors: ['fast-attack-transient', 'ensemble', 'horn-section'], match_tokens: ['wind-driven', 'punchy', 'articulated'], canonical_tags: ['r&b', 'afrobeat', 'soul'] },
      { id: 'wind_bebop_runs', name: 'Bebop fast runs', applies_to: ['saxophone', 'trumpet', 'trombone', 'clarinet', 'flute', 'cornet'], descriptors: ['angular'], match_tokens: ['wind-driven', 'bebop-derived', 'jazz-trained', 'bebop-runs', 'gospel-runs'], canonical_tags: ['bebop'] },
      { id: 'wind_cool_lyrical', name: 'Cool lyrical', applies_to: ['saxophone', 'trumpet', 'flute', 'cornet', 'flugelhorn'], descriptors: ['cool', 'lyrical'], match_tokens: ['wind-driven', 'cool-lyrical', 'articulated'], canonical_tags: ['cool-jazz'] },
      { id: 'wind_multiphonic_avant', name: 'Multiphonic / avant-garde', applies_to: ['saxophone', 'trumpet', 'trombone', 'clarinet', 'flute', 'oboe'], descriptors: ['multiphonic'], match_tokens: ['wind-driven', 'avant-garde', 'articulated'], canonical_tags: ['avant', 'noise', 'free-jazz'] },
      { id: 'wind_split_tone_overblown', name: 'Split-tone / overblown', applies_to: ['saxophone', 'trumpet', 'trombone', 'clarinet'], descriptors: ['split-tone', 'overblown'], match_tokens: ['wind-driven', 'articulated'], canonical_tags: ['free-jazz'] },
      { id: 'wind_breath_quiet', name: 'Breath-tone, low dynamic', applies_to: ['saxophone', 'trumpet', 'flute', 'clarinet', 'cornet', 'flugelhorn', 'shakuhachi', 'ney'], descriptors: ['breath-tone-airy', 'low-dynamic-level'], match_tokens: ['wind-driven', 'breathy', 'breathing', 'quiet'], canonical_tags: ['lounge', 'cool-jazz'] },
      { id: 'wind_classical_legato', name: 'Classical legato', applies_to: ['oboe', 'english_horn', 'bassoon', 'contrabassoon', 'french_horn', 'trumpet', 'trombone', 'tuba', 'euphonium', 'flute', 'alto_flute', 'bass_flute', 'piccolo', 'clarinet'], descriptors: ['legato', 'controlled'], match_tokens: ['wind-driven', 'classical', 'classical-trained', 'sustained-tone'], canonical_tags: ['classical'] },
      { id: 'wind_dixieland_lead', name: 'Dixieland front-line', applies_to: ['trumpet', 'trombone', 'clarinet', 'cornet'], descriptors: ['front-line'], match_tokens: ['wind-driven', 'lead', 'lead-melody', 'articulated'], canonical_tags: ['dixieland', 'new-orleans'] },
      { id: 'wind_mariachi_unison', name: 'Mariachi unison', applies_to: ['trumpet'], descriptors: ['unison'], match_tokens: ['wind-driven', 'unison-doubled', 'articulated'], canonical_tags: ['mariachi'] },
      { id: 'wind_ska_skank_stab', name: 'Ska skank stab', applies_to: ['trumpet', 'trombone', 'saxophone'], descriptors: ['short'], match_tokens: ['wind-driven', 'articulated'], canonical_tags: ['ska', 'rocksteady'] },
      { id: 'wind_folk_melodic', name: 'Folk melodic', applies_to: ['tin_whistle', 'tin_whistle_low', 'recorder', 'ocarina', 'quena', 'kaval', 'gaida_bulgarian', 'gaita_galega', 'bombarde', 'biniou', 'uilleann_pipes', 'highland_bagpipes', 'launeddas', 'zampogna', 'suling', 'bansuri', 'dizi', 'xiao'], descriptors: ['melodic'], match_tokens: ['wind-driven', 'folk', 'folk-tradition', 'articulated'], canonical_tags: ['folk', 'celtic'] },
      { id: 'wind_ornament_heavy', name: 'Ornament-heavy', applies_to: ['tin_whistle', 'tin_whistle_low', 'uilleann_pipes', 'biniou', 'highland_bagpipes', 'bombarde', 'recorder', 'gaida_bulgarian', 'gaita_galega', 'shawm', 'zurna', 'mizmar', 'ghaita', 'ciaramella', 'duduk', 'mey'], descriptors: ['ornamented'], match_tokens: ['wind-driven', 'heavy', 'low-end-heavy', 'articulated'], canonical_tags: ['celtic', 'irish-trad', 'baroque-leaning'] },
      { id: 'wind_circular_breathing_drone', name: 'Circular-breathing drone', applies_to: ['didgeridoo', 'didgeridoo', 'duduk', 'mey', 'launeddas'], descriptors: ['drone-like', 'circular-breathing'], match_tokens: ['wind-driven', 'drone-foundation', 'articulated'], canonical_tags: ['didgeridoo'] },
      { id: 'wind_call_blowing', default: true, name: 'Call-blowing (signal/ritual)', applies_to: ['shofar', 'kakaki', 'conch_shell_horn'], descriptors: ['call', 'ritual'], match_tokens: ['wind-driven', 'call-response', 'articulated'], canonical_tags: ['ceremonial', 'liturgical'] },
    ] },
  ],

  // ─────────────── PERCUSSION ───────────────
  // Drum kit, congas, djembe, tabla, frame drums, talking drum, hand percussion,
  // mallet percussion, drum machines (electronic-percussion subset).
  percussion: [
    { id: 'percussion_technique', name: 'Playing technique', variants: [
      { id: 'percussion_sticks_rock', default: true, name: 'Sticks rock backbeat', applies_to: ['drum_kit'], descriptors: ['sticks', 'backbeat'], match_tokens: ['rock-context', 'percussive-attack'], canonical_tags: ['rock-canonical'] },
      { id: 'percussion_sticks_punk', name: 'Sticks punk drive', applies_to: ['drum_kit'], descriptors: ['sticks', 'driving'], match_tokens: ['percussive-attack'], canonical_tags: ['punk'] },
      { id: 'percussion_brushes_jazz', name: 'Brushes jazz comping', applies_to: ['drum_kit'], descriptors: ['brushes', 'whispered'], match_tokens: ['brushed', 'jazz-trained', 'percussive-attack'], canonical_tags: ['jazz-canonical'] },
      { id: 'percussion_brushes_and_sticks', name: 'Brushes-and-sticks alternating', applies_to: ['drum_kit'], descriptors: ['brushes-and-sticks', 'jazz-trained', 'ride-driven'], match_tokens: ['brushed', 'sticks', 'percussive-attack'], canonical_tags: ['afrobeat', 'fusion'] },
      { id: 'percussion_sticks_motown', name: 'Sticks pocket Motown', applies_to: ['drum_kit'], descriptors: ['sticks', 'pocket'], match_tokens: ['percussive-attack'], canonical_tags: ['motown', 'soul'] },
      { id: 'percussion_disco_four_on_floor', name: 'Four-on-floor disco', applies_to: ['drum_kit'], descriptors: ['four-on-floor'], match_tokens: ['percussive-attack'], canonical_tags: ['disco', 'house'] },
      { id: 'percussion_hands_layered', default: true, name: 'Hand percussion layered', applies_to: ['congas', 'djembe', 'bongos', 'pandeiro', 'tar_frame_drum', 'timbales', 'darbuka', 'cuica'], descriptors: ['hands', 'layered'], match_tokens: ['percussive-attack'], canonical_tags: ['afro', 'latin'] },
      { id: 'percussion_mallets_orchestral', default: true, name: 'Mallets orchestral', applies_to: ['marimba_orchestral', 'vibraphone', 'xylophone', 'glockenspiel', 'timpani'], descriptors: ['mallets'], match_tokens: ['orchestral', 'percussive-attack'], canonical_tags: ['orchestral'] },
      { id: 'percussion_rim_clicks_dub', name: 'Rim-click reggae/dub', applies_to: ['drum_kit'], descriptors: ['rim-clicks'], match_tokens: ['percussive-attack'], canonical_tags: ['reggae', 'dub'] },
      { id: 'percussion_gated_isolation', name: 'Gated isolation', applies_to: ['drum_kit'], descriptors: ['gated', 'isolated'], match_tokens: ['percussive-attack'], canonical_tags: ['post-punk'] },
      { id: 'percussion_breakbeat_chopped', name: 'Breakbeat chopped', applies_to: ['drum_kit'], descriptors: ['chopped', 'sampled'], match_tokens: ['percussive-attack'], canonical_tags: ['hip-hop', 'jungle'] },
      { id: 'percussion_open_slap', name: 'Open / slap (hand-drum)', applies_to: ['congas', 'djembe', 'bongos', 'darbuka', 'timbales'], descriptors: ['open-slap', 'hand-drum'], match_tokens: ['open-chord-ringing-overtones', 'open-tuned', 'slappy', 'percussive-attack'], canonical_tags: ['afro', 'latin'] },
    ] },
  ],

  // ─────────────── BOWED ───────────────
  // Violin, viola, cello, contrabass, plus erhu, gadulka, kamancheh, etc.
  bowed: [
    { id: 'bowed_technique', name: 'Bow technique', variants: [
      { id: 'bowed_legato_classical', default: true, name: 'Classical legato', descriptors: ['legato', 'sustained'], match_tokens: ['bowed', 'sustained-tone', 'classical', 'classical-trained'], canonical_tags: ['classical'] },
      { id: 'bowed_pizzicato', name: 'Pizzicato (plucked)', applies_to: ['violin_orchestral', 'viola_classical', 'cello', 'double_bass'], descriptors: ['plucked', 'pizzicato'], match_tokens: ['bowed', 'sustained-tone'], canonical_tags: ['classical', 'orchestral'] },
      { id: 'bowed_spiccato_articulated', name: 'Spiccato (bouncing)', applies_to: ['violin_orchestral', 'viola_classical', 'cello', 'double_bass'], descriptors: ['spiccato', 'articulated'], match_tokens: ['bowed', 'sustained-tone', 'staccato'], canonical_tags: ['classical'] },
      { id: 'bowed_sul_ponticello', name: 'Sul ponticello (near bridge)', applies_to: ['violin_orchestral', 'viola_classical', 'cello', 'double_bass'], descriptors: ['glassy', 'metallic'], match_tokens: ['bowed', 'sustained-tone'], canonical_tags: ['avant'] },
      { id: 'bowed_sul_tasto', name: 'Sul tasto (over fingerboard)', applies_to: ['violin_orchestral', 'viola_classical', 'cello', 'double_bass'], descriptors: ['airy', 'distant'], match_tokens: ['bowed', 'sustained-tone'], canonical_tags: ['classical'] },
      { id: 'bowed_chopped_old_time', name: 'Chopped / old-time', applies_to: ['fiddle', 'violin_orchestral'], descriptors: ['chopped', 'rhythmic'], match_tokens: ['bowed', 'sustained-tone'], canonical_tags: ['old-time', 'bluegrass'] },
      { id: 'bowed_bluegrass_double_stops', name: 'Bluegrass / fiddle-tradition double-stops', applies_to: ['fiddle', 'violin_orchestral'], descriptors: ['double-stops'], match_tokens: ['bowed', 'sustained-tone', 'doubled'], canonical_tags: ['bluegrass', 'fiddle', 'old-time', 'country', 'western-swing'] },
      { id: 'bowed_klezmer_ornamented', name: 'Klezmer ornament-heavy', applies_to: ['fiddle', 'violin_orchestral', 'viola_classical', 'violin_carnatic'], descriptors: ['ornamented'], match_tokens: ['bowed', 'sustained-tone', 'ornament-heavy'], canonical_tags: ['klezmer', 'eastern-european'] },
      { id: 'bowed_celtic_session', name: 'Celtic session-fiddle', applies_to: ['fiddle', 'violin_orchestral'], descriptors: ['ornamented'], match_tokens: ['bowed', 'sustained-tone'], canonical_tags: ['celtic', 'irish-trad'] },
      { id: 'bowed_rough_drone', name: 'Rough drone', applies_to: ['fiddle', 'gusle', 'kamancheh', 'rebab', 'morin_khuur'], descriptors: ['drone-like', 'raspy'], match_tokens: ['bowed', 'sustained-tone', 'rough-tone', 'drone-foundation'], canonical_tags: ['folk', 'medieval'] },
      { id: 'bowed_microtonal_inflected', name: 'Microtonal-inflected', applies_to: ['kamancheh', 'rebab', 'sarangi', 'esraj', 'violin_carnatic', 'morin_khuur', 'erhu', 'jinghu', 'haegeum'], descriptors: ['microtonal'], match_tokens: ['bowed', 'sustained-tone', 'microtonal-bend', 'shruti-inflected'], canonical_tags: ['maqam', 'arabic', 'hindustani'] },
    ] },
  ],

  // ─────────────── KEYBOARD ───────────────
  // Piano (grand, upright), electric piano, harpsichord, clavinet, mellotron,
  // tonewheel organ, combo organ, accordion-keyboard, organ-pedalboard, etc.
  keyboard: [
    { id: 'keyboard_technique', name: 'Playing approach', variants: [
      { id: 'keyboard_classical_legato', name: 'Classical legato', applies_to: ['grand_piano', 'upright_piano', 'harpsichord', 'pipe_organ', 'pump_organ_harmonium', 'celesta'], descriptors: ['legato', 'pedal-resonant'], match_tokens: ['classical', 'classical-trained', 'sustained-tone', 'keyboard-driven'], canonical_tags: ['classical'] },
      { id: 'keyboard_jazz_comping', name: 'Jazz comping', applies_to: ['grand_piano', 'upright_piano', 'rhodes_electric', 'wurlitzer_ep', 'electric_piano_tine'], descriptors: ['comped', 'voice-leading'], match_tokens: ['jazz-trained', 'comping', 'keyboard-driven'], canonical_tags: ['jazz-canonical'] },
      { id: 'keyboard_stride_left_hand', name: 'Stride / boogie left-hand', applies_to: ['grand_piano', 'upright_piano', 'tack_piano'], descriptors: ['stride'], match_tokens: ['keyboard-driven'], canonical_tags: ['boogie', 'pre-war-jazz'] },
      { id: 'keyboard_gospel_chord_runs', name: 'Gospel chord-runs', applies_to: ['grand_piano', 'upright_piano', 'rhodes_electric', 'wurlitzer_ep', 'tonewheel_organ', 'electric_piano_tine'], descriptors: ['gospel-runs'], match_tokens: ['gospel-rooted', 'chordal', 'block-chord', 'bebop-runs'], canonical_tags: ['gospel', 'soul'] },
      { id: 'keyboard_honky_tonk', name: 'Honky-tonk', applies_to: ['tack_piano', 'upright_piano'], descriptors: ['barrelhouse'], match_tokens: ['keyboard-driven'], canonical_tags: ['honky-tonk', 'country'] },
      { id: 'keyboard_minimalist_repeated', name: 'Minimalist / repeated cells', applies_to: ['grand_piano', 'upright_piano', 'electric_piano_tine', 'celesta', 'rhodes_electric'], descriptors: ['repeated', 'cellular'], match_tokens: ['keyboard-driven'], canonical_tags: ['minimalist'] },
      { id: 'keyboard_block_chord_pop', default: true, name: 'Block-chord pop', descriptors: ['block-chord'], match_tokens: ['chordal', 'keyboard-driven'], canonical_tags: ['pop', 'singer-songwriter'] },
      { id: 'keyboard_ostinato_groove', name: 'Ostinato groove', applies_to: ['rhodes_electric', 'wurlitzer_ep', 'electric_piano_tine', 'clavinet', 'tonewheel_organ'], descriptors: ['ostinato', 'pocket'], match_tokens: ['keyboard-driven'], canonical_tags: ['soul', 'funk'] },
      { id: 'keyboard_arpeggio_sustain_rich', name: 'Arpeggiated sustain-rich', applies_to: ['grand_piano', 'rhodes_electric', 'mellotron', 'electric_piano_tine', 'tape_replay_keyboard', 'pipe_organ'], descriptors: ['arpeggiated', 'sustain-rich-overtones'], match_tokens: ['arpeggio-decoration', 'sustained', 'keyboard-driven'], canonical_tags: ['pop', 'shoegaze'] },
      { id: 'keyboard_avant_prepared', name: 'Avant / prepared', applies_to: ['grand_piano', 'upright_piano', 'harpsichord'], descriptors: ['prepared'], match_tokens: ['avant-garde', 'keyboard-driven'], canonical_tags: ['avant', 'experimental'] },
    ] },
  ],

  // ─────────────── FREE REED ───────────────
  // Harmonica, accordions (piano/diatonic/chromatic/bandoneón), concertinas,
  // sheng, bawu, melodica.
  free_reed: [
    { id: 'free_reed_technique', name: 'Playing technique', variants: [
      { id: 'free_reed_blues_cross', name: 'Blues cross-position (bent)', applies_to: ['harmonica'], descriptors: ['bent', 'cross-harp', 'wailing'], match_tokens: ['bellows-driven', 'reed-driven', 'blues-derived', 'blues-inflected'], canonical_tags: ['blues-canonical', 'delta'] },
      { id: 'free_reed_folk_first_position', default: true, name: 'Folk first-position straight', descriptors: ['straight', 'melodic'], match_tokens: ['bellows-driven', 'reed-driven', 'folk', 'folk-tradition'], canonical_tags: ['folk', 'singer-songwriter', 'country'] },
      { id: 'free_reed_chordal_chugging', name: 'Chordal chugging / vamp', applies_to: ['melodeon_diatonic', 'accordion', 'piano_accordion'], descriptors: ['chordal', 'rhythm'], match_tokens: ['bellows-driven', 'reed-driven'], canonical_tags: ['old-time', 'cajun', 'tejano'] },
      { id: 'free_reed_bellows_articulated', name: 'Bellows-articulated phrasing', applies_to: ['bandoneon', 'accordion', 'piano_accordion', 'concertina_anglo', 'concertina_english'], descriptors: ['bellows-articulated', 'phrased'], match_tokens: ['bellows-driven', 'reed-driven', 'articulated'], canonical_tags: ['tango', 'klezmer'] },
      { id: 'free_reed_chromatic_jazz', name: 'Chromatic jazz lead', applies_to: ['accordion', 'piano_accordion', 'harmonica'], descriptors: ['chromatic', 'lead'], match_tokens: ['bellows-driven', 'reed-driven', 'jazz-trained'], canonical_tags: ['jazz-canonical'] },
      { id: 'free_reed_overblow_modern', name: 'Overblow modern bending', descriptors: ['overblown', 'fully-chromatic'], match_tokens: ['bellows-driven', 'reed-driven', 'modern'] },
      { id: 'free_reed_drone_under', name: 'Drone-under-melody', applies_to: ['concertina_anglo', 'concertina_english', 'melodeon_diatonic', 'accordion'], descriptors: ['drone-like'], match_tokens: ['bellows-driven', 'reed-driven', 'drone-foundation'], canonical_tags: ['celtic', 'cajun'] },
      { id: 'free_reed_orchestral_ensemble', name: 'Orchestral / ensemble', applies_to: ['accordion', 'piano_accordion'], descriptors: ['ensemble'], match_tokens: ['bellows-driven', 'reed-driven', 'orchestral'], canonical_tags: ['classical'] },
    ] },
  ],

  // ─────────────── PLUCKED TRADITIONAL ───────────────
  // Sitars, ouds, bouzoukis, balalaikas, bağlamas, kotos, shamisens, charangos,
  // cuatros, tres, tiples, etc. — plucked-string folk and classical instruments.
  plucked_traditional: [
    { id: 'plucked_traditional_technique', name: 'Playing technique', variants: [
      { id: 'plucked_classical_idiom', name: 'Classical / art-music idiom', applies_to: ['lute_renaissance', 'theorbo', 'oud', 'qanun', 'kanun', 'tar_persian', 'setar_persian', 'tanbur_persian', 'santur', 'santoor', 'saz_baglama', 'sitar', 'sarod', 'veena', 'rudra_veena', 'tanpura', 'koto', 'biwa_lute', 'pipa', 'guqin', 'gayageum', 'geomungo', 'sanxian', 'ruan', 'dan_tranh', 'guzheng', 'yueqin', 'shamisen'], descriptors: ['ornamented', 'sustained'], match_tokens: ['plucked', 'string-attack', 'classical', 'classical-trained'], canonical_tags: ['classical'] },
      { id: 'plucked_folk_strummed', name: 'Folk strummed', applies_to: ['balalaika', 'domra', 'bouzouki', 'baglamas', 'charango', 'ronroco', 'tiple', 'bandola_andina', 'cuatro_pr', 'cuatro_venezolano', 'tres_cubano', 'cavaquinho', 'viola_caipira', 'jarana_jarocha', 'requinto_jarocho', 'vihuela_mexicana', 'bajo_sexto', 'banjo_5_string', 'tambura_balkan', 'saz_baglama', 'cumbus'], descriptors: ['strummed', 'rhythmic', 'dance-rhythm'], match_tokens: ['plucked', 'string-attack', 'folk', 'folk-tradition', 'open-chord-ringing-overtones'], canonical_tags: ['folk'] },
      { id: 'plucked_fingerpicked', name: 'Fingerpicked', applies_to: ['kora', 'ngoni', 'kamele_ngoni', 'donso_ngoni', 'xalam', 'akonting', 'kantele', 'gusli', 'dotara', 'ektara', 'khamak', 'tumbi', 'sintir', 'banjo_5_string', 'cavaquinho'], descriptors: ['fingerpicked', 'lyrical'], match_tokens: ['plucked', 'string-attack', 'traditional'], canonical_tags: ['folk'] },
      { id: 'plucked_drone_modal', name: 'Drone-modal', applies_to: ['sitar', 'sarod', 'tanpura', 'rudra_veena', 'veena', 'dotara', 'tumbi', 'oud', 'qanun', 'kanun', 'santur', 'santoor', 'tar_persian', 'tanbur_persian', 'setar_persian', 'saz_baglama', 'cumbus', 'baglamas', 'bouzouki'], descriptors: ['drone-like', 'modal'], match_tokens: ['plucked', 'string-attack', 'drone-foundation', 'traditional'], canonical_tags: ['raga', 'maqam'] },
      { id: 'plucked_ornamented_melodic', default: true, name: 'Ornamented melodic', applies_to: ['sitar', 'sarod', 'tanpura', 'tar_persian', 'tanbur_persian', 'setar_persian', 'saz_baglama', 'cumbus', 'baglamas', 'bouzouki', 'oud', 'qanun', 'kanun', 'santur', 'santoor', 'rudra_veena', 'veena', 'dotara', 'tumbi', 'ektara', 'khamak', 'tambura_balkan'], descriptors: ['ornamented', 'microtonal'], match_tokens: ['plucked', 'string-attack', 'ornament-heavy', 'melodic'], canonical_tags: ['middle-eastern', 'south-asian', 'central-asian'] },
      { id: 'plucked_tremolo', name: 'Tremolo (mandolin-style)', applies_to: ['baglamas', 'bouzouki', 'cuatro_pr', 'cuatro_venezolano', 'tres_cubano', 'cavaquinho', 'tiple', 'jarana_jarocha', 'requinto_jarocho', 'leona', 'vihuela_mexicana', 'domra'], descriptors: ['tremolo', 'sustained'], match_tokens: ['plucked', 'string-attack', 'rapid-tremolo', 'traditional'], canonical_tags: ['mandolin', 'mediterranean'] },
      { id: 'plucked_dance_pattern', name: 'Dance accompaniment pattern', applies_to: ['charango', 'ronroco', 'tiple', 'bandola_andina', 'cuatro_pr', 'cuatro_venezolano', 'tres_cubano', 'cavaquinho', 'viola_caipira', 'jarana_jarocha', 'requinto_jarocho', 'vihuela_mexicana', 'banjo_5_string', 'bouzouki', 'baglamas', 'saz_baglama', 'tambura_balkan', 'balalaika', 'domra'], descriptors: ['rhythmic'], match_tokens: ['plucked', 'string-attack', 'dance-driving', 'dance-rhythm'], canonical_tags: ['folk'] },
      { id: 'plucked_call_and_response', name: 'Call-and-response', applies_to: ['kora', 'ngoni', 'kamele_ngoni', 'donso_ngoni', 'akonting', 'banjo_5_string', 'sintir', 'xalam'], descriptors: ['call-and-response'], match_tokens: ['plucked', 'string-attack', 'call-response', 'traditional'], canonical_tags: ['griot', 'west-african'] },
    ] },
  ],

  // ─────────────── ELECTRONIC ───────────────
  // Synthesizers, samplers, drum machines (non-percussion subset), DAWs as
  // instruments, modular systems.
  electronic: [
    { id: 'electronic_technique', name: 'Programming approach', variants: [
      { id: 'electronic_pad_drone', default: true, name: 'Pad / drone', applies_to: ['analog_synth', 'analog_poly_synth', 'digital_subtractive', 'fm_synth', 'wavetable_synth', 'string_machine', 'granular_synth', 'ondes_martenot', 'modular_synth', 'eurorack_modular', 'rompler_workstation'], descriptors: ['sustained', 'pad'], match_tokens: ['electronic', 'lead-and-pad', 'drone-like', 'drone-foundation'], canonical_tags: ['ambient', 'shoegaze'] },
      { id: 'electronic_arpeggiated', name: 'Arpeggiated sequence', applies_to: ['analog_synth', 'analog_mono_synth', 'analog_poly_synth', 'digital_subtractive', 'fm_synth', 'wavetable_synth', 'modular_synth', 'eurorack_modular', 'monosynth_acid_bass', 'rompler_workstation'], descriptors: ['arpeggiated', 'sequenced'], match_tokens: ['electronic', 'arpeggio-decoration'], canonical_tags: ['synthwave'] },
      { id: 'electronic_lead_line', name: 'Lead synth line', applies_to: ['analog_synth', 'analog_mono_synth', 'analog_poly_synth', 'fm_synth', 'digital_subtractive', 'wavetable_synth', 'ondes_martenot', 'theremin', 'rompler_workstation'], descriptors: ['lead', 'singing'], match_tokens: ['electronic', 'lead-melody'], canonical_tags: ['pop', 'synthwave'] },
      { id: 'electronic_bass_sub', name: 'Sub-bass', applies_to: ['analog_synth', 'analog_mono_synth', 'analog_poly_synth', 'monosynth_acid_bass', 'fm_synth', 'wavetable_synth', 'modular_synth', 'eurorack_modular', 'digital_subtractive', 'rompler_workstation'], descriptors: ['sub-bass', 'low'], match_tokens: ['electronic'], canonical_tags: ['hip-hop', 'trap', 'dubstep'] },
      { id: 'electronic_acid_squelch', name: 'Acid squelch (303-style)', applies_to: ['monosynth_acid_bass', 'analog_mono_synth', 'modular_synth'], descriptors: ['squelchy', 'resonant'], match_tokens: ['electronic', 'classic-acid'], canonical_tags: ['acid', 'techno'] },
      { id: 'electronic_modular_patch', name: 'Modular patch evolution', applies_to: ['modular_synth', 'eurorack_modular', 'granular_synth'], descriptors: ['modular', 'evolving'], match_tokens: ['electronic'], canonical_tags: ['experimental', 'idm'] },
      { id: 'electronic_sample_chopped', name: 'Sample chopped', applies_to: ['sampler_classic', 'sampler_drum_machine', 'turntable'], descriptors: ['chopped', 'sampled'], match_tokens: ['electronic'], canonical_tags: ['hip-hop', 'plunderphonics'] },
      { id: 'electronic_pluck_short', name: 'Pluck / short envelope', applies_to: ['analog_synth', 'analog_mono_synth', 'analog_poly_synth', 'fm_synth', 'digital_subtractive', 'wavetable_synth', 'rompler_workstation'], descriptors: ['plucked', 'short-envelope'], match_tokens: ['electronic', 'string-attack'], canonical_tags: ['pop', 'edm'] },
      { id: 'electronic_glitch_textural', name: 'Glitch / textural', applies_to: ['granular_synth', 'modular_synth', 'eurorack_modular', 'sampler_classic', 'wavetable_synth'], descriptors: ['glitched', 'textural'], match_tokens: ['electronic'], canonical_tags: ['idm', 'experimental'] },
    ] },
  ],

  // ─────────────── ENSEMBLE ───────────────
  // Already has fairly good shared part-id reuse (sections, members, era,
  // arrangement). NOT adding a generic technique part here — ensembles are
  // composed of multiple instruments, and the technique vocabulary lives at
  // the per-instrument level. Skipping.
  // ensemble: [],

  // ─────────────── VOICE ───────────────
  // The voice instrument already has a thorough part inventory at instrument
  // level (voice_register, voice_quality, voice_vibrato, voice_articulation,
  // voice_microtone). The 6 specialized voice variants (griot_voice,
  // pansori_voice, qawwal_voice, shape_note_voice, choir_ensemble) get more
  // limited specialized parts. NOT adding a family-level part here — the
  // voice instrument is so well-covered already that family-level vocabulary
  // would either duplicate or conflict.
  // voice: [],
};

