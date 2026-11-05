// Local contract/DOM checks, not shell integration or browser qualification.
// Run from the checkout with its declared jsdom dependency installed: node <this file>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const { JSDOM } = require('jsdom');
const repo = path.resolve(__dirname, '../../..');
const feature = path.join(repo, 'prototype/features/instrument-environment/environment.js');
const source = fs.readFileSync(process.env.ENVIRONMENT_FEATURE_FILE || feature, 'utf8');
const mount = new Function(
  source
    .replace('export function mount', 'function mount')
    .replaceAll('import.meta.url', JSON.stringify(pathToFileURL(feature).href)) + '\nreturn mount;'
)();
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
// TUNINGS/ROOMS ordered id/name projections and entryRenderDescs; makeCard +
// traditionCardOpts and ipApply states, produced at fd16719d46217adc9b57ef939c9497e29e77741c.
// Historical fixtures only; current production parity belongs to the host/engine gates.
const options = freeze({
  tuning: [
    { id: 'twelve_tet', name: 'Twelve-tone equal temperament' },
    { id: 'just_intonation', name: 'Just intonation' },
    { id: 'pythagorean', name: 'Pythagorean tuning' },
    { id: 'meantone', name: 'Meantone temperament' },
    { id: 'well_temperament', name: 'Well temperament' },
    { id: 'edo_19', name: '19-tone equal temperament' },
    { id: 'edo_31', name: '31-tone equal temperament' },
    { id: 'edo_24_quarter_tones', name: '24-tone equal temperament (quarter-tones)' },
    { id: 'maqam_24edo', name: 'Arabic maqam framework' },
    { id: 'shruti_22', name: 'Hindustani shruti system' },
    { id: 'gagaku_ryo_ritsu', name: 'Gagaku ryo and ritsu modes' },
    { id: 'mbira_seven_tone', name: 'Mbira seven-tone tuning' },
    {
      id: 'well_temperament_north_german_baroque',
      name: 'Well temperament — north-German baroque circulating',
    },
    {
      id: 'well_temperament_late_baroque_italian',
      name: 'Well temperament — late-baroque Italian',
    },
    { id: 'edo_22', name: '22-tone equal temperament' },
    { id: 'edo_53', name: '53-tone equal temperament' },
    { id: 'edo_72', name: '72-tone equal temperament' },
    { id: 'dastgah_persian', name: 'Persian dastgah tuning' },
    { id: 'makam_turkish', name: 'Turkish makam (53-comma)' },
    { id: 'pelog_slendro_javanese', name: 'Pelog and slendro (Javanese gamelan)' },
    { id: 'pelog_slendro_balinese', name: 'Pelog and slendro (Balinese gamelan)' },
    { id: 'pentatonic_china', name: 'Chinese five-tone (gong/shang/jue/zhi/yu)' },
    { id: 'equal_heptatonic_thai_khmer', name: 'Thai/Khmer equal heptatonic' },
    { id: 'equal_heptatonic_west_african', name: 'West African equal heptatonic (Mande balafon)' },
    { id: 'slack_key_hawaiian', name: 'Hawaiian slack-key open tunings' },
    { id: 'cross_tuning_fiddle', name: 'Old-time fiddle cross-tunings' },
    { id: 'bohlen_pierce', name: 'Bohlen-Pierce non-octave scale' },
    { id: 'extended_just_intonation_43_tone', name: 'Extended just intonation (43-tone)' },
    { id: 'tuareg_pentatonic_raised4', name: 'Tuareg pentatonic with raised 4th' },
    { id: 'kignit_tezeta_major', name: 'Kignit Tezeta (major variant)' },
    { id: 'kignit_tezeta_minor', name: 'Kignit Tezeta (minor variant)' },
    { id: 'kignit_bati_major', name: 'Kignit Bati (major variant)' },
    { id: 'kignit_bati_minor', name: 'Kignit Bati (minor variant)' },
    { id: 'kignit_ambassel', name: 'Kignit Ambassel' },
    { id: 'kignit_anchihoye', name: 'Kignit Anchihoye' },
    { id: 'sintir_three_string_ddg', name: 'Sintir three-string D-D-G (or C-C-F)' },
    { id: 'samba_2_4_telecoteco', name: 'Samba 2/4 with telecoteco / partido-alto feel' },
    { id: 'choro_2_4_syncopated', name: 'Choro 2/4 with characteristic syncopation' },
    { id: 'baiao_2_4_beat_one_bass', name: 'Baião 2/4 with zabumba-on-beat-1 bass' },
    { id: 'frevo_2_4_fast', name: 'Frevo 2/4 fast carnival-march feel' },
    { id: 'maracatu_nacao_4_4', name: 'Maracatu nação 4/4 with alfaia foundation' },
    { id: 'capoeira_berimbau_toques', name: 'Capoeira berimbau toques (rhythmic modal patterns)' },
    { id: 'gamelan_slendro', name: 'Gamelan slendro (5-tone, near-equidistant)' },
    { id: 'gamelan_pelog', name: 'Gamelan pelog (7-tone, unequal)' },
    { id: 'japanese_in_scale', name: 'Japanese in scale (semitone-containing, sad)' },
    { id: 'japanese_yo_scale', name: 'Japanese yo scale (no semitones, bright)' },
    { id: 'chinese_pentatonic_gong', name: 'Chinese pentatonic (wuyin scale)' },
    { id: 'korean_jeongak_modes', name: 'Korean jeongak modes (gye-myeon-jo / pyeong-jo)' },
    { id: 'korean_minsogak_modes', name: 'Korean minsogak modes (sanjo / pansori scales)' },
    {
      id: 'mongolian_khoomei_harmonic',
      name: 'Mongolian / Tuvan khoomei harmonic-overtone vocabulary',
    },
    { id: 'tibetan_chant_multiphonic', name: 'Tibetan Gyuto / Gyume multiphonic chant' },
    { id: 'thai_seven_equal', name: 'Thai seven-equal tuning (saep song chan)' },
    { id: 'son_clave_3_2', name: 'Son clave 3-2 forward' },
    { id: 'son_clave_2_3', name: 'Son clave 2-3 reverse' },
    { id: 'rumba_clave_3_2', name: 'Rumba clave 3-2 (delayed 4-side strike)' },
    { id: 'tango_4_4_with_compas', name: 'Tango 4/4 with marcato compás' },
    { id: 'milonga_2_4_ostinato', name: 'Milonga 2/4 with ostinato bass' },
    { id: 'cumbia_4_4_paseo', name: 'Cumbia 4/4 paseo feel' },
    { id: 'vallenato_four_airs', name: 'Vallenato four airs (paseo, son, merengue, puya)' },
    { id: 'mariachi_son_6_8_3_4', name: 'Mariachi son jalisciense 6/8 + 3/4 hemiola' },
    { id: 'ranchera_3_4_and_2_4', name: 'Ranchera 3/4 vals and 2/4 polka subforms' },
    { id: 'merengue_2_4_perico_ripiao', name: 'Merengue 2/4 perico ripiao' },
    { id: 'bachata_4_4_bongo_pickup', name: 'Bachata 4/4 with bongo pickup' },
    { id: 'huayno_2_4_andean', name: 'Huayno 2/4 Andean pentatonic dance' },
    { id: 'joropo_3_4_corrido_hemiola', name: 'Joropo 3/4 corrido with hemiola' },
    { id: 'jazz_swing_eighth_4_4', name: 'Jazz swing-eighth 4/4' },
    { id: 'bebop_complex_changes', name: 'Bebop complex chord-change vocabulary' },
    { id: 'modal_jazz_dorian_static', name: 'Modal jazz Dorian-and-other static-mode framework' },
    { id: 'free_jazz_no_changes', name: 'Free jazz no-changes framework' },
    { id: 'latin_jazz_clave_overlay', name: 'Latin jazz clave-overlay framework' },
    {
      id: 'folk_fingerstyle_alternating_bass',
      name: 'Folk fingerstyle alternating-bass (Travis picking)',
    },
    {
      id: 'open_tuning_singer_songwriter',
      name: 'Open-tuning singer-songwriter vocabulary (DADGAD, CGDGCD, open D, open G)',
    },
    { id: 'americana_train_beat_4_4', name: 'Americana train-beat 4/4' },
    {
      id: 'american_primitive_open_drone',
      name: 'American primitive open-tuning drone-raga framework',
    },
    {
      id: 'gothic_americana_minor_modal',
      name: 'Gothic Americana minor-modal Old-Testament vocabulary',
    },
    {
      id: 'folk_noir_aeolian_phrygian_chamber',
      name: 'Folk noir Aeolian-Phrygian chamber-folk framework',
    },
    { id: 'rb_shuffle_swing_12_8', name: 'R&B shuffle 12/8 swing-feel blues-ballad framework' },
    {
      id: 'motown_four_on_floor_tambourine',
      name: 'Motown four-on-floor with tambourine on 2 and 4',
    },
    { id: 'funk_one_drop_syncopated_4_4', name: 'Funk one-and-the-three syncopated 4/4' },
    { id: 'doo_wop_changes_50s', name: 'Doo-wop changes 1950s I-vi-IV-V progression' },
    {
      id: 'flamenco_compas_12_beat',
      name: 'Flamenco compás 12-beat cycles (soleá, bulería, alegrías, seguiriya)',
    },
    { id: 'byzantine_oktoechos_eight_modes', name: 'Byzantine oktoechos eight-mode system' },
    {
      id: 'celtic_irish_modal_dorian_mixolydian',
      name: 'Celtic Irish modal vocabulary (Dorian and Mixolydian dominant)',
    },
    { id: 'rebetiko_eastern_modal_dromos', name: 'Rebetiko Eastern modal dromos system' },
    {
      id: 'nordic_modal_drone_double_stops',
      name: 'Nordic folk modal drone-and-double-stops vocabulary',
    },
    {
      id: 'balkan_odd_meter_aksak',
      name: 'Balkan odd-meter aksak vocabulary (7/8, 9/8, 11/8, 13/8)',
    },
    {
      id: 'klezmer_freygish_ahava_raba_modes',
      name: 'Klezmer freygish / ahava raba modal vocabulary',
    },
    {
      id: 'russian_minor_estrada_chanson',
      name: 'Russian minor-key estrada / shanson harmonic vocabulary',
    },
    { id: 'soukous_rumba_seben_4_4', name: 'Congolese rumba / soukous chanson-then-seben form' },
    { id: 'swahili_taarab_eastern_modal', name: 'Swahili taarab Eastern modal vocabulary' },
    { id: 'mande_pentatonic_jeli_modal', name: 'Mande pentatonic jeli modal vocabulary' },
    {
      id: 'yoruba_juju_fuji_polyrhythmic',
      name: 'Yoruba juju / fuji polyrhythmic talking-drum vocabulary',
    },
    { id: 'iraqi_maqam_jazil_baghdadi', name: 'Iraqi maqam jazil (Baghdadi maqam school)' },
    { id: 'andalusi_nuba_eleven_mode_cycle', name: 'Moroccan Andalusī nūba eleven-mode cycle' },
    {
      id: 'hindustani_thaat_alap_jod_jhala',
      name: 'Hindustani thaat-system raga performance form (alap-jod-jhala-gat)',
    },
    {
      id: 'carnatic_72_melakarta_kriti_form',
      name: 'Carnatic 72-melakarta scale-system kriti performance form',
    },
    {
      id: 'caribbean_jamaican_riddim_one_drop_and_steppers',
      name: 'Jamaican riddim vocabulary (one-drop, steppers, rockers, rub-a-dub)',
    },
    { id: 'trinidad_calypso_soca_2_4', name: 'Trinidad calypso / soca 2/4 rhythmic vocabulary' },
    { id: 'haitian_kompa_meringue', name: 'Haitian kompa-direkt meringue rhythm' },
    {
      id: 'hard_rock_metal_blues_pentatonic_power_chords',
      name: 'Hard rock / metal blues-pentatonic-and-power-chords vocabulary',
    },
    { id: 'doom_sabbath_tritone_diminished', name: 'Doom metal tritone / diminished vocabulary' },
    {
      id: 'shoegaze_dream_pop_chromatic_modal',
      name: 'Shoegaze / dream pop chromatic-modal vocabulary',
    },
    {
      id: 'country_nashville_three_chord_train_beat',
      name: 'Country Nashville three-chord train-beat vocabulary',
    },
    {
      id: 'bluegrass_high_lonesome_pentatonic',
      name: 'Bluegrass high-lonesome pentatonic vocabulary',
    },
    { id: 'rockabilly_50s_walking_bass_slap', name: 'Rockabilly 1950s walking-bass slap rhythm' },
    {
      id: 'iberian_kantautor_minority_language_modal',
      name: 'Iberian kantautor minority-language modal vocabulary',
    },
    {
      id: 'sephardi_chassidic_jewish_modal_modes',
      name: 'Sephardi / Hasidic / Cantorial Jewish modal vocabulary',
    },
    {
      id: 'mediterranean_traditional_polyphonic_modal',
      name: 'Mediterranean traditional polyphonic-modal vocabulary',
    },
    {
      id: 'andean_colombian_bambuco_6_8',
      name: 'Andean Colombian bambuco / pasillo 6/8 vocabulary',
    },
    {
      id: 'pan_latin_bolero_2_4_romantic_ballad',
      name: 'Pan-Latin bolero 2/4 romantic ballad vocabulary',
    },
    {
      id: 'tin_pan_alley_thirty_two_bar_aaba',
      name: 'Tin Pan Alley 32-bar AABA song form vocabulary',
    },
    {
      id: 'hip_hop_breakbeat_sample_collage_boom_bap',
      name: 'Hip-hop breakbeat sample-collage boom-bap vocabulary',
    },
    {
      id: 'west_north_african_mbalax_rai_polyrhythmic',
      name: 'West / North African mbalax / rai polyrhythmic vocabulary',
    },
    {
      id: 'southeast_asian_pentatonic_popular_vocal',
      name: 'Southeast Asian pentatonic popular-vocal vocabulary',
    },
    { id: 'istrian_scale', name: 'Istrian scale (Croatian non-tempered six-tone)' },
    {
      id: 'lithuanian_sutartines_seconds',
      name: 'Lithuanian sutartinės parallel-seconds vocabulary',
    },
    { id: 'coptic_microtonal', name: 'Coptic Orthodox microtonal modal system' },
    {
      id: 'mongolian_pentatonic_long_song',
      name: 'Mongolian pentatonic long-song modal vocabulary',
    },
    { id: 'ethio_qenet_unified', name: 'Ethiopian qenet pentatonic mode-system' },
    {
      id: 'sami_narrow_range_pentatonic',
      name: 'Sámi narrow-range pentatonic-leaning yoik vocabulary',
    },
    { id: 'aural_relative', name: 'Performer-relative intonation' },
    { id: 'unpitched_percussion', name: 'Unpitched percussion' },
  ],
  room: [
    { id: 'parlor', name: 'Front parlor (period furniture, rugs, drapes)' },
    { id: 'carpeted_bedroom', name: 'Carpeted bedroom' },
    { id: 'hardwood_living', name: 'Hardwood-floor living room' },
    { id: 'tile_kitchen', name: 'Kitchen (tile floor, hard counters)' },
    { id: 'tile_bathroom', name: 'Tile bathroom' },
    { id: 'closet_booth', name: 'Closet (vocal booth makeshift)' },
    { id: 'stairwell_concrete', name: 'Stairwell (concrete-and-steel)' },
    { id: 'hallway', name: 'Hallway' },
    { id: 'treated_studio', name: 'Treated recording studio (dead booth)' },
    { id: 'live_room', name: 'Treated live room (reflective but controlled)' },
    { id: 'untreated_bedroom', name: 'Untreated bedroom studio' },
    { id: 'jazz_club', name: 'Speakeasy / jazz club (low-ceilinged)' },
    {
      id: 'honky_tonk_dance_hall',
      name: 'Honky-tonk / dance hall (long rectangular wood-paneled)',
    },
    { id: 'pentecostal_storefront_church', name: 'Pentecostal storefront church' },
    { id: 'am_radio_booth', name: 'AM radio booth / broadcast booth' },
    { id: 'irish_pub', name: 'Irish pub (interior, low ceiling, full of drinkers)' },
    { id: 'cathedral', name: 'Cathedral (stone gothic)' },
    { id: 'stone_parish_church', name: 'Stone parish church' },
    { id: 'wooden_country_church', name: 'Wooden country church' },
    { id: 'wooden_barn', name: 'Wooden barn (large, hayloft)' },
    { id: 'tin_roofed_shack', name: 'Tin-roofed shack' },
    { id: 'concrete_basement', name: 'Concrete basement' },
    { id: 'concert_hall_shoebox', name: 'Treated concert hall (shoebox)' },
    { id: 'gymnasium', name: 'Gymnasium (high school)' },
    { id: 'subway_tunnel', name: 'Subway tunnel' },
    { id: 'adobe_room', name: 'Adobe room' },
    { id: 'tape_echo_chamber', name: 'Tape echo chamber (purpose-built reflective room)' },
    { id: 'open_prairie', name: 'Open prairie / open field' },
    { id: 'bayou_porch', name: 'Bayou porch (rocking chair on)' },
    { id: 'beach', name: 'Beach (oceanfront)' },
    { id: 'forest_clearing', name: 'Forest clearing' },
    { id: 'mountain_valley', name: 'Mountain valley' },
    { id: 'festival_stage', name: 'Outdoor festival stage (PA reinforced)' },
    { id: 'field_recording', name: 'Field recording (handheld, ambient)' },
    { id: 'truck_cab', name: 'Truck cab (interior, driving)' },
    { id: 'phone_codec', name: "Phone line / call (codec'd)" },
    { id: 'walkie_talkie', name: 'Walkie-talkie / shortwave' },
    { id: 'cassette_tape', name: 'Cassette tape (medium, doubling as space)' },
    { id: 'inside_piano', name: 'Inside a piano (sustain pedal down)' },
    { id: 'canyon', name: 'Canyon / amphitheatre rock-walls' },
    { id: 'urban_courtyard', name: 'Urban courtyard (between buildings)' },
    { id: 'ice_glacier', name: 'Ice cave / glacier surface' },
    { id: 'marsh_swamp', name: 'Marsh / wetland lowland' },
    { id: 'airpod_bluetooth_codec', name: 'Wireless earbud / Bluetooth codec' },
    { id: 'boombox_portable_speaker', name: 'Boombox / portable speaker' },
    {
      id: 'studio_electrical_era_office',
      name: 'Electrical-era converted-office studio (1925–45)',
    },
    { id: 'studio_swing_live_room', name: 'Swing-era large live tracking room (1935–55)' },
    { id: 'studio_early_tape_us_small', name: 'Early-tape American small commercial (1948–65)' },
    { id: 'studio_small_la_chambers', name: 'Small-LA studio with reverb chambers (1958–70)' },
    {
      id: 'studio_multitrack_flagship_us_80s',
      name: 'Multitrack flagship American studio (1985–2000)',
    },
    {
      id: 'studio_british_class_a_commercial',
      name: 'British class-A commercial studio (1965–85)',
    },
    { id: 'studio_uk_small_60s_commercial', name: 'Small London commercial studio (1962–1968)' },
    { id: 'studio_la_rock_70s_90s', name: 'LA mid-major rock commercial (1970–95)' },
    { id: 'studio_emi_lagos_african', name: 'EMI Lagos / African commercial (1965–85)' },
    { id: 'studio_late70s_nyc_commercial', name: 'Late-70s NYC commercial (1975–85)' },
    { id: 'studio_indie_commercial_us_80s', name: 'American indie-commercial mid-80s (1980–2000)' },
    { id: 'studio_pacnw_commercial_indie', name: 'Pacific Northwest commercial-rock (1985–2005)' },
    {
      id: 'studio_toe_rag_vintage_revival',
      name: 'Vintage-revival small-analog studio (1995–pres)',
    },
    { id: 'studio_isolation_cabin_diy', name: 'Remote-isolation cabin / rural DIY (2005–pres)' },
    {
      id: 'studio_atlanta_trap_commercial',
      name: 'Atlanta trap-production commercial (2010–pres)',
    },
    { id: 'studio_kpop_idol_complex', name: 'K-pop idol-pop production complex (2010–pres)' },
    { id: 'studio_auteur_home_pro', name: 'Auteur professional-grade home studio' },
    {
      id: 'studio_distributed_production',
      name: 'Cross-continental distributed production (2015–pres)',
    },
    {
      id: 'cement_block_broadcast_booth',
      name: 'Saharan broadcast-station booth (Kidal/Tamanrasset)',
    },
    { id: 'open_courtyard_stone_wall_ambient', name: 'Saharan stone-walled village courtyard' },
    { id: 'outdoor_desert_anechoic', name: 'Outdoor Saharan plateau (anechoic-leaning)' },
    { id: 'stone_plaster_medina_room', name: 'North-African medina stone-and-plaster room' },
    {
      id: 'intimate_paris_small_studio',
      name: 'Intimate Paris small-studio (Lusafrica 1988–2011)',
    },
    { id: 'addis_radio_clandestine_studio', name: 'Addis Ababa radio/private studio (1969–74)' },
    { id: 'port_of_spain_community_studio', name: 'Port of Spain community studio (1979–pres)' },
    { id: 'brent_black_community_studio_london', name: 'Brent Black Music Co-Op (London 1980s)' },
    {
      id: 'phonogram_brasil_studio',
      name: 'Phonogram / Philips Brasil studio (Rio + SP, 1965–1985)',
    },
    { id: 'estudios_scatena_sp', name: 'Estúdios Scatena (São Paulo, 1967–1970s)' },
    { id: 'estudio_rozenblit_recife', name: 'Mocambo / Rozenblit Recife studio (1954–mid-1980s)' },
    { id: 'bahian_terreiro_outdoor', name: 'Bahian terreiro (Salvador, candomblé ritual)' },
    { id: 'escola_samba_quadra', name: 'Escola de samba quadra (Rio, outdoor rehearsal)' },
    { id: 'roda_capoeira_outdoor', name: 'Roda de capoeira (outdoor circle)' },
    { id: 'rio_favela_home_baile_funk', name: 'Rio favela home-production (baile funk)' },
    { id: 'javanese_pendopo_pavilion', name: 'Javanese pendopo (traditional gamelan pavilion)' },
    { id: 'balinese_banjar_courtyard', name: 'Balinese banjar / pura courtyard' },
    { id: 'tatami_parlor_japanese', name: 'Tatami parlor (Japanese chamber / honkyoku)' },
    { id: 'noh_stage_japanese', name: 'Noh stage (Japanese ritual theater)' },
    { id: 'kabuki_theater_japanese', name: 'Kabuki theater (Edo-Tokyo classical)' },
    { id: 'mongolian_ger_interior', name: 'Mongolian ger (yurt) interior' },
    { id: 'steppe_outdoor_mongolian', name: 'Mongolian steppe outdoor' },
    { id: 'tibetan_monastery_assembly', name: 'Tibetan monastery assembly hall (du-khang)' },
    { id: 'chinese_traditional_teahouse', name: 'Chinese traditional teahouse (chaguan)' },
    { id: 'shanghai_emi_pathe_1930s', name: 'Shanghai EMI Pathé / Great China studio (1930s-40s)' },
    {
      id: 'tokyo_studio_1970s_80s',
      name: 'Tokyo major-label studio (CBS Sony / Victor 1970s-80s)',
    },
    {
      id: 'hong_kong_cantopop_studio_80s',
      name: 'Hong Kong cantopop studio (PolyGram / Capital Artists 1980s)',
    },
    { id: 'korean_gugak_hall', name: 'Korean gugak hall (National Gugak Center class)' },
    { id: 'estudios_areito_havana', name: 'Estudios Areíto / EGREM Havana (1962–present)' },
    {
      id: 'panart_puchito_havana_pre_1959',
      name: 'Panart / Puchito / RCA Cuba pre-revolutionary Havana (1944–1960)',
    },
    {
      id: 'havana_solar_outdoor_courtyard',
      name: 'Havana solar courtyard (rumba outdoor folkloric)',
    },
    {
      id: 'fania_la_tierra_studios_ny',
      name: 'Fania / La Tierra / Good Vibrations NY studios (1968-1977)',
    },
    {
      id: 'odeon_rca_buenos_aires',
      name: 'Odeon / RCA Victor Argentina Buenos Aires (1920s-1960s)',
    },
    {
      id: 'mexico_peerless_musart_50s_60s',
      name: 'Mexico City Peerless / Musart / RCA Mexicana (1950s-60s)',
    },
    {
      id: 'plaza_garibaldi_outdoor_mariachi',
      name: 'Plaza Garibaldi outdoor (Mexico City mariachi tradicional)',
    },
    {
      id: 'discos_fuentes_medellin',
      name: 'Discos Fuentes Medellín (1934-onward, Colombian Caribbean canon)',
    },
    {
      id: 'andean_altiplano_outdoor',
      name: 'Andean altiplano outdoor (huayno / sikuri field context)',
    },
    {
      id: 'dominican_capital_studio_80s',
      name: 'Santo Domingo / Karen Records / Kubaney studio (1970s-80s)',
    },
    {
      id: 'van_gelder_englewood_cliffs',
      name: 'Englewood Cliffs cedar-vaulted jazz studio NJ (1959-2016)',
    },
    { id: 'van_gelder_hackensack', name: 'Hackensack parents living-room studio NJ (1944-1959)' },
    {
      id: 'columbia_30th_street_studio_nyc',
      name: 'Columbia converted-church studio NYC (1949-1981)',
    },
    {
      id: 'plaza_sound_radio_city_nyc',
      name: 'Plaza Sound at Radio City Music Hall NYC (1949-1980s)',
    },
    {
      id: 'a_and_r_recording_nyc',
      name: 'A&R Recording NYC (jazz-vocal engineering flagship, 1958-1990s)',
    },
    {
      id: 'capitol_tower_studios_la',
      name: 'Capitol Records Tower Studios Hollywood (1956-present)',
    },
    {
      id: 'strata_east_loft_nyc',
      name: 'Strata-East Records loft / Brooklyn loft jazz (1971-mid-1970s)',
    },
    {
      id: 'sunset_sound_studios_hollywood',
      name: 'Sunset Sound Recorders Hollywood (1958-present)',
    },
    {
      id: 'wally_heider_studios_sf',
      name: 'San Francisco Bay Area rock studio (late-60s/70s flagship, 1969-1980)',
    },
    {
      id: 'a_and_m_studios_hollywood',
      name: 'A&M Studios (converted film-studio lot) Hollywood (1966-1999)',
    },
    {
      id: 'the_village_recorder_west_la',
      name: 'The Village Recorder West Los Angeles (1968-present)',
    },
    { id: 'caribou_ranch_colorado', name: 'Caribou Ranch Studio Colorado (1972-1985)' },
    { id: 'electric_lady_studios_nyc', name: 'Electric Lady Studios NYC (1970-present)' },
    {
      id: 'studio_in_the_country_bogalusa',
      name: 'Studio in the Country Bogalusa Louisiana (1973-present)',
    },
    {
      id: 'takoma_home_recording_fahey',
      name: 'Takoma home recording — parlor / Berkeley portable Ampex (1959-1975)',
    },
    {
      id: 'hexham_head_studio_pa_chamber_folk',
      name: 'Hexham Head chamber-folk studio (mid-2000s onward, Pennsylvania)',
    },
    {
      id: 'denver_gothic_basement_studio',
      name: 'Denver Gothic basement / DIY indie studio (mid-1990s onward)',
    },
    { id: 'stax_studio_memphis', name: 'Stax Records Studio A Memphis (1957-1975)' },
    { id: 'fame_studios_muscle_shoals', name: 'FAME Studios Muscle Shoals (1959-present)' },
    { id: 'muscle_shoals_sound_studio', name: 'Muscle Shoals Sound Studio (1969-1979)' },
    {
      id: 'sigma_sound_studios_philadelphia',
      name: 'Sigma Sound Studios Philadelphia (1968-2003)',
    },
    {
      id: 'hitsville_usa_motown_detroit',
      name: 'Hitsville USA Motown Studio A Detroit (1959-1972, the Snakepit)',
    },
    { id: 'atlantic_studios_nyc', name: 'Atlantic Studios NYC (1947-1976)' },
    { id: 'king_records_studios_cincinnati', name: 'King Records Studios Cincinnati (1943-1971)' },
    { id: 'chess_studios_chicago', name: 'Chess Studios Chicago (1957-1975)' },
    {
      id: 'lisbon_alfama_fado_tavern',
      name: 'Lisbon Alfama fado tavern (Casa de Fados, 1920s onward)',
    },
    {
      id: 'coimbra_university_outdoor_quad',
      name: 'Coimbra university outdoor quad / Sé Velha steps (fado de Coimbra)',
    },
    {
      id: 'andalusian_tablao_seville_madrid',
      name: 'Andalusian flamenco tablao (Seville / Granada / Madrid)',
    },
    {
      id: 'athens_piraeus_rebetadika',
      name: 'Athens / Piraeus rebetadika tekes-and-koutoukia (1920s-1940s)',
    },
    {
      id: 'athens_minos_studios_60s_70s',
      name: 'Athens Minos / Columbia Greece / Lyra studios (1955-1985)',
    },
    {
      id: 'byzantine_monastery_chant_athos',
      name: 'Mount Athos Byzantine monastery chant context',
    },
    {
      id: 'prague_supraphon_studio',
      name: 'Prague Supraphon Mozarteum studio (1948-onward, Czech national label)',
    },
    {
      id: 'polish_polskie_nagrania_muza',
      name: 'Warsaw Polskie Nagrania Muza studios (1956-1990)',
    },
    {
      id: 'irish_pub_doolin_clare_session',
      name: 'Irish pub session room (Doolin / Clare / Galway 1970s-onward)',
    },
    { id: 'connemara_kitchen_sean_nos', name: 'Connemara / Donegal kitchen sean-nós context' },
    {
      id: 'uk_folk_revival_club_60s',
      name: 'UK folk-revival club circuit (London Soho / Newcastle / Manchester 1960s-70s)',
    },
    {
      id: 'scottish_bothy_farmhouse_kitchen',
      name: 'Scottish bothy farmhouse kitchen (Aberdeenshire Doric tradition)',
    },
    {
      id: 'cajun_dance_hall_acadia_louisiana',
      name: 'Cajun French Louisiana dance hall (Lafayette / Eunice / Mamou 1940s-onward)',
    },
    {
      id: 'german_liedermacher_kabarett_berlin',
      name: 'Berlin Kabarett / Liedermacher song-cabaret studio (1920s and 1970s onward)',
    },
    {
      id: 'bulgarian_state_radio_choir_hall',
      name: 'Bulgarian State Radio hall Sofia (1952-onward, female-choir polyphony context)',
    },
    {
      id: 'norwegian_hardanger_outdoor_alpine',
      name: 'Norwegian Hardanger fjord outdoor / barn context',
    },
    { id: 'sapmi_outdoor_tundra_yoik', name: 'Sápmi outdoor tundra / lavvu context (Sámi yoik)' },
    {
      id: 'moscow_melodiya_studio',
      name: 'Moscow Melodiya state studio (1964-1991, then 1991-onward)',
    },
    {
      id: 'klezmer_simcha_celebration_hall',
      name: 'Klezmer simcha celebration hall (Eastern European Jewish wedding context)',
    },
    {
      id: 'budapest_carpathian_csarda_tavern',
      name: 'Budapest / Carpathian csárda tavern (Hungarian and Romanian taraf context)',
    },
    {
      id: 'lagos_decca_west_african_studio',
      name: 'Decca West African studios (Lagos / Accra 1947-1975)',
    },
    {
      id: 'kinshasa_african_jazz_studio',
      name: 'Kinshasa / Brazzaville Congolese studios (1953-onward, Congolese rumba canon)',
    },
    {
      id: 'paris_pathe_marconi_african_diaspora',
      name: 'Paris Pathé-Marconi / Sonima / Studio Marcadet (1970s-1990s Francophone African diaspora)',
    },
    {
      id: 'johannesburg_gallo_african_studios',
      name: 'Johannesburg Gallo African Studios (1932-onward, all SA canon)',
    },
    {
      id: 'dar_es_salaam_zanzibar_taarab_culture_club',
      name: 'Dar es Salaam / Zanzibar taarab culture-club (1905-onward)',
    },
    {
      id: 'harare_zimbabwean_chimurenga_studio',
      name: 'Harare / Salisbury Zimbabwean studios (1970s-onward, chimurenga and Zimbabwean pop)',
    },
    {
      id: 'bamako_griot_jeli_compound',
      name: 'Bamako / Kayes Mande griot (jeli) compound (timeless, courtyard tradition)',
    },
    {
      id: 'cairo_studio_misr_umm_kulthum_era',
      name: 'Cairo Studio Misr / Sono Cairo (1934-onward, golden-age tarab era)',
    },
    {
      id: 'tehran_classical_dastgah_context',
      name: 'Tehran Persian classical dastgāh context (Conservatoire Studios + private salons)',
    },
    {
      id: 'istanbul_makam_kilic_ali_pasha_studio',
      name: 'Istanbul makam classical and arabesk studio (Plak / Kervan / Türkofon labels 1955-onward)',
    },
    {
      id: 'baghdad_iraqi_maqam_context',
      name: 'Baghdad Iraqi maqam context (chalghi ensemble at private and broadcast studios 1932-2003)',
    },
    {
      id: 'fez_andalusi_palace_riad',
      name: 'Fez / Tetouan Andalusi palace and riad context (Andalusī nūba and malhun)',
    },
    {
      id: 'casablanca_chaabi_moroccan_studio',
      name: 'Casablanca / Marrakech Moroccan chaabi popular studios (1970s-onward)',
    },
    {
      id: 'yerevan_armenian_komitas_studio',
      name: 'Yerevan Armenian Komitas conservatoire context (1923-onward)',
    },
    {
      id: 'kolkata_hmv_dum_dum_studio',
      name: 'Kolkata HMV Dum Dum studio (1928-onward, the Gramophone Company of India)',
    },
    {
      id: 'mumbai_bombay_filmi_studio',
      name: 'Mumbai / Bombay filmi recording studios (1940s-onward, Mehboob / Famous playback context)',
    },
    {
      id: 'chennai_madras_music_academy_sabha',
      name: 'Chennai Music Academy sabha context (1928-onward Carnatic concert tradition)',
    },
    {
      id: 'varanasi_benares_gharana_baithak',
      name: 'Varanasi / Benares gharana baithak (Hindustani classical salon context)',
    },
    {
      id: 'vrindavan_braj_mandir_bhajan',
      name: 'Vrindavan / Braj mandir bhajan context (Krishna devotional)',
    },
    {
      id: 'golden_temple_amritsar_gurdwara',
      name: 'Golden Temple Amritsar gurdwara (Harmandir Sahib Sikh Gurmat Sangeet)',
    },
    {
      id: 'punjab_village_bhangra_dhol_outdoor',
      name: 'Punjab village bhangra dhol outdoor (harvest celebration context)',
    },
    { id: 'kingston_studio_one_brentford_road', name: 'Studio One Kingston (1959-2004)' },
    {
      id: 'kingston_king_tubby_dub_workshop',
      name: 'Waterhouse dub mixing workshop Kingston (1968-1989)',
    },
    {
      id: 'kingston_channel_one_maxfield_avenue',
      name: 'Channel One Studios Kingston (1972-1985, roots-reggae house-band room)',
    },
    {
      id: 'port_au_prince_haitian_kompa_studio',
      name: 'Port-au-Prince Haitian kompa studio (Mini Records / Marc Records 1970s-1990s)',
    },
    {
      id: 'trinidad_calypso_panyard_outdoor',
      name: 'Trinidad calypso panyard / Carnival mas-camp (community context)',
    },
    {
      id: 'haitian_vodou_lakou_outdoor_peristyle',
      name: 'Haitian vodou lakou outdoor peristyle (compound ceremony context)',
    },
    {
      id: 'brixton_uk_lovers_rock_basement',
      name: 'Brixton / London UK lovers rock basement studio (1976-1985)',
    },
    {
      id: 'uk_70s_hard_rock_arena_studio',
      name: 'UK 70s hard rock / progressive / NWOBHM arena studio (Olympic / Trident / Sarm 1968-1985)',
    },
    {
      id: 'seattle_reciprocal_grunge_studio',
      name: 'Seattle Reciprocal Recording / Bear Creek grunge studios (1986-1995)',
    },
    {
      id: 'stoner_doom_garage_amplifier_room',
      name: 'Stoner / doom / sludge / post-metal amplifier-garage studio (Electrical Audio + scattered amplifier-worshipping rooms)',
    },
    {
      id: 'gothenburg_swedish_melodic_death_studio',
      name: 'Gothenburg Swedish melodic death / atmospheric black metal studios (Studio Fredman / Studio Mega 1992-onward)',
    },
    {
      id: 'dream_pop_shoegaze_4ad_studio',
      name: 'UK shoegaze / dream pop 4AD / Creation studios (1986-1995)',
    },
    {
      id: 'bay_area_thrash_metal_studio',
      name: 'San Francisco Bay Area thrash metal studios (Music Annex / Prairie Sun 1983-1991)',
    },
    {
      id: 'krautrock_dusseldorf_kling_klang_studio',
      name: 'Düsseldorf / Cologne krautrock studios (Kling Klang / Wolperath 1968-1980)',
    },
    {
      id: 'nashville_rca_studio_b_quonset_hut',
      name: 'Nashville RCA Studio B / Quonset Hut / Columbia Studio A (1957-onward)',
    },
    { id: 'sun_studios_memphis_706_union', name: 'Sun Studios Memphis (1950-1968)' },
    {
      id: 'bristol_sessions_appalachian_pre_commercial',
      name: 'Bristol Sessions Appalachian pre-commercial context (1927 onward)',
    },
    {
      id: 'lafayette_louisiana_zydeco_dance_hall',
      name: 'Lafayette Louisiana zydeco dance hall (Black Creole French Louisiana)',
    },
    {
      id: 'us_dustbowl_outdoor_woody_guthrie',
      name: 'US Dust Bowl outdoor / Library of Congress field recording context (1930s-40s)',
    },
    {
      id: 'southern_black_church_gospel_choir',
      name: 'Southern Black Pentecostal / Baptist church gospel choir (Memphis / Chicago / New Orleans)',
    },
    {
      id: 'southern_white_church_gospel_quartet',
      name: 'Southern White Baptist church gospel quartet (shape-note publishing tradition)',
    },
    {
      id: 'iberian_kantautor_basque_galician_club',
      name: 'Iberian minority-language kantautor club / café context (Bilbao / Santiago / Barcelona)',
    },
    {
      id: 'balkan_sevdalinka_kafana_tavern',
      name: 'Bosnian / Balkan sevdalinka kafana tavern (Sarajevo / Mostar / Banja Luka)',
    },
    {
      id: 'eastern_european_chassidic_farbrengen',
      name: 'Eastern European Hasidic farbrengen (synagogue / Rebbes court / dining hall)',
    },
    {
      id: 'mediterranean_sephardi_synagogue',
      name: 'Mediterranean Sephardi synagogue (Aleppo / Salonica / Tetouan / Sarajevo)',
    },
    {
      id: 'scottish_galician_piping_outdoor',
      name: 'Scottish Highland / Galician outdoor piping context (piobaireachd and gaita)',
    },
    {
      id: 'brittany_fest_noz_outdoor',
      name: 'Brittany fest-noz outdoor (Breton kan ha diskan dance context)',
    },
    {
      id: 'sardinian_outdoor_a_tenore_polyphony',
      name: 'Sardinian outdoor a-tenore polyphony (village square context)',
    },
    {
      id: 'naples_canzone_napoletana_studio',
      name: 'Naples canzone napoletana studio / Piedigrotta festival (1839-onward)',
    },
    {
      id: 'san_juan_puerto_rican_bomba_plena_yard',
      name: 'San Juan Puerto Rican bomba / plena outdoor yard (Loíza / Ponce / Santurce context)',
    },
    {
      id: 'montevideo_candombe_barrio_sur_carnival',
      name: 'Montevideo candombe Barrio Sur / Palermo Carnival outdoor (Llamadas tradition)',
    },
    {
      id: 'recife_brazilian_northeast_forro_house',
      name: 'Recife / Northeast Brazilian forró house and outdoor (Sertão context)',
    },
    {
      id: 'mexico_bolero_xochimilco_studio',
      name: 'Mexico City / Havana bolero recording studio (RCA Victor Mexicana / Panart 1930s-1960s)',
    },
    {
      id: 'bogota_colombian_andean_studio',
      name: 'Bogotá Colombian Andean string-trio studio (Bambuco / pasillo / torbellino context)',
    },
    {
      id: 'nyc_brill_building_tin_pan_alley',
      name: 'NYC Brill Building / Tin Pan Alley songwriting infrastructure (c. 1885-1965)',
    },
    {
      id: 'paris_french_rap_studio',
      name: 'Paris / Marseille French rap studio (Banlieue / Cité context 1989-onward)',
    },
    {
      id: 'nyc_bronx_hip_hop_block_party_studio',
      name: 'NYC Bronx / Harlem hip-hop pioneer-studio context (Sugar Hill / Tommy Boy / Def Jam 1979-1991)',
    },
    {
      id: 'honolulu_hawaiian_slack_key_lanai',
      name: 'Honolulu / Hawaiian outdoor lanai (paniolo and post-1832 missionary-guitar context)',
    },
    {
      id: 'plains_northern_powwow_drum_circle_outdoor',
      name: 'Plains-Northern powwow drum-circle outdoor (Lakota / Dakota / Ojibwe pan-tribal context)',
    },
    {
      id: 'arctic_arnhem_indigenous_outdoor',
      name: 'Arctic / Arnhem Land Indigenous outdoor context (Inuit katajjaq / Yolngu yidaki ceremonial)',
    },
    {
      id: 'newfoundland_outport_kitchen_party',
      name: 'Newfoundland outport kitchen-party context (Irish-Scottish North Atlantic fishing-community tradition)',
    },
    {
      id: 'berlin_techno_kreuzberg_studio',
      name: 'Berlin techno / dub-techno / ambient studio (Tresor / Hardwax / Basic Channel 1991-onward)',
    },
    {
      id: 'dakar_mbalax_oran_rai_studio',
      name: 'Dakar mbalax / Oran rai West-North African popular studio',
    },
    {
      id: 'jakarta_bangkok_southeast_asian_studio',
      name: 'Jakarta dangdut / Bangkok mor lam / Hanoi Vietnamese chamber studio',
    },
    {
      id: 'karachi_lahore_naat_devotional_majlis',
      name: 'Karachi / Lahore naat devotional majlis context (Islamic devotional)',
    },
    {
      id: 'us_uk_civic_amateur_band_hall',
      name: 'US barbershop / UK brass band civic amateur band hall',
    },
    {
      id: 'shusha_garabagh_mugham_conservatory',
      name: 'Shusha / Garabagh mugham conservatory context (Azerbaijani classical canonical)',
    },
    {
      id: 'bukhara_shashmaqam_courtyard_chamber',
      name: 'Bukhara shashmaqam courtyard-chamber (Central Asian classical canonical)',
    },
    {
      id: 'kyrgyz_manaschi_outdoor_or_state_theater',
      name: 'Kyrgyz manaschi outdoor jailoo / Bishkek State Manas Theater (epic-recital canonical)',
    },
    {
      id: 'phnom_penh_royal_pinpeat_palace_court',
      name: 'Phnom Penh royal palace pinpeat / wat temple courtyard (Khmer classical canonical)',
    },
    {
      id: 'maori_marae_carved_wharenui',
      name: 'Maori marae carved wharenui meeting-house (Aotearoa/NZ ceremonial canonical)',
    },
    {
      id: 'hawaiian_heiau_outdoor_lava_stone_temple',
      name: 'Hawaiian heiau outdoor lava-stone temple platform (oli sacred-chant canonical)',
    },
    {
      id: 'addis_kazanchis_azmari_bet_tej_house',
      name: 'Addis Ababa Kazanchis azmari bet tej-honey-wine house (Ethiopian minstrel canonical)',
    },
    {
      id: 'open_steppe_outdoor',
      name: 'Open steppe / Mongolian-Kazakh-Kyrgyz pasture (urtiin duu canonical outdoor)',
    },
    { id: 'felt_walled_ger', name: 'Felt-walled Mongolian ger / Central Asian yurt interior' },
    {
      id: 'taiga_natural_reverb',
      name: 'Siberian taiga / cliff-face natural-reverb (Tuvan kargyraa-sygyt canonical)',
    },
    {
      id: 'wooden_balagan',
      name: 'Sakha balagan log-and-earth dwelling interior (olonkho canonical)',
    },
    {
      id: 'ainu_cise_wooden_interior',
      name: 'Ainu cise wooden dwelling interior (yukar epic canonical)',
    },
    {
      id: 'outdoor_kalahari_fire_circle',
      name: "Kalahari outdoor nocturnal fire-circle (Ju|'hoansi healing canonical)",
    },
    {
      id: 'eastern_cape_outdoor_grassland',
      name: 'Eastern Cape outdoor grassland (Xhosa umngqokolo canonical)',
    },
    {
      id: 'saharan_desert_encampment',
      name: 'Saharan desert encampment / tent-fabric near-field (Tuareg tendé canonical)',
    },
    {
      id: 'maasai_manyatta_outdoor',
      name: 'Maasai manyatta outdoor enclosure (adumu jumping-song canonical)',
    },
    {
      id: 'lalibela_rock_hewn_church',
      name: 'Lalibela rock-hewn church interior (Ethiopian Tewahedo zema canonical)',
    },
    {
      id: 'atlas_mountain_village_square',
      name: 'Atlas Mountain Berber village outdoor square (ahidus / ahwash canonical)',
    },
    {
      id: 'dalmatian_stone_alley',
      name: 'Dalmatian limestone narrow-street alley (Croatian klapa canonical)',
    },
    {
      id: 'outdoor_dalmatian_square',
      name: 'Outdoor stone-walled Adriatic-coast square (Istrian sopele canonical)',
    },
    {
      id: 'wooden_ca_tru_house',
      name: 'Vietnamese ca trù wooden house interior (canonical chamber)',
    },
    { id: 'wooden_pagoda_hall', name: 'Wooden Cambodian / East Asian pagoda hall' },
    {
      id: 'stone_armenian_church',
      name: 'Armenian Apostolic Church stone nave (duduk lament canonical)',
    },
    {
      id: 'mountain_valley_fabod',
      name: 'Mountain-valley fäbod summer pasture (Swedish kulning canonical)',
    },
    {
      id: 'palm_thatch_maloca',
      name: 'Amazonian palm-thatch maloca ceremonial hut (Shipibo icaros canonical)',
    },
    {
      id: 'ngillatun_clearing',
      name: 'Mapuche ngillatún sacred outdoor clearing (tayil ritual canonical)',
    },
    {
      id: 'marae_forecourt',
      name: 'Māori marae forecourt outdoor (karanga / pōwhiri / haka canonical)',
    },
    { id: 'qat_chew_majlis_room', name: 'Yemeni qat-chew majlis chamber (Sanaani song canonical)' },
    {
      id: 'coptic_basilica',
      name: 'Coptic Orthodox basilica stone-and-plaster nave (liturgical chant canonical)',
    },
    { id: 'nuba_courtyard_hall', name: 'Maghrebi Andalusi nuba courtyard / chamber-hall' },
    {
      id: 'sardinian_su_zilleri_stone_bar',
      name: 'Sardinian su zilleri stone-walled village bar (cantu a tenore canonical)',
    },
    {
      id: 'tibetan_gompa_assembly_hall',
      name: 'Tibetan Gelug gompa monastic assembly hall (yang chant canonical)',
    },
    {
      id: 'iraqi_baghdad_chamber',
      name: 'Iraqi maqam chamber / hall (chalghi ensemble canonical)',
    },
    {
      id: 'korean_pungnyu_pavilion',
      name: 'Korean wooden pungnyu pavilion (jeongak gagok canonical)',
    },
    {
      id: 'tanzanian_outdoor_village_clearing',
      name: 'Tanzanian central outdoor village clearing (Wagogo polyphony canonical)',
    },
    {
      id: 'manganiyar_haveli_courtyard',
      name: 'Rajasthani Manganiyar haveli courtyard (Thar Desert canonical)',
    },
    {
      id: 'baltic_outdoor_village',
      name: 'Baltic outdoor village pastoral setting (Lithuanian sutartinės canonical)',
    },
    {
      id: 'setu_farmhouse_wood',
      name: 'Setu wooden farmhouse interior (leelo polyphonic singing canonical)',
    },
    {
      id: 'iglu_community_hall',
      name: 'Inuit iglu / community hall (katajjaq throat-game canonical)',
    },
    {
      id: 'garifuna_beach_hall',
      name: 'Garifuna coastal beach / wooden community hall (paranda canonical)',
    },
    {
      id: 'terreiro_outdoor_yard',
      name: 'Brazilian terreiro outdoor yard (samba de roda canonical Recôncavo)',
    },
    { id: 'batuko_outdoor_village', name: 'Cape Verdean Santiago batuko outdoor village setting' },
    {
      id: 'tongan_outdoor_village_green',
      name: 'Tongan outdoor village green (lakalaka ceremonial canonical)',
    },
  ],
});
const fixtures = freeze([
  {
    initial: {
      instrumentId: 'oud',
      tuning: { value: null, descriptors: [] },
      room: { value: null, descriptors: [] },
    },
    tuningChosen: {
      instrumentId: 'oud',
      tuning: { value: 'twelve_tet', descriptors: ['Western'] },
      room: { value: null, descriptors: [] },
    },
    roomCleared: {
      instrumentId: 'oud',
      tuning: { value: 'twelve_tet', descriptors: ['Western'] },
      room: { value: null, descriptors: [] },
    },
  },
  {
    initial: {
      instrumentId: 'banjo_5_string',
      tuning: {
        value: 'bluegrass_high_lonesome_pentatonic',
        descriptors: [
          'bluegrass-high-lonesome-vocal',
          'pentatonic-and-mixolydian-mode-vocabulary',
          'three-finger-banjo-roll',
          'mandolin-chop-and-tremolo',
          'fiddle-cross-tuning-old-time',
          'breakdown-fast-tempo-200-bpm',
        ],
      },
      room: {
        value: 'bristol_sessions_appalachian_pre_commercial',
        descriptors: [
          'bristol-tennessee-virginia-border',
          'victor-talking-machine-co',
          'pre-commercial-country-foundational',
          'appalachian-old-time-and-mountain-music',
          'electrical-disc-cut-recording',
        ],
      },
    },
    tuningChosen: {
      instrumentId: 'banjo_5_string',
      tuning: { value: 'twelve_tet', descriptors: ['Western'] },
      room: {
        value: 'bristol_sessions_appalachian_pre_commercial',
        descriptors: [
          'bristol-tennessee-virginia-border',
          'victor-talking-machine-co',
          'pre-commercial-country-foundational',
          'appalachian-old-time-and-mountain-music',
          'electrical-disc-cut-recording',
        ],
      },
    },
    roomCleared: {
      instrumentId: 'banjo_5_string',
      tuning: { value: 'twelve_tet', descriptors: ['Western'] },
      room: { value: null, descriptors: [] },
    },
  },
  {
    initial: {
      instrumentId: 'electric_guitar_single_coil',
      tuning: { value: 'twelve_tet', descriptors: ['Western'] },
      room: {
        value: 'studio_emi_lagos_african',
        descriptors: ['large-tropical', 'ensemble-volume', 'EMI-equipment-heritage'],
      },
    },
    tuningChosen: {
      instrumentId: 'electric_guitar_single_coil',
      tuning: { value: 'just_intonation', descriptors: ['pure', 'beat-free', 'key-locked'] },
      room: {
        value: 'studio_emi_lagos_african',
        descriptors: ['large-tropical', 'ensemble-volume', 'EMI-equipment-heritage'],
      },
    },
    roomCleared: {
      instrumentId: 'electric_guitar_single_coil',
      tuning: { value: 'just_intonation', descriptors: ['pure', 'beat-free', 'key-locked'] },
      room: { value: null, descriptors: [] },
    },
  },
]);
assert.equal(options.tuning.length, 122);
assert.equal(options.room.length, 256);
function snapshot(card, revision = 1, sourceMessage = 'Supplied source message <b>verbatim</b>.') {
  return freeze({
    status: 'ready',
    error: null,
    instrumentId: card.instrumentId,
    revision,
    fields: ['tuning', 'room'].map((key) => ({
      key,
      value: card[key].value,
      options: options[key],
      descriptors: card[key].descriptors,
    })),
    sourceMessage,
  });
}
function harness(initial, preaborted = false) {
  const dom = new JSDOM('<div id="host"></div><button id="outside">Outside</button>');
  const doc = dom.window.document;
  const host = doc.querySelector('#host');
  const controller = new AbortController();
  if (preaborted) controller.abort();
  let current = initial;
  const listeners = new Set(),
    calls = [],
    announcements = [];
  const port = Object.freeze({
    snapshot: () => current,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    choose: (args) => new Promise((resolve, reject) => calls.push({ args, resolve, reject })),
  });
  const handle = mount(
    host,
    Object.freeze({
      environment: port,
      signal: controller.signal,
      announce: (s) => announcements.push(s),
    })
  );
  return {
    doc,
    host,
    controller,
    handle,
    listeners,
    calls,
    announcements,
    push(next, notify = true) {
      current = next;
      if (notify) [...listeners].forEach((fn) => fn());
    },
    change(key, id) {
      const select = host.querySelector(`[data-field="${key}"]`);
      select.value = id ?? '';
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    },
    close() {
      handle.unmount();
      dom.window.close();
    },
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
let cases = 0;
async function check(name, fn) {
  await fn();
  cases++;
  console.log(`PASS ${name}`);
}
async function run() {
  for (const fixture of fixtures)
    await check(`canonical ${fixture.initial.instrumentId}`, async () => {
      let card = fixture.initial;
      const expectedTuning = card.tuning.value;
      const initial = snapshot(card),
        original = JSON.stringify(initial);
      const h = harness(initial);
      assert.equal(h.host.querySelectorAll('select').length, 2);
      assert.equal(h.host.querySelector('.ie-source').textContent, initial.sourceMessage);
      assert.equal(h.host.querySelector('.ie-source b'), null);
      for (const field of initial.fields) {
        const select = h.host.querySelector(`[data-field="${field.key}"]`);
        assert.deepEqual(
          [...select.options].map((o) => [o.value, o.textContent]),
          [['', 'Not set'], ...field.options.map((o) => [o.id, o.name])]
        );
        assert.equal(select.value, field.value ?? '');
        assert.equal(
          select.closest('.ie-field').querySelector('p').textContent,
          field.descriptors.join(', ')
        );
      }
      h.handle.focus();
      const select = h.doc.activeElement;
      assert.equal(select.dataset.field, 'tuning');
      const nextId = fixture.tuningChosen.tuning.value;
      h.change('tuning', nextId);
      assert.deepEqual(h.calls[0].args, { field: 'tuning', id: nextId, revision: 1 });
      assert.equal(select.value, expectedTuning ?? '');
      card = fixture.tuningChosen;
      h.push(snapshot(card, 2));
      h.calls[0].resolve(snapshot(card, 2));
      await tick();
      assert.equal(select.value, nextId);
      assert.equal(h.doc.activeElement, select);
      h.change('room', null);
      assert.deepEqual(h.calls[1].args, { field: 'room', id: null, revision: 2 });
      card = fixture.roomCleared;
      h.push(snapshot(card, 3));
      h.calls[1].resolve(snapshot(card, 3));
      await tick();
      assert.equal(h.host.querySelector('[data-field="room"]').value, '');
      assert.equal(JSON.stringify(initial), original);
      h.close();
      assert.equal(h.listeners.size, 0);
      assert.equal(h.host.childNodes.length, 0);
    });
  const card = fixtures[0].initial;
  await check('newer revision and instrument defeat old completion and rejection', async () => {
    const h = harness(snapshot(card));
    h.change('tuning', 'twelve_tet');
    const newer = snapshot(fixtures[1].initial, 2, 'Compact: supplied host explanation.');
    h.push(newer);
    h.doc.querySelector('#outside').focus();
    h.calls[0].reject(Object.assign(new Error('late'), { code: 'STALE' }));
    await tick();
    assert.equal(h.host.querySelector('.ie-source').textContent, newer.sourceMessage);
    assert.equal(h.announcements.length, 0);
    assert.equal(h.doc.activeElement.id, 'outside');
    h.change('room', 'parlor');
    h.push(snapshot(card, 3, 'Rich: supplied host explanation.'));
    h.calls[1].resolve(newer);
    await tick();
    assert.equal(
      h.host.querySelector('.ie-source').textContent,
      'Rich: supplied host explanation.'
    );
    h.close();
  });
  await check('double input, rejected action, STALE and recovery', async () => {
    const h = harness(snapshot(card));
    h.change('room', 'parlor');
    h.change('tuning', 'twelve_tet');
    assert.equal(h.calls.length, 1);
    assert.equal(h.host.querySelector('[data-field="tuning"]').value, '');
    h.calls[0].reject(new Error('network'));
    await tick();
    assert.match(h.host.querySelector('.ie-status').textContent, /Try choosing again/);
    h.change('room', 'parlor');
    h.push(snapshot(card, 2), false);
    h.calls[1].reject({ code: 'STALE' });
    await tick();
    assert.match(h.announcements.at(-1), /Review the current settings/);
    h.change('room', 'parlor');
    assert.equal(h.calls[2].args.revision, 2);
    h.push(snapshot(card, 3));
    h.calls[2].resolve(snapshot(card, 3));
    await tick();
    assert.equal(h.host.querySelector('.ie-status').hidden, true);
    h.close();
  });
  await check('loading/error recovery, text safety and source message replacement', async () => {
    const h = harness(freeze({ status: 'loading', error: null, instrumentId: 'oud', revision: 0 }));
    h.handle.focus();
    assert.equal(h.doc.activeElement.className, 'ie-status');
    h.push(
      freeze({
        status: 'error',
        error: { code: 'LOAD', message: '<img onerror=x> unavailable' },
        instrumentId: 'oud',
        revision: 1,
      })
    );
    assert.equal(h.host.querySelector('img'), null);
    assert.match(h.host.textContent, /<img onerror=x>/);
    h.push(snapshot(card, 2, 'Nothing about a format is inferred here.'));
    assert.equal(
      h.host.querySelector('.ie-source').textContent,
      'Nothing about a format is inferred here.'
    );
    assert.equal(h.host.querySelector('.ie-fields').hidden, false);
    const link = h.host.querySelector('link');
    assert.equal(link.rel, 'stylesheet');
    assert.ok(link.href.endsWith('/instrument-environment/environment.css'));
    h.close();
    assert.equal(link.isConnected, false);
  });
  await check('abort, unmount and pre-aborted mount', async () => {
    for (const abort of [true, false]) {
      const h = harness(snapshot(card));
      h.change('room', 'parlor');
      if (abort) h.controller.abort();
      else h.handle.unmount();
      h.calls[0].reject(new Error('late'));
      h.push(snapshot(card, 9));
      await tick();
      assert.equal(h.host.childNodes.length, 0);
      assert.equal(h.listeners.size, 0);
      assert.equal(h.announcements.length, 0);
      h.handle.focus();
      h.close();
    }
    const h = harness(snapshot(card), true);
    assert.equal(h.host.childNodes.length, 0);
    assert.equal(h.listeners.size, 0);
    h.close();
  });
  await check('two mounts have independent lifetime and styles', async () => {
    const a = harness(snapshot(card)),
      b = harness(snapshot(card));
    a.close();
    assert.equal(b.host.querySelectorAll('link').length, 1);
    b.change('room', 'parlor');
    assert.equal(b.calls.length, 1);
    b.close();
    b.calls[0].resolve(snapshot(card));
    await tick();
  });
  await check('loading recovery restores the prior field without stealing focus', async () => {
    const h = harness(snapshot(card));
    const room = h.host.querySelector('[data-field="room"]');
    room.focus();
    h.push(freeze({ status: 'loading', instrumentId: 'oud', revision: 2, error: null }));
    assert.equal(h.doc.activeElement.className, 'ie-status');
    h.push(snapshot(card, 3));
    assert.equal(h.doc.activeElement, room);
    h.push(freeze({ status: 'loading', instrumentId: 'oud', revision: 4, error: null }));
    h.doc.querySelector('#outside').focus();
    h.push(snapshot(card, 5));
    assert.equal(h.doc.activeElement.id, 'outside');
    h.close();
  });
  await check('same-instrument revision supersedes a pending rejection', async () => {
    const h = harness(snapshot(card));
    h.change('room', 'parlor');
    h.push(snapshot(card, 2));
    h.calls[0].reject(new Error('superseded failure'));
    await tick();
    assert.equal(h.announcements.length, 0);
    assert.equal(h.host.querySelector('.ie-status').hidden, true);
    h.close();
  });
  console.log(
    `${cases} cases passed; embedded canonical 122/256 options; no production-source inputs. DOM contract evidence only.`
  );
  if (process.argv.includes('--mutations')) {
    const mutations = [
      ['unsafe message markup', 'source.textContent = ready', 'source.innerHTML = ready'],
      ['reversed canonical options', '...field.options]', '...[...field.options].reverse()]'],
      ['empty string instead of null', 'select.value || null', 'select.value'],
      ['wrong action revision', 'revision: action.revision', 'revision: 0'],
      ['duplicate pending action', 'if (pending) {', 'if (false && pending) {'],
      ['subscription leak', '    unsubscribe();', '    // unsubscribe omitted'],
      ['lost recovery focus', 'if (restoreFocus)', 'if (false && restoreFocus)'],
      ['old revision remains pending', 'next.revision !== pending.revision', 'false'],
    ];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'environment-mutations-'));
    try {
      for (const [name, before, after] of mutations) {
        assert.ok(source.includes(before), `Mutation anchor missing: ${name}`);
        const file = path.join(dir, 'environment.js');
        fs.writeFileSync(file, source.replace(before, after));
        const result = spawnSync(process.execPath, [__filename], {
          env: { ...process.env, ENVIRONMENT_FEATURE_FILE: file },
          encoding: 'utf8',
          timeout: 30000,
        });
        assert.equal(result.error, undefined, name);
        assert.notEqual(result.status, 0, `Mutation survived: ${name}`);
        assert.match(result.stderr, /AssertionError/, `Not an assertion failure: ${name}`);
        console.log(`KILLED ${name}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
