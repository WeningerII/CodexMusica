// Hermetic lane-contract scenario; no current-production or real-browser parity claim.
// Run: node prototype/scenarios/instrument-catalog/catalog.cjs
// Requires repository dev dependency jsdom. MUTATION=name plants a lane defect.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../../..');
let checks = 0;
function check(name, test) {
  test();
  checks++;
  console.log('PASS ' + name);
}
const freeze = (x) => {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    Object.values(x).forEach(freeze);
  }
  return x;
};
// Fixture provenance: mergeFamilyParts, passesInstrumentFilter, ipHuman and ipSorted
// over INSTRUMENTS/INSTRUMENT_FAMILIES at fd16719d46217adc9b57ef939c9497e29e77741c.
// 93 real records retain their full-catalog nameOrder and merged partCount.
// Photo/Listen values are deliberate host doubles, not production media evidence.
const fixture = freeze({
  families: [
    {
      id: 'voice',
      name: 'Voice',
      classes: [
        {
          id: 'vocal_choir',
          name: 'Vocal choir',
        },
        {
          id: 'vocal_lead',
          name: 'Vocal lead',
        },
        {
          id: 'vocal_percussion',
          name: 'Vocal percussion',
        },
        {
          id: 'vocal_stack',
          name: 'Vocal stack',
        },
      ],
    },
    {
      id: 'electric_strings',
      name: 'Electric stringed',
      classes: [
        {
          id: 'bass',
          name: 'Bass',
        },
        {
          id: 'bowed_string_lead',
          name: 'Bowed string lead',
        },
        {
          id: 'plucked_string_lead',
          name: 'Plucked string lead',
        },
      ],
    },
    {
      id: 'acoustic_strings',
      name: 'Acoustic stringed',
      classes: [
        {
          id: 'arched_harp',
          name: 'Arched harp',
        },
        {
          id: 'bass',
          name: 'Bass',
        },
        {
          id: 'chordophone',
          name: 'Chordophone',
        },
        {
          id: 'drone_box_zither',
          name: 'Drone box zither',
        },
        {
          id: 'fretted_drone_zither',
          name: 'Fretted drone zither',
        },
        {
          id: 'fretted_guitar',
          name: 'Fretted guitar',
        },
        {
          id: 'plucked',
          name: 'Plucked',
        },
        {
          id: 'plucked_harp',
          name: 'Plucked harp',
        },
        {
          id: 'plucked_string',
          name: 'Plucked string',
        },
        {
          id: 'plucked_string_lead',
          name: 'Plucked string lead',
        },
        {
          id: 'plucked_string_rhythm',
          name: 'Plucked string rhythm',
        },
        {
          id: 'source_unspecified_requinto',
          name: 'Source unspecified requinto',
        },
        {
          id: 'source_unspecified_steel_guitar',
          name: 'Source unspecified steel guitar',
        },
        {
          id: 'string_ensemble',
          name: 'String ensemble',
        },
      ],
    },
    {
      id: 'plucked_traditional',
      name: 'Plucked traditional',
      classes: [
        {
          id: 'angular_harp',
          name: 'Angular harp',
        },
        {
          id: 'arched_bass_harp',
          name: 'Arched bass harp',
        },
        {
          id: 'arched_harp',
          name: 'Arched harp',
        },
        {
          id: 'bass',
          name: 'Bass',
        },
        {
          id: 'bass_lamellophone',
          name: 'Bass lamellophone',
        },
        {
          id: 'board_zither',
          name: 'Board zither',
        },
        {
          id: 'chordophone',
          name: 'Chordophone',
        },
        {
          id: 'credited_banjo_unspecified',
          name: 'Credited banjo unspecified',
        },
        {
          id: 'credited_bouzouki_unspecified',
          name: 'Credited bouzouki unspecified',
        },
        {
          id: 'fretboard_zither',
          name: 'Fretboard zither',
        },
        {
          id: 'harp_lute',
          name: 'Harp lute',
        },
        {
          id: 'isolated_credited_sapek_kayan',
          name: 'Isolated credited sapek kayan',
        },
        {
          id: 'jaw_harp',
          name: 'Jaw harp',
        },
        {
          id: 'long_neck_lute',
          name: 'Long neck lute',
        },
        {
          id: 'lute',
          name: 'Lute',
        },
        {
          id: 'lyre',
          name: 'Lyre',
        },
        {
          id: 'plucked',
          name: 'Plucked',
        },
        {
          id: 'plucked_banjo',
          name: 'Plucked banjo',
        },
        {
          id: 'plucked_boat_lute',
          name: 'Plucked boat lute',
        },
        {
          id: 'plucked_box_zither',
          name: 'Plucked box zither',
        },
        {
          id: 'plucked_harp_lute',
          name: 'Plucked harp lute',
        },
        {
          id: 'plucked_idiophone',
          name: 'Plucked idiophone',
        },
        {
          id: 'plucked_lute',
          name: 'Plucked lute',
        },
        {
          id: 'plucked_lyre',
          name: 'Plucked lyre',
        },
        {
          id: 'plucked_string',
          name: 'Plucked string',
        },
        {
          id: 'plucked_string_lead',
          name: 'Plucked string lead',
        },
        {
          id: 'psaltery',
          name: 'Psaltery',
        },
        {
          id: 'stick_zither',
          name: 'Stick zither',
        },
        {
          id: 'trough_zither',
          name: 'Trough zither',
        },
        {
          id: 'tube_zither',
          name: 'Tube zither',
        },
      ],
    },
    {
      id: 'bowed',
      name: 'Bowed',
      classes: [
        {
          id: 'bass',
          name: 'Bass',
        },
        {
          id: 'bowed',
          name: 'Bowed',
        },
        {
          id: 'bowed_box_zither',
          name: 'Bowed box zither',
        },
        {
          id: 'bowed_fiddle',
          name: 'Bowed fiddle',
        },
        {
          id: 'bowed_lute',
          name: 'Bowed lute',
        },
        {
          id: 'bowed_lyre',
          name: 'Bowed lyre',
        },
        {
          id: 'bowed_spike_fiddle',
          name: 'Bowed spike fiddle',
        },
        {
          id: 'bowed_string',
          name: 'Bowed string',
        },
        {
          id: 'bowed_tube_fiddle',
          name: 'Bowed tube fiddle',
        },
        {
          id: 'drone_box_zither',
          name: 'Drone box zither',
        },
        {
          id: 'fretboard_zither',
          name: 'Fretboard zither',
        },
        {
          id: 'spike_fiddle',
          name: 'Spike fiddle',
        },
        {
          id: 'stick_zither',
          name: 'Stick zither',
        },
        {
          id: 'tube_zither',
          name: 'Tube zither',
        },
        {
          id: 'zither',
          name: 'Zither',
        },
      ],
    },
    {
      id: 'percussion',
      name: 'Percussion',
      classes: [
        {
          id: 'bamboo_xylophone',
          name: 'Bamboo xylophone',
        },
        {
          id: 'barrel_drum',
          name: 'Barrel drum',
        },
        {
          id: 'bass_drum',
          name: 'Bass drum',
        },
        {
          id: 'body_percussion',
          name: 'Body percussion',
        },
        {
          id: 'cheng_burup',
          name: 'Cheng burup',
        },
        {
          id: 'cheng_pi',
          name: 'Cheng pi',
        },
        {
          id: 'chordophone-struck',
          name: 'Chordophone-struck',
        },
        {
          id: 'clay_pot_drum',
          name: 'Clay pot drum',
        },
        {
          id: 'concussion_idiophone',
          name: 'Concussion idiophone',
        },
        {
          id: 'concussion_sticks',
          name: 'Concussion sticks',
        },
        {
          id: 'credited_bottle',
          name: 'Credited bottle',
        },
        {
          id: 'credited_hand_drum',
          name: 'Credited hand drum',
        },
        {
          id: 'cylindrical_drum',
          name: 'Cylindrical drum',
        },
        {
          id: 'dholki_nal',
          name: 'Dholki nal',
        },
        {
          id: 'doba_maramures',
          name: 'Doba maramures',
        },
        {
          id: 'double_headed_drum',
          name: 'Double headed drum',
        },
        {
          id: 'drum_cymbal_combination',
          name: 'Drum cymbal combination',
        },
        {
          id: 'drum_ensemble',
          name: 'Drum ensemble',
        },
        {
          id: 'drum_kit',
          name: 'Drum kit',
        },
        {
          id: 'drum_pair',
          name: 'Drum pair',
        },
        {
          id: 'foot_percussion',
          name: 'Foot percussion',
        },
        {
          id: 'found_object_percussion',
          name: 'Found object percussion',
        },
        {
          id: 'frame_drum',
          name: 'Frame drum',
        },
        {
          id: 'gourd_rattle',
          name: 'Gourd rattle',
        },
        {
          id: 'hand_cymbals',
          name: 'Hand cymbals',
        },
        {
          id: 'hand_percussion',
          name: 'Hand percussion',
        },
        {
          id: 'handled_frame_drum',
          name: 'Handled frame drum',
        },
        {
          id: 'ho_dama_kettle_drum',
          name: 'Ho dama kettle drum',
        },
        {
          id: 'ho_dumang_double_headed_drum',
          name: 'Ho dumang double headed drum',
        },
        {
          id: 'hourglass_drum',
          name: 'Hourglass drum',
        },
        {
          id: 'hudka_uttarakhand',
          name: 'Hudka uttarakhand',
        },
        {
          id: 'idiophone',
          name: 'Idiophone',
        },
        {
          id: 'jaw_harp',
          name: 'Jaw harp',
        },
        {
          id: 'jingle_percussion',
          name: 'Jingle percussion',
        },
        {
          id: 'membranophone',
          name: 'Membranophone',
        },
        {
          id: 'membranophone_ensemble',
          name: 'Membranophone ensemble',
        },
        {
          id: 'metal_scraper',
          name: 'Metal scraper',
        },
        {
          id: 'metallophone',
          name: 'Metallophone',
        },
        {
          id: 'mixed_percussion_ensemble',
          name: 'Mixed percussion ensemble',
        },
        {
          id: 'percussion',
          name: 'Percussion',
        },
        {
          id: 'percussion_idiophone',
          name: 'Percussion idiophone',
        },
        {
          id: 'plucked_idiophone',
          name: 'Plucked idiophone',
        },
        {
          id: 'rattle',
          name: 'Rattle',
        },
        {
          id: 'shaken_bamboo_idiophone',
          name: 'Shaken bamboo idiophone',
        },
        {
          id: 'shaken_idiophone',
          name: 'Shaken idiophone',
        },
        {
          id: 'single_headed_drum',
          name: 'Single headed drum',
        },
        {
          id: 'single_headed_hand_drum',
          name: 'Single headed hand drum',
        },
        {
          id: 'slit_drum',
          name: 'Slit drum',
        },
        {
          id: 'slit_gong',
          name: 'Slit gong',
        },
        {
          id: 'struck_bamboo_idiophone',
          name: 'Struck bamboo idiophone',
        },
        {
          id: 'struck_box',
          name: 'Struck box',
        },
        {
          id: 'struck_idiophone',
          name: 'Struck idiophone',
        },
        {
          id: 'struck_vessel',
          name: 'Struck vessel',
        },
        {
          id: 'struck-strings',
          name: 'Struck-strings',
        },
        {
          id: 'tuned_drum_circle',
          name: 'Tuned drum circle',
        },
        {
          id: 'tuned_idiophone',
          name: 'Tuned idiophone',
        },
        {
          id: 'tuned_percussion',
          name: 'Tuned percussion',
        },
        {
          id: 'tuned_skin_drum_ensemble',
          name: 'Tuned skin drum ensemble',
        },
        {
          id: 'two_headed_drum',
          name: 'Two headed drum',
        },
        {
          id: 'water_drum',
          name: 'Water drum',
        },
        {
          id: 'water_percussion',
          name: 'Water percussion',
        },
      ],
    },
    {
      id: 'free_reed',
      name: 'Free reed',
      classes: [
        {
          id: 'accordina',
          name: 'Accordina',
        },
        {
          id: 'free_reed',
          name: 'Free reed',
        },
      ],
    },
    {
      id: 'wind',
      name: 'Wind',
      classes: [
        {
          id: 'aerophone (gourd-chambered idioglot double clarinet)',
          name: 'Aerophone (gourd-chambered idioglot double clarinet)',
        },
        {
          id: 'aerophone_ensemble',
          name: 'Aerophone ensemble',
        },
        {
          id: 'bagpipe',
          name: 'Bagpipe',
        },
        {
          id: 'bellows_bagpipe',
          name: 'Bellows bagpipe',
        },
        {
          id: 'brass',
          name: 'Brass',
        },
        {
          id: 'clarinet_ensemble',
          name: 'Clarinet ensemble',
        },
        {
          id: 'credited_bamboo_flute_unspecified',
          name: 'Credited bamboo flute unspecified',
        },
        {
          id: 'double_reed',
          name: 'Double reed',
        },
        {
          id: 'double_reed_shawm',
          name: 'Double reed shawm',
        },
        {
          id: 'duct_flute',
          name: 'Duct flute',
        },
        {
          id: 'edge_blown_horn_ensemble',
          name: 'Edge blown horn ensemble',
        },
        {
          id: 'end_blown_flute',
          name: 'End blown flute',
        },
        {
          id: 'flute',
          name: 'Flute',
        },
        {
          id: 'flute_ensemble',
          name: 'Flute ensemble',
        },
        {
          id: 'free-reed',
          name: 'Free-reed',
        },
        {
          id: 'globular vessel flute (aerophone)',
          name: 'Globular vessel flute (aerophone)',
        },
        {
          id: 'horn_ensemble',
          name: 'Horn ensemble',
        },
        {
          id: 'isolated_saxophone_section_alto_two_baritones',
          name: 'Isolated saxophone section alto two baritones',
        },
        {
          id: 'mirliton',
          name: 'Mirliton',
        },
        {
          id: 'mouth_blown_bagpipe',
          name: 'Mouth blown bagpipe',
        },
        {
          id: 'muri_jangkek',
          name: 'Muri jangkek',
        },
        {
          id: 'muri_tongpo',
          name: 'Muri tongpo',
        },
        {
          id: 'natural_pipe',
          name: 'Natural pipe',
        },
        {
          id: 'natural_trumpet',
          name: 'Natural trumpet',
        },
        {
          id: 'natural_trumpet_ensemble',
          name: 'Natural trumpet ensemble',
        },
        {
          id: 'nose_flute',
          name: 'Nose flute',
        },
        {
          id: 'overtone_flute',
          name: 'Overtone flute',
        },
        {
          id: 'raft_panpipe',
          name: 'Raft panpipe',
        },
        {
          id: 'reed',
          name: 'Reed',
        },
        {
          id: 'reed_bagpipe',
          name: 'Reed bagpipe',
        },
        {
          id: 'reed-bagpipe',
          name: 'Reed-bagpipe',
        },
        {
          id: 'regional_flute',
          name: 'Regional flute',
        },
        {
          id: 'ritual_trumpet',
          name: 'Ritual trumpet',
        },
        {
          id: 'saxophone_palette_soprano_unspecified',
          name: 'Saxophone palette soprano unspecified',
        },
        {
          id: 'single_reed_conical',
          name: 'Single reed conical',
        },
        {
          id: 'single_reed_cylindrical',
          name: 'Single reed cylindrical',
        },
        {
          id: 'single_reed_double_clarinet',
          name: 'Single reed double clarinet',
        },
        {
          id: 'single_reed_droned_pipe',
          name: 'Single reed droned pipe',
        },
        {
          id: 'single_reed_hornpipe',
          name: 'Single reed hornpipe',
        },
        {
          id: 'single_reed_pipe',
          name: 'Single reed pipe',
        },
        {
          id: 'three_hole_duct_flute',
          name: 'Three hole duct flute',
        },
        {
          id: 'three_hole_tabor_pipe',
          name: 'Three hole tabor pipe',
        },
        {
          id: 'transverse_flute',
          name: 'Transverse flute',
        },
        {
          id: 'txirula',
          name: 'Txirula',
        },
        {
          id: 'wind',
          name: 'Wind',
        },
        {
          id: 'wind_blown',
          name: 'Wind blown',
        },
        {
          id: 'wind_free_aerophone',
          name: 'Wind free aerophone',
        },
      ],
    },
    {
      id: 'keyboard',
      name: 'Keyboard',
      classes: [
        {
          id: 'electromechanical_electric_piano',
          name: 'Electromechanical electric piano',
        },
        {
          id: 'free_reed',
          name: 'Free reed',
        },
        {
          id: 'keyboard',
          name: 'Keyboard',
        },
        {
          id: 'keyboard_acoustic',
          name: 'Keyboard acoustic',
        },
        {
          id: 'keyboard_electric',
          name: 'Keyboard electric',
        },
      ],
    },
    {
      id: 'electronic',
      name: 'Electronic',
      classes: [
        {
          id: 'apple_es2_software_synth',
          name: 'Apple es2 software synth',
        },
        {
          id: 'binaural_spatial_renderer',
          name: 'Binaural spatial renderer',
        },
        {
          id: 'cassette_pause_tape_looping',
          name: 'Cassette pause tape looping',
        },
        {
          id: 'credited_beat_unspecified',
          name: 'Credited beat unspecified',
        },
        {
          id: 'credited_drum_machine_unspecified',
          name: 'Credited drum machine unspecified',
        },
        {
          id: 'credited_programmed_drums_unspecified',
          name: 'Credited programmed drums unspecified',
        },
        {
          id: 'credited_samples_unspecified',
          name: 'Credited samples unspecified',
        },
        {
          id: 'credited_synthesizer_unspecified',
          name: 'Credited synthesizer unspecified',
        },
        {
          id: 'custom_therevox_unspecified',
          name: 'Custom therevox unspecified',
        },
        {
          id: 'digital_audio_processing',
          name: 'Digital audio processing',
        },
        {
          id: 'digital_multiengine_synthesizer',
          name: 'Digital multiengine synthesizer',
        },
        {
          id: 'digital_percussion_pad',
          name: 'Digital percussion pad',
        },
        {
          id: 'digital_synthesis_drum_machine',
          name: 'Digital synthesis drum machine',
        },
        {
          id: 'electronic',
          name: 'Electronic',
        },
        {
          id: 'electronic_drum_kit_unspecified',
          name: 'Electronic drum kit unspecified',
        },
        {
          id: 'environmental_recording',
          name: 'Environmental recording',
        },
        {
          id: 'feedback_network',
          name: 'Feedback network',
        },
        {
          id: 'fixed_tone_recording',
          name: 'Fixed tone recording',
        },
        {
          id: 'gene_iii_drum_machine',
          name: 'Gene iii drum machine',
        },
        {
          id: 'isolated_analog_sine_oscillator',
          name: 'Isolated analog sine oscillator',
        },
        {
          id: 'isolated_software_isochronic_tone_generator',
          name: 'Isolated software isochronic tone generator',
        },
        {
          id: 'jt4000_micro',
          name: 'Jt4000 micro',
        },
        {
          id: 'keyboard_electric',
          name: 'Keyboard electric',
        },
        {
          id: 'korg_nts1_digital',
          name: 'Korg nts1 digital',
        },
        {
          id: 'korg_volca_keys',
          name: 'Korg volca keys',
        },
        {
          id: 'korg_volca_sample',
          name: 'Korg volca sample',
        },
        {
          id: 'korg_volca_sample2',
          name: 'Korg volca sample2',
        },
        {
          id: 'moog_matriarch',
          name: 'Moog matriarch',
        },
        {
          id: 'octapad_unspecified',
          name: 'Octapad unspecified',
        },
        {
          id: 'produced_808_bass',
          name: 'Produced 808 bass',
        },
        {
          id: 'produced_cowbell',
          name: 'Produced cowbell',
        },
        {
          id: 'sequential_prophet_xl',
          name: 'Sequential prophet xl',
        },
        {
          id: 'software_lofi_reworking',
          name: 'Software lofi reworking',
        },
        {
          id: 'software_noise_generator',
          name: 'Software noise generator',
        },
        {
          id: 'software_sample_playback',
          name: 'Software sample playback',
        },
        {
          id: 'software_singing_synthesizer',
          name: 'Software singing synthesizer',
        },
        {
          id: 'software_virtual_analog_synth',
          name: 'Software virtual analog synth',
        },
        {
          id: 'source_unspecified_electronics',
          name: 'Source unspecified electronics',
        },
        {
          id: 'source_unspecified_live_processing',
          name: 'Source unspecified live processing',
        },
        {
          id: 'source_unspecified_noise',
          name: 'Source unspecified noise',
        },
        {
          id: 'tuned_percussion',
          name: 'Tuned percussion',
        },
      ],
    },
    {
      id: 'ensemble',
      name: 'Ensemble',
      classes: [
        {
          id: 'bowed_string',
          name: 'Bowed string',
        },
        {
          id: 'credited_sound_effect_unspecified',
          name: 'Credited sound effect unspecified',
        },
        {
          id: 'drum_kit',
          name: 'Drum kit',
        },
        {
          id: 'free_reed',
          name: 'Free reed',
        },
        {
          id: 'hand_percussion',
          name: 'Hand percussion',
        },
        {
          id: 'keyboard_acoustic',
          name: 'Keyboard acoustic',
        },
        {
          id: 'plucked_string_lead',
          name: 'Plucked string lead',
        },
        {
          id: 'tuned_percussion',
          name: 'Tuned percussion',
        },
        {
          id: 'vocal_choir',
          name: 'Vocal choir',
        },
        {
          id: 'wind_blown',
          name: 'Wind blown',
        },
      ],
    },
  ],
  properties: [
    {
      id: 'sustained',
      label: 'sustained',
      groupId: 'behaviour',
    },
    {
      id: 'decay',
      label: 'decay-only',
      groupId: 'behaviour',
    },
    {
      id: 'polyphonic',
      label: 'polyphonic',
      groupId: 'voicing',
    },
    {
      id: 'monophonic',
      label: 'monophonic',
      groupId: 'voicing',
    },
    {
      id: 'pitched',
      label: 'pitched',
      groupId: 'pitch',
    },
    {
      id: 'noise',
      label: 'noise-leaning',
      groupId: 'pitch',
    },
    {
      id: 'fixed_pitch',
      label: 'fixed-pitch',
      groupId: 'pitch',
    },
    {
      id: 'continuous_pitch',
      label: 'continuous-pitch',
      groupId: 'pitch',
    },
    {
      id: 'low',
      label: 'low register',
      groupId: 'register',
    },
    {
      id: 'high',
      label: 'high register',
      groupId: 'register',
    },
    {
      id: 'wide_range',
      label: 'wide range',
      groupId: 'register',
    },
    {
      id: 'acoustic',
      label: 'acoustic',
      groupId: 'source',
    },
    {
      id: 'electric',
      label: 'electric',
      groupId: 'source',
    },
    {
      id: 'electronic',
      label: 'electronic / synth',
      groupId: 'source',
    },
    {
      id: 'expressive',
      label: 'fully expressive',
      groupId: 'expressive',
    },
  ],
  propertyGroups: [
    {
      id: 'behaviour',
      name: 'Behaviour',
    },
    {
      id: 'voicing',
      name: 'Voicing',
    },
    {
      id: 'pitch',
      name: 'Pitch',
    },
    {
      id: 'register',
      name: 'Register',
    },
    {
      id: 'source',
      name: 'Sound source',
    },
    {
      id: 'expressive',
      name: 'Expressiveness',
    },
  ],
  sorts: [
    {
      id: 'name',
      name: 'Name A–Z',
    },
    {
      id: 'name-desc',
      name: 'Name Z–A',
    },
    {
      id: 'parts',
      name: 'Most customizable',
    },
  ],
  items: [
    {
      id: 'akonting',
      name: 'Akonting (Senegambian banjo ancestor)',
      short: 'akonting',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 4,
      nameOrder: 21,
      propertyIds: ['decay', 'fixed_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'baglamas',
      name: 'Baglamás (Greek miniature bouzouki)',
      short: 'baglamás',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 84,
      propertyIds: [
        'decay',
        'polyphonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'bajo_sexto',
      name: 'Bajo sexto',
      short: 'bajo sexto',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 86,
      propertyIds: [
        'decay',
        'polyphonic',
        'pitched',
        'fixed_pitch',
        'low',
        'wide_range',
        'acoustic',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'balalaika',
      name: 'Balalaika (Russian triangular)',
      short: 'balalaika',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 90,
      propertyIds: ['decay', 'polyphonic', 'pitched', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'biwa_lute',
      name: 'Biwa (Japanese plucked lute)',
      short: 'biwa',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 140,
      propertyIds: ['decay', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'bouzouki',
      name: 'Bouzouki (Greek long-neck lute)',
      short: 'bouzouki',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 160,
      propertyIds: [
        'decay',
        'polyphonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'cavaquinho',
      name: 'Cavaquinho (Portuguese / Brazilian)',
      short: 'cavaquinho',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 199,
      propertyIds: [
        'decay',
        'polyphonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'charango',
      name: 'Charango (Andean compact lute)',
      short: 'charango',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 217,
      propertyIds: [
        'decay',
        'polyphonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'cuatro_pr',
      name: 'Cuatro (Puerto Rican)',
      short: 'cuatro',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 325,
      propertyIds: ['decay', 'polyphonic', 'pitched', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'cuatro_venezolano',
      name: 'Cuatro venezolano',
      short: 'cuatro venezolano',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 4,
      nameOrder: 326,
      propertyIds: ['decay', 'polyphonic', 'pitched', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'cumbus',
      name: 'Çümbüş (Turkish banjo-bodied lute)',
      short: 'çümbüş',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 6,
      nameOrder: 328,
      propertyIds: ['decay', 'polyphonic', 'fixed_pitch', 'wide_range', 'acoustic', 'expressive'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'dan_bau',
      name: 'Đàn bầu (Vietnamese monochord)',
      short: 'đàn bầu',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 2,
      nameOrder: 342,
      propertyIds: ['monophonic', 'pitched', 'continuous_pitch', 'wide_range', 'expressive'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'dan_tranh',
      name: 'Đàn tranh (Vietnamese 16-string zither)',
      short: 'đàn tranh',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 352,
      propertyIds: [
        'decay',
        'polyphonic',
        'pitched',
        'fixed_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'domra',
      name: 'Domra (Russian round-body lute)',
      short: 'domra',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 410,
      propertyIds: ['decay', 'polyphonic', 'pitched', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'dotara',
      name: 'Dotara (Bengali plucked lute)',
      short: 'dotara',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 3,
      nameOrder: 418,
      propertyIds: ['decay', 'fixed_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'banjo_5_string',
      name: 'Five-string banjo',
      short: 'five-string banjo',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 10,
      nameOrder: 488,
      propertyIds: ['decay', 'polyphonic', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'gayageum',
      name: 'Gayageum (Korean 12-string zither)',
      short: 'gayageum',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 4,
      nameOrder: 551,
      propertyIds: [
        'decay',
        'polyphonic',
        'pitched',
        'fixed_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'geomungo',
      name: 'Geomungo (Korean six-string fretted zither)',
      short: 'geomungo',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 558,
      propertyIds: ['decay', 'fixed_pitch', 'low', 'wide_range', 'acoustic', 'expressive'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'guqin',
      name: 'Gǔqín (Chinese 7-string zither)',
      short: 'guqin',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 596,
      propertyIds: ['decay', 'pitched', 'continuous_pitch', 'wide_range', 'acoustic', 'expressive'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'gusli',
      name: 'Gusli (Slavic psaltery)',
      short: 'gusli',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 5,
      nameOrder: 599,
      propertyIds: ['decay', 'polyphonic', 'pitched', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'oud',
      name: 'ʿŪd (Arab/Mediterranean fretless lute)',
      short: 'oud',
      familyId: 'plucked_traditional',
      classId: 'plucked_string_lead',
      partCount: 7,
      nameOrder: 1670,
      propertyIds: [
        'decay',
        'polyphonic',
        'pitched',
        'continuous_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: 'https://listen.example/oud',
      photo: ['../assets/fixture/oud.png', '', '', 'https://credit.example/oud'],
    },
    {
      id: 'jug_inst',
      name: 'Jug (blown ceramic / glass jug, bass instrument)',
      short: 'jug',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 2,
      nameOrder: 688,
      propertyIds: ['monophonic', 'noise', 'continuous_pitch', 'low', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'kazoo',
      name: 'Kazoo (membranophone hummed-through pipe)',
      short: 'kazoo',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 1,
      nameOrder: 727,
      propertyIds: ['monophonic', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'pi_nai',
      name: 'Pi nai (Thai quadruple-reed oboe)',
      short: 'pi nai',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 1,
      nameOrder: 1077,
      propertyIds: ['sustained', 'monophonic', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'alto_flute',
      name: 'Alto flute (in G)',
      short: 'alto flute',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 3,
      nameOrder: 33,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'bansuri',
      name: 'Bansuri (Indian transverse bamboo flute)',
      short: 'bansuri',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 102,
      propertyIds: ['sustained', 'monophonic', 'pitched', 'wide_range', 'acoustic', 'expressive'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'bass_flute',
      name: 'Bass flute (in C, octave below concert)',
      short: 'bass flute',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 3,
      nameOrder: 113,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'low',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'bassoon',
      name: 'Bassoon',
      short: 'bassoon',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 120,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'low',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'biniou',
      name: 'Biniou (Breton pipes)',
      short: 'biniou',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 6,
      nameOrder: 136,
      propertyIds: ['sustained', 'pitched', 'fixed_pitch', 'high', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'clarinet',
      name: 'Clarinet (B♭ / bass / contrabass)',
      short: 'clarinet',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 254,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'conch_shell_horn',
      name: 'Conch shell trumpet',
      short: 'conch',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 3,
      nameOrder: 272,
      propertyIds: ['sustained', 'monophonic', 'pitched', 'fixed_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'contrabassoon',
      name: 'Contrabassoon',
      short: 'contrabassoon',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 4,
      nameOrder: 280,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'low',
        'wide_range',
        'acoustic',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'cornet',
      name: 'Cornet',
      short: 'cornet',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 285,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'didgeridoo',
      name: 'Didgeridoo',
      short: 'didgeridoo',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 4,
      nameOrder: 385,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'low',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'dizi',
      name: 'Dizi (Chinese transverse bamboo)',
      short: 'dizi',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 399,
      propertyIds: [
        'sustained',
        'monophonic',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'duduk',
      name: 'Duduk (Armenian apricot-wood reed)',
      short: 'duduk',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 6,
      nameOrder: 431,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'low',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'english_horn',
      name: 'English horn / cor anglais',
      short: 'english horn',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 4,
      nameOrder: 467,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'euphonium',
      name: 'Euphonium (tenor tuba)',
      short: 'euphonium',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 477,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'low',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'flugelhorn',
      name: 'Flugelhorn',
      short: 'flugelhorn',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 497,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'flute',
      name: 'Flute (concert / alto / bass / piccolo)',
      short: 'flute',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 499,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'french_horn',
      name: 'French horn (orchestral)',
      short: 'french horn',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 3,
      nameOrder: 510,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'gaida_bulgarian',
      name: 'Gaida bulgarian (Balkan pipes)',
      short: 'gaida',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 6,
      nameOrder: 526,
      propertyIds: ['sustained', 'pitched', 'fixed_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'ghaita',
      name: 'Ghaita (Maghrebi shawm)',
      short: 'ghaita',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 561,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'hichiriki_double_reed',
      name: 'Hichiriki (double-reed bamboo aerophone)',
      short: 'hichiriki',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 627,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'highland_bagpipes',
      name: 'Great Highland bagpipes',
      short: 'highland pipes',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 6,
      nameOrder: 582,
      propertyIds: ['sustained', 'pitched', 'fixed_pitch', 'high', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'gaita_galega',
      name: 'Gaita galega (Galician bagpipes)',
      short: 'gaita galega',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 6,
      nameOrder: 530,
      propertyIds: ['sustained', 'pitched', 'high', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'bombarde',
      name: 'Bombarde (Breton oboe-shawm)',
      short: 'bombarde',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 2,
      nameOrder: 148,
      propertyIds: ['sustained', 'monophonic', 'high', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'ciaramella',
      name: 'Ciaramella (Italian shawm partner to zampogna)',
      short: 'ciaramella',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 2,
      nameOrder: 247,
      propertyIds: ['sustained', 'monophonic', 'high', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'gaita_colombiana',
      name: 'Gaita colombiana (Caribbean Colombian flute)',
      short: 'gaita',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 2,
      nameOrder: 528,
      propertyIds: ['sustained', 'monophonic', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'kakaki',
      name: 'Kakaki (West African long trumpet)',
      short: 'kakaki',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 4,
      nameOrder: 698,
      propertyIds: ['sustained', 'monophonic', 'pitched', 'fixed_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'kaval',
      name: 'Kaval (Bulgarian/Turkish end-blown flute)',
      short: 'kaval',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 4,
      nameOrder: 723,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'launeddas',
      name: 'Launeddas (Sardinian triple pipe)',
      short: 'launeddas',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 829,
      propertyIds: ['sustained', 'pitched', 'fixed_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'tin_whistle_low',
      name: 'Low whistle (Irish)',
      short: 'low whistle',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 3,
      nameOrder: 858,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'mey',
      name: 'Mey (Turkish double reed)',
      short: 'mey',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 911,
      propertyIds: ['sustained', 'monophonic', 'pitched', 'fixed_pitch', 'acoustic', 'expressive'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'mizmar',
      name: 'Mizmar / Egyptian shawm',
      short: 'mizmar',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 920,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'ney',
      name: 'Nāy / nay (Persian/Arab end-blown reed flute)',
      short: 'ney',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 983,
      propertyIds: ['sustained', 'monophonic', 'pitched', 'wide_range', 'acoustic', 'expressive'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'oboe',
      name: 'Oboe',
      short: 'oboe',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 1007,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'ocarina',
      name: 'Ocarina',
      short: 'ocarina',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 3,
      nameOrder: 1011,
      propertyIds: ['sustained', 'monophonic', 'pitched', 'fixed_pitch', 'high', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'piccolo',
      name: 'Piccolo',
      short: 'piccolo',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 3,
      nameOrder: 1083,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'quena',
      name: 'Quena (Andean notched flute)',
      short: 'quena',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 3,
      nameOrder: 1127,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'recorder',
      name: 'Recorder (renaissance / baroque)',
      short: 'recorder',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 4,
      nameOrder: 1152,
      propertyIds: ['sustained', 'monophonic', 'pitched', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'saxophone',
      name: 'Saxophone (soprano / alto / tenor / baritone)',
      short: 'saxophone',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 7,
      nameOrder: 1236,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'shakuhachi',
      name: 'Shakuhachi (Japanese end-blown bamboo flute)',
      short: 'shakuhachi',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 1273,
      propertyIds: ['sustained', 'monophonic', 'pitched', 'wide_range', 'acoustic', 'expressive'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'shawm',
      name: 'Shawm (renaissance double reed)',
      short: 'shawm',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 1278,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'shofar',
      name: "Shofar (ram's horn)",
      short: 'shofar',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 3,
      nameOrder: 1289,
      propertyIds: ['sustained', 'monophonic', 'pitched', 'fixed_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'suling',
      name: 'Suling (Indonesian end-blown flute)',
      short: 'suling',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 4,
      nameOrder: 1374,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'tin_whistle',
      name: 'Tin whistle / penny whistle',
      short: 'tin whistle',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 4,
      nameOrder: 1471,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'trombone',
      name: 'Trombone (tenor / bass / valve)',
      short: 'trombone',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 7,
      nameOrder: 1507,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'low',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'trumpet',
      name: 'Trumpet / cornet / flugelhorn',
      short: 'trumpet',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 7,
      nameOrder: 1511,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'tuba',
      name: 'Tuba (orchestral / brass band)',
      short: 'tuba',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 6,
      nameOrder: 1517,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'low',
        'wide_range',
        'acoustic',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'uilleann_pipes',
      name: 'Uilleann pipes (Irish bellows-blown)',
      short: 'uilleann pipes',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 7,
      nameOrder: 1556,
      propertyIds: ['sustained', 'pitched', 'fixed_pitch', 'wide_range', 'acoustic', 'expressive'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'xiao',
      name: 'Xiao (Chinese end-blown bamboo flute)',
      short: 'xiao',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 4,
      nameOrder: 1630,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'zampogna',
      name: 'Zampogna (Italian pipes)',
      short: 'zampogna',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 6,
      nameOrder: 1649,
      propertyIds: ['sustained', 'pitched', 'fixed_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'zurna',
      name: 'Zurna / surnay (Anatolian/Caucasian)',
      short: 'zurna',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 5,
      nameOrder: 1669,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'fixed_pitch',
        'high',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'washint',
      name: 'Washint (Ethiopian bamboo flute)',
      short: 'washint',
      familyId: 'wind',
      classId: 'flute',
      partCount: 1,
      nameOrder: 1613,
      propertyIds: ['sustained', 'monophonic', 'noise', 'continuous_pitch', 'high', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'daegeum',
      name: 'Daegeum (Korean large bamboo transverse flute)',
      short: 'daegeum',
      familyId: 'wind',
      classId: 'flute',
      partCount: 2,
      nameOrder: 333,
      propertyIds: [
        'sustained',
        'monophonic',
        'noise',
        'continuous_pitch',
        'wide_range',
        'acoustic',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'piri',
      name: 'Piri (Korean cylindrical double-reed)',
      short: 'piri',
      familyId: 'wind',
      classId: 'reed',
      partCount: 3,
      nameOrder: 1092,
      propertyIds: ['sustained', 'monophonic', 'noise', 'continuous_pitch', 'high', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'tibetan_gyaling',
      name: 'Gyaling (Tibetan double-reed oboe)',
      short: 'gyaling',
      familyId: 'wind',
      classId: 'reed',
      partCount: 3,
      nameOrder: 601,
      propertyIds: ['sustained', 'monophonic', 'noise', 'continuous_pitch', 'high', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'acordeon_vallenato',
      name: 'Acordeón vallenato (Hohner button accordion)',
      short: 'acordeón',
      familyId: 'wind',
      classId: 'free-reed',
      partCount: 2,
      nameOrder: 7,
      propertyIds: ['sustained', 'polyphonic', 'pitched', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'siku_panpipes',
      name: 'Siku panpipes (Andean Aymara)',
      short: 'siku',
      familyId: 'wind',
      classId: 'flute',
      partCount: 2,
      nameOrder: 1297,
      propertyIds: ['monophonic', 'noise', 'fixed_pitch', 'high', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'melanesian_panpipes',
      name: "Melanesian panpipes (Are'are / Highlands bamboo ensemble pipes)",
      short: 'Melanesian panpipes',
      familyId: 'wind',
      classId: 'flute',
      partCount: 3,
      nameOrder: 905,
      propertyIds: ['monophonic', 'noise', 'fixed_pitch', 'high', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'scottish_smallpipes',
      name: 'Scottish smallpipes (bellows-blown indoor pipe)',
      short: 'Scottish smallpipes',
      familyId: 'wind',
      classId: 'reed-bagpipe',
      partCount: 5,
      nameOrder: 1252,
      propertyIds: ['sustained', 'fixed_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'cajun_accordion',
      name: 'Cajun single-row diatonic accordion',
      short: 'Cajun accordion',
      familyId: 'wind',
      classId: 'free-reed',
      partCount: 2,
      nameOrder: 184,
      propertyIds: ['sustained', 'polyphonic', 'pitched', 'fixed_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'shehnai',
      name: 'Shehnai (North Indian double-reed oboe)',
      short: 'shehnai',
      familyId: 'wind',
      classId: 'double_reed',
      partCount: 5,
      nameOrder: 1279,
      propertyIds: ['sustained', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'nadaswaram',
      name: 'Nadaswaram (South Indian temple double-reed)',
      short: 'nadaswaram',
      familyId: 'wind',
      classId: 'double_reed',
      partCount: 5,
      nameOrder: 961,
      propertyIds: ['sustained', 'fixed_pitch', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'sralai',
      name: 'Sralai (Khmer quadruple-reed conical oboe)',
      short: 'sralai',
      familyId: 'wind',
      classId: 'double_reed',
      partCount: 2,
      nameOrder: 1351,
      propertyIds: ['sustained', 'monophonic', 'noise', 'continuous_pitch', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'udu',
      name: 'Udu (Igbo clay pot drum)',
      short: 'udu',
      familyId: 'percussion',
      classId: 'clay_pot_drum',
      partCount: 3,
      nameOrder: 1549,
      propertyIds: ['decay', 'monophonic', 'low', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'rauschpfeife',
      name: 'Rauschpfeife (Schreierpfeife, capped loud shawm)',
      short: 'rauschpfeife',
      familyId: 'wind',
      classId: 'wind_blown',
      partCount: 4,
      nameOrder: 1143,
      propertyIds: ['sustained', 'monophonic', 'fixed_pitch', 'high', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'koudi',
      name: 'Koudi (Chinese miniature centre-blown transverse flute)',
      short: 'koudi',
      familyId: 'wind',
      classId: 'transverse_flute',
      partCount: 4,
      nameOrder: 788,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'continuous_pitch',
        'high',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'oud_arbi',
      name: 'Oud arbi (Tunisian four-course fretless lute)',
      short: 'oud arbi',
      familyId: 'plucked_traditional',
      classId: 'plucked_lute',
      partCount: 3,
      nameOrder: 1036,
      propertyIds: ['pitched', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'outi',
      name: 'Outi (Greek oud of Smyrneiko and rebetiko)',
      short: 'outi',
      familyId: 'plucked_traditional',
      classId: 'plucked_lute',
      partCount: 2,
      nameOrder: 1037,
      propertyIds: ['pitched', 'wide_range', 'acoustic'],
      listenHref: null,
      photo: null,
    },
    {
      id: 'udukkai',
      name: 'Udukkai (Tamil hourglass tension drum)',
      short: 'udukkai',
      familyId: 'percussion',
      classId: 'hourglass_drum',
      partCount: 3,
      nameOrder: 1550,
      propertyIds: [
        'decay',
        'monophonic',
        'noise',
        'continuous_pitch',
        'wide_range',
        'acoustic',
        'expressive',
      ],
      listenHref: null,
      photo: null,
    },
    {
      id: 'udmurt_kubyz',
      name: 'Kubyz (Udmurt three-string bowed instrument)',
      short: 'Udmurt bowed kubyz',
      familyId: 'bowed',
      classId: 'bowed_lute',
      partCount: 2,
      nameOrder: 798,
      propertyIds: [
        'sustained',
        'monophonic',
        'pitched',
        'continuous_pitch',
        'wide_range',
        'acoustic',
      ],
      listenHref: null,
      photo: null,
    },
  ],
});
// Search projection provenance: normalizeSearch, ipMatches and ipRank at the same
// commit. Capture only exercised queries; do not recreate the engine in this test.
const searches = freeze({
  '': {
    normalizedQuery: '',
    matches: [
      {
        id: 'akonting',
        rank: 0,
      },
      {
        id: 'baglamas',
        rank: 0,
      },
      {
        id: 'bajo_sexto',
        rank: 0,
      },
      {
        id: 'balalaika',
        rank: 0,
      },
      {
        id: 'biwa_lute',
        rank: 0,
      },
      {
        id: 'bouzouki',
        rank: 0,
      },
      {
        id: 'cavaquinho',
        rank: 0,
      },
      {
        id: 'charango',
        rank: 0,
      },
      {
        id: 'cuatro_pr',
        rank: 0,
      },
      {
        id: 'cuatro_venezolano',
        rank: 0,
      },
      {
        id: 'cumbus',
        rank: 0,
      },
      {
        id: 'dan_bau',
        rank: 0,
      },
      {
        id: 'dan_tranh',
        rank: 0,
      },
      {
        id: 'domra',
        rank: 0,
      },
      {
        id: 'dotara',
        rank: 0,
      },
      {
        id: 'banjo_5_string',
        rank: 0,
      },
      {
        id: 'gayageum',
        rank: 0,
      },
      {
        id: 'geomungo',
        rank: 0,
      },
      {
        id: 'guqin',
        rank: 0,
      },
      {
        id: 'gusli',
        rank: 0,
      },
      {
        id: 'oud',
        rank: 0,
      },
      {
        id: 'jug_inst',
        rank: 0,
      },
      {
        id: 'kazoo',
        rank: 0,
      },
      {
        id: 'pi_nai',
        rank: 0,
      },
      {
        id: 'alto_flute',
        rank: 0,
      },
      {
        id: 'bansuri',
        rank: 0,
      },
      {
        id: 'bass_flute',
        rank: 0,
      },
      {
        id: 'bassoon',
        rank: 0,
      },
      {
        id: 'biniou',
        rank: 0,
      },
      {
        id: 'clarinet',
        rank: 0,
      },
      {
        id: 'conch_shell_horn',
        rank: 0,
      },
      {
        id: 'contrabassoon',
        rank: 0,
      },
      {
        id: 'cornet',
        rank: 0,
      },
      {
        id: 'didgeridoo',
        rank: 0,
      },
      {
        id: 'dizi',
        rank: 0,
      },
      {
        id: 'duduk',
        rank: 0,
      },
      {
        id: 'english_horn',
        rank: 0,
      },
      {
        id: 'euphonium',
        rank: 0,
      },
      {
        id: 'flugelhorn',
        rank: 0,
      },
      {
        id: 'flute',
        rank: 0,
      },
      {
        id: 'french_horn',
        rank: 0,
      },
      {
        id: 'gaida_bulgarian',
        rank: 0,
      },
      {
        id: 'ghaita',
        rank: 0,
      },
      {
        id: 'hichiriki_double_reed',
        rank: 0,
      },
      {
        id: 'highland_bagpipes',
        rank: 0,
      },
      {
        id: 'gaita_galega',
        rank: 0,
      },
      {
        id: 'bombarde',
        rank: 0,
      },
      {
        id: 'ciaramella',
        rank: 0,
      },
      {
        id: 'gaita_colombiana',
        rank: 0,
      },
      {
        id: 'kakaki',
        rank: 0,
      },
      {
        id: 'kaval',
        rank: 0,
      },
      {
        id: 'launeddas',
        rank: 0,
      },
      {
        id: 'tin_whistle_low',
        rank: 0,
      },
      {
        id: 'mey',
        rank: 0,
      },
      {
        id: 'mizmar',
        rank: 0,
      },
      {
        id: 'ney',
        rank: 0,
      },
      {
        id: 'oboe',
        rank: 0,
      },
      {
        id: 'ocarina',
        rank: 0,
      },
      {
        id: 'piccolo',
        rank: 0,
      },
      {
        id: 'quena',
        rank: 0,
      },
      {
        id: 'recorder',
        rank: 0,
      },
      {
        id: 'saxophone',
        rank: 0,
      },
      {
        id: 'shakuhachi',
        rank: 0,
      },
      {
        id: 'shawm',
        rank: 0,
      },
      {
        id: 'shofar',
        rank: 0,
      },
      {
        id: 'suling',
        rank: 0,
      },
      {
        id: 'tin_whistle',
        rank: 0,
      },
      {
        id: 'trombone',
        rank: 0,
      },
      {
        id: 'trumpet',
        rank: 0,
      },
      {
        id: 'tuba',
        rank: 0,
      },
      {
        id: 'uilleann_pipes',
        rank: 0,
      },
      {
        id: 'xiao',
        rank: 0,
      },
      {
        id: 'zampogna',
        rank: 0,
      },
      {
        id: 'zurna',
        rank: 0,
      },
      {
        id: 'washint',
        rank: 0,
      },
      {
        id: 'daegeum',
        rank: 0,
      },
      {
        id: 'piri',
        rank: 0,
      },
      {
        id: 'tibetan_gyaling',
        rank: 0,
      },
      {
        id: 'acordeon_vallenato',
        rank: 0,
      },
      {
        id: 'siku_panpipes',
        rank: 0,
      },
      {
        id: 'melanesian_panpipes',
        rank: 0,
      },
      {
        id: 'scottish_smallpipes',
        rank: 0,
      },
      {
        id: 'cajun_accordion',
        rank: 0,
      },
      {
        id: 'shehnai',
        rank: 0,
      },
      {
        id: 'nadaswaram',
        rank: 0,
      },
      {
        id: 'sralai',
        rank: 0,
      },
      {
        id: 'udu',
        rank: 0,
      },
      {
        id: 'rauschpfeife',
        rank: 0,
      },
      {
        id: 'koudi',
        rank: 0,
      },
      {
        id: 'oud_arbi',
        rank: 0,
      },
      {
        id: 'outi',
        rank: 0,
      },
      {
        id: 'udukkai',
        rank: 0,
      },
      {
        id: 'udmurt_kubyz',
        rank: 0,
      },
    ],
  },
  oud: {
    normalizedQuery: 'oud',
    matches: [
      {
        id: 'oud',
        rank: 1.5,
      },
      {
        id: 'rauschpfeife',
        rank: 3,
      },
      {
        id: 'koudi',
        rank: 3,
      },
      {
        id: 'oud_arbi',
        rank: 1,
      },
      {
        id: 'outi',
        rank: 2,
      },
    ],
  },
  ud: {
    normalizedQuery: 'ud',
    matches: [
      {
        id: 'oud',
        rank: 1,
      },
      {
        id: 'duduk',
        rank: 3,
      },
      {
        id: 'udu',
        rank: 1,
      },
      {
        id: 'rauschpfeife',
        rank: 3,
      },
      {
        id: 'koudi',
        rank: 3,
      },
      {
        id: 'oud_arbi',
        rank: 3,
      },
      {
        id: 'outi',
        rank: 3,
      },
      {
        id: 'udukkai',
        rank: 1,
      },
      {
        id: 'udmurt_kubyz',
        rank: 1.5,
      },
    ],
  },
});
function searchProjection(query) {
  assert(Object.hasOwn(searches, query), 'Add a provenance-qualified fixture for this query');
  return searches[query];
}
check('embedded projection is frozen and contains real merged Oud', () => {
  assert.equal(fixture.items.length, 93);
  assert.equal(fixture.families.length, 11);
  assert.equal(fixture.items.find((i) => i.id === 'oud').partCount, 7);
  assert(Object.isFrozen(fixture.items[0].propertyIds));
});
check('captured query preserves exact id rank 1.5', () => {
  assert.equal(searches.oud.matches.find((i) => i.id === 'oud').rank, 1.5);
  assert.equal(searches.ud.normalizedQuery, 'ud');
});
check('captured properties retain acoustic pitched decay Oud', () => {
  const props = fixture.items.find((i) => i.id === 'oud').propertyIds;
  for (const id of ['acoustic', 'pitched', 'decay']) assert(props.includes(id));
  assert(!props.includes('electric'));
});
let code = fs.readFileSync(
  path.join(root, 'prototype/features/instrument-catalog/catalog.js'),
  'utf8'
);
const mutations = {
  and: ['.every((id) => i.propertyIds.includes(id))', '.some((id) => i.propertyIds.includes(id))'],
  ranking: ['ranks.get(a.id) - ranks.get(b.id)', '0'],
  count: ['const prospective = new Set(filters)', 'const prospective = new Set()'],
  limit: ['filtered.slice(0, limit)', 'filtered'],
  best: ['.slice(0, 12)', '.slice(0, 1)'],
  destination: ['destination: dest', 'destination: null'],
  debounce: ['}, 600)', '}, 0)'],
  subscriptions: ['offRecipe?.();', ''],
  focus: ["body.querySelector('.ic-results h3')", "body.querySelector('h3')"],
  scroll: ['saved?.signature === ul.dataset.signature', 'saved'],
  tracking: ['syncCurrentRow();\n    rowFrame', '/* tracking removed */\n    rowFrame'],
  aim: ['if (rowAim) {', 'if (false) {'],
};
if (process.env.MUTATION) {
  const [from, to] = mutations[process.env.MUTATION] || [];
  assert(from && code.includes(from), 'mutation must change code');
  code = code.replace(from, to);
}
async function main() {
  const dom = new JSDOM('<div id="host"></div>', {
    runScripts: 'outside-only',
    url: 'https://fixture.example/',
  });
  const w = dom.window,
    host = w.document.getElementById('host');
  // Geometry is a DOM double, not rendered browser evidence.
  w.HTMLElement.prototype.getClientRects = () => [{ width: 1, height: 1 }];
  w.HTMLElement.prototype.scrollIntoView = () => {};
  const frames = new Map();
  let frameId = 0;
  w.requestAnimationFrame = (fn) => {
    frames.set(++frameId, fn);
    return frameId;
  };
  w.cancelAnimationFrame = (id) => frames.delete(id);
  const frame = () => {
    const pending = [...frames];
    frames.clear();
    pending.forEach(([, fn]) => fn());
  };
  const tops = new Map();
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const group = this.dataset.group;
    const top = group
      ? (tops.get(group) ?? 80 + [...host.querySelectorAll('[data-group]')].indexOf(this) * 300)
      : 0;
    return { top, bottom: top + 44, left: 0, right: 100, width: 100, height: 44 };
  };
  const timers = new Map();
  let clock = 0,
    serial = 0;
  w.setTimeout = (fn, delay) => {
    timers.set(++serial, { at: clock + delay, fn });
    return serial;
  };
  w.clearTimeout = (id) => timers.delete(id);
  function tick(ms) {
    clock += ms;
    for (const [id, t] of timers)
      if (t.at <= clock) {
        timers.delete(id);
        t.fn();
      }
  }
  w.eval(
    code
      .replace('export function mount', 'function mount')
      .replace('import.meta.url', "'https://fixture.example/catalog.js'") +
      '\nwindow.mountCatalog=mount;'
  );
  let selected = null,
    state = {
      status: 'ready',
      busy: false,
      revision: 7,
      groups: [{ genreId: 'bluegrass', name: 'Bluegrass', count: 1 }],
      instrumentActions: {
        destination: 'bluegrass',
        destinations: [
          { genreId: null, name: 'Independent instrument' },
          { genreId: 'bluegrass', name: 'Bluegrass' },
        ],
      },
    };
  const calls = [],
    announcements = [],
    writes = [],
    listeners = new Set(),
    selections = new Set();
  let loads = 0,
    loader = async () => fixture;
  const ctx = {
    storage: {
      read: () => ({ ok: true, value: 'grid' }),
      write: (key, value) => {
        writes.push([key, value]);
        return { ok: true };
      },
    },
    announce: (text) => announcements.push(text),
    loadInstrumentCatalog: (options) => {
      loads++;
      return loader(options);
    },
    catalog: {
      normalize: (text) => searchProjection(text).normalizedQuery,
      search: searchProjection,
    },
    instrument: {
      current: () => selected,
      subscribe: (fn) => {
        selections.add(fn);
        return () => selections.delete(fn);
      },
    },
    media: { resolve: (url) => (url === '../assets/fixture/oud.png' ? url : null) },
    openPhoto: (...args) => calls.push(['photo', ...args]),
    openInstrument: (...args) => {
      calls.push(['open', ...args]);
      selected = args[0];
      selections.forEach((fn) => fn());
    },
    recipe: {
      snapshot: () => state,
      subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      addInstrument: (arg) => {
        calls.push(['add', arg]);
        return Promise.resolve({ snapshot: state, placed: 'independent' });
      },
    },
  };
  const settle = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  const get = (key) => [...host.querySelectorAll('[data-key]')].find((n) => n.dataset.key === key);
  function click(key) {
    const n = get(key);
    assert(n, 'control exists: ' + key);
    n.focus();
    n.click();
  }
  function input(value) {
    const n = host.querySelector('input[type=search]');
    n.value = value;
    n.dispatchEvent(new w.Event('input', { bubbles: true }));
  }
  function property(id) {
    const n = host.querySelector('[data-property="' + id + '"]');
    n.focus();
    n.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  const displayed = () => [...host.querySelectorAll('[data-item]')].map((n) => n.dataset.item);
  let handle = w.mountCatalog(host, ctx);
  await settle();
  check('fresh load, stylesheet, legacy grid maps to rows', () => {
    assert.equal(loads, 1);
    assert(host.querySelector('link[rel=stylesheet]'));
    assert.equal(get('view:rows').getAttribute('aria-pressed'), 'true');
    assert.equal(writes.length, 0);
  });
  check('full-catalog group order and no duplicates', () => {
    const groups = [...host.querySelectorAll('[data-group]')].map((n) => n.dataset.group);
    assert.equal(groups[0], 'wind');
    assert.equal(new Set(displayed()).size, fixture.items.length);
  });
  check('row tracking follows shell scroll geometry without a scroll event', () => {
    const groups = [...host.querySelectorAll('[data-group]')].map((n) => n.dataset.group);
    assert.equal(get('jump:' + groups[0]).getAttribute('aria-current'), 'true');
    tops.set(groups[0], -300);
    tops.set(groups[1], 50);
    frame();
    assert.equal(get('jump:' + groups[1]).getAttribute('aria-current'), 'true');
    tops.clear();
  });
  check('short final-row jump holds until geometry moves', () => {
    const groups = [...host.querySelectorAll('[data-group]')].map((n) => n.dataset.group);
    const last = groups.at(-1);
    click('jump:' + last);
    frame();
    assert.equal(get('jump:' + last).getAttribute('aria-current'), 'true');
    tops.set(last, 9000);
    frame();
    assert.equal(get('jump:' + groups[0]).getAttribute('aria-current'), 'true');
    tops.clear();
  });
  check('unchanged rows preserve scroll, changed order resets', () => {
    const track = host.querySelector('[data-track=wind]');
    track.scrollLeft = 120;
    click('categories');
    assert.equal(host.querySelector('[data-track=wind]').scrollLeft, 120);
    const select = get('sort');
    select.value = 'name-desc';
    select.dispatchEvent(new w.Event('change'));
    assert.equal(host.querySelector('[data-track=wind]').scrollLeft, 0);
    const again = get('sort');
    again.value = 'name';
    again.dispatchEvent(new w.Event('change'));
  });
  input('oud');
  check('real ranked matches, top group and canonical id tier', () => {
    assert.deepEqual(displayed(), ['oud_arbi', 'oud', 'outi', 'koudi', 'rauschpfeife']);
    assert.equal(
      host.querySelector('[data-group=best]')?.querySelectorAll('[data-item]').length,
      3
    );
  });
  check('600ms announcement only, no filter debounce', () => {
    assert.equal(announcements.length, 0);
    tick(599);
    assert.equal(announcements.length, 0);
    tick(1);
    assert.equal(announcements.pop(), '5 instruments');
  });
  input('ud');
  check('search replaces pending announcement and canonical tiers', () => {
    tick(600);
    assert.deepEqual(displayed().slice(0, 4), ['udu', 'udukkai', 'oud', 'udmurt_kubyz']);
  });
  input('');
  click('view:list');
  check('list50 and Show more', () => {
    assert.equal(displayed().length, 50);
    click('more');
    assert.equal(displayed().length, Math.min(100, fixture.items.length));
    assert(
      w.document.activeElement === get('more') ||
        w.document.activeElement === host.querySelector('.ic-results h3')
    );
  });
  input('oud');
  click('open:oud');
  check('opening uses shell selection and exact focus handle', () => {
    assert.equal(calls.at(-1)[0], 'open');
    assert.equal(calls.at(-1)[1], 'oud');
    assert.equal(calls.at(-1)[2].returnFocus, get('open:oud'));
    assert.equal(host.querySelector('[data-item=oud]').getAttribute('aria-current'), 'true');
  });
  click('photo:oud');
  check('photo and Listen are delegated safely', () => {
    assert.equal(calls.at(-1)[0], 'photo');
    assert.equal(calls.at(-1)[1], fixture.items.find((i) => i.id === 'oud').photo);
    const a = host.querySelector('a[href="https://listen.example/oud"]');
    assert.equal(a.rel, 'noopener noreferrer');
    assert(host.textContent.includes('Photo: uncredited · licence not stated'));
  });
  click('add:oud');
  await settle();
  check('quick Add uses shared destination and recipe revision, not preview', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), [
      'add',
      { instrumentId: 'oud', destination: 'bluegrass', revision: 7 },
    ]);
    assert.equal(w.document.activeElement, get('add:oud'));
  });
  const saved = state;
  state = { ...state, instrumentActions: undefined };
  listeners.forEach((fn) => fn());
  const before = calls.length;
  click('add:oud');
  await settle();
  check('missing destination refuses instead of guessing independent', () => {
    assert.equal(calls.length, before);
    assert(host.textContent.includes('isn’t available in this build'));
  });
  state = saved;
  listeners.forEach((fn) => fn());
  input('');
  property('sustained');
  check('prospective count adds to active filters', () => {
    assert.equal(host.querySelector('[data-prospective=decay]').textContent, '0');
    assert(
      displayed().every((id) =>
        fixture.items.find((i) => i.id === id).propertyIds.includes('sustained')
      )
    );
  });
  property('decay');
  check('AND conflict names and recovery', () => {
    assert.equal(displayed().length, 0);
    assert(host.textContent.includes('No instrument in the catalogue is'));
    click('remove:decay');
    assert(displayed().length > 0);
  });
  click('clear-all');
  click('family:wind');
  check('family counts ignore selected family, class chips present', () => {
    assert.equal(
      host.querySelector('[data-family=plucked_traditional]').dataset.countValue,
      String(fixture.items.filter((i) => i.familyId === 'plucked_traditional').length)
    );
    assert(host.querySelector('[data-class]'));
  });
  click('back');
  check('back to all restores results heading focus', () =>
    assert.equal(w.document.activeElement, host.querySelector('.ic-results h3'))
  );
  const sortSelect = get('sort');
  sortSelect.value = 'parts';
  sortSelect.dispatchEvent(new w.Event('change'));
  check('merged part count sorting', () => {
    const expected = fixture.items
      .slice()
      .sort((a, b) => b.partCount - a.partCount || a.nameOrder - b.nameOrder);
    assert.deepEqual(
      displayed(),
      expected.slice(0, 50).map((i) => i.id)
    );
  });
  check('only view is persisted', () => assert.deepEqual(writes, [['view', 'list']]));
  input('oud');
  const countBefore = announcements.length;
  handle.unmount();
  tick(1000);
  check('unmount clears timers/subscriptions/style and DOM', () => {
    assert.equal(host.children.length, 0);
    assert.equal(listeners.size, 0);
    assert.equal(selections.size, 0);
    assert.equal(announcements.length, countBefore);
    assert.equal(frames.size, 0);
  });
  let resolve;
  loader = () =>
    new Promise((r) => {
      resolve = r;
    });
  handle = w.mountCatalog(host, ctx);
  handle.unmount();
  resolve(fixture);
  await settle();
  check('late load does not resurrect unmounted UI', () => assert.equal(host.children.length, 0));
  loader = async () => {
    throw Object.assign(
      new Error('This instrument’s details couldn’t load. Check your connection, then try again.'),
      { code: 'LOAD_FAILED' }
    );
  };
  handle = w.mountCatalog(host, ctx);
  await settle();
  check('loader guidance verbatim', () =>
    assert(
      host.textContent.includes(
        'This instrument’s details couldn’t load. Check your connection, then try again.'
      )
    )
  );
  loader = async () => fixture;
  click('retry');
  await settle();
  check('retry resets ephemeral state and restores focus', () => {
    assert.equal(host.querySelector('input[type=search]').value, '');
    assert.equal(get('sort').value, 'name');
    assert.equal(w.document.activeElement, host.querySelector('input[type=search]'));
  });
  handle.unmount();
  dom.window.close();
  console.log(
    JSON.stringify(
      {
        checks,
        domFixtureRecords: fixture.items.length,
        browser: 'not executed',
        evidence: 'frozen historical projections and DOM/geometry contract doubles',
      },
      null,
      2
    )
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
