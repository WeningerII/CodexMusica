'use strict';
// Source/DOM qualification of row 204, not shell integration. Recorded catalog
// and states below come from the byte-pinned canonical oracle (20 states).
// No fixture adapter computes chain effects: tests deliver recorded snapshots.
// Fixture source commit: fd16719d46217adc9b57ef939c9497e29e77741c.
// Catalog projection: references/03_rooms_chains_tunings.js CHAIN_SECTIONS,
// evaluated by scripts/_loader.js (stage id/name/multiSelect and item id/name).
// Card producers: src/app.js makeCard('oud') and
// makeCard('banjo_5_string', traditionCardOpts('bluegrass', 'banjo_5_string')),
// executed through scripts/_load_app.js loadApp() in the disposable oracle.
// Changed states: src/pages/instrument.js ipApply(card, { k: 'chain', ... });
// removals also execute that page's actions['ip-fx-remove'], delegating to ipApply.
// The oracle records card.instrumentId/card.chain; only those fields and the
// catalog projection above are embedded here, not descriptor or recipe outputs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FIXTURES = {
  head: 'fd16719d46217adc9b57ef939c9497e29e77741c',
  stages: [
    {
      id: 'fx',
      name: 'Effects',
      multi: true,
      options: [
        {
          id: 'fuzz_silicon',
          name: 'Silicon fuzz',
        },
        {
          id: 'fuzz_germanium',
          name: 'Germanium fuzz',
        },
        {
          id: 'overdrive_low',
          name: 'Low-gain overdrive (transparent)',
        },
        {
          id: 'overdrive_tube_screamer',
          name: 'Mid-pushed overdrive',
        },
        {
          id: 'distortion_high',
          name: 'High-gain distortion',
        },
        {
          id: 'tape_echo',
          name: 'Tape echo / delay',
        },
        {
          id: 'analog_delay',
          name: 'Analog bucket-brigade delay',
        },
        {
          id: 'digital_delay',
          name: 'Digital delay',
        },
        {
          id: 'spring_reverb',
          name: 'Spring reverb',
        },
        {
          id: 'plate_reverb',
          name: 'Plate reverb',
        },
        {
          id: 'hall_reverb',
          name: 'Hall reverb',
        },
        {
          id: 'octave_up_reverb',
          name: 'Octave-up reverb (pitch-shifted)',
        },
        {
          id: 'chorus_pedal',
          name: 'Chorus',
        },
        {
          id: 'flanger_pedal',
          name: 'Flanger',
        },
        {
          id: 'phaser_pedal',
          name: 'Phaser',
        },
        {
          id: 'tremolo_pedal',
          name: 'Tremolo',
        },
        {
          id: 'wah_pedal',
          name: 'Wah / envelope filter',
        },
        {
          id: 'octave_pedal',
          name: 'Octave (up / down)',
        },
        {
          id: 'pitch_shifter',
          name: 'Pitch-shifter / harmonizer',
        },
        {
          id: 'autotune_aesthetic',
          name: 'Autotune (aesthetic — fast-correction)',
        },
        {
          id: 'ring_mod',
          name: 'Ring modulator',
        },
        {
          id: 'compressor_pedal',
          name: 'Compressor pedal',
        },
        {
          id: 'fx_ams_rmx16',
          name: 'AMS RMX16 digital reverb (80s)',
        },
        {
          id: 'fx_lexicon_224',
          name: 'Lexicon 224 / 480L (ambient reverb)',
        },
        {
          id: 'fx_eventide_harmonizer',
          name: 'Eventide Harmonizer (pitch-shift)',
        },
        {
          id: 'fx_tc_2290_delay',
          name: 'TC Electronic 2290 delay',
        },
        {
          id: 'fx_roland_space_echo',
          name: 'Roland RE-201 Space Echo (tape echo)',
        },
        {
          id: 'fx_big_muff_pi',
          name: 'Electro-Harmonix Big Muff Pi (1969)',
        },
        {
          id: 'fx_fuzz_face_silicon',
          name: 'Dallas Arbiter Fuzz Face (silicon, post-1968)',
        },
        {
          id: 'fx_fuzz_face_germanium',
          name: 'Dallas Arbiter Fuzz Face (germanium, 1966-68)',
        },
        {
          id: 'fx_tube_screamer',
          name: 'Ibanez Tube Screamer TS9 / TS808 (mid-pushed overdrive, 1979)',
        },
        {
          id: 'fx_klon_centaur',
          name: 'Klon Centaur (transparent overdrive, 1994)',
        },
        {
          id: 'fx_proco_rat',
          name: 'ProCo RAT (distortion, 1978)',
        },
        {
          id: 'fx_proco_turbo_rat',
          name: 'ProCo Turbo RAT (higher-gain, 1989)',
        },
        {
          id: 'fx_boss_ds1',
          name: 'Boss DS-1 (distortion, 1978)',
        },
        {
          id: 'fx_mxr_phase_90',
          name: 'MXR Phase 90 (orange phaser, 1974)',
        },
        {
          id: 'fx_univibe_chorus',
          name: 'Shin-Ei Uni-Vibe (rotating-speaker emulator, 1968)',
        },
        {
          id: 'fx_memory_man_delay',
          name: 'Electro-Harmonix Deluxe Memory Man (analog delay/chorus, 1976)',
        },
        {
          id: 'fx_digitech_whammy',
          name: 'DigiTech Whammy (pitch-shifter pedal, 1989)',
        },
        {
          id: 'fx_aphex_aural_exciter',
          name: 'Aphex Aural Exciter (psychoacoustic exciter, 1975)',
        },
        {
          id: 'fx_bbe_sonic_maximizer',
          name: 'BBE Sonic Maximizer (psychoacoustic processor, 1985)',
        },
        {
          id: 'fx_octavia_fuzz_octave',
          name: 'Octavia (octave-up fuzz, 1967)',
        },
        {
          id: 'fx_stereo_widener',
          name: 'Stereo widener / width control (M/S)',
        },
        {
          id: 'fx_ping_pong_delay',
          name: 'Ping-pong delay (cross-feedback stereo)',
        },
        {
          id: 'fx_haas_doubler',
          name: 'Haas doubler / ADT micro-delay widener',
        },
        {
          id: 'fx_auto_panner',
          name: 'Auto-panner (LFO stereo pan)',
        },
        {
          id: 'fx_mid_side_processor',
          name: 'Mid-Side (M/S) processor / matrix',
        },
        {
          id: 'fx_dimension_chorus',
          name: 'Stereo dimension chorus (anti-phase BBD, Dimension-D style)',
        },
        {
          id: 'fx_rotary_speaker_sim',
          name: 'Rotary speaker simulator (stereo Doppler)',
        },
        {
          id: 'fx_mono_maker_bass',
          name: 'Mono maker / bass-mono (elliptical filter)',
        },
        {
          id: 'fx_pseudo_stereo',
          name: 'Pseudo-stereo synthesizer (mono-to-stereo)',
        },
        {
          id: 'fx_true_stereo_reverb',
          name: 'True-stereo reverb (wide dual-path ambience)',
        },
      ],
    },
    {
      id: 'amp',
      name: 'Amplifier',
      multi: false,
      options: [
        {
          id: 'amp_american_clean',
          name: 'American clean tube combo',
        },
        {
          id: 'amp_american_tweed',
          name: 'American tweed-style tube',
        },
        {
          id: 'amp_american_blackface',
          name: 'American blackface tube',
        },
        {
          id: 'amp_british_class_a',
          name: 'British class-A combo (chimey)',
        },
        {
          id: 'amp_british_high_gain',
          name: 'British high-gain stack',
        },
        {
          id: 'amp_california_modern',
          name: 'California modern high-gain',
        },
        {
          id: 'amp_small_combo',
          name: 'Low-wattage combo tube (5–15W)',
        },
        {
          id: 'amp_solid_state_clean',
          name: 'Solid-state clean',
        },
        {
          id: 'amp_modeling',
          name: 'Modeling / digital amp',
        },
        {
          id: 'amp_bass_tube',
          name: 'Tube bass amp',
        },
        {
          id: 'amp_bass_solid',
          name: 'Solid-state bass amp',
        },
        {
          id: 'amp_acoustic_di',
          name: 'Acoustic / DI (no amp)',
        },
        {
          id: 'amp_leslie_cab',
          name: 'Rotating-speaker cabinet (organ)',
        },
        {
          id: 'amp_british_hiwatt',
          name: 'Hiwatt DR103 (British clean-headroom 100W, 1969)',
        },
        {
          id: 'amp_british_orange_dirty',
          name: 'Orange OR120 / Rockerverb (British heavy crunch)',
        },
        {
          id: 'amp_ampeg_svt_bass',
          name: 'Ampeg SVT (300W tube bass head, 1969)',
        },
        {
          id: 'amp_ampeg_b15_bass',
          name: 'Ampeg B-15 / Portaflex (flip-top tube bass combo, 1960)',
        },
        {
          id: 'amp_roland_jc120',
          name: 'Roland JC-120 Jazz Chorus (solid-state stereo chorus, 1975)',
        },
        {
          id: 'amp_music_man_hd130',
          name: 'Music Man HD-130 (hybrid tube-solidstate, 1974)',
        },
        {
          id: 'amp_soldano_slo100',
          name: 'Soldano SLO-100 (modern boutique high-gain, 1987)',
        },
        {
          id: 'amp_mesa_dual_rectifier',
          name: 'Mesa/Boogie Dual Rectifier (modern high-gain, 1991)',
        },
        {
          id: 'amp_fender_twin_blackface',
          name: 'Fender Twin Reverb (blackface 85W, 1965)',
        },
        {
          id: 'amp_fender_deluxe_tweed',
          name: 'Fender Tweed Deluxe (low-watt tweed, 1955)',
        },
        {
          id: 'amp_vox_ac30_topboost',
          name: 'Vox AC30 Top Boost (British class-A, 1963)',
        },
        {
          id: 'amp_marshall_plexi_1959',
          name: 'Marshall Super Lead 1959 (plexi 100W, 1965)',
        },
        {
          id: 'amp_marshall_jcm800',
          name: 'Marshall JCM800 2203 (master-volume, 1981)',
        },
        {
          id: 'amp_marshall_jtm45',
          name: 'Marshall JTM45 (US-tweed-derived British 30W, 1962)',
        },
        {
          id: 'amp_acoustic_360_bass',
          name: 'Acoustic 360 (transistor folded-horn bass head, 1968)',
        },
        {
          id: 'amp_trace_elliot_bass',
          name: 'Trace Elliot AH series (British transistor bass head, 1979)',
        },
        {
          id: 'amp_fender_champ_5w',
          name: 'Fender Champ (5W single-tube combo, 1948)',
        },
      ],
    },
    {
      id: 'mic',
      name: 'Microphone',
      multi: false,
      options: [
        {
          id: 'ribbon_passive',
          name: 'Passive ribbon (figure-8 velocity transducer)',
        },
        {
          id: 'ribbon_active',
          name: 'Active ribbon (modern)',
        },
        {
          id: 'mic_acoustic_horn_pre1925',
          name: 'Acoustic horn (pre-electrical, 1900–1925)',
        },
        {
          id: 'condenser_ldc',
          name: 'Large-diaphragm condenser',
        },
        {
          id: 'condenser_sdc',
          name: 'Pencil condenser',
        },
        {
          id: 'condenser_tube',
          name: 'Tube condenser',
        },
        {
          id: 'condenser_fet',
          name: 'FET condenser',
        },
        {
          id: 'dynamic_mic',
          name: 'Dynamic moving-coil',
        },
        {
          id: 'bullet_mic',
          name: 'Bullet mic (harp / vocal)',
        },
        {
          id: 'lavalier_mic',
          name: 'Lavalier',
        },
        {
          id: 'boundary_mic',
          name: 'Boundary (PZM)',
        },
        {
          id: 'carbon_button_single',
          name: 'Single-button carbon',
        },
        {
          id: 'carbon_button_double',
          name: 'Double-button carbon (broadcast)',
        },
        {
          id: 'crystal_rochelle',
          name: 'Crystal (Rochelle-salt piezoelectric)',
        },
        {
          id: 'crystal_bullet_harp',
          name: 'Crystal bullet (blues harp)',
        },
        {
          id: 'ceramic_piezo',
          name: 'Ceramic (piezoelectric)',
        },
        {
          id: 'contact_piezo_pickup',
          name: 'Contact / piezo pickup (instrument body)',
        },
        {
          id: 'electret_condenser',
          name: 'Electret condenser (consumer)',
        },
        {
          id: 'mems_phone',
          name: 'MEMS (phone / laptop silicon)',
        },
        {
          id: 'mic_u47_tube_neumann',
          name: 'Neumann U47 (tube, 1947)',
        },
        {
          id: 'mic_c12_tube_akg',
          name: 'AKG C12 (tube, 1953)',
        },
        {
          id: 'mic_ela_m_251_telefunken',
          name: 'Telefunken ELA M 251 (tube, 1959)',
        },
        {
          id: 'mic_u67_tube_neumann',
          name: 'Neumann U67 (tube, 1960)',
        },
        {
          id: 'mic_m49_tube_neumann',
          name: 'Neumann M49 (tube, 1951)',
        },
        {
          id: 'mic_rca_44bx_ribbon',
          name: 'RCA 44-BX (ribbon, 1938)',
        },
        {
          id: 'mic_rca_77dx_ribbon',
          name: 'RCA 77-DX (ribbon, 1954)',
        },
        {
          id: 'mic_coles_4038_ribbon',
          name: 'Coles 4038 (ribbon, BBC-spec 1953)',
        },
        {
          id: 'mic_beyer_m160_ribbon',
          name: 'Beyerdynamic M160 (ribbon, hypercardioid, 1957)',
        },
        {
          id: 'mic_royer_r121_ribbon',
          name: 'Royer R-121 (ribbon, modern, 1998)',
        },
        {
          id: 'mic_sm57_dynamic_shure',
          name: 'Shure SM57 (dynamic, 1965)',
        },
        {
          id: 'mic_sm58_dynamic_shure',
          name: 'Shure SM58 (dynamic, 1966)',
        },
        {
          id: 'mic_sm7b_dynamic_shure',
          name: 'Shure SM7 (dynamic, broadcast, 1973)',
        },
        {
          id: 'mic_md421_dynamic_sennheiser',
          name: 'Sennheiser MD421 (dynamic, 1960)',
        },
        {
          id: 'mic_u87_condenser_neumann',
          name: 'Neumann U87 (FET condenser, 1967)',
        },
        {
          id: 'mic_akg_414_condenser',
          name: 'AKG C414 (FET multi-pattern, 1971-pres)',
        },
        {
          id: 'mic_akg_451_condenser',
          name: 'AKG C451 (small-diaphragm FET, 1969)',
        },
        {
          id: 'mic_pair_mid_side',
          name: 'Mid-Side stereo pair',
        },
        {
          id: 'mic_pair_blumlein',
          name: 'Blumlein stereo pair (crossed figure-8)',
        },
        {
          id: 'mic_pair_ortf',
          name: 'ORTF stereo pair (110° / 17cm)',
        },
        {
          id: 'mic_decca_tree',
          name: 'Decca tree (three-mic orchestral)',
        },
        {
          id: 'dynamic_large_diaphragm',
          name: 'Large-diaphragm dynamic (variable-D, broadcast/kick)',
        },
        {
          id: 'mic_shotgun_condenser',
          name: 'Shotgun (interference-tube condenser)',
        },
        {
          id: 'condenser_measurement_omni',
          name: 'Measurement / reference omni (precision condenser)',
        },
        {
          id: 'mic_headset_condenser',
          name: 'Headset / head-worn (condenser)',
        },
        {
          id: 'hydrophone_piezo',
          name: 'Hydrophone (underwater piezo)',
        },
        {
          id: 'laryngophone_throat',
          name: 'Throat mic / laryngophone (neck contact)',
        },
        {
          id: 'optical_laser_mic',
          name: 'Optical / laser mic',
        },
        {
          id: 'mic_pair_xy',
          name: 'X-Y coincident pair',
        },
        {
          id: 'mic_pair_ab_spaced',
          name: 'A-B spaced pair (spaced omnis)',
        },
        {
          id: 'mic_pair_nos',
          name: 'NOS pair (90deg / 30cm near-coincident)',
        },
        {
          id: 'mic_binaural_dummy_head',
          name: 'Binaural dummy-head',
        },
        {
          id: 'mic_ambisonic_soundfield',
          name: 'Ambisonic soundfield (tetrahedral array)',
        },
        {
          id: 'parabolic_reflector',
          name: 'Parabolic reflector (focused capture)',
        },
      ],
    },
    {
      id: 'pre',
      name: 'Preamplifier',
      multi: false,
      options: [
        {
          id: 'tube_pre',
          name: 'Tube (vintage character)',
        },
        {
          id: 'tube_modern',
          name: 'Tube (modern hi-fi)',
        },
        {
          id: 'transformer_solid_state',
          name: 'Solid-state transformer-coupled',
        },
        {
          id: 'transformerless',
          name: 'Solid-state transformerless',
        },
        {
          id: 'ultra_clean',
          name: 'Solid-state ultra-clean',
        },
        {
          id: 'class_a_discrete',
          name: 'Class-A discrete',
        },
        {
          id: 'pre_neve_1073_input',
          name: 'British inductor-input mic-pre (1073-school)',
        },
        {
          id: 'pre_api_312',
          name: 'American op-amp mic-pre (312-school)',
        },
        {
          id: 'pre_tube_german_v72',
          name: 'German tube broadcast pre (V72/V76-school)',
        },
        {
          id: 'pre_500_series_modern',
          name: '500-series boutique pre',
        },
        {
          id: 'pre_console_inline_strip',
          name: 'Console-input-strip pre',
        },
        {
          id: 'pre_field_recorder_portable',
          name: 'Portable field-recorder pre',
        },
        {
          id: 'pre_ribbon_high_z',
          name: 'High-gain high-Z (ribbon-specific)',
        },
        {
          id: 'pre_helios_uk_70s',
          name: 'Helios UK-rock-recording pre',
        },
        {
          id: 'pre_calrec_bbc',
          name: 'Calrec BBC-broadcast pre',
        },
        {
          id: 'pre_ua_610_tube',
          name: 'Universal Audio 610 (tube, 1960)',
        },
        {
          id: 'pre_manley_voxbox',
          name: 'Manley Voxbox (tube channel strip, 1996)',
        },
        {
          id: 'pre_avalon_v737',
          name: 'Avalon VT-737sp (tube channel strip, 1996)',
        },
        {
          id: 'pre_di_box_dedicated',
          name: 'Dedicated DI box (Countryman / Radial / Avalon U5)',
        },
        {
          id: 'pre_sebatron_vmp_tube',
          name: 'Sebatron vmp (tube, Australian boutique, 2002)',
        },
        {
          id: 'pre_summit_tla100',
          name: 'Summit Audio TLA-100A (tube comp/pre, 1994)',
        },
      ],
    },
    {
      id: 'comp',
      name: 'Compression',
      multi: false,
      options: [
        {
          id: 'comp_optical',
          name: 'Optical compressor (LDR)',
        },
        {
          id: 'comp_fet',
          name: 'FET compressor',
        },
        {
          id: 'comp_vca',
          name: 'VCA compressor',
        },
        {
          id: 'comp_vari_mu',
          name: 'Vari-mu (tube)',
        },
        {
          id: 'comp_pumping',
          name: 'Pumping / sidechain',
        },
        {
          id: 'comp_none',
          name: 'None / minimal',
        },
        {
          id: 'comp_1176_fet',
          name: 'FET classic (1176-school)',
        },
        {
          id: 'comp_la2a_optical',
          name: 'Optical classic (LA-2A-school)',
        },
        {
          id: 'comp_dbx_160_vca',
          name: 'VCA classic (dbx 160-school)',
        },
        {
          id: 'comp_brick_wall_limiter',
          name: 'Brick-wall limiter (mastering)',
        },
        {
          id: 'comp_parallel_blend',
          name: 'Parallel / NY-compression blend',
        },
        {
          id: 'comp_multiband',
          name: 'Multiband compressor (mastering)',
        },
        {
          id: 'comp_telefunken_u73b',
          name: 'Telefunken U73b broadcast comp',
        },
        {
          id: 'comp_adr_compex',
          name: 'ADR Compex UK rock-recording comp',
        },
        {
          id: 'comp_api_525',
          name: 'API 525 discrete VCA',
        },
        {
          id: 'comp_distressor_modern',
          name: 'Empirical Labs Distressor',
        },
        {
          id: 'comp_fairchild_670_tube',
          name: 'Fairchild 670 (tube vari-mu, 1959)',
        },
        {
          id: 'comp_manley_vari_mu',
          name: 'Manley Vari-Mu (tube vari-mu, 1994)',
        },
        {
          id: 'comp_tube_tech_cl1b',
          name: 'Tube-Tech CL1B (tube-optical, Danish boutique, 1987)',
        },
        {
          id: 'comp_pendulum_oca8',
          name: 'Pendulum OCL-2 / 6386 (tube-optical, US boutique, 1996)',
        },
        {
          id: 'comp_api_2500_bus',
          name: 'API 2500 stereo bus compressor (1999)',
        },
        {
          id: 'comp_smart_c1_bus',
          name: 'SMART Research C1/C2 (SSL-clone bus VCA, 1989)',
        },
        {
          id: 'comp_fatso_el',
          name: 'Empirical Labs FATSO (tape-emulation comp, 1999)',
        },
      ],
    },
    {
      id: 'eq',
      name: 'Equalizer',
      multi: false,
      options: [
        {
          id: 'eq_passive_program',
          name: 'Passive program EQ',
        },
        {
          id: 'eq_active_parametric',
          name: 'Active parametric',
        },
        {
          id: 'eq_graphic',
          name: 'Graphic EQ',
        },
        {
          id: 'eq_tilt',
          name: 'Tilt / single-knob',
        },
        {
          id: 'eq_none',
          name: 'None / minimal',
        },
        {
          id: 'eq_passive_program_pultec',
          name: 'Pultec-style passive program',
        },
        {
          id: 'eq_inductor_iron',
          name: 'Iron-inductor channel EQ (Neve-school)',
        },
        {
          id: 'eq_proportional_q',
          name: 'Proportional-Q channel EQ (API-school)',
        },
        {
          id: 'eq_console_surgical',
          name: 'Console-style surgical (SSL-school)',
        },
        {
          id: 'eq_dynamic',
          name: 'Dynamic EQ (frequency-dependent compression)',
        },
        {
          id: 'eq_loudness_compensation',
          name: 'Broadcast / loudness-compensation curve',
        },
        {
          id: 'eq_mastering_clean_digital',
          name: 'Clean digital mastering EQ',
        },
        {
          id: 'eq_api_550',
          name: 'API 550A/B proportional-Q',
        },
        {
          id: 'eq_massenburg_mastering',
          name: 'GML Massenburg parametric (mastering)',
        },
        {
          id: 'eq_manley_massive_passive',
          name: 'Manley Massive Passive (tube passive program, 1998)',
        },
        {
          id: 'eq_sontec_mes_432',
          name: 'Sontec MES-432 (parametric, mastering reference, 1972)',
        },
        {
          id: 'eq_dangerous_bax',
          name: 'Dangerous BAX EQ (shelving, mastering, 2003)',
        },
        {
          id: 'eq_tube_tech_pe1c',
          name: 'Tube-Tech PE 1C (Pultec EQP-1A clone, tube, 1989)',
        },
        {
          id: 'eq_maag_eq4_air',
          name: 'Maag EQ4 (Air band 40k shelf, c. 2010)',
        },
        {
          id: 'eq_pultec_eqp1a3',
          name: 'Pultec EQP-1A3 (later transistor revision, 1968)',
        },
      ],
    },
    {
      id: 'medium',
      name: 'Medium',
      multi: false,
      options: [
        {
          id: 'tape_30ips',
          name: 'Analog tape (2-inch, 30 ips)',
        },
        {
          id: 'tape_15ips',
          name: 'Analog tape (15 ips)',
        },
        {
          id: 'cassette_medium',
          name: 'Cassette tape',
        },
        {
          id: 'digital_std',
          name: 'Digital (16-bit / 44.1 kHz)',
        },
        {
          id: 'digital_high',
          name: 'Digital (24-bit / 96 kHz+)',
        },
        {
          id: 'tape_emulated',
          name: 'Tape-emulated digital',
        },
        {
          id: 'wax_cylinder',
          name: 'Wax cylinder (1900s)',
        },
        {
          id: 'shellac_78',
          name: '78-rpm shellac',
        },
        {
          id: 'vinyl_master_cut',
          name: 'Vinyl mastering cut',
        },
        {
          id: 'mp3_lossy_modern',
          name: 'MP3/AAC lossy compression',
        },
        {
          id: 'am_radio_broadcast',
          name: 'AM-radio broadcast chain',
        },
        {
          id: 'walkman_dictaphone',
          name: 'Walkman / dictaphone cassette',
        },
        {
          id: 'medium_dat_pro_late80s_90s',
          name: 'DAT (Digital Audio Tape) pro mixdown',
        },
        {
          id: 'medium_minidisc_japan_90s',
          name: 'MiniDisc (Sony, Japan-90s consumer)',
        },
        {
          id: 'medium_cassette_4track_bedroom',
          name: 'Tascam Portastudio 4-track cassette (bedroom)',
        },
        {
          id: 'medium_direct_to_disc_lacquer',
          name: 'Direct-to-disc lacquer (audiophile mastering)',
        },
        {
          id: 'medium_akai_adam_12track_1991',
          name: 'Akai A-DAM 12-track digital tape (1991, Hi8-format)',
        },
        {
          id: 'medium_indian_lebanese_pressing',
          name: 'Indian/Lebanese/Greek vinyl pressing (Ethio-jazz 1969–74)',
        },
        {
          id: 'medium_dsd_dsf_high_res',
          name: 'DSD / DSF high-resolution (Sony / Philips, 1999-pres)',
        },
        {
          id: 'medium_8track_cartridge',
          name: '8-track cartridge (Lear / RCA, 1965-83)',
        },
        {
          id: 'medium_dub_plate_cut',
          name: 'Acetate dub plate cut (Kingston soundsystem, 1960s-pres)',
        },
        {
          id: 'medium_lacquer_test_pressing',
          name: 'Lacquer test pressing (audiophile reference)',
        },
        {
          id: 'medium_vhs_hifi_audio',
          name: 'VHS hi-fi audio (NTSC/PAL, consumer 1985-2005)',
        },
        {
          id: 'medium_mono_master',
          name: 'Mono master (single-channel mixdown / disc)',
        },
        {
          id: 'medium_stereo_spectacular',
          name: 'Stereo-spectacular master (wide-panned hi-fi)',
        },
      ],
    },
    {
      id: 'console',
      name: 'Console color',
      multi: false,
      options: [
        {
          id: 'clean',
          name: 'Clean / transparent',
        },
        {
          id: 'colored',
          name: 'Colored (vintage transformer-iron)',
        },
        {
          id: 'broken',
          name: 'Broken / lo-fi (intentionally degraded)',
        },
        {
          id: 'console_british_transformer_70s',
          name: 'British transformer-coupled (Neve-school)',
        },
        {
          id: 'console_british_inline_80s',
          name: 'British solid-state inline (SSL-school)',
        },
        {
          id: 'console_american_op_amp',
          name: 'American discrete op-amp (API-school)',
        },
        {
          id: 'console_british_class_a_70s',
          name: 'British class-A (Trident-school)',
        },
        {
          id: 'console_broadcast_present',
          name: 'Broadcast / BBC-style',
        },
        {
          id: 'console_german_tube_50s',
          name: 'German tube broadcast (V72/V76-school)',
        },
        {
          id: 'console_home_portastudio',
          name: 'Home portastudio / cassette-multitrack',
        },
        {
          id: 'console_in_the_box',
          name: 'In-the-box / DAW summing',
        },
        {
          id: 'console_trident_a_range',
          name: 'Trident A-Range UK rock-recording',
        },
        {
          id: 'console_mci_jh636',
          name: 'MCI JH-636 US 70s indie/jazz',
        },
        {
          id: 'console_dda_uk_80s',
          name: 'DDA AMR-school UK 80s mid-tier',
        },
        {
          id: 'console_mackie_8bus_90s',
          name: 'Mackie 8-bus 90s indie commercial',
        },
        {
          id: 'console_hit_factory_nyc_1991_92',
          name: 'Hit Factory NYC (1991–92 SSL G+/Neve VR rooms)',
        },
        {
          id: 'console_uk_community_studio_80s',
          name: 'UK community-studio mid-tier (Brent Black era)',
        },
        {
          id: 'console_helios_uk_70s',
          name: 'Helios Type 69 (UK class-A rock console, 1969-1979)',
        },
        {
          id: 'console_emi_redd',
          name: 'EMI REDD.51 (EMI London in-house tube, 1958-1968)',
        },
        {
          id: 'console_emi_tg12345',
          name: 'EMI TG12345 (EMI London solid-state, 1968-1980s)',
        },
        {
          id: 'console_quad_eight_la_70s',
          name: 'Quad Eight Coronado / Pacifica (US 70s rock LA console, 1969-1982)',
        },
        {
          id: 'console_sphere_eclipse_us_70s_80s',
          name: 'Sphere Eclipse C (US discrete summing, 1979-1985)',
        },
        {
          id: 'console_sony_mxp3000',
          name: 'Sony MXP-3000 series (Japanese inline 80s)',
        },
        {
          id: 'console_soundcraft_3200_uk_80s',
          name: 'Soundcraft TS24 / 3200 (UK mid-tier inline, 1980s)',
        },
        {
          id: 'console_calrec_uk_broadcast',
          name: 'Calrec UA8000 (UK broadcast/studio inline, 1980s)',
        },
        {
          id: 'console_neve_88r_modern',
          name: 'Neve 88R / 88RS (modern flagship, 2000-pres)',
        },
        {
          id: 'console_apinla_vintage_la',
          name: 'API Vintage (Sunset Sound / Capitol LA, 1970s)',
        },
        {
          id: 'console_stereo_width_bus',
          name: 'Wide stereo bus (M-S width / image control)',
        },
        {
          id: 'console_mono_sum_bus',
          name: 'Mono summing bus (single-channel mixdown)',
        },
      ],
    },
  ],
  states: [
    {
      name: 'bare-oud-default',
      instrumentId: 'oud',
      chain: {
        fx: [],
        amp: null,
        mic: null,
        pre: null,
        comp: null,
        eq: null,
        medium: null,
        console: null,
      },
    },
    {
      name: 'bluegrass-banjo-default',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: null,
        mic: 'mic_rca_77dx_ribbon',
        pre: 'tube_pre',
        comp: 'comp_la2a_optical',
        eq: 'eq_passive_program_pultec',
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'replace-amp',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'mic_rca_77dx_ribbon',
        pre: 'tube_pre',
        comp: 'comp_la2a_optical',
        eq: 'eq_passive_program_pultec',
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'clear-amp',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: null,
        mic: 'mic_rca_77dx_ribbon',
        pre: 'tube_pre',
        comp: 'comp_la2a_optical',
        eq: 'eq_passive_program_pultec',
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'replace-mic',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_pre',
        comp: 'comp_la2a_optical',
        eq: 'eq_passive_program_pultec',
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'clear-mic',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: null,
        pre: 'tube_pre',
        comp: 'comp_la2a_optical',
        eq: 'eq_passive_program_pultec',
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'replace-pre',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_la2a_optical',
        eq: 'eq_passive_program_pultec',
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'clear-pre',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: null,
        comp: 'comp_la2a_optical',
        eq: 'eq_passive_program_pultec',
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'replace-comp',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_optical',
        eq: 'eq_passive_program_pultec',
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'clear-comp',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: null,
        eq: 'eq_passive_program_pultec',
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'replace-eq',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_optical',
        eq: 'eq_passive_program',
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'clear-eq',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_optical',
        eq: null,
        medium: 'tape_15ips',
        console: 'colored',
      },
    },
    {
      name: 'replace-medium',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_optical',
        eq: 'eq_passive_program',
        medium: 'tape_30ips',
        console: 'colored',
      },
    },
    {
      name: 'clear-medium',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_optical',
        eq: 'eq_passive_program',
        medium: null,
        console: 'colored',
      },
    },
    {
      name: 'replace-console',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_optical',
        eq: 'eq_passive_program',
        medium: 'tape_30ips',
        console: 'clean',
      },
    },
    {
      name: 'clear-console',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_optical',
        eq: 'eq_passive_program',
        medium: 'tape_30ips',
        console: null,
      },
    },
    {
      name: 'two-effects',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: ['fuzz_silicon', 'fuzz_germanium'],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_optical',
        eq: 'eq_passive_program',
        medium: 'tape_30ips',
        console: 'clean',
      },
    },
    {
      name: 'one-effect-removed',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: ['fuzz_germanium'],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_optical',
        eq: 'eq_passive_program',
        medium: 'tape_30ips',
        console: 'clean',
      },
    },
    {
      name: 'all-effects-removed',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: 'amp_american_clean',
        mic: 'ribbon_passive',
        pre: 'tube_modern',
        comp: 'comp_optical',
        eq: 'eq_passive_program',
        medium: 'tape_30ips',
        console: 'clean',
      },
    },
    {
      name: 'all-chain-cleared',
      instrumentId: 'banjo_5_string',
      chain: {
        fx: [],
        amp: null,
        mic: null,
        pre: null,
        comp: null,
        eq: null,
        medium: null,
        console: null,
      },
    },
  ],
};
const featurePath = path.resolve(__dirname, '../../features/instrument-signal/chain.js');
const cssPath = path.resolve(__dirname, '../../features/instrument-signal/chain.css');
const source = fs.readFileSync(featurePath, 'utf8');
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function snapshot(name, revision) {
  const fixture = FIXTURES.states.find((item) => item.name === name);
  assert.ok(fixture, name);
  return freeze({
    status: 'ready',
    error: null,
    instrumentId: fixture.instrumentId,
    revision,
    stages: FIXTURES.stages.map((stage) => ({
      stage: stage.id,
      multi: stage.multi,
      value: fixture.chain[stage.id],
      options: stage.options,
    })),
  });
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function run(sourceText, label = 'source') {
  // Node-only dependency, dynamically loaded per the scenario boundary.
  const { JSDOM } = await import('jsdom');
  const { mount } = await import(
    'data:text/javascript;base64,' + Buffer.from(sourceText).toString('base64')
  );
  const dom = new JSDOM(
    '<!doctype html><button id="outside">Outside</button><div id="a"></div><div id="b"></div>'
  );
  const doc = dom.window.document;
  const checks = [];
  function ok(name, fn) {
    fn();
    checks.push(name);
  }
  function setup(id = 'a', initial = snapshot('bare-oud-default', 1)) {
    const host = doc.getElementById(id);
    let current = initial;
    const listeners = new Set();
    const calls = [];
    const announcements = [];
    const controller = new AbortController();
    const ctx = Object.freeze({
      signal: controller.signal,
      announce: (text) => announcements.push(text),
      chain: Object.freeze({
        snapshot: () => current,
        subscribe: (fn) => {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        choose: (args) => new Promise((resolve, reject) => calls.push({ args, resolve, reject })),
      }),
    });
    const handle = mount(host, ctx);
    return {
      host,
      handle,
      calls,
      announcements,
      controller,
      listeners,
      publish(next) {
        current = next;
        for (const fn of listeners) fn();
      },
      set(next) {
        current = next;
      },
    };
  }
  const control = (view, key) =>
    [...view.host.querySelectorAll('[data-chain-key]')].find((el) => el.dataset.chainKey === key);
  function change(view, key, value) {
    const el = control(view, key);
    assert.ok(el, key);
    el.focus();
    el.value = value;
    el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  }
  const view = setup();
  for (const [index, state] of FIXTURES.states.entries()) {
    const next = snapshot(state.name, index + 2);
    view.publish(next);
    ok('real state: ' + state.name, () => {
      assert.equal(view.host.querySelectorAll('select').length, 8);
      assert.deepEqual(
        [...view.host.querySelectorAll('select')].map((el) => el.dataset.chainStage),
        FIXTURES.stages.map((s) => s.id)
      );
      for (const stage of next.stages) {
        const el = control(view, stage.multi ? 'fx-add' : stage.stage);
        assert.equal(el.value, stage.multi ? '' : stage.value || '');
        const expected = stage.options.filter((o) => !stage.multi || !stage.value.includes(o.id));
        assert.deepEqual(
          [...el.options].slice(1).map((o) => [o.value, o.textContent]),
          expected.map((o) => [o.id, o.name])
        );
        assert.equal(el.options[0].textContent, stage.multi ? 'Add an effect…' : 'Not set');
      }
      assert.deepEqual(
        [...view.host.querySelectorAll('button[data-chain-id]')].map((el) => el.dataset.chainId),
        state.chain.fx
      );
      for (const id of state.chain.fx)
        assert.equal(
          control(view, 'remove:' + id).getAttribute('aria-label'),
          'Remove ' + FIXTURES.stages[0].options.find((o) => o.id === id).name
        );
      const labels = [...view.host.querySelectorAll('label > span')].map((el) => el.textContent);
      assert.deepEqual(
        labels,
        FIXTURES.stages.slice(1).map((s) => s.name)
      );
    });
  }
  view.publish(snapshot('bluegrass-banjo-default', 50));
  change(view, 'mic', '');
  ok('single clears with displayed revision', () =>
    assert.deepEqual(view.calls.at(-1).args, {
      stage: 'mic',
      id: null,
      on: undefined,
      revision: 50,
    })
  );
  ok('pending uses canonical value', () =>
    assert.equal(control(view, 'mic').value, 'mic_rca_77dx_ribbon')
  );
  const first = view.calls.at(-1);
  view.publish(snapshot('clear-mic', 51));
  first.resolve(snapshot('clear-mic', 51));
  await tick();
  ok('single focus restored', () => assert.equal(doc.activeElement, control(view, 'mic')));
  change(view, 'mic', 'mic_rca_77dx_ribbon');
  ok('single replacement forwards exact id', () =>
    assert.equal(view.calls.at(-1).args.id, 'mic_rca_77dx_ribbon')
  );
  view.calls.at(-1).reject({ code: 'STALE', message: 'This preview moved. Select again.' });
  await tick();
  ok('safe supplied stale message preserved', () =>
    assert.equal(
      view.host.querySelector('.chain-message').textContent,
      'This preview moved. Select again.'
    )
  );
  view.publish(snapshot('all-effects-removed', 52));
  change(view, 'fx-add', 'fuzz_silicon');
  ok('effect append forwards on true', () =>
    assert.deepEqual(view.calls.at(-1).args, {
      stage: 'fx',
      id: 'fuzz_silicon',
      on: true,
      revision: 52,
    })
  );
  const older = view.calls.at(-1);
  change(view, 'fx-add', 'fuzz_germanium');
  const newer = view.calls.at(-1);
  view.publish(snapshot('two-effects', 53));
  newer.resolve(snapshot('two-effects', 53));
  await tick();
  older.resolve(snapshot('all-effects-removed', 52));
  await tick();
  ok('late result cannot erase newer effects', () =>
    assert.equal(view.host.querySelectorAll('button[data-chain-id]').length, 2)
  );
  const remove = control(view, 'remove:fuzz_silicon');
  remove.focus();
  remove.click();
  ok('removal forwards on false and current revision', () =>
    assert.deepEqual(view.calls.at(-1).args, {
      stage: 'fx',
      id: 'fuzz_silicon',
      on: false,
      revision: 53,
    })
  );
  view.publish(snapshot('one-effect-removed', 54));
  view.calls.at(-1).resolve(snapshot('one-effect-removed', 54));
  await tick();
  ok('removed-chip focus goes to add effect', () =>
    assert.equal(doc.activeElement, control(view, 'fx-add'))
  );
  const priorCount = view.calls.length;
  change(view, 'fx-add', '');
  ok('empty effect placeholder is inert', () => assert.equal(view.calls.length, priorCount));
  change(view, 'fx-add', 'fuzz_silicon');
  const oldSelection = view.calls.at(-1);
  doc.getElementById('outside').focus();
  view.publish(snapshot('bare-oud-default', 55));
  oldSelection.reject({ code: 'FAIL', message: 'Error for the previous instrument' });
  await tick();
  ok('selection supersedes old failure without focus theft', () => {
    assert.equal(doc.activeElement, doc.getElementById('outside'));
    assert.ok(!view.host.textContent.includes('Error for the previous instrument'));
    assert.equal(control(view, 'amp').value, '');
  });
  change(view, 'fx-add', 'fuzz_silicon');
  const pending = view.calls.at(-1);
  const other = setup('b', snapshot('two-effects', 100));
  ok('multiple hosts independent', () =>
    assert.equal(other.host.querySelectorAll('button[data-chain-id]').length, 2)
  );
  view.controller.abort();
  pending.resolve(snapshot('two-effects', 56));
  await tick();
  ok('abort disposes subscription and late action', () => {
    assert.equal(view.host.children.length, 0);
    assert.equal(view.listeners.size, 0);
    assert.equal(other.host.querySelectorAll('select').length, 8);
  });
  view.handle.unmount();
  other.publish(freeze({ status: 'loading', error: null, instrumentId: 'oud', revision: 101 }));
  ok('loading replaces controls', () => {
    assert.equal(other.host.querySelectorAll('select').length, 0);
    assert.match(other.host.textContent, /Loading signal chain/);
  });
  other.publish(
    freeze({
      status: 'error',
      error: { code: 'CATALOG', message: 'Catalog <retry> is unavailable & unchanged.' },
      instrumentId: 'oud',
      revision: 102,
    })
  );
  ok('supplied snapshot error rendered as text', () => {
    assert.ok(other.host.textContent.includes('Catalog <retry> is unavailable & unchanged.'));
    assert.equal(other.host.querySelector('retry'), null);
  });
  other.publish(snapshot('two-effects', 103));
  control(other, 'fx-add').focus();
  other.publish(snapshot('bare-oud-default', 104));
  ok('focused selection change lands on heading', () =>
    assert.equal(doc.activeElement, other.host.querySelector('h2'))
  );
  other.handle.unmount();
  ok('unmount idempotent', () => {
    other.handle.unmount();
    assert.equal(other.listeners.size, 0);
    assert.equal(other.host.children.length, 0);
  });
  // A promise can resolve without a subscription; read snapshot(), not result.
  const final = setup('a', snapshot('all-effects-removed', 200));
  change(final, 'fx-add', 'fuzz_silicon');
  const action = final.calls.at(-1);
  final.set(snapshot('two-effects', 201));
  action.resolve(snapshot('all-effects-removed', 200));
  await tick();
  ok('resolution re-reads authoritative snapshot', () =>
    assert.equal(final.host.querySelectorAll('button[data-chain-id]').length, 2)
  );
  final.handle.unmount();
  const aborted = new AbortController();
  aborted.abort();
  let subscribed = 0;
  mount(final.host, {
    signal: aborted.signal,
    chain: {
      subscribe() {
        subscribed++;
      },
    },
  });
  ok('already aborted mount creates no subscription', () => {
    assert.equal(subscribed, 0);
    assert.equal(final.host.children.length, 0);
  });
  const during = new AbortController();
  let cleaned = 0;
  mount(final.host, {
    signal: during.signal,
    chain: {
      subscribe() {
        during.abort();
        return () => cleaned++;
      },
    },
  });
  ok('abort during subscription cleans returned disposer', () => {
    assert.equal(cleaned, 1);
    assert.equal(final.host.children.length, 0);
  });
  dom.window.close();
  return { label, checks: checks.length, names: checks };
}

async function main() {
  const result = await run(source);
  const css = fs.readFileSync(cssPath, 'utf8');
  for (const selectors of css.matchAll(/([^{}]+)\{/g))
    for (const selector of selectors[1].split(','))
      assert.ok(selector.trim().startsWith('.instrument-signal-chain'), selector);
  console.log(JSON.stringify(result, null, 2));
  if (process.argv.includes('--mutations')) {
    const mutations = [
      ['drops revision', 'revision: displayed.revision', 'revision: undefined'],
      [
        'removal adds',
        'button.dataset.chainId,\n      false,',
        'button.dataset.chainId,\n      true,',
      ],
      ['placeholder sends', 'if (stage.multi && id === null) return;', ''],
      ['loses subscription cleanup', '    unsubscribe();', ''],
      [
        'select clear omitted',
        'const id = target.value || null;',
        'const id = target.value || "";',
      ],
      ['ignores authoritative snapshot', 'render(ctx.chain.snapshot());', 'render(shown);'],
      [
        'shows chosen effects in add menu',
        'if (stage.multi && stage.value.includes(option.id)) continue;',
        '',
      ],
      ['drops abort-race cleanup', 'if (disposed) unsubscribe();', 'if (disposed) {}'],
    ];
    for (const [name, from, to] of mutations) {
      assert.ok(source.includes(from), name);
      let failed = false;
      try {
        await run(source.replace(from, to), name);
      } catch {
        failed = true;
      }
      assert.ok(failed, 'mutation survived: ' + name);
      console.log('Killed: ' + name);
    }
  }
  if (process.argv.includes('--browser')) {
    const { chromium } = await import('playwright');
    let browser;
    let started = false;
    try {
      browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
        headless: true,
        chromiumSandbox: true,
      });
      const page = await browser.newPage();
      started = true;
      await page.setContent(
        '<!doctype html><button id="outside">Outside</button><div id="host"></div>'
      );
      await page.addStyleTag({ path: cssPath });
      await page.evaluate(
        async ({ source, fixtures }) => {
          const { mount } = await import(
            'data:text/javascript;charset=utf-8,' + encodeURIComponent(source)
          );
          let revision = 0;
          let current;
          const listeners = new Set();
          const calls = [];
          const controller = new AbortController();
          function publish(name) {
            const state = fixtures.states.find((entry) => entry.name === name);
            current = Object.freeze({
              status: 'ready',
              error: null,
              instrumentId: state.instrumentId,
              revision: ++revision,
              stages: fixtures.stages.map((stage) => ({
                stage: stage.id,
                multi: stage.multi,
                value: state.chain[stage.id],
                options: stage.options,
              })),
            });
            listeners.forEach((fn) => fn());
          }
          publish('two-effects');
          const handle = mount(document.getElementById('host'), {
            signal: controller.signal,
            announce() {},
            chain: Object.freeze({
              snapshot: () => current,
              subscribe(fn) {
                listeners.add(fn);
                return () => listeners.delete(fn);
              },
              choose(args) {
                return new Promise((resolve, reject) => calls.push({ args, resolve, reject }));
              },
            }),
          });
          window.chainTest = { publish, calls, controller, handle, listeners };
        },
        { source, fixtures: FIXTURES }
      );
      for (const state of FIXTURES.states) {
        await page.evaluate((name) => window.chainTest.publish(name), state.name);
        assert.deepEqual(
          await page
            .locator('select')
            .evaluateAll((els) => els.map((el) => [el.dataset.chainStage, el.value])),
          FIXTURES.stages.map((s) => [s.id, s.multi ? '' : state.chain[s.id] || ''])
        );
      }
      await page.evaluate(() => window.chainTest.publish('two-effects'));
      await page.getByRole('button', { name: 'Remove Silicon fuzz', exact: true }).focus();
      await page.keyboard.press('Enter');
      assert.deepEqual(
        await page.evaluate(() => {
          const { stage, id, on } = window.chainTest.calls.at(-1).args;
          return { stage, id, on };
        }),
        { stage: 'fx', id: 'fuzz_silicon', on: false }
      );
      await page.evaluate(() => {
        window.chainTest.publish('one-effect-removed');
        window.chainTest.calls.at(-1).resolve();
      });
      assert.equal(
        await page
          .locator('[data-chain-key="fx-add"]')
          .evaluate((el) => el === document.activeElement),
        true
      );
      await page.setViewportSize({ width: 320, height: 640 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        true
      );
      await page.evaluate(() => window.chainTest.controller.abort());
      assert.equal(await page.locator('#host').textContent(), '');
      assert.equal(await page.evaluate(() => window.chainTest.listeners.size), 0);
      console.log('Browser fixture checks passed; real-shell integration remains pending.');
    } catch (error) {
      console.error(
        (started ? 'BROWSER FIXTURE FAILED: ' : 'BROWSER FIXTURE UNEXECUTED: ') + error.message
      );
      process.exitCode = started ? 1 : 2;
    } finally {
      if (browser) await browser.close();
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
