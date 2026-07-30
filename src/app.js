

// ============================================================
// CODEX v4 — applied perceptual psychology, not theme park
// Cards in two states: signature (small multiple) and composer (focal)
// ============================================================

// The product-defining hard recipe cap. Mirrors RECIPE_CHAR_CEILING in
// scripts/_api_contract.js (the browser bundle has no module system, so the
// value is restated here); every recipe render and counter derives from this
// one constant — a requested ceiling can only lower it, never exceed it.
const RECIPE_CHAR_CEILING = 1000;

// ---- Tradition signatures: distinctive descriptors that flow into every card created in this tradition ----
const TRADITION_SIGNATURES = {
  'honky_tonk': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'slide', 'characteristic-cry', 'glissando-heavy', 'fast-tremolo', 'sustained-high-register', 'twangy-foundational', 'country-twang', 'pedal-steel-twang'],
  'bakersfield': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'slide', 'characteristic-cry', 'glissando-heavy', 'intimate-aspirated', 'warm-glowing', 'twangy-foundational', 'country-twang', 'pedal-steel-twang'],
  'outlaw_country': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'slide', 'characteristic-cry', 'glissando-heavy', 'warmed', 'low-mid-rich', 'twangy-foundational', 'country-twang', 'pedal-steel-twang'],
  'bluegrass': ['folk', 'folkloric', 'folk-tradition', 'walking', 'articulated', 'fast-attack-transient', 'slide', 'characteristic-cry', 'glissando-heavy', 'low-mid-thick', 'low-end-heavy'],
  'old_time': ['folk', 'folk-tradition', 'folkloric', 'english-folk', 'celtic', 'slide', 'characteristic-cry', 'glissando-heavy', 'historical-gut', 'plain-gut', 'sheep-gut', 'pre-1940-period', 'unsplit'],
  'texas_conjunto': ['folk', 'folk-tradition', 'dance-driving', 'dance-friendly', 'iberian-celtic', 'rapid-tremolo'],
  'mariachi': ['folk', 'folk-tradition', 'dance-driving', 'dance-friendly', 'iberian-celtic', 'characteristic-cry'],
  'ranchera': ['folk', 'folk-tradition', 'dance-driving', 'dance-friendly', 'iberian-celtic', 'characteristic-cry'],
  'corrido': ['folk', 'folk-tradition', 'dance-driving', 'dance-friendly', 'iberian-celtic'],
  'singer_songwriter': ['folk', 'folk-tradition', 'intimate-aspirated', 'speech-derived', 'breath-heavy', 'breathy-low', 'fast-tremolo', 'vibrato-y', 'soft-onset', 'smoothed', 'close-harmony', 'close', 'rhythmic-speech', 'rapid-tremolo', 'dry', 'speech-mimicking', 'speech-like', 'rasping'],
  'polish_village_fiddle': ['drone-foundation', 'drone-like', 'folk-tradition', 'folkloric', 'sustained-tone', 'historical-gut', 'plain-gut', 'sheep-gut'],
  'delta_blues': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'lament-leaning', 'slide', 'glissando-heavy', 'mournful', 'breath-heavy', 'speech-like', 'rhythmic-speech', 'breathy-low', 'speech-mimicking', 'rough', 'pearwood', 'marine-band-tradition', 'brass'],
  'piedmont_blues': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'folk', 'folk-tradition', 'slide', 'glissando-heavy', 'mournful', 'transient-grab-aggressive', 'breath-heavy'],
  'chicago_blues': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'gospel-rooted', 'slide', 'glissando-heavy', 'mournful', 'lament-wail', 'projecting', 'rhythmic-speech', 'intimate-aspirated', 'gospel-friendly', 'melismatic', 'high-gain-cascading-saturation', 'pearwood', 'marine-band-tradition', 'brass'],
  'jump_blues': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'gospel-rooted', 'slide', 'glissando-heavy', 'mournful', 'projecting', 'rhythmic-speech', 'speech-mimicking', 'congregation-loud', 'rapid-tremolo', 'fast-tremolo'],
  'pentecostal_gospel': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'liturgical', 'sacred-traditional', 'ceremonial', 'sacred-Latin', 'blues-shouter', 'shouted', 'gospel-pentecostal', 'melismatic', 'blues-inflected', 'call-response'],
  'southern_gospel': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'liturgical', 'sacred-traditional', 'ceremonial', 'rhythmic-speech', 'warmed', 'warm-glowing'],
  'sacred_steel': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'liturgical'],
  'new_orleans': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'virtuoso'],
  'ragtime': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung'],
  'stride_piano': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'vintage-steinway', 'pre-war', 'compression-wired', 'aged-felt', 'characterful-uneven', 'a-440'],
  'boogie_woogie': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung'],
  'latin_jazz': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung'],
  'progressive_rock': ['rock-context', 'rock-context', 'high-gain-saturation', 'distorted', 'contemporary-classical', 'dynamic-arc-foundational', 'crescendo-build'],
  'art_rock': ['rock-context', 'rock-context', 'distorted', 'dark-romantic', 'half-sung', 'sprechgesang-vocal', 'talk-sung-articulation'],
  'glam_rock': ['rock-context', 'rock-context', 'distorted', 'high-gain-saturation', 'high-falsetto'],
  'gothic_rock': ['rock-context', 'rock-context', 'dark-romantic', 'haunted-romantic', 'distorted', 'late-Romantic-onward', 'mournful', 'sustained-tone', 'dark', 'sub-bass-foundational', 'marching-bateria', 'singing-sustain', 'low-fundamental-tuning', 'sacred-Latin', 'romantic', 'German-traditional', 'liturgical', 'intimate-aspirated', 'breathy-low'],
  'southern_rock': ['rock-context', 'rock-context', 'blues-derived', 'blues-inflected', 'folk-rock'],
  'country_rock': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'rapid-tremolo', 'twangy-foundational', 'country-twang', 'pedal-steel-twang'],
  'noise_rock': ['rock-context', 'high-gain-cascading-saturation', 'distorted', 'transient-grab-aggressive'],
  'pop_punk': ['rock-context', 'rock-context', 'distorted', 'transient-grab-aggressive', 'fast-attack-transient', 'rhythmic-speech', 'speech-like', 'articulated', 'rapid-tremolo'],
  'gangsta_rap': ['speech-mimicking', 'speech-mimicry', 'rhythmic-speech', 'funk-derived', 'sub-bass', 'cutting', 'sharp', 'intimate-aspirated', 'whispered', 'sample-foundational', 'vinyl-sampled'],
  'conscious_hip_hop': ['speech-mimicking', 'speech-mimicry', 'rhythmic-speech', 'funk-derived', 'sub-bass', 'declaimed', 'articulated', 'rapid-tremolo', 'tremolo', 'dry', 'speech-like', 'high-gain-cascading-saturation', 'sample-foundational', 'vinyl-sampled', 'enunciated-diction', 'crisp-consonant-articulation'],
  'synthpop': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'new_wave': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'folk_rock': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'skiffle': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'jug_band': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'lament-leaning', 'speech-mimicking', 'slide'],
  'yacht_rock': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'emo': ['rock-context', 'rock-context', 'distorted', 'dark-romantic', 'transient-grab-aggressive'],
  'kansas_city_swing': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'italian'],
  'thai_classical': ['naturally-reverberant', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'minimal', 'dynamic-arc-foundational', 'crescendo-build'],
  'hard_bop': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'virtuoso', 'hand-hammered', 'dark-uneven', 'random-pattern', 'pin-lathed', 'tonal-groove', 'fourteen-step', 'cluster-hammered'],
  'big_band': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'shallow-cup', 'lead-trumpet', 'tight-backbore', 'bright-high-register', 'high-register'],
  'bebop': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'virtuoso', 'hand-hammered', 'random-pattern', 'dark-uneven', 'pin-lathed', 'tonal-groove'],
  'modal_jazz': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'virtuoso', 'hand-hammered', 'random-pattern', 'unlathed-bell', 'stick-definition', 'dry-stick'],
  'free_jazz': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'virtuoso'],
  'fusion': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung'],
  'soul_jazz': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung'],
  'gypsy_jazz': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'european-folk', 'folkloric'],
  'symphonic': ['classical', 'baroque-leaning', 'romantic', 'dark-romantic', 'late-Romantic-onward', 'contemporary-classical', 'haunted-romantic', 'sub-driven', 'sustained-high-register', 'low-fundamental-tuning', 'Italian-baroque', 'German-traditional', 'mournful', 'rapid-tremolo', 'intimate-aspirated', 'sustained-tone', 'close', 'vibrato-rich', 'vibrato-y', 'sustained-projection', 'dynamic-arc-foundational', 'crescendo-build', 'historical-gut', 'silver-wound', 'copper-wound', 'lamb-gut-core', 'norway-spruce', 'european-alpine', 'bosnian-source', 'flamed-figure', 'oil-varnish', 'amber-tinted', 'modern-setup', 'longer-neck', 'a-442', 'european-orchestral'],
  'string_quartet': ['classical', 'baroque-leaning', 'romantic', 'dark-romantic', 'late-Romantic-onward', 'contemporary-classical', 'haunted-romantic', 'sub-driven', 'rapid-tremolo', 'vibrato-y', 'vibrato-rich', 'breath-heavy', 'soft-onset', 'sustained-projection', 'pressed', 'historical-gut', 'silver-wound', 'aluminum-wound', 'period-performance', 'lamb-gut-core', 'whole-lamb-method', 'half-rectified', 'norway-spruce', 'european-alpine', 'bosnian-source', 'flamed-figure', 'oil-varnish', 'modern-setup', 'cremonese-pre-1750', 'a-442', 'european-orchestral'],
  'baroque_period': ['baroque-leaning', 'baroque-leaning', 'baroque-soloistic', 'Italian-baroque', 'medieval', 'sacred-Latin', 'classical', 'liturgical', 'devotional', 'sacred-traditional', 'ceremonial', 'dark-romantic', 'haunted-romantic', 'rapid-tremolo', 'ornamental-melismatic', 'historical-gut', 'pistoy', 'venice-catlin', 'silver-wound', 'period-performance', 'pre-1700-period', 'late-baroque', 'mid-baroque-period', 'lamb-gut', 'sheep-gut', 'plain-gut', 'beef-gut', 'whole-lamb-method', 'lamb-gut-core', 'half-rectified', 'rectified', 'aluminum-wound', 'copper-wound', 'cinnabar-loaded', 'red-dyed', 'high-twist', 'metal-salt-loaded', 'large-diameter', 'gimped', 'metal-strip-wound', 'transitional', 'lyon', 'french-renaissance', 'cremonese-pre-1750', 'four-layer-system', 'italian-alpine-spruce', 'val-di-fiemme', 'bosnian-source', 'flamed-figure', 'baroque-setup', 'short-neck', 'shorter-fingerboard', 'lighter-bass-bar', 'no-chinrest', 'lower-tension', 'oil-base-coat', 'mineral-pigment-lake', 'a-415', 'baroque-pitch', 'galeazzi-1791', 'baroque-recipe', 'period-rosin', 'italian-recipe'],
  'minimalist': ['contemporary-classical', 'classical', 'modern-classical', 'classical-jazz', 'minimal', 'contemplative', 'drone-foundation'],
  'gagaku': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'drone-foundation', 'sustained-tone', 'drone-like', 'rhythmic-speech', 'jazz-influenced', 'reverberant', 'sustained-projection', 'low-projection-volume', 'dry', 'Japanese-classical'],
  'beijing_opera': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'drone-foundation', 'sustained-tone', 'singing-sustain', 'vibrato-y', 'Chinese-classical', 'enunciated-diction', 'crisp-consonant-articulation'],
  'cantonese_opera': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'drone-foundation', 'sustained-tone', 'Chinese-classical', 'enunciated-diction', 'crisp-consonant-articulation'],
  'hindustani': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'melismatic', 'devotional', 'sacred-traditional', 'meditative-tempo', 'contemplative', 'dynamic-arc-foundational', 'crescendo-build', 'khyal', 'hindustani', 'raga-improvisation', 'meend-ornamentation'],
  'hindustani_sarod': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'melismatic', 'devotional', 'sacred-traditional', 'meditative-tempo', 'contemplative', 'dynamic-arc-foundational', 'crescendo-build', 'khyal', 'raga-improvisation'],
  'garage_rock': ['rock-context', 'rock-context', 'rock-context', 'folk-rock', 'distorted'],
  'psychedelic_rock': ['rock-context', 'rock-context', 'rock-context', 'folk-rock', 'distorted', 'dynamic-arc-foundational', 'crescendo-build'],
  'hard_rock': ['rock-context', 'rock-context', 'rock-context', 'folk-rock', 'distorted', 'machine-hammered', 'symmetric-pattern', 'full-lathed', 'bright-uniform'],
  'surf_rock': ['rock-context', 'rock-context', 'distorted', 'rapid-tremolo', 'folk-rock', 'cutting', 'high-falsetto', 'glassy'],
  'arena_rock': ['rock-context', 'rock-context', 'distorted', 'high-gain-saturation', 'high-gain-cascading-saturation', 'high-gain-cascading-tube-stages', 'machine-hammered', 'symmetric-pattern', 'full-lathed', 'bright-uniform'],
  'hair_metal': ['rock-context', 'rock-context', 'distorted', 'high-gain-saturation'],
  'aor': ['rock-context', 'rock-context', 'distorted', 'high-gain-saturation'],
  'heartland_rock': ['rock-context', 'rock-context', 'distorted', 'high-gain-saturation'],
  'doom': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'mournful', 'dark-romantic', 'cutting', 'sub-driven', 'sub-bass-foundational', 'German-traditional', 'rhythmic-speech', 'sub-heavy', 'sub-fundamental-buzz', 'drone-like', 'foundational-sub', 'marching-bateria', 'high-frequency'],
  'black_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'folk-shrill', 'sustained-high-register', 'gospel-rooted', 'high-falsetto', 'gospel-runs', 'blues-shouter'],
  'punk': ['rock-context', 'distorted', 'transient-grab-aggressive', 'fast-attack-transient', 'high-gain-saturation', 'folk-shrill', 'sharp'],
  'post_punk': ['rock-context', 'distorted', 'transient-grab-aggressive', 'fast-attack-transient', 'high-gain-saturation', 'half-sung', 'sprechgesang-vocal', 'talk-sung-articulation'],
  'shoegaze': ['rock-context', 'rock-context', 'distorted', 'haunted-romantic', 'sub-bass-foundational', 'dark', 'high-gain-saturation', 'rapid-tremolo', 'breath-heavy', 'intimate-aspirated', 'whispered', 'dynamic-arc-foundational', 'loud-soft-loud-structure'],
  'grunge': ['rock-context', 'distorted', 'haunted-romantic', 'sub-bass-foundational', 'dark', 'high-gain-saturation', 'rapid-tremolo', 'dynamic-arc-foundational', 'loud-soft-loud-structure', 'machine-hammered', 'symmetric-pattern', 'full-lathed'],
  'chicago_house': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky'],
  'detroit_techno': ['dance-driving', 'synthesized', 'synthetic', 'sub-bass', 'sub-driven', 'rapid-tremolo'],
  'acid_house': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky'],
  'peak_techno': ['dance-driving', 'synthesized', 'synthetic', 'sub-bass', 'sub-driven'],
  'dub_techno': ['dub-friendly', 'sub-bass', 'sub-driven', 'sub-bass-foundational', 'layered-ambient', 'sub-heavy', 'foundational-sub', 'rhythmic', 'low-fundamental-tuning', 'deep-bass'],
  'jungle': ['sub-bass', 'sub-driven', 'sub-bass-foundational', 'sub-fundamental-buzz', 'rapid-tremolo', 'foundational-sub', 'sub-heavy', 'swelling', 'sample-foundational', 'vinyl-sampled'],
  'ambient': ['layered-ambient', 'lush-ambient', 'ambient', 'drone-foundation', 'sustained-tone', 'low-fundamental-tuning', 'German-traditional', 'reverberant', 'high-gain-cascading-saturation', 'naturally-reverberant', 'surface-noise-bedded'],
  'idm': ['synthesized', 'synthetic', 'articulated', 'glassy', 'high-frequency', 'sharp', 'sustained-high-register', 'rapid-tremolo', 'tremolo', 'drone-foundation', 'high-gain-saturation', 'fast-tremolo'],
  'synthwave': ['synthesized', 'synthetic', 'smoothed', 'warm-glowing', 'vibrato-y', 'layered-ambient'],
  'boom_bap': ['speech-mimicking', 'speech-mimicry', 'rhythmic-speech', 'funk-derived', 'sub-bass'],
  'g_funk': ['speech-mimicking', 'speech-mimicry', 'rhythmic-speech', 'funk-derived', 'sub-bass', 'sample-foundational', 'vinyl-sampled', 'machine-hammered', 'symmetric-pattern'],
  'southern_trap': ['speech-mimicking', 'speech-mimicry', 'rhythmic-speech', 'funk-derived', 'sub-bass'],
  'drill': ['speech-mimicking', 'rhythmic-speech', 'sub-bass', 'sub-bass-foundational', 'dark', 'declaimed', 'articulated', 'speech-mimicry'],
  'cloud_rap': ['speech-mimicking', 'speech-mimicry', 'rhythmic-speech', 'funk-derived', 'sub-bass'],
  'palm_wine': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'highlife': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'mbira_tradition': ['drone-foundation', 'drone-like', 'folk-tradition', 'folkloric', 'sustained-tone'],
  'desert_blues': ['African-traditional', 'African-derived', 'drone-foundation', 'drone-like', 'modal-non-rough', 'pan-African'],
  'reggae_roots': ['dub-friendly', 'walking-bass', 'sub-bass', 'sub-driven', 'swung', 'sub-bass-foundational', 'foundational-sub'],
  'dub': ['dub-friendly', 'walking-bass', 'sub-bass', 'sub-driven', 'swung', 'sub-bass-foundational'],
  'jamaican_dancehall': ['dub-friendly', 'walking-bass', 'sub-bass', 'sub-driven', 'swung'],
  'flamenco': ['drone-foundation', 'drone-like', 'ornamental-melismatic', 'sustained-tone', 'sustained-projection', 'flamenco-classical', 'cante-jondo', 'flamenco-deep', 'gypsy-andalusian', 'melismatic-raw'],
  'hawaiian_slack_key': ['drone-foundation', 'drone-like', 'folk-tradition', 'folkloric', 'sustained-tone'],
  'qawwali': ['sufi', 'sufi-mystical', 'ornamental-melismatic', 'melismatic', 'devotional', 'ornament-heavy', 'ceremonial', 'court-ceremonial', 'Hindu-ritual', 'sacred-traditional', 'meditative-tempo', 'contemplative', 'drone-foundation', 'sustained-projection', 'ecstatic', 'qawwali', 'sufi-devotional', 'call-response', 'persian-melismatic'],
  'fado': ['fado-lead', 'university-fado', 'iberian-celtic', 'celtic', 'lament-leaning', 'mournful', 'lament-wail', 'glissando-heavy', 'melismatic', 'ornamental-melismatic'],
  'morna': ['fado-lead', 'university-fado', 'iberian-celtic', 'celtic', 'lament-leaning', 'mournful', 'lament-wail'],
  'celtic_irish_trad': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'folk', 'folk-tradition', 'lament-wail', 'historical-gut', 'plain-gut', 'sheep-gut', 'lamb-gut', 'period-performance', 'pre-modern'],
  'klezmer': ['european-folk', 'folkloric', 'folk-tradition', 'ornamental-melismatic', 'sufi-mystical', 'devotional', 'court-ceremonial', 'ebonite', 'hard-rubber', 'softer-tone', 'klezmer-tradition'],
  'shape_note': ['sacred-Latin', 'sacred-traditional', 'liturgical', 'medieval', 'choir-blendable', 'devotional', 'ceremonial', 'reverberant', 'intimate-aspirated', 'lament-leaning', 'sustained-high-register', 'sustained-projection', 'mournful', 'close-harmony', 'naturally-reverberant', 'singing-sustain', 'glassy', 'harmonizing-foundational'],
  'work_songs_hollers': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'lament-leaning', 'rough'],
  'alt_country_americana': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'twangy-foundational', 'pedal-steel-twang'],
  'funk': ['funky', 'funk-derived', 'funk-friendly', 'funk-friendly', 'backbeat', 'swung', 'machine-hammered', 'symmetric-pattern', 'full-lathed', 'bright-uniform'],
  'southern_soul': ['gospel-rooted', 'gospel-runs', 'blues-derived', 'blues-inflected', 'funky', 'rapid-tremolo', 'breathy-low', 'warm-glowing'],
  'northern_soul_motown': ['gospel-rooted', 'gospel-runs', 'blues-derived', 'blues-inflected', 'funky', 'warmed', 'warm-glowing'],
  'philly_soul_intl': ['gospel-rooted', 'gospel-runs', 'blues-derived', 'blues-inflected', 'funky', 'warmed', 'warm-glowing'],
  'classic_rb': ['gospel-rooted', 'gospel-runs', 'blues-derived', 'blues-inflected', 'funky', 'intimate-aspirated'],
  'doo_wop': ['gospel-rooted', 'gospel-runs', 'blues-derived', 'blues-inflected', 'funky', 'jazz-influenced', 'warm-glowing', 'harmonizing-foundational', 'harmony-stacked-multi-part'],
  'girl_group_60s': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'western_swing': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'slide', 'characteristic-cry', 'glissando-heavy'],
  'spirituals_african_american': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'liturgical', 'sacred-traditional', 'ceremonial', 'sustained-high-register'],
  'jubilee_quartet': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'liturgical', 'sacred-traditional', 'ceremonial', 'ecstatic', 'sustained-high-register', 'harmonizing-foundational', 'harmony-stacked-multi-part'],
  'disco': ['dance-driving', 'synthesized', 'synthetic', 'funky', 'smoothed', 'machine-hammered', 'symmetric-pattern', 'full-lathed', 'bright-uniform'],
  'spiritual_jazz': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung'],
  'thrash_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'German-traditional', 'sheet-bronze', 'machine-hammered', 'cutting', 'full-lathed'],
  'death_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'sub-bass-foundational'],
  'hardcore_punk': ['rock-context', 'distorted', 'transient-grab-aggressive', 'fast-attack-transient', 'high-gain-saturation', 'shouted'],
  'krautrock': ['rock-context', 'distorted', 'high-gain-saturation', 'drone-foundation', 'dark-romantic', 'German-traditional'],
  'math_rock_post_rock': ['rock-context', 'rock-context', 'distorted', 'haunted-romantic', 'sub-bass-foundational', 'dark', 'high-gain-saturation', 'dynamic-arc-foundational', 'crescendo-build', 'loud-soft-loud-structure'],
  'industrial': ['high-gain-cascading-saturation', 'transient-grab-aggressive', 'distorted', 'metal-context', 'synthesized', 'rapid-tremolo'],
  'noise_music': ['high-gain-cascading-saturation', 'transient-grab-aggressive', 'distorted', 'metal-context', 'synthesized', 'glassy'],
  'drone_dark_ambient': ['layered-ambient', 'lush-ambient', 'ambient', 'drone-foundation', 'sustained-tone'],
  'hyperpop': ['synthesized', 'synthetic', 'smoothed', 'layered-ambient', 'rapid-tremolo'],
  'modern_rb': ['gospel-rooted', 'gospel-runs', 'blues-derived', 'blues-inflected', 'funky'],
  'tango': ['iberian-celtic', 'folk', 'folk-tradition', 'dark-romantic', 'lament-leaning'],
  'milonga': ['iberian-celtic', 'folk', 'folk-tradition', 'dark-romantic', 'lament-leaning'],
  'samba': ['samba-foundation', 'samba-foundational', 'samba-batería', 'dance-driving', 'dance-rhythm', 'swung', 'percussive-attack'],
  'pagode': ['samba-foundation', 'samba-foundational', 'samba-batería', 'dance-driving', 'dance-rhythm', 'swung'],
  'bossa_nova': ['samba-foundation', 'samba-foundational', 'jazz-influenced', 'swung', 'smoothed', 'warmed', 'warm-glowing'],
  'choro': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'european-folk', 'folkloric'],
  'afrobeat': ['African-derived', 'pan-African', 'funky', 'funk-derived', 'dance-driving', 'African-traditional'],
  'ska_rocksteady': ['dub-friendly', 'walking-bass', 'sub-bass', 'sub-driven', 'swung'],
  'tuvan_throat': ['drone-foundation', 'drone-like', 'naturally-reverberant', 'sustained-tone', 'sustained-projection', 'khoomei', 'overtone-singing', 'multi-pitch-simultaneous', 'kargyraa', 'subharmonic', 'sygyt', 'tuvan-whistle'],
  'sardinian_polyphony': ['drone-foundation', 'drone-like', 'ornamental-melismatic', 'sustained-tone', 'sustained-projection', 'sacred-Latin', 'liturgical', 'medieval', 'devotional', 'sacred-traditional', 'ceremonial', 'harmonizing-foundational'],
  'mariachi_traditional': ['iberian-celtic', 'folk', 'folkloric', 'dance-friendly', 'medium-cup', 'standard-rim', 'orchestral-balance'],
  'mbalax': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'juju': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'fuji': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'hiplife': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'afrobeats_naija': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-driving'],
  'makossa': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'soukous': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'congolese_rumba': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-driving'],
  'ndombolo': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'taarab': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'chimurenga': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-rhythm'],
  'kwaito': ['speech-mimicking', 'rhythmic-speech', 'African-derived', 'pan-African', 'funky', 'African-traditional'],
  'gqom': ['African-derived', 'pan-African', 'dance-driving', 'synthesized', 'synthetic', 'African-traditional'],
  'amapiano': ['African-derived', 'pan-African', 'dance-driving', 'synthesized', 'synthetic', 'African-traditional'],
  'maskandi': ['drone-foundation', 'drone-like', 'folk-tradition', 'folkloric', 'sustained-tone'],
  'isicathamiya': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-driving'],
  'gnawa': ['drone-foundation', 'drone-like', 'folk-tradition', 'folkloric', 'sustained-tone'],
  'rai': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'dance-driving'],
  'andalusi_nuba': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'sufi-mystical', 'glissando-heavy', 'lament-wail', 'devotional', 'court-ceremonial'],
  'arab_tarab': ['sufi-mystical', 'ornamental-melismatic', 'melismatic', 'ornament-heavy', 'classical-radif', 'Middle-Eastern', 'devotional', 'court-ceremonial'],
  'persian_dastgah': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'sufi-mystical', 'devotional', 'court-ceremonial', 'dastgah', 'persian-classical', 'modal-improvisation', 'avaz-ornamentation'],
  'turkish_makam': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'sufi-mystical', 'devotional', 'court-ceremonial'],
  'ghazal': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy'],
  'dhrupad': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'melismatic', 'devotional', 'sacred-traditional', 'meditative-tempo', 'contemplative', 'dynamic-arc-foundational', 'crescendo-build'],
  'thumri': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'melismatic', 'devotional', 'sacred-traditional', 'meditative-tempo', 'contemplative'],
  'carnatic_vocal': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'melismatic', 'ecstatic', 'carnatic', 'south-indian', 'gamaka-ornamentation', 'kriti-form'],
  'carnatic_instrumental': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'melismatic', 'carnatic', 'gamaka-ornamentation'],
  'bhajan': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'devotional', 'drone-foundation', 'sacred-traditional', 'meditative-tempo', 'contemplative'],
  'kirtan': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'devotional', 'drone-foundation', 'sacred-traditional', 'meditative-tempo', 'contemplative'],
  'bhangra_modern': ['raga-bound', 'Hindu-ritual', 'melismatic', 'ornamental-melismatic', 'dance-driving'],
  'jingju': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'drone-foundation', 'sustained-tone', 'Chinese-classical'],
  'guqin': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'drone-foundation', 'sustained-tone', 'Chinese-classical'],
  'wenrenyue': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'drone-foundation', 'sustained-tone', 'Chinese-classical'],
  'shakuhachi_honkyoku': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'drone-foundation', 'sustained-tone', 'Japanese-classical'],
  'koto': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'drone-foundation', 'sustained-tone', 'Japanese-classical'],
  'pansori': ['drone-foundation', 'drone-like', 'ornamental-melismatic', 'sustained-tone', 'sustained-projection'],
  'samul_nori': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'ceremonial'],
  'mongolian_long_song': ['drone-foundation', 'drone-like', 'ornamental-melismatic', 'sustained-tone', 'sustained-projection', 'multi-pitch-simultaneous'],
  'javanese_gamelan': ['naturally-reverberant', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'minimal'],
  'balinese_gamelan': ['naturally-reverberant', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'minimal'],
  'kulintang': ['naturally-reverberant', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'minimal'],
  'dangdut': ['raga-bound', 'Hindu-ritual', 'melismatic', 'ornamental-melismatic', 'dance-driving'],
  'mor_lam': ['drone-foundation', 'drone-like', 'ornamental-melismatic', 'sustained-tone', 'sustained-projection'],
  'powwow': ['ceremonial', 'sacred-traditional', 'drone-foundation', 'African-traditional', 'African-derived', 'pan-African', 'declaimed', 'rhythmic-speech'],
  'andean_huayno': ['drone-foundation', 'drone-like', 'folk-tradition', 'folkloric', 'sustained-tone'],
  'bambuco': ['iberian-celtic', 'folk', 'folk-tradition', 'dark-romantic', 'lament-leaning'],
  'son_jarocho': ['drone-foundation', 'drone-like', 'folk-tradition', 'folkloric', 'sustained-tone'],
  'mento': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving'],
  'calypso': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving'],
  'soca': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving'],
  'kompa': ['African-derived', 'pan-African', 'funky', 'funk-derived', 'dance-driving', 'African-traditional'],
  'kizomba': ['African-derived', 'pan-African', 'funky', 'funk-derived', 'dance-driving', 'African-traditional'],
  'kuduro': ['African-derived', 'pan-African', 'dance-driving', 'synthesized', 'synthetic', 'African-traditional'],
  'reggaeton': ['speech-mimicking', 'rhythmic-speech', 'dance-driving', 'dub-friendly', 'funky', 'declaimed', 'articulated', 'speech-mimicry'],
  'latin_trap': ['speech-mimicking', 'rhythmic-speech', 'dance-driving', 'dub-friendly', 'funky'],
  'sludge_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'mournful', 'dark-romantic', 'sub-bass-foundational', 'thunderous'],
  'stoner_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'sub-fundamental-buzz', 'rapid-tremolo'],
  'post_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'sub-bass-foundational'],
  'deathcore': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'mathcore': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'grindcore': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'shouted'],
  'atmospheric_black_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'mournful', 'dark-romantic'],
  'melodic_death_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'footwork': ['dance-driving', 'synthesized', 'synthetic', 'sub-bass', 'rapid-tremolo'],
  'jersey_club': ['dance-driving', 'synthesized', 'synthetic', 'sub-bass', 'rapid-tremolo', 'breath-heavy'],
  'microhouse': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky'],
  'hardstyle': ['dance-driving', 'high-gain-saturation', 'synthesized', 'sub-bass', 'transient-grab-aggressive'],
  'gabber': ['dance-driving', 'high-gain-saturation', 'synthesized', 'sub-bass', 'transient-grab-aggressive'],
  'uk_drill': ['speech-mimicking', 'rhythmic-speech', 'sub-bass', 'sub-bass-foundational', 'dark', 'declaimed', 'articulated', 'speech-mimicry'],
  'french_rap': ['speech-mimicking', 'rhythmic-speech', 'funk-derived', 'sub-bass', 'sample-foundational'],
  'k_rap': ['speech-mimicking', 'rhythmic-speech', 'funk-derived', 'sub-bass'],
  'rebetiko': ['urban-Greek', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'iberian-celtic', 'melismatic'],
  'laiko': ['urban-Greek', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'iberian-celtic', 'melismatic'],
  'sevdalinka': ['urban-Greek', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'iberian-celtic'],
  'bulgarian_womens_choir': ['drone-foundation', 'drone-like', 'ornamental-melismatic', 'sustained-tone', 'sustained-projection', 'sustained-high-register', 'vibrato-y', 'harmonizing-foundational'],
  'hardanger_fiddle': ['drone-foundation', 'drone-like', 'folk-tradition', 'folkloric', 'sustained-tone', 'historical-gut', 'plain-gut', 'sheep-gut', 'lamb-gut'],
  'sami_yoik': ['drone-foundation', 'drone-like', 'ornamental-melismatic', 'sustained-tone', 'sustained-projection'],
  'byzantine_chant': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'sacred-Latin', 'liturgical', 'medieval', 'ornamental-melismatic', 'melismatic', 'mournful', 'lament-leaning', 'sacred-traditional', 'ceremonial', 'court-ceremonial', 'high-falsetto', 'lament-wail', 'sustained-projection', 'projecting', 'vibrato-y', 'chant-foundational', 'chorus-chant'],
  'pre_commercial_country': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'twangy-foundational', 'country-twang'],
  'nashville_sound': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'twangy-foundational', 'country-twang', 'pedal-steel-twang'],
  'red_dirt': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'twangy-foundational', 'country-twang', 'pedal-steel-twang'],
  'gothic_country': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'German-traditional', 'twangy-foundational', 'country-twang', 'pedal-steel-twang'],
  'ethio_jazz': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'dance-driving', 'funk-derived', 'African-derived', 'African-traditional', 'pan-African'],
  'samba_jazz': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'dance-driving', 'funk-derived', 'African-derived', 'African-traditional', 'pan-African'],
  'cajun': ['drone-foundation', 'drone-like', 'folk-tradition', 'folkloric', 'sustained-tone', 'twangy-foundational'],
  'zydeco': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving', 'twangy-foundational'],
  'mongolian_xoomii': ['drone-foundation', 'drone-like', 'naturally-reverberant', 'sustained-tone', 'sustained-projection', 'khoomei', 'overtone-singing', 'multi-pitch-simultaneous'],
  'tibetan_gyuto': ['sacred-traditional', 'drone-foundation', 'drone-like', 'ceremonial', 'sustained-tone', 'liturgical', 'devotional', 'meditative-tempo', 'contemplative', 'naturally-reverberant', 'chant-foundational', 'monastic-chant'],
  'inuit_katajjaq': ['ceremonial', 'sacred-traditional', 'drone-foundation', 'African-traditional', 'African-derived', 'pan-African', 'katajjaq', 'inuit-throat-singing', 'duet-game', 'breathing-rhythm'],
  'tin_pan_alley_song': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'classical-jazz', 'smoothed', 'jazz-friendly', 'warmed', 'italian', 'breathy-low', 'close-harmony', 'intimate-aspirated', 'dark-romantic', 'close', 'low-mid-thick', 'singing-sustain', 'low-end-heavy'],
  'brill_building_pop': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'classical-jazz', 'smoothed', 'jazz-friendly', 'intimate-aspirated'],
  'great_american_songbook': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'classical-jazz', 'smoothed', 'jazz-friendly'],
  'easy_listening_orchestral': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'classical-jazz', 'smoothed', 'jazz-friendly'],
  'dream_pop': ['rock-context', 'smoothed', 'synthesized'],
  'jangle_pop': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'power_pop': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'sophisti_pop': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'art_pop': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'twee_pop': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'indie_pop_modern': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'bubblegum_pop': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'j_pop_classic': ['smoothed', 'synthesized', 'synthetic', 'gagaku-foundational', 'close-harmony', 'close', 'singing-sustain', 'warm-glowing', 'vibrato-y', 'Japanese-classical'],
  'enka': ['smoothed', 'synthesized', 'synthetic', 'gagaku-foundational', 'close-harmony', 'Japanese-classical'],
  'city_pop': ['smoothed', 'synthesized', 'synthetic', 'gagaku-foundational', 'close-harmony', 'Japanese-classical'],
  'shibuya_kei': ['smoothed', 'synthesized', 'synthetic', 'gagaku-foundational', 'close-harmony', 'Japanese-classical'],
  'k_pop_modern': ['smoothed', 'synthesized', 'synthetic', 'gagaku-foundational', 'close-harmony', 'Korean-classical'],
  'mandopop': ['smoothed', 'synthesized', 'synthetic', 'gagaku-foundational', 'close-harmony', 'Chinese-classical'],
  'cantopop': ['smoothed', 'synthesized', 'synthetic', 'gagaku-foundational', 'close-harmony', 'Chinese-classical'],
  'vocaloid_synth_voice': ['smoothed', 'synthesized', 'synthetic', 'gagaku-foundational', 'close-harmony', 'Japanese-classical'],
  'chanson_pop_modern': ['smoothed', 'synthesized', 'synthetic', 'dance-friendly', 'french-musette-ready', 'french', 'french-trad', 'romantic', 'dark-romantic', 'soft-onset', 'late-Romantic-onward', 'intimate-aspirated', 'haunted-romantic', 'layered-ambient', 'half-sung', 'talk-sung-articulation'],
  'cantautore_italiano': ['fado-lead', 'university-fado', 'iberian-celtic', 'celtic', 'lament-leaning', 'mournful', 'italian', 'italian', 'half-sung', 'talk-sung-articulation'],
  'schlager_german': ['smoothed', 'synthesized', 'synthetic', 'dance-friendly', 'french-musette-ready', 'German-traditional', 'late-Romantic-onward'],
  'eurovision_pop': ['smoothed', 'synthesized', 'synthetic', 'dance-friendly', 'french-musette-ready', 'intimate-aspirated'],
  'scandi_pop': ['smoothed', 'synthesized', 'synthetic', 'dance-friendly', 'french-musette-ready', 'late-Romantic-onward', 'German-traditional'],
  'russian_estrada': ['smoothed', 'synthesized', 'synthetic', 'dance-friendly', 'french-musette-ready'],
  'portuguese_pop_modern': ['iberian-celtic', 'smoothed', 'dance-friendly'],
  'spanish_cancion_pop': ['iberian-celtic', 'smoothed', 'dance-friendly'],
  'galician_kantautor': ['iberian-celtic', 'smoothed', 'dance-friendly', 'celtic', 'Irish-traditional', 'Scottish-influenced', 'european-folk', 'folk-tradition', 'folkloric', 'half-sung', 'talk-sung-articulation'],
  'basque_kantautor': ['iberian-celtic', 'smoothed', 'dance-friendly', 'half-sung', 'talk-sung-articulation'],
  'bachata': ['dance-driving', 'dance-friendly', 'funky', 'funk-derived', 'swung'],
  'kompa_song_form': ['dance-driving', 'dance-friendly', 'funky', 'funk-derived', 'swung'],
  'kizomba_song_form': ['dance-driving', 'dance-friendly', 'funky', 'funk-derived', 'swung'],
  'tropical_bolero': ['dance-driving', 'dance-friendly', 'funky', 'funk-derived', 'swung'],
  'son_cubano': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'salsa_nuyorican': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'salsa_cubana_timba': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'mambo': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'cha_cha_cha': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'charanga': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'guaracha': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'rumba_cubana': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'guaguanco': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'danzon': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'cumbia_colombiana': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'samba-foundation'],
  'cumbia_peruvian': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'samba-foundation'],
  'vallenato': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'samba-foundation'],
  'joropo': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'samba-foundation'],
  'merengue_dominicano': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'samba-foundation'],
  'candombe_uruguayan': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'samba-foundation'],
  'forro_brasileiro': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'samba-foundation'],
  'marinera': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'samba-foundation'],
  'psytrance': ['dance-driving', 'synthesized', 'synthetic', 'layered-ambient', 'sustained-projection'],
  'goa_trance': ['dance-driving', 'synthesized', 'synthetic', 'layered-ambient', 'sustained-projection'],
  'progressive_trance': ['dance-driving', 'synthesized', 'synthetic', 'layered-ambient', 'sustained-projection'],
  'uplifting_trance': ['dance-driving', 'synthesized', 'synthetic', 'layered-ambient', 'sustained-projection'],
  'vocal_trance': ['dance-driving', 'synthesized', 'synthetic', 'layered-ambient', 'sustained-projection'],
  'cumbia_electronica': ['dance-driving', 'synthesized', 'synthetic', 'dance-rhythm', 'funk-derived'],
  'baile_funk': ['dance-driving', 'synthesized', 'synthetic', 'dance-rhythm', 'funk-derived', 'machine-hammered', 'symmetric-pattern'],
  'tribal_guarachero': ['dance-driving', 'synthesized', 'synthetic', 'dance-rhythm', 'funk-derived'],
  'perreo_electronica': ['dance-driving', 'synthesized', 'synthetic', 'dance-rhythm', 'funk-derived'],
  'tropical_bass': ['dance-driving', 'synthesized', 'synthetic', 'dance-rhythm', 'funk-derived'],
  'eurodance_90s': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'smoothed'],
  'italo_dance': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'smoothed'],
  'hi_nrg': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'smoothed'],
  'freestyle_music': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'smoothed'],
  'uk_garage_2step': ['dub-friendly', 'sub-bass', 'sub-driven', 'sub-bass-foundational', 'sub-fundamental-buzz', 'tremolo', 'transient-grab-aggressive', 'fast-tremolo'],
  'liquid_funk': ['dub-friendly', 'sub-bass', 'sub-driven', 'sub-bass-foundational', 'sub-fundamental-buzz', 'machine-hammered', 'symmetric-pattern'],
  'dubstep_140': ['dub-friendly', 'sub-bass', 'sub-driven', 'sub-bass-foundational', 'sub-fundamental-buzz'],
  'lovers_rock': ['dub-friendly', 'walking-bass', 'sub-bass', 'sub-driven', 'swung', 'sub-bass-foundational', 'foundational-sub'],
  'reggae_fusion_modern': ['dub-friendly', 'walking-bass', 'sub-bass', 'sub-driven', 'swung'],
  'dub_poetry': ['dub-friendly', 'walking-bass', 'sub-bass', 'sub-driven', 'swung'],
  'russian_bard_song': ['european-folk', 'folkloric', 'dark-romantic', 'lament-leaning', 'folk-tradition', 'iberian-celtic', 'rough', 'breathy-low', 'gritty', 'breath-heavy'],
  'polish_poezja_spiewana': ['european-folk', 'folkloric', 'dark-romantic', 'lament-leaning', 'folk-tradition'],
  'czech_pisnicka': ['european-folk', 'folkloric', 'dark-romantic', 'lament-leaning', 'folk-tradition'],
  'south_slavic_kantautor': ['european-folk', 'folkloric', 'dark-romantic', 'lament-leaning', 'folk-tradition', 'half-sung', 'talk-sung-articulation'],
  'cantorial_khazonus': ['sufi-mystical', 'ornamental-melismatic', 'devotional', 'sacred-traditional', 'melismatic', 'court-ceremonial', 'declaimed', 'drone-foundation', 'chant-foundational'],
  'hasidic_niggun': ['sufi-mystical', 'ornamental-melismatic', 'devotional', 'sacred-traditional', 'melismatic', 'court-ceremonial'],
  'yemenite_torah_cantillation': ['sufi-mystical', 'ornamental-melismatic', 'devotional', 'sacred-traditional', 'melismatic', 'court-ceremonial', 'chant-foundational'],
  'sephardi_bakkashot': ['sufi-mystical', 'ornamental-melismatic', 'devotional', 'sacred-traditional', 'melismatic', 'court-ceremonial'],
  'quranic_recitation_tajweed': ['sufi-mystical', 'ornamental-melismatic', 'devotional', 'sacred-traditional', 'melismatic', 'court-ceremonial', 'rapid-tremolo'],
  'naat_devotional': ['sufi-mystical', 'ornamental-melismatic', 'devotional', 'sacred-traditional', 'melismatic', 'court-ceremonial', 'chant-foundational', 'chorus-chant'],
  'athan_call_prayer': ['sufi-mystical', 'ornamental-melismatic', 'devotional', 'sacred-traditional', 'melismatic', 'court-ceremonial'],
  'islamic_anasheed': ['sufi-mystical', 'ornamental-melismatic', 'devotional', 'sacred-traditional', 'melismatic', 'court-ceremonial', 'chant-foundational', 'chorus-chant'],
  'candomble_ceremonial': ['African-traditional', 'African-derived', 'pan-African', 'ceremonial', 'devotional'],
  'santeria_lucumi': ['African-traditional', 'African-derived', 'pan-African', 'ceremonial', 'devotional'],
  'haitian_vodou': ['African-traditional', 'African-derived', 'pan-African', 'ceremonial', 'devotional'],
  'umbanda_brazilian': ['African-traditional', 'African-derived', 'pan-African', 'ceremonial', 'devotional'],
  'lofi_hiphop': ['surface-noise-bedded', 'synthesized', 'warm-glowing', 'vibrato-y', 'jazz-influenced', 'naturally-reverberant', 'transient-sharp', 'high-frequency', 'quiet', 'soft-onset', 'fast-attack-transient', 'sample-foundational'],
  'vaporwave': ['surface-noise-bedded', 'synthesized', 'warm-glowing', 'vibrato-y', 'jazz-influenced'],
  'hypnagogic_pop': ['surface-noise-bedded', 'synthesized', 'warm-glowing', 'vibrato-y', 'jazz-influenced', 'warmed', 'dark-romantic'],
  'bedroom_pop': ['surface-noise-bedded', 'synthesized', 'warm-glowing', 'vibrato-y', 'jazz-influenced'],
  'chillwave': ['surface-noise-bedded', 'synthesized', 'warm-glowing', 'vibrato-y', 'jazz-influenced'],
  'piobaireachd': ['celtic', 'Scottish-influenced', 'drone-foundation', 'drone-like', 'folk-tradition'],
  'uilleann_pipe_solo': ['celtic', 'Scottish-influenced', 'drone-foundation', 'drone-like', 'folk-tradition'],
  'didgeridoo_yidaki_solo': ['celtic', 'Scottish-influenced', 'drone-foundation', 'drone-like', 'folk-tradition', 'eucalyptus-tetrodonta', 'yidaki-canon', 'northeast-arnhem', 'sugarbag-beeswax', 'shaped-rim'],
  'galician_pipe_solo': ['celtic', 'Scottish-influenced', 'drone-foundation', 'drone-like', 'folk-tradition'],
  'cloud_rap_experimental': ['speech-mimicking', 'rhythmic-speech', 'layered-ambient', 'synthesized', 'synthetic', 'sample-foundational'],
  'mumble_rap': ['speech-mimicking', 'rhythmic-speech', 'layered-ambient', 'synthesized', 'synthetic'],
  'hyperpop_rap': ['speech-mimicking', 'rhythmic-speech', 'layered-ambient', 'synthesized', 'synthetic'],
  'rage_rap': ['speech-mimicking', 'rhythmic-speech', 'layered-ambient', 'synthesized', 'synthetic'],
  'greenwich_village_confessional': ['folk', 'folk-tradition', 'intimate-aspirated', 'speech-derived', 'rapid-tremolo'],
  'interior_confessional_60s': ['folk', 'folk-tradition', 'intimate-aspirated', 'speech-derived'],
  'laurel_canyon_70s': ['folk', 'folk-tradition', 'intimate-aspirated', 'speech-derived'],
  'britfolk_revival': ['folk', 'folk-tradition', 'intimate-aspirated', 'speech-derived', 'singing-sustain', 'warm-glowing'],
  'antifolk_nyc': ['folk', 'folk-tradition', 'intimate-aspirated', 'speech-derived', 'sacred-Latin', 'lament-leaning'],
  'indie_folk_2000s': ['folk', 'folk-tradition', 'intimate-aspirated', 'speech-derived'],
  'freak_folk_2000s': ['folk', 'folk-tradition', 'intimate-aspirated', 'speech-derived'],
  'texas_country_folk_storyteller': ['folk', 'folk-tradition', 'intimate-aspirated', 'speech-derived', 'twangy-foundational', 'country-twang'],
  'bedroom_singer_song': ['folk', 'folk-tradition', 'intimate-aspirated', 'speech-derived'],
  'sean_nos_solo': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning', 'sean-nos', 'unaccompanied', 'gaelic-tradition', 'free-rhythm', 'ornamented'],
  'bothy_ballad_doric': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning'],
  'child_ballad_revival': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning'],
  'english_broadside_revival': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning'],
  'welsh_hymn_balladry': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning'],
  'cape_breton_milling': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning'],
  'newfoundland_outport': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning'],
  'piedmont_fingerpicking': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'lament-leaning'],
  'parchman_prison_song': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'lament-leaning'],
  'field_holler_solo': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'lament-leaning'],
  'hokum_blues_vaudeville': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'lament-leaning'],
  'classic_blues_women': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'lament-leaning'],
  'talking_blues_dustbowl': ['blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'lament-leaning', 'half-sung', 'sprechgesang-vocal'],
  'chanson_classique': ['fado-lead', 'university-fado', 'iberian-celtic', 'celtic', 'lament-leaning', 'mournful', 'french', 'french-trad', 'french-musette-ready', 'half-sung', 'sprechgesang-vocal'],
  'fado_coimbra_university': ['fado-lead', 'university-fado', 'iberian-celtic', 'celtic', 'lament-leaning', 'mournful'],
  'greek_entechno': ['fado-lead', 'university-fado', 'iberian-celtic', 'celtic', 'lament-leaning', 'mournful'],
  'nwobhm': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'progressive_metal_classic': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'power_metal_european': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'symphonic_metal_classic': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'folk_metal_european': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'avant_metal_classic': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'deep_house_soulful': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky'],
  'garage_house_paradise': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky'],
  'lofi_house_aesthetic': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky'],
  'italo_house_piano': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky', 'hot-pressed', 'firm-felt', 'bright-modern', 'japanese-factory', 'asian-spruce', 'asian-laminated', 'birch-laminated', 'a-440'],
  'latin_house_percussion': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky'],
  'black_gospel_choir': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'liturgical', 'sacred-traditional', 'ceremonial'],
  'sacred_harp_singing': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'sacred-Latin', 'liturgical', 'medieval', 'sacred-traditional', 'ceremonial', 'ecstatic', 'harmonizing-foundational'],
  'anglican_choral_evensong': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'sacred-Latin', 'liturgical', 'medieval', 'sacred-traditional', 'ceremonial', 'court-ceremonial', 'sustained-high-register'],
  'russian_orthodox_chant': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'sacred-Latin', 'liturgical', 'medieval', 'mournful', 'sacred-traditional', 'ceremonial', 'court-ceremonial', 'chant-foundational', 'chorus-chant'],
  'coptic_liturgical': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'sacred-Latin', 'liturgical', 'medieval', 'ornamental-melismatic', 'sacred-traditional', 'ceremonial', 'chant-foundational', 'monastic-chant'],
  'bro_country': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'twangy-foundational'],
  'hot_country_2010s': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'twangy-foundational'],
  'country_pop_crossover': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'twangy-foundational'],
  'country_rap_hick_hop': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'twangy-foundational'],
  'rumba_yambu': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'rumba_columbia': ['dance-driving', 'dance-rhythm', 'swung', 'funk-derived', 'jazz-influenced'],
  'traditional_doom': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'mournful', 'dark-romantic'],
  'funeral_doom': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'mournful', 'dark-romantic'],
  'melodic_death_swedish': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'technical_death_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'brutal_death_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'norwegian_2nd_wave_black': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass'],
  'gospel_quartet_male': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'liturgical', 'sacred-traditional', 'ceremonial', 'blues-shouter', 'characteristic-cry', 'harmonizing-foundational', 'harmony-stacked-multi-part'],
  'contemporary_urban_gospel': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'liturgical'],
  'southern_gospel_quartet': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'liturgical', 'sacred-traditional', 'ceremonial', 'harmonizing-foundational', 'harmony-stacked-multi-part'],
  'bluegrass_gospel': ['gospel-rooted', 'gospel-runs', 'gospel-friendly', 'devotional', 'congregation-loud', 'liturgical', 'sacred-traditional', 'ceremonial', 'harmonizing-foundational', 'harmony-stacked-multi-part'],
  'modern_vocal_jazz': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'enunciated-diction', 'scat', 'jazz-improvisation'],
  'cool_jazz_vocal': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'enunciated-diction', 'hand-hammered', 'pin-lathed', 'controlled-decay', 'scat', 'jazz-improvisation'],
  'tech_house_classic': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky'],
  'minimal_tech_house': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky'],
  'drone_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'mournful', 'dark-romantic'],
  'dsbm_black_metal': ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'mournful', 'dark-romantic'],
  'minimal_microhouse_classic': ['dance-driving', 'dance-friendly', 'synthesized', 'synthetic', 'funky'],
  'jam_band': ['jazz-trained', 'jazz-influenced', 'rock-context', 'jazz-friendly', 'classical-jazz'],
  'free_improvisation': ['jazz-trained', 'jazz-influenced', 'rock-context', 'jazz-friendly', 'classical-jazz'],
  'electroacoustic_improv': ['jazz-trained', 'jazz-influenced', 'rock-context', 'jazz-friendly', 'classical-jazz'],
  'j_rock': ['rock-context', 'rock-context', 'distorted', 'high-gain-saturation'],
  'anadolu_rock': ['rock-context', 'rock-context', 'distorted', 'high-gain-saturation'],
  'russian_rock': ['rock-context', 'rock-context', 'distorted', 'high-gain-saturation'],
  'latin_alternative': ['rock-context', 'rock-context', 'distorted', 'high-gain-saturation'],
  'musique_concrete': ['surface-noise-bedded', 'articulated', 'synthesized', 'minimal'],
  'electroacoustic_composition': ['surface-noise-bedded', 'articulated', 'synthesized', 'minimal'],
  'plunderphonics': ['surface-noise-bedded', 'articulated', 'synthesized', 'minimal', 'sample-foundational', 'vinyl-sampled'],
  'early_rock_and_roll_50s': ['rock-context', 'rock-context', 'rock-context', 'folk-rock', 'distorted'],
  'rockabilly_50s': ['folk', 'folk-rock', 'folkloric', 'walking', 'dance-friendly', 'twangy-foundational', 'country-twang'],
  'pre_sampling_hip_hop_1979_1985': ['speech-mimicking', 'speech-mimicry', 'rhythmic-speech', 'funk-derived', 'sub-bass'],
  'golden_age_hip_hop_1986_1991': ['speech-mimicking', 'speech-mimicry', 'rhythmic-speech', 'funk-derived', 'sub-bass', 'sample-foundational', 'vinyl-sampled'],
  'contemporary_rb_late_90s_2000s': ['gospel-rooted', 'gospel-runs', 'blues-derived', 'blues-inflected', 'funky'],
  'garage_rock_revival_2000s': ['rock-context', 'rock-context', 'rock-context', 'folk-rock', 'distorted'],
  'minneapolis_synth_funk_pop': ['funky', 'funk-derived', 'funk-friendly', 'funk-friendly', 'backbeat', 'swung', 'machine-hammered', 'symmetric-pattern', 'full-lathed'],
  'tiktok_era_streaming_pop': ['rock-context', 'rock-context', 'smoothed', 'synthesized'],
  'globalized_african_pop_crossover': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-driving'],
  'british_invasion_rb': ['rock-context', 'rock-context', 'rock-context', 'folk-rock', 'distorted'],
  'khayal': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'melismatic', 'devotional', 'sacred-traditional', 'meditative-tempo', 'contemplative'],
  'tappa': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'melismatic', 'devotional', 'sacred-traditional', 'meditative-tempo', 'contemplative'],
  'dadra': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'melismatic'],
  'tarana': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'melismatic'],
  'kriti': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'devotional', 'drone-foundation', 'sacred-traditional'],
  'padam': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'devotional', 'drone-foundation', 'sacred-traditional'],
  'javali': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'devotional', 'drone-foundation', 'sacred-traditional'],
  'tillana': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'devotional', 'drone-foundation', 'sacred-traditional'],
  'sikh_gurmat_sangeet': ['raga-bound', 'dhrupad-suited', 'Hindu-ritual', 'devotional', 'drone-foundation', 'sacred-traditional'],
  'sufi_sama': ['sufi', 'sufi-mystical', 'ornamental-melismatic', 'melismatic', 'devotional', 'ornament-heavy', 'ceremonial', 'court-ceremonial'],
  'tropicalia': ['samba-foundation', 'samba-foundational', 'samba-batería', 'dance-driving', 'dance-rhythm', 'swung'],
  'mpb': ['samba-foundation', 'samba-foundational', 'samba-batería', 'dance-driving', 'dance-rhythm', 'swung'],
  'maracatu': ['samba-foundation', 'samba-foundational', 'samba-batería', 'dance-driving', 'dance-rhythm', 'swung'],
  'frevo': ['samba-foundation', 'samba-foundational', 'samba-batería', 'dance-driving', 'dance-rhythm', 'swung'],
  'axe_music': ['samba-foundation', 'samba-foundational', 'samba-batería', 'dance-driving', 'dance-rhythm', 'swung'],
  'sertanejo': ['samba-foundation', 'samba-foundational', 'samba-batería', 'dance-driving', 'dance-rhythm', 'swung'],
  'capoeira_music': ['African-traditional', 'African-derived', 'pan-African', 'ceremonial', 'devotional'],
  'baiao': ['samba-foundation', 'samba-foundational', 'samba-batería', 'dance-driving', 'dance-rhythm', 'swung'],
  'embolada': ['samba-foundation', 'samba-foundational', 'samba-batería', 'dance-driving', 'dance-rhythm', 'swung'],
  'jongo': ['African-traditional', 'African-derived', 'pan-African', 'ceremonial', 'devotional'],
  'bomba_puertorican': ['African-traditional', 'African-derived', 'pan-African', 'ceremonial', 'devotional'],
  'plena_puertorican': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving'],
  'jibaro': ['iberian-celtic', 'folk', 'folk-tradition', 'dark-romantic', 'lament-leaning'],
  'parang_trini': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving'],
  'punta_garifuna': ['African-traditional', 'African-derived', 'pan-African', 'ceremonial', 'devotional'],
  'garifuna_paranda': ['African-traditional', 'African-derived', 'pan-African', 'ceremonial', 'devotional'],
  'cadence_lypso': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving'],
  'kompa_direkt': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving'],
  'bouyon': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving'],
  'chouval_bwa': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving'],
  'soca_soul': ['dub-friendly', 'walking-bass', 'swung', 'funky', 'dance-driving'],
  'shaabi_egyptian': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'dance-driving'],
  'mahraganat': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'dance-driving'],
  'chaabi_moroccan': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'dance-driving'],
  'tarab_egyptian': ['sufi-mystical', 'ornamental-melismatic', 'melismatic', 'ornament-heavy', 'classical-radif', 'Middle-Eastern', 'devotional', 'court-ceremonial'],
  'arabesk_turkish': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'dance-driving'],
  'mizrahi_israeli': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'dance-driving'],
  'persian_pop_los_angeles': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'dance-driving'],
  'lebanese_pop_tarab': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'dance-driving'],
  'malhun_maghrebi': ['sufi-mystical', 'ornamental-melismatic', 'melismatic', 'ornament-heavy', 'classical-radif', 'Middle-Eastern', 'devotional', 'court-ceremonial'],
  'iraqi_maqam': ['sufi-mystical', 'ornamental-melismatic', 'melismatic', 'ornament-heavy', 'classical-radif', 'Middle-Eastern', 'devotional', 'court-ceremonial', 'arabic-maqam', 'quartertone', 'modal-improvisation', 'tarab'],
  'shomyo_japanese': ['sacred-traditional', 'drone-foundation', 'drone-like', 'ceremonial', 'sustained-tone', 'liturgical', 'devotional', 'meditative-tempo', 'contemplative', 'chant-foundational', 'monastic-chant'],
  'theravada_pali_chant': ['sacred-traditional', 'drone-foundation', 'drone-like', 'ceremonial', 'sustained-tone', 'liturgical', 'devotional', 'meditative-tempo', 'contemplative', 'chant-foundational', 'monastic-chant', 'chorus-chant'],
  'pure_land_buddhist': ['sacred-traditional', 'drone-foundation', 'drone-like', 'ceremonial', 'sustained-tone', 'liturgical', 'devotional', 'meditative-tempo', 'contemplative', 'chant-foundational', 'monastic-chant'],
  'beompae_korean': ['sacred-traditional', 'drone-foundation', 'drone-like', 'ceremonial', 'sustained-tone', 'liturgical', 'devotional', 'meditative-tempo', 'contemplative', 'chant-foundational', 'monastic-chant', 'chorus-chant'],
  'vajrayana_broader': ['sacred-traditional', 'drone-foundation', 'drone-like', 'ceremonial', 'sustained-tone', 'chant-foundational', 'monastic-chant', 'chorus-chant'],
  'bongo_flava': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-driving'],
  'genge_kenyan': ['speech-mimicking', 'speech-mimicry', 'rhythmic-speech', 'funk-derived', 'sub-bass'],
  'ethio_pop_modern': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-driving'],
  'sahel_praise': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'dance-driving'],
  'mande_griot': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'folk-tradition'],
  'wassoulou': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'folk-tradition'],
  'algerian_rap': ['speech-mimicking', 'speech-mimicry', 'rhythmic-speech', 'funk-derived', 'sub-bass', 'sample-foundational'],
  'ecm_jazz_aesthetic': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'jazz-friendly', 'classical-jazz', 'swung', 'sitka-spruce', '17-ply', 'hard-rock-maple', 'soft-felt', 'lacquer-voiced', 'a-440'],
  'hyperion_classical_aesthetic': ['classical', 'baroque-leaning', 'romantic', 'dark-romantic', 'late-Romantic-onward', 'contemporary-classical', 'haunted-romantic', 'pressed', 'vibrato-y', 'projecting', 'rapid-tremolo', 'soft-onset', 'intimate-aspirated', 'historical-gut', 'silver-wound', 'period-performance', 'norway-spruce', 'bosnian-source', 'oil-varnish', 'modern-setup', 'sitka-spruce', 'diaphragmatic', 'hard-rock-maple', '17-ply', '7-ply', 'quartersawn-maple', 'gray-iron', 'full-perimeter', 'a-440', 'modern-pitch', 'soft-felt', 'lacquer-voiced'],
  'historical_informed_performance': ['baroque-leaning', 'baroque-leaning', 'baroque-soloistic', 'Italian-baroque', 'medieval', 'sacred-Latin', 'classical', 'liturgical', 'devotional', 'sacred-traditional', 'ceremonial', 'sustained-high-register'],
  'anglican_choral_cathedral': ['classical', 'baroque-leaning', 'romantic', 'dark-romantic', 'late-Romantic-onward', 'contemporary-classical', 'sacred-Latin', 'liturgical', 'medieval', 'devotional', 'sacred-traditional', 'ceremonial', 'court-ceremonial', 'German-traditional', 'marching'],
  'manhattan_chamber_loft': ['classical', 'baroque-leaning', 'romantic', 'dark-romantic', 'late-Romantic-onward', 'contemporary-classical', 'haunted-romantic', 'vintage-steinway', 'pre-war', '18-ply', 'aged-felt', 'a-440'],
  'chinese_traditional_ensemble': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'drone-foundation', 'sustained-tone', 'Chinese-classical'],
  'vietnamese_traditional': ['naturally-reverberant', 'drone-foundation', 'drone-like', 'ornamental-melismatic', 'minimal'],
  'bengali_baul': ['raga-bound', 'Hindu-ritual', 'devotional', 'melismatic', 'folk-tradition'],
  'finnish_kantele_folk': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning'],
  'swedish_nyckelharpa_folk': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning'],
  'russian_byliny': ['european-folk', 'folkloric', 'dark-romantic', 'lament-leaning', 'folk-tradition'],
  'russian_folk_balalaika_choir': ['european-folk', 'folkloric', 'dark-romantic', 'lament-leaning', 'folk-tradition'],
  'hungarian_cimbalom_trad': ['european-folk', 'folkloric', 'folk-tradition', 'ornamental-melismatic', 'sufi-mystical', 'devotional', 'court-ceremonial'],
  'bulgarian_dance_traditional': ['dance-rhythm', 'dance-driving', 'swung', 'folkloric'],
  'breton_folk': ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning'],
  'sardinian_traditional': ['urban-Greek', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'iberian-celtic'],
  'italian_southern_folk': ['urban-Greek', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'iberian-celtic', 'italian', 'italian', 'southern-Italian'],
  'japanese_taiko_ensemble': ['gagaku-foundational', 'naturally-reverberant', 'minimal', 'ceremonial', 'keyaki', 'zelkova', 'single-log', 'kurinuki-construction'],
  'armenian_traditional': ['Middle-Eastern', 'Turkish-makam-base', 'ornamental-melismatic', 'ornament-heavy', 'sufi-mystical', 'devotional', 'court-ceremonial'],
  'turkish_romani_cumbus': ['sufi-mystical', 'ornamental-melismatic', 'melismatic', 'ornament-heavy', 'classical-radif', 'Middle-Eastern', 'devotional', 'court-ceremonial'],
  'hausa_court_music': ['African-traditional', 'African-derived', 'pan-African', 'African-craft', 'folk-tradition'],
  'barbershop_quartet': ['jazz-trained', 'jazz-influenced', 'jazz-friendly', 'classical-jazz', 'smoothed', 'jazz-friendly', 'harmonizing-foundational', 'harmony-stacked-multi-part'],
  'british_brass_band': ['classical', 'baroque-leaning', 'romantic', 'dark-romantic', 'late-Romantic-onward', 'contemporary-classical', 'haunted-romantic'],
  'american_drumline': ['marching', 'marching-bateria', 'military-tight', 'tight-rhythmic-articulation', 'tight-low-end'],
  'tango_traditional': ['iberian-celtic', 'folk', 'folk-tradition', 'dark-romantic', 'lament-leaning'],
  'banda_sinaloense': ['characteristic-cry'],
  'norteno': ['characteristic-cry'],
};

// ---- Catalog: the tradition data layer ----
// EVERY tradition read in the app goes through this object — no other code may
// touch the TRADITIONS / TRADITION_EXTRAS globals directly. Two boot modes:
//   • embedded — the reference tables are present as globals (the `--embedded`
//     build, and every node harness that boots it). Everything is
//     in memory up front; `ensureFull` resolves immediately and the sync
//     import path behaves exactly as it always has.
//   • lazy — boots from api/browse.json, the light Tier-1 index (id/name/
//     family/lineage/parent/13 axes/instruments/description/exemplars/
//     crossRefs). That index powers search, the tree, find-similar, and
//     fingerprints entirely locally — identical recall and display to the
//     embedded build. The only fields NOT in the index are the few row fields
//     an IMPORT needs (tuning/room/parts/chain_*); those are fetched once per
//     tradition from api/traditions/{id}.json (its `source` field) and cached.
//     This is what lets the catalog scale past the single-file embed ceiling
//     with no server and no per-action lag outside a tradition's first import.
const Catalog = (() => {
  let _list = [];            // light rows in catalog order — id/name/family/lineage/instruments
  const _byId = new Map();   // id → light row
  const _ext = new Map();    // id → extras: parent/axes/description/exemplars/crossRefs
  const _full = new Map();   // id → row WITH import fields (tuning/room/parts/chain_*)
  let _apiBase = null;       // non-null once lazy-booted (e.g. 'api/')

  function bootFromGlobals() {
    if (typeof TRADITIONS === 'undefined') return false;
    _list = TRADITIONS;
    for (const t of TRADITIONS) { _byId.set(t.id, t); _full.set(t.id, t); }
    if (typeof TRADITION_EXTRAS !== 'undefined') {
      for (const id of Object.keys(TRADITION_EXTRAS)) _ext.set(id, TRADITION_EXTRAS[id]);
    }
    return true;
  }

  // Boot from a fetched browse index (lazy mode). Axes arrive as a compact
  // 13-array in the file's axisKeys order; remap to the named object the
  // similarity/fingerprint code reads.
  function bootFromIndex(browse, apiBase) {
    const keys = browse.axisKeys || [];
    _apiBase = apiBase || 'api/';
    _list = [];
    for (const it of browse.items || []) {
      const row = { id: it.id, name: it.name, family: it.family, lineage: it.lineage || null, instruments: it.instruments || [] };
      _list.push(row);
      _byId.set(it.id, row);
      const axes = {};
      (it.axes || []).forEach((v, i) => { if (keys[i]) axes[keys[i]] = v; });
      _ext.set(it.id, {
        parent: it.parent || null,
        axes,
        description: it.description || '',
        exemplars: it.exemplars || [],
        crossRefs: it.crossRefs || [],
      });
    }
    return _list.length > 0;
  }

  // Resolve the FULL row (light fields + import fields) for one tradition.
  // Embedded mode and already-fetched ids resolve immediately; lazy mode
  // fetches traditions/{id}.json once and merges its `source` over the light
  // row. UI entry points await this BEFORE calling the (sync) importTradition.
  async function ensureFull(id) {
    if (_full.has(id)) return _full.get(id);
    const row = _byId.get(id);
    if (!row || !_apiBase) return row || null;
    const res = await fetch(_apiBase + 'traditions/' + encodeURIComponent(id) + '.json');
    if (!res.ok) throw new Error('tradition fetch failed: ' + id + ' (' + res.status + ')');
    const rec = await res.json();
    const full = Object.assign({}, row, rec.source || {});
    _full.set(id, full);
    return full;
  }

  return {
    bootFromGlobals,
    bootFromIndex,
    all: () => _list,                  // light rows — iteration (search/tree/similar)
    get: (id) => _byId.get(id),        // light row — name/family/lineage/instruments
    ext: (id) => _ext.get(id),         // extras — parent/axes/description/exemplars/crossRefs
    fullSync: (id) => _full.get(id),   // cached full row only — importTradition's sync read
    ensureFull,                        // async — the ONE await point, before import
  };
})();

// ---- Lookups ----
// O(1) ID indexes built once at boot from the catalog arrays. Every render
// path used to call `.find()` linear scans on these arrays — at 40+ cards
// the cumulative cost of scanning 1090 traditions × 421 instruments × N
// chain items × variants dominated the per-render budget (the heaviest
// single hot path, `findTraditionsByVector`, alone cost ~1M ops/render).
// Maps push every lookup to constant time without changing call sites.
const _INST_BY_ID = new Map();
const _ROOM_BY_ID = new Map();
const _TUNING_BY_ID = new Map();
const _FAM_BY_ID = new Map();
const _CHAIN_ITEMS_BY_SECTION = new Map();   // sectionId → Map<itemId, item>
const _VARIANTS_BY_INST = new Map();         // instId → Map<partId, Map<variantId, variant>>

(function _buildIdIndexes() {
  if (typeof INSTRUMENTS !== 'undefined') {
    for (const inst of INSTRUMENTS) {
      _INST_BY_ID.set(inst.id, inst);
      const partMap = new Map();
      for (const part of (inst.parts || [])) {
        const variantMap = new Map();
        for (const v of (part.variants || [])) variantMap.set(v.id, v);
        partMap.set(part.id, variantMap);
      }
      _VARIANTS_BY_INST.set(inst.id, partMap);
    }
  }
  Catalog.bootFromGlobals(); // traditions route through the Catalog layer (lazy boot replaces this in the shell build)
  if (typeof ROOMS !== 'undefined') for (const r of ROOMS) _ROOM_BY_ID.set(r.id, r);
  if (typeof TUNINGS !== 'undefined') for (const t of TUNINGS) _TUNING_BY_ID.set(t.id, t);
  if (typeof INSTRUMENT_FAMILIES !== 'undefined') for (const f of INSTRUMENT_FAMILIES) _FAM_BY_ID.set(f.id, f);
  if (typeof CHAIN_SECTIONS !== 'undefined') {
    for (const sec of CHAIN_SECTIONS) {
      const m = new Map();
      for (const it of (sec.items || [])) m.set(it.id, it);
      _CHAIN_ITEMS_BY_SECTION.set(sec.id, m);
    }
  }
})();

// ---- Catalog boot promise (lazy shell) ----
// The lazy build (the `build_html.js` default) omits the traditions/extras
// tables from the page and injects `CODEX_LAZY_API` ahead of the app code. In that
// build the Catalog boots from ONE fetch of api/browse.json — everything the
// browse surfaces read. The embedded build takes the other branch (null):
// bootFromGlobals already ran synchronously above, so its init path keeps
// today's fully synchronous timing, byte-identical behavior.
const CATALOG_READY = (typeof CODEX_LAZY_API !== 'undefined' && !Catalog.all().length)
  ? fetch(CODEX_LAZY_API + 'browse.json')
      .then((res) => {
        if (!res.ok) throw new Error('browse index fetch failed (' + res.status + ')');
        return res.json();
      })
      .then((browse) => {
        if (!Catalog.bootFromIndex(browse, CODEX_LAZY_API)) {
          throw new Error('browse index is empty');
        }
      })
  : null;

const _traditionSignatureFor = (tradId) => (tradId && TRADITION_SIGNATURES[tradId]) || [];

// ─────────────────────────────────────────────────────────────────────────
// TRADITION GLYPH SYSTEM — emoji/SVG iconography for traditions, restored to
// full parity. Decorates sidebar tradition headers, the tradition picker tree,
// and the multi-card recipe signature. Data: function/axis2 glyph maps, GLYPH_META
// (label/kind), codepoint map, and inlined Twemoji SVG artwork.
// ─────────────────────────────────────────────────────────────────────────
const TRADITION_FUNCTION_GLYPH = {
  "droneModal": "🌀",
  "functionalSong": "📻",
  "improvOnFrame": "🎷",
  "distortedRock": "🎸",
  "mcRhythm": "🎤",
  "groovePercussion": "🥁",
  "artMusic": "🏛️",
  "balladPoetry": "📜",
  "ritualDevotional": "📿",
  "bassSystem": "🔊",
  "electronicDance": "🪩",
  "experimentalElec": "🎧",
  "lullaby": "🌙",
  "wedding": "💒",
  "funeralLament": "🥀",
  "seaShanty": "⚓",
  "fieldWork": "🌾",
  "domesticRhythm": "🧵",
  "huntingSong": "🏹",
  "nurseryRhyme": "🧸",
  "drinkingSong": "🍺",
  "carnivalProcessional": "🎭",
  "praiseSong": "👑",
  "protestSong": "✊"
};

const TRADITION_AXIS2_OVERRIDE = {
  "droneModal.vocal": "🕯",
  "droneModal.string": "🦢",
  "droneModal.modalElectric": "💀",
  "droneModal.overtone": "🐎",
  "droneModal.windPipe": "☘️",
  "droneModal.appalachian": "⛰️",
  "functionalSong.country": "🤠",
  "functionalSong.country.preCommercial": "🐄",
  "functionalSong.country.westernSwing": "🐄",
  "functionalSong.soulRb.doowop": "💈",
  "functionalSong.popRock.girlGroup": "🍨",
  "functionalSong.popRock.synthpop": "💾",
  "functionalSong.popRock.newWave": "🛸",
  "functionalSong.popRock.folkRock": "🌻",
  "functionalSong.popRock.skiffle": "🫖",
  "functionalSong.popRock.yachtRock": "⛵️",
  "functionalSong.soulRb": "❤️",
  "functionalSong.crooners": "🍾",
  "functionalSong.popRock": "🌟",
  "functionalSong.bluesElectric": "🚂",
  "functionalSong.bluesAcoustic": "🚂",
  "functionalSong.mexican": "🌵",
  "functionalSong.brazilianSong": "🏖️",
  "functionalSong.tropicalSong": "🌴",
  "functionalSong.tejanoBorder": "🌵",
  "functionalSong.eastAsianPop": "🏮",
  "functionalSong.eastAsianPop.enka": "⛩️",
  "functionalSong.southAsianPop": "🛕",
  "functionalSong.europop": "🏰",
  "functionalSong.africanPop": "🪘",
  "functionalSong.africanPop.isicathamiya": "🪇",
  "functionalSong.midEastNAfricanPop": "🕌",
  "functionalSong.iberian": "🌹",
  "improvOnFrame.americanJazz": "🍸",
  "improvOnFrame.americanJazz.early": "🐊",
  "improvOnFrame.americanJazz.boogieWoogie": "🚂",
  "improvOnFrame.americanJazz.latinJazz": "🌴",
  "improvOnFrame.stringImprov": "🦢",
  "improvOnFrame.bluegrass": "🤠",
  "improvOnFrame.latinJazz": "🌴",
  "improvOnFrame.indianClassicalImprov": "🛕",
  "improvOnFrame.persianArabImprov": "🕌",
  "improvOnFrame.celticTraditional": "☘️",
  "improvOnFrame.klezmerImprov": "🕍",
  "improvOnFrame.jamFree": "🌻",
  "distortedRock.classic": "🌻",
  "distortedRock.surfRock": "⛱️",
  "distortedRock.lateAnalogMajor": "🏟",
  "distortedRock.metal": "💀",
  "distortedRock.punk": "🧷",
  "distortedRock.popPunk": "🛹",
  "distortedRock.emo": "🥹",
  "distortedRock.southernRock": "🤠",
  "distortedRock.noiseRock": "☣",
  "distortedRock.alternative": "🫠",
  "distortedRock.experimental": "👽",
  "distortedRock.progressiveRock": "🪐",
  "distortedRock.gothicRock": "🦇",
  "distortedRock.artRock": "🩰",
  "distortedRock.glamRock": "🍄",
  "distortedRock.regional": "💀",
  "mcRhythm.usHipHop": "🏙️",
  "mcRhythm.usHipHop.eastCoast": "🗽",
  "mcRhythm.usHipHop.westCoast": "🌇",
  "mcRhythm.usHipHop.southern": "🍑",
  "mcRhythm.usHipHop.gangsta": "🗡️",
  "mcRhythm.usHipHop.consciousRap": "📋",
  "mcRhythm.intlHipHop": "🥾",
  "mcRhythm.drill": "🗡️",
  "mcRhythm.reggaeton": "🌴",
  "mcRhythm.afroDiasporic": "🪇",
  "mcRhythm.experimental": "👽",
  "groovePercussion.westAfrican": "🪘",
  "groovePercussion.centralEastSouthAfrican": "🪇",
  "groovePercussion.cuban": "🌴",
  "groovePercussion.brazilian": "🏖️",
  "groovePercussion.latinAm": "🪅",
  "groovePercussion.caribbean": "🌴",
  "groovePercussion.afroDiasporicElec": "🪇",
  "groovePercussion.funkPercussive": "🏙️",
  "groovePercussion.eastAsian": "🏮",
  "groovePercussion.eastAsian.samulNori": "🪭",
  "groovePercussion.americanMarching": "🏟",
  "balladPoetry.indianBard": "🛕",
  "artMusic.westernEarly": "🏰",
  "artMusic.westernCommonPractice": "🦢",
  "artMusic.westernModern": "👽",
  "artMusic.southAsian": "🛕",
  "artMusic.eastAsian": "🏮",
  "artMusic.eastAsian.beijingOpera": "🐉",
  "artMusic.eastAsian.cantoneseOpera": "🐉",
  "artMusic.middleEasternClassical": "🕌",
  "artMusic.southeastAsian": "🪷",
  "balladPoetry.angloSingerSong": "🌻",
  "balladPoetry.chansonFado": "🌹",
  "balladPoetry.latinAmTroubadour": "🏔️",
  "balladPoetry.latinAmTroubadour.milonga": "🌃",
  "balladPoetry.slavicBard": "🪆",
  "balladPoetry.celticBalladic": "☘️",
  "balladPoetry.medEastPoetic": "🕌",
  "balladPoetry.bluesNarrative": "🚂",
  "balladPoetry.mediterraneanBallad": "🏺",
  "balladPoetry.westAfricanGriot": "🪘",
  "ritualDevotional.christianGospel": "⛪",
  "ritualDevotional.sufi": "🕌",
  "ritualDevotional.hindu": "🪔",
  "ritualDevotional.buddhist": "🪷",
  "ritualDevotional.jewish": "🕍",
  "ritualDevotional.islamic": "🕌",
  "ritualDevotional.afroDiasporic": "🔥",
  "ritualDevotional.indigenous": "🪶",
  "ritualDevotional.americanSacred": "🤠",
  "bassSystem.jamaican": "🌿",
  "bassSystem.ukSoundsystem": "🚇",
  "bassSystem.bassDescendants": "🚇",
  "bassSystem.dubDescendants": "🛸",
  "bassSystem.reggaeDiaspora": "🌿",
  "electronicDance.house": "🏙️",
  "electronicDance.techno": "⚒",
  "electronicDance.trance": "🌖",
  "electronicDance.hardstyle": "🗡️",
  "electronicDance.continental": "🏰",
  "electronicDance.africanDance": "🪇",
  "electronicDance.latinElec": "🌴",
  "electronicDance.footwork": "🏙️",
  "electronicDance.eurodance": "🍾",
  "experimentalElec.ambient": "☁️",
  "experimentalElec.idmGlitch": "👾",
  "experimentalElec.industrialNoise": "☣",
  "experimentalElec.retroAesthetic": "🛸",
  "experimentalElec.popExperimental": "🦄",
  "experimentalElec.lofi": "😴",
  "experimentalElec.musiqueConcrete": "🧰",
  "balladPoetry.angloSingerSong.britfolk": "🌳",
  "balladPoetry.angloSingerSong.antiFolk": "🏴‍☠️",
  "balladPoetry.angloSingerSong.indieFolk": "🥾",
  "balladPoetry.angloSingerSong.freakFolk": "🍄",
  "balladPoetry.angloSingerSong.countryFolkStory": "🤠",
  "balladPoetry.angloSingerSong.bedroomSingerSong": "😴",
  "balladPoetry.celticBalladic.englishBroadside": "🌳",
  "balladPoetry.celticBalladic.welshHymnBallad": "🌳",
  "balladPoetry.celticBalladic.capeBretonGaelic": "🍁",
  "balladPoetry.celticBalladic.newfoundlandRevival": "🍁",
  "balladPoetry.bluesNarrative.workSong": "⚒",
  "balladPoetry.bluesNarrative.prisonSong": "⛏",
  "balladPoetry.bluesNarrative.fieldHoller": "🚜",
  "balladPoetry.bluesNarrative.hokumBlues": "🍺",
  "balladPoetry.bluesNarrative.jugBand": "🍺",
  "balladPoetry.bluesNarrative.classicBluesWomen": "🌟",
  "balladPoetry.bluesNarrative.talkingBlues": "📋",
  "balladPoetry.chansonFado.classicChanson": "🎩",
  "balladPoetry.chansonFado.postChanson": "🎩",
  "balladPoetry.chansonFado.greekEntechno": "🏺",
  "distortedRock.metal.thrash": "🤬",
  "distortedRock.metal.death": "☣",
  "distortedRock.metal.black": "🦇",
  "distortedRock.metal.doom": "🕯",
  "distortedRock.metal.sludge": "☣",
  "distortedRock.metal.drone": "🕯",
  "distortedRock.metal.prog": "🪐",
  "distortedRock.metal.power": "🎖",
  "distortedRock.metal.symphonic": "🦢",
  "distortedRock.metal.folkMetal": "🥾",
  "distortedRock.metal.postMetal": "☁️",
  "distortedRock.metal.avant": "👽",
  "electronicDance.house.lofiHouse": "😴",
  "electronicDance.house.italoHouse": "🏰",
  "electronicDance.house.latinHouse": "🌴",
  "ritualDevotional.christianGospel.spirituals": "🤠",
  "ritualDevotional.christianGospel.jubileeQuartet": "💈",
  "ritualDevotional.christianGospel.anglicanChoral": "🌳",
  "ritualDevotional.christianGospel.russianOrthodox": "🪆",
  "ritualDevotional.christianGospel.pentecostal": "🔥",
  "ritualDevotional.christianGospel.southernGospel": "🤠",
  "droneModal.heterophonic": "🕯",
  "ritualDevotional.indigenous.arctic": "❄️",
  "artMusic.eastAsian.tibetanRitual": "🏔️",
  "lullaby.european": "🏰",
  "lullaby.eastAsian": "🏮",
  "lullaby.southAsian": "🛕",
  "lullaby.middleEastern": "🕌",
  "wedding.european": "🏰",
  "wedding.middleEastern": "🕌",
  "wedding.southAsian": "🛕",
  "wedding.eastAsian": "🏮",
  "wedding.africanDiasporic": "🪘",
  "wedding.americas": "🌽",
  "funeralLament.european": "🏰",
  "funeralLament.middleEastern": "🕌",
  "funeralLament.southAsian": "🛕",
  "funeralLament.eastAsian": "🏮",
  "funeralLament.africanDiasporic": "🪘",
  "funeralLament.oceaniaPacific": "🌺",
  "nurseryRhyme.european": "🏰",
  "nurseryRhyme.eastAsian": "🏮",
  "nurseryRhyme.southAsian": "🛕",
  "nurseryRhyme.middleEastNAfrican": "🕌",
  "nurseryRhyme.subSaharanAfrican": "🪘",
  "nurseryRhyme.americas": "🌽",
  "drinkingSong.european": "🏰",
  "drinkingSong.balkan": "⛰️",
  "drinkingSong.eastAsian": "🏮",
  "drinkingSong.americas": "🌽",
  "praiseSong.subSaharanAfrican": "🪘",
  "praiseSong.indianSubcontinent": "🪔",
  "praiseSong.celticBritish": "☘️",
  "praiseSong.oceaniaPacific": "🌺",
  "praiseSong.middleEastNAfrican": "🕌",
  "protestSong.angloAmerican": "📋",
  "protestSong.iberianLatin": "🏔️",
  "protestSong.european": "🪖",
  "protestSong.middleEastNAfrican": "🕌",
  "protestSong.eastAsian": "🪭",
  "protestSong.subSaharanAfrican": "🪇",
  "protestSong.urbanAmerican": "🏙️",
  "seaShanty.atlantic": "🏴‍☠️",
  "seaShanty.mediterranean": "🏺",
  "seaShanty.northSeaBaltic": "🌲",
  "fieldWork.americanSouth": "🚜",
  "fieldWork.slavicBalkan": "🪆",
  "fieldWork.eastAsian": "🏮",
  "fieldWork.southAsian": "🛕",
  "fieldWork.subSaharanAfrican": "🪘",
  "fieldWork.andean": "🏔️",
  "huntingSong.subSaharanAfrican": "🪘",
  "huntingSong.centralAsian": "🐎",
  "huntingSong.arctic": "❄️",
  "huntingSong.indigenous": "🪶",
  "domesticRhythm.celticHebridean": "☘️",
  "domesticRhythm.slavicBaltic": "🪆",
  "domesticRhythm.subSaharanAfrican": "🪘",
  "domesticRhythm.southAsian": "🛕",
  "domesticRhythm.eastAsianArctic": "❄️",
  "carnivalProcessional.caribbean": "🌴",
  "carnivalProcessional.brazilian": "🏖️",
  "carnivalProcessional.americanSouth": "🐊",
  "carnivalProcessional.european": "🏰",
  "carnivalProcessional.andean": "🏔️",
  "carnivalProcessional.eastAsian": "🏮",
  "carnivalProcessional.southAsian": "🛕"
};

const GLYPH_META = {
  "🌀": {
    "label": "Drone & modal",
    "kind": "function"
  },
  "📻": {
    "label": "Song-form",
    "kind": "function"
  },
  "🎷": {
    "label": "Improv / jazz",
    "kind": "function"
  },
  "🎸": {
    "label": "Amplified rock",
    "kind": "function"
  },
  "🎤": {
    "label": "MC / rhythm-verse",
    "kind": "function"
  },
  "🥁": {
    "label": "Percussion-dance",
    "kind": "function"
  },
  "🏛️": {
    "label": "Art music",
    "kind": "function"
  },
  "📜": {
    "label": "Ballad / song-poetry",
    "kind": "function"
  },
  "🔊": {
    "label": "Bass / sound-system",
    "kind": "function"
  },
  "🪩": {
    "label": "Electronic dance",
    "kind": "function"
  },
  "🎧": {
    "label": "Experimental electronic",
    "kind": "function"
  },
  "🌙": {
    "label": "Lullaby",
    "kind": "function"
  },
  "💒": {
    "label": "Wedding",
    "kind": "function"
  },
  "🥀": {
    "label": "Lament / funeral",
    "kind": "function"
  },
  "⚓": {
    "label": "Sea shanty",
    "kind": "function"
  },
  "🌾": {
    "label": "Field / harvest",
    "kind": "function"
  },
  "🧵": {
    "label": "Domestic craft",
    "kind": "function"
  },
  "🏹": {
    "label": "Hunting",
    "kind": "function"
  },
  "🧸": {
    "label": "Nursery",
    "kind": "function"
  },
  "🍺": {
    "label": "Drinking",
    "kind": "function"
  },
  "🎭": {
    "label": "Carnival",
    "kind": "function"
  },
  "👑": {
    "label": "Praise",
    "kind": "function"
  },
  "✊": {
    "label": "Protest",
    "kind": "function"
  },
  "🏙️": {
    "label": "American urban",
    "kind": "region"
  },
  "🪘": {
    "label": "West African",
    "kind": "region"
  },
  "🤠": {
    "label": "American roots / South",
    "kind": "region"
  },
  "🐉": {
    "label": "Chinese",
    "kind": "region"
  },
  "🕌": {
    "label": "MENA / Islamic",
    "kind": "region"
  },
  "🌴": {
    "label": "Caribbean",
    "kind": "region"
  },
  "🛕": {
    "label": "South Asian",
    "kind": "region"
  },
  "🏰": {
    "label": "Europe",
    "kind": "region"
  },
  "☘️": {
    "label": "Celtic",
    "kind": "region"
  },
  "🌹": {
    "label": "Iberian / Romance",
    "kind": "region"
  },
  "🏔️": {
    "label": "Andean",
    "kind": "region"
  },
  "🌳": {
    "label": "British / English",
    "kind": "region"
  },
  "🪆": {
    "label": "Slavic / Russian",
    "kind": "region"
  },
  "🌵": {
    "label": "Mexican / borderlands",
    "kind": "region"
  },
  "🏖️": {
    "label": "Brazilian",
    "kind": "region"
  },
  "🪶": {
    "label": "Indigenous",
    "kind": "region"
  },
  "⛪": {
    "label": "Christian",
    "kind": "region"
  },
  "🌽": {
    "label": "Americas",
    "kind": "region"
  },
  "🏺": {
    "label": "Greek / Mediterranean",
    "kind": "region"
  },
  "❄️": {
    "label": "Arctic / Sami",
    "kind": "region"
  },
  "🪷": {
    "label": "Southeast Asian",
    "kind": "region"
  },
  "🍁": {
    "label": "Canada / Maritimes",
    "kind": "region"
  },
  "🎩": {
    "label": "French chanson",
    "kind": "region"
  },
  "⛰️": {
    "label": "Balkan / mountain",
    "kind": "region"
  },
  "🕍": {
    "label": "Jewish",
    "kind": "region"
  },
  "🌺": {
    "label": "Pacific / Oceania",
    "kind": "region"
  },
  "🐎": {
    "label": "Steppe / Mongolian",
    "kind": "region"
  },
  "🔥": {
    "label": "Afro-diasporic ritual",
    "kind": "region"
  },
  "🌲": {
    "label": "Nordic / Baltic",
    "kind": "region"
  },
  "⛩️": {
    "label": "Japanese",
    "kind": "region"
  },
  "🪭": {
    "label": "Korean",
    "kind": "region"
  },
  "🌃": {
    "label": "Argentine / tango",
    "kind": "region"
  },
  "🐪": {
    "label": "Silk Road",
    "kind": "region"
  },
  "🏜️": {
    "label": "Sahara / desert",
    "kind": "region"
  },
  "🚂": {
    "label": "blues / railroad",
    "kind": "character"
  },
  "🕯": {
    "label": "contemplative / doom",
    "kind": "character"
  },
  "☣": {
    "label": "noise / extreme",
    "kind": "character"
  },
  "👽": {
    "label": "avant / experimental",
    "kind": "character"
  },
  "🦢": {
    "label": "virtuoso / balletic",
    "kind": "character"
  },
  "😴": {
    "label": "lo-fi / chill",
    "kind": "character"
  },
  "📋": {
    "label": "topical / documentary",
    "kind": "character"
  },
  "🥾": {
    "label": "itinerant / diaspora",
    "kind": "character"
  },
  "🏴‍☠️": {
    "label": "punk / renegade / sea-dog",
    "kind": "character"
  },
  "🪔": {
    "label": "devotional lamp",
    "kind": "character"
  },
  "⚒": {
    "label": "industrial / machine",
    "kind": "character"
  },
  "☁️": {
    "label": "ambient / dream",
    "kind": "character"
  },
  "🍾": {
    "label": "party / disco",
    "kind": "character"
  },
  "🦇": {
    "label": "gothic / dark",
    "kind": "character"
  },
  "🏟": {
    "label": "arena / marching",
    "kind": "character"
  },
  "💈": {
    "label": "doo-wop / barbershop",
    "kind": "character"
  },
  "🫠": {
    "label": "shoegaze / haze",
    "kind": "character"
  },
  "🩰": {
    "label": "art / refined",
    "kind": "character"
  },
  "💾": {
    "label": "synth / digital",
    "kind": "character"
  },
  "🎖": {
    "label": "martial / power",
    "kind": "character"
  },
  "🥹": {
    "label": "emo / tender",
    "kind": "character"
  },
  "🤬": {
    "label": "aggressive / thrash",
    "kind": "character"
  },
  "🌖": {
    "label": "psychedelic / trance",
    "kind": "character"
  },
  "🛹": {
    "label": "skate / youth",
    "kind": "character"
  },
  "⛏": {
    "label": "prison / labor",
    "kind": "character"
  },
  "🦄": {
    "label": "hyperpop",
    "kind": "character"
  },
  "⛱️": {
    "label": "surf",
    "kind": "character"
  },
  "⛵️": {
    "label": "yacht / sailing",
    "kind": "character"
  },
  "👾": {
    "label": "glitch / chiptune",
    "kind": "character"
  },
  "🧰": {
    "label": "constructed / concrète",
    "kind": "character"
  },
  "🪖": {
    "label": "resistance / war",
    "kind": "character"
  },
  "❤️": {
    "label": "soul / romance",
    "kind": "character"
  },
  "🫖": {
    "label": "British DIY / skiffle",
    "kind": "character"
  },
  "🍨": {
    "label": "bubblegum / twee",
    "kind": "character"
  },
  "🪇": {
    "label": "Southern & East African",
    "kind": "region"
  },
  "🏮": {
    "label": "East Asian (pan)",
    "kind": "region"
  },
  "🐊": {
    "label": "Bayou / Louisiana",
    "kind": "region"
  },
  "🐄": {
    "label": "Cattle country / Western",
    "kind": "region"
  },
  "🗽": {
    "label": "New York / East Coast",
    "kind": "region"
  },
  "🌇": {
    "label": "West Coast / LA",
    "kind": "region"
  },
  "🍑": {
    "label": "Atlanta / Dirty South",
    "kind": "region"
  },
  "🍸": {
    "label": "jazz club / speakeasy",
    "kind": "character"
  },
  "🌻": {
    "label": "folk / jam / flower-power",
    "kind": "character"
  },
  "💀": {
    "label": "metal / heavy",
    "kind": "character"
  },
  "🧷": {
    "label": "punk / hardcore",
    "kind": "character"
  },
  "🌿": {
    "label": "reggae / roots",
    "kind": "character"
  },
  "🪐": {
    "label": "prog / cosmic",
    "kind": "character"
  },
  "🌟": {
    "label": "pop-star / performer",
    "kind": "character"
  },
  "🪅": {
    "label": "Latin dance",
    "kind": "region"
  },
  "🍄": {
    "label": "freak-folk / psychedelic",
    "kind": "character"
  },
  "🗡️": {
    "label": "drill / hard",
    "kind": "character"
  },
  "🚇": {
    "label": "British urban",
    "kind": "region"
  },
  "🛸": {
    "label": "retro-future / vaporwave",
    "kind": "character"
  },
  "🚜": {
    "label": "rural American field-work",
    "kind": "region"
  },
  "📿": {
    "label": "Sacred / devotional",
    "kind": "function"
  }
};

const TRADITION_GLYPH_CP = {"🌀":"1f300","📻":"1f4fb","🎷":"1f3b7","🎸":"1f3b8","🎤":"1f3a4","🥁":"1f941","🏛️":"1f3db","📜":"1f4dc","🔊":"1f50a","🪩":"1faa9","🎧":"1f3a7","🌙":"1f319","💒":"1f492","🥀":"1f940","⚓":"2693","🌾":"1f33e","🧵":"1f9f5","🏹":"1f3f9","🧸":"1f9f8","🍺":"1f37a","🎭":"1f3ad","👑":"1f451","✊":"270a","🏙️":"1f3d9","🪘":"1fa98","🤠":"1f920","🐉":"1f409","🕌":"1f54c","🌴":"1f334","🛕":"1f6d5","🏰":"1f3f0","☘️":"2618","🌹":"1f339","🏔️":"1f3d4","🌳":"1f333","🪆":"1fa86","🌵":"1f335","🏖️":"1f3d6","🪶":"1fab6","⛪":"26ea","🌽":"1f33d","🏺":"1f3fa","❄️":"2744","🪷":"1fab7","🍁":"1f341","🎩":"1f3a9","⛰️":"26f0","🕍":"1f54d","🌺":"1f33a","🐎":"1f40e","🔥":"1f525","🌲":"1f332","⛩️":"26e9","🪭":"1faad","🌃":"1f303","🐪":"1f42a","🏜️":"1f3dc","🚂":"1f682","🕯":"1f56f","☣":"2623","👽":"1f47d","🦢":"1f9a2","😴":"1f634","📋":"1f4cb","🥾":"1f97e","🏴‍☠️":"1f3f4-200d-2620-fe0f","🪔":"1fa94","⚒":"2692","☁️":"2601","🍾":"1f37e","🦇":"1f987","🏟":"1f3df","💈":"1f488","🫠":"1fae0","🩰":"1fa70","💾":"1f4be","🎖":"1f396","🥹":"1f979","🤬":"1f92c","🌖":"1f316","🛹":"1f6f9","⛏":"26cf","🦄":"1f984","⛱️":"26f1","⛵️":"26f5","👾":"1f47e","🧰":"1f9f0","🪖":"1fa96","❤️":"2764","🫖":"1fad6","🍨":"1f368","🪇":"1fa87","🏮":"1f3ee","🐊":"1f40a","🐄":"1f404","🗽":"1f5fd","🌇":"1f307","🍑":"1f351","🍸":"1f378","🌻":"1f33b","💀":"1f480","🧷":"1f9f7","🌿":"1f33f","🪐":"1fa90","🌟":"1f31f","🪅":"1fa85","🍄":"1f344","🗡️":"1f5e1","🚇":"1f687","🛸":"1f6f8","🚜":"1f69c","📿":"1f4ff"};

const TRADITION_GLYPH_SVGS = {"2601":"<path fill=\"#CCD6DD\" d=\"M27 8c-.701 0-1.377.106-2.015.298.005-.1.015-.197.015-.298 0-3.313-2.687-6-6-6-2.769 0-5.093 1.878-5.785 4.427C12.529 6.154 11.783 6 11 6c-3.314 0-6 2.686-6 6 0 3.312 2.686 6 6 6 2.769 0 5.093-1.878 5.785-4.428.686.273 1.432.428 2.215.428.375 0 .74-.039 1.096-.104-.058.36-.096.727-.096 1.104 0 3.865 3.135 7 7 7s7-3.135 7-7c0-3.866-3.135-7-7-7z\"/><path fill=\"#E1E8ED\" d=\"M31 22c-.467 0-.91.085-1.339.204.216-.526.339-1.1.339-1.704 0-2.485-2.015-4.5-4.5-4.5-1.019 0-1.947.351-2.701.921C22.093 14.096 19.544 12 16.5 12c-2.838 0-5.245 1.822-6.131 4.357C9.621 16.125 8.825 16 8 16c-4.418 0-8 3.582-8 8 0 4.419 3.582 8 8 8h23c2.762 0 5-2.238 5-5s-2.238-5-5-5z\"/>","2618":"<path fill=\"#77B255\" d=\"M32.34 19.208c.198-1.475 2.669-2.208 2.669-4.542C35.009 12.333 29.25 8.25 21 16c3.812-5.312 6.542-14.509 2.203-14.509-1.47 0-2.579 1.342-4.328 1.342C16.5 2.833 16.208 0 14 0c-2.583 0-5 6.25 1 15-1.5-1.625-11.083-6.625-13.002-1.269-.628 1.753 1.731 2.781 1.544 4.519-.178 1.654-2.597 2.037-2.597 4.372 0 3.293 8.048 4.834 16.044-1.613-.245 4.524.557 10.515 3.857 14.158 1.344 1.483 2.407.551 2.822.187.416-.365 1.604-1.414.185-2.822-3.834-3.807-5.225-8.174-5.619-11.381 2.043 2.215 12.357 8.742 15.517 2.767.881-1.668-1.643-2.977-1.411-4.71z\"/>","2623":"<circle fill=\"#F4900C\" cx=\"18\" cy=\"18\" r=\"17\"/><path fill=\"#FFF\" d=\"M12.866 18.095c-.398-.153-.81-.246-1.246-.246-.087 0-.179.012-.269.019-.084.006-.173.031-.259.041.036 2.613 1.536 4.874 3.715 6.006.05-.079.105-.154.15-.237.113-.21.209-.432.286-.666.025-.076.058-.146.079-.223.049-.186.075-.369.098-.552-1.457-.842-2.455-2.366-2.554-4.142zm1.377-6.056c.206.566.532 1.065.955 1.471.799-.515 1.745-.823 2.764-.823.996 0 1.919.298 2.706.791.117-.115.238-.219.346-.352.28-.346.49-.714.632-1.109-1.066-.68-2.328-1.08-3.684-1.08-1.37.001-2.646.408-3.719 1.102zm6.207 10.226c.065.586.25 1.132.582 1.645.008.012.018.02.026.032 2.214-1.123 3.742-3.405 3.774-6.046-.163-.02-.327-.036-.49-.036-.443 0-.874.085-1.283.228-.098 1.801-1.121 3.342-2.609 4.177z\"/><path d=\"M24.415 27.034c-2.882 0-5.217-2.336-5.217-5.217 0-.862.21-1.675.581-2.391l-.61-.354c-.277.335-.691.553-1.16.553-.474 0-.892-.223-1.169-.564l-.636.37c.369.715.578 1.526.578 2.386 0 2.882-2.336 5.217-5.217 5.217-1.574 0-2.985-.698-3.941-1.801l-.192.12c1.079 1.361 2.442 2.27 4.122 2.664.457.107.902.162 1.342.189.135.008.272.023.406.024.04 0 .078-.005.117-.005.346-.003.686-.035 1.021-.088.061-.009.121-.019.181-.03 1.163-.213 2.264-.71 3.3-1.49.006-.005.037-.021.068-.027.005-.001.006-.005.012-.005.039 0 .071.026.078.031.114.088.232.165.349.246.136.094.272.186.411.271.147.09.295.179.445.258.255.134.514.251.778.354.121.047.244.087.367.127.299.098.601.183.911.24.064.012.129.016.193.026.317.049.64.076.968.082.063.001.124.006.188.006.277-.002.558-.015.843-.047 2.06-.236 3.728-1.202 5.027-2.819l-.188-.142c-.959 1.111-2.375 1.816-3.956 1.816zM11.563 16.599c1.824 0 3.429.937 4.362 2.355l.027.035.008.009c.179-.103.364-.215.554-.318.05-.027.063-.058.064-.096-.049-.149-.083-.306-.083-.472 0-.742.535-1.357 1.24-1.485v-.711c-2.762-.134-4.96-2.416-4.96-5.211 0-2.542 1.819-4.659 4.226-5.122v-.247c-1.116.072-3.487 1.215-4.553 2.442-1.488 1.713-2.074 3.71-1.779 5.961.015.111-.003.164-.118.21-3.567 1.43-5.438 5.283-4.36 8.978.068.235.157.464.239.701l.206-.095c-.187-.538-.291-1.115-.291-1.717.001-2.881 2.337-5.217 5.218-5.217zm18.442 3.062c-.491-2.726-2.026-4.631-4.576-5.714-.1-.043-.127-.088-.111-.192.123-.796.107-1.59-.033-2.382-.238-1.343-.852-2.549-1.712-3.538l-.009-.011c-.193-.221-.399-.428-.617-.625l-.095-.084c-.205-.179-.418-.347-.643-.503-.053-.037-.108-.071-.162-.107-.217-.142-.437-.277-.669-.397-.073-.038-1.278-.622-2.393-.77v.244c2.407.463 4.226 2.58 4.226 5.122 0 2.796-2.199 5.078-4.962 5.211v.708c.72.116 1.272.735 1.272 1.488 0 .183-.037.356-.097.518.008.011.004.022.023.033.194.107.385.22.58.334.928-1.442 2.546-2.397 4.388-2.397 2.882 0 5.217 2.336 5.217 5.217 0 .596-.101 1.168-.285 1.701.065.035.195.105.204.106.018-.044.038-.089.055-.135.473-1.24.634-2.52.399-3.827z\" fill=\"#FFF\"/>","2692":"<path fill=\"#D67909\" d=\"M6.814 33.279c-1.166 1.166-3.021 1.221-4.121.121-1.1-1.1-1.045-2.955.121-4.121L26.079 6.014c1.167-1.167 3.021-1.221 4.121-.121 1.101 1.1 1.046 2.955-.121 4.121L6.814 33.279z\"/><path fill=\"#D67909\" d=\"M32.585 7.657c.781-.781.781-2.048 0-2.829l-1.414-1.414c-.78-.78-2.047-.78-2.828 0-.781.781-.781 2.048 0 2.829l1.414 1.414c.781.781 2.048.781 2.828 0z\"/><path fill=\"#D67909\" d=\"M32.585 7.657c.781-.781.781-2.048 0-2.829l-1.414-1.414c-.78-.78-2.047-.78-2.828 0-.781.781-.781 2.048 0 2.829l1.414 1.414c.781.781 2.048.781 2.828 0z\"/><path fill=\"#66757F\" d=\"M35.789 13.424c-.252-1.765-.375-4.354-3.204-7.182l-.707-.708-4.949-4.95c-.781-.781-2.048-.781-2.828 0L20.565 4.12c-.781.781-.781 2.047 0 2.829l6.364 6.364 2.121 2.121 1.414 1.414c1.027 1.027 3.314 3.315 4.718 1.911.773-.772.961-2.86.607-5.335z\"/><path fill=\"#F4900C\" d=\"M29.185 33.279c1.166 1.166 3.022 1.221 4.121.121 1.1-1.1 1.045-2.955-.121-4.121L9.921 6.014C8.754 4.847 6.899 4.792 5.8 5.893c-1.101 1.1-1.046 2.955.121 4.121l23.264 23.265z\"/><path fill=\"#F4900C\" d=\"M3.415 7.657c-.781-.781-.781-2.048 0-2.829l1.414-1.414c.78-.78 2.047-.78 2.828 0 .781.781.781 2.048 0 2.829L6.243 7.657c-.781.781-2.048.781-2.828 0z\"/><path fill=\"#66757F\" d=\"M4.122 15.436c.78.78 2.047.78 2.828 0l8.485-8.485c.781-.781.781-2.048 0-2.829L11.899.587c-.78-.781-2.047-.781-2.828 0L.586 9.071c-.781.781-.781 2.047 0 2.828l3.536 3.537z\"/>","2693":"<path fill=\"#269\" d=\"M30.5 18.572L26 25h2.575c-1.13 3.988-4.445 7.05-8.575 7.81V17h3c1.104 0 2-.896 2-2s-.896-2-2-2h-3v-1.349h-4V13h-3c-1.104 0-2 .896-2 2s.896 2 2 2h3v15.81c-4.13-.76-7.445-3.821-8.575-7.81H10l-4.5-6.428L1 25h3.33C5.705 31.289 11.299 36 18 36s12.295-4.711 13.67-11H35l-4.5-6.428z\"/><path fill=\"#269\" d=\"M18 0c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm0 9c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z\"/>","2744":"<path fill=\"#88C9F9\" d=\"M19 27.586V8.415l4.828-4.829s.707-.707 0-1.415c-.707-.707-1.414 0-1.414 0L19 5.586V1s0-1-1-1-1 1-1 1v4.586l-3.414-3.415s-.707-.707-1.414 0c-.707.708 0 1.415 0 1.415L17 8.415v19.171l-4.828 4.828s-.707.707 0 1.414 1.414 0 1.414 0L17 30.414V35s0 1 1 1 1-1 1-1v-4.586l3.414 3.414s.707.707 1.414 0 0-1.414 0-1.414L19 27.586z\"/><path fill=\"#88C9F9\" d=\"M34.622 20.866c-.259-.966-1.225-.707-1.225-.707l-6.595 1.767-16.603-9.586-1.767-6.595s-.259-.966-1.225-.707C6.24 5.297 6.5 6.263 6.5 6.263l1.25 4.664-3.972-2.294s-.866-.5-1.366.366c-.5.866.366 1.366.366 1.366l3.971 2.293-4.664 1.249s-.967.259-.707 1.225c.259.967 1.225.708 1.225.708l6.596-1.767 16.603 9.586 1.767 6.596s.259.966 1.225.707c.966-.26.707-1.225.707-1.225l-1.25-4.664 3.972 2.293s.867.5 1.367-.365c.5-.867-.367-1.367-.367-1.367l-3.971-2.293 4.663-1.249c0-.001.966-.26.707-1.226z\"/><path fill=\"#88C9F9\" d=\"M33.915 13.907l-4.664-1.25 3.972-2.293s.867-.501.367-1.367c-.501-.867-1.367-.366-1.367-.366l-3.971 2.292 1.249-4.663s.259-.966-.707-1.225c-.966-.259-1.225.707-1.225.707l-1.767 6.595-16.604 9.589-6.594-1.768s-.966-.259-1.225.707c-.26.967.707 1.225.707 1.225l4.663 1.249-3.971 2.293s-.865.501-.365 1.367c.5.865 1.365.365 1.365.365l3.972-2.293-1.25 4.663s-.259.967.707 1.225c.967.26 1.226-.706 1.226-.706l1.768-6.597 16.604-9.585 6.595 1.768s.966.259 1.225-.707c.255-.967-.71-1.225-.71-1.225z\"/>","2764":"<path fill=\"#DD2E44\" d=\"M35.885 11.833c0-5.45-4.418-9.868-9.867-9.868-3.308 0-6.227 1.633-8.018 4.129-1.791-2.496-4.71-4.129-8.017-4.129-5.45 0-9.868 4.417-9.868 9.868 0 .772.098 1.52.266 2.241C1.751 22.587 11.216 31.568 18 34.034c6.783-2.466 16.249-11.447 17.617-19.959.17-.721.268-1.469.268-2.242z\"/>","1f300":"<path fill=\"#55ACEE\" d=\"M35.782 24.518c-.13-.438-.422-.799-.821-1.016-.802-.436-1.879-.116-2.316.683-1.797 3.296-4.771 5.695-8.372 6.757-3.563 1.051-7.437.634-10.698-1.144-2.558-1.394-4.419-3.699-5.242-6.493-.74-2.514-.495-5.016.552-7.033-.363 1.605-.313 3.285.164 4.908.737 2.507 2.407 4.575 4.701 5.823 2.733 1.492 5.989 1.841 8.979.961 3.025-.892 5.521-2.906 7.026-5.672 1.832-3.358 2.246-7.228 1.165-10.898-1.08-3.669-3.524-6.698-6.883-8.529C19.984.657 15.165.14 10.738 1.446 6.261 2.764 2.566 5.746.332 9.843c-.451.826-.145 1.865.681 2.317.804.439 1.884.117 2.319-.682C5.127 8.183 8.1 5.784 11.703 4.723c3.563-1.048 7.438-.634 10.699 1.142 2.556 1.394 4.416 3.7 5.239 6.495.741 2.514.496 5.017-.552 7.033.363-1.604.315-3.285-.162-4.911-.739-2.504-2.409-4.573-4.702-5.824-2.734-1.49-5.99-1.838-8.98-.959-3.022.89-5.518 2.904-7.025 5.671-1.832 3.357-2.245 7.227-1.165 10.897 1.081 3.671 3.525 6.7 6.883 8.529 2.567 1.4 5.451 2.141 8.341 2.141 1.669 0 3.337-.242 4.958-.72 4.477-1.317 8.173-4.301 10.406-8.399.219-.399.269-.862.139-1.3zM16.784 14.002c.373-.11.758-.166 1.143-.166 1.779 0 3.372 1.193 3.875 2.901.629 2.138-.599 4.39-2.737 5.02-.373.11-.757.166-1.142.166-1.778 0-3.372-1.193-3.875-2.902-.63-2.137.598-4.389 2.736-5.019z\"/>","1f4fb":"<path fill=\"#292F33\" d=\"M2.697 12.389c-.391.391-.391 1.023 0 1.414s1.023.391 1.414 0l9.192-9.192c.391-.391.391-1.023 0-1.414s-1.023-.391-1.414 0l-9.192 9.192z\"/><path fill=\"#99AAB5\" d=\"M36 32c0 4-4 4-4 4H4s-4 0-4-4V14s0-4 4-4h28c4 0 4 4 4 4v18z\"/><path fill=\"#292F33\" d=\"M15.561 3.061c-.391.391-1.023.391-1.414 0l-.707-.707c-.391-.391-.391-1.023 0-1.414s1.023-.391 1.414 0l.707.707c.39.39.39 1.023 0 1.414z\"/><circle fill=\"#292F33\" cx=\"27.5\" cy=\"18.5\" r=\"5.5\"/><circle fill=\"#292F33\" cx=\"27.5\" cy=\"29.5\" r=\"3.5\"/><circle fill=\"#66757F\" cx=\"27.5\" cy=\"18.5\" r=\"3.5\"/><circle fill=\"#66757F\" cx=\"27.5\" cy=\"29.5\" r=\"1.5\"/><g fill=\"#292F33\"><circle cx=\"10.5\" cy=\"25.5\" r=\"1.5\"/><circle cx=\"5.5\" cy=\"25.5\" r=\"1.5\"/><circle cx=\"10.5\" cy=\"20.5\" r=\"1.5\"/><circle cx=\"15.5\" cy=\"20.5\" r=\"1.5\"/><circle cx=\"15.5\" cy=\"25.5\" r=\"1.5\"/><circle cx=\"15.5\" cy=\"30.5\" r=\"1.5\"/><circle cx=\"5.5\" cy=\"30.5\" r=\"1.5\"/><circle cx=\"5.5\" cy=\"20.5\" r=\"1.5\"/><circle cx=\"10.5\" cy=\"15.5\" r=\"1.5\"/><circle cx=\"15.5\" cy=\"15.5\" r=\"1.5\"/><circle cx=\"5.5\" cy=\"15.5\" r=\"1.5\"/><circle cx=\"10.5\" cy=\"30.5\" r=\"1.5\"/></g>","1f3b7":"<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"#FCAB40\" d=\"M14 16L9 26s-1 2 1 2c1 0 2-2 2-2L26 7s2-4 8-1v2c-3-1-4 1-4 1L15 33s-2 3-7 3c-6 0-7-5-7-8 0-2 1-4 2-6s-2-6-2-6h13z\"/><path fill=\"#FDCB58\" d=\"M7.5 20C4.04 20 0 18.952 0 16c0-2.953 4.04-4 7.5-4s7.5 1.047 7.5 4c0 2.952-4.04 4-7.5 4z\"/><circle fill=\"#CCD6DD\" cx=\"19\" cy=\"17\" r=\"2\"/><circle fill=\"#CCD6DD\" cx=\"22\" cy=\"13\" r=\"2\"/><circle fill=\"#CCD6DD\" cx=\"25\" cy=\"9\" r=\"2\"/><path fill=\"#9AAAB4\" d=\"M33.998 10c-.3 0-.605-.068-.893-.211l-2-1c-.988-.494-1.389-1.695-.895-2.684.493-.986 1.693-1.39 2.684-.895l2 1c.988.494 1.389 1.695.895 2.684-.351.701-1.057 1.106-1.791 1.106z\"/><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"#FCAB40\" d=\"M8.806 21.703l1.267-1.547 6.19 5.069-1.267 1.547z\"/>","1f3b8":"<path fill=\"#BB1A34\" d=\"M21.828 20.559C19.707 21.266 19 17.731 19 17.731s.965-.968.235-1.829c1.138-1.137.473-1.707.473-1.707-1.954-1.953-5.119-1.953-7.071 0-.246.246-.414.467-.553.678-.061.086-.115.174-.17.262l-.014.027c-.285.475-.491.982-.605 1.509-.156.319-.379.659-.779 1.06-1.414 1.414-4.949-.707-7.778 2.121-.029.029-.045.069-.069.104-.094.084-.193.158-.284.25-3.319 3.319-3.003 9.018.708 12.728 3.524 3.525 8.84 3.979 12.209 1.17.058-.031.117-.061.165-.109.071-.072.126-.14.193-.21.053-.049.109-.093.161-.143 1.693-1.694 2.342-3.73 2.086-5.811-.068-.99-.165-1.766.39-2.321.707-.707 2.828 0 4.242-1.414 2.117-2.122.631-3.983-.711-3.537z\"/><path fill=\"#292F33\" d=\"M14.987 18.91L30.326 3.572l2.121 2.122-15.339 15.339z\"/><path fill=\"#F5F8FA\" d=\"M10.001 29.134c1.782 1.277 1.959 3.473 1.859 4.751-.042.528.519.898.979.637 2.563-1.456 4.602-3.789 4.038-7.853-.111-.735.111-2.117 2.272-2.406 2.161-.29 2.941-1.099 3.208-1.485.153-.221.29-.832-.312-.854-.601-.022-2.094.446-3.431-1.136-1.337-1.582-1.559-2.228-1.604-2.473-.045-.245-1.409-3.694-2.525-1.864-.927 1.521-1.958 4.509-5.287 5.287-1.355.316-3.069 1.005-3.564 1.96-.832 1.604.46 2.725 1.574 3.483 1.115.757 2.793 1.953 2.793 1.953z\"/><path fill=\"#292F33\" d=\"M13.072 19.412l1.414-1.415 3.536 3.535-1.414 1.414zm-4.475 4.474l1.415-1.414 3.535 3.535-1.414 1.414z\"/><path fill=\"#CCD6DD\" d=\"M7.396 27.189L29.198 5.427l.53.531L7.927 27.72zm.869.868L30.067 6.296l.53.531L8.796 28.59z\"/><path fill=\"#292F33\" d=\"M9.815 28.325c.389.389.389 1.025 0 1.414s-1.025.389-1.414 0l-2.122-2.121c-.389-.389-.389-1.025 0-1.414h.001c.389-.389 1.025-.389 1.414 0l2.121 2.121z\"/><circle fill=\"#292F33\" cx=\"13.028\" cy=\"29.556\" r=\"1\"/><path fill=\"#292F33\" d=\"M14.445 31.881c0 .379-.307.686-.686.686-.379 0-.686-.307-.686-.686 0-.379.307-.686.686-.686.379 0 .686.307.686.686z\"/><path fill=\"#BB1A34\" d=\"M35.088 4.54c.415.415.415 1.095-.001 1.51l-4.362 3.02c-.416.415-1.095.415-1.51 0L26.95 6.804c-.415-.415-.415-1.095.001-1.51l3.02-4.361c.416-.415 1.095-.415 1.51 0l3.607 3.607z\"/><circle fill=\"#66757F\" cx=\"32.123\" cy=\"9.402\" r=\".625\"/><circle fill=\"#66757F\" cx=\"33.381\" cy=\"8.557\" r=\".625\"/><circle fill=\"#66757F\" cx=\"34.64\" cy=\"7.712\" r=\".625\"/><circle fill=\"#66757F\" cx=\"26.712\" cy=\"3.811\" r=\".625\"/><circle fill=\"#66757F\" cx=\"27.555\" cy=\"2.571\" r=\".625\"/><circle fill=\"#66757F\" cx=\"28.398\" cy=\"1.332\" r=\".625\"/>","1f3a4":"<path fill=\"#8899A6\" d=\"M35.999 11.917c0 3.803-3.082 6.885-6.885 6.885-3.802 0-6.884-3.082-6.884-6.885 0-3.802 3.082-6.884 6.884-6.884 3.803 0 6.885 3.082 6.885 6.884z\"/><path fill=\"#31373D\" d=\"M32.81 18.568c-.336.336-.881.336-1.217 0L22.466 9.44c-.336-.336-.336-.881 0-1.217l1.217-1.217c.336-.336.881-.336 1.217 0l9.127 9.128c.336.336.336.881 0 1.217l-1.217 1.217zm-6.071.136l-4.325-4.327c-.778-.779-1.995-.733-2.719.101l-9.158 10.574c-1.219 1.408-1.461 3.354-.711 4.73l-4.911 4.912 1.409 1.409 4.877-4.877c1.381.84 3.411.609 4.862-.648l10.575-9.157c.834-.723.881-1.94.101-2.717z\"/><path fill=\"#55ACEE\" d=\"M4 6v8.122C3.686 14.047 3.352 14 3 14c-1.657 0-3 .896-3 2s1.343 2 3 2 3-.896 3-2V9.889l5 2.222v5.011c-.314-.075-.648-.122-1-.122-1.657 0-3 .896-3 2s1.343 2 3 2 2.999-.896 3-2v-9L4 6zm14-5v8.123C17.685 9.048 17.353 9 17 9c-1.657 0-3 .895-3 2 0 1.104 1.343 2 3 2 1.656 0 3-.896 3-2V1h-2z\"/>","1f941":"<path fill=\"#F18F26\" d=\"M0 18h36v9H0z\"/><ellipse fill=\"#F18F26\" cx=\"18\" cy=\"26\" rx=\"18\" ry=\"9\"/><ellipse fill=\"#F18F26\" cx=\"18\" cy=\"27\" rx=\"18\" ry=\"9\"/><path fill=\"#9D0522\" d=\"M0 10v16h.117c.996 4.499 8.619 8 17.883 8s16.887-3.501 17.883-8H36V10H0z\"/><ellipse fill=\"#F18F26\" cx=\"18\" cy=\"11\" rx=\"18\" ry=\"9\"/><ellipse fill=\"#F18F26\" cx=\"18\" cy=\"12\" rx=\"18\" ry=\"9\"/><path fill=\"#F18F26\" d=\"M0 10h1v2H0zm35 0h1v2h-1z\"/><ellipse fill=\"#FCAB40\" cx=\"18\" cy=\"10\" rx=\"18\" ry=\"9\"/><ellipse fill=\"#F5F8FA\" cx=\"18\" cy=\"10\" rx=\"17\" ry=\"8\"/><path fill=\"#FDD888\" d=\"M18 3c9.03 0 16.395 3.316 16.946 7.5.022-.166.054-.331.054-.5 0-4.418-7.611-8-17-8S1 5.582 1 10c0 .169.032.334.054.5C1.605 6.316 8.97 3 18 3z\"/><path d=\"M28.601 2.599c.44-.33.53-.96.2-1.4l-.6-.8c-.33-.44-.96-.53-1.4-.2L14.157 10.243c-.774-.167-1.785.083-2.673.749-1.326.994-1.863 2.516-1.2 3.4s2.275.794 3.6-.2c.835-.626 1.355-1.461 1.462-2.215l13.255-9.378zm5.868 2.919l-.509-.861c-.28-.474-.896-.632-1.37-.352l-13.913 8.751c-.719-.141-1.626.023-2.472.524-1.426.843-2.127 2.297-1.565 3.248.562.951 2.174 1.039 3.6.196 1.005-.594 1.638-1.49 1.735-2.301l14.142-7.835c.474-.281.632-.897.352-1.37z\" fill=\"#AA695B\"/><path fill=\"#DA2F47\" d=\"M2 28c-.55 0-1-.45-1-1v-9c0-.55.45-1 1-1s1 .45 1 1v9c0 .55-.45 1-1 1zm9 4c-.55 0-1-.45-1-1v-9c0-.55.45-1 1-1s1 .45 1 1v9c0 .55-.45 1-1 1zm12 0c-.55 0-1-.45-1-1v-9c0-.55.45-1 1-1s1 .45 1 1v9c0 .55-.45 1-1 1zm11-4c-.55 0-1-.45-1-1v-9c0-.55.45-1 1-1s1 .45 1 1v9c0 .55-.45 1-1 1z\"/>","1f3db":"<path fill=\"#292F33\" d=\"M7 11h22v18H7z\"/><path fill=\"#CCD6DD\" d=\"M8 29c0 1.104-.597 2-1.333 2H5.333C4.597 31 4 30.104 4 29V11c0-1.104.597-2 1.333-2h1.333C7.403 9 8 9.896 8 11v18zm24 0c0 1.104-.597 2-1.333 2h-1.334C28.597 31 28 30.104 28 29V11c0-1.104.597-2 1.333-2h1.334C31.403 9 32 9.896 32 11v18zm-16 0c0 1.104-.597 2-1.333 2h-1.333C12.597 31 12 30.104 12 29V11c0-1.104.597-2 1.333-2h1.333C15.403 9 16 9.896 16 11v18zm8 0c0 1.104-.598 2-1.334 2h-1.332C20.598 31 20 30.104 20 29V11c0-1.104.598-2 1.334-2h1.332C23.402 9 24 9.896 24 11v18z\"/><path fill=\"#9AAAB4\" d=\"M33 30c0 1.104-.896 2-2 2H5c-1.104 0-2-.896-2-2s.896-2 2-2h26c1.104 0 2 .896 2 2z\"/><path fill=\"#CCD6DD\" d=\"M35 32c0 1.104-.896 2-2 2H3c-1.104 0-2-.896-2-2s.896-2 2-2h30c1.104 0 2 .896 2 2z\"/><path fill=\"#E1E8ED\" d=\"M36 33.5c0 .828-.672 1.5-1.5 1.5h-33C.671 35 0 34.328 0 33.5S.671 32 1.5 32h33c.828 0 1.5.672 1.5 1.5z\"/><path fill=\"#9AAAB4\" d=\"M33 10c0-1.104-.956-2-2.133-2H5c-1.179 0-2 .896-2 2 0 .751.386 1.398 1 1.74V13h4v-1h4v1h4v-1h4v1h4v-1h4v1h4v-1.312c.599-.354 1-.975 1-1.688z\"/><path fill=\"#CCD6DD\" d=\"M2 8.444C2 7.413 3.012 7 3.012 7l14.904-7 15.047 7S34 7.231 34 8.45V9H2v-.556z\"/><path fill=\"#9AAAB4\" d=\"M18 2.542S7.681 7.407 6.65 7.844C5.619 8.281 5.964 9 6.651 9h22.646c1.062 0 .812-.812-.031-1.25C28.422 7.312 18 2.542 18 2.542z\"/><path fill=\"#CCD6DD\" d=\"M34 9c0 .552-.447 1-1 1H3c-.552 0-1-.448-1-1s.448-1 1-1l30 .006c.553 0 1 .442 1 .994z\"/>","1f4dc":"<path fill=\"#FFD983\" d=\"M32 0H10C7.791 0 6 1.791 6 4v24H4c-2.209 0-4 1.791-4 4s1.791 4 4 4h24c2.209 0 4-1.791 4-4V8c2.209 0 4-1.791 4-4s-1.791-4-4-4z\"/><path fill=\"#E39F3D\" d=\"M8 10h24V8H10L8 7z\"/><path fill=\"#FFE8B6\" d=\"M10 0C7.791 0 6 1.791 6 4v24.555C5.41 28.211 4.732 28 4 28c-2.209 0-4 1.791-4 4s1.791 4 4 4 4-1.791 4-4V7.445C8.59 7.789 9.268 8 10 8c2.209 0 4-1.791 4-4s-1.791-4-4-4z\"/><path fill=\"#C1694F\" d=\"M12 4c0 1.104-.896 2-2 2s-2-.896-2-2 .896-2 2-2 2 .896 2 2M6 32c0 1.104-.896 2-2 2s-2-.896-2-2 .896-2 2-2 2 .896 2 2m24-17c0 .552-.447 1-1 1H11c-.552 0-1-.448-1-1s.448-1 1-1h18c.553 0 1 .448 1 1m0 4c0 .553-.447 1-1 1H11c-.552 0-1-.447-1-1s.448-1 1-1h18c.553 0 1 .447 1 1m0 4c0 .553-.447 1-1 1H11c-.552 0-1-.447-1-1s.448-1 1-1h18c.553 0 1 .447 1 1m0 4c0 .553-.447 1-1 1H11c-.552 0-1-.447-1-1 0-.553.448-1 1-1h18c.553 0 1 .447 1 1\"/>","1f50a":"<path fill=\"#8899A6\" d=\"M2 10s-2 0-2 2v12c0 2 2 2 2 2h6l8 8s1 1 2 1h1s1 0 1-1V2s0-1-1-1h-1c-1 0-2 1-2 1l-8 8H2z\"/><path fill=\"#CCD6DD\" d=\"M8 26l8 8s1 1 2 1h1s1 0 1-1V2s0-1-1-1h-1c-1 0-2 1-2 1l-8 8v16z\"/><path fill=\"#8899A6\" d=\"M29 32.019c-.267 0-.533-.113-.72-.332-.339-.398-.292-.995.105-1.334 3.603-3.071 5.668-7.551 5.668-12.29s-2.066-9.219-5.669-12.29c-.397-.339-.444-.937-.105-1.334.339-.399.935-.444 1.334-.106 4.024 3.431 6.333 8.436 6.333 13.73 0 5.294-2.309 10.299-6.332 13.729-.179.152-.396.227-.614.227z\"/><path fill=\"#8899A6\" d=\"M26.27 28.959c-.269 0-.533-.115-.717-.338-.327-.396-.271-.98.125-1.307 2.792-2.304 4.394-5.699 4.394-9.315 0-3.573-1.571-6.943-4.311-9.245-.392-.33-.443-.916-.113-1.308.33-.394.915-.443 1.309-.114 3.16 2.656 4.973 6.543 4.973 10.667 0 4.172-1.848 8.089-5.069 10.746-.174.145-.383.214-.591.214z\"/><path fill=\"#8899A6\" d=\"M23.709 25.959c-.289 0-.576-.124-.774-.365-.351-.427-.289-1.057.138-1.407C24.934 22.658 26 20.403 26 18c0-2.435-1.089-4.708-2.988-6.236-.431-.346-.498-.976-.152-1.406.348-.429.976-.499 1.406-.152C26.639 12.116 28 14.957 28 18c0 3.004-1.333 5.822-3.657 7.731-.186.154-.411.228-.634.228z\"/>","1faa9":"<path fill=\"#ADE3FF\" d=\"M22.981 18.944c-.053 2.052-.272 4.003-.628 5.752a39.945 39.945 0 0 1-4.353.295v-5.992c1.888-.003 3.539-.022 4.981-.055zM21.294 5.353c.907.161 1.781.371 2.611.611a10.44 10.44 0 0 0-3.637-2.022c.362.398.705.868 1.026 1.411zm-8.625 5.834A69.042 69.042 0 0 1 17 11.006V6.015c-.92.024-1.814.107-2.671.24-.682 1.297-1.255 2.982-1.66 4.932zm-9.027 2.549a14.443 14.443 0 0 0-.604 3.518c.329.096 1.004.198 1.981.295a18.8 18.8 0 0 1 .62-4.409c-1.071.235-1.763.452-1.997.596zM17 17.998v-5.993c-1.602.012-3.12.082-4.518.189a34.576 34.576 0 0 0-.48 5.735c1.506.041 3.177.065 4.998.069zM13.706 5.353a8.52 8.52 0 0 1 1.027-1.411 10.44 10.44 0 0 0-3.637 2.022c.829-.24 1.703-.45 2.61-.611z\"/><path fill=\"#F0FFFF\" d=\"M22.331 11.187A69.042 69.042 0 0 0 18 11.006V6.015c.92.024 1.814.107 2.671.24.682 1.297 1.255 2.982 1.66 4.932zM5.738 23.198a18.727 18.727 0 0 1-.716-4.645c-.922-.107-1.567-.225-2.011-.343.02 1.42.237 2.794.64 4.088.209.18.943.519 2.087.9zm5.893-11.927c.363-1.836.871-3.46 1.492-4.798A23.65 23.65 0 0 0 9.576 7.52c-1.02 1.226-1.857 2.685-2.466 4.309 1.36-.23 2.917-.419 4.521-.558zm-3.92 16.34c-.999-.493-1.695-.945-2.016-1.222a14.415 14.415 0 0 1-1.546-2.735c.536.242 1.2.485 1.97.721.425 1.162.96 2.247 1.592 3.236zM23.998 17.9c2.008-.066 3.685-.158 4.987-.262a17.755 17.755 0 0 0-.728-4.719 53.996 53.996 0 0 0-4.704-.636c.281 1.734.44 3.622.445 5.617zm5.038-5.86c.729.15 1.368.313 1.884.489a14.443 14.443 0 0 0-1.718-3.055c-.326-.275-1.008-.705-1.968-1.175a16.574 16.574 0 0 1 1.802 3.741zM11.595 24.553a34.586 34.586 0 0 1-.577-5.635c-2.126-.061-3.751-.154-4.993-.263.062 1.725.352 3.376.853 4.894 1.282.365 2.885.73 4.717 1.004z\"/><path fill=\"#A8C1FF\" d=\"M20.715 29.658c-.865.131-1.774.212-2.715.234V25.99a41.391 41.391 0 0 0 4.12-.268c-.373 1.526-.851 2.86-1.405 3.936zm9.267-12.109c.976-.097 1.652-.199 1.981-.295a14.434 14.434 0 0 0-.604-3.518c-.234-.144-.926-.361-1.997-.596.372 1.394.584 2.873.62 4.409zM14.921 30.743c.633.913 1.338 1.502 2.079 1.688v-1.538a21.98 21.98 0 0 1-2.079-.15z\"/><path fill=\"#F1C6FF\" d=\"M31.989 18.21a14.416 14.416 0 0 1-.64 4.088c-.21.181-.943.519-2.088.9.421-1.461.669-3.02.716-4.645.923-.107 1.568-.225 2.012-.343zm-8.798 7.379c-.335 1.452-.768 2.746-1.274 3.855a23.18 23.18 0 0 0 3.587-1.052 14.81 14.81 0 0 0 2.18-3.677 40.811 40.811 0 0 1-4.493.874zm-9.537 4.965a24.664 24.664 0 0 1-2.676-.626 10.498 10.498 0 0 0 3.755 2.13 8.66 8.66 0 0 1-1.079-1.504zm6.425.189a21.98 21.98 0 0 1-2.079.15v1.538c.741-.186 1.446-.775 2.079-1.688z\"/><path fill=\"#CCB3FF\" d=\"M14.285 29.658c-.554-1.076-1.032-2.41-1.405-3.935 1.338.153 2.726.249 4.12.268v3.902a21.7 21.7 0 0 1-2.715-.235zm14.596-5.283a16.559 16.559 0 0 1-1.592 3.236c.999-.493 1.695-.945 2.016-1.222a14.47 14.47 0 0 0 1.546-2.735c-.535.242-1.2.485-1.97.721zm-4.9-5.457a34.366 34.366 0 0 1-.577 5.635 37.787 37.787 0 0 0 4.716-1.004c.501-1.518.791-3.169.853-4.894-1.24.109-2.866.202-4.992.263zm-2.635 11.636a8.66 8.66 0 0 1-1.079 1.504 10.475 10.475 0 0 0 3.755-2.13 24.61 24.61 0 0 1-2.676.626zM35.5 3A2.503 2.503 0 0 1 33 .5a.5.5 0 0 0-1 0C32 1.878 30.878 3 29.5 3a.5.5 0 0 0 0 1C30.878 4 32 5.122 32 6.5a.5.5 0 0 0 1 0C33 5.122 34.122 4 35.5 4a.5.5 0 0 0 0-1z\"/><path fill=\"#B0F7FF\" d=\"M18 5.016V3.569c.712.179 1.389.736 2.002 1.589-.66-.08-1.33-.125-2.002-.142zm3.877 1.456c.621 1.339 1.129 2.962 1.492 4.798 1.603.139 3.161.328 4.521.557-.609-1.624-1.446-3.083-2.466-4.309a23.974 23.974 0 0 0-3.547-1.046zM18 12.005v5.993c1.821-.004 3.492-.029 4.999-.069a34.595 34.595 0 0 0-.48-5.735A66.538 66.538 0 0 0 18 12.005zm-1 12.986v-5.992a235.782 235.782 0 0 1-4.981-.055c.053 2.052.272 4.003.628 5.752 1.356.166 2.817.275 4.353.295zm-5.553-12.708c-1.84.172-3.436.402-4.704.636a17.708 17.708 0 0 0-.728 4.719c1.303.104 2.98.196 4.987.262.005-1.995.164-3.883.445-5.617zm3.551-7.125c.66-.08 1.33-.125 2.002-.142V3.569c-.712.179-1.389.736-2.002 1.589zM5.964 12.04a16.574 16.574 0 0 1 1.802-3.741c-.96.469-1.642.9-1.968 1.175a14.487 14.487 0 0 0-1.718 3.055 16.116 16.116 0 0 1 1.884-.489zm7.12 17.403c-.506-1.109-.939-2.403-1.274-3.855a40.513 40.513 0 0 1-4.492-.874 14.829 14.829 0 0 0 2.18 3.677c1.04.4 2.25.775 3.586 1.052zM35.5 31a2.503 2.503 0 0 1-2.5-2.5.5.5 0 0 0-1 0c0 1.378-1.122 2.5-2.5 2.5a.5.5 0 0 0 0 1c1.378 0 2.5 1.122 2.5 2.5a.5.5 0 0 0 1 0c0-1.378 1.122-2.5 2.5-2.5a.5.5 0 0 0 0-1z\"/><path fill=\"#49A8FF\" d=\"M30.289 9.26a1.5 1.5 0 0 0-.232-.31C23.847.358 11.16.347 4.942 8.95c-.102.11-.181.214-.231.31a15.418 15.418 0 0 0 .216 17.769c.013.012.023.036.037.049 6.213 8.556 18.854 8.567 25.074 0l.046-.039a15.457 15.457 0 0 0 .205-17.779zm-.984 17.129c-.321.277-1.018.728-2.016 1.222a16.559 16.559 0 0 0 1.592-3.236 16.89 16.89 0 0 0 1.97-.721 14.47 14.47 0 0 1-1.546 2.735zM4.149 23.654c.536.242 1.2.485 1.97.721.425 1.162.96 2.248 1.592 3.236-.999-.493-1.695-.945-2.016-1.222a14.47 14.47 0 0 1-1.546-2.735zm27.2-1.357c-.21.181-.943.519-2.088.9.421-1.461.669-3.02.716-4.645.923-.107 1.568-.225 2.012-.344a14.412 14.412 0 0 1-.64 4.089zM3.038 17.254c.062-1.217.259-2.398.604-3.518.234-.144.926-.361 1.997-.596a18.8 18.8 0 0 0-.62 4.409c-.977-.097-1.652-.199-1.981-.295zm3.705-4.335a53.996 53.996 0 0 1 4.704-.636 35.79 35.79 0 0 0-.445 5.616 109.636 109.636 0 0 1-4.987-.262c.032-1.657.288-3.242.728-4.718zm25.219 4.335c-.329.096-1.004.198-1.981.295a18.8 18.8 0 0 0-.62-4.409c1.07.235 1.762.452 1.997.596.345 1.12.542 2.302.604 3.518zm-2.977.384c-1.303.104-2.98.196-4.987.262a35.79 35.79 0 0 0-.445-5.616c1.84.172 3.436.402 4.704.636.44 1.475.696 3.06.728 4.718zM18 6.015c.92.024 1.814.107 2.671.24.682 1.298 1.255 2.983 1.66 4.932A69.042 69.042 0 0 0 18 11.006V6.015zm-1 4.99a69.81 69.81 0 0 0-4.331.181c.405-1.95.978-3.634 1.66-4.932A20.83 20.83 0 0 1 17 6.015v4.99zm0 1v5.993a206.135 206.135 0 0 1-4.999-.069c.004-2.026.177-3.966.48-5.735A66.538 66.538 0 0 1 17 12.005zm0 6.994v5.992a40.197 40.197 0 0 1-4.353-.295c-.356-1.75-.575-3.701-.628-5.752 1.442.033 3.093.052 4.981.055zm0 6.992v3.902a21.513 21.513 0 0 1-2.715-.235c-.554-1.076-1.032-2.41-1.405-3.935 1.338.153 2.726.249 4.12.268zm1 0a41.391 41.391 0 0 0 4.12-.268c-.374 1.525-.852 2.859-1.405 3.935-.865.131-1.774.212-2.715.234v-3.901zm0-1v-5.992c1.888-.003 3.539-.022 4.981-.055-.053 2.052-.272 4.003-.628 5.752a40.197 40.197 0 0 1-4.353.295zm0-6.993v-5.993c1.602.012 3.12.082 4.518.189.303 1.768.476 3.708.48 5.735-1.506.041-3.177.065-4.998.069zm5.369-6.727c-.363-1.836-.871-3.46-1.492-4.798a23.65 23.65 0 0 1 3.547 1.047c1.02 1.226 1.857 2.685 2.466 4.309a57.483 57.483 0 0 0-4.521-.558zm-2.075-5.918a8.575 8.575 0 0 0-1.026-1.411 10.44 10.44 0 0 1 3.637 2.022c-.83-.24-1.704-.45-2.611-.611zm-1.292-.195c-.66-.08-1.33-.125-2.002-.142V3.569c.712.179 1.389.736 2.002 1.589zM17 5.016c-.672.017-1.342.062-2.002.142.614-.852 1.29-1.41 2.002-1.589v1.447zm-3.294.337c-.907.161-1.781.371-2.611.611a10.44 10.44 0 0 1 3.637-2.022 8.575 8.575 0 0 0-1.026 1.411zm-.583 1.119c-.621 1.339-1.129 2.962-1.492 4.798a58.043 58.043 0 0 0-4.521.557c.609-1.624 1.446-3.083 2.466-4.309a23.974 23.974 0 0 1 3.547-1.046zm-2.104 12.446c.047 2.015.247 3.913.577 5.635a37.787 37.787 0 0 1-4.716-1.004 17.658 17.658 0 0 1-.853-4.894c1.24.109 2.866.202 4.992.263zm.79 6.671c.335 1.452.768 2.746 1.274 3.855a23.18 23.18 0 0 1-3.587-1.052 14.81 14.81 0 0 1-2.18-3.677c1.323.341 2.856.646 4.493.874zm1.845 4.965a8.66 8.66 0 0 0 1.079 1.504 10.475 10.475 0 0 1-3.755-2.13c.838.247 1.735.46 2.676.626zm1.267.189a21.98 21.98 0 0 0 2.079.15v1.538c-.741-.186-1.446-.775-2.079-1.688zm3.079.15a21.653 21.653 0 0 0 2.079-.15c-.633.913-1.338 1.502-2.079 1.688v-1.538zm3.346-.339c.94-.166 1.838-.379 2.676-.626a10.498 10.498 0 0 1-3.755 2.13 8.66 8.66 0 0 0 1.079-1.504zm.57-1.111c.506-1.109.939-2.403 1.274-3.855a40.513 40.513 0 0 0 4.492-.874 14.829 14.829 0 0 1-2.18 3.677 23.1 23.1 0 0 1-3.586 1.052zm1.489-4.89c.329-1.722.529-3.62.577-5.635 2.126-.061 3.751-.154 4.993-.263a17.658 17.658 0 0 1-.853 4.894c-1.282.365-2.885.73-4.717 1.004zm7.515-12.024a16.318 16.318 0 0 0-1.884-.489 16.574 16.574 0 0 0-1.802-3.741c.96.469 1.642.9 1.968 1.175a14.443 14.443 0 0 1 1.718 3.055zM7.766 8.299a16.66 16.66 0 0 0-1.802 3.741 15.97 15.97 0 0 0-1.884.489 14.443 14.443 0 0 1 1.718-3.055c.326-.275 1.007-.705 1.968-1.175zM5.023 18.553c.047 1.625.294 3.183.716 4.645-1.145-.381-1.878-.72-2.088-.9a14.452 14.452 0 0 1-.64-4.088c.444.118 1.089.236 2.012.343zM4.5 6C3.673 6 3 6.673 3 7.5c0 .662-1 .661-1 0C2 6.673 1.327 6 .5 6c-.662 0-.661-1 0-1C1.327 5 2 4.327 2 3.5c0-.662 1-.661 1 0C3 4.327 3.673 5 4.5 5c.662 0 .661 1 0 1z\"/>","1f3a7":"<path fill=\"#66757F\" d=\"M18 0C9.716 0 3 6.716 3 15v9h3v-9C6 8 11.269 2.812 18 2.812 24.73 2.812 30 8 30 15v10l3-1v-9c0-8.284-6.716-15-15-15z\"/><path fill=\"#31373D\" d=\"M6 27c0 1.104-.896 2-2 2H2c-1.104 0-2-.896-2-2v-9c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v9zm30 0c0 1.104-.896 2-2 2h-2c-1.104 0-2-.896-2-2v-9c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v9z\"/><path fill=\"#55ACEE\" d=\"M19.182 10.016l-6.364 1.313c-.45.093-.818.544-.818 1.004v16.185c-.638-.227-1.341-.36-2.087-.36-2.785 0-5.042 1.755-5.042 3.922 0 2.165 2.258 3.827 5.042 3.827C12.649 35.905 14.922 34 15 32V16.39l4.204-.872c.449-.093.796-.545.796-1.004v-3.832c0-.458-.368-.759-.818-.666zm8 3.151l-4.297.865c-.45.093-.885.544-.885 1.003V26.44c0-.152-.878-.24-1.4-.24-2.024 0-3.633 1.276-3.633 2.852 0 1.574 1.658 2.851 3.683 2.851s3.677-1.277 3.677-2.851l-.014-11.286 2.869-.598c.45-.093.818-.544.818-1.003v-2.33c0-.459-.368-.76-.818-.668z\"/>","1f319":"<path fill=\"#FFD983\" d=\"M30.312.776C32 19 20 32 .776 30.312c8.199 7.717 21.091 7.588 29.107-.429C37.9 21.867 38.03 8.975 30.312.776z\"/><path d=\"M30.705 15.915c-.453.454-.453 1.189 0 1.644.454.453 1.189.453 1.643 0 .454-.455.455-1.19 0-1.644-.453-.454-1.189-.454-1.643 0zm-16.022 14.38c-.682.681-.682 1.783 0 2.465.68.682 1.784.682 2.464 0 .681-.682.681-1.784 0-2.465-.68-.682-1.784-.682-2.464 0zm13.968-2.147c-1.135 1.135-2.974 1.135-4.108 0-1.135-1.135-1.135-2.975 0-4.107 1.135-1.136 2.974-1.136 4.108 0 1.135 1.133 1.135 2.973 0 4.107z\" fill=\"#FFCC4D\"/>","1f492":"<path fill=\"#BCBEC0\" d=\"M20 2h-1V1c0-.552-.447-1-1-1s-1 .448-1 1v1h-1c-.553 0-1 .448-1 1s.447 1 1 1h1v6c0 .552.447 1 1 1s1-.448 1-1V4h1c.553 0 1-.448 1-1s-.447-1-1-1z\"/><path fill=\"#F4ABBA\" d=\"M18 9l-5.143 4H13v9h10v-9h.143z\"/><path fill=\"#662113\" d=\"M19.999 15c0-1.104-.896-2-1.999-2-1.105 0-2 .896-2 2v7h4l-.001-7z\"/><path fill=\"#F4ABBA\" d=\"M17.999 18L4 26v9c0 .553.448 1 1 1h26c.553 0 1-.447 1-1v-9l-14.001-8z\"/><path fill=\"#DD2E44\" d=\"M31.998 27c-.168 0-.339-.042-.495-.132l-13.504-7.717-13.504 7.717c-.478.276-1.09.107-1.364-.372s-.107-1.09.372-1.364l14-8c.308-.176.685-.176.992 0l14 8c.48.274.647.885.372 1.364-.184.323-.521.504-.869.504zm-8.999-13c-.219 0-.439-.072-.624-.219l-4.376-3.5-4.374 3.5c-.432.343-1.061.275-1.406-.156-.345-.432-.275-1.061.156-1.406l4.999-4c.365-.292.884-.292 1.25 0l5.001 4c.431.345.501.974.156 1.405-.198.247-.488.376-.782.376z\"/><path fill=\"#662113\" d=\"M12.999 31c0-1.104-.895-2-1.999-2-1.105 0-2 .896-2 2v5h4v-5h-.001zm7-2c0-1.104-.896-2-1.999-2-1.105 0-2 .896-2 2v7h4l-.001-7zm7 2c0-1.104-.896-2-1.999-2-1.105 0-2 .896-2 2v5h4l-.001-5z\"/><path fill=\"#DD2E44\" d=\"M1 6c0-2.761 3.963-4 5 0 1.121-4 5-2.761 5 0 0 3-5 6-5 6S1 9 1 6zm24 0c0-2.761 3.963-4 5 0 1.121-4 5-2.761 5 0 0 3-5 6-5 6s-5-3-5-6z\"/>","1f940":"<path fill=\"#78B159\" d=\"M22.781 4.715s-5.691-7.14-10.656-3.697c-3.683 2.554-3.667 7.228-3.304 9.478.371 2.298 1.505 7.529 2.194 11.915.69 4.396 1.178 8.329 1.894 12.912.181 1.159 4.068.521 3.964-.613-.177-1.944-1.821-8.965-2.257-12.05-.405-2.865-1.366-8.421-1.929-11.649-.619-3.546-.279-6.676 2.148-7.39 2.787-.819 5.551 3.835 5.551 3.835l2.395-2.741z\"/><path fill=\"#C6E4B5\" d=\"M13.081 16.425s1.71.642 2.871 1.803c1.536 1.536 2.471 4.541 1.269 7.947-.739 2.093 1.069 5.074 1.069 5.074s-2.013-1.077-3.272-2.671c-1.279-1.618-2.12-3.833-2.297-5.647-.117-1.197-.174-3.568.36-6.506\"/><path fill=\"#A6D388\" d=\"M10.276 13.977c-.786.363-2.993 3.198-3.242 4.768-1.037 6.55 2.879 10.825 2.879 10.825s.688-3.983 1.761-5.421c1.245-1.67.545-5.677 0-7.151-.391-1.054-1.398-3.021-1.398-3.021\"/><path fill=\"#78B159\" d=\"M24.735 8.258c-.786 1.067-2.577 1.082-3.999.033-1.423-1.048-1.938-2.763-1.151-3.83.785-1.067 2.576-1.082 3.999-.033 1.423 1.048 1.937 2.763 1.151 3.83\"/><path fill=\"#78B159\" d=\"M26.205 5.37c.845 1.281.107 3.255-1.645 4.41-1.752 1.154-3.858 1.052-4.701-.229-.843-1.28-.106-3.254 1.646-4.409 1.753-1.155 3.856-1.053 4.7.228\"/><path fill=\"#78B159\" d=\"M20.71 8.144c-.874 1.148-2.897 1.476-2.897 1.476s1.695 1.257 2.733.546c1.038-.71.164-2.022.164-2.022m2.551-3.28c-.055-.82 1.312-2.295 1.967-1.913 0 0-.874.984-.054 1.585.819.601-1.913.328-1.913.328\"/><path fill=\"#DA2F47\" d=\"M21.25 8.667c-1.791.958-3.399 3.232-2.56 7.593.726 3.774 3.918 5.321 2.855 7.836-.986 2.335.822 6.097 3.228.392.755-1.788 2.812-9.279.77-13.862-1.23-2.757-3.455-2.408-4.293-1.959z\"/><path fill=\"#E75A70\" d=\"M23.354 7.08c1.322-1.933 3.245-2.175 4.541-.946 6.034 5.724 3.544 16.948-.52 19.367-2.403 1.43-.847-7.209-4.089-10.74-1.905-2.077-1.959-5.273.068-7.681\"/>","1f33e":"<path fill=\"#FFCC4D\" d=\"M21.388.62c-1.852 0-4.235 1.849-6.22 4.826-2.322 3.483-1.069 5.989-.062 8.002.155.31.459.517.805.549.029.001.059.003.089.003.313 0 .61-.147.8-.4 2.394-3.193 6.211-8.196 6.907-8.893C23.895 4.52 24 4.265 24 4 24 1.508 22.65.62 21.388.62zm2.378 8.995c-1.21 0-2.575 1.132-4.565 3.785-2.124 2.831-2.461 5.313-1.095 8.047.151.302.444.507.779.546.038.005.077.007.115.007.295 0 .577-.131.769-.359 1.719-2.063 5.173-6.168 5.938-6.934.188-.188.293-.442.293-.707 0-1.085 0-4.385-2.234-4.385z\"/><path fill=\"#77B255\" d=\"M29.874 11.517c-.268-.482-.878-.654-1.359-.385-7.171 3.983-13.783 14.15-16.367 19.609.838-10.195 5.569-20.044 13.559-28.034.391-.391.391-1.023 0-1.414s-1.023-.391-1.414 0C16.33 9.256 11.466 19.01 10.288 29.174c-.674-5.697-.978-13.91 1.625-19.768.225-.505-.003-1.096-.507-1.32-.505-.226-1.096.003-1.32.507-1.326 2.983-1.945 6.501-2.162 10.009C7.04 16.718 6.001 15 4.472 15h-.046c-.91 0-1.691.466-2.321 1.726-.247.494-.047.922.447 1.169.495.248 1.095.046 1.342-.447.311-.622.525-.77.521-.792.636.196 1.744 2.696 2.162 3.642.196.443.374.842.527 1.15.148.296.425.478.728.529.026 4.957.698 9.53 1.163 12.091l.02.11c.088.483.509.822.984.822.059 0 .119-.005.179-.016.122-.023.231-.071.331-.132.147.086.308.148.491.148s.344-.062.492-.147c.144.085.302.147.482.147H12c.53 0 .971-.448 1-.98.057-1.037 2.494-6.014 6.143-11.043.104-.015.207-.033.305-.082.244-.122.517-.272.808-.433.934-.517 2.494-1.38 3.106-1.02.149.088.638.535.638 2.558 0 .553.447 1 1 1s1-.447 1-1c0-2.236-.53-3.636-1.622-4.28-.783-.461-1.668-.424-2.54-.174 2.32-2.714 4.938-5.165 7.647-6.67.484-.269.658-.876.389-1.359z\"/>","1f9f5":"<path fill=\"#553788\" d=\"M35 36c-.419 0-.809-.265-.948-.684C33.388 33.326 31.595 32 25 32c-.553 0-1-.447-1-1s.447-1 1-1c5.635 0 9.653.797 10.948 4.684.175.524-.108 1.091-.632 1.265-.105.034-.212.051-.316.051z\"/><path fill=\"#553788\" d=\"M3 3h22v30H3z\"/><path fill=\"#C1694F\" d=\"M26 4H2c-.55 0-2-3-2-3 0-.55.45-1 1-1h26c.55 0 1 .45 1 1 0 0-1.45 3-2 3zm0 28H2c-.55 0-2 3-2 3 0 .55.45 1 1 1h26c.55 0 1-.45 1-1 0 0-1.45-3-2-3z\"/><path fill=\"#744EAA\" d=\"M23 7H5c-.55 0-1-.45-1-1s.45-1 1-1h18c.55 0 1 .45 1 1s-.45 1-1 1zm0 4H5c-.55 0-1-.45-1-1s.45-1 1-1h18c.55 0 1 .45 1 1s-.45 1-1 1zm0 4H5c-.55 0-1-.45-1-1s.45-1 1-1h18c.55 0 1 .45 1 1s-.45 1-1 1zm0 4H5c-.55 0-1-.45-1-1s.45-1 1-1h18c.55 0 1 .45 1 1s-.45 1-1 1zm0 4H5c-.55 0-1-.45-1-1s.45-1 1-1h18c.55 0 1 .45 1 1s-.45 1-1 1zm0 4H5c-.55 0-1-.45-1-1s.45-1 1-1h18c.55 0 1 .45 1 1s-.45 1-1 1zm0 4H5c-.55 0-1-.45-1-1s.45-1 1-1h18c.55 0 1 .45 1 1s-.45 1-1 1z\"/><path fill=\"#9266CC\" d=\"M17.261 7H7.739C7.332 7 7 6.668 7 6.261v-.522C7 5.332 7.332 5 7.739 5h9.523c.406 0 .738.332.738.739v.523c0 .406-.332.738-.739.738zm0 4H7.739C7.332 11 7 10.668 7 10.261v-.522C7 9.332 7.332 9 7.739 9h9.523c.406 0 .738.332.738.739v.523c0 .406-.332.738-.739.738zm0 4H7.739C7.332 15 7 14.668 7 14.261v-.523c0-.406.332-.738.739-.738h9.523c.406 0 .738.332.738.739v.523c0 .406-.332.738-.739.738zm0 4H7.739C7.332 19 7 18.668 7 18.261v-.523c0-.406.332-.738.739-.738h9.523c.406 0 .738.332.738.739v.523c0 .406-.332.738-.739.738zm0 4H7.739C7.332 23 7 22.668 7 22.261v-.523c0-.406.332-.738.739-.738h9.523c.406 0 .738.332.738.739v.523c0 .406-.332.738-.739.738zm0 4H7.739C7.332 27 7 26.668 7 26.261v-.523c0-.406.332-.738.739-.738h9.523c.406 0 .738.332.738.739v.523c0 .406-.332.738-.739.738zm0 4H7.739C7.332 31 7 30.668 7 30.261v-.523c0-.406.332-.738.739-.738h9.523c.406 0 .738.332.738.739v.523c0 .406-.332.738-.739.738z\"/>","1f3f9":"<path fill=\"#C1694F\" d=\"M21.279 4.28c-9 0-10.5 1.5-13 4s-4 4-4 13c0 11.181-2 14-1 14s3-2 3-4-2-13 5-20h-.001c7-6.999 18-5 20-5s4-2 4-3-2.818 1-13.999 1z\"/><path fill=\"#D99E82\" d=\"M29.5 29.779c0 .276-.224.5-.5.5H3.78c-.276 0-.5-.224-.5-.5s.224-.5.5-.5H29c.276 0 .5.224.5.5zm.279-.279c-.277 0-.5-.225-.5-.5V3.779c0-.276.223-.5.5-.5.275 0 .5.224.5.5V29c0 .275-.224.5-.5.5z\"/><path fill=\"#99AAB5\" d=\"M0 0l2.793 8.52L4.93 4.955l3.52-2.092z\"/><path fill=\"#DD2E44\" d=\"M26.087 27.393c.364 1.897 0 3.564-.812 3.719-.814.156-1.77-1.256-2.133-3.154-.364-1.898-.001-3.564.812-3.721.814-.157 1.769 1.257 2.133 3.156z\"/><path fill=\"#F4900C\" d=\"M26.568 28.465c.365 1.899 0 3.565-.812 3.721-.813.156-1.769-1.258-2.132-3.154-.365-1.9-.001-3.566.811-3.721.814-.157 1.77 1.255 2.133 3.154z\"/><path fill=\"#A0041E\" d=\"M27.958 29.854c.364 1.899 0 3.564-.812 3.721-.813.156-1.77-1.256-2.133-3.154-.364-1.898 0-3.564.812-3.721.814-.157 1.77 1.255 2.133 3.154z\"/><path fill=\"#DD2E44\" d=\"M29.372 31.268c.365 1.898 0 3.566-.812 3.721-.814.156-1.77-1.256-2.133-3.154-.364-1.899 0-3.564.812-3.721.814-.157 1.77 1.257 2.133 3.154zm-1.979-5.181c1.897.364 3.564 0 3.719-.812.156-.814-1.256-1.77-3.154-2.133-1.898-.364-3.564-.001-3.721.812-.157.814 1.257 1.769 3.156 2.133z\"/><path fill=\"#F4900C\" d=\"M28.465 26.568c1.899.365 3.565 0 3.721-.812.156-.813-1.258-1.769-3.154-2.132-1.9-.365-3.566-.001-3.721.811-.157.814 1.255 1.77 3.154 2.133z\"/><path fill=\"#A0041E\" d=\"M29.854 27.958c1.899.364 3.564 0 3.721-.812.156-.813-1.256-1.77-3.154-2.133-1.898-.364-3.564 0-3.721.812-.157.814 1.255 1.77 3.154 2.133z\"/><path fill=\"#DD2E44\" d=\"M31.268 29.372c1.898.365 3.566 0 3.721-.812.156-.814-1.256-1.77-3.154-2.133-1.899-.364-3.564 0-3.721.812-.157.814 1.257 1.77 3.154 2.133z\"/><path fill=\"#CCD6DD\" d=\"M30.385 29c.382.382.382 1.002 0 1.385-.383.382-1.003.382-1.385 0L4.136 5.52c-.382-.382-.382-1.002 0-1.384.382-.382 1.001-.382 1.384 0L30.385 29z\"/>","1f9f8":"<path fill=\"#C1694F\" d=\"M25 22h-.253c.16-.798.253-1.633.253-2.5 0-5.247-3.134-9.5-7-9.5s-7 4.253-7 9.5c0 .867.093 1.702.253 2.5H11c-2 3-1.502 8.056.122 9C18 35 14 29 18 29s0 6 6.878 2c1.624-.944 2.122-6 .122-9z\"/><path fill=\"#C1694F\" d=\"M23.667 20.458c-.177-1.544.317-3.562.255-5.25C22.535 16.292 19.947 17 18 17s-4.51-.708-5.897-1.792c-.062 1.688.407 3.706.23 5.25-.458 4 2.353 7.184 5.667 7.184s6.125-3.184 5.667-7.184z\"/><path fill=\"#C1694F\" d=\"M12.373 14s-5 1-6 7 3.419 6.581 5 5c2-2 0-4 0-4s1-5 1-8zm11.254 0s5 1 6 7-3.419 6.581-5 5c-2-2 0-4 0-4s-1-5-1-8z\"/><path fill=\"#A0041E\" d=\"M13 13c-2 0-1 1-1 2s1 3 3 2c0 0-1 2-1 5 0 0 2 0 3 2 0 0 1-7 1-9s-4-2-5-2zm10 0c2 0 1 1 1 2s-1 3-3 2c0 0 1 2 1 5 0 0-2 0-3 2 0 0-1-7-1-9s4-2 5-2z\"/><circle fill=\"#C1694F\" cx=\"11\" cy=\"4\" r=\"4\"/><circle fill=\"#662113\" cx=\"11\" cy=\"4\" r=\"2\"/><circle fill=\"#C1694F\" cx=\"25\" cy=\"4\" r=\"4\"/><circle fill=\"#662113\" cx=\"25\" cy=\"4\" r=\"2\"/><ellipse fill=\"#C1694F\" cx=\"18\" cy=\"8.5\" rx=\"8\" ry=\"7.5\"/><circle fill=\"#292F33\" cx=\"15\" cy=\"8\" r=\"1\"/><circle fill=\"#292F33\" cx=\"21\" cy=\"8\" r=\"1\"/><path fill=\"#D99E82\" d=\"M18.058 9.563c-6.808 0-4.612 5.562-.147 5.562 4.464 0 6.955-5.562.147-5.562z\"/><path fill=\"#292F33\" d=\"M16.737 11.065l.526.911c.328.567 1.147.567 1.474 0l.526-.911c.328-.567-.082-1.277-.737-1.277h-1.052c-.655 0-1.064.709-.737 1.277z\"/><path fill=\"#934035\" d=\"M11.265 27.002c-.166 0-.327-.082-.422-.231-.148-.233-.08-.542.153-.69.04-.025 1.027-.688.997-2.022-.023-.991-.933-1.641-.942-1.646-.121-.085-.2-.221-.213-.368-.205-2.36.65-4.709.687-4.809.096-.258.381-.391.642-.296.259.096.392.383.296.642-.008.021-.761 2.099-.644 4.165.375.322 1.146 1.124 1.174 2.289.044 1.91-1.398 2.851-1.459 2.89-.085.051-.178.076-.269.076zm13.471 0c-.092 0-.186-.025-.269-.078-.062-.039-1.504-.979-1.46-2.89.027-1.165.799-1.967 1.174-2.289.118-2.072-.636-4.143-.644-4.164-.096-.259.036-.547.296-.643.257-.095.546.037.642.296.037.099.893 2.448.688 4.809-.013.149-.092.284-.215.369-.008.005-.918.654-.94 1.646-.031 1.353.986 2.016.997 2.022.232.148.302.457.153.69-.096.15-.257.232-.422.232zM24.665 22h.01-.01z\"/><ellipse transform=\"rotate(-45.001 11.121 30.5)\" fill=\"#C1694F\" cx=\"11.122\" cy=\"30.5\" rx=\"4.5\" ry=\"5\"/><path fill=\"#D99E82\" d=\"M13.349 33.227c-1.054 1.054-2.906.912-4.137-.318-1.23-1.23-1.373-3.082-.318-4.137 1.054-1.054 2.906-.912 4.137.318 1.23 1.231 1.372 3.083.318 4.137z\"/><path fill=\"#D99E82\" d=\"M12.889 32.768c-.781.781-2.206.623-3.182-.354-.976-.976-1.135-2.401-.354-3.182.781-.781 2.206-.623 3.182.354s1.135 2.401.354 3.182z\"/><ellipse transform=\"rotate(-45.001 24.878 30.5)\" fill=\"#C1694F\" cx=\"24.878\" cy=\"30.5\" rx=\"5\" ry=\"4.5\"/><path fill=\"#D99E82\" d=\"M22.651 33.227c1.054 1.054 2.906.912 4.137-.318 1.23-1.23 1.373-3.082.318-4.137-1.054-1.054-2.906-.912-4.137.318-1.23 1.231-1.372 3.083-.318 4.137z\"/><ellipse transform=\"rotate(-45.001 24.878 31)\" fill=\"#D99E82\" cx=\"24.878\" cy=\"31\" rx=\"2.5\" ry=\"2\"/><path fill=\"#292F33\" d=\"M18.087 14.138c-1.28 0-2.249-.947-2.264-.961-.098-.098-.098-.255 0-.353s.255-.098.353-.001c.075.074 1.849 1.797 3.647 0 .098-.098.256-.098.354 0s.098.256 0 .354c-.721.721-1.445.961-2.09.961z\"/><path fill=\"#934035\" d=\"M15.95 29.727c-.185 0-.362-.103-.449-.28-2.274-4.635-6.795-3.15-6.986-3.086-.262.091-.545-.049-.635-.311-.09-.261.048-.544.309-.635.055-.02 5.543-1.845 8.21 3.592.122.247.02.547-.229.669-.071.034-.147.051-.22.051zm4.101 0c-.065 0-.132-.013-.195-.04-.255-.108-.373-.401-.265-.655 2.255-5.301 8.141-3.641 8.198-3.623.265.077.416.354.339.619-.077.267-.362.414-.619.341-.207-.061-5.096-1.42-6.998 3.054-.081.189-.266.304-.46.304z\"/>","1f37a":"<path fill=\"#FFAC33\" d=\"M31 5.718h-6v4h4s2 0 2 2v12c0 2-2 2-2 2h-4v4h6c2.206 0 4-1.794 4-4v-16c0-2.206-1.794-4-4-4z\"/><path fill=\"#FFCC4D\" d=\"M27 6H3v26c0 2.209 1.791 4 4 4h16c2.209 0 4-1.791 4-4V6z\"/><path fill=\"#F4900C\" d=\"M8.5 32c-.552 0-1-.447-1-1V15c0-.552.448-1 1-1s1 .448 1 1v16c0 .553-.448 1-1 1zm6.5 0c-.552 0-1-.447-1-1V15c0-.552.448-1 1-1s1 .448 1 1v16c0 .553-.448 1-1 1zm6.5 0c-.553 0-1-.447-1-1V15c0-.552.447-1 1-1s1 .448 1 1v16c0 .553-.447 1-1 1z\"/><path fill=\"#FFAC33\" d=\"M3 5v7.445c.59.344 1.268.555 2 .555 1.674 0 3.104-1.031 3.701-2.491.35.302.801.491 1.299.491.677 0 1.273-.338 1.635-.853C12.345 11.258 13.583 12 15 12c1.301 0 2.445-.631 3.176-1.593C18.54 11.338 19.44 12 20.5 12c.949 0 1.765-.535 2.188-1.314l.147-.361c.497.271 1.059.439 1.665.439.981 0 1.865-.406 2.5-1.056V5H3z\"/><path fill=\"#EEE\" d=\"M24 0H4C2.343 0 1 1.343 1 3v4c0 2.209 1.791 4 4 4 1.674 0 3.104-1.031 3.701-2.491.35.302.801.491 1.299.491.677 0 1.273-.338 1.635-.853C12.345 9.258 13.583 10 15 10c1.301 0 2.445-.631 3.176-1.593C18.54 9.338 19.44 10 20.5 10c.949 0 1.765-.535 2.188-1.314.398.195.839.314 1.312.314 1.657 0 3-1.343 3-3V3c0-1.657-1.343-3-3-3z\"/>","1f3ad":"<path fill=\"#A6D388\" d=\"M22 4.587c0 6.075-3.667 18.333-11 18.333S0 10.663 0 4.587C0-2.593 8.25.92 11 .92c2.712 0 11-3.551 11 3.667z\"/><path fill=\"#5C913B\" d=\"M5.5 11.92c4.583 2.75 7.333 2.75 11 0 2.75-1.833-1.833 6.417-5.5 6.417s-8.25-8.25-5.5-6.417zM3.666 8.254c-.138 0-.278-.031-.41-.097-.452-.226-.636-.777-.409-1.23.636-1.272 1.933-2.15 3.303-2.235.839-.047 2.458.155 3.779 2.137.281.421.167.99-.254 1.271-.423.281-.991.167-1.271-.254-.61-.915-1.355-1.374-2.14-1.324-.73.045-1.428.526-1.777 1.226-.161.32-.485.506-.821.506zm14.668 0c-.336 0-.66-.186-.82-.507-.35-.699-1.047-1.18-1.777-1.226-.776-.042-1.529.409-2.14 1.324-.282.422-.85.535-1.271.254-.421-.281-.535-.85-.254-1.271 1.32-1.983 2.931-2.186 3.779-2.137 1.37.085 2.667.963 3.303 2.235.227.453.043 1.003-.41 1.23-.132.067-.272.098-.41.098z\"/><path fill=\"#CBB7EA\" d=\"M36 17.667C36 23.741 32.333 36 25 36S14 23.741 14 17.667C14 10.486 22.25 14 25 14c2.713 0 11-3.552 11 3.667z\"/><path fill=\"#9266CC\" d=\"M29.5 30.151C26 28 24 28 20.5 30.151c-2.75 1.833.833-4.417 4.5-4.417s7.25 6.25 4.5 4.417zM17 21.917c-.138 0-.278-.031-.41-.097-.453-.226-.636-.777-.41-1.23.7-1.399 2.404-2.49 4.051-2.592 1.489-.099 2.815.585 3.698 1.911.281.422.167.99-.254 1.272-.421.281-.99.167-1.271-.254-.522-.782-1.215-1.148-2.059-1.099-1.121.069-2.164.859-2.526 1.583-.16.32-.484.506-.819.506zm16.001 0c-.337 0-.66-.186-.821-.508-.36-.723-1.403-1.512-2.524-1.582-.842-.047-1.539.316-2.06 1.099-.28.421-.851.535-1.271.254-.421-.281-.535-.85-.254-1.272.884-1.326 2.188-2.009 3.699-1.911 1.648.103 3.352 1.194 4.051 2.593.226.452.042 1.003-.411 1.229-.132.067-.271.098-.409.098z\"/>","1f451":"<path fill=\"#F4900C\" d=\"M14.174 17.075L6.75 7.594l-3.722 9.481z\"/><path fill=\"#F4900C\" d=\"M17.938 5.534l-6.563 12.389H24.5z\"/><path fill=\"#F4900C\" d=\"M21.826 17.075l7.424-9.481 3.722 9.481z\"/><path fill=\"#FFCC4D\" d=\"M28.669 15.19L23.887 3.523l-5.88 11.668-.007.003-.007-.004-5.88-11.668L7.331 15.19C4.197 10.833 1.28 8.042 1.28 8.042S3 20.75 3 33h30c0-12.25 1.72-24.958 1.72-24.958s-2.917 2.791-6.051 7.148z\"/><circle fill=\"#5C913B\" cx=\"17.957\" cy=\"22\" r=\"3.688\"/><circle fill=\"#981CEB\" cx=\"26.463\" cy=\"22\" r=\"2.412\"/><circle fill=\"#DD2E44\" cx=\"32.852\" cy=\"22\" r=\"1.986\"/><circle fill=\"#981CEB\" cx=\"9.45\" cy=\"22\" r=\"2.412\"/><circle fill=\"#DD2E44\" cx=\"3.061\" cy=\"22\" r=\"1.986\"/><path fill=\"#FFAC33\" d=\"M33 34H3c-.552 0-1-.447-1-1s.448-1 1-1h30c.553 0 1 .447 1 1s-.447 1-1 1zm0-3.486H3c-.552 0-1-.447-1-1s.448-1 1-1h30c.553 0 1 .447 1 1s-.447 1-1 1z\"/><circle fill=\"#FFCC4D\" cx=\"1.447\" cy=\"8.042\" r=\"1.407\"/><circle fill=\"#F4900C\" cx=\"6.75\" cy=\"7.594\" r=\"1.192\"/><circle fill=\"#FFCC4D\" cx=\"12.113\" cy=\"3.523\" r=\"1.784\"/><circle fill=\"#FFCC4D\" cx=\"34.553\" cy=\"8.042\" r=\"1.407\"/><circle fill=\"#F4900C\" cx=\"29.25\" cy=\"7.594\" r=\"1.192\"/><circle fill=\"#FFCC4D\" cx=\"23.887\" cy=\"3.523\" r=\"1.784\"/><circle fill=\"#F4900C\" cx=\"17.938\" cy=\"5.534\" r=\"1.784\"/>","270a":"<path fill=\"#EF9645\" d=\"M32.218 10.913c-.81-1.187-2.172-1.967-3.718-1.967H28s-5.353-5.672-5.15-6.091C21.754 3.446 21 4.591 21 5.924c0 0-5.509-3.431-5.247-3.947C14.71 2.669 14 3.946 14 5.424v.522S8.553 4.321 8.857 3.851C7.757 4.441 7 5.588 7 6.924V8.81l-6 6.272v2.645l17.16 14.439c0 .001 13.128-22.164 14.058-21.253z\"/><g fill=\"#FFDC5D\"><path d=\"M4.124 18.946c1.474 0 2.738-.831 3.392-2.043.678 1.212 1.958 2.043 3.446 2.043h.076c1.153 0 2.169-.51 2.889-1.298.023-.024.073-.082.073-.082.185-.212.343-.448.481-.695.04-.072.281-.621.342-.833.052-.173.106-.344.134-.526.141.167.296.319.46.46.069.059.45.339.576.413.589.351 1.271.56 2.008.56h3.166c-.535.27-.999.614-1.424 1-1.729 1.568-2.579 4.085-2.579 7.663 0 .276.224.5.5.5s.5-.224.5-.5c0-3.962 1.01-6.427 3.24-7.663 1.175-.651 2.682-.967 4.571-.967.059 0 .526-.033.526-.033.276 0 .5-.224.5-.5s-.224-.5-.5-.5H18c-1.657 0-3-1.343-3-3s1.343-3 3-3h11c.973 0 2.288.056 3.218.967.325.318.604.736.803 1.297l1.659 5.472c.156.512.73 2.857.626 3.346 0 7.34-8.7 14.972-19.004 14.972C6.326 36 1 27.883 1 17.957v-.229c.01.01.021.016.031.026.881.882 1.799 1.192 2.845 1.192h.248z\"/><path d=\"M3.864 5.946h.271C5.718 5.946 7 7.229 7 8.81v6.272c0 1.582-1.282 2.864-2.864 2.864h-.272C2.282 17.946 1 16.664 1 15.082V8.81c0-1.581 1.282-2.864 2.864-2.864zm10.136 9c0 .891-.396 1.683-1.014 2.233-.53.472-1.221.767-1.986.767-1.657 0-3-1.343-3-3v-9c0-.816.328-1.554.857-2.095.544-.557 1.302-.905 2.143-.905 1.657 0 3 1.343 3 3v9zm4-6c-1.201 0-2.267.541-3 1.38v-6.38c0-.758.29-1.442.753-1.97.55-.627 1.347-1.03 2.247-1.03 1.657 0 3 1.343 3 3v5h-3zm4-4.007c0-.812.326-1.545.85-2.085.544-.559 1.301-.909 2.143-.909h.014C26.66 1.946 28 3.286 28 4.939v4.007h-6V4.939z\"/></g>","1f3d9":"<path fill=\"#88C9F9\" d=\"M32 0H4C1.791 0 0 1.791 0 4v22h36V4c0-2.209-1.791-4-4-4z\"/><path fill=\"#66757F\" d=\"M10 36V7l4-4h2l4 4v29zm23-25c0-1-1-1-1-1h-7s-1 0-1 1v25h9V11z\"/><path fill=\"#292F33\" d=\"M28 17c0-1-1-1-1-1h-8c-1 0-1 1-1 1v19h10V17zm-17 2H6v-5s0-1-1-1H0v19c0 2.209 1.791 4 4 4h8V20s0-1-1-1zm21 6c-1 0-1 1-1 1v10h1c2.209 0 4-1.791 4-4v-7h-4z\"/><path d=\"M8 29h2v2H8zm0-8h2v2H8zm-2 4h2v2H6zM16 9h2v2h-2zm0 4h2v2h-2zm-2 4h2v2h-2zm10 1h2v2h-2zm-2 4h2v2h-2zm-2 6h2v2h-2zm9-16h2v2h-2zm0 4h2v2h-2z\" fill=\"#FFCC4D\"/>","1fa98":"<path fill=\"#B52E04\" d=\"M12.691 34.484l.008.008 4.59-10.124-5.657-5.657-10.124 4.59.008.008c-.179.097-.347.208-.491.352-1.562 1.562-.296 5.361 2.828 8.485s6.923 4.391 8.485 2.828c.145-.143.256-.311.353-.49z\"/><path fill=\"#662113\" d=\"M9.376 17.519c.545-1.059 3.556.521 6.07 3.035s4.047 5.549 3.035 6.07c-1.054.542-3.556-.521-6.07-3.035s-3.578-5.016-3.035-6.07z\"/><path fill=\"#662113\" d=\"M9.864 18.15c-.078 0-.157-.018-.231-.057-.245-.128-.339-.43-.212-.675l8.485-16.263c.128-.245.429-.34.675-.212.245.128.339.43.212.675l-8.485 16.263c-.09.172-.264.269-.444.269zm8.486 8.486c-.18 0-.354-.098-.444-.269-.127-.245-.033-.547.212-.675l16.264-8.485c.245-.128.547-.033.675.212s.033.547-.212.675l-16.264 8.485c-.074.038-.153.057-.231.057z\"/><path fill=\"#C1694F\" d=\"M10.218 17.297c.531-1.04 3.314.485 5.657 2.828s3.729 5.197 2.828 5.657c-.984.502-3.314-.485-5.657-2.828s-3.33-4.673-2.828-5.657z\"/><path fill=\"#C1694F\" d=\"M18.34 1.377L34.623 17.66l-15.92 8.122-8.485-8.485z\"/><path fill=\"#662113\" d=\"M34.021 18.262c-1.928 1.928-7.344-1.494-11.066-5.216S15.811 3.908 17.739 1.98c2.715-2.715 7.219.099 11.701 4.581s7.296 8.986 4.581 11.701z\"/><path fill=\"#BE1931\" d=\"M34.691 17.592c-1.806 1.806-6.616-.673-11.113-5.17s-6.975-9.307-5.17-11.113c2.543-2.543 6.993.324 11.476 4.807s7.35 8.933 4.807 11.476z\"/><ellipse transform=\"rotate(-45.001 26.835 9.166)\" fill=\"#662113\" cx=\"26.835\" cy=\"9.165\" rx=\"4\" ry=\"11.5\"/><path fill=\"#D99E82\" d=\"M24.89 11.11c4.114 4.114 8.502 6.508 10.337 5.758 1.471-2.612-1.258-6.666-5.344-10.751C25.798 2.032 21.744-.697 19.132.773c-.75 1.835 1.645 6.223 5.758 10.337z\"/><ellipse transform=\"rotate(-45.001 27.896 8.105)\" fill=\"#FFE8B6\" cx=\"27.896\" cy=\"8.104\" rx=\"3\" ry=\"10.5\"/><path fill=\"#662113\" d=\"M13.046 23.454c-.128 0-.256-.049-.354-.146-.195-.195-.195-.512 0-.707l11.314-11.314c.195-.195.512-.195.707 0s.195.512 0 .707L13.4 23.308c-.098.097-.226.146-.354.146zm-1.556-1.556c-.1 0-.2-.029-.288-.092-.226-.159-.279-.472-.12-.697l9.545-13.505c.161-.226.474-.277.697-.12.225.159.278.471.119.697l-9.545 13.506c-.096.138-.251.211-.408.211zm3.113 3.112c-.157 0-.312-.073-.409-.211-.16-.226-.106-.538.12-.697l13.505-9.546c.225-.158.537-.107.697.12.159.226.105.538-.119.697l-13.506 9.546c-.088.061-.189.091-.288.091zm-4.244-4.95c-.083 0-.167-.021-.244-.063-.241-.136-.327-.44-.191-.681l8.485-15.132c.135-.242.44-.327.68-.191.241.135.327.44.192.681l-8.486 15.131c-.091.163-.261.255-.436.255zm6.082 6.081c-.175 0-.345-.092-.437-.256-.135-.24-.049-.545.191-.681l15.132-8.485c.239-.135.545-.05.681.191.135.241.049.546-.192.681l-15.131 8.486c-.078.043-.162.064-.244.064z\"/>","1f920":"<path fill=\"#77bf57\" d=\"M33 21c0 8.284-6.716 15-15 15S3 29.284 3 21C3 12.716 9.716 6 18 6s15 6.716 15 15\"/><path fill=\"#664500\" d=\"M25.688 25.605c-.146-.133-.366-.141-.522-.023-.032.023-3.23 2.389-7.165 2.389-3.925 0-7.133-2.365-7.165-2.389-.157-.117-.376-.107-.523.023-.146.132-.179.35-.077.517.105.178 2.648 4.318 7.764 4.318 5.115 0 7.659-4.141 7.765-4.317.101-.169.069-.386-.077-.518zm-10.982-5.84c0 1.593-.922 2.883-2.059 2.883s-2.059-1.29-2.059-2.883c0-1.591.921-2.882 2.059-2.882s2.059 1.29 2.059 2.882zm10.706 0c0 1.593-.922 2.883-2.06 2.883-1.137 0-2.059-1.29-2.059-2.883 0-1.591.922-2.882 2.059-2.882 1.138-.001 2.06 1.29 2.06 2.882zM32 6.13c-1.19 1.441-3.182 1.951-5.076 2.121C26.606 6.713 25.241 1 22.5 1c-2.403 0-3.269 1.091-4.5 1.091C16.769 2.091 15.903 1 13.5 1c-2.741 0-4.106 5.713-4.424 7.251C7.182 8.081 5.19 7.57 4 6.13 1.847 3.524-1 5.444.442 8.304 2.72 12.821 8.23 16 18 16c9.769 0 15.279-3.179 17.558-7.696C37 5.444 34.153 3.524 32 6.13z\"/><path fill=\"#825D0E\" d=\"M21.5 3c-1.869 0-2.543.964-3.5.964-.957 0-1.631-.964-3.5-.964C12.037 3 11 9.75 11 9.75S12.282 12 18 12c5.719 0 7-2.25 7-2.25S23.963 3 21.5 3z\"/><path fill=\"#664500\" d=\"M11 6s2.074 2 7 2c4.927 0 7-2 7-2v2s-2.222 2-7 2c-4.778 0-7-2-7-2V6z\"/>","1f409":"<path fill=\"#3E721D\" d=\"M12.434 29.833c.626-6.708-4.417-7.542-6.417-6.083-1.097.8-1.353 2.323-.479 1.521 1.542-1.416 2.083-.375.917.375s-1.375 2.145-.083 1.188c1.292-.958 1.646-.334.646.895-.605.744.042 1.438 1.167-.062.938-1.251 3.2-1.294 2.662 2.99-.222 1.756 1.453.608 1.587-.824zm7.941-21.022c-.583-3.5-1.125-5.248-4.625-5.832s-6.417 1.75-6.417 1.75.583-3.5 2.333-4.667c.686-.458 1.167 1.75 1.75 1.75s1.167-1.75 2.917-1.75c.583 0 .583 1.75 1.167 1.75.583 0 2.243-.577 2.333 0 .126.812-.167 1.729.292 2.104s1.553-.148 1.901.489c.349.636-.61 1.553-.526 1.97s.719.583.526 1.375-.65.833-.692 1.417.885 1.081.692 1.686c-.192.606-.651.688-.859 1.459-.208.771.541.649.333 1.439-.208.79-.958.991-1.208 1.766-.25.774.666.941.208 1.691s-1.291.875-1.333 1.333.209.818.042 1.555c-.167.736-1.126.362-1.209.945s.209.875.209 1.583-.709.834-.625 1.542.75.167 1.167 1-.249 1.583.209 2.083 1.083-.667 1.708-.25c.625.417.677 1.25 1.359 1.375s.891-1.292 1.391-1.25 1.625.709 2.208.417.541-1.459 1-1.959 1.042-.041 1.458-.583-.145-1.175-.062-1.967.854-1.241.812-1.866-.667-.625-.917-1.292.458-1.25.208-1.875-1.332-.833-1.291-1.458.459-1.333.25-2.042-1.084-1.166-1.042-1.707.499-1.25.583-1.646-.749-.812-.666-1.479.624-.621.832-1.223c.208-.602-.749-.901-.249-1.672s.751-.27 1.167-.688c.416-.417-.001-1.334.416-1.542.417-.208 1.25-.042 1.667-.333s.417-.708.875-.875c.458-.167 1.042.542 1.417.542s1.041-.708 1.541-.542c.5.167 1.584 1.333.917 1.688s-5.751.605-5.792 2.938 2.793 12.917 1.959 15.583-4.291 8.334-8.25 7.25c-3.959-1.084-8.667-3.501-7.542-7.209 1.125-3.709 4.749-11.296 5.458-14.773z\"/><path fill=\"#77B255\" d=\"M21 7.897c0 3.978-2.382 8.144-5.833 7.566-5.323-.89-5.606-2.587-6.417-1.546-2.917 3.743-4.644-.485-5.307-1.186C3.276 12.555 0 11.59 0 9.744c0-1.197 1.75-2.418 2.917-1.231 1.722-.043 8.167-6.156 12.25-6.156C19.25 2.356 21 5.435 21 7.897z\"/><path fill=\"#292F33\" d=\"M14.583 7.062c0 .644-.523 1.167-1.167 1.167s-1.167-.523-1.167-1.167.523-1.167 1.167-1.167c.645.001 1.167.523 1.167 1.167z\"/><path fill=\"#3E721D\" d=\"M2.917 10.271c0 .483-.392.292-.875.292s-.875.191-.875-.292.392-.875.875-.875.875.392.875.875z\"/><path fill=\"#FFF\" d=\"M11.083 11.144c0 .645-.392.583-.875.583s-.875.061-.875-.583c0-.644.392-2.333.875-2.333s.875 1.689.875 2.333zm-2.333.583c0 .645-.392.583-.875.583-.483.001-.875.062-.875-.583 0-.644.392-2.333.875-2.333s.875 1.689.875 2.333z\"/><path fill=\"#3E721D\" d=\"M11.001 11.152c-3.095.442-6.215 1.224-7.558 1.579.167.177.403.579.709 1.021 1.472-.38 4.253-1.051 7.015-1.444.319-.046.54-.342.495-.661-.047-.32-.344-.542-.661-.495z\"/><path fill=\"#77B255\" d=\"M20.946 8.937c0 4.375-1.714 8.201-2.946 11.17-1.333 3.212-1 9 4 9s6.511-3.191 7-5c1.358-5.021-2-8-2-13 0-9 8-7 8-6s-6.934 1.374-3 9S36 36 22 36 8 27.107 10 23.107c1.416-2.832 4-7.107.5-9.045-2.282-1.263 10.446-5.125 10.446-5.125z\"/><path fill=\"#3E721D\" d=\"M11.335 7.771c-.256 0-.512-.098-.707-.293-.391-.391-.391-1.023 0-1.414.083-.083 2.081-2.043 5.374-2.043.552 0 1 .448 1 1s-.448 1-1 1c-2.435 0-3.945 1.442-3.96 1.457-.195.195-.451.293-.707.293z\"/><path fill=\"#5C913B\" d=\"M10.708 25.333c.627-6.708-5.417-7.542-7.417-6.083-1.097.8-1.353 2.323-.479 1.521 1.542-1.416 2.083-.375.917.375-1.167.75-1.375 2.146-.083 1.188s1.646-.334.646.895c-.605.744.042 1.438 1.167-.062.938-1.251 4.2-1.294 3.662 2.99-.222 1.756 1.454.608 1.587-.824z\"/>","1f54c":"<path fill=\"#F4900C\" d=\"M23 4.326c0 4.368-9.837 6.652-9.837 13.206 0 2.184 1.085 4.468 2.177 4.468h15.291c1.093 0 2.192-2.284 2.192-4.468C32.823 10.977 23 8.694 23 4.326z\"/><path fill=\"#FFD983\" d=\"M35 33.815C35 35.022 34.711 36 32.815 36h-19.66C11.26 36 11 35.022 11 33.815V22.894c0-1.206.26-1.894 2.156-1.894h19.66c1.895 0 2.184.688 2.184 1.894v10.921z\"/><path fill=\"#FFD983\" d=\"M23 34c0 1.104-.896 2-2 2H3c-1.104 0-2-.896-2-2v-1c0-1.104.896-2 2-2h18c1.104 0 2 .896 2 2v1z\"/><path fill=\"#662113\" d=\"M26 29c0-3-1.896-5-3-5s-3 2-3 5v7h6v-7zm-8 2.333c0-2-1.264-3.333-2-3.333s-2 1.333-2 3.333V36h4v-4.667zm14 0c0-2-1.264-3.333-2-3.333s-2 1.333-2 3.333V36h4v-4.667z\"/><path fill=\"#FFD983\" d=\"M9 34c0 1.104-.896 2-2 2H5c-1.104 0-2-.896-2-2V8c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v26z\"/><path fill=\"#F4900C\" d=\"M5.995.326c0 1.837-2.832 2.918-2.832 5.675 0 .919.312 2 .627 2h4.402c.314 0 .631-1.081.631-2 0-2.757-2.828-3.838-2.828-5.675z\"/><path fill=\"#FFAC33\" d=\"M10 12c0 .552-.448 1-1 1H3c-.552 0-1-.448-1-1s.448-1 1-1h6c.552 0 1 .448 1 1zm0-4c0 .552-.448 1-1 1H3c-.552 0-1-.448-1-1s.448-1 1-1h6c.552 0 1 .448 1 1z\"/>","1f334":"<path fill=\"#C1694F\" d=\"M21.978 20.424c-.054-.804-.137-1.582-.247-2.325-.133-.89-.299-1.728-.485-2.513-.171-.723-.356-1.397-.548-2.017-.288-.931-.584-1.738-.852-2.4-.527-1.299-.943-2.043-.943-2.043l-3.613.466s.417.87.868 2.575c.183.692.371 1.524.54 2.495.086.49.166 1.012.238 1.573.1.781.183 1.632.242 2.549.034.518.058 1.058.074 1.619.006.204.015.401.018.611.01.656-.036 1.323-.118 1.989-.074.6-.182 1.197-.311 1.789-.185.848-.413 1.681-.67 2.475-.208.643-.431 1.261-.655 1.84-.344.891-.69 1.692-.989 2.359-.502 1.119-.871 1.863-.871 2.018 0 .49.35 1.408 2.797 2.02 3.827.956 4.196-.621 4.196-.621s.243-.738.526-2.192c.14-.718.289-1.605.424-2.678.081-.642.156-1.348.222-2.116.068-.8.125-1.667.165-2.605.03-.71.047-1.47.055-2.259.002-.246.008-.484.008-.737 0-.64-.03-1.261-.071-1.872z\"/><path fill=\"#D99E82\" d=\"M18.306 30.068c-1.403-.244-2.298-.653-2.789-.959-.344.891-.69 1.692-.989 2.359.916.499 2.079.895 3.341 1.114.729.127 1.452.191 2.131.191.414 0 .803-.033 1.176-.08.14-.718.289-1.605.424-2.678-.444.157-1.548.357-3.294.053zm1.06-4.673c-1.093-.108-1.934-.348-2.525-.602-.185.848-.413 1.681-.67 2.475.864.326 1.881.561 2.945.666.429.042.855.064 1.27.064.502 0 .978-.039 1.435-.099.068-.8.125-1.667.165-2.605-.628.135-1.509.21-2.62.101zm.309-2.133c.822 0 1.63-.083 2.366-.228.002-.246.008-.484.008-.737 0-.641-.029-1.262-.071-1.873-.529.138-1.285.272-2.352.286-1.084-.005-1.847-.155-2.374-.306.006.204.015.401.018.611.01.656-.036 1.323-.118 1.989.763.161 1.605.253 2.461.257l.062.001zm-.249-4.577c.825-.119 1.59-.333 2.304-.585-.133-.89-.299-1.728-.485-2.513-.496.204-1.199.431-2.181.572-.91.132-1.605.124-2.129.077.1.781.183 1.632.242 2.549.152.006.29.029.446.029.588.001 1.2-.043 1.803-.129zm1.271-5.116c-.288-.931-.584-1.738-.852-2.4-.443.222-1.004.456-1.737.659-.795.221-1.437.309-1.951.339.183.692.371 1.524.54 2.495.681-.068 1.383-.179 2.094-.376.679-.188 1.31-.44 1.906-.717z\"/><path fill=\"#3E721D\" d=\"M32.61 4.305c-.044-.061-4.48-5.994-10.234-3.39-2.581 1.167-4.247 3.074-4.851 5.535-1.125-1.568-2.835-2.565-5.093-2.968C6.233 2.376 2.507 9.25 2.47 9.32c-.054.102-.031.229.056.305s.217.081.311.015c.028-.02 2.846-1.993 7.543-1.157 4.801.854 8.167 1.694 8.201 1.702.02.005.041.007.061.007.069 0 .136-.028.184-.08.032-.035 3.22-3.46 6.153-4.787 4.339-1.961 7.298-.659 7.326-.646.104.046.227.018.298-.07.072-.087.075-.213.007-.304z\"/><path fill=\"#5C913B\" d=\"M27.884 7.63c-4.405-2.328-7.849-1.193-9.995.22-2.575-.487-7.334-.459-11.364 4.707-4.983 6.387-.618 14.342-.573 14.422.067.119.193.191.327.191.015 0 .031-.001.046-.003.151-.019.276-.127.316-.274.015-.054 1.527-5.52 5.35-10.118 2.074-2.496 4.55-4.806 6.308-6.34 1.762.298 4.327.947 6.846 2.354 4.958 2.773 7.234 7.466 7.257 7.513.068.144.211.226.379.212.158-.018.289-.133.325-.287.02-.088 1.968-8.8-5.222-12.597z\"/>","1f6d5":"<path fill=\"#FF8044\" d=\"M25 2.875L18 2v5.25l7-.875-2.8-1.75z\"/><path fill=\"#C7521E\" d=\"M0 36h36l-2-2H2z\"/><path fill=\"#662113\" d=\"M17.5 3c0-2 1-2 1 0 0 5 1 9 1 9h-3s1-4 1-9z\"/><path fill=\"#C7521E\" d=\"M28 29v-2l-4-1.938V21l-2-2h-.123s.732-3.967-1.377-5.449V12l-1-1h-3l-1 1v1.551C13.391 15.033 14.123 19 14.123 19H14l-2 2v4.062L8 27v2l-4 2v4l28 .037V31l-4-2z\"/><path fill=\"#662113\" d=\"M19.846 19h-3.692s-.615-5 .615-5h2.462c1.231 0 .615 5 .615 5z\"/><path fill=\"#C7521E\" d=\"M11.784 23.477v-.521l-.292-.292h-.063c-.086-.435-.229-1.313-.229-2.337 0-.584-.292-.584-.292 0 0 1.023-.143 1.902-.229 2.337h-.063l-.292.292v.521c-.465.474-.293 1.523-.293 1.523h2.045s.172-1.049-.292-1.523zm13.906 0v-.521l-.292-.292h-.063c-.086-.435-.229-1.313-.229-2.337 0-.584-.292-.584-.292 0 0 1.023-.143 1.902-.229 2.337h-.063l-.292.292v.521c-.465.474-.292 1.523-.292 1.523h2.045c-.001 0 .171-1.049-.293-1.523zm4 4v-.521l-.292-.292h-.063c-.086-.435-.229-1.313-.229-2.337 0-.584-.292-.584-.292 0 0 1.023-.143 1.902-.229 2.337h-.063l-.292.292v.521c-.465.474-.292 1.523-.292 1.523h2.045c-.001 0 .171-1.049-.293-1.523zm4 5v-.521l-.292-.292h-.063c-.086-.435-.229-1.313-.229-2.337 0-.584-.292-.584-.292 0 0 1.023-.143 1.902-.229 2.337h-.063l-.292.292v.521c-.465.474-.292 1.523-.292 1.523h2.045c-.001 0 .171-1.049-.293-1.523zm-25.906-5v-.521l-.292-.292h-.063c-.086-.436-.229-1.314-.229-2.337 0-.584-.292-.584-.292 0 0 1.023-.143 1.902-.229 2.337h-.064l-.292.292v.521C5.859 27.951 6.031 29 6.031 29h2.045s.172-1.049-.292-1.523zm-4 5v-.521l-.292-.292h-.063c-.086-.436-.229-1.314-.229-2.337 0-.584-.292-.584-.292 0 0 1.023-.143 1.902-.229 2.337h-.064l-.292.292v.521C1.859 32.951 2.031 34 2.031 34h2.045s.172-1.049-.292-1.523z\"/><path fill=\"#FF8044\" d=\"M15.5 12l1-1h3l1 1zM12 21l2-2h8l2 2zm-4 6l2-2h16l2 2zm-4 4l2-2h24l2 2zm-4 5l2-2h32l2 2z\"/><path fill=\"#662113\" d=\"M21 25h-6s0-4 1.5-4h3c1.5 0 1.5 4 1.5 4zm1 4h-8s0-2 2-2h4c2 0 2 2 2 2z\"/><path fill=\"#292F33\" d=\"M24 34H12s0-3 3-3h6c3 0 3 3 3 3z\"/><path fill=\"#FFA06C\" d=\"M21 27h-6c-.552 0-1-.448-1-1s.448-1 1-1h6c.552 0 1 .448 1 1s-.448 1-1 1zm1 4h-8c-.552 0-1-.448-1-1s.448-1 1-1h8c.552 0 1 .448 1 1s-.448 1-1 1zm2 5H12c-.552 0-1-.448-1-1s.448-1 1-1h12c.552 0 1 .448 1 1s-.448 1-1 1z\"/><path fill=\"#FF8044\" d=\"M21 31h1v3h-1zm-7 0h1v3h-1z\"/>","1f3f0":"<path fill=\"#CCD6DD\" d=\"M4 17h28v19H4z\"/><path fill=\"#269\" d=\"M6 13h23v5H6z\"/><path fill=\"#AAB8C2\" d=\"M1 12v22c0 1.104.896 2 2 2h4V12H1zm28 0v24h4c1.104 0 2-.896 2-2V12h-6z\"/><path fill=\"#F2F9FF\" d=\"M14 22h8v11h-8z\"/><path fill=\"#269\" d=\"M22 19c-.295 0-.558.391-.74 1h-6.52c-.183-.609-.445-1-.74-1-.552 0-1 1.344-1 3 0 1.657.448 3 1 3s1-1.343 1-3h6c0 1.657.447 3 1 3s1-1.343 1-3c0-1.656-.447-3-1-3z\"/><path fill=\"#66757F\" d=\"M3 17h2v2H3zm6 3h2v2H9zm16 0h2v2h-2zM9 24h2v2H9zm16 0h2v2h-2zM3 21h2v2H3zm28-4h2v2h-2zm0 4h2v2h-2z\"/><path fill=\"#F2F9FF\" d=\"M13 22h10v4H13z\"/><path fill=\"#66757F\" d=\"M18 26c-1.104 0-2 .896-2 2v5h4v-5c0-1.104-.896-2-2-2z\"/><path fill=\"#8899A6\" d=\"M12 33h12v3H12z\"/><path fill=\"#269\" d=\"M1 12h6S5 4 4 4s-3 8-3 8zm28 0h6s-2-8-3-8-3 8-3 8z\"/><path fill=\"#CCD6DD\" d=\"M8 14c0 .552-.448 1-1 1H1c-.552 0-1-.448-1-1s.448-1 1-1h6c.552 0 1 .448 1 1zm28 0c0 .552-.447 1-1 1h-6c-.553 0-1-.448-1-1s.447-1 1-1h6c.553 0 1 .448 1 1z\"/>","1f339":"<path fill=\"#3E721D\" d=\"M19.32 25.358c-.113 0-.217.003-.32.005v-.415c4.805-.479 8.548-4.264 8.548-7.301 0-3.249 0 1.47-9.562 1.47-9.558 0-9.558-4.719-9.558-1.47 0 3.043 3.757 6.838 8.572 7.305v.411c-.104-.002-.207-.005-.321-.005-2.553 0-6.603-2.05-6.603-1.32 0 .646 4.187 4.017 6.924 4.796V35c0 .553.447 1 1 1s1-.447 1-1v-6.166c2.738-.779 6.924-4.15 6.924-4.796 0-.729-4.05 1.32-6.604 1.32z\"/><path fill=\"#A0041E\" d=\"M26.527 7.353c-3.887-4.412 1.506-5.882-2.592-5.882-.713 0-1.921.44-3.29 1.189C19.951 1.088 19.023 0 18 0c-2.05 0-3.726 4.342-3.873 8.269-1.108 1.543-1.855 3.235-1.855 4.966 0 6.092 2.591 8.823 6.479 8.823 7.776.001 13.644-8.047 7.776-14.705z\"/><path fill=\"#BE1931\" d=\"M23.728 13.235c0 6.092-2.59 8.823-6.48 8.823-7.776 0-13.643-8.048-7.776-14.706C13.361 2.94 7.967 1.47 12.064 1.47c2.593.001 11.664 5.674 11.664 11.765z\"/>","1f3d4":"<path fill=\"#292F33\" d=\"M19.083 35.5L12.25 12.292s-1.42.761-2.604 1.637c-.313.231-1.977 2.79-2.312 3.04-1.762 1.315-3.552 2.841-3.792 3.167C3.083 20.76 0 36 0 36l19.083-.5z\"/><path fill=\"#4B545D\" d=\"M32 35l-5.5-19.75L18 4.542l-5.373 4.193-.971 1.172C11.25 10.688 10 15.25 10 15.25L8.75 20 3.252 30.054.917 34.791 32 35z\"/><path fill=\"#FFF\" d=\"M3.252 30.054s7.873-10.783 7.894-11.388C11.167 18.062 10 15.25 10 15.25L8.75 20 3.252 30.054z\"/><path fill=\"#292F33\" d=\"M12 34h2l2-15.75 1.234-1.797 3.578-5.234.094-1.469-3.287 4.454L15 17.752l-2.388 7.362L12 27l-1.791 3.134L8 34zm12.059-17.616l-1.965 5.897L21 26l2.792 7.625 3.552-.062S23 26.625 23 26c0-.12.625-2.687.625-2.687l1.094-4.531L25 17.25l-.941-.866z\"/><path fill=\"#F1F1F1\" d=\"M24.059 16.384l-1.778-.665-1.531.875-1.328-1.063-2.188.922 3.578-5.234zm2.871 7.379l-1.711-1.388-1.594.938 1.094-4.532 1.437 2.282z\"/><path fill=\"#FFF\" d=\"M22.094 22.281L21 26l-.25-2.417zM12 27l-1.791 3.134.353-2.431s.682-.578.938-.911c.255-.333 1.112-1.678 1.112-1.678L12 27zm3.208-11l2.411-1.796L15 17.752z\"/><path fill=\"#292F33\" d=\"M36 36s-.384-3.845-.854-7.083c-.369-2.543-2.757-6.303-4.099-7.115l-1.234-3.536-2.023-5.102-2.258-2.289-1.844-1.626-.505-.621L18 4.542l2.289 5.007.524 1.67 3.246 5.165.66 2.397 1.438 2.281.774 2.701L28 27.5 26 34l10 2z\"/><path fill=\"#5C903F\" d=\"M33.708 32.438c-1.345 0-4.958.562-5.458.562-2 0-4.25-1.75-5.25-1.75S19.406 33 17.406 33c-1.688 0-2.406-.812-4.719-.812-.748 0-4.096.871-4.812.781C6.052 32.741 5.115 32 4.656 32 2 32 0 36 0 36h36s-.875-3.562-2.292-3.562z\"/><path fill=\"#F1F1F1\" d=\"M12.627 8.735l2.123-.485.656 1.844 2.125-.875 2.758.33L18 2.25z\"/><path fill=\"#A8B6C0\" d=\"M23.183 8.628l-1.443-.243-1.451 1.164L18 2.25zM27.953 13l1.859 5.266-1.729-2.828-1.614-1.625-.938-2.938zm7.193 15.917S35 25.032 33.875 23.75 31 21.771 31 21.771l1.438 3.271 1.458 1.417 1.25 2.458z\"/>","1f333":"<path fill=\"#662113\" d=\"M22 33c0 2.209-1.791 3-4 3s-4-.791-4-3l1-9c0-2.209.791-2 3-2s3-.209 3 2l1 9z\"/><path fill=\"#5C913B\" d=\"M34 17c0 8.837-7.163 12-16 12-8.836 0-16-3.163-16-12C2 8.164 11 0 18 0s16 8.164 16 17z\"/><g fill=\"#3E721D\"><ellipse cx=\"6\" cy=\"21\" rx=\"2\" ry=\"1\"/><ellipse cx=\"30\" cy=\"21\" rx=\"2\" ry=\"1\"/><ellipse cx=\"10\" cy=\"25\" rx=\"2\" ry=\"1\"/><ellipse cx=\"14\" cy=\"22\" rx=\"2\" ry=\"1\"/><ellipse cx=\"10\" cy=\"16\" rx=\"2\" ry=\"1\"/><ellipse cx=\"7\" cy=\"12\" rx=\"2\" ry=\"1\"/><ellipse cx=\"29\" cy=\"12\" rx=\"2\" ry=\"1\"/><ellipse cx=\"14\" cy=\"10\" rx=\"2\" ry=\"1\"/><ellipse cx=\"22\" cy=\"10\" rx=\"2\" ry=\"1\"/><ellipse cx=\"26\" cy=\"16\" rx=\"2\" ry=\"1\"/><ellipse cx=\"18\" cy=\"17\" rx=\"2\" ry=\"1\"/><ellipse cx=\"22\" cy=\"22\" rx=\"2\" ry=\"1\"/><ellipse cx=\"18\" cy=\"26\" rx=\"2\" ry=\"1\"/><ellipse cx=\"26\" cy=\"25\" rx=\"2\" ry=\"1\"/></g>","1fa86":"<path fill=\"#BE1931\" d=\"M7 23s1.5 9.5 2.5 10.5S15 35 18 35s7.5-.5 8.5-1.5S29 23 29 23H7z\"/><path fill=\"#F5F8FA\" d=\"M25.512 20.158c-1.502-5.263-13.521-5.263-15.024 0S11.99 32 18 32s9.014-6.579 7.512-11.842z\"/><path fill=\"#292F33\" d=\"M24.579 20.158c-1.316-5.263-11.842-5.263-13.158 0S12.737 30.684 18 30.684s7.895-5.263 6.579-10.526z\"/><path fill=\"#77B255\" d=\"M21.766 24.057c-.878-.306-2.789-.147-3.417.458v-4.048c0-.19-.154-.344-.344-.344-.19 0-.344.154-.344.344v4.048c-.628-.605-2.539-.764-3.417-.458-.255.089 1.81 3.008 3.269 1.55.058-.058.105-.113.148-.169v1.218c0 .19.154.344.344.344.19 0 .344-.154.344-.344v-1.218c.043.055.09.111.148.169 1.459 1.458 3.524-1.461 3.269-1.55z\"/><ellipse fill=\"#EA596E\" cx=\"18\" cy=\"23\" rx=\"11\" ry=\"2\"/><ellipse fill=\"#662113\" cx=\"18\" cy=\"23\" rx=\"10.2\" ry=\"1.5\"/><path fill=\"#DD2E44\" d=\"M9.614 23.853c1.842.391 4.909.647 8.386.647s6.544-.256 8.386-.647c.06-.75.096-1.449.096-2.046 0-4.453-3.635-6.633-3.635-9.904 0-1.09 1.212-3.271 1.212-5.451C24.058 4.271 21.635 1 18 1s-6.058 3.271-6.058 5.451c0 2.181 1.212 4.361 1.212 5.451 0 3.271-3.635 5.451-3.635 9.904-.001.598.035 1.297.095 2.047z\"/><path fill=\"#F5F8FA\" d=\"M18 24.5c1.733 0 3.36-.064 4.787-.177 1.16-1.791 1.53-4.195.922-6.323-1.142-4-3.425-5-1.142-9h-9.134c2.284 4 0 5-1.142 9-.607 2.128-.237 4.533.922 6.323 1.427.113 3.054.177 4.787.177z\"/><path fill=\"#292F33\" d=\"M18 24.5c1.312 0 2.562-.037 3.712-.104C23.101 22.863 23.609 20.434 23 18c-1-4-3-4-1-8h-8c2 4 0 4-1 8-.609 2.434-.101 4.863 1.288 6.396 1.15.067 2.4.104 3.712.104z\"/><path fill=\"#F5F8FA\" d=\"M22.721 5.421C22.057 3.438 20.206 2 18 2s-4.057 1.438-4.721 3.421c1.098-1.168 8.344-1.168 9.442 0z\"/><path fill=\"#FFD983\" d=\"M22.721 5.421C22.312 4.986 18 3.711 18 3.711s-4.312 1.276-4.721 1.711C13.112 5.92 13 6.445 13 7c0 2.761 2.239 5 5 5s5-2.239 5-5c0-.555-.112-1.08-.279-1.579z\"/><path fill=\"#F4900C\" d=\"M22.721 5.421c-2.41-2.555-7.032-2.555-9.442 0-.166.495-.276 1.015-.278 1.564C15.533 6.835 18 4 18 4s2.467 2.835 4.999 2.986c-.002-.55-.112-1.07-.278-1.565z\"/><path fill=\"#662113\" d=\"M16.5 8c-.275 0-.5-.225-.5-.5v-1c0-.275.225-.5.5-.5s.5.225.5.5v1c0 .275-.225.5-.5.5zm3 0c-.275 0-.5-.225-.5-.5v-1c0-.275.225-.5.5-.5s.5.225.5.5v1c0 .275-.225.5-.5.5z\"/><path fill=\"#DD2E44\" d=\"M18 10.499c-.771 0-1.525-.258-1.557-.269-.196-.068-.299-.281-.232-.477.067-.195.281-.301.477-.232.007.002.67.228 1.312.228.646 0 1.305-.225 1.311-.228.196-.067.41.036.478.232.067.196-.036.409-.231.477-.034.011-.787.269-1.558.269z\"/><path fill=\"#77B255\" d=\"M20.547 21.347c-.593-.207-1.885-.1-2.309.309V18.92c0-.128-.104-.232-.232-.232s-.232.104-.232.232v2.736c-.424-.409-1.716-.516-2.309-.309-.172.06 1.223 2.033 2.209 1.047.039-.039.071-.077.1-.114v.823c0 .128.104.232.232.232s.232-.104.232-.232v-.823c.029.037.061.075.1.114.986.986 2.382-.987 2.209-1.047z\"/><path fill=\"#CCD6DD\" d=\"M16.742 20.931c-.144-.062-.257-.194-.32-.351l-.294-.768-.757-.324c-.311-.133-.436-.447-.303-.757l.317-.739-.317-.759c-.126-.314.035-.666.349-.792l.76-.298.337-.786c.133-.311.446-.436.757-.303l.757.324.759-.317c.157-.063.328-.064.472-.002.144.062.259.19.322.347l.296.764.769.329c.31.133.436.446.303.757l-.337.786.317.759c.126.314-.035.666-.349.792l-.76.298-.317.74c-.133.31-.447.436-.757.303l-.769-.329-.759.317c-.158.061-.332.07-.476.009z\"/><path fill=\"#E1E8ED\" d=\"M20.644 16.498l-.769-.329-.013-.033c-.364.311-1.212 1.012-1.212 1.012l.002.028c-.178-.142-.401-.23-.647-.23v-1.578l-.736-.315c-.311-.133-.624-.007-.757.303l-.337.786-.014.006 1.104 1.105c-.189.189-.306.451-.306.739h-1.576l-.316.739c-.133.311-.007.624.303.757l.757.324.001.001 1.045-1.195c.191.253.491.419.833.419h.001l.003 1.58.735.315c.31.133.624.007.757-.303l.317-.739-1.206-1.05c.265-.19.439-.498.439-.849 0-.017-.004-.032-.005-.048.419.042 1.15.11 1.585.149l-.021-.051.337-.786c.132-.311.007-.624-.304-.757z\"/><circle fill=\"#F4900C\" cx=\"18.006\" cy=\"17.991\" r=\"1.162\"/>","1f335":"<path fill=\"#77B255\" d=\"M30 4c-2.209 0-4 1.791-4 4v9.125c0 1.086-.887 1.96-2 2.448V6c0-3.313-2.687-6-6-6s-6 2.687-6 6v17.629c-1.122-.475-2-1.371-2-2.504V16c0-2.209-1.791-4-4-4s-4 1.791-4 4v7c0 2.209 1.75 3.875 3.375 4.812 1.244.718 4.731 1.6 6.625 1.651V33c0 3.313 12 3.313 12 0v-7.549c1.981-.119 5.291-.953 6.479-1.639C32.104 22.875 34 21.209 34 19V8c0-2.209-1.791-4-4-4z\"/><g fill=\"#3E721D\"><circle cx=\"12\" cy=\"6\" r=\"1\"/><circle cx=\"23\" cy=\"3\" r=\"1\"/><circle cx=\"21\" cy=\"9\" r=\"1\"/><circle cx=\"14\" cy=\"16\" r=\"1\"/><circle cx=\"20\" cy=\"20\" r=\"1\"/><circle cx=\"13\" cy=\"26\" r=\"1\"/><circle cx=\"5\" cy=\"27\" r=\"1\"/><circle cx=\"9\" cy=\"20\" r=\"1\"/><circle cx=\"2\" cy=\"18\" r=\"1\"/><circle cx=\"34\" cy=\"8\" r=\"1\"/><circle cx=\"28\" cy=\"11\" r=\"1\"/><circle cx=\"32\" cy=\"16\" r=\"1\"/><circle cx=\"29\" cy=\"24\" r=\"1\"/><circle cx=\"22\" cy=\"30\" r=\"1\"/></g>","1f3d6":"<ellipse fill=\"#3B88C3\" cx=\"18\" cy=\"30.54\" rx=\"18\" ry=\"5.36\"/><path fill=\"#88C9F9\" d=\"M33.813 28.538c0 1.616-2.5 2.587-14.482 2.587-10.925 0-13.612-.971-13.612-2.587s5.683-2.926 13.612-2.926 14.482 1.31 14.482 2.926z\"/><path fill=\"#F4900C\" d=\"M7 28.25c0-1 1-5 11-5 12 0 15 4 15 5s0 2-14 2c-12 0-12-1-12-2z\"/><path fill=\"#66757F\" d=\"M20.62 27.667c-.15.692-.835 1.133-1.527.982-.693-.15-1.133-.834-.983-1.527l5.083-25.985c.15-.693.834-1.132 1.527-.982.691.15 1.133.834.981 1.527L20.62 27.667z\"/><path fill=\"#DD2E44\" d=\"M24.358 1.827C16.736.173 9.501 3.7 8.198 9.705c0 0-.363 1.672.474 1.854.836.182 2.872-1.128 2.872-1.128l20.908 4.538s1.309 2.036 2.146 2.218c.837.182 1.199-1.491 1.199-1.491C37.101 9.69 31.979 3.481 24.358 1.827z\"/><path fill=\"#FFE8B6\" d=\"M24.358 1.827C18.584.574 12.847 4.426 11.544 10.43c0 0-.363 1.673 1.31 2.036 1.673.364 4.545-.765 4.545-.765l9.199 1.997s2.146 2.217 3.819 2.581c1.673.362 2.035-1.311 2.035-1.311 1.303-6.004-2.321-11.888-8.094-13.141z\"/><path fill=\"#DD2E44\" d=\"M24.358 1.827c-3.003-.651-5.657 3.87-6.96 9.874 0 0 2.146 2.218 3.818 2.58l.837.183c1.673.362 4.544-.766 4.544-.766 1.304-6.004.764-11.219-2.239-11.871z\"/><path fill=\"#FFAC33\" d=\"M15.844 27.948c.469-.427 1.75-.326 2.5-.602s1.219-.627 1.844-.376.812.627 1.406.678 1.031.402.781.678-2.219.376-3.531.376-3.579-.226-3-.754z\"/>","1fab6":"<path fill=\"#C1694F\" d=\"M4.048 29.644c-.811-.558-1.541-4.073-.936-4.404.738-.402.686.835 2.255 2.362 1.569 1.528 6.47.913 7.708 1.326 1.363.455-6.385 2.533-9.027.716z\"/><path fill=\"#D99E82\" d=\"M5.367 27.603C4 22 4.655 18.919 5.433 16.861 6.8 13.24 16.699 5.169 23.8 2.637 25.678 1.967 31.62 1 35 1c.589 2.332-1.174 6.717-1.62 7.518-1.009 1.81-3.564 4.273-8.646 9.482-.252.258-5.119-.46-5.376-.191-.283.296 4.044 1.579 3.755 1.889-.738.79-1.495 1.624-2.268 2.507-.172.196-8.311-.923-8.484-.722-.232.27 7.501 1.862 7.266 2.14-.645.765-1.299 1.564-1.959 2.397-1.725 2.178-12.301 1.583-12.301 1.583z\"/><path fill=\"#C1694F\" d=\"M19.15 12.787c1.588.966 5.331 1.943 8.316 2.422 1.898-1.937 3.299-3.378 4.302-4.529-2.259-.49-5.742-1.3-7.487-2.087l-.816-.403-4.872 4.17.557.427z\"/><path fill=\"#662113\" d=\"M35.088 1.514c-.02-.179-.047-.352-.088-.514-.378 0-.792.014-1.225.036-3.438.178-8.307 1.006-9.975 1.601-.345.123-.702.27-1.059.418-.478.198-.964.416-1.459.654.356 1.481 1.126 3.144 1.807 4.013-1.703 1.323-3.317 2.704-4.836 4.115-5.655 5.248-10.021 10.872-13.005 15.242.04.174.076.344.12.524 0 0 .219.012.589.026 1.482-2.288 5.703-8.239 13.194-14.841 1.565-1.379 3.276-2.786 5.13-4.195 1.745.787 5.228 1.597 7.487 2.087.322-.369.606-.712.849-1.028.316-.412.569-.785.763-1.134.415-.746 1.969-4.594 1.708-7.004z\"/><path fill=\"#C1694F\" d=\"M35 1c-.369 0-.751-.003-1.138-.008-3.915 1.874-7.509 4.194-10.772 6.73-.68-.87-1.451-2.532-1.807-4.013-1.467.708-2.987 1.575-4.484 2.539.309 1.911.852 4.377 1.455 5.589C6.827 22.441.638 34.605.553 34.776c-.124.247-.023.547.224.671.071.036.147.053.223.053.184 0 .36-.102.448-.276.119-.238 12.144-23.883 33.659-33.72-.032-.174-.066-.343-.107-.504z\"/>","26ea":"<path fill=\"#BCBEC0\" d=\"M20 2h-1V1c0-.552-.447-1-1-1s-1 .448-1 1v1h-1c-.553 0-1 .448-1 1s.447 1 1 1h1v6c0 .552.447 1 1 1s1-.448 1-1V4h1c.553 0 1-.448 1-1s-.447-1-1-1z\"/><path fill=\"#FFD983\" d=\"M18 9l-5.143 4H13v9h10v-9h.143z\"/><path fill=\"#662113\" d=\"M19.999 15c0-1.104-.896-2-1.999-2-1.105 0-2 .896-2 2v7h4l-.001-7z\"/><path fill=\"#FFD983\" d=\"M17.999 18L4 26v9c0 .553.448 1 1 1h26c.553 0 1-.447 1-1v-9l-14.001-8z\"/><path fill=\"#DD2E44\" d=\"M31.998 27c-.168 0-.339-.042-.495-.132l-13.504-7.717-13.504 7.717c-.478.276-1.09.107-1.364-.372s-.107-1.09.372-1.364l14-8c.308-.176.685-.176.992 0l14 8c.48.274.647.885.372 1.364-.184.323-.521.504-.869.504zm-8.999-13c-.219 0-.439-.072-.624-.219l-4.376-3.5-4.374 3.5c-.432.343-1.061.275-1.406-.156-.345-.432-.275-1.061.156-1.406l4.999-4c.365-.292.884-.292 1.25 0l5.001 4c.431.345.501.974.156 1.405-.198.247-.488.376-.782.376z\"/><path fill=\"#662113\" d=\"M12.999 31c0-1.104-.895-2-1.999-2-1.105 0-2 .896-2 2v5h4v-5h-.001zm7-2c0-1.104-.896-2-1.999-2-1.105 0-2 .896-2 2v7h4l-.001-7zm7 2c0-1.104-.896-2-1.999-2-1.105 0-2 .896-2 2v5h4l-.001-5z\"/>","1f33d":"<path fill=\"#5C913B\" d=\"M15.373 1.022C13.71 2.686 8.718 9.34 11.214 15.164c2.495 5.823 5.909 2.239 7.486-2.495.832-2.496.832-5.824-.831-10.815-.832-2.496-2.496-.832-2.496-.832zm19.304 19.304c-1.663 1.663-8.319 6.655-14.142 4.159-5.824-2.496-2.241-5.909 2.495-7.486 2.497-.832 5.823-.833 10.814.832 2.496.831.833 2.495.833 2.495z\"/><path fill=\"#F4900C\" d=\"M32.314 6.317s-.145-1.727-.781-2.253c-.435-.546-2.018-.546-2.018-.546-1.664 0-20.798 2.496-24.125 19.133-.595 2.973 4.627 8.241 7.638 7.638C29.667 26.963 32.313 7.98 32.314 6.317z\"/><path d=\"M24.769 8.816l-1.617-1.617c-.446-.446-1.172-.446-1.618 0-.446.447-.446 1.171 0 1.617l1.618 1.618c.445.446 1.171.446 1.617 0 .446-.446.446-1.17 0-1.618zm-9.705 1.619c.446.446 1.171.446 1.617 0 .447-.447.447-1.171 0-1.618l-.77-.77c-.654.398-1.302.829-1.938 1.297l1.091 1.091zm2.426-2.427c.447.447 1.17.447 1.617 0 .446-.446.446-1.17 0-1.617l-.025-.025c-.711.325-1.431.688-2.149 1.086l.557.556zm-4.853 4.853c.447.446 1.171.446 1.619 0 .446-.447.446-1.171 0-1.618l-1.198-1.196c-.586.474-1.156.985-1.707 1.528l1.286 1.286zM23.96 4.773c-.447.447-.447 1.17 0 1.617l1.617 1.617c.447.447 1.171.447 1.617 0 .446-.446.446-1.17 0-1.617l-1.617-1.617c-.447-.446-1.17-.446-1.617 0zm2.408-.796c.006.007.008.016.015.023L28 5.617c.447.447 1.171.447 1.617 0 .446-.446.446-1.17 0-1.617l-.462-.462c-.54.044-1.516.172-2.787.439zm-4.025 8.884c.446-.447.446-1.171 0-1.618l-1.618-1.617c-.446-.447-1.171-.447-1.617 0-.447.446-.447 1.17 0 1.617l1.617 1.618c.446.446 1.171.446 1.618 0zm-2.428 2.426c.447-.447.447-1.171 0-1.618l-1.617-1.617c-.446-.447-1.17-.447-1.617 0-.446.447-.446 1.171 0 1.617l1.617 1.618c.447.446 1.172.446 1.617 0zm-4.851 4.852c.447-.447.446-1.17 0-1.618l-1.618-1.617c-.446-.446-1.169-.447-1.617 0-.446.447-.446 1.171 0 1.617l1.617 1.618c.447.446 1.171.446 1.618 0zm-.808-5.661c-.447.446-.447 1.171 0 1.618l1.617 1.617c.447.446 1.17.446 1.618 0 .447-.447.447-1.171 0-1.617l-1.618-1.618c-.447-.447-1.171-.447-1.617 0z\" fill=\"#F7B82D\"/><path fill=\"#77B255\" d=\"M27.866 23.574c-7.125-2.374-15.097.652-19.418 3.576 2.925-4.321 5.95-12.294 3.576-19.418-.934-2.8-5.602-5.601-8.402-2.801-.934.934-1.867 1.868 0 1.868s4.667 2.8 3.735 5.601c-.835 2.505-6.889 8.742-4.153 15.375-.27.115-.523.279-.744.499l-.715.714c-.919.919-.919 2.409 0 3.329l.716.716c.919.92 2.409.92 3.328 0l.715-.716c.123-.123.227-.258.316-.398 6.999 3.84 13.747-2.799 16.379-3.677 2.8-.933 5.6 1.868 5.6 3.734 0 1.867.934.934 1.867 0 2.801-2.8-.001-7.47-2.8-8.402z\"/>","1f3fa":"<path fill=\"#C1694F\" d=\"M27.843 11.9c.205-.371.39-.766.548-1.183 1.209-3.187.467-6.423-1.658-7.229-1.588-.602-3.499.326-4.868 2.164-.397-1.141-.548-2.209-.092-2.652h-8.228c.455.443.304 1.511-.093 2.652-1.369-1.838-3.28-2.766-4.868-2.164-2.125.806-2.868 4.042-1.659 7.229.158.418.344.812.548 1.183-1.184 1.166-2.157 2.879-2.157 5.563 0 6.17 8.227 13.39 9.256 15.447-.126.045 6.297.045 6.171 0C21.773 30.852 30 23.633 30 17.462c0-2.683-.973-4.396-2.157-5.562zM11.488 9.214c-.382.382-1.333.768-2.377 1.418-.111-.198-.214-.406-.299-.631-.617-1.624-.237-3.272.845-3.683.931-.354 2.076.329 2.772 1.559-.335.585-.673 1.069-.941 1.337zm15.017.787c-.085.225-.188.433-.299.632-1.044-.65-1.995-1.036-2.377-1.418-.268-.268-.606-.753-.94-1.337.695-1.23 1.841-1.913 2.772-1.559 1.081.41 1.461 2.058.844 3.682z\"/><path d=\"M18.546 31.747H16.63c-2.057 0-5.142.971-5.142 3.027 0 1.029 3.942 1.143 6.085 1.143h.032c2.143 0 6.084-.113 6.084-1.143-.001-2.056-3.085-3.027-5.143-3.027zM30 17.462c0-2.611-.923-4.299-2.063-5.462H7.38c-1.14 1.163-2.063 2.852-2.063 5.462 0 1.481.481 3.022 1.216 4.538h22.251C29.519 20.484 30 18.943 30 17.462zM23.688 1.373c0-1.011-3.808-1.159-5.972-1.164H17.6c-2.164.005-5.972.152-5.972 1.164 0 2.013 3.796 2.942 5.887 2.982h.285c2.093-.041 5.888-.97 5.888-2.982z\" fill=\"#272B2B\"/><path d=\"M13.031 20H10.46c-.284 0-.514-.216-.514-.5s.23-.5.514-.5H13v-4H9v1h2.488c.284 0 .514.216.514.5s-.23.5-.514.5H9.062C8.521 17 8 16.854 8 16.229v-1.315c0-.726.604-.914.888-.914h4.143c.698 0 .969.479.969.915v4.114c0 .617-.458.971-.969.971zm14 0h-2.572c-.283 0-.514-.216-.514-.5s.231-.5.514-.5H27v-4h-4v1h2.488c.283 0 .514.216.514.5s-.231.5-.514.5h-2.426c-.541 0-1.062-.146-1.062-.771v-1.315c0-.726.604-.914.889-.914h4.143c.697 0 .968.479.968.915v4.114c0 .617-.458.971-.969.971zm-7 0h-2.572c-.283 0-.514-.216-.514-.5s.231-.5.514-.5H20v-4h-4v1h2.488c.283 0 .514.216.514.5s-.231.5-.514.5h-2.426c-.541 0-1.062-.146-1.062-.771v-1.315c0-.726.604-.914.889-.914h4.143c.697 0 .968.479.968.915v4.114c0 .617-.458.971-.969.971z\" fill=\"#C1694F\"/>","1fab7":"<path fill=\"#EF8294\" d=\"M15.274 20.121c-2.712 0-4.91-2.837-4.91-7.063 0-4.319 2.035-6.272 2.896-6.905a.5.5 0 0 1 .667.068c.891.989 3.528 4.137 3.528 6.778 0 4.227.528 7.122-2.181 7.122zm5.452 0c2.712 0 4.91-2.837 4.91-7.063 0-4.319-2.035-6.272-2.896-6.905a.5.5 0 0 0-.667.068c-.891.989-3.528 4.137-3.528 6.778 0 4.227-.528 7.122 2.181 7.122z\"/><path fill=\"#F4ABBA\" d=\"M18 21.182c-5.17-5.25-3.322-6.513-14.294-10.218a.5.5 0 0 0-.62.276c-1.804 4.216-1.369 7.359 4.201 8.894-2.141-.014-4.393.249-6.813.492a.5.5 0 0 0-.447.55c.325 3.099 3.617 7.551 11.214 5.121A2.68 2.68 0 0 0 11 27.392c0 2.683 5.164 4.224 6.62 4.605a1.528 1.528 0 0 0 .76 0c1.456-.381 6.62-1.922 6.62-4.605 0-.387-.089-.751-.241-1.094 7.596 2.43 10.888-2.022 11.214-5.121a.5.5 0 0 0-.447-.55c-2.42-.243-4.671-.507-6.813-.492 5.57-1.535 6.004-4.678 4.201-8.894a.5.5 0 0 0-.62-.277C21.322 14.668 23.17 15.932 18 21.182z\"/><path fill=\"#EA596E\" d=\"M26.975 8.577a.56.56 0 0 0-.931.007l-3.259 4.961-.426-.001c0-.023.005-.044.005-.067 0-3.677-3.182-5.798-4.111-6.339a.502.502 0 0 0-.503 0c-.929.541-4.113 2.662-4.113 6.339 0 .023.005.044.005.067l-.426.001-3.26-4.961a.56.56 0 0 0-.931-.006c-1.417 2.086-2.438 4.673-1.86 7.472 1.098 5.323 5.866 7.944 10.837 6.769 4.968 1.175 9.736-1.445 10.834-6.769.577-2.8-.444-5.387-1.861-7.473z\"/><path fill=\"#F4900C\" d=\"m15.142 21.727-2.597-7.636h10.91l-2.597 7.636z\"/><ellipse fill=\"#FFDC5D\" cx=\"18\" cy=\"14.091\" rx=\"5.455\" ry=\"1.636\"/><path fill=\"#EA596E\" d=\"M18.001 26c-2.411 0-4.365-2.309-4.365-5.748 0-3.797 3.167-5.992 4.106-6.558a.502.502 0 0 1 .518 0c.938.567 4.104 2.761 4.104 6.559 0 3.438-1.954 5.747-4.363 5.747z\"/><path fill=\"#EF8294\" d=\"M32 14.716a.503.503 0 0 0-.617-.491c-2.67.644-13.348 3.72-13.382 11.737-.035-8.017-10.713-11.093-13.383-11.737a.499.499 0 0 0-.618.491c.021 2.451.999 11.282 13.998 11.284h.004C31.001 25.998 31.979 17.167 32 14.716z\"/>","1f341":"<path fill=\"#DD2E44\" d=\"M36 20.917c0-.688-2.895-.5-3.125-1s3.208-4.584 2.708-5.5-5.086 1.167-5.375.708c-.288-.458.292-3.5-.208-3.875s-5.25 4.916-5.917 4.292c-.666-.625 1.542-10.5 1.086-10.698-.456-.198-3.419 1.365-3.793 1.282C21.002 6.042 18.682 0 18 0s-3.002 6.042-3.376 6.125c-.374.083-3.337-1.48-3.793-1.282-.456.198 1.752 10.073 1.085 10.698C11.25 16.166 6.5 10.875 6 11.25s.08 3.417-.208 3.875c-.289.458-4.875-1.625-5.375-.708s2.939 5 2.708 5.5-3.125.312-3.125 1 8.438 5.235 9 5.771c.562.535-2.914 2.802-2.417 3.229.576.496 3.839-.83 10.417-.957V35c0 .553.448 1 1 1 .553 0 1-.447 1-1v-6.04c6.577.127 9.841 1.453 10.417.957.496-.428-2.979-2.694-2.417-3.229.562-.536 9-5.084 9-5.771z\"/>","1f3a9":"<path fill=\"#31373D\" d=\"M30.198 27.385L32 3.816c0-.135-.008-.263-.021-.373.003-.033.021-.075.021-.11C32 1.529 25.731.066 18 .066c-7.732 0-14 1.462-14 3.267 0 .035.017.068.022.102-.014.11-.022.23-.022.365l1.802 23.585C2.298 28.295 0 29.576 0 31c0 2.762 8.611 5 18 5s18-2.238 18-5c0-1.424-2.298-2.705-5.802-3.615z\"/><path fill=\"#66757F\" d=\"M17.536 6.595c-4.89 0-8.602-.896-10.852-1.646-.524-.175-.808-.741-.633-1.265.175-.524.739-.808 1.265-.633 2.889.963 10.762 2.891 21.421-.016.529-.142 1.082.168 1.227.702.146.533-.169 1.083-.702 1.228-4.406 1.202-8.347 1.63-11.726 1.63z\"/><path fill=\"#744EAA\" d=\"M30.198 27.385l.446-5.829c-7.705 2.157-17.585 2.207-25.316-.377l.393 5.142c.069.304.113.65.113 1.076 0 1.75 1.289 2.828 2.771 3.396 4.458 1.708 13.958 1.646 18.807.149 1.467-.453 2.776-1.733 2.776-3.191 0-.119.015-.241.024-.361l-.014-.005z\"/>","26f0":"<path fill=\"#292F33\" d=\"M19.083 35.5L12.25 12.292s-1.42.761-2.604 1.637c-.313.231-1.977 2.79-2.312 3.04-1.762 1.315-3.552 2.841-3.792 3.167C3.083 20.76 0 36 0 36l19.083-.5z\"/><path fill=\"#4B545D\" d=\"M26.5 15.25l-7.312-9.212L18 2.25l-5.373 6.484-.971 1.172C11.25 10.688 10 15.25 10 15.25L8.75 20 3.252 30.054.917 34.791 32 35l-5.5-19.75z\"/><path fill=\"#292F33\" d=\"M12 34h2l2-15.75 1.234-1.797 3.578-5.234.094-1.469-3.287 4.454L15 17.752l-2.388 7.362L12 27l-1.791 3.134L8 34zm12.059-17.616l-1.965 5.897L21 26l2.792 7.625 3.552-.062S23 26.625 23 26c0-.12.625-2.687.625-2.687l1.094-4.531L25 17.25l-.941-.866z\"/><path fill=\"#292F33\" d=\"M36 36s-.384-3.845-.854-7.083c0 0-.146-3.885-1.271-5.167-1.049-1.195-2.624-1.875-2.833-1.962l-1.229-3.523L27.953 13l-2.422-2.125-1.844-1.626-.505-.621L18 2.25l2.289 7.299.524 1.67 3.246 5.165.66 2.397 1.438 2.281.774 2.701L28 27.5 26 34l10 2z\"/><path fill=\"#5C903F\" d=\"M33.708 32.438c-1.345 0-4.958.562-5.458.562-2 0-4.25-1.75-5.25-1.75S19.406 33 17.406 33c-1.688 0-2.406-.812-4.719-.812-.748 0-4.096.871-4.812.781C6.052 32.741 5.115 32 4.656 32 2 32 0 36 0 36h36s-.875-3.562-2.292-3.562z\"/>","1f54d":"<path fill=\"#A7A9AC\" d=\"M26 9l-8-8-8 8v27h16z\"/><path fill=\"#292F33\" d=\"M26 10c-.256 0-.512-.098-.707-.293L18 2.414l-7.293 7.293c-.391.391-1.023.391-1.414 0s-.391-1.023 0-1.414l8-8c.391-.391 1.023-.391 1.414 0l8 8c.391.391.391 1.023 0 1.414-.195.195-.451.293-.707.293z\"/><path fill=\"#D1D3D4\" d=\"M11 36H4c-1.104 0-2-.896-2-2V20c0-1.104.896-2 2-2h5c1.104 0 2 .896 2 2v16z\"/><path fill=\"#67757F\" d=\"M12 19.785c.171-.662.005-1.395-.514-1.914L7.95 14.336c-.781-.781-2.047-.781-2.828 0l-3.536 3.536c-.52.519-.686 1.251-.514 1.914H12z\"/><path fill=\"#D1D3D4\" d=\"M2 20h9v1H2zm23 16h7c1.104 0 2-.896 2-2V20c0-1.104-.896-2-2-2h-5c-1.104 0-2 .896-2 2v16z\"/><path fill=\"#67757F\" d=\"M34.936 19.785c.171-.662.005-1.395-.515-1.914l-3.536-3.536c-.78-.781-2.047-.781-2.828 0l-3.535 3.536c-.519.519-.686 1.251-.514 1.914h10.928z\"/><path fill=\"#D1D3D4\" d=\"M25 20h9v1h-9z\"/><path fill=\"#292F33\" d=\"M12 19.785c0 .553-.448 1-1 1H2c-.552 0-1-.447-1-1 0-.552.448-1 1-1h9c.552 0 1 .448 1 1zm23 0c0 .553-.447 1-1 1h-9c-.553 0-1-.447-1-1 0-.552.447-1 1-1h9c.553 0 1 .448 1 1z\"/><path fill=\"#67757F\" d=\"M17.799 20c-.693 0-1.33-.388-1.703-1.038l-.672-1.173h-1.581c-.714 0-1.34-.346-1.676-.926-.345-.597-.326-1.344.05-1.999l.765-1.335-.766-1.336c-.377-.657-.395-1.404-.049-2 .336-.579.962-.924 1.675-.924h1.581l.671-1.172c.375-.651 1.011-1.039 1.704-1.039.67 0 1.295.368 1.674.984l.757 1.227h1.855c.726 0 1.356.353 1.685.945.337.603.3 1.354-.102 2.006l-.809 1.31.808 1.309c.401.651.439 1.401.102 2.007-.329.591-.958.944-1.684.944H20.23l-.76 1.23c-.375.613-1.001.98-1.671.98z\"/><path fill=\"#FFCC4D\" d=\"M17.799 19c-.336 0-.64-.195-.836-.536l-3.878-6.768c-.2-.348-.219-.714-.052-1 .157-.271.453-.427.811-.427h8.242c.363 0 .658.157.811.431.161.288.133.651-.079.996l-4.196 6.799c-.199.32-.499.505-.823.505zm-3.812-7.735l3.814 6.658 4.108-6.656-7.922-.002z\"/><path fill=\"#FFCC4D\" d=\"M22.086 16.789h-8.242c-.358 0-.653-.155-.811-.427-.167-.288-.148-.652.052-1l3.878-6.769c.196-.34.5-.536.836-.536.323 0 .624.185.822.507l4.196 6.798c.212.344.24.706.079.995-.152.275-.447.432-.81.432zm-8.098-.998l7.922.002-4.108-6.658-3.814 6.656z\"/><path fill=\"#67757F\" d=\"M15 27.531h6V34h-6z\"/><ellipse fill=\"#67757F\" cx=\"18\" cy=\"27.5\" rx=\"3\" ry=\"2.5\"/><path fill=\"#D1D3D4\" d=\"M10 34h16v2H10z\"/><path fill=\"#67757F\" d=\"M8 28.785c0 .828-.671-1-1.5-1s-1.5 1.828-1.5 1v-4.5c0-.828.671-1.5 1.5-1.5s1.5.672 1.5 1.5v4.5zm23 0c0 .828-.672-1-1.5-1s-1.5 1.828-1.5 1v-4.5c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5v4.5z\"/>","1f33a":"<path fill=\"#77B255\" d=\"M19.602 32.329c6.509 6.506 17.254-7.669 15.72-7.669-7.669 0-22.227 1.161-15.72 7.669z\"/><path fill=\"#77B255\" d=\"M15.644 33.372C9.612 39.404-.07 26.263 1.352 26.263c3.81 0 9.374-.348 12.79.867 2.958 1.052 4.304 3.442 1.502 6.242z\"/><path fill=\"#F4ABBA\" d=\"M34.613 15.754c-.052-.901-.175-2.585-1.398-4.227-1.16-1.549-3.805-3.371-5.534-2.585.516-1.676-.264-4.125-1.191-5.49-1.179-1.736-4.262-3.843-8.146-3.026-1.754.369-4.18 2.036-4.632 3.864-1.18-1.471-4.22-1.675-6.015-1.222-2.026.511-3.154 1.777-3.739 2.461l.003-.005-.03.034-.027.033c-.583.689-1.656 1.994-1.847 4.074-.193 2.146.75 5.832 3.026 6.042.149.014.324.031.514.051-2.271.098-3.572 3.654-3.595 5.8-.022 2.102.926 3.506 1.443 4.243l-.003-.004c.008.01.019.024.025.036.007.011.02.023.026.036.523.733 1.525 2.094 3.515 2.776 1.958.669 5.553.656 6.567-1.236-.273 2.244 3.027 4.077 5.169 4.438 2.115.358 3.71-.358 4.55-.753l-.005.003c.013-.008.028-.015.041-.021l.041-.02c.838-.4 2.398-1.178 3.462-3.04.729-1.282 1.27-3.403.951-5.015l.192.127c1.826 1.224 4.63-1.119 5.705-2.938 1.044-1.761.932-4.424.932-4.436z\"/><path fill=\"#EA596E\" d=\"M27.542 13.542c-1.786-.997-4.874-.434-6.792.308-.266-.468-.621-.875-1.051-1.196 1.393-1.607 3.526-4.593 1.468-6.362-2.191-1.883-3.74 2.154-3.575 5.605-.068-.003-.132-.02-.201-.02-1.019 0-1.94.402-2.632 1.045-1.401-2.277-3.942-4.244-5.314-2.392-1.482 2.002 1.148 3.153 4.222 4.2-.09.329-.154.668-.154 1.025 0 .456.093.887.238 1.293-2.541.732-6.236 2.718-4.21 4.91 2.122 2.296 4.472-1.238 5.604-3.053.635.454 1.407.727 2.247.727.225 0 .441-.029.655-.066-.109 4.802 1.443 7.07 4.036 5.892 2.295-1.043-.137-5.299-1.781-7.165.316-.362.564-.779.729-1.241 7.008 2.544 8.589-2.351 6.511-3.51z\"/><path fill=\"#BE1931\" d=\"M17.707 17.459c-.679 0-.668-.562-.832-1.25-.532-2.233-2.381-6.308-4.601-9.163-.509-.654-.391-1.596.263-2.105.654-.508 1.596-.391 2.105.263 2.439 3.136 3.264 7.404 3.982 10.421.191.806.237 1.601-.569 1.792-.116.028-.233.042-.348.042z\"/><path fill=\"#FFCC4D\" d=\"M15.904 5.327c.498.684.079 1.838-.936 2.578l-.475.347c-1.016.739-2.243.785-2.741.101l-2.78-3.817c-.498-.684-.079-1.838.936-2.577l.475-.347c1.015-.739 2.242-.785 2.74-.101l2.781 3.816z\"/>","1f40e":"<path fill=\"#292F33\" d=\"M28.721 12.849s3.809 1.643 5.532.449c1.723-1.193 2.11-2.773 1.159-4.736-.951-1.961-3.623-2.732-3.712-5.292 0 0-.298 4.141 1.513 5.505 2.562 1.933-.446 4.21-3.522 3.828-3.078-.382-.97.246-.97.246z\"/><path fill=\"#8A4B38\" d=\"M23.875 19.375s-.628 2.542.187 5.03c.145.341.049.556-.208.678-.256.122-4.294 1.542-4.729 1.771-.396.208-1.142 1.78-1.208 2.854.844.218 1.625.104 1.625.104s.025-1.915.208-2.042c.183-.127 5.686-1.048 6.062-1.771s1.611-3.888.812-5.292c-.225-.395-.637-1.15-.637-1.15l-2.112-.182z\"/><path fill=\"#292F33\" d=\"M17.917 29.708s-.616 1.993.008 2.138c.605.141 1.694-.388 1.755-.646.081-.343.216-1.179.098-1.366-.118-.186-1.861-.126-1.861-.126z\"/><path fill=\"#8A4B38\" d=\"M11.812 21.875l-.75-2.562s-2.766 2.105-3.938 3.594c-.344.437-1.847 3.198-1.722 4.413.05.488.474 2.583.474 2.583l1.651-.465s-1.312-1.896-1.021-2.562c1.428-3.263 5.306-5.001 5.306-5.001z\"/><path fill=\"#292F33\" d=\"M7.679 29.424c-.172-.139-1.803.479-1.803.479s.057 2.085.695 2.022c.618-.061 1.48-.912 1.455-1.175-.034-.351-.175-1.187-.347-1.326z\"/><path fill=\"#C1694F\" d=\"M27.188 11.188c-3.437.156-7.207.438-9.5.438-3.655 0-5.219-1.428-6.562-2.625C8.838 6.964 8.167 4.779 6 5.501c0 0-.632-.411-1.247-.778l-.261-.152c-.256-.148-.492-.276-.656-.347-.164-.072-.258-.087-.228-.01.019.051.093.143.236.286.472.472.675.95.728 1.395-2.01 1.202-2.093 2.276-2.871 3.552-.492.807-1.36 2.054-1.56 2.515-.412.948 1.024 2.052 1.706 1.407.893-.845.961-1.122 2.032-1.744.983-.016 1.975-.416 2.308-1.02 0 0 .938 2.083 1.938 3.583s2.5 3.125 2.5 3.125c-.131 1.227.12 2.176.549 2.922-.385.757-.924 1.807-1.417 2.745-.656 1.245-1.473 3.224-1.208 3.618.534.798 2.719 2.926 4.137 3.311 1.03.28 2.14.437 2.14.437l-.193-1.574s-1.343.213-1.875-.083c-1.427-.795-2.666-2.248-2.708-2.542-.07-.487 3.841-2.868 5.14-3.645 2.266.097 6.022-.369 8.626-1.702.958 1.86 2.978 2.513 2.978 2.513s.667 2.208 1.375 4.125c-1.017.533-4.468 3.254-4.975 3.854-.456.54-.856 2.49-.856 2.49.82.375 1.57.187 1.57.187s.039-1.562.385-2.073c.346-.511 4.701-2.559 5.958-3.458.492-.352.404-.903.262-1.552-.321-1.471-.97-4.781-.971-4.782 5.146-2.979 6.458-11.316-2.354-10.916z\"/><path fill=\"#292F33\" d=\"M22.336 33.782s-.616 1.993.008 2.138c.605.141 1.694-.388 1.755-.646.081-.343.216-1.179.098-1.366-.118-.187-1.861-.126-1.861-.126zm-7.676-5.296c-.167.146.164 1.859.164 1.859s2.064.299 2.111-.34c.045-.62-.647-1.614-.91-1.634-.351-.027-1.198-.031-1.365.115z\"/><circle fill=\"#292F33\" cx=\"4.25\" cy=\"8.047\" r=\".349\"/><path fill=\"#292F33\" d=\"M12.655 9.07c1.773 1.446 3.147.322 3.147.322-1.295-.271-2.056-.867-2.708-1.562.835-.131 1.287-.666 1.287-.666-1.061-.013-1.824-.3-2.485-.699-.565-.614-1.233-1.202-2.254-1.631-.294-.125-.606-.21-.922-.276-.086-.025-.178-.063-.258-.073-.906-.114-1.845.051-2.737.603-.322.2-.214.639.117.623 1.741-.085 2.866.582 3.47 1.633 2.169 3.772 5.344 3.875 5.344 3.875s-1.29-.688-2.001-2.149z\"/>","1f525":"<path fill=\"#F4900C\" d=\"M35 19c0-2.062-.367-4.039-1.04-5.868-.46 5.389-3.333 8.157-6.335 6.868-2.812-1.208-.917-5.917-.777-8.164.236-3.809-.012-8.169-6.931-11.794 2.875 5.5.333 8.917-2.333 9.125-2.958.231-5.667-2.542-4.667-7.042-3.238 2.386-3.332 6.402-2.333 9 1.042 2.708-.042 4.958-2.583 5.208-2.84.28-4.418-3.041-2.963-8.333C2.52 10.965 1 14.805 1 19c0 9.389 7.611 17 17 17s17-7.611 17-17z\"/><path fill=\"#FFCC4D\" d=\"M28.394 23.999c.148 3.084-2.561 4.293-4.019 3.709-2.106-.843-1.541-2.291-2.083-5.291s-2.625-5.083-5.708-6c2.25 6.333-1.247 8.667-3.08 9.084-1.872.426-3.753-.001-3.968-4.007C7.352 23.668 6 26.676 6 30c0 .368.023.73.055 1.09C9.125 34.124 13.342 36 18 36s8.875-1.876 11.945-4.91c.032-.36.055-.722.055-1.09 0-2.187-.584-4.236-1.606-6.001z\"/>","1f332":"<path fill=\"#662113\" d=\"M22 33c0 2.209-1.791 3-4 3s-4-.791-4-3l1-9c0-2.209.791-2 3-2s3-.209 3 2l1 9z\"/><path fill=\"#5C913B\" d=\"M31.406 27.297C24.443 21.332 21.623 12.791 18 12.791c-3.623 0-6.443 8.541-13.405 14.506-2.926 2.507-1.532 3.957 2.479 3.667 3.576-.258 6.919-1.069 10.926-1.069s7.352.812 10.926 1.069c4.012.29 5.405-1.16 2.48-3.667z\"/><path fill=\"#3E721D\" d=\"M29.145 24.934C23.794 20.027 20.787 13 18 13c-2.785 0-5.793 7.027-11.144 11.934-4.252 3.898 5.572 4.773 11.144 0 5.569 4.773 15.396 3.898 11.145 0z\"/><path fill=\"#5C913B\" d=\"M29.145 20.959C23.794 16.375 20.787 9.811 18 9.811c-2.785 0-5.793 6.564-11.144 11.148-4.252 3.642 5.572 4.459 11.144 0 5.569 4.459 15.396 3.642 11.145 0z\"/><path fill=\"#3E721D\" d=\"M26.7 17.703C22.523 14.125 20.176 9 18 9c-2.174 0-4.523 5.125-8.7 8.703-3.319 2.844 4.35 3.482 8.7 0 4.349 3.482 12.02 2.844 8.7 0z\"/><path fill=\"#5C913B\" d=\"M26.7 14.726c-4.177-3.579-6.524-8.703-8.7-8.703-2.174 0-4.523 5.125-8.7 8.703-3.319 2.844 4.35 3.481 8.7 0 4.349 3.481 12.02 2.843 8.7 0z\"/><path fill=\"#3E721D\" d=\"M25.021 12.081C21.65 9.193 19.756 5.057 18 5.057c-1.755 0-3.65 4.136-7.021 7.024-2.679 2.295 3.511 2.809 7.021 0 3.51 2.81 9.701 2.295 7.021 0z\"/><path fill=\"#5C913B\" d=\"M25.021 9.839C21.65 6.951 19.756 2.815 18 2.815c-1.755 0-3.65 4.136-7.021 7.024-2.679 2.295 3.511 2.809 7.021 0 3.51 2.81 9.701 2.295 7.021 0z\"/><path fill=\"#3E721D\" d=\"M23.343 6.54C20.778 4.342 19.336 1.195 18 1.195c-1.335 0-2.778 3.148-5.343 5.345-2.038 1.747 2.671 2.138 5.343 0 2.671 2.138 7.382 1.746 5.343 0z\"/><path fill=\"#5C913B\" d=\"M23.343 5.345C20.778 3.148 19.336 0 18 0c-1.335 0-2.778 3.148-5.343 5.345-2.038 1.747 2.671 2.138 5.343 0 2.671 2.138 7.382 1.746 5.343 0z\"/>","26e9":"<path fill=\"#DD2E44\" d=\"M9 9c0-1.104-.896-2-2-2s-2 .896-2 2v24c0 1.104.896 2 2 2s2-.896 2-2V9zm22 0c0-1.104-.896-2-2-2s-2 .896-2 2v24c0 1.104.896 2 2 2s2-.896 2-2V9z\"/><path fill=\"#DD2E44\" d=\"M36 16c0 1.104-.896 2-2 2H2c-1.104 0-2-.896-2-2s.896-2 2-2h32c1.104 0 2 .896 2 2zm-1-9c0 1.104-.781 1.719-2 2 0 0-3 1-15 1S3 9 3 9c-1.266-.266-2-.896-2-2s.896-2 2-2h30c1.104 0 2 .896 2 2z\"/><path fill=\"#292F33\" d=\"M35.906 4c0 1.104-.659 1.797-1.908 2 0 0-4 1-15.999 1C6.001 7 2.002 6 2.002 6 .831 5.812.109 5.114.109 4.01.109 2.905-.102 1 1.002 1c0 0 3.999 2 16.997 2s16.998-2 16.998-2c1.105 0 .909 1.895.909 3z\"/><path fill=\"#DD2E44\" d=\"M20 15c0 1.104-.896 2-2 2s-2-.896-2-2V9c0-1.104.896-2 2-2s2 .896 2 2v6z\"/><path fill=\"#292F33\" d=\"M11 34c0 1.104-.896 2-2 2H5c-1.104 0-2-.896-2-2s.896-2 2-2h4c1.104 0 2 .896 2 2zm22 0c0 1.104-.896 2-2 2h-4c-1.104 0-2-.896-2-2s.896-2 2-2h4c1.104 0 2 .896 2 2z\"/>","1faad":"<path fill=\"#e80040\" d=\"m18 28 17.08-10.2c.42-.25.52-.84.19-1.2C30.98 11.94 24.84 9.01 18 9.01S5.02 11.93.73 16.59c-.33.36-.24.95.19 1.2L18 27.99Z\"/><path fill=\"#a80018\" d=\"m18 25.79.03-.05.47-1.71V9.01c-.17 0-.33-.01-.5-.01s-.33 0-.5.01v15.02l.47 1.71zm-.81 1.26-.06.1.23.15-.03-.1zm2.99-2.79 8.25-12.81c-.3-.15-.6-.3-.91-.43l-7.68 11.93-.58 2.12.92-.81Z\"/><path fill=\"#a80018\" d=\"m18.01 25.81.02-.07-.03.05zm.76 1.01 14.15-12.45c-.26-.22-.53-.43-.8-.63L20.17 24.25l-.92.81-.48 1.75Zm-1.54.03-.12.11.08.09.14.15zm1.21.62.06.23.04-.02.1-.38-.13.08z\"/><path fill=\"#a80018\" d=\"m19.25 25.07.58-2.12 3.63-13.3c-.32-.08-.65-.15-.98-.21L18.5 24.03l-.47 1.71-.02.07.55.86.2.18v-.03zm-3.08-2.12L8.49 11.02c-.31.14-.61.28-.91.43l8.25 12.81.92.81-.58-2.12Z\"/><path fill=\"#a80018\" d=\"m17.97 25.74.14.53.46.4-.56-.86-.01-.02zm.54 1.64.13-.08.23-.15-.06-.1z\"/><path fill=\"#a80018\" d=\"m18.57 26.67-.46-.4.33 1.2.07-.09.3-.33.08-.09-.12-.11zm-1.82-1.6-.92-.81L3.87 13.75c-.27.2-.54.41-.8.63l14.15 12.45-.48-1.75Z\"/><path fill=\"#a80018\" d=\"m18.44 27.47-.33-1.19-.14-.53-.47-1.71-3.98-14.59c-.33.06-.66.13-.98.21l3.63 13.3.58 2.12.48 1.75v.03l.1.35.03.09.1.38.54.32.5-.3-.06-.23Z\"/><path fill=\"#de9a7e\" d=\"m18 28 6.59-3.94a8.628 8.628 0 0 0-13.18 0z\"/><path fill=\"#fff\" d=\"M12.19 23.95c1.53-1.56 3.62-2.45 5.81-2.45s4.28.88 5.81 2.45L18 27.42l-5.81-3.47Z\"/><path fill=\"#de9a7e\" d=\"m19.52 27.09 5.07-3.03a8.628 8.628 0 0 0-13.18 0l5.07 3.03-2.08 1.49a.38.38 0 0 0-.08.55c.93 1.15 2.24 1.87 3.69 1.87s2.75-.72 3.69-1.87c.14-.17.09-.42-.08-.55l-2.08-1.49Zm3.47-3.23-3.4 2.03c-.1-.15-.22-.28-.35-.4l1.83-2.84c.69.3 1.34.71 1.92 1.21Zm-4.61-1.84c.68.03 1.34.16 1.97.36l-1.76 2.73c-.07-.02-.14-.04-.22-.06v-3.03Zm-.75 0v3.03c-.07.02-.15.03-.22.06l-1.76-2.73c.63-.21 1.3-.33 1.97-.36Zm-4.61 1.84c.58-.5 1.23-.9 1.92-1.21l1.83 2.84c-.13.12-.25.25-.35.4l-3.4-2.03Z\"/><circle cx=\"18\" cy=\"27\" r=\"1\" fill=\"#a80018\"/>","1f303":"<path fill=\"#269\" d=\"M32 0H4C1.791 0 0 1.791 0 4v22h36V4c0-2.209-1.791-4-4-4z\"/><path fill=\"#3F484C\" d=\"M10 36V7l4-4h2l4 4v29zm23-25c0-1-1-1-1-1h-7s-1 0-1 1v25h9V11z\"/><path fill=\"#292F33\" d=\"M28 19c0-1-1-1-1-1h-8c-1 0-1 1-1 1v17h10V19zm-17 2H6v-7s0-1-1-1H0v19c0 2.209 1.791 4 4 4h8V22s0-1-1-1zm21 4c-1 0-1 1-1 1v10h1c2.209 0 4-1.791 4-4v-7h-4z\"/><path d=\"M8 31h2v2H8zm0-8h2v2H8zm-2 4h2v2H6zM16 9h2v2h-2zm0 4h2v2h-2zm-2 4h2v2h-2zm10 3h2v2h-2zm-2 4h2v2h-2zm-2 6h2v2h-2zm9-18h2v2h-2zm0 4h2v2h-2z\" fill=\"#FFCC4D\"/><g fill=\"#FFF\"><circle cx=\"10.5\" cy=\"2.5\" r=\".5\"/><circle cx=\"7.5\" cy=\"11.5\" r=\".5\"/><circle cx=\"22\" cy=\"5\" r=\"1\"/><circle cx=\"26.5\" cy=\"5.5\" r=\".5\"/><circle cx=\"31\" cy=\"3\" r=\"1\"/><circle cx=\"31.5\" cy=\"7.5\" r=\".5\"/><path d=\"M6.5 7C5.119 7 4 5.881 4 4.5c0-1.13.755-2.074 1.784-2.383C5.533 2.048 5.273 2 5 2 3.343 2 2 3.343 2 5s1.343 3 3 3c.959 0 1.803-.458 2.353-1.159C7.085 6.938 6.801 7 6.5 7z\"/></g>","1f42a":"<path fill=\"#C1694F\" d=\"M31.595 15.007c-1.75-3.623-5.934-9.053-9.531-9.053-4.071 0-8.228 7.259-10.071 10.378-.176.299-.321.578-.464.857-3.371-1.182-.536-6.631-.536-10.463 0-.957-.138-1.637-.44-2.119.489-.606.586-1.347.192-1.699-.413-.367-1.195-.163-1.745.456-.08.089-.129.186-.189.28-.424-.067-.903-.102-1.472-.102-.565 0-2.916.266-4.229.791C-.007 5.582.993 9 1.993 9h4c1 0 .756 2.31 0 4.726-.83 2.654-1.439 5.145-1 6.606.808 2.687 3.712 3.589 6.164 3.86 1.059 2.659 1.517 6.455 1.473 7.962-.059 2 1.94 2.059 1.999.059.036-1.211-.102-3.68.143-5.781.658 2.833.935 6.097.899 7.314-.059 1.998 1.94 2.057 1.999.059.047-1.602-.182-6.36.559-8.982.507.017 1.044.03 1.619.035 1.774.09 3.726.085 5.506-.015 1.05 1.592 1.996 2.991 1.982 3.435-.029 1-1.117 3.969-1.146 4.969-.029 1 .94 2.029 1.999.059.648-1.205 1.324-3.419 1.536-5.421.171.364.274.656.269.843-.029 1-.97 3.93-.999 4.93-.029.998.941 2.027 1.999.059 1.059-1.971 1.998-4.898 1.058-6.928-.797-1.72.431-4.165.824-7.914 1.082 1.665 1.117 3.351 1.118 3.459 0 .553.447 1 1 1 .553 0 1-.447 1-1-.001-.215-.067-4.85-4.399-7.327z\"/><path fill=\"#292F33\" d=\"M8.28 5.571c-.016.552-.477.986-1.029.97-.552-.016-.986-.477-.97-1.029.016-.552.477-.986 1.029-.97.552.016.986.477.97 1.029z\"/>","1f3dc":"<path fill=\"#FFAC33\" d=\"M20.417 22.732c-.21-.087-1.776-.732-2.709-.732-2 0-4.68-4-6.333-4-2.667 0-4.62 5.225-6.375 6.042-1.445.673-2.026 2.686-2.26 4.196-.157 1.016-.157 1.804-.157 1.804L20.417 30v-7.268z\"/><circle fill=\"#FFCC4D\" cx=\"8.25\" cy=\"7\" r=\"5\"/><circle fill=\"#FFAC33\" cx=\"8.25\" cy=\"7\" r=\"4\"/><path fill=\"#FFE8B6\" d=\"M18 25.18C3.438 25.18 0 29.844 0 32s1.791 4 4 4h28c2.209 0 4-1.851 4-4s-3.438-6.82-18-6.82z\"/><path fill=\"#F4900C\" d=\"M10.063 22.403c-.516 1.407.555 2.343.555 2.343s.058-.696.113-1.603c.056-.931.879-1.563.908-1.896.095-1.112-.854-1.931-.805-1.541.104.814-.357 1.568-.771 2.697zm-3.681 2.568c-.375.737-.321 2.496-.321 2.496s.9-.529.94-1.074c.04-.545.014-.834.138-1.15.352-.9 1.124-.842 1.595-2.088.167-.44-.194-1.203-.3-.954-.41.959-1.676 2.033-2.052 2.77zm6.045-.337c-.116-.322.124-2.378.328-2.1.204.278-.006 1.161.664 1.886.837.905.721 1.981.491 1.498-.231-.484-1.367-.962-1.483-1.284z\"/><path fill=\"#FFAC33\" d=\"M20.417 27.895v-2.592c-2.263-.383-11.524-1.598-17.676 2.936-.173.128-.184.403-.184.491 0 1.112 3.763-.342 8.31.178 2.185.25 4.613.427 5.258-.052.218-.162-.328-.727-1.352-1.236.513-.132 1.045-.25 1.654-.243 1.983.018 3.3.312 3.99.518z\"/><path fill=\"#77B255\" d=\"M16.535 12.174c1.398 0 2.5 1.135 2.5 2.535v5.782c0 .688 1 1.241 1 1.551V11.441c0-2.1 1.9-3.802 4-3.802s4 1.702 4 3.802v13.171c1-.301 1-.869 1-1.587v-3.247c0-1.4 1.101-2.535 2.5-2.535s2.5 1.135 2.5 2.535v4.435c0 1.399-.94 2.455-1.971 3.049-.787.455-3.029 1.014-4.029 1.047v3.024c0 2-8 2-8 0v-5.567c-1-.075-3.185-.604-3.937-1.038-1.03-.594-2.064-1.649-2.064-3.05v-6.97c.001-1.399 1.1-2.534 2.501-2.534z\"/><g fill=\"#3E721D\"><circle cx=\"32.5\" cy=\"26.748\" r=\".634\"/><circle cx=\"29.966\" cy=\"22.312\" r=\".634\"/><circle cx=\"34.401\" cy=\"21.045\" r=\".634\"/><circle cx=\"17.293\" cy=\"24.847\" r=\".634\"/><circle cx=\"15.392\" cy=\"19.778\" r=\".634\"/><circle cx=\"17.927\" cy=\"16.61\" r=\".634\"/><circle cx=\"14.125\" cy=\"14.709\" r=\".634\"/><circle cx=\"21.728\" cy=\"29.649\" r=\".634\"/><circle cx=\"27.43\" cy=\"26.114\" r=\".634\"/><circle cx=\"22.996\" cy=\"22.312\" r=\".634\"/><circle cx=\"26.798\" cy=\"19.778\" r=\".634\"/><circle cx=\"22.362\" cy=\"15.343\" r=\".634\"/><circle cx=\"28.064\" cy=\"13.442\" r=\".634\"/><circle cx=\"21.094\" cy=\"9.541\" r=\".634\"/></g><path fill=\"#F4900C\" d=\"M14.761 27.616s-1.128-.357-1.784-.451 2.588-.271 4.106.224c-1.518-.024-2.322.227-2.322.227z\"/>","1f682":"<path fill=\"#939598\" d=\"M0 34h36v2H0z\"/><path fill=\"#231F20\" d=\"M6 27h29v5H6z\"/><circle fill=\"#58595B\" cx=\"6.999\" cy=\"32\" r=\"3\"/><circle fill=\"#58595B\" cx=\"12.999\" cy=\"32\" r=\"3\"/><circle fill=\"#A0041E\" cx=\"6.999\" cy=\"32\" r=\"1.5\"/><circle fill=\"#A0041E\" cx=\"12.999\" cy=\"32\" r=\"1.5\"/><path fill=\"#DD2E44\" d=\"M5 33H1c-1 0-1.5-.5 0-2l4-4c1-1 2-2.001 2 0v4c0 2-.001 2-2 2z\"/><path fill=\"#231F20\" d=\"M8 20c0 3.313-1.343 6-3 6s-3-2.687-3-6c0-3.314 1.343-6 3-6s3 2.686 3 6z\"/><path fill=\"#6D6E71\" d=\"M11 15H7L5 7h8z\"/><path fill=\"#414042\" d=\"M26 25c0 1.104-.896 2-2 2H6c-1.104 0-2-.896-2-2V15c0-1.104.896-2 2-2h18c1.104 0 2 .896 2 2v10z\"/><path fill=\"#C1694F\" d=\"M13 26c0 .553-.448 1-1 1s-1-.447-1-1V13c0-.552.448-1 1-1s1 .448 1 1v13zm6 0c0 .553-.447 1-1 1-.553 0-1-.447-1-1V13c0-.552.447-1 1-1 .553 0 1 .448 1 1v13z\"/><path fill=\"#808285\" d=\"M36 26c0 .553-.447 1-1 1H7c-.552 0-1-.447-1-1 0-.553.448-1 1-1h28c.553 0 1 .447 1 1z\"/><circle fill=\"#58595B\" cx=\"29.999\" cy=\"31\" r=\"4\"/><circle fill=\"#58595B\" cx=\"21.999\" cy=\"31\" r=\"4\"/><circle fill=\"#A0041E\" cx=\"29.999\" cy=\"31\" r=\"2\"/><circle fill=\"#A0041E\" cx=\"21.999\" cy=\"31\" r=\"2\"/><path fill=\"#414042\" d=\"M12 3H6c-.552 0-1 .448-1 1v3h8V4c0-.552-.448-1-1-1z\"/><path fill=\"#BE1931\" d=\"M23 7h12v18H23z\"/><path fill=\"#A0041E\" d=\"M36 6c0 .552-.447 1-1 1H23c-.553 0-1-.448-1-1s.447-1 1-1h12c.553 0 1 .448 1 1z\"/><path fill=\"#EA596E\" d=\"M25 18h8v5h-8z\"/><path fill=\"#F4900C\" d=\"M30 32h-8c-.127 0-.253-.024-.371-.071L16.807 30H10c-.552 0-1-.447-1-1s.448-1 1-1h7c.128 0 .253.024.372.071L22.192 30H30c.553 0 1 .447 1 1s-.447 1-1 1z\"/><path fill=\"#55ACEE\" d=\"M33 10c0-.552-.447-1-1-1h-6c-.553 0-1 .448-1 1v5c0 .552.447 1 1 1h6c.553 0 1-.448 1-1v-5z\"/>","1f56f":"<path fill=\"#67757F\" d=\"M20 21.5c0 .828-.672 1.5-1.5 1.5-.829 0-1.5-.672-1.5-1.5v-3c0-.829.671-1.5 1.5-1.5.828 0 1.5.671 1.5 1.5v3z\"/><path fill=\"#E1E8ED\" d=\"M27.138 33.817C27.183 35.022 26.206 36 25 36H12.183C10.977 36 10 35.022 10 33.817V21c0-1.205.115-2.183 2.183-2.183S15 23 25 21c1.091 0 2.183.978 2.138 2.183v10.634z\"/><path fill=\"#FCAB40\" d=\"M18.687 18.538c-2.595 0-6.962-1.934-6.962-5.898 0-3.988 4.351-5.414 7.005-11.401.751-1.693.999-1.107 1.86-.076 2.06 2.463 5.058 7.483 5.058 11.574-.001 4.641-4.64 5.801-6.961 5.801z\"/><path fill=\"#FDCB58\" d=\"M18.687 17.447c-4.184 0-3.482-5.802 0-9.283 2.321 1.16 5.801 9.283 0 9.283z\"/><path fill=\"#CCD6DD\" d=\"M11 29c0 .553-.448 1-1 1s-1-.447-1-1v-7c0-.553.448-1 1-1s1 .447 1 1v7zm4 3c0 .553-.448 1-1 1s-1-.447-1-1v-7c0-.553.448-1 1-1s1 .447 1 1v7zm0-11c0 .553-.448 1-1 1s-1-.447-1-1v-1c0-.553.448-1 1-1s1 .447 1 1v1z\"/>","1f47d":"<path fill=\"#CCD6DD\" d=\"M35 17c0 9.389-13.223 19-17 19-3.778 0-17-9.611-17-19S8.611 0 18 0s17 7.611 17 17z\"/><path fill=\"#292F33\" d=\"M13.503 14.845c3.124 3.124 4.39 6.923 2.828 8.485-1.562 1.562-5.361.297-8.485-2.828-3.125-3.124-4.391-6.923-2.828-8.485s5.361-.296 8.485 2.828zm8.994 0c-3.124 3.124-4.39 6.923-2.828 8.485 1.562 1.562 5.361.297 8.485-2.828 3.125-3.125 4.391-6.923 2.828-8.485-1.562-1.562-5.361-.297-8.485 2.828zM18 31c-2.347 0-3.575-1.16-3.707-1.293-.391-.391-.391-1.023 0-1.414.387-.387 1.013-.391 1.404-.01.051.047.806.717 2.303.717 1.519 0 2.273-.689 2.305-.719.398-.374 1.027-.363 1.408.029.379.393.38 1.011-.006 1.396C21.575 29.84 20.347 31 18 31z\"/>","1f9a2":"<path fill=\"#E1E8ED\" d=\"M3.427 7.034c-1.049-1.086-1.535-2.903.2-5.106s9.144-2.87 8.61 4.939c-.067 1.835-.768 4.605-2.603 8.376-.467.968-1.268 2.536-1.602 4.839.968-.801 3.904-2.236 6.908-1.835 3.003.4 18.054 7.142 21.057 4.305.1 1.168-3.637 12.781-18.555 12.781S.122 27.824.122 24.421s.868-5.173 3.371-7.542S9.835 8.87 8.099 6.367c-.367.667-2.769 2.636-4.672.667z\"/><path fill=\"#CCD6DD\" d=\"M10.202 26.557c-.567 2.136 2.967 6.589 8.71 6.608 8.385.028 12.881-4.705 15.384-10.746-2.436-1.068-13.826-3.254-17.129-1.919s-3.667 1.583-7.298 3.52c1.167.201.3 2.537.333 2.537z\"/><path fill=\"#292F33\" d=\"M5.475 7.377c.098-.085.155-.187.155-.309 0-.968.067-2.503.4-2.903.785.083 1.118-.735.618-1.269s-1.418.067-1.352.634c-1.414-.377-2.442-.142-2.784.912-.104 1.066.302 1.957.915 2.592.295.305 1.776.427 2.048.343z\"/><path fill=\"#CCD6DD\" d=\"M7.719 4.762c-.004.986-.74 2.149-2.244 2.614-.159.136-.429.223-.751.268.131.088.268.165.411.23 1.41.096 2.704-1.032 2.965-1.507.006.008.008.018.013.026.03-.89-.394-1.631-.394-1.631z\"/><path fill=\"#E1E8ED\" d=\"M9.301 24.087c.033-1.468 1.368-7.375 9.077-7.542 7.709-.167 8.31 4.672 14.416-.467-.1 1.301-2.269 15.017-13.849 15.017-9.21 0-9.678-5.54-9.644-7.008z\"/><path fill=\"#F4900C\" d=\"M.754 10.571c.85-.264 3.775-1.968 4.843-3.17.3-.334-1.495-2.405-3.164-2.639.1.534.06 2.572-1.575 4.374-.434.334-1.026 1.602-.104 1.435z\"/>","1f634":"<circle fill=\"#77bf57\" cx=\"18\" cy=\"18\" r=\"18\"/><circle fill=\"#664500\" cx=\"18\" cy=\"26\" r=\"3\"/><path fill=\"#664500\" d=\"M17.312 16.612c-.176-.143-.427-.147-.61-.014-.012.009-1.26.902-3.702.902-2.441 0-3.69-.893-3.7-.9-.183-.137-.435-.133-.611.009-.178.142-.238.386-.146.594.06.135 1.5 3.297 4.457 3.297 2.958 0 4.397-3.162 4.457-3.297.092-.207.032-.449-.145-.591zm10 0c-.176-.143-.426-.148-.61-.014-.012.009-1.261.902-3.702.902-2.44 0-3.69-.893-3.7-.9-.183-.137-.434-.133-.611.009-.178.142-.238.386-.146.594.06.135 1.5 3.297 4.457 3.297 2.958 0 4.397-3.162 4.457-3.297.092-.207.032-.449-.145-.591z\"/><path fill=\"#6ab948\" d=\"M34.43 12.534c.004-.044.023-.077.023-.123 0-.754-.548-1.188-1.225-1.188h-3.582l4.279-5.993c.206-.283.282-.453.282-.811 0-.735-.64-.849-.885-.849h-5.349l-.032-.688s-1.409.831-1.503.888-.505.372-.505.987c0 .754.546 1.187 1.225 1.187h3.149l-4.261 5.993c-.094.151-.244.433-.244.735 0 .622.508.924 1.111.924h6.315c.258 0 .515-.076.681-.176l1.503-.888h-.982z\"/><path fill=\"#2A6797\" d=\"M31.771 5.084h-3.149c-.679 0-1.225-.433-1.225-1.187s.546-1.188 1.225-1.188h6.164c.245 0 .885.113.885.848 0 .358-.076.528-.282.811l-4.279 5.993h3.582c.677 0 1.225.433 1.225 1.187s-.548 1.187-1.225 1.187h-6.315c-.603 0-1.111-.302-1.111-.924 0-.302.15-.584.244-.735l4.261-5.992z\"/><path fill=\"#6ab948\" d=\"M24.886 7.48c.003-.033.018-.058.018-.092 0-.564-.41-.889-.917-.889h-2.682l3.203-4.487c.156-.212.212-.339.212-.606 0-.55-.479-.635-.663-.635h-4.004l-.024-.515s-1.055.622-1.125.665c-.07.043-.378.279-.378.739 0 .564.409.889.917.889H21.8l-3.19 4.487c-.07.113-.183.324-.183.55 0 .466.38.691.832.691h4.728c.193 0 .385-.057.51-.132l1.125-.665h-.736z\"/><path fill=\"#2A6797\" d=\"M22.896 1.903h-2.357c-.508 0-.917-.324-.917-.889 0-.564.409-.889.917-.889h4.615c.184 0 .663.085.663.635 0 .268-.057.395-.211.607l-3.203 4.487h2.682c.505 0 .915.324.915.889s-.41.889-.917.889h-4.728c-.452 0-.832-.226-.832-.691 0-.226.113-.437.183-.55l3.19-4.488z\"/><path fill=\"#6ab948\" d=\"M17.741 10.425c.003-.028.015-.049.015-.079 0-.483-.351-.761-.785-.761h-2.295l2.742-3.84c.132-.181.181-.29.181-.519 0-.471-.41-.544-.567-.544h-3.427l-.021-.441-.963.569c-.06.037-.324.238-.324.633 0 .483.35.761.785.761h2.017l-2.73 3.84c-.06.097-.157.278-.157.471 0 .399.326.592.712.592h4.047c.165 0 .33-.049.436-.113l.963-.569h-.629z\"/><path fill=\"#2A6797\" d=\"M16.037 5.652H14.02c-.435 0-.785-.278-.785-.761s.35-.761.785-.761h3.95c.157 0 .567.073.567.544 0 .229-.048.338-.181.519l-2.742 3.84h2.295c.434 0 .785.278.785.761s-.351.761-.785.761h-4.047c-.386 0-.712-.193-.712-.592 0-.193.096-.374.157-.471l2.73-3.84z\"/>","1f4cb":"<path fill=\"#C1694F\" d=\"M32 34c0 1.104-.896 2-2 2H6c-1.104 0-2-.896-2-2V7c0-1.104.896-2 2-2h24c1.104 0 2 .896 2 2v27z\"/><path fill=\"#FFF\" d=\"M29 32c0 .553-.447 1-1 1H8c-.552 0-1-.447-1-1V9c0-.552.448-1 1-1h20c.553 0 1 .448 1 1v23z\"/><path fill=\"#CCD6DD\" d=\"M25 3h-4c0-1.657-1.343-3-3-3s-3 1.343-3 3h-4c-1.104 0-2 .896-2 2v5h18V5c0-1.104-.896-2-2-2z\"/><circle fill=\"#292F33\" cx=\"18\" cy=\"3\" r=\"2\"/><path fill=\"#99AAB5\" d=\"M20 14c0 .552-.447 1-1 1h-9c-.552 0-1-.448-1-1s.448-1 1-1h9c.553 0 1 .448 1 1zm7 4c0 .552-.447 1-1 1H10c-.552 0-1-.448-1-1s.448-1 1-1h16c.553 0 1 .448 1 1zm0 4c0 .553-.447 1-1 1H10c-.552 0-1-.447-1-1 0-.553.448-1 1-1h16c.553 0 1 .447 1 1zm0 4c0 .553-.447 1-1 1H10c-.552 0-1-.447-1-1 0-.553.448-1 1-1h16c.553 0 1 .447 1 1zm0 4c0 .553-.447 1-1 1h-9c-.552 0-1-.447-1-1 0-.553.448-1 1-1h9c.553 0 1 .447 1 1z\"/>","1f97e":"<path fill=\"#C1694F\" d=\"M34.469 28.156c-.59-.885-2.458-2.365-4.5-2.656-2.112-.302-3.877.18-6.571-1.394-.086-.066-.171-.131-.273-.19-2.153-1.247-5.917-5.417-6-9.542-.047-2.336-3-2.625-5.375-2.333-2.375.292-10.083 2.083-9.792 3.25.248.991.224 5.316-.018 8.205-.366 2.27-.636 5.435-.636 7.44C1.303 31.599 2.333 32 2.333 32l14.198.5 17.688-.477s.933-.084.906-.711c-.042-.958-.156-2.406-.656-3.156z\"/><path fill=\"#662113\" d=\"M23.208 32.458c.75-1.333 2.375-2.417 4.75-2.583s5.792-2.531 5.792-2.531.969 0 1.531 2.031c.463 1.67-.406 2.094-.406 2.094s-3.542 1.99-5.875 1.615-5.792-.626-5.792-.626zM1.906 24.156s-1.125 3.656-.86 5.661c.181 1.369.573 2.351 1.376 2.58.803.229 9.5.066 9.328.009-.172-.057-1.097-4.124-4.594-5.156-3.497-1.032-5.25-3.094-5.25-3.094z\"/><path fill=\"#292F33\" d=\"M1.906 35.562c-.55 0-1.031-.438-1.156-1.938l-.031-.562c.156-2 .638.625 1.188.625.55 0 1 .45 1 1-.001.55-.451.875-1.001.875zm3.032.25c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zM8 36c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm3.062-.156c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.449 1-1 1zM20 36c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm3 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2.938-.125c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.451 1-1 1zm3.031-.187c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1c0 .549-.45 1-1 1zm3-.188c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2.962-.481h-.281c-.55 0-1-.606-1-1.156 0-.55.45-1 1-1s1.219-.675 1.219-.125l-.063 1.062c0 .55-.325 1.219-.875 1.219z\"/><path fill=\"#662113\" d=\"M2.167 16.042c-.713.366-.75-1.25-.083-2s6.25-1.75 7.625-2 4.042-.75 4.875-.083c.833.667 1 2.833.958 3.625-.042.791-3.084-.417-5.542-.667-2.323-.237-6.208.291-7.833 1.125z\"/><circle fill=\"#292F33\" cx=\"14.604\" cy=\"18.583\" r=\"1.5\"/><circle fill=\"#292F33\" cx=\"15.948\" cy=\"21.781\" r=\"1.5\"/><circle fill=\"#292F33\" cx=\"18.292\" cy=\"24.458\" r=\"1.5\"/><circle fill=\"#292F33\" cx=\"21.562\" cy=\"25.938\" r=\"1.5\"/><circle fill=\"#292F33\" cx=\"25\" cy=\"26.823\" r=\"1.5\"/><path fill=\"#BE1931\" d=\"M14.5 19.425c-.362 0-.69-.247-.777-.614-.103-.43.162-.861.592-.964l3.833-.917c.428-.105.861.162.964.592.103.43-.162.861-.592.964l-3.833.917c-.063.015-.126.022-.187.022zm1.5 3.187c-.288 0-.566-.155-.709-.429-.205-.392-.054-.875.337-1.08l3.542-1.854c.392-.203.874-.054 1.08.338.205.392.054.875-.338 1.08l-3.542 1.854c-.118.062-.245.091-.37.091zm2.25 2.688c-.225 0-.449-.095-.607-.278-.288-.335-.25-.84.085-1.128l2.958-2.542c.336-.288.84-.249 1.128.085.288.335.25.84-.085 1.128l-2.958 2.542c-.15.129-.336.193-.521.193zm3.332 1.5c-.125 0-.252-.029-.37-.091-.392-.205-.543-.688-.338-1.08l1.417-2.708c.205-.391.69-.541 1.08-.338.392.205.543.688.338 1.08l-1.417 2.708c-.143.273-.422.429-.71.429zm3.45.906c-.037 0-.074-.002-.112-.008-.438-.062-.742-.466-.681-.903l.386-2.739c.061-.438.462-.75.903-.681.438.062.742.466.681.903l-.386 2.739c-.055.401-.398.689-.791.689z\"/><path fill=\"#292F33\" d=\"M1.334 31.216c.787.175 2.201.662 4.591.7 2.755.044 5.187-.525 8.308-.525 2.991 0 6.9.848 10.319.7 3.487-.152 7.35-.652 8.192-.799 1.667-.292 2.438-.479 2.438-.479s.365-.021.531.688c.167.708.304 2.083-.841 2.427-2.186.656-7.554 1.113-12.724 1.049-2.626-.032-5.549-.81-6.966-.976-1.417-.167-2.667-.287-3.062 0-.396.287.089.792-.946.933-2.58.35-8.614.044-9.928-.516-.672-.286-1.051-3.455.088-3.202zm12.102-10.613c-.219 0-.421-.146-.482-.368l-.61-2.224c-.073-.266.084-.542.35-.615.264-.073.541.083.615.35l.61 2.225c.073.266-.084.541-.35.614-.045.012-.09.018-.133.018zm1.505 3.28c-.201 0-.39-.122-.467-.32l-.827-2.153c-.099-.258.03-.548.288-.646.257-.1.547.03.646.287l.827 2.153c.099.258-.03.548-.288.646-.059.022-.12.033-.179.033zm2.992 2.861c-.127 0-.254-.048-.352-.145l-1.639-1.622c-.196-.194-.198-.511-.004-.707s.511-.198.707-.004l1.639 1.622c.196.194.198.511.004.707-.098.099-.226.149-.355.149zm3.998 1.563c-.077 0-.155-.018-.228-.055l-2.053-1.051c-.246-.126-.344-.428-.218-.673.127-.246.431-.343.673-.218l2.053 1.051c.246.126.344.428.218.673-.089.173-.264.273-.445.273zm3.993.755c-.032 0-.065-.003-.098-.01l-2.263-.448c-.271-.054-.447-.316-.394-.587.054-.271.32-.45.587-.394l2.263.448c.271.054.447.316.394.587-.047.239-.256.404-.489.404z\"/>","1f3f4-200d-2620-fe0f":"<path fill=\"#31373D\" d=\"M32 5H4C1.791 5 0 6.791 0 9v18c0 2.209 1.791 4 4 4h28c2.209 0 4-1.791 4-4V9c0-2.209-1.791-4-4-4z\"/><circle fill=\"#31373D\" cx=\"15.5\" cy=\"12.5\" r=\"1.5\"/><circle fill=\"#31373D\" cx=\"20.5\" cy=\"12.5\" r=\"1.5\"/><ellipse fill=\"#292F33\" cx=\"18\" cy=\"15.5\" rx=\"1\" ry=\".5\"/><path fill=\"#E6E7E8\" d=\"M29.021 24.883c-.52-.189-1.093.078-1.282.598L20.923 23l6.816-2.48c.189.52.762.786 1.281.598.52-.19.787-.762.598-1.281-.188-.519-.762-.787-1.281-.599.519-.189.787-.762.598-1.281-.19-.52-.762-.787-1.281-.598-.519.188-.787.763-.598 1.282L18 21.937l-9.056-3.296c.189-.52-.078-1.094-.598-1.282-.52-.19-1.092.078-1.281.598-.189.519.078 1.093.598 1.281-.52-.189-1.093.079-1.281.599-.189.52.078 1.092.598 1.281.52.188 1.092-.078 1.281-.598L15.077 23l-6.815 2.48c-.189-.52-.763-.787-1.282-.598-.519.189-.786.762-.598 1.281.189.519.763.787 1.282.598-.52.19-.787.763-.598 1.282.188.52.763.786 1.281.598.519-.189.787-.763.598-1.282L18 24.065l9.055 3.295c-.19.52.079 1.093.598 1.282.519.188 1.093-.078 1.281-.598.189-.519-.078-1.093-.598-1.282.52.19 1.093-.078 1.282-.598.189-.519-.079-1.093-.597-1.281z\"/><path fill=\"#E6E7E8\" d=\"M18 7c-4 0-6 3.239-6 6 0 1.394.827 2.399 2 3.054V18c0 .553.448 1 1 1s1-.447 1-1v-1.216c.33.072.665.127 1 .162V18c0 .553.448 1 1 1s1-.447 1-1v-1.054c.335-.036.67-.09 1-.162V18c0 .553.447 1 1 1s1-.447 1-1v-1.946c1.173-.654 2-1.659 2-3.054 0-2.761-2-6-6-6zm-2.5 7c-.829 0-1.5 0-1.5-1.5 0-.829.671-1.5 1.5-1.5 1.5 0 1.5.671 1.5 1.5s-.671 1.5-1.5 1.5zm2.5 2c-.552 0-1-.224-1-.5s.448-.5 1-.5 1 .224 1 .5-.448.5-1 .5zm2.5-2c-.828 0-1.5-.671-1.5-1.5s0-1.5 1.5-1.5c.828 0 1.5.671 1.5 1.5 0 1.5-.672 1.5-1.5 1.5z\"/>","1fa94":"<path fill=\"#BE1931\" d=\"M33.139 21.464c.719.341.364 1.157 0 1.865-1.755 3.412-11.661 12.123-19.776 12.123C6.259 35.452.5 29.806.5 23.329c0-6.477 7.91-3.098 13.056-6.528 1.715 0 1.865-3.73 19.583 4.663z\"/><path fill=\"#7F031E\" d=\"M31.274 21.464c3.129 2.014-11.033 7.027-18.138 7.027C6.032 28.491.5 25.982.5 22.352c0-3.63 5.759-6.573 12.863-6.573 7.105 0 12.316 2.085 17.911 5.685z\"/><path fill=\"#FFAC33\" d=\"M29.409 22.396c2.655 1.8-8.492 6.201-16.046 6.201-7.03 0-11.35-2.432-11.35-5.432 0-3 5.082-5.432 11.35-5.432s12.316 2.134 16.046 4.663z\"/><path d=\"M24.745 24.262c-.418 0-.798-.282-.904-.706-.124-.499.178-1.005.679-1.131 3.698-.925 5.061-1.766 5.849-4.917.125-.5.632-.803 1.131-.679.499.125.803.631.679 1.131-1.107 4.428-3.685 5.393-7.207 6.274-.076.019-.152.028-.227.028z\"/><path fill=\"#F4900C\" d=\"M26.75 12.119c0 4.296 2.496 5.833 4.375 5.833s4.375-1.538 4.375-5.833c0-4.296-1.944-8.651-4.375-11.567-2.431 2.916-4.375 7.271-4.375 11.567z\"/><ellipse fill=\"#FFCC4D\" cx=\"31.125\" cy=\"13.577\" rx=\"2.431\" ry=\"4.375\"/><ellipse fill=\"#FFCC4D\" cx=\"12.167\" cy=\"22.813\" rx=\"6.806\" ry=\"2.917\"/>","1f37e":"<circle fill=\"#CCD6DD\" cx=\"7.189\" cy=\"27.5\" r=\"1.5\"/><path fill=\"#CCD6DD\" d=\"M9.609 13.234c.051-.237.08-.482.08-.734 0-1.933-1.567-3.5-3.5-3.5-1.764 0-3.208 1.308-3.45 3.005-.017 0-.033-.005-.05-.005-1.104 0-2 .896-2 2s.896 2 2 2c.033 0 .063-.008.095-.01-.058.16-.095.33-.095.51 0 .46.212.867.539 1.143-.332.357-.539.831-.539 1.357 0 1.104.896 2 2 2 0 .375.11.721.289 1.021-.727.103-1.289.723-1.289 1.479 0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5c0-.18-.037-.35-.095-.51.032.002.062.01.095.01 1.104 0 2-.896 2-2 0-.601-.27-1.133-.69-1.5.419-.367.69-.899.69-1.5 0-.378-.111-.728-.294-1.03.097.015.193.03.294.03 1.104 0 2-.896 2-2 0-.771-.441-1.432-1.08-1.766z\"/><circle fill=\"#E4EBEF\" cx=\"5.689\" cy=\"19\" r=\"1\"/><path fill=\"#E4EBEF\" d=\"M8.689 13c0-1.105-.895-2-2-2s-2 .895-2 2c0 .032.008.063.01.095-.16-.058-.33-.095-.51-.095-.829 0-1.5.671-1.5 1.5s.671 1.5 1.5 1.5c.198 0 .385-.04.558-.11.172.638.749 1.11 1.442 1.11.829 0 1.5-.671 1.5-1.5 0-.248-.066-.478-.172-.684.69-.315 1.172-1.007 1.172-1.816z\"/><path fill=\"#C1694F\" d=\"M7.301 3.076s-.817-.798-.873-.842c.233-.618.164-1.269-.25-1.692-.627-.616-1.758-.488-2.536.29L1.521 2.953c-.777.777-.906 1.909-.29 2.536.423.413 1.073.483 1.692.25.045.055.842.873.842.873.781.78 2.047.78 2.828 0l.707-.708c.781-.781.781-2.047.001-2.828z\"/><path fill=\"#A95233\" d=\"M6.727 3.985c.096-.096.395-.412.703-.75-.043-.053-.08-.109-.13-.159 0 0-.817-.798-.873-.842-.112.298-.289.59-.542.842L3.766 5.197c-.253.253-.545.43-.843.542.045.055.842.873.842.873.049.049.106.086.159.13.291-.261.584-.537.682-.634l2.121-2.123z\"/><path fill=\"#264612\" d=\"M34.9 23.787l-5.067-5.067c-3.664-3.664-7.322-4.14-14.358-6.945l-3.149 3.149c3.231 6.61 3.236 10.739 6.9 14.403l5.068 5.068c.993.993 1.787 1.81 2.782.816l8.409-8.412c.996-.996.408-2.019-.585-3.012z\"/><path fill=\"#FFE8B6\" d=\"M16.205 12.164s1.739.644-.56 2.943c-2.122 2.122-2.917.651-2.917.651l-3.447-3.447 3.536-3.536 3.388 3.389z\"/><path fill=\"#FFD983\" d=\"M13.124 9.083L12.11 8.068l-3.536 3.535 1.014 1.015c.994.993.819 1.055 2.644-.77l.592-.593c1.442-1.443 1.293-1.179.3-2.172z\"/><path fill=\"#264612\" d=\"M12.463 7.007c.586.586.586 1.536-.001 2.122l-2.827 2.827c-.586.587-1.536.587-2.122 0-.586-.585-.586-1.536 0-2.122l2.827-2.827c.587-.585 1.537-.586 2.123 0z\"/><path fill=\"#FFE8B6\" d=\"M28.373 20.089c-.781-.78-2.048-.78-2.829 0l-4.949 4.95c-.781.78-.781 2.047 0 2.828l4.242 4.242c.781.781 2.048.781 2.829 0l4.949-4.949c.781-.781.781-2.048 0-2.828l-4.242-4.243z\"/>","1f987":"<path fill=\"#66757F\" d=\"M23 21c0 6.352-3 10-5 10s-5-3.648-5-10 2.239-7 5-7c2.762 0 5 .648 5 7z\"/><circle fill=\"#66757F\" cx=\"18\" cy=\"11\" r=\"4\"/><path fill=\"#66757F\" d=\"M14 11c-2-5 1-7 1-7s2 1 2 4-3 3-3 3z\"/><path fill=\"#546066\" d=\"M14.668 9.904c-.776-2.457-.119-3.896.403-4.58C15.486 5.773 16 6.608 16 8c0 1.268-.739 1.734-1.332 1.904z\"/><path fill=\"#66757F\" d=\"M22 11c2-5-1-7-1-7s-2 1-2 4 3 3 3 3zm-5.984 3c-1.62 1.157-10 2-9-5 .142-.99-1-1-2 0-3 3-6 7.834-4 20 3-5 6-4 7 1 3-4 6-2 8 0 3-3 0-16 0-16zm3.937 0c1.62 1.157 10 2 9-5-.142-.99 1-1 2 0 3 3 6 7.834 4 20-3-5-6-4-7 1-3-4-6-2-8 0-3-3 0-16 0-16z\"/><circle fill=\"#292F33\" cx=\"16\" cy=\"11\" r=\"1\"/><circle fill=\"#292F33\" cx=\"20\" cy=\"11\" r=\"1\"/><path fill=\"#546066\" d=\"M21.332 9.904c.775-2.457.118-3.896-.403-4.58C20.514 5.773 20 6.608 20 8c0 1.268.739 1.734 1.332 1.904z\"/><path fill=\"#99AAB5\" d=\"M7.996 26.91c.892-2.691.573-5.988-.996-9.91-1.487-3.719-1.315-6.329-1.129-7.423-.049.041-.096.078-.148.13C3.017 12.414.477 16.531 1.66 26.436c1.276-1.379 2.412-1.723 3.228-1.723 1.265 0 2.333.783 3.108 2.197z\"/><path fill=\"#99AAB5\" d=\"M6.832 13.25c-.019-.03-.041-.058-.06-.087C7 16 8.4 17.001 9 20c.588 2.94.476 5.519.088 7.564.839-.571 1.726-.874 2.656-.874 1.264 0 2.548.538 3.895 1.627C14 19 9 17 6.832 13.25zm21.172 13.66c-.893-2.691-.572-5.988.996-9.91 1.487-3.719 1.315-6.329 1.129-7.423.049.041.097.078.148.13 2.706 2.707 5.246 6.824 4.063 16.729-1.275-1.379-2.412-1.723-3.227-1.723-1.266 0-2.334.783-3.109 2.197z\"/><path fill=\"#99AAB5\" d=\"M29.168 13.25l.061-.087C29 16 27.6 17.001 27 20c-.588 2.94-.477 5.519-.088 7.564-.84-.571-1.726-.874-2.656-.874-1.264 0-2.548.538-3.895 1.627C22 19 27 17 29.168 13.25zm-10.48-.144c-.378.378-.998.378-1.375 0l-.57-.571c-.378-.378-.25-.688.285-.688h1.945c.535 0 .664.309.285.688l-.57.571z\"/>","1f3df":"<path fill=\"#CCD6DC\" d=\"M35.858 17.376L.079 17.053v11.821c.011 1.084 1.009 2.12 2.52 3.028l2.396 1.133c.732.278 1.531.534 2.393.766l3.585.762c.791.127 1.615.232 2.46.32l9.328.088c.868-.075 1.714-.167 2.524-.285l3.57-.707c.857-.219 1.652-.463 2.378-.73l2.374-1.098c1.507-.893 2.262-1.923 2.251-3.013V17.376z\"/><path fill=\"#66757F\" d=\"M22.885 30.848c-.043-4.36-2.19-5.47-4.825-5.493-2.634-.024-4.759 1.047-4.716 5.407.016 1.606.046 2.96.089 4.12 1.504.156 3.079.254 4.712.269 1.6.014 3.141-.054 4.616-.18.097-1.003.142-2.341.124-4.123zM10.917 28.89l.001.107.003.364.003.271.001.065c.001.052 0 .044 0 0l-.001-.065-.003-.271-.003-.364-.001-.107-.001-.122c-.022-2.18-3.61-3.303-3.589-1.122v.037l.002.204.002.158.005.47.001.067.051 5.218c1.106.297 2.302.556 3.585.762l-.056-5.753v.081zm17.878-.992l.005.506v.027l.003.27c.001.118.001.15 0 0l-.003-.27v-.027l-.005-.506-.001-.058c-.022-2.18-3.589-1.123-3.567 1.057v.036l.057 5.753c1.279-.186 2.47-.426 3.57-.707l-.06-6.1.001.019zM4.931 26.534c-.022-2.18-2.417-3.292-2.396-1.112v.041l.063 6.439c.676.406 1.483.785 2.396 1.133l-.052-5.321c.003.208.006.582-.011-1.18zm26.237.237l.012 1.137v-.047.047l.053 5.34c.906-.334 1.705-.701 2.374-1.098l-.064-6.448c-.021-2.18-2.396-1.111-2.375 1.069zM2.972 5.225c-.276 0-.5.224-.5.5v12.37c0 .276.224.5.5.5s.5-.224.5-.5V5.725c0-.277-.223-.5-.5-.5z\"/><path fill=\"#DD2F45\" d=\"M3.207 5.936c1.478.269 3.682 1.102 4.246 1.424.564.322.215.484-.322.725-.538.242-3.441 1.021-3.87 1.102-.431.082-.054-3.251-.054-3.251z\"/><path fill=\"#66757F\" d=\"M11.969 2.976c-.276 0-.5.224-.5.5v12.37c0 .276.224.5.5.5s.5-.224.5-.5V3.476c0-.277-.224-.5-.5-.5z\"/><path fill=\"#226798\" d=\"M12.203 3.687c1.478.269 3.682 1.102 4.247 1.425.564.322.215.484-.322.725-.538.242-3.44 1.021-3.87 1.102-.432.081-.055-3.252-.055-3.252z\"/><path fill=\"#66757F\" d=\"M21.339 2.976c-.276 0-.5.224-.5.5v12.37c0 .276.224.5.5.5s.5-.224.5-.5V3.476c0-.277-.224-.5-.5-.5z\"/><path fill=\"#DD2F45\" d=\"M21.574 3.687c1.478.269 3.681 1.102 4.246 1.425.564.322.215.484-.322.725-.537.242-3.44 1.021-3.871 1.102-.431.081-.053-3.252-.053-3.252z\"/><path fill=\"#66757F\" d=\"M30.335 5.225c-.276 0-.5.224-.5.5v12.37c0 .276.224.5.5.5s.5-.224.5-.5V5.725c0-.277-.224-.5-.5-.5z\"/><path fill=\"#226798\" d=\"M30.57 5.936c1.478.269 3.681 1.102 4.246 1.425.564.322.215.484-.322.725-.537.242-3.44 1.021-3.871 1.102-.43.081-.053-3.252-.053-3.252z\"/><path fill=\"#E9EFF3\" d=\"M35.858 17.444c.033 3.312-7.949 5.924-17.829 5.835C8.148 23.19.112 20.431.08 17.121c-.033-3.312 7.95-5.924 17.83-5.835 9.879.09 17.915 2.847 17.948 6.158z\"/><path fill=\"#7450A0\" d=\"M33.257 18.209c.029 2.995-6.788 5.361-15.226 5.286-8.44-.077-15.305-2.567-15.334-5.562-.029-2.994 6.787-5.36 15.227-5.284 8.437.077 15.304 2.566 15.333 5.56z\"/><path fill=\"#E9EFF3\" d=\"M26.766 19.378l5.83-3.939-1.8-1.106s-3.63 3.394-4.822 4.548c-.876-.455-2.073-.837-3.486-1.104l2.439-5.303-2.463-.294-1.094 5.419c-1.059-.145-2.202-.233-3.401-.244-.928-.008-1.823.031-2.671.106l-1.183-5.357-2.457.251 2.491 5.235c-1.64.226-3.037.604-4.036 1.085-1.271-1.227-4.847-4.573-4.847-4.573l-1.778 1.074 5.814 3.98c-.541.397-.847.84-.843 1.311.018 1.766 4.303 3.237 9.573 3.285 5.268.048 9.527-1.346 9.51-3.113-.004-.445-.281-.872-.776-1.261z\"/><path fill=\"#5C903F\" d=\"M26.427 20.862c.013 1.321-3.732 2.357-8.363 2.315-4.631-.042-8.396-1.146-8.409-2.467-.013-1.32 3.731-2.356 8.362-2.314 4.63.041 8.396 1.146 8.41 2.466z\"/>","1f488":"<circle fill=\"#CCD6DD\" cx=\"18\" cy=\"6\" r=\"6\"/><path fill=\"#FFF\" d=\"M11 12h14v21H11z\"/><path fill=\"#DD2E44\" d=\"M11 28.487L20.251 33H25v-2.134l-14-6.83z\"/><path fill=\"#55ACEE\" d=\"M11 19.585l14 6.83v-4.45l-14-6.831z\"/><path fill=\"#DD2E44\" d=\"M13.697 12L25 17.514V12z\"/><path fill=\"#99AAB5\" d=\"M27 11c0 1.104-.896 2-2 2H11c-1.104 0-2-.896-2-2s.896-2 2-2h14c1.104 0 2 .896 2 2zm0 23c0 1.104-.896 2-2 2H11c-1.104 0-2-.896-2-2s.896-2 2-2h14c1.104 0 2 .896 2 2z\"/>","1fae0":"<path fill=\"#FFCC4D\" d=\"M35.07 32.558a1.92 1.92 0 0 0 .836-2.241c-.259-.81-1.07-1.317-1.921-1.317H32a1 1 0 0 1 0-2h1.5a1.5 1.5 0 1 0-.04-3c-.8.021-1.46-.623-1.46-1.423v-.003c0-.293.06-.578.176-.847a15.294 15.294 0 0 0 1.294-7.191C32.978 6.66 26.411.269 18.524.009 9.724-.281 2.5 6.766 2.5 15.5c0 2.371.548 4.609 1.5 6.619v1.88c0 1.086-.865 2.021-1.951 2a2 2 0 0 0-2.034 2.167C.101 29.225 1.069 30 2.133 30h8.039A1.17 1.17 0 0 1 11 32l-3.03.757a1.281 1.281 0 0 0 0 2.485c1.932.483 3.914.737 5.905.756l2.712.026c1.406.014 2.803-.31 4.029-1a8.289 8.289 0 0 1 5.642-.913c3.028.588 6.167.034 8.812-1.553z\"/><path fill=\"#65471B\" d=\"M18.736 24.003c-.754 0-1.504-.078-2.244-.234-2.693-.571-5.003-2.115-6.338-4.236a1 1 0 0 1 1.692-1.066c1.033 1.642 2.925 2.892 5.06 3.345 1.767.375 4.507.393 7.536-1.642a1 1 0 0 1 1.116 1.66c-2.129 1.43-4.489 2.173-6.822 2.173z\"/><ellipse fill=\"#65471B\" cx=\"14\" cy=\"12\" rx=\"2\" ry=\"3\"/><ellipse fill=\"#65471B\" cx=\"23\" cy=\"14\" rx=\"2\" ry=\"3\"/>","1fa70":"<path fill=\"#F4ABBA\" d=\"M23.27.108C25.631.042 32.366 2.7 32.366 18.25c-.147 2.005-.342 9.193-5.379 12.714h-5.33c-1.027-.44-2.445-2.249-2.445-8.362 0-1.809 1.43-6.741 1.467-8.118.081-3.042-.634-4.525-1.842-7.531C17.304 3.14 19.749.205 23.27.108z\"/><path fill=\"#EA596E\" d=\"M29.408 7.443c.631 1.565 4.066 13.431-2.491 13.529-1.649.13-4.613-.179-2.14-7.906.947-2.494-1.367-7.637-1.579-8.655-.316-1.516 2.263-3.13 3.999-.831 1.555 2.057 2.211 3.863 2.211 3.863z\"/><path fill=\"#F4ABBA\" d=\"M23.401 20.622c-.283 0-.558-.146-.711-.407-.23-.393-.099-.896.294-1.126 3.134-1.837 6.378-6.191 7.165-7.913.189-.414.675-.597 1.092-.406.413.189.595.678.406 1.091-.886 1.936-4.356 6.613-7.831 8.648-.13.077-.273.113-.415.113z\"/><path fill=\"#F4ABBA\" d=\"M31.42 17.688c-.064 0-.13-.007-.195-.023-1.504-.366-6.195-2.541-8.011-6.311-.197-.41-.025-.902.384-1.099.412-.198.902-.025 1.099.384 1.54 3.196 5.668 5.122 6.917 5.426.442.107.713.553.605.995-.092.376-.429.628-.799.628zM12.338 4.963c-2.371-.066-9.137 2.603-9.137 18.224.147 2.014.344 9.235 5.403 12.772h5.354c1.032-.442 2.456-2.26 2.456-8.4 0-1.818-1.398-6.773-1.474-8.154-.186-3.401.637-4.545 1.85-7.565 1.541-3.832-.915-6.779-4.452-6.877z\"/><path fill=\"#EA596E\" d=\"M6.172 12.331c-.634 1.572-4.084 13.492 2.502 13.59 1.656.131 4.634-.18 2.15-7.941-.951-2.505 1.373-7.672 1.586-8.695.317-1.523-2.273-3.144-4.017-.835-1.562 2.067-2.221 3.881-2.221 3.881z\"/><path fill=\"#F4ABBA\" d=\"M12.206 25.569c-.142 0-.286-.037-.417-.113-3.49-2.045-6.976-6.742-7.866-8.687-.19-.416-.007-.906.408-1.096.416-.19.906-.008 1.096.408.792 1.73 4.05 6.104 7.198 7.948.394.231.526.738.295 1.132-.153.262-.43.408-.714.408z\"/><path fill=\"#F4ABBA\" d=\"M4.211 22.563c-.373 0-.711-.254-.803-.632-.108-.443.164-.891.607-.999 1.247-.303 5.361-2.219 6.89-5.391.199-.412.694-.583 1.104-.386.412.198.584.693.386 1.104-1.946 4.038-6.873 6.009-7.988 6.281-.066.016-.132.023-.196.023z\"/>","1f4be":"<path fill=\"#31373D\" d=\"M4 36s-4 0-4-4V4s0-4 4-4h26c1 0 2 1 2 1l3 3s1 1 1 2v26s0 4-4 4H4z\"/><path fill=\"#55ACEE\" d=\"M5 19v-1s0-2 2-2h21c2 0 2 2 2 2v1H5z\"/><path fill=\"#E1E8ED\" d=\"M5 32.021V19h25v13s0 2-2 2H7c-2 0-2-1.979-2-1.979zM10 3s0-1 1-1h18c1.048 0 1 1 1 1v10s0 1-1 1H11s-1 0-1-1V3zm12 10h5V3h-5v10z\"/>","1f396":"<path fill=\"#55ACEE\" d=\"M25 0H11C9.896 0 9 .896 9 2v11s0 1 1 2l6.429 5h3.142L26 15c1-1 1-2 1-2V2c0-1.104-.896-2-2-2z\"/><path fill=\"#E1E8ED\" d=\"M12 0v16.555L16.429 20h3.142L24 16.555V0z\"/><path fill=\"#DD2E44\" d=\"M14 0v18.111L16.429 20h3.142L22 18.111V0z\"/><path fill=\"#FFAC33\" d=\"M21.902 21.02c.06-.163.098-.337.098-.52 0-.828-.672-1.5-1.5-1.5h-5c-.829 0-1.5.672-1.5 1.5 0 .183.038.357.098.52C11.654 22.389 10 25 10 28c0 4.418 3.581 8 8 8 4.418 0 8-3.582 8-8 0-3-1.654-5.611-4.098-6.98z\"/><circle fill=\"#FFD983\" cx=\"18\" cy=\"28\" r=\"6\"/><path fill=\"#FFAC33\" d=\"M20.731 32.36c-.119 0-.237-.036-.339-.109L18 30.535l-2.393 1.716c-.204.146-.477.146-.68-.002-.203-.147-.288-.407-.212-.645l.892-2.88-2.371-1.671c-.202-.149-.285-.41-.208-.648.078-.238.299-.399.549-.401L16.514 26l.935-2.809c.079-.238.301-.398.551-.398.25 0 .472.16.551.398L19.47 26l2.952.004c.251.002.472.163.549.401.077.238-.006.499-.208.648l-2.371 1.671.892 2.88c.076.238-.01.498-.212.645-.101.074-.221.111-.341.111z\"/>","1f979":"<circle cx=\"18\" cy=\"18\" r=\"18\" fill=\"#77bf57\"/><path fill=\"#664500\" d=\"M22.657 25.637a.513.513 0 0 1 .597-.06.497.497 0 0 1 .231.544C23.474 26.165 22.34 30.5 18 30.5s-5.474-4.335-5.484-4.38a.5.5 0 0 1 .838-.474s1.005.854 4.646.854c3.644 0 4.647-.855 4.657-.863Z\"/><path fill=\"#65471B\" d=\"M28.994 10.011A1.005 1.005 0 0 0 28.011 9c-.067-.001-1.653-.056-3.304-1.707a1 1 0 1 0-1.414 1.414C25.56 10.974 27.901 11 28 11a.995.995 0 0 0 .994-.989ZM12.707 8.707a.998.998 0 0 0-.324-1.63 1 1 0 0 0-1.09.216C9.652 8.934 8.075 8.998 7.99 9A1 1 0 0 0 8 11c.099 0 2.44-.026 4.707-2.293Z\"/><path fill=\"#FFF\" d=\"M24.5 23a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z\"/><path fill=\"#292F33\" d=\"M24.5 22a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z\"/><path fill=\"#FFF\" d=\"M24.337 16.836c1.044-1.046 1.23-2.552.417-3.364-.813-.813-2.32-.625-3.363.42-1.045 1.046-1.231 2.552-.418 3.364.814.813 2.32.625 3.364-.42Zm3.288 2.845c.458-.459.54-1.12.183-1.477-.357-.357-1.019-.274-1.478.185-.458.459-.54 1.12-.183 1.477.357.357 1.019.275 1.478-.184ZM11.5 23a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z\"/><path fill=\"#292F33\" d=\"M11.5 22a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z\"/><path fill=\"#FFF\" d=\"M11.337 16.836c1.044-1.046 1.23-2.552.417-3.364-.813-.813-2.32-.625-3.363.42-1.045 1.046-1.231 2.552-.418 3.364.814.813 2.32.625 3.364-.42Zm3.287 2.845c.46-.459.541-1.12.184-1.477-.357-.357-1.019-.274-1.478.185-.458.459-.54 1.12-.183 1.477.357.357 1.019.275 1.477-.184Z\"/><path fill=\"#5DADEC\" d=\"M29 21c0 .105-1.015 2-4.5 2-3.485 0-4.5-1.895-4.5-2-2-3.105 2.015 0 4.5 0s6.5-3.105 4.5 0Zm-13 0c0 .105-1.015 2-4.5 2C8.015 23 7 21.105 7 21c-2-3.105 2.015 0 4.5 0s6.5-3.105 4.5 0Z\"/>","1f92c":"<path fill=\"#DA2F47\" d=\"M36 18c0 9.941-8.059 18-18 18-9.94 0-18-8.059-18-18C0 8.06 8.06 0 18 0c9.941 0 18 8.06 18 18\"/><path fill=\"#292F33\" d=\"M25.485 29.879C25.44 29.7 24.317 25.5 18 25.5c-6.318 0-7.44 4.2-7.485 4.379-.055.217.043.442.237.554.195.109.439.079.6-.077.019-.019 1.954-1.856 6.648-1.856s6.63 1.837 6.648 1.855c.096.095.224.145.352.145.084 0 .169-.021.246-.064.196-.112.294-.339.239-.557zm-9.778-14.586C12.452 12.038 7.221 12 7 12c-.552 0-.999.447-.999.998-.001.552.446 1 .998 1.002.029 0 1.925.023 3.983.737-.593.64-.982 1.634-.982 2.763 0 1.934 1.119 3.5 2.5 3.5s2.5-1.566 2.5-3.5c0-.174-.019-.34-.037-.507.013 0 .025.007.037.007.256 0 .512-.098.707-.293.391-.391.391-1.023 0-1.414zM29 12c-.221 0-5.451.038-8.707 3.293-.391.391-.391 1.023 0 1.414.195.195.451.293.707.293.013 0 .024-.007.036-.007-.016.167-.036.333-.036.507 0 1.934 1.119 3.5 2.5 3.5s2.5-1.566 2.5-3.5c0-1.129-.389-2.123-.982-2.763 2.058-.714 3.954-.737 3.984-.737.551-.002.998-.45.997-1.002-.001-.551-.447-.998-.999-.998z\"/><path fill=\"#292F33\" d=\"M29.739 33H6.261C5.017 33 4 31.983 4 30.739V25c0-1.244 1.017-2.261 2.261-2.261h23.478C30.983 22.739 32 23.756 32 25v5.739C32 31.983 30.983 33 29.739 33z\"/><path d=\"M7.841 27.229h-.818c-.314 0-.457-.229-.457-.457s.143-.456.457-.456h.95l.209-1.53c.047-.342.19-.456.475-.456.228 0 .438.151.438.38 0 .143 0 .076-.019.229l-.19 1.378h.913l.209-1.53c.047-.342.19-.456.475-.456.228 0 .438.151.438.38 0 .143 0 .076-.019.229l-.191 1.378h.818c.314 0 .456.229.456.456 0 .228-.143.457-.456.457h-.951l-.152 1.083h.818c.314 0 .456.229.456.457s-.143.456-.456.456h-.951l-.209 1.53c-.048.343-.191.456-.476.456-.228 0-.438-.151-.438-.38 0-.143 0-.076.019-.229l.191-1.378h-.912l-.209 1.53c-.048.343-.19.456-.476.456-.228 0-.438-.151-.438-.38 0-.143 0-.076.019-.229l.19-1.378h-.816c-.313 0-.456-.229-.456-.456 0-.229.143-.457.456-.457h.951l.152-1.083zm.77 1.083h.903l.152-1.083h-.903l-.152 1.083zm4.616-2.5c0-.827.618-1.54 1.464-1.54s1.464.713 1.464 1.54-.618 1.531-1.464 1.531c-.847.001-1.464-.703-1.464-1.531zm1.958 0c0-.304-.181-.57-.494-.57-.314 0-.495.267-.495.57 0 .305.181.562.495.562.313 0 .494-.257.494-.562zm2.31-1.292c.124-.237.219-.304.438-.304.295 0 .561.237.561.532 0 .076 0 .143-.076.285l-3.194 5.979c-.143.199-.2.313-.428.313-.247 0-.542-.237-.542-.522 0-.143.057-.275.095-.352l3.146-5.931zm-.922 5.219c0-.827.618-1.54 1.464-1.54s1.464.713 1.464 1.54c0 .826-.618 1.53-1.464 1.53-.847.001-1.464-.704-1.464-1.53zm1.958 0c0-.305-.181-.57-.495-.57s-.495.266-.495.57c0 .304.181.561.495.561s.495-.257.495-.561zm2.486.789c0-.409.333-.742.741-.742.409 0 .742.333.742.742 0 .408-.333.741-.742.741-.408.001-.741-.332-.741-.741zm.057-5.609c0-.399.294-.646.684-.646.381 0 .685.257.685.646v3.66c0 .39-.304.646-.685.646-.39 0-.684-.247-.684-.646v-3.66zm8.078 6.407c-.187 0-.304-.053-.431-.196l-.724-.79-.072.066c-.702.645-1.308.919-2.024.919-1.109 0-2.229-.632-2.229-2.044 0-1.107.867-1.769 1.384-2.065l.117-.067-.095-.098c-.425-.445-.599-.813-.599-1.269 0-1.077.983-1.567 1.896-1.567.764 0 1.84.453 1.84 1.458 0 .951-.883 1.501-1.153 1.647l-.115.062 1.161 1.341.444-.536c.247-.297.391-.422.646-.422.205 0 .424.184.424.523 0 .254-.252.585-.499.875l-.297.335.706.838c.131.156.185.239.185.428.001.295-.269.562-.565.562zm-3.447-3.474c-.428.287-.864.665-.864 1.291 0 .656.427 1.079 1.089 1.079.552 0 .909-.242 1.275-.606l.071-.069-1.5-1.743-.071.048zm.671-2.711c-.28 0-.67.229-.67.602 0 .348.171.56.534.929l.051.052.063-.033c.497-.26.749-.553.749-.869.001-.468-.376-.681-.727-.681z\" fill=\"#FFF\"/>","1f316":"<path fill=\"#FFD983\" d=\"M0 18c0 9.941 8.059 18 18 18 .295 0 .58-.029.87-.043C24.761 33.393 29 26.332 29 18 29 9.669 24.761 2.607 18.87.044 18.58.03 18.295 0 18 0 8.059 0 0 8.059 0 18z\"/><path fill=\"#66757F\" d=\"M29 18C29 9.669 24.761 2.607 18.87.044 28.404.501 36 8.353 36 18c0 9.646-7.594 17.498-17.128 17.956C24.762 33.391 29 26.331 29 18z\"/><circle fill=\"#FFCC4D\" cx=\"10.5\" cy=\"8.5\" r=\"3.5\"/><circle fill=\"#FFCC4D\" cx=\"20\" cy=\"16\" r=\"3\"/><circle fill=\"#FFCC4D\" cx=\"21.5\" cy=\"27.5\" r=\"3.5\"/><circle fill=\"#FFCC4D\" cx=\"21\" cy=\"6\" r=\"2\"/><circle fill=\"#FFCC4D\" cx=\"3\" cy=\"18\" r=\"1\"/><circle fill=\"#5B6876\" cx=\"30\" cy=\"9\" r=\"1\"/><circle fill=\"#FFCC4D\" cx=\"15\" cy=\"31\" r=\"1\"/><circle fill=\"#5B6876\" cx=\"32\" cy=\"19\" r=\"2\"/><circle fill=\"#FFCC4D\" cx=\"10\" cy=\"23\" r=\"2\"/>","1f6f9":"<path fill=\"#A0041E\" d=\"M32.436 2.821c1.801 1.799 3.779 2.737 0 6.517L12.884 28.889c-4.594 4.595-5.463 7.571-11.405 1.63-3.258-3.258.284-3.543 4.888-8.148l19.552-19.55c1.8-1.8 4.718-1.8 6.517 0z\"/><path fill=\"#DD2E44\" d=\"M33.936 4.321c1.801 1.799 1.801 4.717 0 6.517L14.385 30.389c-4.073 4.073-8.342 4.693-11.405 1.63-3.258-3.258.284-3.543 4.888-8.148L27.42 4.321c1.799-1.8 4.717-1.8 6.516 0z\"/><path fill=\"#3B88C3\" d=\"M15.301 33.18c.927.929 2.687.673 3.932-.572 1.244-1.244 1.501-3.004.572-3.932-.927-.928-2.688-.672-3.932.572-1.245 1.245-1.501 3.005-.572 3.932z\"/><path fill=\"#3B88C3\" d=\"M19.068 27.937l-4.506 4.506.739.737 4.504-4.504z\"/><path fill=\"#88C9F9\" d=\"M14.613 32.493c.928.928 2.688.672 3.932-.573 1.245-1.244 1.501-3.004.573-3.932-.928-.928-2.688-.672-3.932.572-1.245 1.246-1.501 3.005-.573 3.933z\"/><path fill=\"#808285\" d=\"M17.651 29.396c.302.367.243.973-.207 1.423-.45.45-1.032.477-1.422.207-3.468-2.396-3.067-3.798-2.617-4.248.449-.45 1.148-1.148 4.246 2.618z\"/><path fill=\"#A7A9AC\" d=\"M16.243 29.83c-1.103 1.237-2.763.609-3.935-.562-1.172-1.171-1.302-2.466-.13-3.638 1.171-1.172 2.36-.703 3.531.469 1.172 1.171 1.756 2.359.534 3.731z\"/><path fill=\"#3B88C3\" d=\"M9.139 27.4c1.006 1.008 2.916.729 4.265-.621 1.351-1.35 1.628-3.259.622-4.266-1.006-1.007-2.916-.729-4.266.621-1.351 1.351-1.629 3.261-.621 4.266z\"/><path fill=\"#3B88C3\" d=\"M13.226 21.712l-4.888 4.89.801.798 4.886-4.886z\"/><path fill=\"#88C9F9\" d=\"M8.393 26.655c1.007 1.007 2.917.729 4.266-.622 1.351-1.35 1.628-3.259.622-4.266-1.006-1.007-2.916-.728-4.266.621-1.351 1.351-1.629 3.26-.622 4.267z\"/><path fill=\"#3B88C3\" d=\"M11.651 23.396c.336.335.243.973-.207 1.423-.45.45-1.086.542-1.422.207-.335-.336-.243-.973.208-1.423.449-.45 1.085-.541 1.421-.207zm17.651-4.216c.927.929 2.687.673 3.931-.572 1.244-1.244 1.5-3.004.572-3.932-.928-.928-2.687-.672-3.931.572-1.245 1.246-1.502 3.005-.572 3.932z\"/><path fill=\"#3B88C3\" d=\"M33.068 13.937l-4.505 4.507.739.736 4.503-4.504z\"/><path fill=\"#88C9F9\" d=\"M28.614 18.494c.928.927 2.687.671 3.931-.573 1.244-1.244 1.5-3.004.572-3.932-.928-.928-2.686-.672-3.931.572-1.244 1.245-1.501 3.005-.572 3.933z\"/><path fill=\"#808285\" d=\"M31.65 15.397c.303.367.244.973-.207 1.423-.449.45-1.03.477-1.421.207-3.469-2.396-3.068-3.798-2.617-4.248.449-.45 1.149-1.149 4.245 2.618z\"/><path fill=\"#A7A9AC\" d=\"M30.243 15.831c-1.103 1.237-2.764.609-3.935-.562-1.172-1.171-1.302-2.466-.13-3.638 1.172-1.172 2.359-.703 3.531.469 1.173 1.17 1.756 2.358.534 3.731z\"/><path fill=\"#3B88C3\" d=\"M23.14 13.401c1.006 1.008 2.915.729 4.265-.621 1.351-1.35 1.628-3.259.622-4.266-1.007-1.007-2.916-.729-4.266.621-1.352 1.351-1.629 3.26-.621 4.266z\"/><path fill=\"#3B88C3\" d=\"M22.341 12.601l4.887-4.889.8.8-4.886 4.89z\"/><path fill=\"#88C9F9\" d=\"M22.394 12.656c1.006 1.007 2.916.729 4.266-.622 1.35-1.35 1.628-3.259.621-4.266-1.006-1.007-2.916-.729-4.266.621-1.351 1.351-1.629 3.26-.621 4.267z\"/><path fill=\"#3B88C3\" d=\"M25.651 9.397c.336.335.243.973-.207 1.423-.45.45-1.086.542-1.422.207-.336-.336-.243-.973.207-1.423.451-.45 1.086-.542 1.422-.207z\"/>","26cf":"<g fill=\"#F4900C\"><path d=\"M29.185 33.279c1.166 1.166 3.022 1.221 4.121.121 1.1-1.1 1.045-2.955-.121-4.121L9.921 6.014C8.754 4.847 6.899 4.792 5.8 5.893c-1.101 1.1-1.046 2.955.121 4.121l23.264 23.265z\"/><path d=\"M3.415 7.657c-.781-.781-.781-2.048 0-2.829l1.414-1.414c.78-.78 2.047-.78 2.828 0 .781.781.781 2.048 0 2.829L6.243 7.657c-.781.781-2.048.781-2.828 0z\"/></g><path fill=\"#66757F\" d=\"M23 1C21.143.257 12-2 5 5S.257 21.143 1 23c2 5 1.671-1.063 2-3 1.015-5.971 3.822-9.178 5.822-11.178S14.051 4.029 20 3c1.921-.332 8 0 3-2z\"/>","1f984":"<path fill=\"#C1CDD5\" d=\"M36 19.854C33.518 9.923 25.006 1.909 16.031 6.832c0 0-4.522-1.496-5.174-1.948-.635-.44-1.635-.904-.912.436.423.782.875 1.672 2.403 3.317C8 12.958 9.279 18.262 7.743 21.75c-1.304 2.962-2.577 4.733-1.31 6.976 1.317 2.33 4.729 3.462 7.018 1.06 1.244-1.307.471-1.937 3.132-4.202 2.723-.543 4.394-1.791 4.394-4.375 0 0 .795-.382 1.826 6.009.456 2.818-.157 5.632-.039 8.783H36V19.854z\"/><path fill=\"#60379A\" d=\"M31.906 6.062c.531 1.312.848 3.71.595 5.318-.15-3.923-3.188-6.581-4.376-7.193-2.202-1.137-4.372-.979-6.799-.772.111.168.403.814.32 1.547-.479-.875-1.604-1.42-2.333-1.271-1.36.277-2.561.677-3.475 1.156-.504.102-1.249.413-2.372 1.101-1.911 1.171-4.175 4.338-6.737 3.511 1.042 2.5 3.631 1.845 3.631 1.845 1.207-1.95 4.067-3.779 6.168-4.452 7.619-1.745 12.614 3.439 15.431 9.398.768 1.625 2.611 7.132 4.041 10.292V10.956c-.749-1.038-1.281-3.018-4.094-4.894z\"/><path fill=\"#C1CDD5\" d=\"M13.789 3.662c.573.788 3.236.794 4.596 3.82 1.359 3.026-1.943 2.63-3.14 1.23-1.334-1.561-1.931-2.863-2.165-3.992-.124-.596-.451-2.649.709-1.058z\"/><path fill=\"#758795\" d=\"M14.209 4.962c.956.573 2.164 1.515 2.517 2.596.351 1.081-.707.891-1.349-.042-.641-.934-.94-1.975-1.285-2.263-.346-.289.117-.291.117-.291z\"/><circle fill=\"#292F33\" cx=\"15.255\" cy=\"14.565\" r=\".946\"/><path fill=\"#53626C\" d=\"M8.63 26.877c.119.658-.181 1.263-.67 1.351-.49.089-.984-.372-1.104-1.03-.119-.659.182-1.265.671-1.354.49-.088.984.373 1.103 1.033z\"/><path fill=\"#EE7C0E\" d=\"M13.844 8.124l.003-.002-.005-.007-.016-.014c-.008-.007-.011-.019-.019-.025-.009-.007-.021-.011-.031-.018C12.621 7.078.933-.495.219.219-.51.948 10.443 9.742 11.149 10.28l.011.006.541.439c.008.007.01.018.018.024.013.01.028.015.042.024l.047.038-.009-.016c.565.361 1.427.114 1.979-.592.559-.715.577-1.625.066-2.079z\"/><path fill=\"#C43512\" d=\"M4.677 2.25l.009-.025c-.301-.174-.594-.341-.878-.5-.016.038-.022.069-.041.11-.112.243-.256.484-.429.716-.166.224-.349.424-.541.595-.02.018-.036.026-.056.043.238.22.489.446.745.676.234-.21.456-.449.654-.717.214-.287.395-.589.537-.898zm2.275 2.945c.306-.41.521-.822.66-1.212-.292-.181-.584-.36-.876-.538-.076.298-.247.699-.586 1.152-.31.417-.613.681-.864.845.259.223.52.445.779.665.314-.244.619-.552.887-.912zM9.87 7.32c.365-.49.609-.983.734-1.437l-.906-.586c-.023.296-.172.81-.631 1.425-.412.554-.821.847-1.1.978l.814.671c.381-.256.761-.611 1.089-1.051z\"/>","26f1":"<path fill=\"#FFAC33\" d=\"M34 31H2c-1.104 0-2 .896-2 2v3h36v-3c0-1.104-.896-2-2-2z\"/><path fill=\"#66757F\" d=\"M16.996 32.5c-.175.809-.975 1.323-1.784 1.147-.81-.176-1.324-.975-1.148-1.784L20.004 1.5c.176-.81.975-1.323 1.784-1.148.809.176 1.323.975 1.147 1.784L16.996 32.5z\"/><path fill=\"#DD2E44\" d=\"M21.363 2.307C12.458.375 4.004 4.495 2.481 11.512c0 0-.424 1.954.553 2.167.977.212 3.356-1.318 3.356-1.318l24.431 5.303s1.53 2.379 2.508 2.591c.977.212 1.401-1.742 1.401-1.742 1.524-7.018-4.461-14.273-13.367-16.206z\"/><path fill=\"#E1E8ED\" d=\"M21.363 2.307C14.617.843 7.914 5.344 6.391 12.36c0 0-.424 1.955 1.53 2.379s5.31-.894 5.31-.894l10.749 2.333s2.508 2.59 4.463 3.015c1.954.424 2.378-1.53 2.378-1.53 1.524-7.017-2.712-13.892-9.458-15.356z\"/><path fill=\"#DD2E44\" d=\"M21.363 2.307c-3.508-.761-6.609 4.521-8.132 11.538 0 0 2.507 2.591 4.462 3.015l.977.212c1.955.424 5.31-.894 5.31-.894 1.524-7.016.892-13.109-2.617-13.871z\"/>","26f5":"<path fill=\"#A7A9AC\" d=\"M20 26c0 .553-.447 1-1 1-.552 0-1-.447-1-1V1c0-.552.448-1 1-1 .553 0 1 .448 1 1v25z\"/><path fill=\"#D1D3D4\" d=\"M3 24h31v8H12c-6 0-9-8-9-8z\"/><path fill=\"#55ACEE\" d=\"M0 30h36v6H0z\"/><path fill=\"#FFAC33\" d=\"M5 22s2-5 5-9 8-8 8-8-1 11-1 16v1s-3-1-6-1-6 1-6 1z\"/><path fill=\"#F4900C\" d=\"M20 2s6 6 9 11c2.771 4.618 4 9 4 9s-3-1-6-1-6 1-6 1v-1c0-9-1-19-1-19z\"/><path fill=\"#E6E7E8\" d=\"M2 24c-.552 0-1 .447-1 1s.448 1 1 1h33v-2H2z\"/>","1f47e":"<path fill=\"#553986\" d=\"M26 31h4v4h-4zM6 31h4v4H6zm24-21h-2V8h-2V6h-3V2h-2v4h-6V2h-2v4h-3v2H8v2H6v7H2v2h4v7h4v5h5v-5h6v5h5v-5h4v-7h4v-2h-4v-7zM16 21h-4v-8h4v8zm4 0v-8h4v8h-4zM34 6h2v11h-2zM0 6h2v11H0z\"/>","1f9f0":"<path fill=\"#292F33\" d=\"M26 .5H10C8.07.5 6.5 2.07 6.5 4v4h3V4c0-.271.229-.5.5-.5h16c.271 0 .5.229.5.5v4h3V4c0-1.93-1.57-3.5-3.5-3.5z\"/><path fill=\"#DD2E44\" d=\"M36 31.765S36 36 31.765 36H4.235C0 36 0 31.765 0 31.765V11.647c0-4.235 4.235-4.235 4.235-4.235h27.529s4.235 0 4.235 4.235v20.118z\"/><path fill=\"#CCD6DD\" d=\"M4 22h28v2H4z\"/><path fill=\"#BE1931\" d=\"M0 15h36v2H0zm4 9h28v2H4zm0 6h28v2H4z\"/><path fill=\"#CCD6DD\" d=\"M4 28h28v2H4z\"/><path fill=\"#AAB8C2\" d=\"M10 19H8c-.552 0-1-.448-1-1v-4c0-.552.448-1 1-1h2c.552 0 1 .448 1 1v4c0 .552-.448 1-1 1zm18 0h-2c-.552 0-1-.448-1-1v-4c0-.552.448-1 1-1h2c.552 0 1 .448 1 1v4c0 .552-.448 1-1 1z\"/><path fill=\"#292F33\" d=\"M25 17v1c0 .552.448 1 1 1h2c.552 0 1-.448 1-1v-1h-4zM7 17v1c0 .552.448 1 1 1h2c.552 0 1-.448 1-1v-1H7z\"/><path fill=\"#292F33\" d=\"M26 15h2v3h-2zM8 15h2v3H8z\"/>","1fa96":"<path fill=\"#464F25\" d=\"M33 15c-.987-7.586-4.602-14-15-14S3.987 7.414 3 15c-.152 1.169-2 2-2 6 0 2 1.366 3.564 3 4 3.105.829 3-1 14-1s10.895 1.829 14 1c1.634-.436 3-2 3-4 0-4-1.848-4.831-2-6z\"/><path fill=\"#383A18\" d=\"M18 15.068C7.602 15.068 2.001 17 2.001 21c0 2 .365-.176 1.999.261 3.105.829 3-2.317 14-2.317s10.895 3.146 14 2.317c1.634-.437 1.999 1.739 1.999-.261 0-4-5.601-5.932-15.999-5.932z\"/><path fill=\"#C1694F\" d=\"M18 33.966C8.733 33.966 4.034 29.94 4.034 22c0-7.94 4.699-11.966 13.966-11.966 9.268 0 13.966 4.026 13.966 11.966 0 7.94-4.698 11.966-13.966 11.966zm0-22C9.79 11.966 5.966 15.154 5.966 22S9.79 32.034 18 32.034 30.034 28.846 30.034 22 26.21 11.966 18 11.966z\"/><path fill=\"#662113\" d=\"M24 32c0 1.657-2.686 3-6 3s-6-1.343-6-3 2.686-1 6-1 6-.657 6 1z\"/><path fill=\"#717735\" d=\"M33 15c-.987-7.586-4.602-14-15-14S3.987 7.414 3 15c-.152 1.169-2 2-2 6 0 2 1.366 3.564 3 4 0-4 0-8 14-8s14 4 14 8c1.634-.436 3-2 3-4 0-4-1.848-4.831-2-6z\"/><path fill=\"#A3A364\" d=\"M18 13c-7 0-17 1-17 8 0 2 1.366 3.564 3 4 0-4 0-8 14-8s14 4 14 8c1.634-.436 3-2 3-4 0-7-11-8-17-8z\"/><path fill=\"#677032\" d=\"M18 16C7.602 16 1 17 1 21c0 2 1.366 3.564 3 4 0-4 0-8 14-8s14 4 14 8c1.634-.436 3-2 3-4 0-4-6.602-5-17-5z\"/>","1fad6":"<ellipse fill=\"#269\" cx=\"17.5\" cy=\"31.5\" rx=\"8\" ry=\"2\"/><path fill=\"#3B88C3\" d=\"M11.173 31.777s3.297.757 6.371.668c2.539-.074 5.614-.356 6.505-.757 0 0-1.069 1.381-6.416 1.381s-6.46-1.292-6.46-1.292z\"/><ellipse fill=\"#269\" cx=\"17.5\" cy=\"15.25\" rx=\"8.5\" ry=\"2.25\"/><path fill=\"#3B88C3\" d=\"M33.582 16.654c3.518-.202 2.185 1.133 1.072 1.712-.505.262-1.515 1.738-2.098 4.234-.455 1.948-.847 5.658-5.213 5.391-2.994-.183-.045-7.084-.045-7.084s1.871 3.119 3.876-1.47c.895-2.049 1.409-2.726 2.408-2.783zM5.829 28.351c-1.112 0-2.138-.351-3.021-1.04C.858 25.789.167 22.812.167 21c0-2.422 1.331-4.875 3.875-4.875 1.546 0 2.209.537 2.911 1.104.394.319.801.648 1.48.988l-.782 1.931c-.849-.424-1.375-.85-1.798-1.192-.607-.491-.884-.715-1.811-.715-1.46 0-2.125 1.254-2.125 2.759 0 1.531.608 3.551 1.967 4.611.822.643 1.815.822 2.945.54l.425 2.017c-.486.122-.963.183-1.425.183z\"/><path fill=\"#3B88C3\" d=\"M29 24.727C29 31.254 22.1 32 17.5 32S6 31.254 6 24.727 10.775 12 17.5 12 29 18.2 29 24.727z\"/><path fill=\"#269\" d=\"M29.485 26.965c-.489.039-1.069-.757-1.069-.757-.847 2.049-3.342 4.589-11.139 4.589-6.995 0-9.579-2.139-10.96-3.965 0 0 .33 1.202-1.782.757-.648-.137-1.926-.768-2.966-1.658.34.524.749.998 1.239 1.38.883.689 1.91 1.04 3.021 1.04.354 0 .718-.047 1.087-.118 2.02 3.3 6.932 3.847 10.521 3.847 3.679 0 8.883-.566 10.798-4.097 3.525-.265 3.898-3.577 4.32-5.382.439-1.88 1.12-3.18 1.645-3.82-.03.013-.051.016-.082.031-1.826.891-1.871 7.93-4.633 8.153zM4.891 17.698c-.64-.362-1.96-.223-2.629.891-.442.736-.471 1.642-.34 2.316.028-1.462.691-2.664 2.12-2.664.926 0 1.204.224 1.811.715.289.234.636.508 1.092.793l.174-.492s-1.203-.98-2.228-1.559zm19.663-3.704c.284.159.446.328.446.506 0 .828-3.358 1.5-7.5 1.5s-7.5-.672-7.5-1.5c0-.178.162-.347.446-.506C9.533 14.353 9 14.785 9 15.25c0 1.243 3.806 2.25 8.5 2.25s8.5-1.007 8.5-2.25c0-.465-.533-.897-1.446-1.256z\"/><ellipse fill=\"#269\" cx=\"17.5\" cy=\"11\" rx=\"2.8\" ry=\"1.5\"/><ellipse fill=\"#269\" cx=\"34.364\" cy=\"17.141\" rx=\"1.047\" ry=\".334\"/>","1f368":"<path fill=\"#55ACEE\" d=\"M20 28.625S30.661 25.9 33.356 15.72c.396-1.495-1.518-2.72-3.868-2.72H5.999c-1.175 0-3.74.493-3.072 2.894C5.711 25.9 16 28.625 16 28.625v1.173s-4.634 2.443-5.588 3.01c-1.027.588-.268 1.526.144 1.689.684.269 2.39 1.15 7.116 1.15 4.847 0 7.497-.954 8.083-1.15.226-.075 1.197-.973-.198-1.799-2.484-1.47-5.557-2.9-5.557-2.9v-1.173z\"/><path fill=\"#3B88C3\" d=\"M33.291 15.248c0 1.692-6.835 3.064-15.269 3.064-8.432 0-15.268-1.371-15.268-3.064s6.836-3.064 15.268-3.064c8.434 0 15.269 1.371 15.269 3.064z\"/><path fill=\"#F4ABBA\" d=\"M25.982 6.908c0 1.613-3.133 4.745-7.832 4.745-4.325 0-7.831-2.088-7.831-4.745 0-4.325 3.505-6.787 7.831-6.787 4.327.001 7.832 2.462 7.832 6.787z\"/><path fill=\"#FFE8B6\" d=\"M33.291 14.217c0 1.613-3.132 4.223-7.83 4.223-4.326 0-7.832 1.393-7.832-4.223 0-4.325 3.506-7.831 7.832-7.831 4.325 0 7.83 3.506 7.83 7.831z\"/><path fill=\"#8A4B38\" d=\"M18.672 14.217c0 5.182-3.132 4.311-7.831 4.311-4.325 0-7.831-1.653-7.831-4.311 0-4.325 3.506-7.831 7.831-7.831 4.326 0 7.831 3.506 7.831 7.831z\"/><path fill=\"#3B88C3\" d=\"M30.837 21.098c.824-1.161 1.541-2.487 2.082-3.995-13.485 4.732-26.07 1.375-29.477.336.49 1.279 1.103 2.425 1.797 3.446 11.35 3.251 21.551 1.204 25.598.213z\"/><path fill=\"#55ACEE\" d=\"M2.837 15.177c1.396.6 15.488 5.046 30.498.087 0 .652-.411 2.477-.653 3.175-.391 1.132-15.401 4.83-28.888.261-.392-.173-1.566-3.784-.957-3.523z\"/>","1fa87":"<defs><clipPath id=\"a\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-35.367 13.848h36v-36h-36Z\"/></clipPath><clipPath id=\"b\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-24.343 34.246h36v-36h-36Z\"/></clipPath><clipPath id=\"c\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-36 10.269H0v-36h-36Z\"/></clipPath><clipPath id=\"d\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-34.38 15.907h36v-36h-36Z\"/></clipPath><clipPath id=\"e\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-31.406 19.303h36v-36h-36Z\"/></clipPath><clipPath id=\"f\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-28.11 21.53h36v-36h-36Z\"/></clipPath><clipPath id=\"g\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-12.71 6.294h36v-36h-36Z\"/></clipPath><clipPath id=\"h\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-16.316 29.198h36v-36h-36Z\"/></clipPath><clipPath id=\"i\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-11.042 3.065h36v-36h-36Z\"/></clipPath><clipPath id=\"j\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-13.173 8.53h36v-36h-36Z\"/></clipPath><clipPath id=\"k\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-12.869 13.034h36v-36h-36Z\"/></clipPath><clipPath id=\"l\" clipPathUnits=\"userSpaceOnUse\"><path d=\"M-11.599 16.805h36v-36h-36Z\"/></clipPath></defs><path fill=\"#fcd646\" d=\"M0 0a10.926 10.926 0 0 0-.987-2.058l-.001-.001c-1.379-1.093-5.157-1.888-7.379-1.093-2.222.794-4 3-4.227 5.246.098.732.276 1.477.54 2.217a10.562 10.562 0 0 0 1.783 3.168c1.904-.631 3.847.105 5.904-.631 2.058-.736 3-2 5-3.269A10.622 10.622 0 0 0 0 0\" clip-path=\"url(#a)\" transform=\"matrix(1 0 0 -1 35.367 13.848)\"/><path fill=\"#d4a086\" d=\"M0 0c-.55-1.538-2.122-2.092-3.626-1.554-1.502.537-2.368 1.963-1.818 3.501.348.972.898 1.811 1.275 2.334 1.491 2.067 2.65 4.354 3.508 6.755l.036.101c.045.125.086.251.123.378 1.159.731 1.691.898 2.159.731.468-.168 0 0 .592-1.715a6.6 6.6 0 0 1-.145-.37l-.036-.101C1.209 7.659.654 5.156.496 2.612.456 1.969.394 1.102 0 0\" clip-path=\"url(#b)\" transform=\"matrix(1 0 0 -1 24.343 34.246)\"/><path fill=\"#d24248\" d=\"M0 0c-1.778-.237-3.836-.021-5.895.715-2.056.736-3.785 1.875-5.009 3.185 1.922 2.334 4.664 3.444 7.073 2.583C-1.422 5.621-.007 3.024 0 0\" clip-path=\"url(#c)\" transform=\"matrix(1 0 0 -1 36 10.269)\"/><path fill=\"#82ae63\" d=\"M0 0a10.36 10.36 0 0 0-.431-.64 12.303 12.303 0 0 0-2.543-2.757c-1.406-.696-3.867-.247-5.406.304-1.538.55-2 1-3.082 2.732a12.312 12.312 0 0 0-.217 3.745c.015.255.039.511.073.769C-10.373 2.709-8.535 1.445-6.314.65-4.091-.145-1.869-.333 0 0\" clip-path=\"url(#d)\" transform=\"matrix(1 0 0 -1 34.38 15.907)\"/><path fill=\"#d24248\" d=\"M0 0a10.735 10.735 0 0 0-1.724-1.11 6.727 6.727 0 0 1-1.573-1.117c-2.109 0-1.41-.72-2.109-.47-.697.25-1.013.987-1.946 1.92a6.698 6.698 0 0 1-.507 1.861 10.78 10.78 0 0 0-.629 1.952c1.096-.904 2.45-1.679 3.989-2.229C-2.961.256-1.422-.003 0 0\" clip-path=\"url(#e)\" transform=\"matrix(1 0 0 -1 31.406 19.303)\"/><path fill=\"#ba6e54\" d=\"M0 0a6.63 6.63 0 0 1-1.517-2.184 14.314 14.314 0 0 0-2.751.984c.252.865.32 1.766.213 2.651.614-.334 1.274-.63 1.971-.88C-1.385.321-.688.132 0 0\" clip-path=\"url(#f)\" transform=\"matrix(1 0 0 -1 28.11 21.53)\"/><path fill=\"#fcd646\" d=\"M0 0c.239-.75.391-1.499.463-2.235v-.001C.029-3.942-2.492-6.865-4.741-7.581c-2.248-.716-5-.041-6.542 1.608a10.935 10.935 0 0 0-.916 2.091 10.586 10.586 0 0 0-.504 3.599c1.897.653 2.996 2.416 5.077 3.079 2.083.663 3.599.229 5.958.433A10.592 10.592 0 0 0 0 0\" clip-path=\"url(#g)\" transform=\"matrix(1 0 0 -1 12.71 6.294)\"/><path fill=\"#d4a086\" d=\"M0 0c.496-1.557-.419-2.95-1.94-3.434s-3.074.124-3.569 1.681C-5.822-.77-5.893.23-5.911.875c-.068 2.548-.534 5.069-1.307 7.499l-.033.102c-.04.127-.084.252-.132.375.478 1.284.8 1.739 1.273 1.89.474.151 0 0 1.511-1.003.033-.129.069-.256.109-.383l.033-.103c.773-2.429 1.85-4.756 3.267-6.875C-.832 1.841-.355 1.115 0 0\" clip-path=\"url(#h)\" transform=\"matrix(1 0 0 -1 16.316 29.198)\"/><path fill=\"#d24248\" d=\"M0 0c-1.27-1.267-3.037-2.343-5.12-3.006-2.082-.663-4.147-.806-5.915-.506.113 3.022 1.62 5.567 4.057 6.343C-4.54 3.607-1.84 2.4 0 0\" clip-path=\"url(#i)\" transform=\"matrix(1 0 0 -1 11.042 3.065)\"/><path fill=\"#ec9435\" d=\"M0 0c.024-.258.04-.516.046-.77.059-1.085 0-2.378-.35-3.734C-1-5.911-3.229-7.046-4.786-7.542c-1.557-.495-2.197-.417-4.109.304a12.287 12.287 0 0 0-2.443 2.845c-.143.212-.279.43-.409.656 1.857-.4 4.084-.291 6.332.425C-3.165-2.596-1.284-1.398 0 0\" clip-path=\"url(#j)\" transform=\"matrix(1 0 0 -1 13.173 8.53)\"/><path fill=\"#d24248\" d=\"M0 0a10.72 10.72 0 0 0-.698-1.928A6.694 6.694 0 0 1-1.27-3.77c-1.677-1.279-.686-1.428-1.393-1.653-.705-.224-1.404.171-2.712.347a6.693 6.693 0 0 1-1.531 1.172c-.624.35-1.184.747-1.684 1.17 1.42-.054 2.966.151 4.523.647C-2.51-1.592-1.129-.865 0 0\" clip-path=\"url(#k)\" transform=\"matrix(1 0 0 -1 12.869 13.035)\"/><path fill=\"#ba6e54\" d=\"M0 0a6.594 6.594 0 0 1 .119-2.656 13.854 13.854 0 0 0-1.371-.514 14.2 14.2 0 0 0-1.414-.373 6.617 6.617 0 0 1-1.438 2.237c.691.107 1.395.272 2.101.497C-1.296-.584-.627-.312 0 0\" clip-path=\"url(#l)\" transform=\"matrix(1 0 0 -1 11.599 16.805)\"/>","1f3ee":"<path fill=\"#292F33\" d=\"M29 34c0 1.104-.896 2-2 2H9c-1.104 0-2-.896-2-2V2c0-1.104.896-2 2-2h18c1.104 0 2 .896 2 2v32z\"/><path fill=\"#BE1931\" d=\"M6.699 32h22.602C33.383 28.7 35 23.658 35 18c0-5.658-1.616-10.7-5.698-14H6.698C2.615 7.3 1 12.342 1 18c0 5.658 1.616 10.7 5.699 14z\"/><path d=\"M1.301 22c.108.682.245 1.35.415 2h32.568c.17-.65.307-1.318.415-2H1.301zm-.229-2h33.855c.049-.657.073-1.324.073-2H1c0 .676.024 1.343.072 2zm31.605 8c.363-.64.684-1.306.956-2H2.367c.272.694.593 1.36.956 2h29.354zM2.366 10c-.254.646-.471 1.313-.651 2h32.569c-.18-.687-.397-1.354-.651-2H2.366zm-1.065 4c-.104.654-.179 1.321-.229 2h33.855c-.049-.679-.125-1.346-.229-2H1.301zm30.014 16H4.685c.591.721 1.26 1.391 2.014 2h22.602c.754-.609 1.422-1.279 2.014-2zM4.685 6c-.515.627-.964 1.298-1.363 2h29.356c-.398-.702-.849-1.373-1.362-2H4.685z\" fill=\"#DD2E44\"/>","1f40a":"<path fill=\"#3E721D\" d=\"M19 32c0 1-1.723 3-3.334 3C14.056 35 14 33.657 14 32s1.306-3 2.916-3C18.527 29 19 30.343 19 32zm11 0c0 1-1.723 3-3.334 3C25.056 35 25 33.657 25 32s1.306-3 2.916-3C29.527 29 30 30.343 30 32z\"/><path fill=\"#5C913B\" d=\"M36 25c0-6-3.172-9.171-6-12-1-1-1.399.321-1 1 .508.862 3 8-2 8h-2c-5 0-6.172-1.172-9-4-4.5-4.5-7 0-9 0-6 0-7-1.812-7 2 0 3 3 4 6 4s3 1 5 4c1.071 1.606 2.836 3.211 5.023 4.155.232 1.119 2.774 3.845 4.311 3.845C21.944 36 22 34.657 22 33h5c.034 0 .066-.01.101-.01.291.005.587.01.899.01 0 1 1.723 3 3.334 3C32.944 36 33 34.657 33 33c0-.302-.057-.587-.137-.861C34.612 31.193 36 29.209 36 25z\"/><path fill=\"#292F33\" d=\"M10 18.123c0 .828.671 1.5 1.5 1.5s1.5-.672 1.5-1.5c0-.829-.671 0-1.5 0s-1.5-.829-1.5 0z\"/><g fill=\"#77B255\"><ellipse cx=\"27.5\" cy=\"24\" rx=\"1.5\" ry=\"1\"/><ellipse cx=\"23.5\" cy=\"24\" rx=\"1.5\" ry=\"1\"/><ellipse cx=\"19.5\" cy=\"24\" rx=\"1.5\" ry=\"1\"/><ellipse cx=\"21.5\" cy=\"26\" rx=\"1.5\" ry=\"1\"/><ellipse cx=\"25.5\" cy=\"26\" rx=\"1.5\" ry=\"1\"/></g><path fill=\"#FFF\" d=\"M6 22c-.389 0-1-1-1-1h2s-.611 1-1 1zm-2 .469C3.611 22.469 3 21 3 21h2s-.611 1.469-1 1.469zM2 23c-.389 0-1-2-1-2h2s-.611 2-1 2z\"/>","1f404":"<path fill=\"#CCD6DD\" d=\"M34 15c0-2-2.127-4.702-4-4-8 3-19-2-19-2-2.209 0-6.857 9.257-5 10 .277.111.541.227.799.343C4.648 20.087 4.283 21.809 6 22c9 1 6.896 14 8 14 1.344 0 2.685-2.614 3.422-5h9.8c.288 2.354.866 5 1.778 5 .866 0 2.611-3.542 3.794-9.142C33.528 24.232 34 20.326 34 15z\"/><path fill=\"#31373D\" d=\"M10 22c-2 0-4.946.087-6.973.087S-.617 18.609.692 17.305C2 16 6 15 5 11c-.542-2.169 4-3 6-2 4.816 2.408 5 10-2 10 0 0 3 3 1 3zm20-11c-2.586.97-5.485 1.101-8.226.838C20.669 13.231 20 15.031 20 17c0 4.418 3.357 8 7.5 8 2.587 0 4.866-1.396 6.215-3.521.181-1.872.285-4.017.285-6.479 0-2-2.127-4.702-4-4z\"/><circle fill=\"#31373D\" cx=\"17.5\" cy=\"24.5\" r=\"3.5\"/><circle fill=\"#31373D\" cx=\"30\" cy=\"28\" r=\"2\"/><path fill=\"#CCD6DD\" d=\"M11 9c0 .552-.671 1-1.5 1S5 7.552 5 7s2.23-.308 3 0c2.5 1 3 1.448 3 2z\"/><circle fill=\"#CCD6DD\" cx=\"8\" cy=\"13\" r=\"1\"/><path fill=\"#31373D\" d=\"M35 24c-.553 0-1-.447-1-1v-5c0-1.44-.561-2-2-2-.553 0-1-.448-1-1s.447-1 1-1c2.542 0 4 1.458 4 4v5c0 .553-.447 1-1 1z\"/>","1f5fd":"<path fill=\"#88C9F9\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#157569\" d=\"M26.496 9.174L32 0h-2l-6.38 7.292c-1.162-.559-2.418-.949-3.741-1.141L19 0h-2l-.879 6.151c-1.298.188-2.532.566-3.676 1.109L7 0H5l4.561 9.123c-.91.778-1.713 1.674-2.38 2.673L0 10v2l5.819 2.494C5.298 15.9 5 17.413 5 19c-.001.098-.013.191-.017.288l-2.748.393c-.078-.225-.156-.444-.235-.681-1-2.999-2-5-2-5v18c0 4 4 4 4 4h28s-.465-1.044 0-2c.179-.368 1.447-.658 1-2-.709-2.129-1.417-6.767-1.769-10H36v-2l-4.992-.713c-.004-.1-.008-.206-.008-.287 0-1.587-.299-3.1-.818-4.506L36 12v-2l-7.182 1.796c-.651-.978-1.437-1.855-2.322-2.622zM4 24s-.372-.747-.886-2h1.483C4.319 23.181 4 24 4 24z\"/><path fill=\"#3FC9B9\" d=\"M7 18s.422-3.316 4-6c4-3 6-2 6-1s-3 1-6 3-4 4-4 4zm22 0s-.423-3.316-4-6c-4-3-6-2.001-6-1 0 1 3 1 6 3s4 4 4 4zm-11-4c-6 0-8 4-8 4s2-2 4-2 2 2 2 2v2c0 1 2 1 2 1s2 0 2-1v-2s0-2 2-2 4 2 4 2-2-4-8-4z\"/><path fill=\"#3FC9B9\" d=\"M23 20c-2 0-2-1-2-1s-.083 2.815-1 4h-4c-.918-1.185-1-4-1-4s0 1-2 1-4-1-4-1 0 9 2 10c1.265.633 4-1 7-1s5.735 1.633 7 1c2-1 2-10 2-10s-2 1-4 1z\"/><path fill=\"#157569\" d=\"M15 25h6s-1-1-3-1-3 1-3 1z\"/><path fill=\"#3FC9B9\" d=\"M2 23c-1 5 .215 10.177 1 9 2-3 2 0 2 1s.526 4.211 2 2c1.401-2.101 6.368-.281 9.225 1h1.154C15.31 34.605 10.456 33.638 8 32c-3-2-6-9-6-9z\"/>","1f307":"<path fill=\"#FFCC4D\" d=\"M32 0H4C1.791 0 0 1.791 0 4v28h36V4c0-2.209-1.791-4-4-4z\"/><path fill=\"#F4900C\" d=\"M32.114 16.736c1.587-.451 1.587-1.147.001-1.599l-.559-.154L31 14.82v.005l-2.94-.891L30.383 12h-.014l.493-.322.497-.359c1.291-1.023 1.008-1.686-.629-1.498l-.636.089-.632.09h-.002l-2.979.339 1.77-3.18.309-.558c.802-1.44.281-1.963-1.158-1.163l-.558.282-.556.28h-.002L23.66 7.489 24 4.542v-.003l.08-.632.077-.638c.188-1.634-.492-1.915-1.516-.623l-.394.499-2.257 2.851-.819-2.881-.002-.005-.348-1.225c-.451-1.587-1.19-1.587-1.642 0l-.174.612-.174.613-.821 2.886-1.861-2.35-.001-.001-.395-.499-.397-.501c-1.023-1.29-1.704-1.007-1.515.629l.074.634.073.632v.001l.346 2.979-3.177-1.77-.557-.311c-1.441-.802-1.963-.28-1.161 1.161l.31.556 1.77 3.177-2.979-.346h-.001l-.632-.073-.635-.074c-1.636-.189-1.918.492-.629 1.515l.501.397.499.395.001.001 2.35 1.861-2.884.822-.612.174-.612.174c-1.587.452-1.587 1.19 0 1.642l1.225.348.004.002 2.881.819-2.851 2.258-.499.396c-1.292 1.023-1.011 1.705.623 1.517l.638-.08.632-.081h.002l2.948-.34L8 24.286v.002l-.28.556-.296.559c-.8 1.44-.271 1.96 1.169 1.158l.56-.309 3.185-1.77L12 27.46v.002l-.08.632-.077.635c-.189 1.637.491 1.918 1.514.627l.396-.5.395-.5 1.862-2.352.82 2.885v.001l.174.612.175.613c.452 1.586 1.105 1.586 1.557-.001L19 28.89v-.004l.905-2.882 1.905 2.352.416.5.407.5c1.022 1.29 1.71 1.01 1.521-.625l-.078-.637-.076-.633v-.003l-.34-2.947L26.284 26h.002l.557.28.558.295c1.44.803 1.963.273 1.16-1.167l-.28-.56L28 24.29v-.002l-1.489-2.628 2.947.34h.003l.633.08.637.077c1.635.188 1.915-.492.625-1.515l-.5-.395-.5-.395-2.352-1.947L30.886 17h.004l1.224-.264z\"/><circle fill=\"#FFE8B6\" cx=\"18\" cy=\"16\" r=\"9.63\"/><path fill=\"#485359\" d=\"M10 36V15l4-4h2l4 4v21zm23-17c0-1-1-1-1-1h-7s-1 0-1 1v17h9V19z\"/><path fill=\"#292F33\" d=\"M28 25c0-1-1-1-1-1h-8c-1 0-1 1-1 1v11h10V25zm-17 2H6v-5s0-1-1-1H0v11c0 2.209 1.791 4 4 4h8v-8s0-1-1-1zm21 4c-1 0-1 1-1 1v4h1c2.209 0 4-1.791 4-4v-1h-4z\"/><path d=\"M8 29h2v2H8zm-2 4h2v2H6zm10-16h2v2h-2zm0 4h2v2h-2zm-2 4h2v2h-2zm10 1h2v2h-2zm-2 4h2v2h-2zm7-10h2v2h-2zm0 4h2v2h-2z\" fill=\"#FFCC4D\"/>","1f351":"<path fill=\"#5C913B\" d=\"M1.062 5.125s4.875-5 10-5C17.188.125 19 5.062 19 5.062s.625-4 5-4 6.938 3.125 6.938 3.125-3.562 2.125-4.625 2.562c-2.801 1.153-11.375 3.562-15.375 2.562S1.062 5.125 1.062 5.125z\"/><path fill=\"#FF886C\" d=\"M18 6s1.042-.896 6-.896c6.542 0 12 4.812 12 12.927 0 11.531-14.958 17.881-14.958 17.881S1 34.833 1 17.977C1 8.018 7.75 5 12 5c4.958 0 6 1 6 1z\"/><path fill=\"#77B255\" d=\"M1.062 5.125s4.875-5 10-5C17.188.125 19 5.062 19 5.062s-4.062 5.25-8.062 4.25-9.876-4.187-9.876-4.187z\"/><path fill=\"#DD2E44\" d=\"M22.999 30c-.19 0-.383-.055-.554-.168-.46-.307-.584-.927-.277-1.387C22.183 28.423 24 25.538 24 19c0-6.445-4.578-10.182-4.625-10.219-.431-.345-.501-.974-.156-1.405.346-.431.975-.501 1.406-.156C20.844 7.395 26 11.604 26 19c0 7.22-2.079 10.422-2.168 10.555-.192.289-.51.445-.833.445z\"/>","1f378":"<path fill=\"#8899A6\" d=\"M19 20.255S30.458 9.214 31.583 8.25 30.875 6 28.626 6H6.129c-1.125 0-4.483.729-2.796 2.417C4.537 9.62 16 20.255 16 20.255v10.123s-4.584 2.34-5.498 2.883c-.984.562-.33 1.462.063 1.617.656.258 2.253 1.102 6.78 1.102 4.641 0 6.202-.914 6.765-1.102.217-.072 1.347-.932.011-1.723C21.743 31.747 19 30.378 19 30.378V20.255z\"/><path fill=\"#CCD6DD\" d=\"M32 7.442c0-1.622-6.547-2.935-14.623-2.935S2.754 5.82 2.754 7.442c0 .756 1.436 1.443 3.775 1.963 2.746 2.341 7.298 6.098 9.627 8.013.9.741 2.135.623 2.801.123.503-.377 6.606-5.643 9.57-8.203C30.69 8.827 32 8.166 32 7.442z\"/><path fill=\"#662113\" d=\"M16.868 16.532c-.237-.125-.05-.8.248-1.328L24.564.686c.3-.529.97-.715 1.498-.416.529.299.714.969.416 1.498l-8.667 13.885c-.15.264-.674 1.02-.943.879z\"/><path fill=\"#5C913B\" d=\"M21.745 7.855c1.133.639 1.996 2.636 1.2 4.046-.797 1.411-2.954 1.699-4.087 1.059-1.132-.64-2.065-2.515-1.199-4.046.865-1.531 2.953-1.699 4.086-1.059z\"/><path fill=\"#FFF\" d=\"M16.797 10.761c-3.775 0-7.361-.49-10.737-1.471l-.129-.037c-.531-.153-.836-.708-.683-1.238.152-.531.705-.837 1.238-.684l.132.039c6.533 1.898 13.942 1.855 22.018-.132.543-.13 1.079.196 1.21.732.132.536-.195 1.078-.731 1.21-4.289 1.054-8.404 1.581-12.318 1.581z\"/>","1f33b":"<path fill=\"#3E721D\" d=\"M28 27c-8 0-8 6-8 6V22h-4v11s0-6-8-6c-4 0-7-2-7-2s0 9 9 9h6s0 2 2 2 2-2 2-2h6c9 0 9-9 9-9s-3 2-7 2z\"/><path fill=\"#FFAC33\" d=\"M21.125 27.662c-.328 0-.651-.097-.927-.283l-2.323-1.575-2.322 1.575c-.277.186-.601.283-.929.283-.143 0-.287-.018-.429-.057-.462-.123-.851-.441-1.06-.874l-1.225-2.527-2.797.204c-.04.002-.079.004-.119.004-.438 0-.86-.174-1.17-.484-.34-.342-.516-.81-.481-1.288l.201-2.8-2.523-1.225c-.432-.209-.751-.598-.876-1.062-.125-.464-.042-.958.228-1.356l1.573-2.323-1.573-2.322c-.27-.398-.353-.892-.228-1.357.125-.462.444-.851.876-1.06L7.544 7.91l-.201-2.797c-.034-.48.142-.951.481-1.289.31-.312.732-.485 1.17-.485.04 0 .079 0 .119.003l2.797.201 1.225-2.523c.209-.432.598-.751 1.06-.876.142-.038.285-.057.429-.057.328 0 .651.098.929.285l2.322 1.573L20.198.372c.275-.188.599-.285.927-.285.144 0 .29.02.428.057.465.125.854.444 1.062.876l1.225 2.523 2.8-.201c.037-.003.078-.003.116-.003.438 0 .858.173 1.172.485.338.338.515.809.48 1.289l-.204 2.797 2.527 1.225c.433.209.751.598.874 1.06.124.465.043.96-.227 1.357l-1.575 2.322 1.575 2.323c.269.398.351.892.227 1.356-.123.464-.441.852-.874 1.062l-2.527 1.225.204 2.8c.034.478-.143.946-.48 1.288-.313.311-.734.484-1.172.484-.038 0-.079-.002-.116-.004l-2.8-.204-1.225 2.527c-.209.433-.598.751-1.062.874-.139.04-.284.057-.428.057z\"/><circle fill=\"#732700\" cx=\"18\" cy=\"14\" r=\"7\"/>","1f480":"<path fill=\"#CCD6DD\" d=\"M34 16C34 6 26.837 0 18 0 9.164 0 2 6 2 16c0 5.574.002 10.388 6 12.64V33c0 1.657 1.343 3 3 3s3-1.343 3-3v-3.155c.324.027.659.05 1 .07V33c0 1.657 1.343 3 3 3s3-1.343 3-3v-3.085c.342-.021.676-.043 1-.07V33c0 1.657 1.344 3 3 3 1.657 0 3-1.343 3-3v-4.36c5.998-2.252 6-7.066 6-12.64z\"/><circle fill=\"#292F33\" cx=\"11\" cy=\"14\" r=\"5\"/><circle fill=\"#292F33\" cx=\"25\" cy=\"14\" r=\"5\"/><path fill=\"#292F33\" d=\"M19.903 23.062C19.651 22.449 18.9 22 18 22s-1.652.449-1.903 1.062c-.632.176-1.097.75-1.097 1.438 0 .828.671 1.5 1.5 1.5.655 0 1.206-.422 1.41-1.007.03.001.059.007.09.007s.06-.006.09-.007c.205.585.756 1.007 1.41 1.007.828 0 1.5-.672 1.5-1.5 0-.688-.466-1.261-1.097-1.438z\"/>","1f9f7":"<path fill=\"#99AAB5\" d=\"M5.864 24.272C2.626 24.272 0 26.897 0 30.136S2.626 36 5.864 36s5.864-2.625 5.864-5.864-2.625-5.864-5.864-5.864zm0 10.053c-2.313 0-4.189-1.875-4.189-4.189 0-2.313 1.875-4.189 4.189-4.189s4.189 1.875 4.189 4.189c0 2.313-1.875 4.189-4.189 4.189zM19.67 3.938c-1.131 1.131-1.924 2.197-2.441 3.211-.427.835-.241 1.852.422 2.515l8.684 8.684c.663.663 1.68.849 2.515.422 1.014-.518 2.08-1.31 3.211-2.441 5.133-5.133 4.381-9.929.959-13.351s-8.217-4.173-13.35.96z\"/><path fill=\"#66757F\" d=\"M30.544 9.849c-.616 2.499-4.393 4.096-6.195.878-1.848 2.601 0 5.214 1.182 6.816-2.072-1.876-5.127-4.89-7.222-7.222 2.047 1.467 3.85 1.516 3.85.851 0-2.42 2.133-5.887 4.552-5.887s4.412 2.215 3.833 4.564z\"/><path fill=\"#99AAB5\" d=\"M1.356 26.763c.621-1.188 8.854-12.722 17.213-19.194l.98 1.265c-7.324 5.671-14.792 15.65-16.463 18.168-.156.235-1.73-.239-1.73-.239zm8.292 7.661l-.714-1.432C10 32.46 21.169 24.632 27.6 16.634l1.246 1.003c-6.431 8-17.591 15.986-19.198 16.787z\"/>","1f33f":"<path fill=\"#77B255\" d=\"M20.917 22.502c-2.706-.331-3.895-1.852-6.273-4.889 3.039-2.376 4.559-3.565 7.266-3.235 2.71.332 5.25 2.016 6.273 4.889-1.683 2.543-4.557 3.563-7.266 3.235zm-5.959 8.814c-2.549-.187-3.733-1.553-6.098-4.288 2.735-2.364 4.102-3.547 6.652-3.364 2.551.185 5.009 1.644 6.098 4.287-1.459 2.458-4.1 3.548-6.652 3.365zm-6.22-15.707c1.338 1.631 1.191 3.117.898 6.088-2.97-.294-4.456-.44-5.795-2.071-1.339-1.634-1.861-3.935-.898-6.088 2.301-.524 4.456.439 5.795 2.071zm21.116-5.448c-2.435 1.02-4.16.314-7.613-1.097 1.411-3.453 2.118-5.18 4.549-6.203 2.434-1.021 5.378-.826 7.612 1.096-.194 2.944-2.117 5.181-4.548 6.204zM17.103 6.608c.874 2.869-.124 4.742-2.119 8.488-3.745-1.996-5.619-2.994-6.494-5.864-.876-2.872-.315-6.18 2.118-8.49 3.308.561 5.619 2.993 6.495 5.866z\"/><path fill=\"#A6D388\" d=\"M8.49 9.232c.862 2.828 2.702 3.843 6.338 5.781v-.005c-.07-2.521-2.733-10.876-4.267-14.214C8.172 3.102 7.62 6.381 8.49 9.232zm-5.592 4.429c-.89 2.118-.371 4.362.943 5.965 1.34 1.632 2.826 1.777 5.795 2.071-.997-1.937-4.911-6.388-6.738-8.036z\"/><path fill=\"#5C913B\" d=\"M21.91 14.378c-2.563-.312-4.077.75-6.808 2.879 1.746.105 8.786.745 13.06 2.037.006-.01.015-.017.021-.027-1.023-2.873-3.563-4.557-6.273-4.889zm-.304 13.565c-1.091-2.637-3.545-4.094-6.094-4.279-2.5-.179-3.87.961-6.498 3.232 2.767-.305 7.905-.87 12.592 1.047z\"/><path fill=\"#A6D388\" d=\"M22.421 9.137c3.327 1.359 5.043 2.024 7.432 1.024 2.419-1.018 4.332-3.239 4.542-6.16-3.922.761-10.391 4.15-11.974 5.136z\"/><path fill=\"#A06253\" d=\"M4.751 35.061c-.584-.091-1.363-.831-1.273-1.416.546-3.562 2.858-12.168 18.298-24.755.458-.375.976-.659 1.364-.212.391.447-.052.95-.498 1.339C9.354 21.587 7.128 30.751 6.619 34.082c-.091.585-1.283 1.067-1.868.979z\"/>","1fa90":"<circle fill=\"#FFCC4D\" cx=\"18\" cy=\"18\" r=\"10.694\"/><path fill=\"#F4900C\" d=\"M10.229 22.751c-.985.067-1.689-.308-2.203-.917.214.557.487 1.081.788 1.588.771.289 1.591.41 2.54-.272-.463-.227-.88-.415-1.125-.399zM23.086 8.608c.045.328-.187.5-.75.363-.955-.232-1.793.776-2.274 1.619-.947 1.657-4.854 3.524-4.857 2.087-.001-.679-3.452.843-3.893.161-.417-.644-1.663-.396-1.921-1.168-1.135 1.544-1.869 3.402-2.04 5.422.377.718.864 1.282 1.352 1.526.66.33 3.726 1.528 4.174.763.747-1.276 5.229-.373 5.122-1.044-.205-1.285 2.427-.23 3.373-1.886.482-.843 1.533-1.49 2.489-1.258 1.116.271 2.493-1.643 2.389-3.996-.871-1.057-1.951-1.931-3.164-2.589zm3.181 16.175c-.338.166-.671.293-.975.326-2.248.243-2.734 2.005-4.242 1.703-.777-.156-1.837 1.214-3.05 1.297-.611.042-1.489.141-2.386.308.768.175 1.565.277 2.386.277 3.331 0 6.305-1.523 8.267-3.911z\"/><path fill=\"#E85E00\" d=\"M23.225 8.674c.953.535 1.811 1.213 2.554 2.003 2.491-.157 4.01.429 3.883 1.777-.066.705-.585 1.542-1.431 2.435-2.108 2.221-6.309 4.796-11.07 6.602-3.309 1.255-6.258 1.9-8.366 1.934-2.145.035-3.418-.563-3.302-1.803.076-.815.752-1.806 1.852-2.857-.019-.255-.039-.507-.039-.765 0-.848.109-1.669.296-2.461C3.3 18.522.5 21.807.5 24.369c0 3.487 5.162 4.558 12.275 2.957 1.65-.371 3.405-.886 5.225-1.549 3.9-1.419 7.489-3.3 10.399-5.317 4.301-2.983 7.101-6.268 7.101-8.83 0-3.486-5.162-4.558-12.275-2.956z\"/><path fill=\"#F4900C\" d=\"M6.356 18.051c-.742.711-1.369 1.524-1.88 2.382-.49.852-.907 1.811-.844 2.671.035.856.682 1.366 1.558 1.602.874.227 1.845.287 2.834.229 1.962-.089 3.93-.415 5.841-.965 1.924-.505 3.791-1.225 5.615-2.036 3.648-1.628 7.068-3.789 10.132-6.382.368-.333.771-.649 1.124-.986.333-.337.647-.713.91-1.097.522-.768.826-1.667.335-2.352-.49-.696-1.495-1.075-2.453-1.271-.981-.187-2.01-.23-3.03-.111.992-.265 2.037-.395 3.088-.316 1.03.092 2.172.3 3.008 1.221.41.457.599 1.145.524 1.746-.057.611-.293 1.15-.563 1.635-.278.485-.59.925-.945 1.348-.352.404-.709.777-1.072 1.163-2.932 2.994-6.44 5.414-10.261 7.159-3.816 1.72-7.974 2.911-12.261 2.754-1.056-.04-2.157-.133-3.236-.548-.534-.209-1.082-.517-1.5-1.016-.429-.49-.635-1.171-.589-1.774.098-1.213.704-2.152 1.349-2.976.664-.819 1.447-1.525 2.316-2.08z\"/>","1f31f":"<path fill=\"#FFAC33\" d=\"M28.84 17.638c-.987 1.044-1.633 3.067-1.438 4.493l.892 6.441c.197 1.427-.701 2.087-1.996 1.469l-5.851-2.796c-1.295-.62-3.408-.611-4.7.018l-5.826 2.842c-1.291.629-2.193-.026-2.007-1.452l.843-6.449c.186-1.427-.475-3.444-1.47-4.481l-4.494-4.688c-.996-1.037-.655-2.102.755-2.365l6.37-1.188c1.41-.263 3.116-1.518 3.793-2.789L16.762.956c.675-1.271 1.789-1.274 2.473-.009L22.33 6.66c.686 1.265 2.4 2.507 3.814 2.758l6.378 1.141c1.412.252 1.761 1.314.774 2.359l-4.456 4.72z\"/><path fill=\"#FFD983\" d=\"M9.783 2.181c1.023 1.413 2.446 4.917 1.717 5.447-.728.531-3.607-1.91-4.63-3.323-1.022-1.413-.935-2.668-.131-3.254.804-.587 2.02-.282 3.044 1.13zm19.348 2.124C28.109 5.718 25.23 8.16 24.5 7.627c-.729-.53.695-4.033 1.719-5.445C27.242.768 28.457.463 29.262 1.051c.803.586.89 1.841-.131 3.254zM16.625 33.291c-.001-1.746.898-5.421 1.801-5.421.897 0 1.798 3.675 1.797 5.42 0 1.747-.804 2.712-1.8 2.71-.994.002-1.798-.962-1.798-2.709zm16.179-9.262c-1.655-.539-4.858-2.533-4.579-3.395.277-.858 4.037-.581 5.69-.041 1.655.54 2.321 1.605 2.013 2.556-.308.95-1.469 1.42-3.124.88zM2.083 20.594c1.655-.54 5.414-.817 5.694.044.276.857-2.928 2.854-4.581 3.392-1.654.54-2.818.07-3.123-.88-.308-.95.354-2.015 2.01-2.556z\"/>","1fa85":"<path fill=\"#77B255\" d=\"M8.083 26.837c-.842-.177-1.12.053-1.12.053s-.012.456-.343.644c-.33.188-1.008.522-1.026.965-.018.443-.248 1.233-.353 1.712-.105.479-.561 1.3-.561 1.3l.694.191.083.642-.496.806.555.346s.19.694.633.652.869-.608.869-.608l.442.684 1.034-.097s-.233-.675-.103-.73.678-.334.678-.334l-.017-3.925-.969-2.301z\"/><path fill=\"#E954D2\" d=\"M7.619 26.928l-.536.612.531 2.049-.259 1.874.25 1.079.752-.341.732 1.432s.856-.337.83-.398c-.026-.062-.827-1.416-.827-1.416l.548-.642-1.071-1.023.648-.829-1.08-1.165-.518-1.232z\"/><path fill=\"#3B88C3\" d=\"M7.083 27.54l.703.211.106 1.527-.262 1.682.301 1.928-.346 1.669s-.855-.026-.838-.106c.017-.08.419-1.434.419-1.434l-.128-1.759.045-3.718z\"/><path fill=\"#FFCC4D\" d=\"M7.44 27.414l-.417-.26-.705.999.19.693-.466 1.261.011 1.18-.445 1.614.311.618.665.058-.216-1.118.427-1.05-.163-1.116.875-1.505-.277-.778z\"/><path fill=\"#9266CC\" d=\"M21.658 28.8c-.787-.12-1.032.107-1.032.107s.012.422-.284.613c-.296.19-.905.534-.899.944.006.41-.127.755-.2 1.204-.072.448-.325.988-.325.988l.651.141-.728.861.254 1.135-.106 1.137s1.138.116 1.322-.252l.431-.861 1.366.074.301.624s.947-.403 1.065-.461-.52-3.134-.52-3.134l-.208-2.124-1.088-.996z\"/><path fill=\"#EA596E\" d=\"M21.233 28.908l-.463.593.595 1.866-.143 1.745.286.984.765.155.662.777s.598-1.123.571-1.178-.661-.498-.661-.498l-.066-.987-.502-.525.557-.799-.768-1.379-.833-.754z\"/><path fill=\"#55ACEE\" d=\"M21.471 29.528l-.609-.03-.193 1.426.478 1.709-.377 1.766.234 1.559s.806-.906.794-.98c-.012-.075-.342-1.262-.342-1.262l.505-2.629-.49-1.559z\"/><path fill=\"#FFCC4D\" d=\"M21.004 29.337l-.398-.219-.382.974-.594.698.22 1.106.071 1.089-.329 1.514.364 1.355.461-.935-.145-.866.605-1.08-.472-.935-.092-1.233.528-.907z\"/><path fill=\"#55ACEE\" d=\"M3.371 12.819c.787-.12 1.032.107 1.032.107s-.012.422.284.613c.296.19.905.534.899.944-.006.41.417.804.2 1.204-.057.104.329.654.329.654l-.386.594.55 1.5-.564.342.324 1.173s-.915-.317-1.322-.252c-.19.03-.606.149-.606.149l-1.191-.936-.301.624s-.947-.403-1.065-.461c-.069-.034.189-1.037.344-1.811.015-.074-.163-1.025-.163-1.025l.564-.52-.089-1.619.52-.297.641-.983z\"/><path fill=\"#EA596E\" d=\"M3.796 12.927l.463.593-.595 1.866.143 1.745-.287.984-.764.155-.662.777s-.598-1.123-.571-1.178c.027-.056.661-.498.661-.498l.066-.987.502-.525-.556-.799.768-1.379.832-.754z\"/><path fill=\"#F4900C\" d=\"M3.558 13.547l.609-.03.193 1.426-.478 1.71.377 1.766-.234 1.559s-.806-.906-.794-.98c.012-.075.342-1.262.342-1.262l-.505-2.629.49-1.56z\"/><path fill=\"#3B88C3\" d=\"M4.025 13.356l.398-.218.382.973.594.698-.22 1.106-.071 1.09.329 1.514-.364 1.355-.461-.936.145-.866-.605-1.08.472-.935.092-1.233-.528-.907z\"/><path fill=\"#EA596E\" d=\"M12.694 12.864c-1.129.089-8.049-.03-8.614 0-.564.03-.713.564-.297.891.416.327 7.752 4.248 8.079 4.515s.832-5.406.832-5.406z\"/><path fill=\"#77B255\" d=\"M21.1 10.785c.772-.386 8.347-4.574 8.881-4.812.535-.238 1.188-.208.832.594-.356.802-5.941 9.475-6.119 9.802-.178.327-2.257-2.05-2.554-2.762-.297-.713-1.04-2.822-1.04-2.822z\"/><path fill=\"#AA8DD8\" d=\"M16.065 22.889s4.233 6.193 4.545 6.728.936.579 1.114-.178c.178-.757 1.069-8.554 1.069-8.554l-6.728 2.004z\"/><path fill=\"#F4900C\" d=\"M11.937 18.879c.256-.077 1.931 1.455 2.525 1.842.594.386 2.317 1.455 2.554 1.842.238.386.743.416-.238.921s-8.436 4.04-9.03 4.396c-.594.356-.906-.059-.327-.936.646-.976 4.219-7.976 4.516-8.065z\"/><circle fill=\"#3E721D\" cx=\"18.037\" cy=\"16.128\" r=\"7\"/><path fill=\"#9266CC\" d=\"M13.704 15.419c-.41 2.805.064 5.162.954 6.839l.004.002c-.873-1.648-1.344-3.953-.972-6.695 2.821-.472 6.881-.409 10.083 2.26.328.274.572.558.78.847.308-.789.484-1.645.484-2.543 0-3.557-2.656-6.488-6.091-6.934-2.034.406-4.692 2.458-5.242 6.224z\"/><path fill=\"#3B88C3\" d=\"M23.773 17.825c-3.202-2.668-7.262-2.732-10.083-2.26-.372 2.741.098 5.047.972 6.695 1.001.553 2.151.869 3.376.869 2.968 0 5.498-1.85 6.516-4.457-.209-.289-.452-.574-.781-.847z\"/><path fill=\"#55ACEE\" d=\"M9.037 17.128s2.264-1.863 4.162-3.046c1.884-1.175 4.405-.891 5.673.95 1.248 1.812.505 4.396-.743 5.228-1.177.784-2.97 1.277-4.752.089-1.86-1.24-4.34-3.221-4.34-3.221z\"/><path fill=\"#E954D2\" d=\"M21.575 16.339c.982-.507 2.673-.119 3.475.653s5.376 6.356 6.208 7.099.297.861-1.069.475c-1.366-.386-7.99-1.337-8.584-1.485-.594-.149-1.416-.517-1.782-1.723-.505-1.662.832-4.543 1.752-5.019z\"/><path fill=\"#FFCC4D\" d=\"M16.258 11.468c1.634-.609 2.97-1.248 2.525-2.079-.446-.832-4.769-7.813-5.049-8.317-.446-.802-.965-.906-.965.342s.208 9.312.267 10.025c.059.712 2.075.457 3.222.029z\"/><path fill=\"#EA596E\" d=\"M30.113 5.236c.816-.37 1.142-.189 1.142-.189s.1.476.47.6 1.118.327 1.221.787c.103.46.487 1.238.685 1.718.198.48.816 1.241.816 1.241l-.665.352.04.691.656.736-.494.484s-.059.769-.514.822c-.455.053-.995-.448-.995-.448l-.315.814-1.062.124s.106-.759-.036-.788c-.142-.029-.749-.202-.749-.202l-.737-4.12.537-2.622z\"/><path fill=\"#FFCC4D\" d=\"M30.6 5.23l.658.525-.143 2.265.622 1.909-.045 1.186-.825-.193-.464 1.662s-.929-.166-.915-.236c.014-.07.563-1.666.563-1.666l-.677-.553.886-1.309-.814-.728.866-1.458.288-1.404z\"/><path fill=\"#77B255\" d=\"M31.258 5.755l-.669.375.186 1.624.589 1.707.066 2.088.669 1.674s.859-.215.826-.295-.699-1.412-.699-1.412l-.209-1.873-.759-3.888z\"/><path fill=\"#F4900C\" d=\"M30.874 5.701l.371-.363.903.892-.058.769.713 1.22.215 1.239.76 1.596-.196.716-.66.206.003-1.219-.633-1.008-.049-1.206-1.173-1.387.13-.876z\"/><path fill=\"#77B255\" d=\"M30.338 25.013l.92-.743 1.396.535.208 1.871 1.099 1.277-.148 2.05-.505 1.663-1.337.475-1.218-1.901-.712 1.01-.743-1.663.327-2.02.713-1.366z\"/><path fill=\"#E954D2\" d=\"M30.823 24.237l.742 1.129-.475 1.901.535 1.426-.238 2.97-.713.178.357-2.911-.595-1.425.476-2.139z\"/><path fill=\"#FFCC4D\" d=\"M30.753 25.339l-.644 1.959c-.026.08-.482.511-.484.595l.621 1.401-.266 2.402 1.107-.87.022-2.041-.612-1.261.503-1.493-.247-.692z\"/><path fill=\"#3E721D\" d=\"M31.989 25.458l.297 1.248.713 1.128-.476.802.684 2.377-.713.386-.624-2.941.386-1.01-.564-.802z\"/><path fill=\"#FFCC4D\" d=\"M10.574 17.433l-1.004-.692-1.521.498-.227 1.743-1.198 1.19.162 1.909.55 1.55 1.457.442 1.328-1.771.777.941.809-1.549-.356-1.882-.777-1.273z\"/><path fill=\"#EA596E\" d=\"M9.416 16.855l-.486.632c-.203.264-.268.609-.174.928l.263.899c.069.235.053.487-.046.711l-.323.734c-.071.162-.1.34-.083.516l.234 2.498.777.166-.343-2.395c-.03-.206.003-.417.095-.604l.339-.694c.109-.223.134-.478.072-.719l-.375-1.443c-.03-.117-.04-.238-.029-.358l.079-.871z\"/><path fill=\"#9266CC\" d=\"M9.637 17.882l.702 1.825c.029.074.525.476.527.554l-.676 1.305.289 2.238-1.207-.811-.024-1.901.667-1.175-.548-1.391.27-.644z\"/><path fill=\"#3B88C3\" d=\"M8.774 17.848l-.323 1.162-.777 1.051.518.747-.745 2.214.777.36.68-2.74-.421-.941.615-.747z\"/><path fill=\"#55ACEE\" d=\"M3.371 12.819c.787-.12 1.032.107 1.032.107s-.012.422.284.613c.296.19.905.534.899.944-.006.41.417.804.2 1.204-.057.104.329.654.329.654l-.386.594.55 1.5-.564.342.324 1.173s-.915-.317-1.322-.252c-.19.03-.606.149-.606.149l-1.191-.936-.301.624s-.947-.403-1.065-.461c-.069-.034.189-1.037.344-1.811.015-.074-.163-1.025-.163-1.025l.564-.52-.089-1.619.52-.297.641-.983z\"/><path fill=\"#EA596E\" d=\"M3.796 12.927l.463.593-.595 1.866.143 1.745-.287.984-.764.155-.662.777s-.598-1.123-.571-1.178c.027-.056.661-.498.661-.498l.066-.987.502-.525-.556-.799.768-1.379.832-.754z\"/><path fill=\"#F4900C\" d=\"M3.558 13.547l.609-.03.193 1.426-.478 1.71.377 1.766-.234 1.559s-.806-.906-.794-.98c.012-.075.342-1.262.342-1.262l-.505-2.629.49-1.56z\"/><path fill=\"#3B88C3\" d=\"M4.025 13.356l.398-.218.382.973.594.698-.22 1.106-.071 1.09.329 1.514-.364 1.355-.461-.936.145-.866-.605-1.08.472-.935.092-1.233-.528-.907z\"/><path fill=\"#FFCC4D\" d=\"M13.763.079c-.885-.129-1.161.114-1.161.114s.014.453-.319.657-1.018.572-1.011 1.012c.007.44-.469.863-.225 1.291.064.112-.371.701-.371.701l.434.637-.618 1.608.635.366-.365 1.258s1.029-.34 1.487-.271c.214.032.682.16.682.16l1.34-1.004.339.669s1.066-.432 1.198-.494c.078-.036-.213-1.112-.387-1.942-.017-.08.184-1.099.184-1.099l-.635-.557.1-1.736-.585-.319-.722-1.051z\"/><path fill=\"#AA8DD8\" d=\"M13.285.195l-.521.636.67 2-.161 1.871.322 1.055.86.166.744.834s.673-1.204.642-1.264c-.031-.06-.744-.534-.744-.534L15.022 3.9l-.564-.563.626-.857-.864-1.479-.935-.806z\"/><path fill=\"#EA596E\" d=\"M13.553.86l-.685-.032-.217 1.529.538 1.833-.424 1.894.263 1.672s.906-.971.893-1.051c-.014-.08-.384-1.354-.384-1.354l.568-2.819L13.553.86z\"/><path fill=\"#77B255\" d=\"M13.027.655l-.448-.234-.43 1.044-.668.748.248 1.186.08 1.168-.37 1.624.41 1.453.518-1.004-.163-.928.681-1.158-.532-1.003-.103-1.322.594-.972z\"/>","1f344":"<path fill=\"#99AAB5\" d=\"M27 33c0 2.209-1.791 3-4 3H13c-2.209 0-4-.791-4-3s3-7 3-13 12-6 12 0 3 10.791 3 13z\"/><path fill=\"#DD2E44\" d=\"M34.666 11.189l-.001-.002c-.96-2.357-2.404-4.453-4.208-6.182h-.003C27.222 1.904 22.839 0 18 0 13.638 0 9.639 1.541 6.524 4.115c-2.19 1.809-3.941 4.13-5.076 6.785C.518 13.075 0 15.473 0 18c0 2.209 1.791 4 4 4h28c2.209 0 4-1.791 4-4 0-2.417-.48-4.713-1.334-6.811z\"/><g fill=\"#F4ABBA\"><path d=\"M7.708 16.583c3.475 0 6.292-2.817 6.292-6.292S11.184 4 7.708 4c-.405 0-.8.042-1.184.115-2.19 1.809-3.941 4.13-5.076 6.785.306 3.189 2.991 5.683 6.26 5.683z\"/><path d=\"M7.708 4.25c3.331 0 6.041 2.71 6.041 6.042s-2.71 6.042-6.041 6.042c-3.107 0-5.678-2.314-6.006-5.394 1.097-2.541 2.8-4.817 4.931-6.59.364-.067.726-.1 1.075-.1m0-.25c-.405 0-.8.042-1.184.115-2.19 1.809-3.941 4.13-5.076 6.785.306 3.189 2.992 5.683 6.261 5.683 3.475 0 6.291-2.817 6.291-6.292S11.184 4 7.708 4zM26 9.5c0 2.485 2.015 4.5 4.5 4.5 1.887 0 3.497-1.164 4.166-2.811l-.001-.002c-.96-2.357-2.404-4.453-4.208-6.182C27.992 5.028 26 7.029 26 9.5z\"/><circle cx=\"21.5\" cy=\"16\" r=\"4.5\"/><circle cx=\"20\" cy=\"5\" r=\"3\"/></g>","1f5e1":"<path fill=\"#9AAAB4\" d=\"M23.378 19.029C22.67 19.736 16.305 31.757.75 36c1.414-1.415 19.54-21.691 19.54-21.691l3.088 4.72z\"/><path fill=\"#CCD6DD\" d=\"M17.72 13.371C17.013 14.078 4.992 20.444.75 36l21.213-21.214-4.243-1.415z\"/><path fill=\"#D99E82\" d=\"M20.549 11.957c-.781.781-.655 2.174.283 3.112l.848.849c.938.937 2.33 1.063 3.112.282l7.778-7.778c.781-.781.654-2.174-.283-3.111l-.848-.848c-.938-.938-2.331-1.064-3.111-.283l-7.779 7.777z\"/><path d=\"M28.892 12.1l-7.071-1.414-1.271 1.271c-.133.133-.23.288-.311.452l6.954 1.391 1.699-1.7zm-7.212 3.818c.938.938 2.331 1.063 3.112.282l.826-.826-5.328-1.065c.131.27.312.529.543.76l.847.849zm8.911-5.518l1.7-1.699-7.071-1.414-1.7 1.699zm2.423-3.793c-.107-.46-.346-.916-.727-1.297l-.848-.848c-.103-.103-.213-.192-.325-.275l-2.11-.422c-.252.084-.483.22-.676.414l-1.242 1.242 5.928 1.186z\" fill=\"#BF6952\"/><circle fill=\"#8A4633\" cx=\"31.858\" cy=\"4.896\" r=\"4\"/><path fill=\"#FFAC33\" d=\"M16.306 9.836c.586-.586 1.536-.586 2.121 0l8.839 8.839c.586.586.586 1.536 0 2.121-.586.586-1.535.586-2.121 0l-8.839-8.839c-.586-.584-.586-1.535 0-2.121z\"/><circle fill=\"#FFAC33\" cx=\"27.266\" cy=\"20.796\" r=\"2.5\"/><circle fill=\"#FFAC33\" cx=\"16.306\" cy=\"9.836\" r=\"2.5\"/><circle fill=\"#FFCC4D\" cx=\"27.266\" cy=\"20.796\" r=\"1.5\"/><circle fill=\"#FFCC4D\" cx=\"16.306\" cy=\"9.836\" r=\"1.5\"/><path fill=\"#FFAC33\" d=\"M26.566 3.803c.417-.417 1.093-.417 1.509 0l4.865 4.866c.417.417.417 1.092 0 1.509-.417.417-1.092.417-1.509 0l-4.865-4.866c-.417-.416-.417-1.092 0-1.509z\"/>","1f687":"<path fill=\"#292F33\" d=\"M36 18c0 9.941-8.059 18-18 18S0 27.941 0 18 8.059 0 18 0s18 8.059 18 18z\"/><path d=\"M8.896 33.509c.7.412 1.421.79 2.178 1.106L17.65 20h-1.419L8.896 33.509zM19.77 20h-1.42l6.577 14.615c.756-.316 1.478-.694 2.178-1.106L19.77 20z\" fill=\"#808285\"/><path fill=\"#58595B\" d=\"M12 26h2v2h-2zm10 0h2v2h-2z\"/><path fill=\"#A7A9AC\" d=\"M26 25c0 1.104-.896 2-2 2H12c-1.104 0-2-.896-2-2v-2c0-1.104.896-2 2-2h12c1.104 0 2 .896 2 2v2z\"/><path fill=\"#D1D3D4\" d=\"M24.363 6H11.636C9.628 6 8 7.628 8 9.636V23c0 1.104.896 2 2 2h16c1.104 0 2-.896 2-2V9.636C28 7.628 26.372 6 24.363 6z\"/><path fill=\"#DD2E44\" d=\"M8 19v4c0 1.104.896 2 2 2h16c1.104 0 2-.896 2-2v-8H8v4z\"/><path fill=\"#58595B\" d=\"M26 17c0 1.104-.896 2-2 2H12c-1.104 0-2-.896-2-2v-7c0-1.104.896-2 2-2h12c1.104 0 2 .896 2 2v7z\"/><path fill=\"#55ACEE\" d=\"M24 16c0 .552-.447 1-1 1H13c-.552 0-1-.448-1-1v-5c0-.552.448-1 1-1h10c.553 0 1 .448 1 1v5z\"/><path fill=\"#FFD983\" d=\"M10 21h4v2h-4zm12 0h4v2h-4z\"/><path fill=\"#808285\" d=\"M20 9c0 .552-.447 1-1 1h-2c-.552 0-1-.448-1-1s.448-1 1-1h2c.553 0 1 .448 1 1z\"/>","1f6f8":"<path fill=\"#FFD983\" d=\"M32.831 20.425c-.689 3.241-9.21 6.221-17.314 4.499S.841 17.013 1.53 13.772s8.587-3.287 16.69-1.564 15.3 4.976 14.611 8.217z\"/><path fill=\"#FFD983\" d=\"M27 36l-2-14-17-5-8 19z\"/><ellipse transform=\"rotate(-78 17.482 15.686)\" fill=\"#67757F\" cx=\"17.481\" cy=\"15.685\" rx=\"7.556\" ry=\"17\"/><path fill=\"#67757F\" d=\"M.414 10.977l.414 2.315 32.866 6.986 1.412-2.126z\"/><ellipse transform=\"rotate(-78 18.013 13.186)\" fill=\"#9AAAB4\" cx=\"18.012\" cy=\"13.186\" rx=\"8\" ry=\"18\"/><ellipse transform=\"rotate(-78 18.43 11.23)\" fill=\"#CCD6DD\" cx=\"18.428\" cy=\"11.229\" rx=\"6\" ry=\"15\"/><ellipse transform=\"rotate(-78 18.845 9.274)\" fill=\"#E1E8ED\" cx=\"18.844\" cy=\"9.273\" rx=\"3\" ry=\"9\"/><path fill=\"#5DADEC\" d=\"M10.041 7.402c.344-1.621 2.996-4.475 9.843-3.02s8.108 5.141 7.764 6.762c-.344 1.621-4.565 2.097-9.427 1.063s-8.525-3.184-8.18-4.805z\"/><circle fill=\"#8CCAF7\" cx=\"16.765\" cy=\"19.055\" r=\"1\"/><circle fill=\"#8CCAF7\" cx=\"24.798\" cy=\"19.74\" r=\"1\"/><circle fill=\"#8CCAF7\" cx=\"32.269\" cy=\"18.261\" r=\"1\"/><ellipse transform=\"rotate(-50.811 34.182 14.066)\" fill=\"#8CCAF7\" cx=\"34.183\" cy=\"14.067\" rx=\".5\" ry=\"1\"/><ellipse transform=\"rotate(-15.188 2.802 7.396)\" fill=\"#8CCAF7\" cx=\"2.802\" cy=\"7.397\" rx=\"1\" ry=\".5\"/><circle fill=\"#8CCAF7\" cx=\"2.924\" cy=\"12.023\" r=\"1\"/><circle fill=\"#8CCAF7\" cx=\"9.148\" cy=\"16.413\" r=\"1\"/><ellipse transform=\"rotate(-78 19.573 5.85)\" fill=\"#8CCAF7\" cx=\"19.572\" cy=\"5.85\" rx=\"1.5\" ry=\"5\"/>","1f69c":"<path fill=\"#CCD6DD\" d=\"M11 11h3v9h-3z\"/><path fill=\"#77B255\" d=\"M24 26.157C24 28.832 22.354 31 20.325 31H4.709c-2.029 0-3.488-1.565-3.258-3.494l.625-5.241c.23-1.93 1.992-3.808 3.928-4.199l14.628-3.21C22.496 14.413 24 16.219 24 18.893v7.264z\"/><path fill=\"#292F33\" d=\"M16.535 24.167C16.239 26.283 17.791 28 20 28h9c2.209 0 4-1.717 4-3.833V8.833C33 6.716 31.547 5 29.755 5h-7.303c-1.792 0-3.484 1.716-3.78 3.833l-2.137 15.334z\"/><path fill=\"#BBDDF5\" d=\"M18.245 25c-.135 1.104.65 2 1.755 2h9c1.104 0 2-.896 2-2V11c0-1.104-.743-2-1.66-2h-7.473c-.917 0-1.771.896-1.906 2l-1.716 14z\"/><path fill=\"#77B255\" d=\"M15 21h18v10H15z\"/><path fill=\"#FFCC4D\" d=\"M33 23H2l1-2h30z\"/><circle fill=\"#292F33\" cx=\"8\" cy=\"31\" r=\"4\"/><circle fill=\"#FFCC4D\" cx=\"8\" cy=\"31\" r=\"2\"/><path fill=\"#77B255\" d=\"M33 16v4l-10 9-7-1 3-10 3-2z\"/><path fill=\"#292F33\" d=\"M18.222 26.111c0-4.91 3.979-8.889 8.889-8.889 4.91 0 8.889 3.979 8.889 8.889C36 31.021 32.021 35 27.111 35c-4.91 0-8.889-3.979-8.889-8.889z\"/><path fill=\"#FFCC4D\" d=\"M32.667 26.111c0 3.068-2.487 5.556-5.556 5.556-3.068 0-5.556-2.487-5.556-5.556 0-3.068 2.487-5.556 5.556-5.556 3.069.001 5.556 2.488 5.556 5.556z\"/><path fill=\"#FFE8B6\" d=\"M30.444 26.111c0 1.841-1.492 3.333-3.333 3.333-1.842 0-3.334-1.492-3.334-3.333 0-1.842 1.492-3.334 3.334-3.334 1.841 0 3.333 1.493 3.333 3.334z\"/><path fill=\"#77B255\" d=\"M32.588 7c-.552-1.187-1.606-2-2.833-2h-7.303c-1.227 0-2.395.813-3.112 2h13.248z\"/><path fill=\"#F4900C\" d=\"M29.333 26.111c0 1.227-.995 2.222-2.222 2.222-1.227 0-2.223-.995-2.223-2.222 0-1.227.995-2.223 2.223-2.223 1.227.001 2.222.996 2.222 2.223z\"/><circle fill=\"#F4900C\" cx=\"8\" cy=\"31\" r=\"1\"/><path fill=\"#66757F\" d=\"M11 13h3v2h-3z\"/><path fill=\"#5C913B\" d=\"M16 28.75c-.094 0-.19-.013-.285-.041-.529-.157-.832-.714-.675-1.243l2-6.75C17.421 18.796 19.188 15 23 15h10c.553 0 1 .448 1 1s-.447 1-1 1H23c-3.144 0-4.011 4.154-4.02 4.196l-2.021 6.838c-.129.435-.527.716-.959.716z\"/><path fill=\"#3E721D\" d=\"M2.001 29c-.042 0-.083-.003-.125-.008-.548-.068-.937-.568-.868-1.116l1-8c.068-.549.569-.936 1.116-.868.548.068.937.568.868 1.116l-1 8c-.063.506-.494.876-.991.876z\"/>","1f4ff":"<path fill=\"#292F33\" d=\"M26.797 28.781c.484 1.109-.268 2.391.739 4.323 1.088 2.087 3.653 2.801 5.292 2.817 1.078.011 1.189-.447.759-.667-.681-.349-.598-.871-.598-.871s.464.429 1.308.663c.621.173 1.307.216 1.518-.379.182-.51-1.647-.142-2.491-1.954 1.092.494 1.692.224 2.146-.151.257-.213.453-.625.109-.5-.344.125-2.703.391-3.047-2.062 1.088 1.231 2.402 1.122 3.019.708.403-.271.503-.803.11-.621-1.422.656-2.051-.606-2.975-1.856-1.113-1.507-2.936-.996-3.686-1.324-.276-.122-2.203 1.874-2.203 1.874z\"/><path fill=\"#553788\" d=\"M10.087 6.851c.894.895.894 2.345 0 3.24-.895.895-2.345.895-3.24 0s-.895-2.345 0-3.24c.895-.894 2.346-.894 3.24 0z\"/><path fill=\"#553788\" d=\"M7.227 10.218c.895.894.895 2.345 0 3.24s-2.345.895-3.239 0c-.894-.895-.894-2.345 0-3.24s2.345-.895 3.239 0z\"/><path fill=\"#553788\" d=\"M5.051 14.064c.894.895.894 2.345 0 3.24-.895.894-2.345.894-3.24 0-.894-.895-.894-2.345 0-3.24.895-.894 2.345-.894 3.24 0z\"/><path fill=\"#553788\" d=\"M4.039 18.317c.894.895.894 2.344 0 3.24-.895.895-2.346.895-3.241 0-.895-.896-.895-2.345 0-3.24s2.346-.895 3.241 0z\"/><path fill=\"#553788\" d=\"M4.494 22.67c.895.895.895 2.346 0 3.239-.894.894-2.345.894-3.239 0-.895-.894-.895-2.344 0-3.239.894-.895 2.345-.895 3.239 0z\"/><path fill=\"#553788\" d=\"M6.848 26.289c.895.894.895 2.346 0 3.24-.895.894-2.344.894-3.24 0-.894-.895-.894-2.346 0-3.24.895-.894 2.345-.894 3.24 0z\"/><path fill=\"#553788\" d=\"M10.923 27.681c.894.896.894 2.346 0 3.24-.895.894-2.345.894-3.24 0-.894-.895-.894-2.345 0-3.24.895-.894 2.345-.894 3.24 0z\"/><path fill=\"#553788\" d=\"M15.327 28.288c.895.896.895 2.346 0 3.241-.895.893-2.345.893-3.24 0-.894-.896-.894-2.346 0-3.241.894-.893 2.345-.893 3.24 0z\"/><path fill=\"#553788\" d=\"M19.604 27.807c.896.896.896 2.346 0 3.241-.894.894-2.345.894-3.239 0-.895-.896-.895-2.346 0-3.241.893-.893 2.344-.893 3.239 0z\"/><path fill=\"#553788\" d=\"M23.806 26.34c.894.895.894 2.346 0 3.239-.895.895-2.346.895-3.24 0-.895-.894-.895-2.345 0-3.239.894-.896 2.345-.896 3.24 0zM10.214 7.231c.895.895 2.345.895 3.24 0 .894-.895.894-2.346 0-3.24-.894-.894-2.345-.894-3.24 0-.895.895-.895 2.346 0 3.24z\"/><path fill=\"#553788\" d=\"M14.061 5.055c.896.894 2.346.894 3.24 0 .894-.895.894-2.345 0-3.24-.895-.894-2.345-.894-3.24 0-.895.895-.895 2.345 0 3.24z\"/><path fill=\"#553788\" d=\"M18.313 4.042c.895.894 2.345.894 3.24 0 .895-.895.895-2.345 0-3.24s-2.345-.895-3.24 0c-.894.895-.894 2.345 0 3.24z\"/><path fill=\"#553788\" d=\"M22.666 4.498c.896.895 2.346.895 3.24 0 .894-.894.894-2.345 0-3.239-.895-.895-2.345-.895-3.24 0-.895.894-.895 2.345 0 3.239z\"/><path fill=\"#553788\" d=\"M26.286 6.851c.894.895 2.344.895 3.238 0 .896-.895.896-2.344 0-3.239-.895-.894-2.345-.894-3.238 0-.895.895-.895 2.345 0 3.239z\"/><path fill=\"#553788\" d=\"M27.677 10.926c.896.894 2.346.894 3.241 0 .892-.895.892-2.344 0-3.24-.896-.894-2.346-.894-3.241 0-.894.896-.894 2.346 0 3.24z\"/><path fill=\"#553788\" d=\"M28.285 15.33c.895.894 2.345.894 3.24 0 .893-.895.893-2.345 0-3.239-.896-.895-2.346-.895-3.24 0-.894.894-.894 2.345 0 3.239z\"/><path fill=\"#553788\" d=\"M27.804 19.607c.895.895 2.345.895 3.24 0 .894-.894.894-2.345 0-3.239-.896-.895-2.346-.895-3.24 0-.894.894-.894 2.345 0 3.239z\"/><path fill=\"#553788\" d=\"M26.336 23.81c.896.894 2.346.894 3.239 0 .895-.895.895-2.347 0-3.241-.894-.894-2.344-.894-3.239 0-.895.895-.895 2.346 0 3.241z\"/><path fill=\"#F4900C\" d=\"M28.153 24.583c-.993-.993-2.605-.993-3.599 0-.995.993-.995 2.605 0 3.599l2.398 1.2 2.4-2.4-1.199-2.399z\"/>"};

function resolveTraditionGlyphs(nodeId, byId) {
  let n = byId[nodeId]; if (!n) return { fn: null, second: null, secondKind: null };
  let r = n; while (r.parent) r = byId[r.parent];        // walk to root
  const fn = TRADITION_FUNCTION_GLYPH[r.id] || null;
  let c = n, second = null;
  while (c) { if (TRADITION_AXIS2_OVERRIDE[c.id]) { second = TRADITION_AXIS2_OVERRIDE[c.id]; break; } c = byId[c.parent]; }
  const secondKind = second && GLYPH_META[second] ? GLYPH_META[second].kind : null;
  return { fn, second, secondKind };
}


function glyphSvg(char, size = 20) {
  const cp = TRADITION_GLYPH_CP[char];
  const inner = cp ? TRADITION_GLYPH_SVGS[cp] : null;
  if (!inner) return '';
  return '<svg class="codex-glyph" width="' + size + '" height="' + size + '" viewBox="0 0 36 36" aria-hidden="true" focusable="false">' + inner + '</svg>';
}


const _TREE_GLYPH_BY_ID = Object.fromEntries(TREE_NODES.map(n => [n.id, n]));
function _treeNodeForTrad(tradId) {
  if (!tradId || tradId === '__ungrouped__') return null;
  if (_TREE_GLYPH_BY_ID[tradId]) return tradId;
  const ex = Catalog.ext(tradId);
  if (ex && ex.parent && _TREE_GLYPH_BY_ID[ex.parent]) return ex.parent;
  return null;
}
function traditionGlyphsHTML(tradId, size) {
  size = size || 15;
  const node = _treeNodeForTrad(tradId);
  if (!node) return '';
  const r = resolveTraditionGlyphs(node, _TREE_GLYPH_BY_ID);
  let out = '';
  if (r.fn)     out += '<span class="sb-trad-glyph is-fn" data-tooltip="' + esc((GLYPH_META[r.fn]||{}).label||'') + '">' + glyphSvg(r.fn, size) + '</span>';
  if (r.second) out += '<span class="sb-trad-glyph is-' + (r.secondKind||'region') + '" data-tooltip="' + esc((GLYPH_META[r.second]||{}).label||'') + '">' + glyphSvg(r.second, size) + '</span>';
  return out ? '<span class="sb-trad-glyphs" aria-hidden="true">' + out + '</span>' : '';
}


const Tradition = (id) => Catalog.get(id);
const Inst = (id) => _INST_BY_ID.get(id);
const Room = (id) => _ROOM_BY_ID.get(id);
const Tuning = (id) => _TUNING_BY_ID.get(id);
const ChainItem = (sectionId, id) => {
  const m = _CHAIN_ITEMS_BY_SECTION.get(sectionId);
  // Preserves original: null when section unknown, undefined when item missing,
  // the item object otherwise.
  return m ? m.get(id) : null;
};
const Variant = (instrument, partId, variantId) => {
  if (!instrument) return null;
  const partMap = _VARIANTS_BY_INST.get(instrument.id);
  if (!partMap) return null;
  const variantMap = partMap.get(partId);
  // Preserves original: null when part missing, undefined when variant missing.
  return variantMap ? variantMap.get(variantId) : null;
};
const FamName = (id) => _FAM_BY_ID.get(id)?.name || id;

// ---- App state ----
const app = {
  cards: [],
  pickerSearch: '',
  tradSearch: '',
  // Set of traditionIds whose group section is collapsed in the workspace.
  // Cards are grouped by traditionId when 2+ traditions are present; clicking
  // a group header toggles its membership in this set. Default empty = all
  // groups expanded.
  collapsedTraditionGroups: new Set(),
  // Undo/redo history — JSON snapshots of app.cards, one per coarse user
  // action (add tradition, add instrument, delete card, delete group, drag-
  // reorder). historyIndex points to the snapshot matching current state;
  // undo decrements + restores, redo increments + restores. Capped at
  // HISTORY_MAX entries.
  history: [],
  historyIndex: -1,
  // Transient state for drag-and-drop tradition reordering. Set during
  // dragstart on a group header, cleared on dragend/drop. Read by the
  // dragover handler on potential drop targets to know what's being dragged.
  _dragTraditionId: null,
  // Transient state for card-level drag (reorder within group / reparent
  // across groups / pin via drag-to-Pinned). Mirrors _dragTraditionId.
  _dragCardId: null,
  // Layout-refactor state (Phase 2+):
  // - selected: card.id of the currently-active card in the sidebar selection
  //   model. Phase 3 will use this to render the right-pane detail view.
  // - workspaceName: display name of the in-progress workspace (rename-able
  //   via the pencil icon in the sidebar header). Promoted to saved-name when
  //   user saves.
  // - sidebarFilter: live text filter narrowing sidebar cards by name/preface.
  selected: null,
  workspaceName: 'Untitled session',
  sidebarFilter: '',
  // Preface browse modal: live search text, set of collapsed category names,
  // and the card the modal is currently acting on.
  prefaceSearch: '',
  prefaceCollapsed: new Set(),
  prefaceCard: null
};
const HISTORY_MAX = 50;

// ---- ID ----
let _idc = 0;
const newId = (p) => (p || 'id') + '_' + (++_idc) + '_' + Date.now().toString(36).slice(-4);

// ============================================================
// TUNING_TO_VOICE_PARTS — cultural voice-variant lookup
// ============================================================
// Maps a tradition's tuning_id to a set of voice-part overrides that should
// apply when importing the tradition. This is the mechanism that fixes the
// "every tradition's voice reads as modern_pop_vocal_training" problem:
// when a user imports `persian_rowzehkhwani`, the voice card should pick up
// persian_dastgah_tradition + voice_pitch_persian_dastgah +
// voice_ornament_persian_tahrir, not the modern-pop defaults.
//
// Keys are tuning_ids; values are partial part-id → variant-id overrides.
// Anything not in this map falls back to defaultParts(instrument), which is
// appropriate for Western-12-TET commercial recording traditions.
//
// Per-tradition overrides via tradition.parts win against these tuning-derived
// defaults. The merge order in _voicePartsForTradition is:
//   defaultParts(instrument) → TUNING_TO_VOICE_PARTS[tuning] → tradition.parts
// ============================================================
const TUNING_TO_VOICE_PARTS = {
  'dastgah_persian': {
    voice_tradition: 'persian_dastgah_tradition',
    voice_pitch_organization: 'voice_pitch_persian_dastgah',
    voice_ornament_system: 'voice_ornament_persian_tahrir',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'maqam_24edo': {
    voice_tradition: 'arabic_maqam_tradition',
    voice_pitch_organization: 'voice_pitch_arab_24_quartertone',
    voice_ornament_system: 'voice_ornament_arab_maqam_mawwal',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'makam_turkish': {
    voice_tradition: 'arabic_maqam_tradition',
    voice_pitch_organization: 'voice_pitch_turkish_makam_53_comma',
    voice_ornament_system: 'voice_ornament_arab_maqam_mawwal',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'iraqi_maqam_jazil_baghdadi': {
    voice_tradition: 'arabic_maqam_tradition',
    voice_pitch_organization: 'voice_pitch_arab_24_quartertone',
    voice_ornament_system: 'voice_ornament_arab_maqam_mawwal',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'andalusi_nuba_eleven_mode_cycle': {
    voice_tradition: 'arabic_maqam_tradition',
    voice_pitch_organization: 'voice_pitch_arab_24_quartertone',
    voice_ornament_system: 'voice_ornament_arab_maqam_mawwal',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'shruti_22': {
    voice_tradition: 'hindustani_khyal_tradition',
    voice_pitch_organization: 'voice_pitch_carnatic_22_shruti',
    voice_ornament_system: 'voice_ornament_hindustani_meend_gamak',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'hindustani_thaat_alap_jod_jhala': {
    voice_tradition: 'hindustani_khyal_tradition',
    voice_pitch_organization: 'voice_pitch_carnatic_22_shruti',
    voice_ornament_system: 'voice_ornament_hindustani_meend_gamak',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'carnatic_72_melakarta_kriti_form': {
    voice_tradition: 'carnatic_classical_tradition',
    voice_pitch_organization: 'voice_pitch_carnatic_22_shruti',
    voice_ornament_system: 'voice_ornament_carnatic_gamaka',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'celtic_irish_modal_dorian_mixolydian': {
    voice_tradition: 'sean_nos_tradition',
    voice_ornament_system: 'voice_ornament_connemara_unaccompanied',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'flamenco_compas_12_beat': {
    voice_tradition: 'flamenco_jondo_tradition',
    voice_ornament_system: 'voice_ornament_flamenco_cante_jondo',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'klezmer_freygish_ahava_raba_modes': {
    voice_pitch_organization: 'voice_pitch_arab_24_quartertone',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'sephardi_chassidic_jewish_modal_modes': {
    voice_pitch_organization: 'voice_pitch_arab_24_quartertone',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'rebetiko_eastern_modal_dromos': {
    voice_tradition: 'mediterranean_demotic_tradition',
    voice_pitch_organization: 'voice_pitch_arab_24_quartertone',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'mediterranean_traditional_polyphonic_modal': {
    voice_tradition: 'mediterranean_demotic_tradition',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'balkan_odd_meter_aksak': {
    voice_tradition: 'mediterranean_demotic_tradition',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'byzantine_oktoechos_eight_modes': {
    voice_tradition: 'mediterranean_demotic_tradition',
    voice_speech_song: 'voice_ametrical_chant',
    voice_articulation: 'melisma_voice',
  },
  'pentatonic_china': {
    voice_tradition: 'chinese_classical_vocal_tradition',
    voice_pitch_organization: 'voice_pitch_tonal_language_constrained',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'chinese_pentatonic_gong': {
    voice_tradition: 'chinese_classical_vocal_tradition',
    voice_pitch_organization: 'voice_pitch_tonal_language_constrained',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'japanese_in_scale': {
    voice_tradition: 'japanese_min_yo_tradition',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'japanese_yo_scale': {
    voice_tradition: 'japanese_min_yo_tradition',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'gagaku_ryo_ritsu': {
    voice_tradition: 'japanese_min_yo_tradition',
    voice_speech_song: 'voice_ametrical_chant',
    voice_articulation: 'melisma_voice',
  },
  'korean_minsogak_modes': {
    voice_tradition: 'korean_minsogak_vocal_tradition',
    voice_ornament_system: 'voice_ornament_pansori_sigimsae',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'korean_jeongak_modes': {
    voice_tradition: 'korean_minsogak_vocal_tradition',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'yoruba_juju_fuji_polyrhythmic': {
    voice_tradition: 'yoruba_tonal_vocal_tradition',
    voice_ornament_system: 'voice_ornament_sub_saharan_polyphonic',
    voice_pitch_organization: 'voice_pitch_tonal_language_constrained',
  },
  'mande_pentatonic_jeli_modal': {
    voice_tradition: 'mande_jeli_vocal_tradition',
    voice_ornament_system: 'voice_ornament_sub_saharan_polyphonic',
  },
  'equal_heptatonic_west_african': {
    voice_tradition: 'mande_jeli_vocal_tradition',
    voice_ornament_system: 'voice_ornament_sub_saharan_polyphonic',
  },
  'slack_key_hawaiian': {
    voice_tradition: 'polynesian_oli_tradition',
    voice_ornament_system: 'voice_ornament_polynesian_falsetto',
  },
  'mongolian_pentatonic_long_song': {
    voice_tradition: 'khoomei_tuvan_tradition',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'mongolian_khoomei_harmonic': {
    voice_tradition: 'khoomei_tuvan_tradition',
    voice_pitch_organization: 'voice_pitch_drone_overtone_harmonic_series',
  },
  'tibetan_chant_multiphonic': {
    voice_pitch_organization: 'voice_pitch_drone_overtone_harmonic_series',
    voice_speech_song: 'voice_ametrical_chant',
  },
  'kignit_tezeta_major': {
    voice_speech_song: 'voice_melismatic_singing',
  },
  'kignit_tezeta_minor': {
    voice_speech_song: 'voice_melismatic_singing',
  },
  'kignit_bati_major': {
    voice_speech_song: 'voice_melismatic_singing',
  },
  'kignit_bati_minor': {
    voice_speech_song: 'voice_melismatic_singing',
  },
  'ethio_qenet_unified': {
    voice_pitch_organization: 'voice_pitch_ethiopian_qenet',
    voice_speech_song: 'voice_melismatic_singing',
  },
  'coptic_microtonal': {
    voice_pitch_organization: 'voice_pitch_arab_24_quartertone',
    voice_speech_song: 'voice_ametrical_chant',
    voice_articulation: 'melisma_voice',
  },
  'pelog_slendro_javanese': {
    voice_pitch_organization: 'voice_pitch_pelog_7',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'pelog_slendro_balinese': {
    voice_pitch_organization: 'voice_pitch_pelog_7',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'gamelan_slendro': {
    voice_pitch_organization: 'voice_pitch_slendro_5',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'gamelan_pelog': {
    voice_pitch_organization: 'voice_pitch_pelog_7',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'thai_seven_equal': {
    voice_pitch_organization: 'voice_pitch_thai_7_equal_step',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'equal_heptatonic_thai_khmer': {
    voice_pitch_organization: 'voice_pitch_thai_7_equal_step',
    voice_speech_song: 'voice_syllabic_singing',
  },
  'southeast_asian_pentatonic_popular_vocal': {
    voice_speech_song: 'voice_syllabic_singing',
  },
  'nordic_modal_drone_double_stops': {
    voice_speech_song: 'voice_syllabic_singing',
  },
  'sami_narrow_range_pentatonic': {
    voice_ornament_system: 'voice_ornament_sami_yoik',
    voice_speech_song: 'voice_non_lexical_vocable',
  },
  'lithuanian_sutartines_seconds': {
    voice_speech_song: 'voice_syllabic_singing',
  },
  'istrian_scale': {
    voice_speech_song: 'voice_syllabic_singing',
    voice_articulation: 'hocket_voice',
  },
  'huayno_2_4_andean': {
    voice_ornament_system: 'voice_ornament_andean_huayno',
  },
  'andean_colombian_bambuco_6_8': {
    voice_ornament_system: 'voice_ornament_andean_huayno',
  },
  'russian_minor_estrada_chanson': {
    voice_speech_song: 'voice_syllabic_singing',
  },
  'tuareg_pentatonic_raised4': {
    voice_pitch_organization: 'voice_pitch_arab_24_quartertone',
    voice_speech_song: 'voice_melismatic_singing',
  },
  'swahili_taarab_eastern_modal': {
    voice_pitch_organization: 'voice_pitch_arab_24_quartertone',
    voice_speech_song: 'voice_melismatic_singing',
    voice_articulation: 'melisma_voice',
  },
  'west_north_african_mbalax_rai_polyrhythmic': {
    voice_pitch_organization: 'voice_pitch_arab_24_quartertone',
    voice_speech_song: 'voice_melismatic_singing',
  },
};

// TRADITION_CHAIN_OVERRIDES — runtime stopgap hook for chain assignments.
//
// This map is empty by default. The data of record for a tradition's
// recording chain is the tradition row itself (chain_mic, chain_pre,
// chain_comp, chain_eq, chain_medium, chain_console, chain_fx,
// chain_amp / chain_amp_guitar / chain_amp_bass). When a value is set here,
// it wins over the tradition row for that field — but the migration
// completed in May 2026 moved 206 previously-authored entries into the
// tradition rows where they belong, so this map is now empty.
//
// Use this only as a temporary stopgap for testing a chain change without
// editing the tradition data. For permanent changes, edit the tradition row.
const TRADITION_CHAIN_OVERRIDES = {
};


const TRADITION_VOICE_OVERRIDES = {
  // Hindustani-Carnatic classical
  'khayal': { voice_tradition: 'hindustani_khyal_tradition', voice_speech_song: 'voice_melismatic_singing', voice_articulation: 'melisma_voice' },
  'dhrupad': { voice_tradition: 'hindustani_dhrupad_tradition', voice_speech_song: 'voice_melismatic_singing', voice_articulation: 'melisma_voice' },
  'thumri': { voice_tradition: 'hindustani_khyal_tradition', voice_speech_song: 'voice_melismatic_singing', voice_articulation: 'melisma_voice' },
  'tarana': { voice_tradition: 'hindustani_khyal_tradition', voice_speech_song: 'voice_melismatic_singing', voice_articulation: 'melisma_voice' },
  'carnatic_vocal': { voice_tradition: 'carnatic_classical_tradition', voice_speech_song: 'voice_melismatic_singing', voice_articulation: 'melisma_voice' },
  'javali': { voice_tradition: 'carnatic_classical_tradition', voice_speech_song: 'voice_melismatic_singing', voice_articulation: 'melisma_voice' },
  'bhajan': { voice_tradition: 'hindustani_khyal_tradition', voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'kirtan': { voice_tradition: 'hindustani_khyal_tradition', voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'qawwali': { voice_tradition: 'qawwali_tradition', voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'bengali_baul': { voice_tradition: 'hindustani_khyal_tradition', voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'hindi_filmi': { voice_tradition: 'hindustani_khyal_tradition', voice_articulation: 'melisma_voice' },
  // Persian / Arabic / Turkish
  'persian_dastgah': { voice_tradition: 'persian_dastgah_tradition', voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'turkish_makam': { voice_tradition: 'arabic_maqam_tradition', voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'taarab': { voice_tradition: 'arabic_maqam_tradition', voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'rai': { voice_tradition: 'arabic_maqam_tradition', voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'quranic_recitation_tajweed': { voice_tradition: 'arabic_maqam_tradition', voice_articulation: 'melisma_voice', voice_speech_song: 'voice_ametrical_chant' },
  'mozarabic_chant': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_ametrical_chant' },
  // East Asian classical / traditional
  'pansori': { voice_tradition: 'korean_minsogak_vocal_tradition', voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'korean_gagok': { voice_tradition: 'korean_minsogak_vocal_tradition', voice_articulation: 'legato_voice' },
  'korean_trot': { voice_tradition: 'korean_minsogak_vocal_tradition', voice_articulation: 'narrative_voice' },
  'shomyo_japanese': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_ametrical_chant' },
  'japanese_gidayu_bushi': { voice_tradition: 'japanese_min_yo_tradition', voice_articulation: 'narrative_voice', voice_speech_song: 'voice_recitative_free_rhythm' },
  'chinese_kunqu_opera': { voice_tradition: 'chinese_classical_vocal_tradition', voice_articulation: 'melisma_voice' },
  'jingju': { voice_tradition: 'chinese_classical_vocal_tradition', voice_articulation: 'melisma_voice' },
  'mandopop': { voice_tradition: 'chinese_classical_vocal_tradition' },
  'vietnamese_ca_tru': { voice_tradition: 'chinese_classical_vocal_tradition', voice_articulation: 'melisma_voice' },
  'vietnamese_quan_ho': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
  'vietnamese_hat_xoan': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
  'vietnamese_hat_cheo': { voice_articulation: 'narrative_voice' },
  'vietnamese_cai_luong': { voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'vietnamese_don_ca_tai_tu': { voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'vietnamese_traditional': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_syllabic_singing' },
  'thai_luk_thung': { voice_articulation: 'narrative_voice' },
  'thai_luk_krung': { voice_articulation: 'narrative_voice' },
  // Tibetan
  'tibetan_gyuto': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_ametrical_chant' },
  'tibetan_ache_lhamo': { voice_articulation: 'narrative_voice' },
  'tibetan_yang_chant': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_ametrical_chant' },
  // Sami / Tuvan / Mongolian
  'sami_yoik': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_recitative_free_rhythm' },
  'sami_northern_luohti': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_recitative_free_rhythm' },
  'sami_skolt_leudd': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_recitative_free_rhythm' },
  'sami_southern_vuelie': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_recitative_free_rhythm' },
  'tuvan_throat': { voice_tradition: 'khoomei_tuvan_tradition', voice_speech_song: 'voice_pure_vocalise' },
  'inuit_katajjaq_games': { voice_tradition: 'inuit_katajjaq_tradition', voice_articulation: 'hocket_voice', voice_speech_song: 'voice_non_lexical_vocable' },
  // Mediterranean polyphony
  'sardinian_polyphony': { voice_tradition: 'mediterranean_demotic_tradition', voice_articulation: 'call_response_voice' },
  'sardinian_cantu_a_tenore': { voice_tradition: 'mediterranean_demotic_tradition', voice_articulation: 'call_response_voice' },
  'corsican_paghjella': { voice_tradition: 'mediterranean_demotic_tradition', voice_articulation: 'call_response_voice' },
  'rebetiko': { voice_tradition: 'mediterranean_demotic_tradition', voice_articulation: 'melisma_voice' },
  // Iberian / Lusophone
  'fado': { voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  'fado_coimbra_university': { voice_articulation: 'narrative_voice' },
  // Sub-Saharan African
  'mbira_tradition': { voice_tradition: 'mande_jeli_vocal_tradition', voice_articulation: 'call_response_voice' },
  'sabar_drumming_wolof': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
  // Celtic / Welsh
  'welsh_hymn_balladry': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_syllabic_singing' },
  // Pacific
  'maori_waiata': { voice_tradition: 'polynesian_oli_tradition', voice_articulation: 'narrative_voice', voice_speech_song: 'voice_recitative_free_rhythm' },
  'maori_karanga_powhiri': { voice_tradition: 'polynesian_oli_tradition', voice_articulation: 'narrative_voice', voice_speech_song: 'voice_recitative_free_rhythm' },
  'maori_haka_taparahi': { voice_tradition: 'polynesian_oli_tradition', voice_articulation: 'shouted_voice' },
  'hawaiian_oli_mele': { voice_tradition: 'polynesian_oli_tradition', voice_articulation: 'narrative_voice', voice_speech_song: 'voice_recitative_free_rhythm' },
  // Latin American
  'mariachi': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_syllabic_singing' },
  'mariachi_traditional': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_syllabic_singing' },
  'ranchera': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_syllabic_singing' },
  'corrido': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_syllabic_singing' },
  'andean_huayno': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_syllabic_singing' },
  'son_jarocho': { voice_articulation: 'narrative_voice' },
  // Brazilian
  'samba': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
  'brazilian_samba_de_roda': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
  'forro_brasileiro': { voice_articulation: 'narrative_voice' },
  'forro_pe_de_serra': { voice_articulation: 'narrative_voice' },
  'baiao': { voice_articulation: 'narrative_voice' },
  'capoeira_music': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
  // Gospel
  'pentecostal_gospel': { voice_tradition: 'gospel_pentecostal_tradition' },
  'southern_gospel': { voice_tradition: 'gospel_pentecostal_tradition' },
  'black_gospel_choir': { voice_tradition: 'gospel_pentecostal_tradition' },
  'gospel_quartet_male': { voice_tradition: 'gospel_pentecostal_tradition' },
  'contemporary_urban_gospel': { voice_tradition: 'gospel_pentecostal_tradition' },
  'southern_gospel_quartet': { voice_tradition: 'gospel_pentecostal_tradition' },
  'bluegrass_gospel': { voice_tradition: 'gospel_pentecostal_tradition' },
  // Klezmer / Cantorial
  'cantorial_khazonus': { voice_articulation: 'melisma_voice', voice_speech_song: 'voice_melismatic_singing' },
  // Function-branch entries that fell through tuning→voice mapping
  'andean_matrimonio_huayno': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
  'andean_huayno_trabajo': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
  'andean_quechua_spinning': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_syllabic_singing' },
  'korean_minjung_gayo': { voice_tradition: 'korean_minsogak_vocal_tradition', voice_articulation: 'call_response_voice' },
  'korean_dongyo': { voice_tradition: 'korean_minsogak_vocal_tradition', voice_articulation: 'staccato_voice' },
  'vietnamese_nhac_phan_chien': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_syllabic_singing' },
  'vietnamese_ho': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
  'zulu_izibongo': { voice_tradition: 'yoruba_tonal_vocal_tradition', voice_articulation: 'narrative_voice', voice_speech_song: 'voice_heightened_speech' },
  'shona_mbira_praise': { voice_tradition: 'mande_jeli_vocal_tradition', voice_articulation: 'call_response_voice' },
  'tibetan_thodrol_lama_praise': { voice_articulation: 'narrative_voice', voice_speech_song: 'voice_ametrical_chant' },
  'mardi_gras_indians': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
  'brazilian_samba_school_enredo': { voice_articulation: 'call_response_voice', voice_speech_song: 'voice_syllabic_singing' },
};

// Returns voice-part overrides for a tradition based on its tuning, with
// any explicit tradition.parts taking precedence over the tuning-derived defaults.
function _voicePartsForTradition(trad) {
  if (!trad) return {};
  const out = {};
  const fromMap = (trad.tuning && TUNING_TO_VOICE_PARTS[trad.tuning]) || {};
  Object.assign(out, fromMap);
  const fromOverride = (trad.id && TRADITION_VOICE_OVERRIDES[trad.id]) || {};
  Object.assign(out, fromOverride);
  if (trad.parts) Object.assign(out, trad.parts);
  return out;
}

// ---- Card lifecycle ----
function defaultParts(instrument) {
  // For each part, select the variant marked `default: true`. If no variant
  // carries that marker, the part stays unselected — the UI will render '—'
  // and the user must explicitly choose. This avoids the misleading
  // "first-listed = canonical" framing the HTML viewer used previously.
  const out = {};
  instrument.parts.forEach(p => {
    if (!p.variants.length) return;
    const def = p.variants.find(v => v.default === true);
    if (def) out[p.id] = def.id;
  });
  return out;
}
function emptyChain() {
  return { fx: [], amp: null, mic: null, pre: null, comp: null, eq: null, medium: null, console: null };
}
function makeCard(instrumentId, opts) {
  const inst = Inst(instrumentId);
  if (!inst) return null;
  opts = opts || {};
  // parts resolution order:
  //   1. opts.parts (explicit full override) wins entirely if present
  //   2. otherwise: defaultParts(inst), then merge in opts.partsOverride
  //      filtered to part_ids that exist on this instrument and variant_ids
  //      that exist on that part. This lets importTradition supply cultural
  //      voice variants (e.g. persian_dastgah_tradition) without breaking
  //      cards for instruments that don't have those parts.
  let parts;
  if (opts.parts) {
    parts = opts.parts;
  } else {
    parts = defaultParts(inst);
    if (opts.partsOverride) {
      const partById = new Map(inst.parts.map(p => [p.id, p]));
      for (const [pid, vid] of Object.entries(opts.partsOverride)) {
        const part = partById.get(pid);
        if (!part) continue;
        if (part.variants.some(v => v.id === vid)) {
          parts[pid] = vid;
        }
      }
    }
  }
  const card = {
    id: newId('card'),
    instrumentId,
    parts,
    tuning: opts.tuning || null,
    room: opts.room || null,
    chain: opts.chain || emptyChain(),
    traditionId: opts.traditionId || null,
    editingPart: null,
    editingEnv: null,
    editingChainStage: null,
    drift: null,
    stackPanel: null,
    _materialsOpen: false
  };
  // Auto-suggest preface from the card's descriptor set. Explicit opts.preface
  // wins (including `null` for intentional blank) and disables auto-mode;
  // `undefined` triggers suggest and keeps auto-mode on so future part changes
  // re-derive the preface.
  if (opts.preface !== undefined) {
    card.preface = opts.preface;
    card.prefaceAuto = false;
  } else {
    card.preface = suggestPrefaceForCard(card);
    card.prefaceAuto = true;
  }
  return card;
}

// Card fields that are session-only and should not persist: UI state
// (which part / env / chain stage is currently being edited), the stack
// panel toggle, the drift-suggestions overlay. Saved workspaces strip
// these out before serializing; load/fork reapply the reset on every
// card read out of storage; dupCard zeroes them on the copy; pushHistory
// strips them when snapshotting for undo/redo (drift's apply closures don't
// survive JSON). Single source of truth so a new transient field added later
// picks up the reset semantics at all five sites by being added here once.
const _CARD_TRANSIENTS = { drift: null, stackPanel: null, editingPart: null, editingEnv: null, editingChainStage: null, _materialsOpen: false };

// UI timing constants. Centralized so cross-call relationships (CSS
// animation duration paired with the JS class-removal timeout, etc.)
// don't silently drift apart.
//   PREFACE_SHIFT — paint duration of the recipe-dedup ripple wash.
//     Must match the `animation: preface-shift 800ms ...` declaration
//     in the top-template CSS; the JS removes the class at the same
//     point the animation ends so the element snaps cleanly back.
//   MODAL_FOCUS_DELAY — wait for the modal to paint before focusing
//     its first input. Browsers won't accept focus on an element that's
//     still mid-transition; ~60 ms covers the common compositor delay.
//   TOAST_LIFETIME — how long a toast stays on screen before fading.
//     Long enough to read a short message at glance speed, short enough
//     that a rapid sequence of operations doesn't pile up toasts.
const UI_TIMING_MS = {
  PREFACE_SHIFT: 800,
  MODAL_FOCUS_DELAY: 60,
  TOAST_LIFETIME: 2200,
};

function addCard(instrumentId, opts) {
  const c = makeCard(instrumentId, opts);
  if (c) {
    app.cards.push(c);
    // skipHistory is set by importTradition so the batch of cards from one
    // tradition counts as a single undoable action. Direct callers (Add
    // Instrument modal, quick-pick, similar-instruments picker) leave the
    // flag unset so each manual add becomes its own history entry.
    if (!(opts && opts.skipHistory) && typeof pushHistory === 'function') pushHistory();
  }
  return c;
}
function dupCard(id) {
  const o = app.cards.find(c => c.id === id);
  if (!o) return;
  const i = app.cards.indexOf(o);
  const copy = {
    ...o,
    id: newId('card'),
    parts: { ...o.parts },
    chain: { ...o.chain, fx: [...(o.chain.fx || [])] },
    ..._CARD_TRANSIENTS,
  };
  app.cards.splice(i + 1, 0, copy);
  if (typeof pushHistory === 'function') pushHistory();
  return copy;
}
function rmCard(id, opts) {
  opts = opts || {};
  const skipHistory = !!opts.skipHistory;
  // skipHistory: bulk callers (tradition group delete) push history ONCE for
  // the batch, then call rmCard for each card with skipHistory: true. Without
  // this the batch would create one history entry per card — N undo-presses
  // to revert one logical action.
  app.cards = app.cards.filter(c => c.id !== id);
  if (!skipHistory && typeof pushHistory === 'function') pushHistory();
  renderAll();
}

function importTradition(tradId) {
  // SYNC by design (tandem's sandbox checks call it directly): reads the full
  // row from the Catalog CACHE. Embedded mode pre-caches everything; in lazy
  // mode every UI entry point awaits Catalog.ensureFull(tradId) first.
  const trad = Catalog.fullSync(tradId);
  if (!trad) return [];
  // Quality-of-life: collapse all OTHER tradition groups already in the workspace
  // so the just-added tradition is the only one expanded. The user is almost
  // always about to work on the new addition; existing groups become reference.
  // Skip self in case the user is re-importing — its group state stays as-is.
  for (const card of app.cards) {
    if (card.traditionId && card.traditionId !== tradId) {
      app.collapsedTraditionGroups.add(card.traditionId);
    }
  }
  // Derive part overrides from the tradition's tuning (via TUNING_TO_VOICE_PARTS)
  // and any explicit trad.parts — this is what fixes the "every imported
  // tradition reads as modern_pop_vocal_training" problem.
  const partsOverride = _voicePartsForTradition(trad);
  // Resolve the recording chain for this tradition. The data of record is
  // the tradition row itself (chain_mic, chain_pre, chain_comp, chain_eq,
  // chain_medium, chain_console, chain_fx, chain_amp / chain_amp_guitar /
  // chain_amp_bass on the tradition).
  //
  // TRADITION_CHAIN_OVERRIDES survives as a runtime stopgap hook — empty by
  // default. Anything you put in here wins over the tradition row, useful
  // only when you need to test a chain change without editing the tradition
  // data. In normal operation it does nothing.
  const chainOverride = (typeof TRADITION_CHAIN_OVERRIDES !== 'undefined' && TRADITION_CHAIN_OVERRIDES[tradId]) || {};
  const finalChain = {
    fx: Array.isArray(chainOverride.fx) ? chainOverride.fx.slice() : (Array.isArray(trad.chain_fx) ? trad.chain_fx.slice() : []),
    amp: null,
    mic: chainOverride.mic || trad.chain_mic || null,
    pre: chainOverride.pre || trad.chain_pre || null,
    comp: chainOverride.comp || trad.chain_comp || null,
    eq: chainOverride.eq || trad.chain_eq || null,
    medium: chainOverride.medium || trad.chain_medium || null,
    console: chainOverride.console || trad.chain_console || null,
  };
  const created = [];
  (trad.instruments || []).forEach((iid) => {
    // Compute the amp variant for this specific instrument. Candidate sources,
    // in precedence order: (1) chainOverride.amp_bass / amp_guitar / amp from
    // the stopgap map, (2) trad.chain_amp_bass / chain_amp_guitar /
    // chain_amp from the tradition row itself. Each candidate is tried
    // against the instrument's amp_make variants list; the first that's a
    // valid variant for this instrument wins. This is how bass-class
    // instruments get bass amps and guitar-class instruments get guitar amps
    // when a tradition specifies different canon amps for each.
    const inst = Inst(iid);
    const ampPart = inst ? (inst.parts || []).find(p => p.id === 'amp_make') : null;
    const ampValidIds = ampPart ? new Set(ampPart.variants.map(v => v.id)) : null;
    let ampVariant = null;
    if (ampValidIds) {
      const isBassClass = iid.includes('bass') || iid.includes('contrabass');
      const candidates = [];
      // Class-specific keys win first (override layer, then tradition data)
      if (isBassClass) {
        if (chainOverride.amp_bass) candidates.push(chainOverride.amp_bass);
        if (trad.chain_amp_bass) candidates.push(trad.chain_amp_bass);
      } else {
        if (chainOverride.amp_guitar) candidates.push(chainOverride.amp_guitar);
        if (trad.chain_amp_guitar) candidates.push(trad.chain_amp_guitar);
      }
      // Then the general amp key (override layer, then tradition data)
      const generalAmp = chainOverride.amp !== undefined ? chainOverride.amp : trad.chain_amp;
      if (Array.isArray(generalAmp)) candidates.push(...generalAmp);
      else if (typeof generalAmp === 'string') candidates.push(generalAmp);
      // Pick the first candidate that's actually in the instrument's amp_make variants
      ampVariant = candidates.find(a => ampValidIds.has(a)) || null;
    }
    const cardPartsOverride = ampVariant ? Object.assign({}, partsOverride, { amp_make: ampVariant }) : partsOverride;
    const c = addCard(iid, {
      traditionId: tradId,
      tuning: trad.tuning,
      room: trad.room,
      chain: finalChain,
      partsOverride: cardPartsOverride,
      skipHistory: true
    });
    if (c) created.push(c);
  });
  if (created.length > 0 && typeof pushHistory === 'function') pushHistory();
  return created;
}

// Import a tradition and give the standard feedback (toast + scroll-to-first).
// Shared by the traditions picker, the empty-state starter gallery, and the
// "Surprise me" button so all three behave identically.
async function importTraditionWithFeedback(tradId, opts) {
  opts = opts || {};
  const trad = Tradition(tradId);
  if (!trad) { showToast('Tradition not found', 'error'); return []; }
  // The one await on the import path: in lazy mode this fetches the
  // tradition's import payload (a few hundred bytes) the first time; embedded
  // mode and repeat imports resolve immediately.
  try { await Catalog.ensureFull(tradId); }
  catch { showToast('Could not load tradition data — check your connection', 'error'); return []; }
  const created = importTradition(tradId);
  if (opts.closeModalId) closeModal(opts.closeModalId);
  app.similarFor = null;
  renderAll();
  if (created.length === 0) {
    showToast(`"${trad.name}" has no recognised instruments`, 'error');
    return created;
  }
  const expected = (trad.instruments || []).length;
  showToast(created.length < expected
    ? `Imported ${created.length}/${expected} instruments from "${trad.name}"`
    : `Imported ${trad.name}`, 'success');
  setTimeout(() => {
    const elc = document.querySelector(`[data-card-id="${created[0].id}"]`);
    if (elc) elc.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
  return created;
}

// Drop a random, coherent tradition onto an empty (or any) workbench — a
// discovery on-ramp. Pools traditions carrying 2+ recognised instruments so the
// result is always a real multi-instrument recipe, and avoids repeating the
// immediately-previous pick.
function surpriseTradition() {
  const pool = Catalog.all().filter(t => (t.instruments || []).length >= 2);
  if (!pool.length) { showToast('No traditions available', 'error'); return; }
  let pick = pool[0];
  for (let i = 0; i < 8; i++) {
    pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick.id !== app._lastSurprise) break;
  }
  app._lastSurprise = pick.id;
  importTraditionWithFeedback(pick.id);
}

// ---- Drift: produce candidate moves; do not apply until walked ----
function buildDriftCandidates(card) {
  const inst = Inst(card.instrumentId);
  if (!inst) return [];
  const candidates = [];

  // One part swap per part (pick a single random alternate)
  inst.parts.forEach(part => {
    const alts = part.variants.filter(v => v.id !== card.parts[part.id]);
    if (alts.length === 0) return;
    const pick = alts[Math.floor(Math.random() * alts.length)];
    candidates.push({
      kind: 'part',
      axis: part.name,
      label: pick.name,
      descriptors: entryRenderDescs(pick),
      apply: () => { card.parts[part.id] = pick.id; }
    });
  });

  // Tuning
  {
    const alts = TUNINGS.filter(t => t.id !== card.tuning);
    if (alts.length) {
      const pick = alts[Math.floor(Math.random() * alts.length)];
      candidates.push({
        kind: 'tuning',
        axis: 'Tuning',
        label: pick.name,
        descriptors: entryRenderDescs(pick),
        apply: () => { card.tuning = pick.id; }
      });
    }
  }

  // Room
  {
    const alts = ROOMS.filter(r => r.id !== card.room);
    if (alts.length) {
      const pick = alts[Math.floor(Math.random() * alts.length)];
      candidates.push({
        kind: 'room',
        axis: 'Room',
        label: pick.name,
        descriptors: entryRenderDescs(pick),
        apply: () => { card.room = pick.id; }
      });
    }
  }

  // Chain stages
  CHAIN_SECTIONS.forEach(sec => {
    if (sec.multiSelect) {
      const cur = card.chain[sec.id] || [];
      const pick = sec.items[Math.floor(Math.random() * sec.items.length)];
      const adding = !cur.includes(pick.id);
      candidates.push({
        kind: 'chain',
        axis: sec.name,
        label: (adding ? 'add: ' : 'remove: ') + pick.name,
        descriptors: entryRenderDescs(pick),
        apply: () => {
          const c = card.chain[sec.id] || [];
          card.chain[sec.id] = adding ? [...c, pick.id] : c.filter(x => x !== pick.id);
        }
      });
    } else {
      const alts = sec.items.filter(it => it.id !== card.chain[sec.id]);
      if (alts.length === 0) return;
      const pick = alts[Math.floor(Math.random() * alts.length)];
      candidates.push({
        kind: 'chain',
        axis: sec.name,
        label: pick.name,
        descriptors: entryRenderDescs(pick),
        apply: () => { card.chain[sec.id] = pick.id; }
      });
    }
  });

  // Shuffle and take 5
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, 5);
}

// ---- Surface-rendering hygiene ----
// Per-card descriptor merging across instrument parts, tradition staples, and
// canonical_tags routinely emits duplicate tokens in the same row. Collapse
// them case-insensitively at the catalog→render boundary so every downstream
// renderer (per-card prose, merged tag cloud, T0/T1 classifier, env line)
// receives surface-clean arrays.
//
// Historical: pre-refactor, this helper also stripped a "-canonical" suffix
// off descriptor strings and dropped bare 'canonical' tokens. The data layer
// refactor (canonical-suffix descriptors → canonical_tags field; bare
// 'canonical' dropped from data entirely) made those passes no-ops. Kept as
// defensive guards in case legacy data ever slips through; primary purpose
// of this helper is now the dedup.
const DESCRIPTOR_FILLERS = new Set([
  'canonical', 'standard', 'default', 'unmarked', 'normal', 'plain', 'none', 'minimal',
]);
function cleanDescriptors(descs) {
  const out = [];
  const seen = new Set();
  for (const raw of (descs || [])) {
    if (raw == null) continue;
    const stripped = String(raw).replace(/-canonical$/, '');
    if (!stripped) continue;
    if (DESCRIPTOR_FILLERS.has(stripped.toLowerCase())) continue;
    const key = stripped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(stripped);
  }
  return out;
}

// Render only entry.descriptors. canonical_tags are scoring-only structural
// metadata (consumed by score.js and nearest_neighbor.js for variant matching);
// they were previously merged here for display, but the resulting genre-tag
// listings ('pop rock jazz r&b...') in every recipe row distracted from the
// tradition name shown at the header. Scoring is unaffected — those code
// paths read variant.canonical_tags directly, not via this helper.
function entryRenderDescs(entry) {
  if (!entry) return [];
  return cleanDescriptors(entry.descriptors || []);
}

// ---- Stack compilation (on demand) ----
function buildStackParts(card) {
  const inst = Inst(card.instrumentId);
  if (!inst) return [];
  const out = [];
  const all = [];
  inst.parts.forEach(part => {
    const v = Variant(inst, part.id, card.parts[part.id]);
    if (!v) return;
    all.push(...(v.descriptors || []));
    // canonical_tags intentionally omitted — see entryRenderDescs note
  });
  out.push({ kind: 'instrument', label: inst.short || inst.name, descriptors: cleanDescriptors(all) });
  if (card.tuning) {
    const t = Tuning(card.tuning);
    if (t) out.push({ kind: 'tuning', label: t.name, descriptors: entryRenderDescs(t) });
  }
  if (card.room) {
    const r = Room(card.room);
    if (r) out.push({ kind: 'room', label: r.name, descriptors: entryRenderDescs(r) });
  }
  CHAIN_SECTIONS.forEach(sec => {
    if (sec.multiSelect) {
      (card.chain[sec.id] || []).forEach(id => {
        const it = ChainItem(sec.id, id);
        if (it) out.push({ kind: sec.id, label: `${sec.name.toLowerCase()}: ${it.name}`, descriptors: entryRenderDescs(it) });
      });
    } else if (card.chain[sec.id]) {
      const it = ChainItem(sec.id, card.chain[sec.id]);
      if (it) out.push({ kind: sec.id, label: `${sec.name.toLowerCase()}: ${it.name}`, descriptors: entryRenderDescs(it) });
    }
  });
  return out;
}
function compileStack(card, format) {
  const parts = buildStackParts(card);
  if (parts.length === 0) return '';
  // Per-card preface threads into the instrument label across all formats,
  // matching the recipe-level renderers. The preface stays bound to the
  // instrument concept (`weeping voice: descriptors`) whether the user is
  // looking at the single-card stack or the multi-card recipe stack.
  const preface = _resolvePreface(card);
  const labelFor = (p) => (p.kind === 'instrument' && preface) ? `${preface} ${p.label}` : p.label;
  if (format === 'tags') {
    // Per-part chunking matches the recipe-level tags renderer
    // (compressTagsRecipe) — one chunk per source, tokens within a chunk
    // separated by spaces, chunks separated by commas, trailing period.
    // The chunk-per-source model preserves which descriptors come from the
    // instrument vs. tuning vs. room vs. each chain stage, which a flat
    // comma-joined set would erase. Tokens within each chunk pass through
    // _suppressSubsumed and _sortDescriptorsByPriority via _buildChunk so
    // compound tokens (phosphor-bronze) suppress their components (bronze)
    // and meaning-bearing tokens lead.
    const chunks = parts.map(p =>
      p.kind === 'instrument'
        ? _buildChunk(p.label, p.descriptors, preface)
        : _buildChunk(p.label, p.descriptors)
    ).filter(Boolean);
    return chunks.length ? chunks.join(', ') + '.' : '';
  }
  if (format === 'compact') {
    return parts.map(p => labelFor(p)).join(' · ');
  }
  if (format === 'rich') {
    // Rich at single-card: same per-source chunk model as tags, but with
    // descriptors deduped and priority-sorted, no trim. Tags shape extended
    // to the rich palette — the single-card mirror of the recipe-stack Rich
    // renderer's per-chunk output. Env labels kebab-cased to match Tags'
    // single-colon form ('microphone-pencil-condenser: descs', not
    // 'microphone: Pencil condenser: descs').
    const chunks = parts.map(p => {
      const descs = _sortDescriptorsByPriority(_suppressSubsumed(p.descriptors));
      const labelOut = p.kind === 'instrument' ? p.label : _kebab(p.label);
      const head = p.kind === 'instrument' && preface ? `${preface} ${labelOut}` : labelOut;
      return descs.length ? `${head}: ${descs.join(' ')}` : head;
    });
    return chunks.length ? chunks.join(', ') + '.' : '';
  }
  return parts.map(p => {
    if (p.kind === 'instrument') return `${labelFor(p)}: ${p.descriptors.join(', ')}`;
    if (p.descriptors.length) return `${p.label} (${p.descriptors.join(', ')})`;
    return p.label;
  }).join(' · ');
}

// ---- Recipe-level stack: aggregate all per-card stacks into one output ----
// Sums descriptors across every card on the canvas (instrument + tuning + room +
// chain for each), then formats into one of four views (prose / tags / rich /
// compact). Enforces a 1000-char ceiling via label-collapse compression for
// prose, single-tier drop for tags, and a defensive truncate for compact.
//
// This algorithm is duplicated in scripts/smoke.js section [5] (search for
// "compileRecipeStackNode"). The duplication is deliberate — smoke.js runs
// in Node before build_html and validates that the algorithm produces ≤1000
// chars for every catalog tradition × format. If the two implementations
// drift, the catalog-wide assertion catches it.
//
// Prose collapse model: exact-label merge first (Phase A), then trailing-
// token collapse with bare-token guard (Phase B). See compressProseRecipe
// for the full documentation of each phase.

function compressProseRecipe(cards, ceiling) {
  // Collapsed-prose render. Each card emits a chunk of the shape
  //   `<preface(s)> <instrument-label>`
  // where preface is the iconic prose-level word (kora-cascading, rustling,
  // two-stepping) and instrument-label is the variant identity. Material
  // descriptors (sitka-spruce, alder, alnico) are deliberately omitted — this
  // format is the iconic-descriptor view, not the part-internal view.
  //
  // Two collapse phases:
  //   Phase A — exact-label merge. Chunks with identical labels pool their
  //   prefaces; the label appears once. Eight `voice` cards become
  //   `<8 prefaces> voice`.
  //
  //   Phase B — trailing-token collapse. Among the remaining chunks, group
  //   by trailing hyphen-segment (the last `-`-delimited token of the label).
  //   Collapse a group iff size ≥ 2 AND no member's label is the bare
  //   trailing token. Members contribute `<prefaces> <inner-label>` pairs
  //   in source order; the trailing token appears once at the end.
  //
  // Bare-token guard: when both `choir` and `cogic-choir` are in the stack,
  // they stay separate — `cogic-choir` is a distinct catalog entry, not a
  // descriptor variant of `choir`. When only multi-segment variants exist
  // (`orchestra-model-acoustic-guitar`, `dreadnought-acoustic-guitar`,
  // `single-coil-solid-body-electric-guitar`, `parlor-acoustic-guitar`),
  // they collapse on trailing `guitar`.
  //
  // Env chunks (tuning, room, chain stages) emit bare labels — no preface,
  // no descriptors.
  //
  // Output: comma-joined chunks ending in a period, single line. The recipe
  // header (built upstream) supplies the tradition stack as a leading
  // comma-terminated chunk.

  // ---- Build raw chunks ----
  // Each card → one inst chunk with its preface (single descriptor source).
  // Env chunks from card[0] under the shared-env assumption (same as
  // compressTagsRecipe).
  const rawChunks = [];
  for (const card of cards) {
    const parts = buildStackParts(card);
    const inst = parts.find(p => p.kind === 'instrument');
    if (!inst) continue;
    const preface = _resolvePreface(card);
    rawChunks.push({
      kind: 'inst',
      label: _kebab(inst.label),
      preface: preface || null,
    });
  }
  if (cards.length > 0) {
    for (const p of buildStackParts(cards[0])) {
      if (p.kind === 'instrument') continue;
      let label = p.label;
      const colonIdx = label.indexOf(': ');
      if (colonIdx >= 0) label = label.slice(colonIdx + 2);
      rawChunks.push({
        kind: 'env',
        label: _kebab(label),
        preface: null,
      });
    }
  }

  // ---- Phase A: exact-label merge ----
  // Chunks with identical labels pool their prefaces. Source order preserved
  // by labelOrder; per-label prefaces deduped.
  const byLabel = new Map();
  const labelOrder = [];
  const labelKind = new Map();
  for (const c of rawChunks) {
    if (byLabel.has(c.label)) {
      const ex = byLabel.get(c.label);
      if (c.preface && !ex.prefaces.includes(c.preface)) ex.prefaces.push(c.preface);
    } else {
      byLabel.set(c.label, {
        kind: c.kind,
        label: c.label,
        prefaces: c.preface ? [c.preface] : [],
      });
      labelOrder.push(c.label);
      labelKind.set(c.label, c.kind);
    }
  }

  // ---- Phase B: trailing-token collapse ----
  // Group by trailing hyphen-segment. Collapse iff group.length ≥ 2 AND no
  // member's label is the bare trailing token.
  //
  // Final chunk shape:
  //   { kind, trailingLabel,
  //     parts: [ { prefaces: [...], innerLabel: string|null } ] }
  // Render: parts.flatMap(p => [...p.prefaces, p.innerLabel]).filter(Boolean).join(' ')
  //         + ' ' + trailingLabel
  const trailingGroups = new Map();
  for (const key of labelOrder) {
    const segs = key.split('-');
    const trailing = segs[segs.length - 1];
    if (!trailingGroups.has(trailing)) trailingGroups.set(trailing, []);
    trailingGroups.get(trailing).push(key);
  }
  const bareLabels = new Set(labelOrder);

  const finalChunks = [];
  const emitted = new Set();
  for (const key of labelOrder) {
    if (emitted.has(key)) continue;
    const c = byLabel.get(key);
    const segs = c.label.split('-');
    const trailing = segs[segs.length - 1];
    const group = trailingGroups.get(trailing);

    if (group.length >= 2 && !bareLabels.has(trailing)) {
      // Multi-member collapse
      const parts = [];
      let groupKind = 'inst';
      for (const groupKey of group) {
        const m = byLabel.get(groupKey);
        const memberSegs = m.label.split('-');
        const innerLabel = memberSegs.slice(0, -1).join('-') || null;
        parts.push({ prefaces: m.prefaces.slice(), innerLabel });
        if (labelKind.get(groupKey) === 'env') groupKind = 'env';
        emitted.add(groupKey);
      }
      finalChunks.push({ kind: groupKind, trailingLabel: trailing, parts });
    } else {
      // Single chunk — no inner-label decomposition (the chunk IS its label)
      emitted.add(key);
      finalChunks.push({
        kind: c.kind,
        trailingLabel: c.label,
        parts: [{ prefaces: c.prefaces.slice(), innerLabel: null }],
      });
    }
  }

  // ---- Render + trim cascade ----
  const renderChunk = (c) => {
    const tokens = [];
    for (const p of c.parts) {
      for (const pref of p.prefaces) tokens.push(pref);
      if (p.innerLabel) tokens.push(p.innerLabel);
    }
    return tokens.length > 0 ? `${tokens.join(' ')} ${c.trailingLabel}` : c.trailingLabel;
  };
  const renderAll = () => finalChunks.map(renderChunk).join(', ') + '.';

  let output = renderAll();
  if (output.length <= ceiling) return output;

  // Phase 1: drop trailing preface from the chunk-part with the most prefaces.
  // Round-robin equivalent — keeps every chunk-part with at least one preface
  // as long as possible (preserves source-tradition fingerprints).
  let guard = 5000;
  while (renderAll().length > ceiling && guard-- > 0) {
    let target = null; let targetLen = 1;
    for (const c of finalChunks) {
      for (const part of c.parts) {
        if (part.prefaces.length > targetLen) {
          target = part;
          targetLen = part.prefaces.length;
        }
      }
    }
    if (!target) break;
    target.prefaces.pop();
  }
  output = renderAll();
  if (output.length <= ceiling) return output;

  // Phase 2: drop env chunks from the end. Tuning/room/chain are auxiliary
  // in the collapsed view; per-instrument identity is the primary signal.
  while (renderAll().length > ceiling && finalChunks.some(c => c.kind === 'env')) {
    for (let i = finalChunks.length - 1; i >= 0; i--) {
      if (finalChunks[i].kind === 'env') { finalChunks.splice(i, 1); break; }
    }
  }
  output = renderAll();
  if (output.length <= ceiling) return output;

  // Phase 3: drop the trailing collapsed-member (innerLabel + its prefaces)
  // from multi-member instrument chunks before dropping the chunk entirely.
  while (renderAll().length > ceiling) {
    let popped = false;
    for (let i = finalChunks.length - 1; i >= 0; i--) {
      const c = finalChunks[i];
      if (c.kind === 'inst' && c.parts.length > 1) {
        c.parts.pop();
        popped = true;
        break;
      }
    }
    if (!popped) break;
  }
  output = renderAll();
  if (output.length <= ceiling) return output;

  // Phase 4: drop trailing instrument chunks with a hidden-count notice.
  const noticeFor = (n) => n > 0 ? ` [+${n} hidden]` : '';
  let droppedChunks = 0;
  while (finalChunks.length > 1 && (renderAll() + noticeFor(droppedChunks + 1)).length > ceiling) {
    finalChunks.pop();
    droppedChunks++;
  }
  output = renderAll() + noticeFor(droppedChunks);

  // Defensive truncate (safety net only).
  if (output.length > ceiling) {
    output = output.slice(0, ceiling - 16) + '… [truncated]';
  }
  return output;
}

// ---- Tags compression ----
//
// Output model: one comma-delimited claim per source-of-signal in the recipe.
// The downstream consumer (LLM prompt parser) treats commas and periods as
// the only concept separators — everything else (space, hyphen, colon, slash,
// bullet, exclamation, question) binds tokens into a single bound concept.
// That makes the editorial decision binary: tokens within one source bind
// (space-separated, hyphens preserved); separate sources separate (comma).
//
// Concretely, each card's instrument becomes one bundled claim
//   `voice: thick grounded saudade fado lament-wail melismatic ornate...`
// and each non-empty environment source (tuning / room / chain stage) becomes
// its own bundled claim. The parser sees N comma-separated concepts where N
// is the count of distinct signal sources in the recipe — not the alphabetized
// count of unique descriptor strings across all sources.
//
// Two cleanups happen inside each chunk:
//   (a) Dedup case-insensitively (already done at the catalog→render boundary
//       by entryRenderDescs; doing it again is cheap insurance).
//   (b) Substring/inclusion suppression — if token A's hyphen-segments are a
//       contiguous subsequence of token B's segments and A ≠ B, drop A. The
//       more specific token already implies the less specific.
//       Examples that fire:  folk / folk-revival  →  drop folk
//                            classic-blues / blues  →  drop blues
//                            mid-rich / low-mid-rich-spectrum  →  drop mid-rich
//       Counter-example that doesn't fire (different qualifiers, both kept):
//                            low-mid-rich-spectrum / low-mid-thick
//
// No cross-chunk dedup: each chunk is self-contained. A token repeated across
// chunks (e.g. `fingerpicked` on two stringed instruments) is the parser
// receiving two independent claims, which is the correct binding.
//
// Truncation: when over ceiling we trim per-chunk descriptor tails (shortest
// tokens first — they're usually the most generic). No `(+N more)` notice —
// that's meta-text that pollutes the parser's view; truncation is silent.

function _suppressSubsumed(tokens) {
  // O(n²·k) where n = tokens.length, k = max segments per token. n is small.
  // Defensively filter non-string entries before lowercasing — descriptor
  // arrays should never contain null/undefined but a single bad entry
  // would cascade as an uncaught TypeError across every card render.
  const clean = (tokens || []).filter(t => typeof t === 'string' && t.length > 0);
  const segs = clean.map(t => t.toLowerCase().split('-'));
  const drop = new Set();
  for (let i = 0; i < clean.length; i++) {
    if (drop.has(i)) continue;
    for (let j = 0; j < clean.length; j++) {
      if (i === j || drop.has(j) || segs[i].length >= segs[j].length) continue;
      const a = segs[i]; const b = segs[j]; const m = a.length;
      for (let p = 0; p + m <= b.length; p++) {
        let match = true;
        for (let k = 0; k < m; k++) { if (a[k] !== b[p+k]) { match = false; break; } }
        if (match) { drop.add(i); break; }
      }
      if (drop.has(i)) break;
    }
  }
  return clean.filter((_, i) => !drop.has(i));
}

// ===== Descriptor priority — tier + IDF ordering =====
// Replaces alphabetical sort inside descriptor chunks with a meaning-weighted
// order. Tokens that name a concrete physical reference (materials, named
// gear, specific eras) lead. Tokens that name an iconic acoustic feature
// come next. Categorical scaffolding (modern, traditional, classical) sinks.
// Subjective texture (foundational, virtuoso, deep) sinks furthest. Within
// a tier, rare tokens beat common tokens — a corpus-wide document frequency
// approximates token specificity without any per-card editorializing.
//
// The principle: position in the chunk is itself a signal to the consuming
// model. The first tokens in any line carry the most attention weight. By
// putting concrete physical reference up front and texture at the back,
// we align linguistic position with semantic density.

// Tier 1 — concrete physical references. Segment-matched: if any hyphenated
// segment of a token matches one of these substance/object/gear/era words,
// the token is tier 1. Lists are derived from a vocabulary audit; extend
// here when the corpus gains new materials or branded gear.
const _MATERIAL_SEGMENTS = new Set([
  // Woods
  'mahogany','spruce','cedar','maple','rosewood','walnut','oak','ash','alder',
  'basswood','koa','ebony','pine','fir','beech','willow','sycamore','poplar',
  'bamboo','teak','wood','tonewood','hardwood','softwood',
  'padauk','bubinga','wenge','cherry','sapele','paulownia','birch','cocobolo',
  'limba','korina',
  // Metals
  'nickel','brass','bronze','phosphor','copper','silver','gold','iron','tin',
  'steel','aluminum','aluminium','titanium','zinc','alnico','monel','tungsten',
  // Animal/organic
  'gut','sinew','horsehair','ivory','bone','horn','pearl','abalone','hide',
  'rawhide','calfskin','goatskin','sheepskin','snakeskin','leather','wool','cotton','silk',
  'flax','cane',
  // Synthetics
  'nylon','plastic','lucite','fiberglass','kevlar','synthetic','polymer','carbon',
  'acrylic','phenolic','mylar','ebonite','fluorocarbon',
  // Stone/mineral
  'clay','ceramic','alabaster','marble','slate','stone','tile','concrete','brick',
  'terracotta',
  // Earth/organic vessel
  'gourd',
  // Recording media as physical substrate
  'tape','vinyl','lacquer','shellac','wax',
]);
const _GEAR_SEGMENTS = new Set([
  'neumann','telefunken','akg','shure','royer','sennheiser','beyerdynamic','rca',
  'altec','sony','aiwa','tascam','portastudio','revox','studer','ampex','otari',
  'mci','neve','api','ssl','trident','helios','soundcraft','soundtracs','mackie',
  'tube-tech','manley','pultec','urei','dbx','fairchild','la-2a','la-3a','1176',
  'distressor','behringer','focusrite','rupert-neve','dda','daking','toft',
  'dangerous','rnd','sphere',
]);

// Tier 3 — categorical scaffolding. Taxonomic constraints the model needs
// (to rule out other traditions/registers/eras) but which don't name a
// specific sound. Enumerated explicitly because there's no clean pattern.
const _SCAFFOLD_TOKENS = new Set([
  'modern','traditional','classical','contemporary','vintage','standard',
  'regional','folk','popular','folk-tradition','sacred','secular','ceremonial',
  'concert','recital','accompaniment','lead','western','western-default',
  'eastern','equal-tempered','modern-music','classical-western','tonal',
  'monodic','polyphonic','art-music','vernacular',
]);

// Tier 4 — subjective texture. Words that describe a listener's experience
// of sound rather than a structural feature of the sound itself. Sink to
// the back of every chunk; they add flavor but should not crowd the
// referentially concrete tokens that the model actually needs.
const _TEXTURE_TOKENS = new Set([
  'foundational','virtuoso','versatile','consistent','expressive','grounded',
  'connected','meditative','deep','soulful','tender','intimate','powerful',
  'evocative','emotive','sincere','heartfelt','rhythmic','melodic','articulate',
  'lyrical','warm','dark','bright','smooth','harsh','clean','dirty','gritty',
  'sweet','mellow','rich','full','open','tight','loose','airy','dense',
]);

function _descriptorTier(token) {
  if (typeof token !== 'string') return 2;
  // Tier 1 — physical reference via segment match
  const segs = token.toLowerCase().split('-');
  for (const seg of segs) {
    if (_MATERIAL_SEGMENTS.has(seg) || _GEAR_SEGMENTS.has(seg)) return 1;
  }
  // Era markers — years and century references — also tier 1 (specific era
  // is a strong concrete anchor for the model)
  if (/(?:^|-)(?:18|19|20)\d{2}s?(?:-|$)/.test(token)) return 1;
  if (/^\d{2,4}s$/.test(token)) return 1;
  if (token.includes('century') || token.includes('-era-') || token.includes('mid-century')) return 1;
  // Tier 3 — scaffold via exact match
  if (_SCAFFOLD_TOKENS.has(token)) return 3;
  // Tier 4 — texture via exact match
  if (_TEXTURE_TOKENS.has(token)) return 4;
  // Default — iconic structural descriptor
  return 2;
}

// Document frequency table — populated lazily on first access. Counts each
// token's appearances across instrument variants, tunings, rooms, and chain
// items. Rare tokens (df=1) lead within their tier; common tokens trail.
let _DESCRIPTOR_DF = null;
function _ensureDescriptorDF() {
  if (_DESCRIPTOR_DF !== null) return _DESCRIPTOR_DF;
  _DESCRIPTOR_DF = new Map();
  const bump = (d) => _DESCRIPTOR_DF.set(d, (_DESCRIPTOR_DF.get(d) || 0) + 1);
  if (typeof INSTRUMENTS !== 'undefined') {
    for (const inst of INSTRUMENTS) {
      for (const part of (inst.parts || [])) {
        for (const v of (part.variants || [])) {
          if (v.expanded) continue; // universal cross-instrument materials don't shift corpus DF
          for (const d of (v.descriptors || [])) bump(d);
        }
      }
    }
  }
  if (typeof TUNINGS !== 'undefined') for (const t of TUNINGS) for (const d of (t.descriptors || [])) bump(d);
  if (typeof ROOMS !== 'undefined') for (const r of ROOMS) for (const d of (r.descriptors || [])) bump(d);
  if (typeof CHAIN_SECTIONS !== 'undefined') {
    for (const sec of CHAIN_SECTIONS) for (const it of (sec.items || [])) for (const d of (it.descriptors || [])) bump(d);
  }
  return _DESCRIPTOR_DF;
}

// Sort descriptors by (tier asc, df asc, alpha asc) — concrete reference
// first, rarer tokens first within tier, alpha as deterministic tiebreak.
// Used by every render path that emits a descriptor chunk. Replaces the
// previous alphabetical-only sort which gave equal weight to scaffolding,
// texture, and meaning-bearers regardless of their semantic density.
function _sortDescriptorsByPriority(descs) {
  const df = _ensureDescriptorDF();
  return (descs || []).slice().sort(function (a, b) {
    const ta = _descriptorTier(a);
    const tb = _descriptorTier(b);
    if (ta !== tb) return ta - tb;
    const da = df.get(a) || 999;
    const db = df.get(b) || 999;
    if (da !== db) return da - db;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
}

// Kebab-case a label for use as a bound leading token. Punctuation (spaces,
// slashes, parens, commas, periods) all normalize to hyphens; consecutive
// separators collapse; leading/trailing hyphens trim. Hyphens already in
// the source label are preserved.
function _kebab(label) {
  if (!label) return '';
  return String(label)
    .toLowerCase()
    .replace(/[\s/()[\]{},.;:]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ===== Icon library — Lucide stroke style =====
// 24×24 viewBox, 1.5px stroke, round caps + joins, currentColor stroke,
// Inline SVG icon system — no external font dependency, works in sandboxed
// iframes (Claude app, CSP-restricted contexts, offline). All glyphs are
// Icon source: references/08_asset_manifest.js, generated by
// scripts/build_assets.js from vendored Lucide SVGs in references/_assets/icons/.
// To add a new icon: edit scripts/fetch_icons.js → WANTED, then rerun
// `node scripts/fetch_icons.js && node scripts/build_assets.js`.
//
// icon('alert-circle') → ICON_ALIASES → 'circle-alert' → ICON_PATHS → rendered.
// Callers can use either codex-canonical names (alert-circle, trash, home) or
// modern Lucide slugs (circle-alert, trash-2, house) — the alias map covers both.
// Renders at default 16px, or icon(name, NN) for custom size.

// Library-extension overlay: a small set of family-level music glyphs that
// predate Lucide vendoring and aren't yet in lucide-static. Merged into the
// runtime ICONS lookup so existing callers keep resolving.
const ICON_PATHS_LOCAL = {
  'music':   '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  'music-2': '<circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/>',
  'music-3': '<path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/>',
  'library': '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
};

function icon(name, size = 16) {
  const resolved = ICON_ALIASES[name] || name;
  const paths = ICON_PATHS[resolved] || ICON_PATHS_LOCAL[resolved];
  if (!paths) return '';
  return `<svg class="icon-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

// Emoji lookup with family fallback. Storage is deduplicated: EMOJI_REGISTRY
// and FAMILY_FALLBACK_EMOJI store codepoint strings (~5 bytes each); the
// actual SVG content lives in EMOJI_SVGS keyed by codepoint, exactly once
// per unique blob. Saves ~530 KB vs inlining the SVG per registry entry.
//
// Resolution order:
//   1. EMOJI_REGISTRY[id] → codepoint → EMOJI_SVGS[codepoint] inner markup
//   2. FAMILY_FALLBACK_EMOJI[inst.family] → codepoint → EMOJI_SVGS[codepoint]
//   3. Empty string (last resort — caller's tinted square frame stays)
function image(id, size = 32) {
  if (typeof EMOJI_SVGS === 'undefined') return '';
  let cp = (typeof EMOJI_REGISTRY !== 'undefined') ? EMOJI_REGISTRY[id] : null;
  if (!cp && typeof FAMILY_FALLBACK_EMOJI !== 'undefined') {
    const inst = (typeof Inst === 'function') ? Inst(id) : null;
    if (inst && inst.family) cp = FAMILY_FALLBACK_EMOJI[inst.family] || null;
  }
  const inner = cp ? EMOJI_SVGS[cp] : null;
  if (!inner) return '';
  return `<svg class="codex-emoji" width="${size}" height="${size}" viewBox="0 0 36 36" aria-hidden="true" focusable="false" data-asset-id="${esc(id)}">${inner}</svg>`;
}

// Attribution modal renderer. Lists the libraries the codex uses, with
// per-library license + link. Static content (libraries are fixed at build time).
function renderAttributions() {
  const tbody = document.querySelector('#attributions-table tbody');
  if (!tbody) return;
  const rows = [
    { name: 'Lucide',  scope: 'UI icons (' + (typeof ICON_PATHS !== 'undefined' ? Object.keys(ICON_PATHS).length : 0) + ' in the codex)', license: 'ISC',     url: 'https://lucide.dev/' },
    { name: 'Twemoji', scope: 'Instrument emoji (' + (typeof EMOJI_REGISTRY !== 'undefined' ? Object.keys(EMOJI_REGISTRY).length : 0) + ' mapped)', license: 'CC-BY 4.0', url: 'https://github.com/jdecked/twemoji' },
  ];
  tbody.innerHTML = rows.map(r => `<tr style="border-bottom: 1px solid var(--surface-2);">
    <td style="padding: var(--s2) var(--s3); font-weight: var(--fw-medium);">${esc(r.name)}</td>
    <td style="padding: var(--s2) var(--s3); color: var(--text-2);">${esc(r.scope)}</td>
    <td style="padding: var(--s2) var(--s3); white-space: nowrap;">${esc(r.license)}</td>
    <td style="padding: var(--s2) var(--s3);"><a href="${esc(r.url)}" target="_blank" rel="noopener" style="color: var(--text-2);">source →</a></td>
  </tr>`).join('');
}

// Family-level visual identity via color, not icons. The codex has 11
// instrument families across 421 instruments; no UI icon library (Lucide,
// Heroicons, Tabler, etc.) has more than ~5 real instrument glyphs, and
// substituting noteheads for "violin" or "drum" misrepresents the family.
// Color works better here: 11 distinct hues actually differentiate, where
// 5-6 icons-with-overlaps don't. Hues chosen for muted distinctness on
// the codex's near-white surface; each family gets a swatch dot (rendered
// via ::before on .card-sig-family) plus tinted family-name text.
//
// If we ever obtain a coherent multi-instrument icon set (Material Design
// Icons Community has violin/drum/accordion/sax/etc. in line style; download
// SVGs and they slot into ICONS), the call site to swap in icons-instead-
// of-or-alongside dots is here. Until then, dots tell the truth.
const FAMILY_COLORS = {
  acoustic_strings:    '#a87c4f', // warm tan — wood
  electric_strings:    '#c8504a', // sharp red — electric
  plucked_traditional: '#7269b8', // indigo — exotic
  bowed:               '#5a8a5a', // forest green — formal
  wind:                '#c98442', // burnt orange — brass
  free_reed:           '#8c4a6e', // maroon — accordion register
  percussion:          '#a87a2c', // deep gold — wood/skin
  keyboard:            '#5a7a96', // cool slate
  electronic:          '#3a9aa6', // cyan — tech
  voice:               '#b85a72', // rose — vocal warmth
  ensemble:            '#7a7a7a', // neutral gray — catch-all
};

// Render an empty-state inside a modal body — icon-above-caption composition.
// Used in place of plain "No matches" / "No saved" text strings throughout
// the modals so empty states read as part of the same visual language as
// the empty workspace.
function renderEmptyModalState(message, iconName = 'search') {
  return `
    <div class="modal-empty">
      ${icon(iconName, 32)}
      <p>${esc(message)}</p>
    </div>
  `;
}

function _buildChunk(label, descs, preface) {
  const clean = _sortDescriptorsByPriority(_suppressSubsumed(descs));
  const head = preface ? `${preface} ${_kebab(label)}` : _kebab(label);
  if (clean.length === 0) return head;
  return `${head}: ${clean.join(' ')}`;
}

// Preface lookup + sanitization.
//
// A card's `preface` field is either a lexicon id ('weeping', 'face-melting',
// 'mono-no-aware') or a free-form string. Resolution rules:
//   1. Strip leading/trailing whitespace.
//   2. Strip commas and periods — these are the only characters the parser
//      treats as concept separators (per the chunk-per-source model). If a
//      user wrote 'weeping, mournful', the comma would fragment the chunk:
//      `weeping` would become its own claim and `mournful voice: descriptors`
//      another. Silently strip rather than corrupt the recipe shape.
//   3. Case-insensitive lookup against lexicon ids — `Weeping`, `weeping`,
//      and `WEEPING` all resolve to the canonical lowercase id.
//   4. Fallback to display-word match — typing `morriña` or `hózhó` (the
//      display form with diacritics) resolves to the entry even though the
//      ids are `morrina`/`hozho`.
//   5. If still no match, render as free-form (post-sanitization).
function _sanitizePreface(raw) {
  if (raw == null) return '';
  return String(raw).replace(/[,.]/g, '').trim();
}
// ===== Recipe-context preface deduplication =====
// When rendering a recipe (multiple instrument cards together), greedy-dedupe
// preface words across cards so the same word doesn't repeat. Each card's
// matcher returns a ranked survivor list; this picks the first survivor whose
// id hasn't been claimed by an earlier card in the recipe. User-set (non-auto)
// prefaces are respected and reserve their preface id against later cards.
//
// State is scoped via compileRecipeStack's try/finally — single-threaded JS
// makes this safe; the override map is set before render and restored after,
// so card.preface itself is never mutated.

let _RECIPE_PREFACE_OVERRIDES = null;

// Recipe-wide preface dedup applied to the visible card stack. Walks the
// current cards, computes collision-resolved preface ids, and writes each
// auto-mode card's preface back to its deduped value. Manual-override cards
// (prefaceAuto === false) are left untouched and their picks are respected
// by the dedup loop as locked claims. Safe to call before any render —
// idempotent across repeated calls when no card has changed.
//
// Tracks which cards' prefaces shifted from a prior non-null value to a new
// non-null value (excludes initial assignment where prior was null — those
// would noisily flash every card on first paint). Shifted cards get their
// `.card-sig-preface` element flashed in soft blue after the next paint
// frame, communicating that the dedup rule rippled to this card.
function _applyRecipeDedup() {
  if (!app || !app.cards || app.cards.length === 0) return [];
  const prior = new Map();
  for (const card of app.cards) {
    if (card) prior.set(card, card.preface);
  }
  const overrides = _computeRecipeDedupedPrefaces(app.cards);
  const shiftedCardIds = [];
  for (const card of app.cards) {
    if (!card || card.prefaceAuto === false) continue;
    if (!overrides.has(card)) continue;
    const next = overrides.get(card);
    const before = prior.get(card);
    if (before && next && next !== before) shiftedCardIds.push(card.id);
    card.preface = next;
  }
  if (shiftedCardIds.length === 0) return [];
  requestAnimationFrame(() => {
    for (const id of shiftedCardIds) {
      // Sidebar card row preface element (master-detail layout). The old
      // .card-sig-preface lived inside a per-card article in #cards; with
      // the sidebar each card now renders .sb-preface inside .sb-card-line1.
      const el = document.querySelector(`.sb-card[data-card-id="${id}"] .sb-preface`);
      if (el) {
        el.classList.add('preface-shifted');
        setTimeout(() => el.classList.remove('preface-shifted'), UI_TIMING_MS.PREFACE_SHIFT);
      }
    }
  });
  return shiftedCardIds;
}

// Recipe-stack header: the display names of every distinct tradition the
// cards came from, joined with ' + ' when more than one is stapled together,
// emitted as the first line(s) of any compiled recipe output. Cards added
// without a tradition (manual builds via the quick-add path or direct
// instrument browse) contribute nothing to the header — if no card in the
// recipe carries a traditionId, the header is empty and the recipe renders
// without a top label. Order preserved by first-appearance in the cards
// array so a fado + qawwali staple reads in the order it was imported.
function _recipeTraditionNames(cards) {
  const seen = new Set();
  const names = [];
  for (const card of (cards || [])) {
    if (!card || !card.traditionId) continue;
    if (seen.has(card.traditionId)) continue;
    seen.add(card.traditionId);
    const trad = Tradition(card.traditionId);
    if (trad && trad.name) names.push(trad.name);
  }
  return names;
}

function _recipeHeader(cards) {
  // Genre header: one or more tradition names joined by ` + ` and followed by
  // a comma and space. The trailing comma is the prompt-parser chunk separator
  // (parser treats `,` and `.` as chunk breaks; everything else folds into the
  // preceding chunk). The space-flanked ` + ` joiner reads as one chunk to the
  // parser because no comma or period appears between names — both traditions
  // belong to the same genre claim — while reading naturally to a human.
  //
  // Examples:
  //   single: "Outlaw country, ..."
  //   multi:  "Outlaw country + Hindustani classical, ..."
  //   none:   "" (cards without traditionId — no header)
  const names = _recipeTraditionNames(cards);
  if (names.length === 0) return '';
  return names.join(' + ') + ', ';
}

function _computeRecipeDedupedPrefaces(cards) {
  // v2 smart-dedup: each card claims top-score; collisions resolved by
  // keeping the highest-scoring card and reassigning losers to next-best.
  // Loops until stable.
  const overrides = new Map();
  const lockedIds = new Set();

  // First pass: lock manually-set prefaces
  for (const card of cards) {
    if (card && card.prefaceAuto === false && card.preface) lockedIds.add(card.preface);
  }

  // Per-card ranked lists
  const slots = [];
  for (const card of cards) {
    if (!card) continue;
    if (card.prefaceAuto === false) continue;
    const ranked = _matchSurvivors(card);
    ranked.sort(function(a, b) {
      if (a.score !== b.score) return b.score - a.score;
      if (a.shared !== b.shared) return b.shared - a.shared;
      return a.entry.id.localeCompare(b.entry.id);
    });
    let cursor = 0;
    while (cursor < ranked.length && lockedIds.has(ranked[cursor].entry.id)) cursor++;
    slots.push({ card: card, ranked: ranked, cursor: cursor, current: ranked[cursor] || null });
  }

  // Smart dedup loop
  for (let iter = 0; iter < 100; iter++) {
    const claimants = new Map();
    for (const s of slots) {
      if (!s.current) continue;
      const id = s.current.entry.id;
      if (!claimants.has(id)) claimants.set(id, []);
      claimants.get(id).push(s);
    }
    let collision = false;
    for (const group of claimants.values()) {
      if (group.length <= 1) continue;
      collision = true;
      group.sort(function(a, b) { return b.current.score - a.current.score; });
      for (let k = 1; k < group.length; k++) {
        const loser = group[k];
        loser.cursor++;
        while (loser.cursor < loser.ranked.length && lockedIds.has(loser.ranked[loser.cursor].entry.id)) loser.cursor++;
        loser.current = loser.ranked[loser.cursor] || null;
      }
    }
    if (!collision) break;
  }

  for (const s of slots) overrides.set(s.card, s.current ? s.current.entry.id : null);
  return overrides;
}

function _resolvePreface(card) {
  if (!card) return null;
  // Recipe-context override: if compileRecipeStack is rendering and computed a
  // deduped preface for this card, use that instead of the stored card.preface.
  if (_RECIPE_PREFACE_OVERRIDES && _RECIPE_PREFACE_OVERRIDES.has(card)) {
    const id = _RECIPE_PREFACE_OVERRIDES.get(card);
    if (!id) return null;
    if (typeof PREFACE_LEXICON !== 'undefined') {
      const entry = PREFACE_LEXICON.find(e => e.id === id);
      if (entry) return entry.id;
    }
    return id;
  }
  const sanitized = _sanitizePreface(card.preface);
  if (!sanitized) return null;
  if (typeof PREFACE_LEXICON !== 'undefined') {
    const lc = sanitized.toLowerCase();
    let entry = PREFACE_LEXICON.find(e => e.id.toLowerCase() === lc);
        if (entry) return entry.id;
  }
  return sanitized;
}

// ===== Preface auto-suggestion — habitat matcher =====
// Each preface declares its habitat: tradition families, instrument classes,
// hard descriptor predicates (mustHave/mustHaveAny/forbidden), and a soft
// register list. The matcher applies hard predicates first (filter), then
// ranks survivors by specificity then register-hit count. Deterministic:
// same card always produces the same preface.

// _cardDescriptorSet(card) is NOT defined here — it is the single source in
// scripts/_card_descriptors.js (the `harvestDescriptors` core + a browser
// adapter) and is INJECTED into codex.html by scripts/build_html.js, ahead of
// this app code, so the call sites below resolve it at runtime. This collapses
// the formerly hand-duplicated copy that drifted from the Node primitive.
// (Standalone-HTML note: the function only exists in the built artifact, not in
// this source file; run scripts/build_html.js to produce a runnable page.)

function _matchSurvivors(card) {
  // v2 matcher — precision-normalized scoring over preface.tokens.
  // Returns ranked list { entry, i, score, shared } in original-insertion order.
  // No gates, no filters; the renderer decides what to surface.
  const descSet = _cardDescriptorSet(card);
  if (descSet.size === 0) return [];

  const ranked = [];
  for (let i = 0; i < PREFACE_LEXICON.length; i++) {
    const entry = PREFACE_LEXICON[i];
    let tokens = entry.tokens;
    if (!Array.isArray(tokens) || tokens.length === 0) {
      // Backwards-compat fallback: derive from legacy habitat
      const h = entry.habitat || {};
      const seen = new Set();
      for (const t of (h.mustHave || [])) seen.add(t);
      for (const t of (h.mustHaveAny || [])) seen.add(t);
      for (const t of (h.register || [])) seen.add(t);
      tokens = Array.from(seen);
    }
    if (tokens.length === 0) continue;
    let shared = 0;
    for (const t of tokens) if (descSet.has(t)) shared++;
    if (shared === 0) continue;
    ranked.push({ entry: entry, i: i, score: shared / tokens.length, shared: shared });
  }
  return ranked;
}

// Single source of truth for "what to display for this card's assigned
// preface." card.preface is a string id today (e.g. 'eye-watering',
// 'kora-cascading'), but the renderer needs to defend against the legacy
// object-shape ({id: '...'}) in case an older saved workspace round-trips
// through load. Returns a display-ready string (hyphens replaced with
// spaces) or '' when no preface is assigned.
function prefaceLabelFor(card) {
  if (!card || !card.preface) return '';
  const raw = (typeof card.preface === 'object' && card.preface.id) || card.preface;
  if (typeof raw !== 'string') return '';
  return raw.replace(/-/g, ' ');
}

function suggestPrefaceForCard(card) {
  // v2 — picks the highest-score preface for the card. Score ties broken by
  // raw shared-token count (prefers more-specific cultural matches), then
  // alphabetically by id for determinism.
  const ranked = _matchSurvivors(card);
  if (ranked.length === 0) return null;
  ranked.sort(function(a, b) {
    if (a.score !== b.score) return b.score - a.score;
    if (a.shared !== b.shared) return b.shared - a.shared;
    return a.entry.id.localeCompare(b.entry.id);
  });
  return ranked[0].entry.id;
}

// Inverse of suggestPrefaceForCard: given a TARGET preface, find the
// customization (parts × variants + tuning + room + chain) that maximizes
// the target's token overlap with the card's descriptor set.
//
// The forward matcher (_matchSurvivors) scores a card against every preface;
// this function inverts it — fix the preface, search the customization
// space. The two share their scoring function: token overlap. Because the
// target tokens are fixed for the inverse, maximizing the score reduces to
// maximizing |TARGET ∩ D| where D is the card's descriptor set; everything
// else in the score function (denominator tokens.length) is constant.
//
// Search algorithm: coordinate-ascent over axes. Each axis (part-variant,
// tuning, room, mic, pre, medium, console) is one slot picking one option;
// from the current config, iteratively swap each axis to the option that
// most increases target hits given other axes fixed. Converges in a few
// passes for the typical instrument (~13 axes, ~150 total options across
// them). Local-optimum risk exists but is small in practice because target
// sets are short (9 tokens median) and axes contribute partially-disjoint
// tokens — the union grows fast and saturates quickly.
//
// Returns { targetId, changes: [{kind, axisLabel, fromLabel, toLabel}],
// apply: () => void }. The apply() function mutates the card to the new
// configuration AND sets card.preface = targetId with prefaceAuto = false
// (locks the label so the recipe-wide dedup loop respects it). Returns
// null if the target preface doesn't exist or the instrument is unknown.
//
// Caller is responsible for pushHistory() and rerenderCard(). Axes that
// don't change between current and chosen produce no entries in `changes`,
// so an "already-optimal" target returns changes:[] and apply() still sets
// the label without mutating other state.
function inverseConfigureForPreface(card, targetId, opts) {
  if (!card || !targetId) return null;
  // opts.pin: array of axis ids held FIXED during coordinate-ascent. Used when a
  // manual edit (picking a material) triggers the cascade — the touched part still
  // contributes its descriptors to the score but is never reshaped, so the user's
  // pick is preserved while the rest of the card moves toward the preface.
  const pinned = (opts && Array.isArray(opts.pin)) ? new Set(opts.pin) : null;
  const target = (typeof PREFACE_LEXICON !== 'undefined' ? PREFACE_LEXICON : []).find(p => p.id === targetId);
  if (!target || !Array.isArray(target.tokens) || target.tokens.length === 0) return null;
  const TARGET = new Set(target.tokens);
  const inst = Inst(card.instrumentId);
  if (!inst) return null;

  // Tradition signature is fixed (we don't change which tradition the card
  // belongs to in inverse search). Bake into the baseline so every score
  // includes its contribution without re-iterating.
  const baseline = new Set(_traditionSignatureFor(card.traditionId));

  // Build axis structure. Each axis: {kind, id, label, options[], current}.
  // options[]: {id, label, contrib (Set of descriptor tokens)}.
  const axes = [];

  // Parts — each part with 2+ variants is an axis. Single-variant parts
  // have no degrees of freedom so they're excluded from the search.
  for (const part of (inst.parts || [])) {
    const variants = part.variants || [];
    if (variants.length < 2) continue;
    // The universal cross-instrument materials are auto:false — the optimizer must
    // never AUTO-select a borrowed material (only a human picks one). Offer just the
    // curated variants as reshape targets, but KEEP the current pick even if it is a
    // borrowed material so the cascade preserves, rather than drops, an earlier choice.
    const curVid = (card.parts || {})[part.id];
    const choosable = variants.filter(function (v) { return !v.expanded || v.id === curVid; });
    axes.push({
      kind: 'part',
      id: part.id,
      label: part.name || part.id,
      options: choosable.map(function (v) {
        return { id: v.id, label: v.name || v.id, contrib: new Set(v.descriptors || []) };
      }),
      current: curVid,
    });
  }

  // Tuning — global option list. (Tradition's default tuning is in `current`.)
  axes.push({
    kind: 'tuning',
    id: '__tuning__',
    label: 'Tuning',
    options: TUNINGS.map(function (t) {
      return { id: t.id, label: t.name || t.id, contrib: new Set(t.descriptors || []) };
    }),
    current: card.tuning,
  });

  // Room — global option list.
  axes.push({
    kind: 'room',
    id: '__room__',
    label: 'Room',
    options: ROOMS.map(function (r) {
      return { id: r.id, label: r.name || r.id, contrib: new Set(r.descriptors || []) };
    }),
    current: card.room,
  });

  // Chain stages that contribute to the score: mic, pre, medium, console.
  // Other stages (amp, fx, comp, eq) exist but _cardDescriptorSet doesn't
  // pull from them, so changing them wouldn't move the score; we leave
  // them alone to respect the user's chain customization there.
  ['mic', 'pre', 'medium', 'console'].forEach(function (stageId) {
    const sec = CHAIN_SECTIONS.find(function (s) { return s.id === stageId; });
    if (!sec) return;
    const items = sec.items || [];
    if (items.length === 0) return;
    axes.push({
      kind: 'chain',
      id: stageId,
      label: 'Chain · ' + stageId,
      options: items.map(function (it) {
        return { id: it.id, label: it.name || it.id, contrib: new Set(it.descriptors || []) };
      }),
      current: (card.chain || {})[stageId] || null,
    });
  });

  // Helper: compute the descriptor set for a given chosen-by-axis mapping.
  function descriptorsFor(chosenMap) {
    const D = new Set(baseline);
    for (const ax of axes) {
      const pick = chosenMap[ax.id];
      if (!pick) continue;
      const opt = ax.options.find(function (o) { return o.id === pick; });
      if (opt) for (const t of opt.contrib) D.add(t);
    }
    return D;
  }
  function targetHits(D) {
    let n = 0;
    for (const t of TARGET) if (D.has(t)) n++;
    return n;
  }

  // Initialize from current card state.
  const chosen = {};
  for (const ax of axes) chosen[ax.id] = ax.current || null;
  let bestScore = targetHits(descriptorsFor(chosen));
  // Capture the pre-ascent score so callers can show "this swap took us
  // from 3/9 to 6/9 target tokens covered." Not used for any user-facing
  // surface yet but the data is essentially free here — discarding it
  // means redoing the computation if/when we want explainability UI.
  const startScore = bestScore;

  // Coordinate-ascent. For each axis in turn, find the option that gives
  // the highest target-overlap when other axes are held at their current
  // chosen values. Tie-breaking: keep the current pick (or the first option
  // alphabetically if current has no match), so the algorithm makes the
  // smallest config change for equivalent score.
  let changed = true;
  let iters = 0;
  while (changed && iters < 12) {
    changed = false;
    iters++;
    for (const ax of axes) {
      if (pinned && pinned.has(ax.id)) continue; // user-fixed axis — preserve the manual pick
      let bestId = chosen[ax.id];
      let bestForAxis = bestScore;
      for (const opt of ax.options) {
        if (opt.id === chosen[ax.id]) continue;
        const trial = Object.assign({}, chosen);
        trial[ax.id] = opt.id;
        const score = targetHits(descriptorsFor(trial));
        if (score > bestForAxis) {
          bestForAxis = score;
          bestId = opt.id;
        }
      }
      if (bestId !== chosen[ax.id]) {
        chosen[ax.id] = bestId;
        bestScore = bestForAxis;
        changed = true;
      }
    }
  }
  const finalScore = bestScore;

  // Per-axis counterfactual: descriptors that would be present if every
  // OTHER axis stayed at its post-ascent choice but THIS axis stayed at
  // its original current value. The difference between TARGET ∩ chosen
  // contributions and TARGET ∩ counterfactual reveals what this specific
  // swap brings to the final config. Used for per-change attribution in
  // explainability surfaces; computed lazily per change below.
  function counterfactualForAxis(skipAxisId) {
    const D = new Set(baseline);
    for (const ax of axes) {
      const pick = (ax.id === skipAxisId) ? ax.current : chosen[ax.id];
      if (!pick) continue;
      const opt = ax.options.find(function (o) { return o.id === pick; });
      if (opt) for (const t of opt.contrib) D.add(t);
    }
    return D;
  }

  // Build the change list — only axes whose chosen value differs from
  // current. fromLabel/toLabel use the human-readable name; null current
  // values (unset chain stages) render as "(none)". targetTokensAdded
  // lists the target tokens this specific axis swap uniquely contributes
  // (tokens in chosen-opt's contrib ∩ TARGET that aren't present in the
  // counterfactual where this axis hadn't swapped).
  const changes = [];
  for (const ax of axes) {
    if (chosen[ax.id] === ax.current) continue;
    const fromOpt = ax.options.find(function (o) { return o.id === ax.current; });
    const toOpt = ax.options.find(function (o) { return o.id === chosen[ax.id]; });
    const counterfactual = counterfactualForAxis(ax.id);
    const targetTokensAdded = [];
    if (toOpt) {
      for (const t of toOpt.contrib) {
        if (TARGET.has(t) && !counterfactual.has(t)) targetTokensAdded.push(t);
      }
    }
    changes.push({
      kind: ax.kind,
      axisLabel: ax.label,
      fromLabel: fromOpt ? fromOpt.label : (ax.current ? ax.current : '(none)'),
      toLabel: toOpt ? toOpt.label : (chosen[ax.id] ? chosen[ax.id] : '(none)'),
      targetTokensAdded: targetTokensAdded,
    });
  }

  function apply() {
    for (const ax of axes) {
      const pick = chosen[ax.id];
      if (ax.kind === 'part') {
        if (!card.parts) card.parts = {};
        card.parts[ax.id] = pick;
      } else if (ax.kind === 'tuning') {
        card.tuning = pick;
      } else if (ax.kind === 'room') {
        card.room = pick;
      } else if (ax.kind === 'chain') {
        if (!card.chain) card.chain = {};
        card.chain[ax.id] = pick;
      }
    }
    card.preface = targetId;
    card.prefaceAuto = false;
  }

  return {
    targetId: targetId,
    changes: changes,
    startScore: startScore,
    finalScore: finalScore,
    targetTokenCount: TARGET.size,
    apply: apply,
  };
}

// Reachability fan — for the card composer's preface section. Returns the
// top N prefaces ranked by current match score, marking which (if any) is
// the card's current preface. Reuses _matchSurvivors so the scoring stays
// in lockstep with the auto-suggest pipeline. Used to render an inline
// chip strip below the preface input — fast lateral navigation to nearby
// prefaces without opening the Browse modal.
function buildReachabilityFan(card, n) {
  if (n == null) n = 7;
  if (!card || typeof _matchSurvivors !== 'function') return [];
  const ranked = _matchSurvivors(card);
  if (ranked.length === 0) return [];
  ranked.sort(function (a, b) {
    if (a.score !== b.score) return b.score - a.score;
    return a.entry.id.localeCompare(b.entry.id);
  });
  const currentId = card.preface || null;
  return ranked.slice(0, n).map(function (r) {
    return {
      prefaceId: r.entry.id,
      isCurrent: r.entry.id === currentId,
    };
  });
}

function renderReachabilityFan(card, section) {
  const fan = buildReachabilityFan(card, 7);
  // Skip render when there's no meaningful choice — a fan with one entry
  // is just the current preface restated, no signal added.
  if (fan.length < 2) return;
  const wrap = document.createElement('div');
  wrap.className = 'preface-fan';
  wrap.innerHTML = fan.map(function (f) {
    return '<button type="button" class="chip preface-fan-chip' +
      (f.isCurrent ? ' selected is-current' : '') +
      '" data-fan-preface-id="' + esc(f.prefaceId) + '">' +
      esc(f.prefaceId) + '</button>';
  }).join('');
  wrap.querySelectorAll('[data-fan-preface-id]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      commitPrefaceChange(card, btn.dataset.fanPrefaceId);
    });
  });
  section.appendChild(wrap);
}

// Explainability panel for the most recent inverse run on a card. Reads
// from _recentShiftsByCard (populated by commitPrefaceChange) and renders
// each axis change with the specific target tokens that justified it. The
// data is per-axis marginal attribution (computed in inverseConfigureFor-
// Preface via the counterfactual technique), so each token shown is one
// that THIS axis change uniquely brought into the descriptor set — not
// tokens that any other axis change could have brought in.
//
// Persists until the user dismisses via × (clears the map entry) or until
// the next inverse run replaces it. Mounted below the reachability fan in
// the preface section so the inverse-driven changes appear in the same
// visual block as the picker that triggered them.
function renderShiftsPanel(card, section) {
  if (!_recentShiftsByCard.has(card.id)) return;
  const shifts = _recentShiftsByCard.get(card.id);
  if (!shifts || !shifts.changes || shifts.changes.length === 0) return;

  const panel = document.createElement('div');
  panel.className = 'preface-shifts-panel';

  const rows = shifts.changes.map(function (c) {
    const added = Array.isArray(c.targetTokensAdded) ? c.targetTokensAdded : [];
    let tokensHtml;
    if (added.length > 0) {
      tokensHtml = '<div class="preface-shifts-tokens">' +
        added.map(function (t) {
          return '<span class="preface-shifts-token">' + esc(t) + '</span>';
        }).join('') + '</div>';
    } else {
      // The swap improved overall coverage without adding a unique target
      // token — typically means it freed up another axis to make its own
      // unique contribution. Honest about not pretending it brought tokens
      // in directly. (Rare in practice; included for completeness.)
      tokensHtml = '<div class="preface-shifts-tokens-empty">enabled gains elsewhere — no unique target token from this axis</div>';
    }
    return '<li class="preface-shifts-row">' +
      '<div class="preface-shifts-axis">' +
        '<span class="preface-shifts-axis-label">' + esc(c.axisLabel) + '</span>: ' +
        '<span class="preface-shifts-from">' + esc(c.fromLabel) + '</span> → ' +
        '<strong>' + esc(c.toLabel) + '</strong>' +
      '</div>' + tokensHtml + '</li>';
  }).join('');

  panel.innerHTML =
    '<div class="preface-shifts-header">' +
      '<span class="preface-shifts-title">Why <strong>' + esc(shifts.targetId) + '</strong> reshaped this card</span>' +
      '<button type="button" class="preface-shifts-close" aria-label="Dismiss explanation">' + icon('x', 12) + '</button>' +
    '</div>' +
    '<ul class="preface-shifts-list">' + rows + '</ul>';

  panel.querySelector('.preface-shifts-close').addEventListener('click', function () {
    _recentShiftsByCard.delete(card.id);
    rerenderCard(card);
  });

  section.appendChild(panel);
}

// Session-only state: tracks the most recent inverse-induced shift per card.
// Populated by commitPrefaceChange when the inverse produces a change list;
// consumed by renderShiftsPanel to surface what reshaped and why. Keyed by
// card.id so the panel renders on the right card after re-render. Cleared
// via the panel's × dismiss button or replaced on the next inverse run.
// Map (not plain object) so we don't pollute the global namespace or
// accidentally serialize into save data.
const _recentShiftsByCard = new Map();

// Shared commit handler — invoked from every preface-change entry point
// (Browse modal pick, text input commit, reachability fan chip click).
// Routes through the inverse algorithm if the target is a known lexicon
// preface; falls back to setting just the label for free-form values that
// have no token signature. Pushes history for clean Ctrl+Z, rerenders the
// card, and toasts feedback proportional to the magnitude of change.
//
// Callers wanting modal-specific or input-specific behavior (closing a
// modal, sanitizing the input field) handle those concerns before calling
// here. This function only owns the inverse-apply-history-render-toast
// sequence common across all entry points.
function commitPrefaceChange(card, prefaceId) {
  if (!card || !prefaceId) return;
  const result = (typeof inverseConfigureForPreface === 'function')
    ? inverseConfigureForPreface(card, prefaceId)
    : null;
  if (result) {
    result.apply();
  } else {
    // Target not in lexicon (free-form word) — just set the label without
    // reshaping. The inverse can't run without a token signature.
    card.preface = prefaceId;
    card.prefaceAuto = false;
  }
  if (typeof pushHistory === 'function') pushHistory();
  // Capture explainability data for the shifts panel BEFORE rerenderCard —
  // the renderer reads from _recentShiftsByCard during the same render
  // call, so the data must be in place before the DOM rebuild.
  if (result && result.changes.length > 0) {
    _recentShiftsByCard.set(card.id, {
      targetId: prefaceId,
      changes: result.changes,
      startScore: result.startScore,
      finalScore: result.finalScore,
      targetTokenCount: result.targetTokenCount,
    });
  }
  rerenderCard(card);
  if (result && result.changes.length > 0) {
    const n = result.changes.length;
    showToast(`Configured for ${prefaceId} · ${n} ${n === 1 ? 'axis' : 'axes'} changed (Ctrl+Z to revert)`, 'success');
  } else {
    showToast(`Preface set to ${prefaceId}`, 'success');
  }
}

// A manual part edit (picking a material / variant) reshapes the REST of the card
// toward the preface the new sound implies — the same inverse cascade a preface
// pick runs — while PINNING the edited part so the user's choice is never reverted.
// In auto-preface mode the target is re-derived from the new descriptor set; if the
// user has locked a preface, the cascade reshapes toward that locked preface. The
// auto-applied changes are surfaced via the shifts panel + a toast, mirroring
// commitPrefaceChange. Caller owns pushHistory() and rerenderCard().
function reconfigureAfterPartEdit(card, editedPartId) {
  if (!card) return;
  const auto = card.prefaceAuto !== false;
  const target = auto
    ? (typeof suggestPrefaceForCard === 'function' ? suggestPrefaceForCard(card) : null)
    : card.preface;
  if (!target) return;
  const result = (typeof inverseConfigureForPreface === 'function')
    ? inverseConfigureForPreface(card, target, { pin: [editedPartId] })
    : null;
  if (!result) {
    // Free-form / no-token target (not in the lexicon): keep the re-derived label,
    // no reshape possible without a token signature.
    if (auto) card.preface = target;
    return;
  }
  result.apply(); // reshapes the other axes toward `target`; sets card.preface = target, prefaceAuto = false
  if (result.changes.length > 0) {
    _recentShiftsByCard.set(card.id, {
      targetId: target,
      changes: result.changes,
      startScore: result.startScore,
      finalScore: result.finalScore,
      targetTokenCount: result.targetTokenCount,
    });
    const n = result.changes.length;
    showToast(`Reconfigured for ${target} · ${n} ${n === 1 ? 'change' : 'changes'} automatically (Ctrl+Z to revert)`, 'success');
  }
}

// Collapse chunks that share an exact trailing-suffix (everything after the
// first space). Two or more chunks ending in the same suffix merge into one:
// their prefixes (deduped, first-occurrence order) join with the shared
// suffix appended once.
//
// Examples:
//   ['rustling voice', 'hiraeth voice', 'howling voice'] →
//     ['rustling hiraeth howling voice']
//   ['two-stepping single-coil-solid-body-electric-guitar',
//    'soukous-cascading single-coil-solid-body-electric-guitar'] →
//     ['two-stepping soukous-cascading single-coil-solid-body-electric-guitar']
//
// Suffix match is exact: 'parlor-acoustic-guitar' and 'dreadnought-acoustic-guitar'
// do NOT collapse — body-shape qualifier is real information. Chunks without
// a space (single-token labels like 'twelve-tone-equal-temperament') have no
// prefix/suffix split and pass through unchanged. Single-occurrence suffixes
// also pass through unchanged.
function _collapseSharedSuffixes(chunks) {
  if (!Array.isArray(chunks) || chunks.length < 2) return chunks;
  const parsed = chunks.map((chunk, idx) => {
    const sp = chunk.indexOf(' ');
    if (sp < 0) return { idx, chunk, prefix: null, suffix: null };
    return { idx, chunk, prefix: chunk.slice(0, sp), suffix: chunk.slice(sp + 1) };
  });
  const groups = new Map();
  for (const p of parsed) {
    if (p.suffix === null) continue;
    if (!groups.has(p.suffix)) groups.set(p.suffix, { prefixes: [] });
    const g = groups.get(p.suffix);
    if (!g.prefixes.includes(p.prefix)) g.prefixes.push(p.prefix);
  }
  const emitted = new Set();
  const result = [];
  for (const p of parsed) {
    if (p.suffix === null) { result.push(p.chunk); continue; }
    const g = groups.get(p.suffix);
    if (g.prefixes.length < 2) { result.push(p.chunk); continue; }
    if (emitted.has(p.suffix)) continue;
    emitted.add(p.suffix);
    result.push(g.prefixes.join(' ') + ' ' + p.suffix);
  }
  return result;
}

function compressTagsRecipe(cards, ceiling) {
  const chunks = [];

  // Per-card chunks — one per instrument.
  for (const card of cards) {
    const parts = buildStackParts(card);
    const inst = parts.find(p => p.kind === 'instrument');
    if (!inst) continue;
    chunks.push(_buildChunk(inst.label, inst.descriptors, _resolvePreface(card)));
  }

  // Environment chunks — tuning, room, each non-empty chain stage. We pull
  // these from the first card under the assumption that environment is shared
  // (the prose path makes the same assumption — see envIsShared detection in
  // compressProseRecipe). If env actually varies across cards, the per-instrument
  // chunks will still carry per-card descriptors; the env chunks below just
  // surface what card[0] has. Acceptable for tags-mode density.
  if (cards.length > 0) {
    const envParts = buildStackParts(cards[0]);
    for (const p of envParts) {
      if (p.kind === 'instrument') continue;
      chunks.push(_buildChunk(p.label, p.descriptors));
    }
  }

  let output = _collapseSharedSuffixes(chunks).join(', ');

  // Trailing `.` seals the final concept for the parser; reserve a byte.
  const TRIM_TARGET = ceiling - 1;

  if (output.length <= TRIM_TARGET) {
    return output + '.';
  }

  // Re-parse chunks to mutable descriptor lists with `kind` tracking so the
  // post-descriptor phases can target env vs instrument chunks specifically.
  // Instrument chunks come first (one per card), then env chunks (one per
  // non-empty source on card[0]).
  const rebuilt = cards.map(card => {
    const parts = buildStackParts(card);
    const inst = parts.find(p => p.kind === 'instrument');
    return inst ? {
      kind: 'inst',
      label: inst.label,
      preface: _resolvePreface(card),
      descs: _sortDescriptorsByPriority(_suppressSubsumed(inst.descriptors)),
    } : null;
  }).filter(Boolean);
  if (cards.length > 0) {
    for (const p of buildStackParts(cards[0])) {
      if (p.kind === 'instrument') continue;
      rebuilt.push({
        kind: 'env',
        label: p.label,
        preface: null,
        descs: _sortDescriptorsByPriority(_suppressSubsumed(p.descriptors)),
      });
    }
  }
  const renderAll = () => {
    const rendered = rebuilt.map(c => {
      const head = c.preface ? `${c.preface} ${_kebab(c.label)}` : _kebab(c.label);
      return c.descs.length ? `${head}: ${c.descs.join(' ')}` : head;
    });
    return _collapseSharedSuffixes(rendered).join(', ');
  };

  // Phase A: round-robin pop of the lowest-priority token across chunks
  // until under ceiling. Each chunk's descs are pre-sorted by
  // _sortDescriptorsByPriority (tier asc, df asc), so the LAST token is the
  // lowest-priority in that chunk. We pick the chunk whose last-token has
  // the highest tier (Tier 4 texture before Tier 3 scaffold before Tier 2
  // iconic before Tier 1 material/gear), tiebreaking by chunk size
  // (largest = most reducible). This aligns the trim algorithm with the
  // sort: position in the chunk is its priority signal, and the trim
  // respects that signal instead of overriding it with a length heuristic.
  // Earlier versions dropped the SHORTEST token first, which actively
  // penalized the highest-signal tokens (materials like `steel`, `gut`,
  // `tin` are short by their nature — that shortness is morphological,
  // not a signal of low information).
  let guard = 5000;
  while (renderAll().length > TRIM_TARGET && guard-- > 0) {
    let target = -1; let targetTier = -Infinity;
    for (let i = 0; i < rebuilt.length; i++) {
      if (rebuilt[i].descs.length === 0) continue;
      const last = rebuilt[i].descs[rebuilt[i].descs.length - 1];
      const t = _descriptorTier(last);
      const better = (t > targetTier) ||
        (t === targetTier && rebuilt[i].descs.length > (target >= 0 ? rebuilt[target].descs.length : 0));
      if (better) { target = i; targetTier = t; }
    }
    if (target < 0) break;
    rebuilt[target].descs.pop();
  }

  // Phase B: descriptor-trim exhausted. Drop env chunks from the end —
  // tuning / room / chain stages are auxiliary in tags-mode density; the
  // per-card instrument chunks carry the recipe's per-source identity and
  // should be preserved as long as possible.
  while (renderAll().length > TRIM_TARGET && rebuilt.some(c => c.kind === 'env')) {
    for (let i = rebuilt.length - 1; i >= 0; i--) {
      if (rebuilt[i].kind === 'env') { rebuilt.splice(i, 1); break; }
    }
  }

  // Phase C: env chunks exhausted, still over budget. Drop trailing
  // instrument chunks with a hidden-count notice. Happens only at very
  // large stacks (30+ cards) where bare labels alone exceed the budget.
  // The notice goes AFTER the sealing period so it reads as meta-annotation
  // rather than recipe content: `... last-token. [+12 hidden]`.
  const noticeFor = (n) => n > 0 ? ` [+${n} hidden]` : '';
  let droppedInst = 0;
  const finalLen = () => renderAll().length + 1 + noticeFor(droppedInst).length;
  while (rebuilt.length > 1 && finalLen() > ceiling) {
    let dropIdx = -1;
    for (let i = rebuilt.length - 1; i >= 0; i--) {
      if (rebuilt[i].kind === 'inst') { dropIdx = i; break; }
    }
    if (dropIdx < 0) break;
    rebuilt.splice(dropIdx, 1);
    droppedInst++;
  }

  let final = renderAll() + '.' + noticeFor(droppedInst);

  // Defensive truncate as ultimate safety net. Should never trigger if the
  // phases above did their job; kept as a guard for pathological cases
  // (e.g., a single instrument chunk whose label alone exceeds the budget).
  if (final.length > ceiling) {
    const sliceLen = Math.max(0, ceiling - 16);
    final = final.slice(0, sliceLen) + '… [truncated]';
  }
  return final;
}

function compressCompactRecipe(cards, ceiling) {
  // Each line gets a trailing comma so the output drops cleanly into a
  // comma-separated list when copy-pasted, without manual editing.
  let out = cards.map(card => {
    const preface = _resolvePreface(card);
    return buildStackParts(card).map(p => {
      if (p.kind === 'instrument' && preface) return `${preface} ${p.label}`;
      return p.label;
    }).join(' · ') + ',';
  }).join('\n');
  if (out.length <= ceiling) return out;

  // Reduce to instrument labels only (still preface-aware, still comma-tailed)
  out = cards.map(card => {
    const inst = buildStackParts(card).find(p => p.kind === 'instrument');
    if (!inst) return '?,';
    const preface = _resolvePreface(card);
    return (preface ? `${preface} ${inst.label}` : inst.label) + ',';
  }).join('\n');
  if (out.length <= ceiling) return out;

  // Pathological case — defensive truncate
  return out.slice(0, ceiling - 16) + '\n[truncated]';
}

function compressRichRecipe(cards, ceiling) {
  // Rich render — same collapse logic as compressProseRecipe but each chunk
  // carries the full post-noun descriptor stack (material, part, technique,
  // acoustic-feature). The collapse pools descriptors across all cards that
  // merged into the chunk, deduped, sorted by priority.
  //
  // Format per chunk:
  //   inst:        `<prefaces> <inner-labels> <trailing-label>: <descs>`
  //   inst-single: `<preface> <label>: <descs>`
  //   env:         `<env-label>: <descs>`   (no preface)
  //
  // Four-tab division of labor:
  //   - Tags:    per-source chunks with descriptors and trim cascade. Labeled,
  //              ceiling-respecting, useful when you want chunk attribution.
  //   - Prose:   collapsed chunks with iconic prefaces only. Compact signature
  //              view, ceiling-respecting, useful when descriptors aren't the
  //              point.
  //   - Rich:    collapsed chunks with prefaces AND full post-noun descriptors.
  //              Ceiling-respecting via the same 3-phase trim cascade Tags uses:
  //              descriptor-pop → env-drop → inst-drop with hidden-count notice.
  //   - Compact: one line per source. Defensive truncate.

  // ---- Build raw chunks ----
  const rawChunks = [];
  for (const card of cards) {
    const parts = buildStackParts(card);
    const inst = parts.find(p => p.kind === 'instrument');
    if (!inst) continue;
    rawChunks.push({
      kind: 'inst',
      label: _kebab(inst.label),
      preface: _resolvePreface(card) || null,
      descriptors: _suppressSubsumed(inst.descriptors).slice(),
    });
  }
  if (cards.length > 0) {
    for (const p of buildStackParts(cards[0])) {
      if (p.kind === 'instrument') continue;
      let label = p.label;
      const colonIdx = label.indexOf(': ');
      if (colonIdx >= 0) label = label.slice(colonIdx + 2);
      rawChunks.push({
        kind: 'env',
        label: _kebab(label),
        preface: null,
        descriptors: _suppressSubsumed(p.descriptors).slice(),
      });
    }
  }

  // ---- Phase A: exact-label merge ----
  // Pool prefaces AND descriptors (deduped). Source order preserved.
  const byLabel = new Map();
  const labelOrder = [];
  for (const c of rawChunks) {
    if (byLabel.has(c.label)) {
      const ex = byLabel.get(c.label);
      if (c.preface && !ex.prefaces.includes(c.preface)) ex.prefaces.push(c.preface);
      for (const d of c.descriptors) if (!ex.descriptors.includes(d)) ex.descriptors.push(d);
    } else {
      byLabel.set(c.label, {
        kind: c.kind,
        label: c.label,
        prefaces: c.preface ? [c.preface] : [],
        descriptors: c.descriptors.slice(),
      });
      labelOrder.push(c.label);
    }
  }

  // ---- Phase B: trailing-token collapse ----
  // Group by trailing hyphen-segment. Collapse iff group.length ≥ 2 AND no
  // member's label is the bare trailing token. Descriptors pool across the
  // group, deduped — the merged chunk gets the union as its post-noun stack.
  const trailingGroups = new Map();
  for (const key of labelOrder) {
    const segs = key.split('-');
    const trailing = segs[segs.length - 1];
    if (!trailingGroups.has(trailing)) trailingGroups.set(trailing, []);
    trailingGroups.get(trailing).push(key);
  }
  const bareLabels = new Set(labelOrder);

  const finalChunks = [];
  const emitted = new Set();
  for (const key of labelOrder) {
    if (emitted.has(key)) continue;
    const c = byLabel.get(key);
    const segs = c.label.split('-');
    const trailing = segs[segs.length - 1];
    const group = trailingGroups.get(trailing);

    if (group.length >= 2 && !bareLabels.has(trailing)) {
      const parts = [];
      const pooledDescriptors = [];
      let groupKind = 'inst';
      for (const groupKey of group) {
        const m = byLabel.get(groupKey);
        const memberSegs = m.label.split('-');
        const innerLabel = memberSegs.slice(0, -1).join('-') || null;
        parts.push({ prefaces: m.prefaces.slice(), innerLabel });
        for (const d of m.descriptors) if (!pooledDescriptors.includes(d)) pooledDescriptors.push(d);
        if (m.kind === 'env') groupKind = 'env';
        emitted.add(groupKey);
      }
      finalChunks.push({ kind: groupKind, trailingLabel: trailing, parts, descriptors: pooledDescriptors });
    } else {
      emitted.add(key);
      finalChunks.push({
        kind: c.kind,
        trailingLabel: c.label,
        parts: [{ prefaces: c.prefaces.slice(), innerLabel: null }],
        descriptors: c.descriptors.slice(),
      });
    }
  }

  // Sort each chunk's pooled descriptors by priority (tier asc, IDF asc).
  // The same priority sort Tags uses — meaning-bearing tokens lead, scaffolds
  // and textures sink. Position in the post-colon list is a signal too.
  for (const c of finalChunks) {
    c.descriptors = _sortDescriptorsByPriority(c.descriptors);
  }

  // ---- Render with ceiling enforcement ----
  const renderChunk = (c) => {
    const tokens = [];
    for (const p of c.parts) {
      for (const pref of p.prefaces) tokens.push(pref);
      if (p.innerLabel) tokens.push(p.innerLabel);
    }
    const head = tokens.length > 0 ? `${tokens.join(' ')} ${c.trailingLabel}` : c.trailingLabel;
    return c.descriptors.length > 0 ? `${head}: ${c.descriptors.join(' ')}` : head;
  };
  const renderAll = () => finalChunks.map(renderChunk).join(', ');

  // Trailing `.` seals the recipe; reserve a byte for it (Tags-parity).
  const TRIM_TARGET = ceiling - 1;

  if (renderAll().length <= TRIM_TARGET) {
    return renderAll() + '.';
  }

  // Phase C (descriptor trim): round-robin pop the lowest-priority token across
  // chunks until under ceiling. Each chunk's descriptors are pre-sorted by
  // _sortDescriptorsByPriority (tier asc, df asc), so the LAST token is the
  // lowest-priority in that chunk. Pick the chunk whose last-token has the
  // highest tier (T4 texture before T3 scaffold before T2 iconic before T1
  // material/gear), tiebreaking by chunk size. Mirrors Tags Phase A exactly.
  let guard = 5000;
  while (renderAll().length > TRIM_TARGET && guard-- > 0) {
    let target = -1; let targetTier = -Infinity;
    for (let i = 0; i < finalChunks.length; i++) {
      if (finalChunks[i].descriptors.length === 0) continue;
      const last = finalChunks[i].descriptors[finalChunks[i].descriptors.length - 1];
      const t = _descriptorTier(last);
      const better = (t > targetTier) ||
        (t === targetTier && finalChunks[i].descriptors.length > (target >= 0 ? finalChunks[target].descriptors.length : 0));
      if (better) { target = i; targetTier = t; }
    }
    if (target < 0) break;
    finalChunks[target].descriptors.pop();
  }

  // Phase D (env drop): descriptor-trim exhausted. Drop env chunks from the
  // end — tuning / room / chain stages are auxiliary; the per-card instrument
  // chunks carry recipe-identity and should survive longer. Mirrors Tags Phase B.
  while (renderAll().length > TRIM_TARGET && finalChunks.some(c => c.kind === 'env')) {
    for (let i = finalChunks.length - 1; i >= 0; i--) {
      if (finalChunks[i].kind === 'env') { finalChunks.splice(i, 1); break; }
    }
  }

  // Phase D½ (preface shed): env exhausted, still over budget. Prefaces are
  // decoration; an instrument's presence is recipe-identity — naming every
  // instrument bare beats decorating some and hiding the rest behind a
  // "[+N hidden]" notice. Shed one preface at a time: chunks holding the most
  // pooled prefaces first (label-merges collect one per merged card), ties to
  // the later chunk, popping from that chunk's tail part — so each card's
  // primary preface survives longest and hiding becomes a pathological-only
  // last resort.
  const _prefaceTotal = (c) => c.parts.reduce((n, p) => n + p.prefaces.length, 0);
  let shedGuard = 5000;
  while (renderAll().length > TRIM_TARGET && shedGuard-- > 0) {
    let target = -1; let most = 0;
    for (let i = 0; i < finalChunks.length; i++) {
      const n = _prefaceTotal(finalChunks[i]);
      if (n > 0 && n >= most) { target = i; most = n; }
    }
    if (target < 0) break;
    const parts = finalChunks[target].parts;
    for (let j = parts.length - 1; j >= 0; j--) {
      if (parts[j].prefaces.length > 0) { parts[j].prefaces.pop(); break; }
    }
  }

  // Phase E (inst drop): env chunks exhausted, still over budget. Drop
  // trailing inst chunks with hidden-count notice. Mirrors Tags Phase C.
  const noticeFor = (n) => n > 0 ? ` [+${n} hidden]` : '';
  let droppedInst = 0;
  const finalLen = () => renderAll().length + 1 + noticeFor(droppedInst).length;
  while (finalChunks.length > 1 && finalLen() > ceiling) {
    let dropIdx = -1;
    for (let i = finalChunks.length - 1; i >= 0; i--) {
      if (finalChunks[i].kind === 'inst') { dropIdx = i; break; }
    }
    if (dropIdx < 0) break;
    finalChunks.splice(dropIdx, 1);
    droppedInst++;
  }

  let final = renderAll() + '.' + noticeFor(droppedInst);

  // Defensive truncate as ultimate safety net. Should never trigger if the
  // phases above did their job; kept as a guard for pathological cases.
  if (final.length > ceiling) {
    const sliceLen = Math.max(0, ceiling - 16);
    final = final.slice(0, sliceLen) + '… [truncated]';
  }
  return final;
}

function compileRecipeStack(cards, format, options) {
  const ceiling = Math.min(
    (options && options.ceiling) || RECIPE_CHAR_CEILING,
    RECIPE_CHAR_CEILING
  );
  if (!cards || cards.length === 0) return '';

  // Recipe-context preface dedup: compute deduped preface ids for the recipe,
  // stash globally so per-card _resolvePreface calls during render pick them up,
  // restore after render so card.preface itself stays untouched.
  const prevOverrides = _RECIPE_PREFACE_OVERRIDES;
  _RECIPE_PREFACE_OVERRIDES = _computeRecipeDedupedPrefaces(cards);
  try {
    const header = _recipeHeader(cards);
    // Header eats into the 1000-char budget — pass the remainder to compress
    // so the total output (header + body) stays under ceiling.
    const bodyCeiling = ceiling - header.length;
    if (format === 'tags')    return header + compressTagsRecipe(cards, bodyCeiling);
    if (format === 'compact') return header + compressCompactRecipe(cards, bodyCeiling);
    if (format === 'rich')    return header + compressRichRecipe(cards, bodyCeiling);
    return header + compressProseRecipe(cards, bodyCeiling);
  } finally {
    _RECIPE_PREFACE_OVERRIDES = prevOverrides;
  }
}

// ---- Storage ----
// Save/Load/Fork/Delete persist through window.storage — an async key/value store:
//   get(key)    → { key, value, shared } | null
//   set(key,v)  → { key, value, shared }
//   delete(key) → { key, deleted, shared }
//   list(prefix)→ { keys, prefix, shared }
// A host may inject this (Claude.ai provides it to artifacts). When nothing does —
// the standalone site, which is how this ships — nobody used to, so every Save hit
// the `!window.storage` guard and failed. Install a browser-backed store so Save
// actually persists: IndexedDB is the primary backend (async-native, large quota,
// a perfect fit for this API's shape), localStorage the fallback, an in-memory Map
// the last resort (no-DOM / locked-down engines) so calls degrade instead of throw.
// Guarded three ways: a host-provided window.storage always wins; the reachability
// gate's deterministic mock (window.storage._gate_mock) wins too — this shim tags
// itself _local_shim so the gate swaps its mock in for isolation.
(function installStorageShim() {
  if (typeof window === 'undefined') return; // no DOM (node parity harness) — nothing to persist
  if (window.storage) return; // host store or gate mock already present — never clobber it
  const DB = 'codex-musica',
    STORE = 'kv',
    VER = 1;
  const idb = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || null;

  // localStorage (namespaced) or, if even that is unavailable, an in-memory Map.
  function makeFallback() {
    let ls = null;
    try {
      ls = window.localStorage || null;
    } catch {
      ls = null;
    }
    if (ls) {
      const P = 'codexkv:';
      return {
        name: 'localstorage',
        async get(k) {
          const v = ls.getItem(P + k);
          return v == null ? null : { key: k, value: v, shared: false };
        },
        async set(k, v) {
          ls.setItem(P + k, String(v));
          return { key: k, value: String(v), shared: false };
        },
        async delete(k) {
          ls.removeItem(P + k);
          return { key: k, deleted: true, shared: false };
        },
        async list(pre) {
          const keys = [];
          for (let i = 0; i < ls.length; i++) {
            const kk = ls.key(i);
            if (kk && kk.startsWith(P)) {
              const bare = kk.slice(P.length);
              if (!pre || bare.startsWith(pre)) keys.push(bare);
            }
          }
          return { keys, prefix: pre || null, shared: false };
        },
      };
    }
    const mem = new Map();
    return {
      name: 'memory',
      async get(k) {
        return mem.has(k) ? { key: k, value: mem.get(k), shared: false } : null;
      },
      async set(k, v) {
        mem.set(k, String(v));
        return { key: k, value: String(v), shared: false };
      },
      async delete(k) {
        const had = mem.delete(k);
        return { key: k, deleted: had, shared: false };
      },
      async list(pre) {
        const keys = [...mem.keys()].filter((x) => !pre || x.startsWith(pre));
        return { keys, prefix: pre || null, shared: false };
      },
    };
  }

  function makeIdb() {
    let dbP = null;
    const open = () =>
      dbP ||
      (dbP = new Promise((res, rej) => {
        let req;
        try {
          req = idb.open(DB, VER);
        } catch (e) {
          rej(e);
          return;
        }
        req.onupgradeneeded = () => {
          try {
            if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
          } catch {
            /* store may already exist on a racing connection */
          }
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error || new Error('indexedDB open failed'));
        req.onblocked = () => rej(new Error('indexedDB blocked'));
      }).catch((e) => {
        dbP = null; // let a later call retry the open
        throw e;
      }));
    const op = (mode, fn) =>
      open().then(
        (db) =>
          new Promise((res, rej) => {
            let req;
            const tx = db.transaction(STORE, mode);
            try {
              req = fn(tx.objectStore(STORE));
            } catch (e) {
              rej(e);
              return;
            }
            tx.oncomplete = () => res(req && req.result);
            tx.onabort = tx.onerror = () => rej(tx.error || new Error('indexedDB tx failed'));
          })
      );
    return {
      name: 'indexeddb',
      async get(k) {
        const v = await op('readonly', (s) => s.get(k));
        return v == null ? null : { key: k, value: String(v), shared: false };
      },
      async set(k, v) {
        await op('readwrite', (s) => s.put(String(v), k));
        return { key: k, value: String(v), shared: false };
      },
      async delete(k) {
        await op('readwrite', (s) => s.delete(k));
        return { key: k, deleted: true, shared: false };
      },
      async list(pre) {
        const keys = await op('readonly', (s) => s.getAllKeys());
        const kk = (keys || []).map(String).filter((x) => !pre || x.startsWith(pre));
        return { keys: kk, prefix: pre || null, shared: false };
      },
    };
  }

  const fallback = makeFallback();
  let active = idb ? makeIdb() : fallback;
  const store = { _local_shim: true, backend: active.name };
  // Self-heal: if IndexedDB throws on first real use (Firefox private mode exposes
  // the API but forbids opening a DB), permanently switch to the fallback and retry
  // the call once. Nothing is lost — the switch only fires when IDB never worked.
  function guard(method) {
    return async function (...args) {
      try {
        return await active[method](...args);
      } catch (e) {
        if (active !== fallback) {
          active = fallback;
          store.backend = fallback.name;
          return await fallback[method](...args);
        }
        throw e;
      }
    };
  }
  store.get = guard('get');
  store.set = guard('set');
  store.delete = guard('delete');
  store.list = guard('list');
  window.storage = store;
})();
async function safeGet(key) {
  try { return window.storage ? await window.storage.get(key) : null; }
  catch { return null; }
}
async function listSaved() {
  try {
    const r = await safeGet('codex:list');
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}
// Read the saved-workspace index for a read-MODIFY-write (save/delete),
// distinguishing "genuinely empty/absent" from "read failed". listSaved()
// swallows every error into [] — fine for display, but FATAL for a write: a
// transient storage hiccup would yield [], and writing that back overwrites
// codex:list and orphans every previously saved workspace. This variant lets a
// read/parse failure THROW so the caller's catch aborts the write instead.
async function readListStrict() {
  if (!window.storage) throw new Error('storage unavailable');
  const r = await window.storage.get('codex:list'); // throws on storage failure — intentional
  if (!r) return []; // key genuinely absent → empty list is correct
  return JSON.parse(r.value); // throws on corruption — intentional
}
// Saved-workspace schema version: bump when the persisted card/chain shape changes
// so an older app warns instead of silently mis-rendering a newer save.
const WS_SCHEMA = 1;
async function saveWS(name) {
  if (!window.storage) { showToast('Save failed', 'error'); return; }
  try {
    const list = await readListStrict(); // abort (catch below) rather than overwrite a failed read
    const key = 'codex:ws:' + newId('ws');
    const data = { schema: WS_SCHEMA, key, name, saved_at: new Date().toISOString(), cards: app.cards.map(c => ({ ...c, ..._CARD_TRANSIENTS })) };
    await window.storage.set(key, JSON.stringify(data));
    list.push({ key, name, saved_at: data.saved_at, count: app.cards.length });
    await window.storage.set('codex:list', JSON.stringify(list));
    showToast(`Saved "${name}"`, 'success');
  } catch (e) { console.error(e); showToast('Save failed', 'error'); }
}
async function loadWS(key) {
  try {
    const r = await safeGet(key);
    if (!r) { showToast('Not found', 'error'); return; }
    const d = JSON.parse(r.value);
    if (d.schema && d.schema > WS_SCHEMA) { showToast('Saved by a newer version — update to open it', 'error'); return; }
    app.cards = (d.cards || []).map(c => {
      const card = { ...c, chain: c.chain || emptyChain(), ..._CARD_TRANSIENTS };
      if (card.prefaceAuto === undefined) card.prefaceAuto = !card.preface;
      return card;
    });
    closeModal('modal-saved');
    renderAll();
    if (typeof pushHistory === 'function') pushHistory(); // parity with forkWS — one Ctrl+Z shouldn't discard the load
    showToast(`Loaded "${d.name}"`, 'success');
  } catch { showToast('Load failed', 'error'); }
}
// Fork a saved workspace — same content as Load, but with fresh card IDs
// generated for each card. Functionally identical to Load (since every save
// creates a new key anyway, never overwriting), but the explicit Fork button
// signals to the user "this is an independent copy, the original is safe."
// The fresh card IDs also make any subsequent in-card actions (duplicate,
// delete) refer to the fork's cards, not the originals — useful if the user
// has the original loaded somewhere or shares the file across sessions.
async function forkWS(key) {
  try {
    const r = await safeGet(key);
    if (!r) { showToast('Not found', 'error'); return; }
    const d = JSON.parse(r.value);
    if (d.schema && d.schema > WS_SCHEMA) { showToast('Saved by a newer version — update to open it', 'error'); return; }
    app.cards = (d.cards || []).map(c => {
      const card = { ...c, id: newId('card'), chain: c.chain || emptyChain(), ..._CARD_TRANSIENTS };
      if (card.prefaceAuto === undefined) card.prefaceAuto = !card.preface;
      return card;
    });
    closeModal('modal-saved');
    renderAll();
    if (typeof pushHistory === 'function') pushHistory();
    showToast(`Forked from "${d.name}" — original unchanged`, 'success');
  } catch { showToast('Fork failed', 'error'); }
}
async function delWS(key) {
  if (!window.storage) { showToast('Delete failed', 'error'); return; }
  try {
    await window.storage.delete(key);
    const list = await readListStrict(); // abort (catch below) rather than overwrite a failed read
    await window.storage.set('codex:list', JSON.stringify(list.filter(w => w.key !== key)));
    renderSaved();
    showToast('Deleted', 'success');
  } catch { showToast('Delete failed', 'error'); }
}

// ---- Modals ----
// Keyboard focus is trapped inside an open modal (Tab/Shift+Tab wrap) and restored
// to the triggering control on close — honoring the aria-modal="true" contract the
// markup declares.
let _modalReturnFocus = null;
function _focusables(root) {
  return [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null);
}
function _trapTab(e, modal) {
  if (e.key !== 'Tab' || !modal) return;
  const f = _focusables(modal);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function openModal(id) {
  const bg = document.getElementById(id);
  _modalReturnFocus = document.activeElement; // restore focus here on close
  bg.classList.add('open');
  bg._trapHandler = (e) => _trapTab(e, bg.querySelector('.modal') || bg);
  bg.addEventListener('keydown', bg._trapHandler);
  setTimeout(() => {
    const i = bg.querySelector('input[type=search], input[type=text]');
    (i || _focusables(bg)[0] || bg).focus();
  }, UI_TIMING_MS.MODAL_FOCUS_DELAY);
}
function closeModal(id) {
  const bg = document.getElementById(id);
  if (!bg) return;
  bg.classList.remove('open');
  if (bg._trapHandler) { bg.removeEventListener('keydown', bg._trapHandler); bg._trapHandler = null; }
  if (_modalReturnFocus && typeof _modalReturnFocus.focus === 'function' && document.contains(_modalReturnFocus)) {
    _modalReturnFocus.focus();
  }
  _modalReturnFocus = null;
}

// ---- Confirm Dialog ----
// Replaces native confirm() which is unreliable: browsers can suppress
// repeated confirm() calls (Chrome's "prevent this page from creating
// additional dialogs" mechanism kicks in surprisingly easily), and the
// native dialog renders as a thin chip at the very top of the viewport
// that's easy to miss or dismiss without noticing. This custom version
// renders inline, can't be suppressed, focuses the destructive action
// automatically for keyboard confirm, and integrates with toast feedback.
//
// Returns a Promise<boolean>. Usage:
//   const ok = await confirmDialog({ title, message, confirmLabel, danger });
//   if (!ok) return;
function confirmDialog(opts) {
  const {
    title = 'Confirm',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
  } = opts || {};
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg open confirm-dialog-bg';
    bg.innerHTML = `
      <div class="modal confirm-dialog">
        <div class="modal-head">
          <h2 class="modal-title">${esc(title)}</h2>
        </div>
        <div class="confirm-dialog-body">
          <p class="confirm-dialog-msg">${esc(message)}</p>
          <div class="confirm-dialog-actions">
            <button type="button" class="btn btn-ghost" data-confirm-action="cancel">${esc(cancelLabel)}</button>
            <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-confirm-action="confirm">${esc(confirmLabel)}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(bg);
    const returnFocus = document.activeElement;
    const close = (result) => {
      bg.remove();
      document.removeEventListener('keydown', onKey);
      if (returnFocus && typeof returnFocus.focus === 'function' && document.contains(returnFocus)) returnFocus.focus();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') _trapTab(e, bg.querySelector('.modal'));
    };
    document.addEventListener('keydown', onKey);
    bg.querySelector('[data-confirm-action="cancel"]').addEventListener('click', () => close(false));
    bg.querySelector('[data-confirm-action="confirm"]').addEventListener('click', () => close(true));
    bg.addEventListener('click', e => { if (e.target === bg) close(false); });
    // Focus the confirm button so Enter confirms by default. Slight delay
    // lets the modal's opacity/transform transition begin before focus,
    // matching the existing modal pattern in openModal().
    setTimeout(() => bg.querySelector('[data-confirm-action="confirm"]').focus(), UI_TIMING_MS.MODAL_FOCUS_DELAY);
  });
}

// ---- Toast ----
let toastT = null;
function showToast(msg, kind) {
  // kind: undefined (default neutral), 'success' (green w/ check icon),
  // 'error' (red w/ alert-circle icon). Icon emoji is part of the toast
  // text to keep the existing rendering surface unchanged.
  const t = document.getElementById('toast');
  t.classList.remove('toast-success', 'toast-error');
  if (kind === 'success') {
    t.innerHTML = `${icon('check')}<span>${esc(msg)}</span>`;
    t.classList.add('toast-success');
  } else if (kind === 'error') {
    t.innerHTML = `${icon('alert-circle')}<span>${esc(msg)}</span>`;
    t.classList.add('toast-error');
  } else {
    t.textContent = msg;
  }
  t.classList.add('show');
  if (toastT) clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), UI_TIMING_MS.TOAST_LIFETIME);
}

// ---- Clipboard helper ----
// navigator.clipboard.writeText requires a secure context (https or localhost)
// and is unreliable when the file is opened directly via the file:// protocol.
// Fall back to document.execCommand('copy') via a temporary textarea, which
// works in any context as long as the call is inside a user-gesture handler.
function copyToClipboard(text, successMsg, failMsg) {
  const onSuccess = () => showToast(successMsg || 'Copied', 'success');
  const onFail    = () => showToast(failMsg || 'Copy failed', 'error');
  // Try modern API first when available and likely to work
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onSuccess, () => execCopyFallback(text, onSuccess, onFail));
    return;
  }
  execCopyFallback(text, onSuccess, onFail);
}
function execCopyFallback(text, onSuccess, onFail) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    // Off-screen but still focusable
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    ok ? onSuccess() : onFail();
  } catch {
    onFail();
  }
}

// ---- Escape ----
function esc(s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ============================================================
// RENDER
// ============================================================

// Below 900px the app is ONE SCROLLING PAGE: the genre tree is the page and
// the instrument detail mounts inside it, under the row that opened it. Above
// it, the classic two-pane master/detail. 899 is the same width the workspace
// grid already collapsed at — no new breakpoint enters the cascade.
//
// Matches the CSS on WIDTH ALONE, deliberately: gating on `pointer: coarse`
// would let a narrow desktop window take the phone layout while the JS still
// mounted the detail in the desktop pane.
const MOBILE_MAX_WIDTH = 899;
function isMobileLayout() {
  return window.innerWidth <= MOBILE_MAX_WIDTH;
}

function renderAll() {
  renderEmpty();
  renderMeta();
  // Coordinate prefaces across the visible stack before painting. Each
  // card's auto-suggested top-1 is reconciled against all other cards so
  // no two cards share the same preface; collisions resolved by score.
  _applyRecipeDedup();
  renderSidebar();
  // On mobile the detail lives INSIDE the tree that renderSidebar() just
  // rebuilt, so renderSidebarTraditions() has already remounted it. Calling
  // again here would tear down and rebuild the same panel a second time.
  if (!isMobileLayout()) renderDetail();
}

// Curated starter recipes for the empty-state gallery — chosen to span the
// catalog's extremes and continents (verified to exist with 2+ instruments).
const STARTER_TRADITIONS = [
  'delta_blues',      // sparse American roots
  'hindustani',       // microtonal, free-meter, heavily ornamented
  'detroit_techno',   // electronic, strict isochronous meter
  'javanese_gamelan', // non-12-TET, cyclic, dense metallophone texture
  'symphonic',        // dense functional-harmony orchestral
  'dub'               // studio-as-instrument, effects-forward
];

function renderEmpty() {
  const e = document.getElementById('empty-state');
  e.style.display = app.cards.length === 0 ? 'block' : 'none';
  if (app.cards.length === 0) {
    // Starter gallery — a curated row of full recipes that span the catalog's
    // range (sparse↔dense, acoustic↔electronic, modal↔functional, 12-TET↔not,
    // and across continents) so a first-time opener sees the payoff immediately.
    const gallery = document.getElementById('starter-gallery');
    if (gallery) {
      gallery.innerHTML = STARTER_TRADITIONS.map(id => {
        const t = Tradition(id);
        if (!t) return '';
        const n = (t.instruments || []).length;
        return `<button class="starter-trad" data-starter-trad="${esc(id)}">`
          + `<span class="starter-trad-name">${esc(t.name)}</span>`
          + `<span class="starter-trad-count">${n}</span></button>`;
      }).join('');
      gallery.querySelectorAll('[data-starter-trad]').forEach(b =>
        b.addEventListener('click', () => importTraditionWithFeedback(b.dataset.starterTrad)));
    }
    // (#empty-surprise is a static template element — it is wired ONCE in
    // _initApp. Wiring it here would stack a fresh listener on every empty-state
    // render, so one click would fire surpriseTradition multiple times.)
    const qp = document.getElementById('quick-pick');
    const picks = ['voice', 'electric_guitar_single_coil', 'sitar', 'drum_kit', 'analog_synth'];
    qp.innerHTML = picks.map(id => {
      const i = Inst(id);
      return i ? `<button class="btn btn-secondary" data-quick-add="${esc(id)}">${esc(i.short || i.name)}</button>` : '';
    }).join('') + `<button class="btn btn-secondary" id="quick-trad">Browse traditions</button>`;
    qp.querySelectorAll('[data-quick-add]').forEach(b => b.addEventListener('click', () => {
      const iid = b.dataset.quickAdd;
      const card = addCard(iid);
      if (!card) { showToast(`Unknown instrument: ${iid}`, 'error'); return; }
      renderAll();
    }));
    document.getElementById('quick-trad').addEventListener('click', () => {
      app.tradSearch = '';
      app.similarFor = null;
      document.getElementById('search-trad').value = '';
      renderTradPicker();
      openModal('modal-trad');
    });
  }
}

function renderMeta() {
  const m = document.getElementById('meta');
  if (app.cards.length === 0) m.textContent = '';
  else m.textContent = app.cards.length + ' instrument' + (app.cards.length === 1 ? '' : 's');
}

// Determine which card carries the recipe's primary tradition anchor. The
// first card with a traditionId wins — matches the genre-header ordering.
// Returns the card id, or null if no card carries a tradition (manual builds
// show no primacy affordance).
function _determinePrimaryCard(cards) {
  for (const card of (cards || [])) {
    if (card && card.traditionId) return card.id;
  }
  return null;
}

// ─────────── Sidebar render (Phase 2 of layout refactor) ───────────
// Populates #sidebar-header, #sidebar-filter, #sidebar-traditions with the
// workspace name + rename pencil, filter input, and tradition-grouped compact
// instrument card rows. Selection lives at app.selected; clicking a card sets
// it and rerenders. PRIMARY status is read from the existing _determinePrimaryCard
// logic — the first card with a traditionId anchors the primary tradition.

function renderSidebar() {
  renderSidebarHeader();
  renderSidebarFilter();
  renderSidebarTraditions();
  renderSidebarStaple();
  renderSidebarRecipePreview();
}

function renderSidebarHeader() {
  const host = document.getElementById('sidebar-header');
  if (!host) return;
  if (app.cards.length === 0) {
    host.innerHTML = '<div class="ws-label">WORKSPACE</div><div class="ws-name-row"><h2 class="ws-name">' + esc(app.workspaceName) + '</h2></div>';
    return;
  }
  host.innerHTML =
    '<div class="ws-label">WORKSPACE</div>' +
    '<div class="ws-name-row">' +
      '<h2 class="ws-name" id="ws-name-display">' + esc(app.workspaceName) + '</h2>' +
      '<button class="icon-btn ws-rename" id="ws-rename-btn" data-tooltip="Rename workspace" aria-label="Rename workspace">' + icon('pencil', 14) + '</button>' +
    '</div>';
  const btn = document.getElementById('ws-rename-btn');
  if (btn) btn.addEventListener('click', startRenameWorkspace);
  const display = document.getElementById('ws-name-display');
  if (display) display.addEventListener('dblclick', startRenameWorkspace);
}

function startRenameWorkspace() {
  const display = document.getElementById('ws-name-display');
  if (!display) return;
  const row = display.parentElement;
  const current = app.workspaceName;
  row.innerHTML = '<input type="text" class="ws-name-input" id="ws-name-input" aria-label="Workspace name" value="' + esc(current) + '">';
  const inp = document.getElementById('ws-name-input');
  inp.focus();
  inp.select();
  const commit = () => {
    const v = inp.value.trim();
    app.workspaceName = v || 'Untitled session';
    renderSidebarHeader();
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); renderSidebarHeader(); }
  });
  inp.addEventListener('blur', commit);
}

function renderSidebarFilter() {
  const host = document.getElementById('sidebar-filter');
  if (!host) return;
  if (app.cards.length === 0) { host.innerHTML = ''; return; }
  host.innerHTML =
    '<div class="sidebar-search">' +
      '<span class="search-adornment">' + icon('search', 14) + '</span>' +
      '<input type="search" id="sidebar-filter-input" placeholder="Filter instruments…" autocomplete="off" value="' + esc(app.sidebarFilter) + '">' +
    '</div>';
  const inp = document.getElementById('sidebar-filter-input');
  if (inp) {
    inp.addEventListener('input', e => {
      app.sidebarFilter = e.target.value;
      renderSidebarTraditions();
    });
  }
}

function renderSidebarTraditions() {
  const host = document.getElementById('sidebar-traditions');
  if (!host) return;
  if (app.cards.length === 0) { host.innerHTML = ''; return; }

  const primaryCardId = _determinePrimaryCard(app.cards);
  const primaryCard = app.cards.find(c => c.id === primaryCardId);
  const primaryTradId = primaryCard ? primaryCard.traditionId : null;

  // Group cards by traditionId. Filter applies across all groups.
  const filter = (app.sidebarFilter || '').toLowerCase().trim();
  const groups = new Map();
  for (const card of app.cards) {
    const inst = Inst(card.instrumentId);
    const name = (inst && (inst.short || inst.name) || '').toLowerCase();
    const preface = prefaceLabelFor(card).toLowerCase();
    if (filter && !name.includes(filter) && !preface.includes(filter)) continue;
    const key = card.traditionId || '__ungrouped__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }

  // Sort tradition groups: insertion order from app.cards is the truth.
  // groups.keys() yields keys in insertion order, which matches the first
  // appearance of each traditionId in app.cards. Drag-and-drop reorder
  // mutates app.cards, so iteration order is what the user sees. The only
  // exception is __ungrouped__ (cards with no traditionId) which always
  // sorts last so "loose" picks separate cleanly from the structured stack.
  // The primary tradition is whichever shows up first naturally — no forced
  // override needed, because _determinePrimaryCard reads the same order.
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === '__ungrouped__') return 1;
    if (b === '__ungrouped__') return -1;
    return 0;  // stable: preserve insertion order
  });

  // movableKeys = real tradition groups only (excludes __ungrouped__).
  // Mover buttons reorder these in app.cards by swapping adjacent groups'
  // card runs. Position-aware: the first group has no up-arrow, the last
  // has no down-arrow. __ungrouped__ always sorts last and isn't movable.
  const movableKeys = keys.filter(k => k !== '__ungrouped__');

  host.innerHTML = keys.map(tradId => {
    const cards = groups.get(tradId);
    // Phase 4a: sort pinned cards first within each tradition group. Stable
    // sort preserves the existing within-pinned-bucket and within-unpinned-
    // bucket order so cards don't shuffle randomly when one is pinned.
    cards.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    const trad = tradId === '__ungrouped__' ? null : Tradition(tradId);
    const name = trad ? trad.name : 'Ungrouped';
    const isCollapsed = app.collapsedTraditionGroups.has(tradId);
    const isPrimary = tradId === primaryTradId;
    const movIdx = movableKeys.indexOf(tradId);
    const canMoveUp = movIdx > 0;
    const canMoveDown = movIdx >= 0 && movIdx < movableKeys.length - 1;
    const moverButtons = tradId === '__ungrouped__' ? '' : (
      '<button class="sb-tradition-move sb-tradition-move-up" data-move-trad-up="' + esc(tradId) + '"' +
        (canMoveUp ? '' : ' disabled') +
        ' data-tooltip="Move group up" data-tooltip-pos="left" aria-label="Move ' + esc(name) + ' group up">' +
        icon('arrow-up', 11) +
      '</button>' +
      '<button class="sb-tradition-move sb-tradition-move-down" data-move-trad-down="' + esc(tradId) + '"' +
        (canMoveDown ? '' : ' disabled') +
        ' data-tooltip="Move group down" data-tooltip-pos="left" aria-label="Move ' + esc(name) + ' group down">' +
        icon('arrow-down', 11) +
      '</button>'
    );
    return (
      '<section class="sb-tradition-group' + (isCollapsed ? ' is-collapsed' : '') + '" data-tradition-id="' + esc(tradId) + '">' +
        '<div class="sb-tradition-header" role="button" tabindex="0"' + (tradId !== '__ungrouped__' ? ' draggable="true"' : '') + '>' +
          '<span class="sb-chev">' + icon('chevron-down', 12) + '</span>' +
          (tradId !== '__ungrouped__' ? traditionGlyphsHTML(tradId, 22) : '') +
          '<span class="sb-tradition-name">' + esc(name) + '</span>' +
          // Meta cluster wraps to its own line beneath the name (see the
          // .sb-tradition-meta rule) so the controls never crowd the name out.
          '<span class="sb-tradition-meta">' +
            (tradId !== '__ungrouped__' ? '<span class="sb-status-pill ' + (isPrimary ? 'primary' : 'secondary') + '">' + (isPrimary ? 'PRIMARY' : 'SECONDARY') + '</span>' : '') +
            '<span class="sb-tradition-count">' + cards.length + '</span>' +
            moverButtons +
            (tradId !== '__ungrouped__'
              ? '<button class="sb-tradition-delete" data-delete-tradition="' + esc(tradId) + '" data-tooltip="Remove tradition from workspace" data-tooltip-pos="left" aria-label="Remove ' + esc(name) + ' group">' + icon('trash-2', 11) + '</button>'
              : '') +
          '</span>' +
        '</div>' +
        '<div class="sb-tradition-cards">' +
          cards.map(c => renderSidebarCard(c)).join('') +
        '</div>' +
        (tradId !== '__ungrouped__'
          ? '<button class="sb-add-to-tradition" data-add-to-trad="' + esc(tradId) + '">' + icon('plus', 12) + 'Add instrument to tradition</button>'
          : '') +
      '</section>'
    );
  }).join('');

  // Wire group-header toggles
  host.querySelectorAll('.sb-tradition-header').forEach(h => {
    h.addEventListener('click', (e) => {
      // Delete button intercepts; don't toggle collapse when clicking it.
      if (e.target.closest('.sb-tradition-delete')) return;
      // Mover buttons intercept too — they have their own handlers below.
      if (e.target.closest('.sb-tradition-move')) return;
      const tradId = h.parentElement.dataset.traditionId;
      if (app.collapsedTraditionGroups.has(tradId)) app.collapsedTraditionGroups.delete(tradId);
      else app.collapsedTraditionGroups.add(tradId);
      renderSidebarTraditions();
    });
    // Keyboard parity for the role="button" header (Enter/Space activate).
    h.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.click(); }
    });
  });

  // Wire mover buttons. Reorder by splicing the group's cards in app.cards
  // — exactly the same algorithm drag-and-drop uses, just with the
  // adjacent group determined by direction (-1 = up, +1 = down) rather
  // than by drop target. This gives the user a clean, click-only path to
  // reorder without HTML5 drag's imprecise-drag-becomes-click failure mode.
  function _moveTraditionGroup(tradId, direction) {
    if (!tradId || tradId === '__ungrouped__') return;
    // Build the current group order from app.cards iteration (first-appearance).
    // __ungrouped__ doesn't participate.
    const seen = [];
    for (const card of app.cards) {
      if (!card.traditionId) continue;
      if (seen.indexOf(card.traditionId) === -1) seen.push(card.traditionId);
    }
    const idx = seen.indexOf(tradId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= seen.length) return;
    const otherId = seen[targetIdx];
    // Lift the moving group out of app.cards, then splice it back in either
    // BEFORE the other group's first card (when moving up) or AFTER the
    // other group's last card (when moving down).
    const sourceCards = app.cards.filter(c => c.traditionId === tradId);
    const remaining = app.cards.filter(c => c.traditionId !== tradId);
    if (direction === -1) {
      // UP — splice before otherId's first card in remaining
      const insertAt = remaining.findIndex(c => c.traditionId === otherId);
      app.cards = insertAt === -1
        ? [...remaining, ...sourceCards]
        : [...remaining.slice(0, insertAt), ...sourceCards, ...remaining.slice(insertAt)];
    } else {
      // DOWN — splice after otherId's last card in remaining
      let lastOtherIdx = -1;
      for (let i = remaining.length - 1; i >= 0; i--) {
        if (remaining[i].traditionId === otherId) { lastOtherIdx = i; break; }
      }
      app.cards = lastOtherIdx === -1
        ? [...remaining, ...sourceCards]
        : [...remaining.slice(0, lastOtherIdx + 1), ...sourceCards, ...remaining.slice(lastOtherIdx + 1)];
    }
    if (typeof pushHistory === 'function') pushHistory();
    renderAll();
  }
  host.querySelectorAll('[data-move-trad-up]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (b.disabled) return;
      _moveTraditionGroup(b.dataset.moveTradUp, -1);
    });
  });
  host.querySelectorAll('[data-move-trad-down]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (b.disabled) return;
      _moveTraditionGroup(b.dataset.moveTradDown, +1);
    });
  });

  // ─── Drag-and-drop tradition reorder (Phase 3b) ───
  // Headers are draggable; on drop, the dragged group's cards are spliced
  // into app.cards immediately before the drop target group's cards.
  // The __ungrouped__ pseudo-group isn't draggable (headers without
  // draggable="true" attribute won't fire dragstart).
  host.querySelectorAll('.sb-tradition-header[draggable="true"]').forEach(h => {
    h.addEventListener('dragstart', e => {
      const tradId = h.parentElement.dataset.traditionId;
      app._dragTraditionId = tradId;
      app._dragCardId = null;  // distinguish group drag from card drag
      e.dataTransfer.effectAllowed = 'move';
      // Setting any text on dataTransfer is required for the drag to be
      // considered "valid" by some browsers (Firefox in particular).
      e.dataTransfer.setData('text/plain', 'tradition:' + tradId);
    });
    h.addEventListener('dragend', () => {
      app._dragTraditionId = null;
      host.querySelectorAll('.sb-tradition-group.is-drag-over, .sb-tradition-group.is-drag-over-top, .sb-tradition-group.is-drag-over-bottom')
        .forEach(g => { g.classList.remove('is-drag-over'); g.classList.remove('is-drag-over-top'); g.classList.remove('is-drag-over-bottom'); });
    });
  });

  host.querySelectorAll('.sb-tradition-group').forEach(g => {
    g.addEventListener('dragover', e => {
      const targetTradId = g.dataset.traditionId;
      if (targetTradId === '__ungrouped__') return;
      // Group-onto-group drag: don't accept drop on self
      if (app._dragTraditionId && app._dragTraditionId !== targetTradId) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Above vs below based on cursor Y relative to group bounding box.
        // Clear sibling indicators first to avoid sticky decoration when the
        // cursor moves across multiple groups quickly.
        host.querySelectorAll('.sb-tradition-group.is-drag-over-top, .sb-tradition-group.is-drag-over-bottom')
          .forEach(o => { o.classList.remove('is-drag-over-top'); o.classList.remove('is-drag-over-bottom'); });
        const rect = g.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (e.clientY < midpoint) {
          g.classList.add('is-drag-over-top');
        } else {
          g.classList.add('is-drag-over-bottom');
        }
        return;
      }
      // Card-onto-group drag: don't accept drop on the card's own group
      // (within-group reorder isn't supported in v1 — group-level only).
      if (app._dragCardId) {
        const dragCard = app.cards.find(c => c.id === app._dragCardId);
        if (dragCard && dragCard.traditionId !== targetTradId) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          g.classList.add('is-drag-over');
        }
      }
    });
    g.addEventListener('dragleave', e => {
      // Only clear when actually leaving the group, not when entering a child.
      // Using contains check: relatedTarget null means leaving the document, or
      // outside-of-g child cases.
      if (!g.contains(e.relatedTarget)) {
        g.classList.remove('is-drag-over');
        g.classList.remove('is-drag-over-top');
        g.classList.remove('is-drag-over-bottom');
      }
    });
    g.addEventListener('drop', e => {
      const dropAbove = g.classList.contains('is-drag-over-top');
      g.classList.remove('is-drag-over');
      g.classList.remove('is-drag-over-top');
      g.classList.remove('is-drag-over-bottom');
      const targetId = g.dataset.traditionId;
      if (targetId === '__ungrouped__') return;
      e.preventDefault();

      // Tradition-group drop: reorder app.cards. Source cards land either
      // BEFORE the target's first card (dropAbove) or AFTER the target's
      // last card (dropBelow). The above/below decision was made during
      // dragover from cursor Y relative to the target's midpoint.
      if (app._dragTraditionId && app._dragTraditionId !== targetId) {
        const sourceId = app._dragTraditionId;
        const sourceCards = app.cards.filter(c => c.traditionId === sourceId);
        const remaining = app.cards.filter(c => c.traditionId !== sourceId);
        if (dropAbove) {
          // Insert before target's first card
          const targetIdx = remaining.findIndex(c => c.traditionId === targetId);
          if (targetIdx === -1) {
            app.cards = [...remaining, ...sourceCards];
          } else {
            app.cards = [...remaining.slice(0, targetIdx), ...sourceCards, ...remaining.slice(targetIdx)];
          }
        } else {
          // Insert after target's last card
          let lastTargetIdx = -1;
          for (let i = remaining.length - 1; i >= 0; i--) {
            if (remaining[i].traditionId === targetId) { lastTargetIdx = i; break; }
          }
          if (lastTargetIdx === -1) {
            app.cards = [...remaining, ...sourceCards];
          } else {
            app.cards = [...remaining.slice(0, lastTargetIdx + 1), ...sourceCards, ...remaining.slice(lastTargetIdx + 1)];
          }
        }
        app._dragTraditionId = null;
        if (typeof pushHistory === 'function') pushHistory();
        renderAll();
        return;
      }

      // Card drop: reparent the dragged card to this tradition group
      if (app._dragCardId) {
        const dragCard = app.cards.find(c => c.id === app._dragCardId);
        if (dragCard && dragCard.traditionId !== targetId) {
          dragCard.traditionId = targetId;
          // Move the card next to its new tradition's existing members
          app.cards = app.cards.filter(c => c.id !== dragCard.id);
          const insertIdx = app.cards.findIndex(c => c.traditionId === targetId);
          if (insertIdx === -1) {
            app.cards.push(dragCard);
          } else {
            // Insert AFTER the last card of the target tradition so it appears
            // at the end of the group rather than the start.
            let lastIdx = -1;
            for (let i = 0; i < app.cards.length; i++) {
              if (app.cards[i].traditionId === targetId) lastIdx = i;
            }
            app.cards.splice(lastIdx + 1, 0, dragCard);
          }
          app._dragCardId = null;
          if (typeof pushHistory === 'function') pushHistory();
          renderAll();
        }
      }
    });
  });

  // Wire tradition-delete buttons — bulk-remove all cards with that traditionId
  // in one undoable action. Uses skipHistory: true per rmCard to avoid one
  // history entry per card; pushHistory() runs once after the batch.
  host.querySelectorAll('[data-delete-tradition]').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tradId = b.dataset.deleteTradition;
      const trad = Tradition(tradId);
      const tradName = (trad && trad.name) || tradId;
      const cards = app.cards.filter(c => c.traditionId === tradId);
      // Blur immediately so the focus-ring + hover-state release before the
      // modal paints — otherwise the button can appear "stuck" in danger-red.
      b.blur();
      const ok = await confirmDialog({
        title: 'Remove tradition',
        message: `Remove ${tradName} (${cards.length} card${cards.length === 1 ? '' : 's'}) from the workspace? You can undo with Ctrl/Cmd+Z.`,
        confirmLabel: 'Remove',
        danger: true,
      });
      if (!ok) return;
      for (const c of cards) rmCard(c.id, { skipHistory: true });
      if (typeof pushHistory === 'function') pushHistory();
      showToast(`Removed ${tradName} (${cards.length} card${cards.length === 1 ? '' : 's'})`, 'success');
    });
  });

  // Wire card selection
  host.querySelectorAll('.sb-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const cardId = btn.dataset.cardId;
      // Mobile: the row is a disclosure, so a second tap on the open one
      // closes it. Desktop has a permanent detail pane — there is nothing to
      // close, and clearing the selection would blank half the screen.
      const collapse = isMobileLayout() && app.selected === cardId;
      app.selected = collapse ? null : cardId;
      renderSidebarTraditions();
      if (!isMobileLayout()) renderDetail();  // else: remounted by the line above
      if (!collapse) _revealSelectedCard();
    });
    // ─── Card drag (Phase 3c) ───
    // Card drags reparent across tradition groups. Group drop handler reads
    // app._dragCardId (set here) vs app._dragTraditionId (set on header drag)
    // to know whether it's a card-onto-group or group-onto-group drop.
    btn.addEventListener('dragstart', e => {
      const cardId = btn.dataset.cardId;
      app._dragCardId = cardId;
      app._dragTraditionId = null;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'card:' + cardId);
      e.stopPropagation();  // don't bubble into tradition-header dragstart
    });
    btn.addEventListener('dragend', () => {
      app._dragCardId = null;
      host.querySelectorAll('.sb-tradition-group.is-drag-over, .sb-tradition-group.is-drag-over-top, .sb-tradition-group.is-drag-over-bottom')
        .forEach(g => { g.classList.remove('is-drag-over'); g.classList.remove('is-drag-over-top'); g.classList.remove('is-drag-over-bottom'); });
    });
  });

  // Wire "Add to tradition" buttons — opens existing instrument modal with
  // tradition pre-context (stored on the modal for the add handler to read).
  host.querySelectorAll('[data-add-to-trad]').forEach(b => {
    b.addEventListener('click', () => {
      const tradId = b.dataset.addToTrad;
      app._addToTradition = tradId;
      app.pickerSearch = '';
      const si = document.getElementById('search-inst');
      if (si) si.value = '';
      renderInstPicker();
      openModal('modal-add');
    });
  });

  // MOBILE: the inline detail panel lived inside the subtree the innerHTML
  // assignment above just replaced, so rebuild it. Every caller that repaints
  // the tree — selection, collapse, reorder, filter — lands here, which is why
  // the remount belongs in this function rather than at each call site.
  if (isMobileLayout()) {
    host.querySelectorAll('.sb-card').forEach(b => b.setAttribute('aria-expanded', 'false'));
    renderDetail();
  }
}

function renderSidebarCard(card) {
  const inst = Inst(card.instrumentId);
  if (!inst) return '';
  const family = inst.family;
  const familyTint = (typeof FAMILY_COLORS !== 'undefined' && FAMILY_COLORS[family])
    ? FAMILY_COLORS[family] + '22'  // ~13% alpha
    : 'var(--surface-2)';
  const familyColor = (typeof FAMILY_COLORS !== 'undefined' && FAMILY_COLORS[family]) || 'var(--text-3)';
  const isSelected = app.selected === card.id;
  const prefaceLabel = prefaceLabelFor(card);
  const name = inst.short || inst.name;
  const familyName = (typeof FamName === 'function' ? FamName(family) : family).toUpperCase().replace(/_/g, ' ');
  const thumb = (typeof image === 'function') ? image(card.instrumentId, 24) : '';
  const fingerprint = card.traditionId && typeof renderFingerprint === 'function' ? renderFingerprint(card.traditionId) : '';

  return (
    '<button class="sb-card' + (isSelected ? ' is-selected' : '') + (card.pinned ? ' is-pinned' : '') + '" data-card-id="' + esc(card.id) + '" draggable="true" ' +
      'style="--family-tint: ' + familyTint + '; --family-color: ' + familyColor + ';">' +
      '<div class="sb-card-thumb">' + thumb + '</div>' +
      '<div class="sb-card-text">' +
        '<div class="sb-card-line1">' +
          (prefaceLabel ? '<span class="sb-preface">' + esc(prefaceLabel) + '</span>' : '') +
          '<span class="sb-name">' + esc(name) + '</span>' +
        '</div>' +
        '<div class="sb-card-line2">' +
          '<span class="sb-family">' + esc(familyName) + '</span>' +
          (card.pinned ? '<span class="sb-card-pin" data-tooltip="Pinned" aria-label="Pinned">' + icon('pin', 10) + '</span>' : '') +
          fingerprint +
        '</div>' +
      '</div>' +
    '</button>'
  );
}

// Suggest a staple (Phase 7). Picks a tradition sonically close to the
// workspace's primary tradition (using existing findSimilar() axis-space
// distance), filters out traditions already in the workspace, rotates
// through candidates via app._stapleIdx. Click imports the full tradition.
function renderSidebarStaple() {
  const host = document.getElementById('sidebar-staple');
  if (!host) return;

  const primaryCardId = _determinePrimaryCard(app.cards);
  const primaryCard = app.cards.find(c => c.id === primaryCardId);
  const primaryTradId = primaryCard ? primaryCard.traditionId : null;
  if (!primaryTradId || typeof findSimilar !== 'function') { host.innerHTML = ''; return; }

  // Get pool of similar traditions, exclude already-in-workspace
  const inWorkspace = new Set(app.cards.map(c => c.traditionId).filter(Boolean));
  const pool = findSimilar(primaryTradId, 16).filter(s => !inWorkspace.has(s.id));
  if (pool.length === 0) { host.innerHTML = ''; return; }

  // Rotation index
  if (typeof app._stapleIdx !== 'number') app._stapleIdx = 0;
  const pick = pool[app._stapleIdx % pool.length];
  const trad = Tradition(pick.id);
  if (!trad) { host.innerHTML = ''; return; }

  host.innerHTML =
    '<div class="sb-staple">' +
      '<div class="sb-staple-head">' +
        icon('sparkles', 12) +
        '<span class="ws-label">Suggest a staple</span>' +
        (pool.length > 1
          ? '<button class="icon-btn sb-staple-refresh" id="sb-staple-refresh" data-tooltip="Try another" aria-label="Try another suggestion">' + icon('refresh-cw', 11) + '</button>'
          : '') +
      '</div>' +
      '<div class="sb-staple-body"><span class="sb-staple-name">' + esc(trad.name) + '</span> sits close to this primary in axis space.</div>' +
      '<button class="sb-staple-add" id="sb-staple-add">' + icon('plus', 12) + 'Add ' + esc(trad.name) + ' as secondary</button>' +
    '</div>';

  const refresh = document.getElementById('sb-staple-refresh');
  if (refresh) refresh.addEventListener('click', () => {
    app._stapleIdx = (app._stapleIdx + 1) % pool.length;
    renderSidebarStaple();
  });

  const add = document.getElementById('sb-staple-add');
  if (add) add.addEventListener('click', async () => {
    if (typeof importTradition === 'function') {
      try { await Catalog.ensureFull(pick.id); }
      catch { showToast('Could not load tradition data — check your connection', 'error'); return; }
      const cards = importTradition(pick.id);
      // Select the first card from the newly-added tradition
      if (cards && cards.length) {
        app.selected = cards[0].id;
      }
      app._stapleIdx = 0;  // Reset rotation since the candidate is consumed
      renderAll();
    }
  });
}
// full workspace, with char count against the 1000-char ceiling, 3-band
// progress bar, fade-truncated text, and "Open full stack →" → modal-recipe-stack.
function renderSidebarRecipePreview() {
  const host = document.getElementById('sidebar-recipe-preview');
  if (!host) return;
  if (app.cards.length === 0) { host.innerHTML = ''; _syncRecipeBarHeight(); return; }

  const CEILING = RECIPE_CHAR_CEILING;
  let text = '';
  // Route through compileRecipeStack — same path the modal uses — so the
  // sidebar gets the tradition header (e.g. "Gangsta rap + UK drill + West
  // Coast hip-hop (classic LA), ...") and the recipe-wide preface dedup
  // pass. Earlier this called compressRichRecipe directly, which produced
  // a headerless body and skipped the dedup overrides; the two surfaces
  // had drifted apart visibly.
  try { text = compileRecipeStack(app.cards, 'rich', { ceiling: CEILING }) || ''; } catch { text = ''; }
  const len = text.length;
  const pct = Math.min(100, Math.round((len / CEILING) * 100));
  const band = pct > 90 ? 'is-red' : (pct > 70 ? 'is-amber' : '');

  // Below 900px this box is pinned to the bottom of the viewport, so it is the
  // one surface guaranteed to be on screen at every scroll position. Undo,
  // redo and copy therefore ride here rather than in the app bar — a phone has
  // no Ctrl+Z, and they are thumb-reachable at the bottom edge. `.rp-tool` and
  // `.rp-expand` are display:none above 900px, where the app bar already
  // carries undo/redo and the panel is permanently open.
  const expanded = !!app._recipeSheetOpen;
  host.classList.toggle('is-expanded', expanded);
  host.innerHTML =
    '<div class="rp-head">' +
      icon('diamond', 12) +
      '<span class="rp-label">Current recipe</span>' +
      '<span class="rp-count ' + band + '">' + len + ' / ' + CEILING + '</span>' +
      '<button class="icon-btn rp-tool" data-proxy="btn-undo" aria-label="Undo">' + icon('undo', 14) + '</button>' +
      '<button class="icon-btn rp-tool" data-proxy="btn-redo" aria-label="Redo">' + icon('redo', 14) + '</button>' +
      '<button class="icon-btn rp-copy" id="sb-recipe-copy" data-tooltip="Copy recipe" data-tooltip-pos="bottom" aria-label="Copy recipe">' + icon('copy', 12) + '</button>' +
      '<button class="icon-btn rp-expand" id="sb-recipe-expand" aria-expanded="' + expanded + '" ' +
        // chevron-up is not vendored; the glyph is chevron-down rotated by CSS.
        'aria-label="' + (expanded ? 'Collapse recipe' : 'Expand recipe') + '">' + icon('chevron-down', 14) + '</button>' +
    '</div>' +
    '<div class="rp-progress"><div class="rp-progress-fill ' + band + '" style="width: ' + pct + '%;"></div></div>' +
    (text
      ? '<div class="rp-text">' + esc(text) + '</div>'
      : '<div class="rp-empty">Nothing configured yet.</div>') +
    '<button class="rp-open" id="sb-open-full-stack">Open full stack ' + icon('arrow-right', 12) + '</button>';

  const expandBtn = document.getElementById('sb-recipe-expand');
  if (expandBtn) expandBtn.addEventListener('click', () => {
    app._recipeSheetOpen = !app._recipeSheetOpen;
    renderSidebarRecipePreview();
    _syncRecipeBarHeight();
  });
  // Mirror the real buttons' disabled state so a greyed-out Undo reads as
  // greyed-out here too; the click itself is forwarded, not reimplemented.
  host.querySelectorAll('[data-proxy]').forEach(b => {
    const src = document.getElementById(b.dataset.proxy);
    b.disabled = !src || src.disabled;
    b.addEventListener('click', () => { if (src) src.click(); });
  });

  const copy = document.getElementById('sb-recipe-copy');
  if (copy) copy.addEventListener('click', () => {
    if (!text) { if (typeof showToast === 'function') showToast('Nothing to copy', 'error'); return; }
    if (typeof copyToClipboard === 'function') {
      copyToClipboard(text, 'Copied recipe (' + len + ' chars)', 'Copy failed — try Cmd/Ctrl+C');
    }
  });
  const open = document.getElementById('sb-open-full-stack');
  if (open) open.addEventListener('click', () => {
    if (typeof renderRecipeStack === 'function') renderRecipeStack();
    if (typeof openModal === 'function') openModal('modal-recipe-stack');
  });
  _syncRecipeBarHeight();
}
// Right-pane content for the currently-selected card. Composes 6 layers:
// breadcrumb + action cluster, header (thumb + title + fingerprint), trait
// pills, tab bar, tab content. The four tabs (Parts / Environment / Signal
// chain / Preface) reuse existing renderPartsSection / renderEnvSection /
// renderChainSection / renderPrefaceSection — events delegate to handleCardClick
// just like in the original card UI.

function renderDetail() {
  const host = document.getElementById('workspace-detail');
  const emptyEl = document.getElementById('empty-state');
  if (!host) return;

  // Remove any previous detail view
  const existing = document.getElementById('detail-view');
  if (existing) existing.remove();

  if (app.cards.length === 0) {
    // No workspace content — show empty state, no detail.
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  // Hide the empty state whenever cards exist. Detail view is the canonical
  // right-pane content; the legacy multi-card canvas was retired in the
  // master-detail refactor.
  if (emptyEl) emptyEl.style.display = 'none';

  // Resolve selection. Desktop falls back to the first card because the detail
  // pane is permanent — an empty right half is not a state worth showing.
  // Mobile has no pane to fill: "nothing selected" means every genre row is
  // collapsed, which is a legitimate (and useful) view of a long tree.
  let card = app.cards.find(c => c.id === app.selected);
  if (!card) {
    if (isMobileLayout()) return;
    card = app.cards[0];
    app.selected = card.id;
  }
  const inst = Inst(card.instrumentId);
  if (!inst) return;

  // Default tab
  if (!card._uiTab) card._uiTab = 'preface';

  const family = inst.family;
  const familyTint = (typeof FAMILY_COLORS !== 'undefined' && FAMILY_COLORS[family])
    ? FAMILY_COLORS[family] + '22'
    : 'var(--surface-2)';

  const view = document.createElement('div');
  view.id = 'detail-view';
  view.className = 'detail-view';
  view.dataset.cardId = card.id;
  view.style.setProperty('--family-tint', familyTint);

  view.appendChild(renderDetailBreadcrumb(card, inst));
  // Stack signature strip — visible when 2+ cards in workspace. Surfaces the
  // workspace centroid + 4 nearest traditions so the multi-card recipe state
  // is inspectable in the detail pane. Lost in the master-detail refactor
  // until restored as Phase 2 of the UI Capability Inventory Plan.
  const stackSig = renderDetailStackSignature();
  if (stackSig) view.appendChild(stackSig);
  view.appendChild(renderDetailHeader(card, inst));
  view.appendChild(renderDetailTraitPills(card, inst));
  // Auto-reconfigure explainer — mounted here (not inside the Preface tab) so the
  // "what changed automatically" panel is visible no matter which tab is open when
  // a part edit or a preface pick reshapes the card.
  renderShiftsPanel(card, view);
  view.appendChild(renderDetailTabBar(card, inst));
  view.appendChild(renderDetailTabContent(card, inst));

  // Single delegated click handler — reuses the existing per-card action
  // handler that the original full-card UI used. Keeps every variant-picker /
  // tuning-picker / chain-toggle interaction working identically.
  view.addEventListener('click', e => handleCardClick(e, card));

  // MOUNT POINT. On mobile the panel belongs to the row that opened it, so it
  // goes directly after that .sb-card inside the tree — tapping an instrument
  // expands it in place rather than repainting a second pane you cannot see.
  // Everything above this line is layout-independent: both layouts render the
  // identical panel, with the identical handlers.
  const anchor = isMobileLayout() ? _detailAnchorFor(card.id) : null;
  if (anchor) {
    anchor.insertAdjacentElement('afterend', view);
    anchor.setAttribute('aria-expanded', 'true');
  } else {
    host.appendChild(view);
  }
}

// The .sb-card button for a card, or null if the tree isn't showing it (the
// sidebar filter can hide it, and there is no tree at all with zero cards).
function _detailAnchorFor(cardId) {
  const tree = document.getElementById('sidebar-traditions');
  if (!tree || !cardId) return null;
  return [...tree.querySelectorAll('.sb-card')].find(b => b.dataset.cardId === cardId) || null;
}

// After a tap expands a row, bring it under the app bar — but only if it isn't
// already sitting somewhere sensible, so tapping through a short list doesn't
// jerk the page on every tap.
function _revealSelectedCard() {
  if (!isMobileLayout()) return;
  requestAnimationFrame(() => {
    const anchor = _detailAnchorFor(app.selected);
    if (!anchor) return;
    const barH = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--app-bar-height'), 10
    ) || 56;
    const top = anchor.getBoundingClientRect().top;
    if (top >= barH && top <= window.innerHeight * 0.5) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: top - barH - 8, behavior: reduce ? 'auto' : 'smooth' });
  });
}

// Stack signature strip — surfaces the workspace centroid + 4 nearest
// traditions when 2+ cards are in the canvas. Lives between the detail
// breadcrumb and the detail header. Returns null when fewer than 2 cards
// (the per-card detail header already carries the single-card fingerprint).
//
// Reuses buildSongFingerprint (centroid + spread + nearestTraditions) and
// renderAxisFingerprint ('small' variant). Click handlers wire through
// wireStackSignatureEvents — clicking a tradition pill opens the tradition
// modal pinned to that tradition's similar-traditions view.
function renderDetailStackSignature() {
  if (app.cards.length < 2) return null;
  if (typeof buildSongFingerprint !== 'function') return null;

  const fp = buildSongFingerprint(app.cards);
  if (!fp) return null;

  const trads = (fp.nearestTraditions || []).slice(0, 4);
  const tradHtml = trads.length
    ? trads.map(t => `<button class="dss-trad" data-stack-trad="${esc(t.id)}" data-tooltip="distance ${t.distance.toFixed(2)} · ${t.instrumentCount} canonical instruments">${esc(t.name)}</button>`).join('')
    : '<span class="dss-empty">no clear tradition match</span>';

  const wrap = document.createElement('div');
  wrap.className = 'detail-stack-signature';
  wrap.innerHTML =
    `<div class="dss-fingerprint">${renderAxisFingerprint(fp.centroid, 'small')}</div>` +
    `<div class="dss-info">` +
      `<div class="dss-label">Stack signature · ${fp.instrumentCount} instrument${fp.instrumentCount === 1 ? '' : 's'} · ${esc(diversityLabel(fp.diversity))}</div>` +
      `<div class="dss-traditions">${tradHtml}</div>` +
    `</div>` +
    `<button class="dss-browse" data-stack-detail>${icon('arrow-right', 12)} Browse near</button>`;

  // Reuse the existing event-wiring helper — opens the tradition modal at
  // the relevant tradition's similar-traditions view on tradition-pill click,
  // or at the closest match on "Browse near" click.
  if (typeof wireStackSignatureEvents === 'function') {
    wireStackSignatureEvents(wrap);
  }

  return wrap;
}

function renderDetailBreadcrumb(card, _inst) {
  const wrap = document.createElement('div');
  wrap.className = 'detail-breadcrumb-row';

  const trad = card.traditionId ? Tradition(card.traditionId) : null;
  const primaryId = _determinePrimaryCard(app.cards);
  const primaryCard = app.cards.find(c => c.id === primaryId);
  const primaryTradId = primaryCard ? primaryCard.traditionId : null;
  const isPrimary = card.traditionId && card.traditionId === primaryTradId;

  const left = document.createElement('div');
  left.className = 'detail-breadcrumb';
  left.setAttribute('role', 'button');
  left.setAttribute('tabindex', '0');
  const tradName = trad ? trad.name.toUpperCase() : 'UNGROUPED';
  left.innerHTML = '<span>' + esc(tradName) + '</span>' +
    (trad ? '<span class="detail-breadcrumb-status' + (isPrimary ? '' : ' secondary') + '">' + (isPrimary ? 'PRIMARY' : 'SECONDARY') + '</span>' : '');
  if (card.traditionId) {
    left.addEventListener('click', () => {
      // Scroll sidebar to that tradition group
      const grp = document.querySelector('#sidebar-traditions [data-tradition-id="' + card.traditionId + '"]');
      if (grp) grp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    // Keyboard parity for the role="button" breadcrumb (Enter/Space activate).
    left.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); left.click(); }
    });
  }
  wrap.appendChild(left);

  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  actions.innerHTML =
    '<button class="icon-btn" data-action="pin" data-tooltip="' + (card.pinned ? 'Unpin' : 'Pin') + '" aria-label="' + (card.pinned ? 'Unpin' : 'Pin') + '">' + icon('pin', 14) + '</button>' +
    '<button class="icon-btn" data-action="similar" data-tooltip="Find similar" aria-label="Find similar">' + icon('network', 14) + '</button>' +
    '<button class="icon-btn" data-action="drift" data-tooltip="Drift this card" aria-label="Drift">' + icon('shuffle', 14) + '</button>' +
    '<button class="icon-btn" data-action="duplicate" data-tooltip="Duplicate" aria-label="Duplicate">' + icon('copy', 14) + '</button>' +
    '<button class="icon-btn is-danger" data-action="delete" data-tooltip="Remove" aria-label="Remove">' + icon('trash-2', 14) + '</button>';
  wrap.appendChild(actions);
  return wrap;
}

function renderDetailHeader(card, inst) {
  const wrap = document.createElement('div');
  wrap.className = 'detail-header';

  // Thumbnail
  const thumb = document.createElement('div');
  thumb.className = 'detail-thumb';
  thumb.innerHTML = (typeof image === 'function') ? image(card.instrumentId, 56) : '';
  wrap.appendChild(thumb);

  // Title block
  const titleBlock = document.createElement('div');
  titleBlock.className = 'detail-title-block';
  const prefaceLabel = prefaceLabelFor(card);
  const name = inst.short || inst.name;
  const familyName = (typeof FamName === 'function' ? FamName(inst.family) : inst.family).toUpperCase().replace(/_/g, ' ');
  const subtitleExtra = inst.short && inst.name && inst.short !== inst.name ? inst.name : '';
  // Primary marker: surfaces when the displayed card is the workspace's
  // primary (first card with a traditionId). The PRIMARY pill in the sidebar
  // marks the tradition group; this marks the card itself so the semantic
  // travels with the user into the detail pane. Tooltip explains the meaning
  // for users who haven't encountered the term elsewhere.
  const primaryId = _determinePrimaryCard(app.cards);
  const isPrimaryCard = primaryId === card.id;
  const primaryBadge = isPrimaryCard
    ? '<span class="detail-primary-marker" data-tooltip="Anchor card — its tradition anchors the recipe. Adding instruments via Add a Genre or staples builds on this tradition." data-tooltip-pos="bottom">ANCHOR</span>'
    : '';
  titleBlock.innerHTML =
    '<div class="detail-title">' +
      (prefaceLabel ? '<span class="detail-preface">' + esc(prefaceLabel) + '</span>' : '') +
      '<span>' + esc(name) + '</span>' +
      primaryBadge +
    '</div>' +
    '<div class="detail-subtitle">' +
      '<span class="detail-family">' + esc(familyName) + '</span>' +
      (subtitleExtra ? '<span class="detail-sep">·</span><span>' + esc(subtitleExtra) + '</span>' : '') +
    '</div>';
  wrap.appendChild(titleBlock);

  // Fingerprint panel
  const fp = document.createElement('div');
  fp.className = 'detail-fingerprint-panel';
  if (card.traditionId && typeof renderFingerprint === 'function') {
    fp.innerHTML = '<div class="ws-label">FINGERPRINT</div>' + renderFingerprint(card.traditionId);
  }
  wrap.appendChild(fp);
  return wrap;
}

function renderDetailTraitPills(card, _inst) {
  const wrap = document.createElement('div');
  wrap.className = 'detail-trait-pills';
  if (typeof buildStackParts !== 'function') return wrap;
  const stack = buildStackParts(card);
  const instChunk = stack.find(p => p.kind === 'instrument');
  if (!instChunk || !instChunk.descriptors) return wrap;
  const pills = instChunk.descriptors.slice(0, 6);
  wrap.innerHTML = pills.map(d => '<span class="trait-pill">' + esc(d) + '</span>').join('');
  return wrap;
}

function renderDetailTabBar(card, inst) {
  const wrap = document.createElement('div');
  wrap.className = 'detail-tab-bar';
  const tabs = [
    { id: 'preface', label: 'Preface',      ic: 'sparkles' },
    { id: 'parts',   label: 'Parts',        ic: 'sliders-horizontal' },
    { id: 'env',     label: 'Environment',  ic: 'layers' },
    { id: 'chain',   label: 'Signal chain', ic: 'link' },
    { id: 'stack',   label: 'Stack',        ic: 'eye' },
  ];
  wrap.innerHTML = tabs.map(t =>
    '<button class="detail-tab' + (card._uiTab === t.id ? ' is-active' : '') + '" data-tab="' + t.id + '">' +
      icon(t.ic, 14) + '<span>' + t.label + '</span>' +
    '</button>'
  ).join('');

  // Status string (right side)
  const partCount = (inst.parts || []).length;
  const chainCount = (typeof CHAIN_SECTIONS !== 'undefined') ? CHAIN_SECTIONS.length : 0;
  const status = document.createElement('span');
  status.className = 'detail-tab-status';
  status.textContent = partCount + ' part' + (partCount === 1 ? '' : 's') + ' · ' + chainCount + ' chain stage' + (chainCount === 1 ? '' : 's');
  wrap.appendChild(status);

  // Wire tab switching (these aren't card actions so they don't go through handleCardClick)
  wrap.querySelectorAll('.detail-tab').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      card._uiTab = b.dataset.tab;
      renderDetail();
    });
  });
  return wrap;
}

function renderDetailTabContent(card, inst) {
  const wrap = document.createElement('div');
  wrap.className = 'detail-tab-content';
  switch (card._uiTab) {
    case 'parts':
      wrap.appendChild(renderPartsSection(card, inst));
      break;
    case 'env':
      wrap.appendChild(renderEnvSection(card));
      break;
    case 'chain':
      wrap.appendChild(renderChainSection(card));
      break;
    case 'preface':
      wrap.appendChild(renderPrefaceSection(card));
      break;
    case 'stack':
      // Lazy-init the stack panel state so renderStackPanel has a format.
      if (!card.stackPanel) card.stackPanel = { format: 'rich' };
      wrap.appendChild(renderStackPanel(card));
      break;
    default:
      wrap.appendChild(renderPartsSection(card, inst));
  }
  // Drift panel always rendered below tab content when active — keeps the
  // drift workflow visible across tab switches.
  if (card.drift) wrap.appendChild(renderDriftPanel(card));
  return wrap;
}
// Snapshot-based history: each coarse user action records a JSON-stringified
// snapshot of app.cards AFTER the mutation. Undo decrements historyIndex and
// restores the previous snapshot; redo re-applies the next one. New mutations
// after an undo truncate the redo future (typical undo/redo semantics).
//
// What goes in history: add tradition (one entry for the whole batch), add
// instrument (single card add), remove card, delete tradition group, drag-
// reorder tradition. What does NOT go in history: variant picks within a
// card, environment edits (tuning/room/chain), expand/collapse, group fold/
// unfold. The line: structural changes to the workspace are undoable; in-
// card refinement isn't. (Easy to add finer-grained undo later if needed.)
function pushHistory() {
  // If user undid some steps then did a new action, drop the redo future.
  if (app.historyIndex < app.history.length - 1) {
    app.history.length = app.historyIndex + 1;
  }
  // Strip session-only transient state before snapshotting (same single-source
  // reset as save/load/fork/dup). Critically, `drift` holds candidate objects
  // with live `apply` closures that JSON drops — restoring such a snapshot would
  // leave a drift panel whose "Walk here" calls move.apply() → TypeError.
  const snapshot = JSON.stringify(app.cards.map(c => ({ ...c, ..._CARD_TRANSIENTS })));
  // Skip no-op pushes (mutation that left cards array structurally identical).
  if (app.history.length > 0 && app.history[app.history.length - 1] === snapshot) return;
  app.history.push(snapshot);
  if (app.history.length > HISTORY_MAX) app.history.shift();
  app.historyIndex = app.history.length - 1;
  updateHistoryButtons();
}
// Restore a history snapshot defensively — a corrupted entry must not blank the
// canvas or desync historyIndex (snapshots are app-produced, so this is a belt for
// memory pressure / any future external history store).
function _restoreSnapshot(idx) {
  try { app.cards = JSON.parse(app.history[idx]); return true; }
  catch (e) { console.error('history restore failed', e); showToast('Undo unavailable — history entry corrupted', 'error'); return false; }
}
function undo() {
  if (app.historyIndex <= 0) return;
  app.historyIndex--;
  if (!_restoreSnapshot(app.historyIndex)) { app.historyIndex++; return; }
  renderAll();
  updateHistoryButtons();
}
function redo() {
  if (app.historyIndex >= app.history.length - 1) return;
  app.historyIndex++;
  if (!_restoreSnapshot(app.historyIndex)) { app.historyIndex--; return; }
  renderAll();
  updateHistoryButtons();
}
function updateHistoryButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  if (undoBtn) undoBtn.disabled = app.historyIndex <= 0;
  if (redoBtn) redoBtn.disabled = app.historyIndex >= app.history.length - 1;
}

function renderPartRow(card, inst, part) {
  const row = document.createElement('div');
  row.className = 'part-row-grid' + (card.editingPart === part.id ? ' is-editing' : '');
  row.dataset.togglePart = part.id;
  const currentVar = Variant(inst, part.id, card.parts[part.id]);
  const isEditing = card.editingPart === part.id;
  const partLabel = (part.name || part.id).toUpperCase().replace(/_/g, ' ');
  const variantName = currentVar ? currentVar.name : '—';
  const descriptors = currentVar ? entryRenderDescs(currentVar) : [];
  const dotDescriptors = descriptors.join(' · ');
  const optionCount = (part.variants || []).length;

  // Part thumbnail uses the family fallback emoji — visually grounds the row
  // in the instrument's family without needing a per-part icon catalog.
  const thumbInner = (typeof image === 'function') ? image(inst.id, 32) : '';

  row.innerHTML =
    '<div class="part-thumb-cell">' + thumbInner + '</div>' +
    '<div class="part-label-cell">' + esc(partLabel) + '</div>' +
    '<div class="part-variant-cell">' + esc(variantName) + '</div>' +
    '<div class="part-descriptors-cell">' + esc(dotDescriptors) + '</div>' +
    '<div class="part-options-cell">' + optionCount + ' option' + (optionCount === 1 ? '' : 's') + ' ' + icon('chevron-right', 12) + '</div>';

  if (isEditing) {
    const variants = document.createElement('div');
    variants.className = 'part-variants-grid';
    // Variant chip delta preview: per-part scope only.
    //
    // The user is swapping ONE part's variant. The truthful delta is
    // descriptors-of-this-part-only, not the whole instrument's descriptor
    // set. Earlier behavior built a Set from every part on the instrument,
    // which mis-labeled descriptors that were only present in OTHER parts
    // as "kept" — they'd never have been kept by this swap because the
    // swap doesn't touch the other parts.
    //
    // Per-part semantics:
    //   is-kept = descriptor is in BOTH the current variant of this part
    //             AND the candidate variant (no change to the part's contribution)
    //   is-new  = descriptor is in the candidate variant but NOT in the
    //             current variant of this part (the swap would add it)
    //   is-lost = descriptor is in the current variant but NOT in the
    //             candidate variant (the swap would remove it; rendered as
    //             a separate strikethrough chip after the new variant's descrs)
    const currentVarDescs = currentVar ? new Set(entryRenderDescs(currentVar)) : new Set();
    // "Not set" chip — mirrors the chain/environment null option (setTuning/setRoom/setChain)
    // so a part can be left explicitly unset; an unset part contributes no descriptors
    // (Variant() returns null and the descriptor builders skip it).
    const noneChip = document.createElement('button');
    noneChip.className = 'chip variant-chip' + (!card.parts[part.id] ? ' selected' : '');
    noneChip.dataset.setPart = part.id;
    noneChip.dataset.variant = '';
    noneChip.innerHTML = '<span class="variant-chip-name">Not set</span>';
    variants.appendChild(noneChip);
    // Build one variant chip (with the per-part descriptor delta preview).
    const makeChip = v => {
      const b = document.createElement('button');
      const isCurrent = card.parts[part.id] === v.id;
      b.className = 'chip variant-chip' + (isCurrent ? ' selected' : '');
      b.dataset.setPart = part.id;
      b.dataset.variant = v.id;
      const descs = entryRenderDescs(v);
      const candDescSet = new Set(descs);
      // Lost descriptors: in current, not in candidate. Empty on the selected
      // chip (current === candidate, set difference is empty by definition).
      const lostDescs = isCurrent ? [] : [...currentVarDescs].filter(d => !candDescSet.has(d));
      const descrHtml = descs.length || lostDescs.length
        ? `<div class="variant-chip-descrs">${
            descs.map(d => {
              const isNew = !currentVarDescs.has(d);
              return `<span class="variant-chip-descr ${isNew ? 'is-new' : 'is-kept'}">${esc(d)}</span>`;
            }).join('') +
            lostDescs.map(d => `<span class="variant-chip-descr is-lost">${esc(d)}</span>`).join('')
          }</div>`
        : '';
      b.innerHTML = `<span class="variant-chip-name">${esc(v.name)}</span>${descrHtml}`;
      return b;
    };
    // The instrument's own (curated) variants stay on top, exactly as before.
    const nativeVars = part.variants.filter(v => !v.expanded);
    const expandedVars = part.variants.filter(v => v.expanded);
    nativeVars.forEach(v => variants.appendChild(makeChip(v)));
    row.appendChild(variants);
    // Universal cross-instrument materials (a sound generator isn't bound by
    // physical buildability) under a collapsed, searchable disclosure. Display-only
    // grouping — nothing is filtered out; every material stays reachable.
    if (expandedVars.length) {
      const det = document.createElement('details');
      det.className = 'part-expanded';
      // Persist open/closed across the rerenderCard() that selecting a material
      // triggers, so auditioning several borrowed materials doesn't re-collapse the
      // list on every pick. State is a per-card transient, reset when the edited
      // part changes (handleCardClick) so a freshly opened part starts collapsed.
      det.open = !!card._materialsOpen;
      det.addEventListener('toggle', () => { card._materialsOpen = det.open; });
      const kindLabel = expandedVars[0].expanded === 'wood' ? 'wood' : 'string';
      det.innerHTML = `<summary class="part-expanded-summary">More materials — any ${kindLabel} on any instrument (${expandedVars.length})</summary>`;
      // The part row carries data-toggle-part, and handleCardClick (delegated on the
      // card view) routes any click inside it that isn't a button/chip to "collapse
      // this part". A <summary> is none of those, so its click would bubble up and
      // collapse the whole part — the exact symptom of clicking "More materials"
      // closing the part. Stop the summary's click here: the native <details> toggle
      // is the click's DEFAULT action (stopPropagation doesn't cancel it), so the
      // disclosure still opens/closes. Chips inside the body keep bubbling so
      // [data-set-part] selection still reaches handleCardClick. Same guard the
      // inline filter bar uses below.
      det.querySelector('summary').addEventListener('click', e => e.stopPropagation());
      // Filter + grid live in a body wrapper so the <summary> stays the literal
      // first child (native disclosure) and the filter input sits below the header.
      const body = document.createElement('div');
      body.className = 'part-expanded-body';
      const exGrid = document.createElement('div');
      exGrid.className = 'part-variants-grid part-expanded-grid';
      expandedVars.forEach(v => exGrid.appendChild(makeChip(v)));
      body.appendChild(exGrid);
      det.appendChild(body);
      row.appendChild(det);
      if (typeof attachInlineFilter === 'function') {
        attachInlineFilter(body, { itemSelector: '.variant-chip', placeholder: 'Filter materials…' });
      }
    }
  }
  return row;
}

function renderPartsSection(card, inst) {
  const sec = document.createElement('section');
  sec.className = 'composer-section';
  sec.innerHTML = `<div class="composer-section-title">Parts</div>`;
  const list = document.createElement('div');
  list.className = 'parts-list';
  // Family tint passed through CSS variable so part rows can use family color
  // for their thumb backgrounds and accent edges.
  const family = inst.family;
  const familyTint = (typeof FAMILY_COLORS !== 'undefined' && FAMILY_COLORS[family])
    ? FAMILY_COLORS[family] + '22'
    : 'var(--surface-2)';
  list.style.setProperty('--family-tint', familyTint);
  inst.parts.forEach(part => {
    list.appendChild(renderPartRow(card, inst, part));
  });
  sec.appendChild(list);
  return sec;
}

// Attach a live text filter to an already-rendered option panel (the expanded
// tuning / room / chain pickers). Filters .chip-block options by visible text
// via show/hide — no re-render, so the input keeps focus while typing. Clicks
// and keys are stopped from bubbling to the row's expand/collapse handler.
// `groupSelector` (optional) hides group wrappers that have no visible item.
function attachInlineFilter(panel, opts) {
  opts = opts || {};
  const itemSel = opts.itemSelector || '.chip-block';
  const bar = document.createElement('div');
  bar.className = 'inline-filter';
  bar.innerHTML = '<span class="inline-filter-icon">' + icon('search', 13) + '</span>' +
    '<input type="search" class="inline-filter-input" placeholder="' + esc(opts.placeholder || 'Filter…') + '" autocomplete="off">' +
    '<span class="inline-filter-count"></span>';
  bar.addEventListener('click', e => e.stopPropagation());
  bar.addEventListener('mousedown', e => e.stopPropagation());
  const input = bar.querySelector('input');
  const countEl = bar.querySelector('.inline-filter-count');
  const items = Array.prototype.slice.call(panel.querySelectorAll(itemSel));
  function apply() {
    const q = normalizeSearch(input.value);
    let shown = 0;
    items.forEach(it => {
      if (it.dataset.filterPin === '1') return; // e.g. "Not set" stays visible
      const match = !q || normalizeSearch(it.textContent).indexOf(q) >= 0;
      it.style.display = match ? '' : 'none';
      if (match) shown++;
    });
    if (opts.groupSelector) {
      panel.querySelectorAll(opts.groupSelector).forEach(g => {
        const any = Array.prototype.slice.call(g.querySelectorAll(itemSel)).some(it => it.style.display !== 'none');
        g.style.display = any ? '' : 'none';
      });
    }
    // Family headers (siblings, not wrappers): show a header only when at least
    // one visible item follows it before the next header.
    if (opts.headerSelector) {
      panel.querySelectorAll(opts.headerSelector).forEach(h => {
        let any = false;
        for (let n = h.nextElementSibling; n && !n.matches(opts.headerSelector); n = n.nextElementSibling) {
          if (n.matches(itemSel) && n.style.display !== 'none') { any = true; break; }
        }
        h.style.display = any ? '' : 'none';
      });
    }
    countEl.textContent = q ? (shown + ' match' + (shown === 1 ? '' : 'es')) : '';
  }
  input.addEventListener('input', apply);
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape' && input.value) { input.value = ''; apply(); }
  });
  panel.insertBefore(bar, panel.firstChild);
  return bar;
}

function renderEnvSection(card) {
  const sec = document.createElement('section');
  sec.className = 'composer-section';
  sec.innerHTML = `<div class="composer-section-title">Environment</div>`;
  const list = document.createElement('div');
  list.className = 'parts-list';  // reuse parts-list container for consistent visual
  // Tint based on the card's instrument family
  const inst = Inst(card.instrumentId);
  if (inst) {
    const familyTint = (typeof FAMILY_COLORS !== 'undefined' && FAMILY_COLORS[inst.family])
      ? FAMILY_COLORS[inst.family] + '22'
      : 'var(--surface-2)';
    list.style.setProperty('--family-tint', familyTint);
  }
  list.appendChild(renderEnvRow(card, 'tuning'));
  list.appendChild(renderEnvRow(card, 'room'));
  sec.appendChild(list);
  return sec;
}

function renderEnvRow(card, kind) {
  const row = document.createElement('div');
  row.className = 'part-row-grid' + (card.editingEnv === kind ? ' is-editing' : '');
  row.dataset.toggleEnv = kind;
  const isEditing = card.editingEnv === kind;
  const isTuning = kind === 'tuning';
  const cur = isTuning ? (card.tuning ? Tuning(card.tuning) : null) : (card.room ? Room(card.room) : null);
  const label = (isTuning ? 'TUNING' : 'ROOM');
  const variantName = cur ? cur.name : 'Not set';
  const descriptor = cur ? (cur.note || '') : '';
  const iconName = isTuning ? 'music' : 'square';  // tuning vibe / room footprint
  // Option count: tunings/rooms list length
  const optionCount = isTuning
    ? (typeof TUNINGS !== 'undefined' ? TUNINGS.length : 0)
    : (typeof ROOMS !== 'undefined' ? ROOMS.length : 0);

  row.innerHTML =
    '<div class="part-thumb-cell">' + icon(iconName, 24) + '</div>' +
    '<div class="part-label-cell">' + esc(label) + '</div>' +
    '<div class="part-variant-cell' + (cur ? '' : ' muted-italic') + '">' + esc(variantName) + '</div>' +
    '<div class="part-descriptors-cell">' + esc(descriptor) + '</div>' +
    '<div class="part-options-cell">' + optionCount + ' option' + (optionCount === 1 ? '' : 's') + ' ' + icon('chevron-right', 12) + '</div>';

  if (isEditing) {
    const opts = document.createElement('div');
    opts.className = 'env-options';
    if (isTuning) {
      opts.innerHTML = `<button class="chip-block ${!card.tuning ? 'selected' : ''}" data-set-tuning="" data-filter-pin="1">Not set</button>`;
      TUNINGS.forEach(t => {
        opts.innerHTML += `<button class="chip-block ${card.tuning === t.id ? 'selected' : ''}" data-set-tuning="${esc(t.id)}">${esc(t.name)}<span class="chip-block-sub">${esc(t.sub)}</span></button>`;
      });
      row.appendChild(opts);
      attachInlineFilter(opts, { placeholder: `Filter ${TUNINGS.length} tunings…` });
    } else {
      opts.innerHTML = `<button class="chip-block ${!card.room ? 'selected' : ''}" data-set-room="" data-filter-pin="1">Not set</button>`;
      ROOM_CLUSTERS.forEach(cl => {
        const rooms = ROOMS.filter(r => r.cluster === cl.id);
        if (!rooms.length) return;
        let inner = `<button class="env-cluster-head" type="button" data-env-cluster><span class="env-cluster-chevron">${icon('chevron-down', 12)}</span><span class="env-cluster-name">${esc(cl.name)}</span><span class="env-cluster-count">${rooms.length}</span></button><div class="env-cluster-items">`;
        rooms.forEach(r => {
          inner += `<button class="chip-block ${card.room === r.id ? 'selected' : ''}" data-set-room="${esc(r.id)}">${esc(r.name)}<span class="chip-block-sub">${esc(entryRenderDescs(r).join(' · '))}</span></button>`;
        });
        inner += `</div>`;
        const wrap = document.createElement('div');
        wrap.className = 'env-cluster';
        wrap.innerHTML = inner;
        opts.appendChild(wrap);
      });
      row.appendChild(opts);
      // Collapsible cluster heads (DOM toggle — no re-render, keeps it cheap).
      opts.querySelectorAll('[data-env-cluster]').forEach(h => h.addEventListener('click', e => {
        e.stopPropagation();
        h.parentElement.classList.toggle('collapsed');
      }));
      attachInlineFilter(opts, { placeholder: `Filter ${ROOMS.length} rooms…`, groupSelector: '.env-cluster' });
    }
  }
  return row;
}

// ---- Chain section ----
function renderChainSection(card) {
  const sec = document.createElement('section');
  sec.className = 'composer-section';
  sec.innerHTML = `<div class="composer-section-title">Signal chain</div>`;
  const flow = document.createElement('div');
  flow.className = 'chain-flow';
  CHAIN_SECTIONS.forEach(s => {
    const isMulti = !!s.multiSelect;
    let value, isSet;
    if (isMulti) {
      const ids = card.chain[s.id] || [];
      isSet = ids.length > 0;
      value = ids.length === 0 ? '—' : (ids.length === 1 ? (ChainItem(s.id, ids[0])?.name || ids[0]) : ids.length + ' selected');
    } else {
      const id = card.chain[s.id];
      isSet = !!id;
      const item = id ? ChainItem(s.id, id) : null;
      value = item ? item.name : '—';
    }
    const editing = card.editingChainStage === s.id;
    flow.innerHTML += `
      <button class="chain-stage ${isSet ? 'set' : ''} ${editing ? 'editing' : ''}" data-edit-chain="${esc(s.id)}">
        <span class="chain-stage-label">${esc(s.name)}</span>
        <span class="chain-stage-value ${isSet ? '' : 'empty'}">${esc(value)}</span>
      </button>
    `;
  });
  sec.appendChild(flow);

  // Editing panel
  if (card.editingChainStage) {
    const stageDef = CHAIN_SECTIONS.find(x => x.id === card.editingChainStage);
    if (stageDef) {
      const panel = document.createElement('div');
      panel.className = 'chain-edit-panel';
      const isMulti = !!stageDef.multiSelect;
      panel.innerHTML = `
        <div class="chain-edit-title">${esc(stageDef.name)}${isMulti ? ' — pick any number' : ''}</div>
        <div class="chain-edit-hint">${esc(chainStageHint(stageDef.id))}</div>
      `;
      const opts = document.createElement('div');
      opts.className = 'chain-edit-options';
      if (!isMulti) {
        const noneBtn = document.createElement('button');
        noneBtn.className = 'chip-block' + (!card.chain[stageDef.id] ? ' selected' : '');
        noneBtn.dataset.setChain = stageDef.id;
        noneBtn.dataset.item = '';
        noneBtn.dataset.filterPin = '1';
        noneBtn.textContent = 'Not set';
        opts.appendChild(noneBtn);
      }
      const makeChip = it => {
        const b = document.createElement('button');
        const isSelected = isMulti
          ? (card.chain[stageDef.id] || []).includes(it.id)
          : card.chain[stageDef.id] === it.id;
        b.className = 'chip-block' + (isSelected ? ' selected' : '');
        b.dataset.setChain = stageDef.id;
        b.dataset.item = it.id;
        const descs = entryRenderDescs(it);
        b.innerHTML = `${esc(it.name)}${descs.length ? `<span class="chip-block-sub">${esc(descs.join(' · '))}</span>` : ''}`;
        return b;
      };
      // Stages whose items carry a `family` (e.g. mics) render grouped under
      // family headers; everything else stays a flat list.
      const CHAIN_FAMILY_ORDER = ['Acoustic', 'Carbon', 'Dynamic', 'Ribbon', 'Condenser', 'Electret', 'Piezoelectric', 'MEMS', 'Optical', 'Capture technique'];
      if (stageDef.items.some(it => it.family)) {
        const groups = new Map();
        for (const it of stageDef.items) {
          const f = it.family || 'Other';
          if (!groups.has(f)) groups.set(f, []);
          groups.get(f).push(it);
        }
        const ordered = [
          ...CHAIN_FAMILY_ORDER.filter(f => groups.has(f)),
          ...[...groups.keys()].filter(f => !CHAIN_FAMILY_ORDER.includes(f)),
        ];
        for (const f of ordered) {
          const h = document.createElement('div');
          h.className = 'chain-family-header';
          h.textContent = `${f} · ${groups.get(f).length}`;
          opts.appendChild(h);
          groups.get(f).forEach(it => opts.appendChild(makeChip(it)));
        }
      } else {
        stageDef.items.forEach(it => opts.appendChild(makeChip(it)));
      }
      panel.appendChild(opts);
      // Long stages (e.g. mics, mediums) get a live filter; small ones don't need it.
      if (stageDef.items.length > 8) {
        attachInlineFilter(opts, {
          placeholder: `Filter ${stageDef.items.length} options…`,
          headerSelector: '.chain-family-header',
        });
      }
      sec.appendChild(panel);
    }
  }
  return sec;
}

function chainStageHint(secId) {
  const hints = {
    fx: 'Pedals and effects placed before the amplifier or in line. Pick zero or many.',
    amp: 'How the signal is amplified before it hits a microphone or DI.',
    mic: 'Transducer that converts sound to signal.',
    pre: 'First gain stage that lifts mic level to line level — gives the signal its first character.',
    comp: 'Outboard compression to control dynamics.',
    eq: 'Outboard equalization for tonal shaping.',
    medium: 'Where the signal is recorded — the storage medium colors the sound.',
    console: 'How the console summing colors the result.'
  };
  return hints[secId] || '';
}

// ---- Preface section (aesthetic claim, one layer above the brick list) ----
//
// Each card carries an optional `preface` field — a word or tight compound
// that names what the listener EXPERIENCES, not what the waveform IS.
// Eligible vocabulary lives in PREFACE_LEXICON (catalog file 07) where each
// entry has a curated usage note explaining when it lands and when it
// overreaches. Free-form input is accepted and renders as-is; lexicon ids
// resolve to their canonical display word.
//
// Two-way binding: changing the preface here fires commitPrefaceChange,
// which calls inverseConfigureForPreface to reshape parts/env/chain to better
// hit the target preface's token signature. Changes get tracked in the
// shifts panel below the fan so the user sees what reconfigured and why.
// Conversely, when the user changes parts/env elsewhere with prefaceAuto=true,
// the recipe dedup loop re-suggests a preface — keeping the relationship live
// in both directions.
function renderPrefaceSection(card) {
  const sec = document.createElement('section');
  sec.className = 'composer-section preface-section';
  const current = card.preface || '';
  const currentLc = current.toLowerCase();
  const entry = (current && typeof PREFACE_LEXICON !== 'undefined')
    ? (PREFACE_LEXICON.find(e => e.id.toLowerCase() === currentLc) || null)
    : null;
  const hint = entry
    ? `<span class="preface-id">${esc(entry.id)}</span>`
    : (current
        ? `<span class="preface-hint-empty">Free-form preface — renders as typed. Add it to the lexicon if it earns its place.</span>`
        : '<span class="preface-hint-empty">A word that names what the listener experiences (weeping, face-melting, saudade, numinous) — not what the waveform measures.</span>');
  sec.innerHTML = `
    <div class="composer-section-title">Preface <span class="composer-section-title-aside">— aesthetic claim</span></div>
    <div class="preface-row">
      <div class="preface-input-wrap">
        <input type="text" class="preface-input" data-card-id="${esc(card.id)}"
               value="${esc(current)}" list="preface-options"
               placeholder="weeping, face-melting, saudade, numinous, mono-no-aware…"
               autocomplete="off" spellcheck="false">
      </div>
      <button class="btn btn-ghost preface-clear" data-card-id="${esc(card.id)}" data-tooltip="Clear preface and re-suggest from current parts">${icon('x', 14)}</button>
      <button class="btn btn-secondary preface-browse" data-card-id="${esc(card.id)}">Browse</button>
    </div>
    <div class="preface-hint">${hint}</div>
  `;

  // Suggestions fan — ranked candidates based on the card's current
  // descriptor set. Clicking a chip routes through commitPrefaceChange,
  // which fires the inverse pipeline to reshape parts/env toward the
  // selected preface's token signature.
  renderReachabilityFan(card, sec);

  // (The shifts panel that explains an inverse reconfigure is mounted once in
  // renderDetail, above the tab bar, so it shows regardless of the active tab —
  // a part edit on the Parts tab and a preface pick here both surface it.)

  // Input commit: typed value goes through commitPrefaceChange so lexicon
  // matches fire the inverse algorithm. Free-form values get stored as the
  // raw label (commitPrefaceChange handles that fallback internally).
  const input = sec.querySelector('.preface-input');
  if (input) {
    const commit = () => {
      const val = input.value.trim();
      if (val === (card.preface || '')) return;
      if (val) {
        commitPrefaceChange(card, val);
      } else {
        card.preface = null;
        card.prefaceAuto = true;
        if (typeof suggestPrefaceForCard === 'function') {
          card.preface = suggestPrefaceForCard(card);
        }
        rerenderCard(card);
      }
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = card.preface || ''; input.blur(); }
    });
  }

  // Clear button — empties preface and reopens auto-suggestion.
  const clear = sec.querySelector('.preface-clear');
  if (clear) {
    clear.addEventListener('click', () => {
      card.preface = null;
      card.prefaceAuto = true;
      if (typeof suggestPrefaceForCard === 'function') {
        card.preface = suggestPrefaceForCard(card);
      }
      // Also clear any lingering shifts panel — the previous commit's
      // shifts no longer relate to the current state.
      if (typeof _recentShiftsByCard !== 'undefined' && _recentShiftsByCard.has) {
        _recentShiftsByCard.delete(card.id);
      }
      rerenderCard(card);
    });
  }

  // Browse button — opens modal-preface populated with the full lexicon.
  const browse = sec.querySelector('.preface-browse');
  if (browse) {
    browse.addEventListener('click', () => {
      if (typeof openPrefaceModal === 'function') openPrefaceModal(card);
    });
  }

  return sec;
}

// Populate the global <datalist id="preface-options"> from PREFACE_LEXICON.
// Runs once at boot (DOMContentLoaded handler). The datalist powers
// browser-native autocomplete on every .preface-input.
function populatePrefaceDatalist() {
  if (typeof PREFACE_LEXICON === 'undefined') return;
  const dl = document.getElementById('preface-options');
  if (!dl || dl.dataset.populated) return;
  dl.innerHTML = PREFACE_LEXICON.map(e =>
    `<option value="${esc(e.id)}">${esc(e.id)}</option>`
  ).join('');
  dl.dataset.populated = '1';
}

// ============================================================
// PREFACE BROWSE MODAL — categorized, collapsible, searchable
// ============================================================
//
// The lexicon is large (hundreds of entries). A flat chip cloud is unscannable,
// so the browse modal organizes entries into affect/function categories and
// lets the user search (findability) or scan collapsible sections (discovery).
//
// Categorization is derived, not stored on the data: an explicit override map
// handles affect words whose (shared, generic) tokens don't disambiguate them,
// and everything else is classified by keyword-scoring its descriptor tokens.
// This keeps the lexicon data clean and auto-classifies any future entry.
const PREFACE_CAT_ORDER = [
  'Grief & lament', 'Rage & aggression', 'Fear & unease', 'Tenderness & warmth',
  'Joy & play', 'Energy & the epic', 'Wonder & the uncanny', 'Sacred & devotional',
  'Ambient & space', 'Groove & motion', 'Low end & weight', 'Bright & cutting',
  'Ornament & melisma', 'Speech & rhetoric', 'Craft & ensemble', 'Lo-fi & broken'
];
const PREFACE_CAT_OVERRIDE = {
  happy: 'Joy & play', merry: 'Joy & play', jovial: 'Joy & play', gleeful: 'Joy & play',
  tickled: 'Joy & play', fun: 'Joy & play', playful: 'Joy & play', funny: 'Joy & play',
  cheeky: 'Joy & play', optimistic: 'Joy & play', upbeat: 'Joy & play', hopeful: 'Joy & play',
  charming: 'Joy & play', bodacious: 'Joy & play', radical: 'Joy & play', catchy: 'Joy & play',
  terrified: 'Fear & unease', fearful: 'Fear & unease', nervous: 'Fear & unease',
  anxious: 'Fear & unease', timid: 'Fear & unease', bashful: 'Fear & unease',
  sheepish: 'Fear & unease', exposed: 'Fear & unease', shamed: 'Fear & unease',
  humiliated: 'Fear & unease', guilty: 'Fear & unease', disappointed: 'Fear & unease',
  tense: 'Fear & unease', suspenseful: 'Fear & unease', chilling: 'Fear & unease',
  ambivalent: 'Fear & unease', regretful: 'Fear & unease',
  exhilarating: 'Energy & the epic', uplifting: 'Energy & the epic', energizing: 'Energy & the epic',
  epic: 'Energy & the epic', cinematic: 'Energy & the epic', spiraling: 'Energy & the epic',
  'pulse-quickening': 'Energy & the epic', 'four-stomping': 'Energy & the epic',
  'spine-rooting': 'Energy & the epic', apocalyptic: 'Energy & the epic',
  numinous: 'Wonder & the uncanny', mystifying: 'Wonder & the uncanny', mystified: 'Wonder & the uncanny',
  bewildered: 'Wonder & the uncanny', bewildering: 'Wonder & the uncanny', haunting: 'Wonder & the uncanny',
  eldritch: 'Wonder & the uncanny', oracular: 'Wonder & the uncanny', vatic: 'Wonder & the uncanny',
  'spine-tingling': 'Wonder & the uncanny', 'scalp-prickling': 'Wonder & the uncanny',
  'blood-curdling': 'Wonder & the uncanny', adbhuta: 'Wonder & the uncanny', 'jaw-dropping': 'Wonder & the uncanny',
  intoxicating: 'Wonder & the uncanny', entrancing: 'Wonder & the uncanny',
  orchestral: 'Craft & ensemble', conductors: 'Craft & ensemble', choirmasters: 'Craft & ensemble',
  belting: 'Craft & ensemble', enunciating: 'Craft & ensemble', confident: 'Craft & ensemble',
  hyperbolic: 'Craft & ensemble', harmonizing: 'Craft & ensemble', 'technically-proficient': 'Craft & ensemble',
  improvisational: 'Craft & ensemble', authentic: 'Craft & ensemble', unembellished: 'Craft & ensemble',
  tight: 'Craft & ensemble', transient: 'Craft & ensemble', dynamic: 'Craft & ensemble', focused: 'Craft & ensemble',
  galloping: 'Groove & motion', rocking: 'Groove & motion', prancing: 'Groove & motion',
  'two-stepping': 'Groove & motion', loping: 'Groove & motion', skittering: 'Groove & motion',
  groovy: 'Groove & motion', loose: 'Groove & motion', 'up-tempo': 'Groove & motion',
  'down-tempo': 'Groove & motion', downbeat: 'Groove & motion', tubular: 'Bright & cutting',
  'balafon-pattering': 'Groove & motion', dunun: 'Groove & motion', donso: 'Ornament & melisma',
  'interlocking-hocketing': 'Ornament & melisma', 'yodel-throating': 'Ornament & melisma',
  stereophonic: 'Ambient & space', panoramic: 'Ambient & space', spacious: 'Ambient & space',
  airy: 'Ambient & space', experimental: 'Ambient & space', unpredictable: 'Ambient & space',
  patient: 'Ambient & space', austere: 'Ambient & space', minimalist: 'Ambient & space',
  maximalist: 'Ambient & space',
  heavy: 'Low end & weight', brutalist: 'Low end & weight',
  cold: 'Bright & cutting', twangy: 'Bright & cutting', light: 'Bright & cutting', alert: 'Bright & cutting',
  cramped: 'Lo-fi & broken', slurred: 'Lo-fi & broken', broken: 'Lo-fi & broken',
  malfunctioning: 'Lo-fi & broken', tarnished: 'Lo-fi & broken', flawed: 'Lo-fi & broken',
  alcoholic: 'Lo-fi & broken', imperfect: 'Lo-fi & broken',
  sensual: 'Tenderness & warmth', warm: 'Tenderness & warmth', soothing: 'Tenderness & warmth',
  adored: 'Tenderness & warmth', adoring: 'Tenderness & warmth', satisfying: 'Tenderness & warmth',
  satisfied: 'Tenderness & warmth', lustful: 'Tenderness & warmth', luxurious: 'Tenderness & warmth',
  indulgent: 'Tenderness & warmth', generous: 'Tenderness & warmth', calming: 'Tenderness & warmth',
  devastated: 'Grief & lament', somber: 'Grief & lament', bitter: 'Grief & lament', sad: 'Grief & lament',
  tragic: 'Grief & lament', weeping: 'Grief & lament', melancholic: 'Grief & lament', crushed: 'Grief & lament',
  jaded: 'Speech & rhetoric', grumpy: 'Speech & rhetoric', irked: 'Speech & rhetoric',
  disgusted: 'Speech & rhetoric', impatient: 'Speech & rhetoric',
  ornate: 'Ornament & melisma', embellished: 'Ornament & melisma', opulent: 'Ornament & melisma',
  solemn: 'Sacred & devotional', repentant: 'Sacred & devotional', grateful: 'Sacred & devotional',
  thankful: 'Sacred & devotional',
  vengeful: 'Rage & aggression', hostile: 'Rage & aggression', livid: 'Rage & aggression',
  savage: 'Rage & aggression', barbaric: 'Rage & aggression', brutal: 'Rage & aggression',
  frustrated: 'Rage & aggression'
};
const PREFACE_CAT_RULES = [
  ['Lo-fi & broken', ['surface-noise', 'wow-and-flutter', 'cassette', 'degraded', 'broken', 'hf-distortion', 'bandwidth-narrow', 'shellac', 'consumer-format', 'archival', 'pre-war', 'disc', 'no-bass-extension', 'horn-mechanical']],
  ['Sacred & devotional', ['sacred', 'devotional', 'liturgical', 'ceremonial', 'sufi', 'gospel-rooted', 'gospel-runs', 'congregation', 'hindu-ritual', 'dhrupad', 'medieval', 'court-ceremonial', 'reverent']],
  ['Rage & aggression', ['high-gain', 'distorted', 'transient-grab-aggressive', 'shouted', 'growly', 'metal-context', 'metallic', 'saturation-distortion', 'palm-muting', 'power-chord']],
  ['Grief & lament', ['mournful', 'lament', 'glissando-heavy', 'fado', 'keening', 'dark-romantic', 'haunted-romantic']],
  ['Ornament & melisma', ['ornament', 'melismatic', 'microtonal', 'meend', 'gamak', 'shruti', 'neutral-third', 'makam', 'maqam', 'raga-bound', 'tarab', 'avaz']],
  ['Groove & motion', ['dance-rhythm', 'dance-driving', 'swung', 'funk', 'backbeat', 'samba', 'bateria', 'walking-bass', 'beat-suited', 'club-staple', 'breaks-and-loops', 'chopped']],
  ['Ambient & space', ['ambient', 'drone-foundation', 'drone-like', 'layered-ambient', 'lush-ambient', 'reverberant', 'beat-free', 'sustained-tone', 'cavernous', 'naturally-reverberant', 'halo', 'floating', 'swimming', 'pad', 'meditative', 'minimal']],
  ['Low end & weight', ['sub-bass', 'low-end-heavy', 'foundational-sub', 'sub-driven', 'boomy', 'sub-fundamental', 'low-fundamental-tuning', 'deep-bass']],
  ['Bright & cutting', ['treble-extended', 'glassy', 'sharp', 'cutting', 'chimey', 'jangly', 'chime-shimmer', 'high-frequency', 'shimmer', 'bright', 'piercing', 'crisp']],
  ['Tenderness & warmth', ['warm-glowing', 'plush', 'intimate-aspirated', 'soft-onset', 'cozy', 'warmed', 'mellow', 'gentle', 'smoothed']],
  ['Speech & rhetoric', ['rhythmic-speech', 'speech-mimicking', 'speech-derived', 'speech-mimicry', 'declaimed', 'declamatory', 'narrative', 'conversational', 'heightened-speech', 'rhythmic-spoken', 'recitative', 'speech-like', 'speech-pitched']],
  ['Craft & ensemble', ['virtuoso', 'controlled', 'articulate', 'legato', 'refined', 'clean-articulation', 'tight-articulation', 'jazz-trained', 'classical-jazz', 'balanced']]
];
function prefaceCategoryOf(e) {
  if (PREFACE_CAT_OVERRIDE[e.id]) return PREFACE_CAT_OVERRIDE[e.id];
  const toks = (e.tokens || []).map(t => String(t).toLowerCase());
  let best = null, bestScore = 0;
  for (let i = 0; i < PREFACE_CAT_RULES.length; i++) {
    const [name, keys] = PREFACE_CAT_RULES[i];
    let s = 0;
    for (const t of toks) { for (const k of keys) { if (t.indexOf(k) >= 0) { s++; break; } } }
    const adj = s + (PREFACE_CAT_RULES.length - i) * 0.001; // priority tiebreak
    if (s > 0 && adj > bestScore) { bestScore = adj; best = name; }
  }
  return best || 'Craft & ensemble';
}
let _prefaceGroupsCache = null;
function prefaceGroups() {
  if (_prefaceGroupsCache) return _prefaceGroupsCache;
  const g = {};
  for (const e of PREFACE_LEXICON) { const c = prefaceCategoryOf(e); (g[c] = g[c] || []).push(e); }
  _prefaceGroupsCache = g;
  return g;
}

// Recently-used prefaces — persisted across sessions (guarded; localStorage may
// be unavailable or throw in restricted contexts).
const PREFACE_RECENT_KEY = 'codex:prefaceRecent';
function loadPrefaceRecent() {
  try { const raw = localStorage.getItem(PREFACE_RECENT_KEY); const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function recordPrefaceRecent(id) {
  try {
    let a = loadPrefaceRecent().filter(x => x !== id);
    a.unshift(id);
    localStorage.setItem(PREFACE_RECENT_KEY, JSON.stringify(a.slice(0, 8)));
  } catch { /* storage unavailable — recents are best-effort */ }
}

function prefaceChipHtml(e) {
  return `<button class="chip preface-pick" data-pref-id="${esc(e.id)}" data-tooltip="${esc(e.note || '')}">${esc(e.id)}</button>`;
}

// Render the modal body from current search + collapse state. Called on open and
// on every search keystroke / collapse toggle. The search input lives outside
// #preface-modal-body, so re-rendering the body never steals its focus.
function renderPrefaceModalBody() {
  const body = document.getElementById('preface-modal-body');
  if (!body) return;
  const card = app.prefaceCard;
  const q = normalizeSearch(app.prefaceSearch || '');
  const groups = prefaceGroups();
  const matches = (e) => !q || normalizeSearch(e.id).includes(q) || normalizeSearch(e.note || '').includes(q);

  let matchCount = 0;
  for (const cat of PREFACE_CAT_ORDER) matchCount += (groups[cat] || []).filter(matches).length;

  let html = `<div class="preface-toolbar"><span class="preface-toolbar-count">${q ? `${matchCount} match${matchCount === 1 ? '' : 'es'}` : `${PREFACE_LEXICON.length} prefaces · ${PREFACE_CAT_ORDER.length} categories`}</span><span class="preface-toolbar-actions"><button data-pref-expand="all">Expand all</button><button data-pref-expand="none">Collapse all</button></span></div>`;

  if (!q) {
    const recent = loadPrefaceRecent().map(id => PREFACE_LEXICON.find(x => x.id === id)).filter(Boolean);
    if (recent.length) {
      html += `<div class="preface-recent"><div class="preface-recent-label">Recently used</div><div class="preface-recent-items">${recent.map(prefaceChipHtml).join('')}</div></div>`;
    }
  }

  for (const cat of PREFACE_CAT_ORDER) {
    const list = (groups[cat] || []).filter(matches);
    if (!list.length) continue;
    // While searching, force every matching section open so hits are visible.
    const collapsed = !q && app.prefaceCollapsed.has(cat);
    html += `<div class="preface-cat${collapsed ? ' collapsed' : ''}">` +
      `<button class="preface-cat-head" data-pref-cat="${esc(cat)}"><span class="preface-cat-chevron">${icon('chevron-down', 14)}</span><span class="preface-cat-title">${esc(cat)}</span><span class="preface-cat-count">${list.length}</span></button>` +
      `<div class="preface-cat-items">${list.map(prefaceChipHtml).join('')}</div></div>`;
  }
  if (matchCount === 0) html += `<div class="preface-empty">No prefaces match “${esc(app.prefaceSearch)}”.</div>`;

  body.innerHTML = html;

  body.querySelectorAll('[data-pref-id]').forEach(b => b.addEventListener('click', () => {
    const prefId = b.dataset.prefId;
    recordPrefaceRecent(prefId);
    closeModal('modal-preface');
    // Route through commitPrefaceChange so inverseConfigureForPreface fires and
    // reshapes the card's parts/env toward the chosen target.
    commitPrefaceChange(card, prefId);
  }));
  body.querySelectorAll('[data-pref-cat]').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.prefCat;
    if (app.prefaceCollapsed.has(c)) app.prefaceCollapsed.delete(c); else app.prefaceCollapsed.add(c);
    renderPrefaceModalBody();
  }));
  body.querySelectorAll('[data-pref-expand]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.prefExpand === 'all') app.prefaceCollapsed.clear();
    else PREFACE_CAT_ORDER.forEach(c => app.prefaceCollapsed.add(c));
    renderPrefaceModalBody();
  }));
}

// Browse modal: open for a card. Search box is auto-focused by openModal().
function openPrefaceModal(card) {
  if (typeof PREFACE_LEXICON === 'undefined') return;
  app.prefaceCard = card;
  app.prefaceSearch = '';
  if (!app.prefaceCollapsed) app.prefaceCollapsed = new Set();
  const input = document.getElementById('search-preface');
  if (input) input.value = '';
  renderPrefaceModalBody();
  openModal('modal-preface');
}

// ---- Drift panel: small multiples preview ----
function renderDriftPanel(card) {
  const panel = document.createElement('div');
  panel.className = 'drift-panel';
  const n = card.drift.length;
  const headLabel = n === 1
    ? 'One neighbor. Each shifts one parameter — pick a direction.'
    : `${n} neighbor${n === 1 ? '' : 's'}. Each shifts one parameter — pick a direction.`;
  panel.innerHTML = `
    <div class="drift-head">
      <div class="drift-head-label icon-inline">${icon('sparkles', 14)}<span>${esc(headLabel)}</span></div>
      <div class="drift-head-actions">
        <button class="btn btn-ghost" data-action="drift-roll">${icon('shuffle')}Roll new</button>
        <button class="btn btn-ghost" data-action="drift-close">Close</button>
      </div>
    </div>
    <div class="drift-grid"></div>
  `;
  const grid = panel.querySelector('.drift-grid');
  card.drift.forEach((c, idx) => {
    const dc = document.createElement('div');
    dc.className = 'drift-card';
    dc.innerHTML = `
      <div class="drift-card-axis">${esc(c.axis)}</div>
      <div class="drift-card-value">${esc(c.label)}</div>
      <div class="drift-card-descr">${esc(c.descriptors.join(', '))}</div>
      <button class="drift-card-walk" data-walk="${idx}">Walk here</button>
    `;
    grid.appendChild(dc);
  });
  return panel;
}

// ---- Stack panel: on demand ----
function renderStackPanel(card) {
  const panel = document.createElement('div');
  panel.className = 'stack-panel';
  const fmt = card.stackPanel.format || 'prose';
  const text = compileStack(card, fmt);
  panel.innerHTML = `
    <div class="stack-head">
      <div class="stack-head-label">Descriptor stack</div>
      <div style="display: flex; gap: var(--s3); align-items: center;">
        <div class="stack-format">
          <button data-fmt="prose" class="${fmt === 'prose' ? 'active' : ''}">Prose</button>
          <button data-fmt="tags" class="${fmt === 'tags' ? 'active' : ''}">Tags</button>
          <button data-fmt="rich" class="${fmt === 'rich' ? 'active' : ''}">Rich</button>
          <button data-fmt="compact" class="${fmt === 'compact' ? 'active' : ''}">Compact</button>
        </div>
        <button class="btn btn-ghost" data-action="stack-close" style="padding: 4px 8px; font-size: var(--fs-micro);">Close</button>
      </div>
    </div>
    <div class="stack-text">${text ? esc(text) : '<span class="muted-italic">Nothing configured yet.</span>'}</div>
    <div class="stack-actions">
      <button class="btn btn-secondary" data-action="stack-copy">Copy</button>
    </div>
  `;
  return panel;
}

// ============================================================
// EVENTS
// ============================================================
function handleCardClick(e, card) {
  const t = e.target.closest('button, [data-toggle-part], [data-toggle-env]');
  if (!t) return;

  if (t.dataset.togglePart != null) {
    card.editingPart = card.editingPart === t.dataset.togglePart ? null : t.dataset.togglePart;
    card._materialsOpen = false; // a freshly (re)opened part starts with the materials list collapsed
    rerenderCard(card);
    return;
  }
  if (t.dataset.toggleEnv != null) {
    card.editingEnv = card.editingEnv === t.dataset.toggleEnv ? null : t.dataset.toggleEnv;
    rerenderCard(card);
    return;
  }
  if (t.dataset.setPart) {
    const partId = t.dataset.setPart;
    card.parts[partId] = t.dataset.variant || null;
    // Material parts (those carrying the universal cross-instrument materials)
    // trigger the full inverse cascade toward the re-derived preface — the same
    // machinery a preface pick runs — pinning the touched part so the user's choice
    // is preserved, and surfacing every auto-applied change (shifts panel + toast).
    // One history entry → one Ctrl+Z. Other parts keep the lightweight re-derive.
    const inst = Inst(card.instrumentId);
    const partDef = inst ? (inst.parts || []).find(p => p.id === partId) : null;
    const isMaterialPart = !!(partDef && (partDef.variants || []).some(v => v.expanded));
    if (isMaterialPart) {
      reconfigureAfterPartEdit(card, partId);
      if (typeof pushHistory === 'function') pushHistory();
    } else if (card.prefaceAuto) {
      card.preface = suggestPrefaceForCard(card);
    }
    rerenderCard(card);
    return;
  }
  if (t.dataset.setTuning != null) {
    card.tuning = t.dataset.setTuning || null;
    card.editingEnv = null;
    rerenderCard(card);
    return;
  }
  if (t.dataset.setRoom != null) {
    card.room = t.dataset.setRoom || null;
    card.editingEnv = null;
    rerenderCard(card);
    return;
  }
  if (t.dataset.editChain) {
    card.editingChainStage = card.editingChainStage === t.dataset.editChain ? null : t.dataset.editChain;
    rerenderCard(card);
    return;
  }
  if (t.dataset.setChain) {
    const sId = t.dataset.setChain;
    const itemId = t.dataset.item;
    const sec = CHAIN_SECTIONS.find(s => s.id === sId);
    if (!sec) return;
    if (sec.multiSelect) {
      const cur = card.chain[sId] || [];
      card.chain[sId] = cur.includes(itemId) ? cur.filter(x => x !== itemId) : [...cur, itemId];
    } else {
      card.chain[sId] = itemId || null;
    }
    rerenderCard(card);
    return;
  }
  if (t.dataset.fmt) {
    if (card.stackPanel) card.stackPanel.format = t.dataset.fmt;
    rerenderCard(card);
    return;
  }
  if (t.dataset.walk != null) {
    const idx = parseInt(t.dataset.walk, 10);
    if (card.drift && card.drift[idx]) {
      const move = card.drift[idx];
      move.apply();
      if (card.prefaceAuto) card.preface = suggestPrefaceForCard(card);
      card.drift = null;
      showToast(`Walked: ${move.axis} → ${move.label}`, 'success');
      rerenderCard(card);
    }
    return;
  }
  if (t.dataset.action) {
    handleAction(t.dataset.action, card);
  }
}

function handleAction(action, card) {
  if (action === 'drift') {
    const candidates = buildDriftCandidates(card);
    if (candidates.length === 0) {
      showToast('No drift candidates — instrument has no alternates', 'error');
      return;
    }
    card.drift = candidates;
    rerenderCard(card);
    // Phase 4b: scroll the drift panel into view after render. The panel
    // appears at the bottom of the detail tab content; on small viewports
    // it can land below the fold. requestAnimationFrame waits for the
    // renderDetail repaint to land before measuring.
    requestAnimationFrame(() => {
      const dp = document.querySelector('.drift-panel');
      if (dp) dp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  } else if (action === 'drift-roll') {
    const candidates = buildDriftCandidates(card);
    if (candidates.length === 0) {
      showToast('No drift candidates — instrument has no alternates', 'error');
      return;
    }
    card.drift = candidates;
    rerenderCard(card);
  } else if (action === 'drift-close') {
    card.drift = null;
    rerenderCard(card);
  } else if (action === 'get-stack') {
    card.stackPanel = card.stackPanel ? null : { format: 'prose' };
    rerenderCard(card);
  } else if (action === 'stack-close') {
    card.stackPanel = null;
    rerenderCard(card);
  } else if (action === 'stack-copy') {
    const fmt = card.stackPanel?.format || 'prose';
    const text = compileStack(card, fmt);
    if (!text) { showToast('Nothing to copy', 'error'); return; }
    copyToClipboard(text, `Copied (${fmt})`, 'Copy failed — try selecting and Cmd/Ctrl+C');
  } else if (action === 'duplicate') {
    dupCard(card.id);
    renderAll();
    showToast('Duplicated', 'success');
  } else if (action === 'delete') {
    rmCard(card.id);
    // rmCard schedules renderAll() after the unmount animation completes.
    // Don't repaint here or the card would vanish instantly without animating.
  } else if (action === 'similar') {
    app.similarInstFor = card.instrumentId;
    app.pickerSearch = '';
    const si = document.getElementById('search-inst');
    if (si) si.value = '';
    renderInstPicker();
    openModal('modal-add');
  } else if (action === 'pin') {
    card.pinned = !card.pinned;
    renderAll();
    showToast(card.pinned ? 'Pinned to top' : 'Unpinned', 'success');
  }
}

function rerenderCard(_card) {
  // Master-detail era: the legacy #cards container is hidden / not populated,
  // so there are no `[data-card-id]` elements outside the detail view itself.
  // The detail view is the only visible rendering of the selected card, and
  // the sidebar carries the mini-fingerprint + preface line.
  //
  // Earlier behavior: queried `[data-card-id="${id}"]` and replaced with
  // `renderCard(target, primaryId)` — the OLD full-card renderer. That would
  // splice stale legacy markup over the detail view DOM, creating duplicate
  // / orphan elements with each click. A "the UI interactions are gone"
  // report traced to this exact intermediate state.
  //
  // Replacement: run preface dedup (still load-bearing for cross-card preface
  // resolution), then refresh the detail view + sidebar. Both are cheap and
  // correct.
  if (typeof _applyRecipeDedup === 'function') _applyRecipeDedup();
  renderMeta();
  renderDetail();
  renderSidebar();
}

async function renderSaved() {
  const b = document.getElementById('saved-body');
  b.innerHTML = `<div class="empty-msg">Loading…</div>`;
  const list = await listSaved();
  if (!list.length) {
    b.innerHTML = renderEmptyModalState('No saved workspaces yet.', 'folder');
    return;
  }
  list.sort((a, b) => (b.saved_at || '').localeCompare(a.saved_at || ''));
  b.innerHTML = `<div class="saved-grid">` + list.map(w => {
    const date = w.saved_at ? new Date(w.saved_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `
      <div class="saved-item">
        <div>
          <div class="saved-name">${esc(w.name)}</div>
          <div class="saved-meta">${esc(date)} · ${w.count || 0} ${w.count === 1 ? 'instrument' : 'instruments'}</div>
        </div>
        <div class="saved-actions">
          <button class="btn btn-secondary" data-load="${esc(w.key)}">Load</button>
          <button class="btn btn-ghost" data-fork="${esc(w.key)}" data-tooltip="Open as an independent copy">Fork</button>
          <button class="btn btn-ghost btn-danger" data-del="${esc(w.key)}">Delete</button>
        </div>
      </div>
    `;
  }).join('') + `</div>`;
  b.querySelectorAll('[data-load]').forEach(x => x.addEventListener('click', () => loadWS(x.dataset.load)));
  b.querySelectorAll('[data-fork]').forEach(x => x.addEventListener('click', () => forkWS(x.dataset.fork)));
  b.querySelectorAll('[data-del]').forEach(x => x.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete workspace',
      message: 'Delete this saved workspace?',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) delWS(x.dataset.del);
  }));
}

// Recipe-stack modal — combined descriptor stack across every card on canvas.
// Three formats: prose (per-card stacks separated), tags (deduped flat list),
// compact (label-only summary). Shared Copy button writes the current view to
// the clipboard.
// ===== UpSet plot — descriptor-intersection structure across cards =====
// Canonical multi-set intersection visualization (Lex/Gleicher/Pfister/Streit
// 2014). Replaces the >3-set Venn legibility wall: for N sets there are
// 2^N - 1 possible intersection cells, most of which are empty in real data.
// UpSet shows only non-empty intersections as columns, with a bar chart
// above (intersection sizes) and a presence/absence matrix below (which
// sets participate). Both regions share column alignment, so the eye can
// drop from any bar to its set-membership pattern.
//
// Used by the recipe-stack modal when 4+ cards are on the canvas. The
// data builder is generic (any list of cards with descriptor sets); the
// renderer is hand-rolled SVG with no library dependency.

function buildUpSetData(cards) {
  // Returns null if fewer than 2 valid cards (UpSet needs sets to intersect).
  // For valid input: {sets[], intersections[], totalIntersections}.
  // Intersections are EXCLUSIVE — tokens that appear in exactly the listed
  // sets and no others (the cells of the Venn diagram, not the overlapping
  // regions). Sorted by size descending, then by degree (smaller subsets
  // first within a size tie). Empty intersections are pruned.
  const validCards = (cards || []).filter(function (c) { return c && c.instrumentId; });
  if (validCards.length < 2) return null;

  const sets = validCards.map(function (card, i) {
    const inst = (typeof Inst === 'function') ? Inst(card.instrumentId) : null;
    const tokens = (typeof _cardDescriptorSet === 'function') ? _cardDescriptorSet(card) : new Set();
    const fam = inst && inst.family;
    const color = (typeof FAMILY_COLORS !== 'undefined' && fam && FAMILY_COLORS[fam]) || '#7a7a7a';
    return {
      idx: i,
      label: inst ? inst.name : ('Card ' + (i + 1)),
      color: color,
      tokens: tokens,
      size: tokens.size,
    };
  });

  const N = sets.length;
  const intersections = [];
  for (let mask = 1; mask < (1 << N); mask++) {
    const inIdxs = [];
    const outIdxs = [];
    for (let i = 0; i < N; i++) {
      if ((mask >> i) & 1) inIdxs.push(i);
      else outIdxs.push(i);
    }
    // Walk the smallest member set's tokens (minimizes candidate pool).
    let pivot = inIdxs[0];
    let pivotSize = sets[pivot].size;
    for (let k = 1; k < inIdxs.length; k++) {
      if (sets[inIdxs[k]].size < pivotSize) { pivot = inIdxs[k]; pivotSize = sets[pivot].size; }
    }
    const exclusive = [];
    for (const t of sets[pivot].tokens) {
      let ok = true;
      for (let k = 0; k < inIdxs.length; k++) {
        if (inIdxs[k] === pivot) continue;
        if (!sets[inIdxs[k]].tokens.has(t)) { ok = false; break; }
      }
      if (!ok) continue;
      for (let j = 0; j < outIdxs.length; j++) {
        if (sets[outIdxs[j]].tokens.has(t)) { ok = false; break; }
      }
      if (ok) exclusive.push(t);
    }
    if (exclusive.length === 0) continue;
    intersections.push({
      setIdxs: inIdxs,
      size: exclusive.length,
      tokens: exclusive,
    });
  }

  intersections.sort(function (a, b) {
    if (a.size !== b.size) return b.size - a.size;
    if (a.setIdxs.length !== b.setIdxs.length) return a.setIdxs.length - b.setIdxs.length;
    // Stable for deterministic test output: lexicographic on setIdxs
    return a.setIdxs.join(',').localeCompare(b.setIdxs.join(','));
  });

  return {
    sets: sets,
    intersections: intersections,
    totalIntersections: intersections.length,
  };
}

function renderUpSet(container, data, cap) {
  if (!container) return;
  if (cap == null) cap = 20;
  if (!data || !data.sets || data.sets.length < 2 || data.intersections.length === 0) {
    container.innerHTML = '<p class="upset-empty">No descriptor overlaps to display.</p>';
    return;
  }

  const shown = data.intersections.slice(0, cap);
  const N = data.sets.length;
  const M = shown.length;
  const maxSize = shown[0].size;

  // Layout — empirically tuned for 4-8 cards × up to 20 intersections.
  const colW = 28;
  const rowH = 24;
  const labelW = 160;
  const topBarH = 110;
  const padding = 16;
  const dotR = 7;
  const sizeLabelH = 18;

  const width = labelW + M * colW + padding * 2;
  const matrixTop = padding + sizeLabelH + topBarH;
  const height = matrixTop + N * rowH + padding;

  const parts = [];
  parts.push('<svg viewBox="0 0 ' + width + ' ' + height + '" xmlns="http://www.w3.org/2000/svg" class="upset-svg" preserveAspectRatio="xMidYMid meet">');

  // Vertical connector lines first so dots draw over them.
  shown.forEach(function (inter, j) {
    if (inter.setIdxs.length < 2) return;
    const x = labelW + j * colW + colW / 2;
    let minI = inter.setIdxs[0]; let maxI = inter.setIdxs[0];
    for (let k = 1; k < inter.setIdxs.length; k++) {
      if (inter.setIdxs[k] < minI) minI = inter.setIdxs[k];
      if (inter.setIdxs[k] > maxI) maxI = inter.setIdxs[k];
    }
    const y1 = matrixTop + minI * rowH + rowH / 2;
    const y2 = matrixTop + maxI * rowH + rowH / 2;
    parts.push('<line x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '" stroke="var(--text-3)" stroke-width="2" opacity="0.45"/>');
  });

  // Row labels + dots.
  data.sets.forEach(function (set, i) {
    const cy = matrixTop + i * rowH + rowH / 2;
    parts.push('<text x="' + (labelW - 12) + '" y="' + (cy + 4) + '" text-anchor="end" font-size="12" fill="var(--text)">' + esc(set.label) + '</text>');
    shown.forEach(function (inter, j) {
      const cx = labelW + j * colW + colW / 2;
      const isIn = inter.setIdxs.indexOf(i) !== -1;
      if (isIn) {
        parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + dotR + '" fill="' + set.color + '"/>');
      } else {
        parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + dotR + '" fill="var(--border)" opacity="0.35"/>');
      }
    });
  });

  // Top bars (intersection sizes) with native SVG <title> tooltips.
  shown.forEach(function (inter, j) {
    const barH = (inter.size / maxSize) * topBarH;
    const x = labelW + j * colW;
    const barTop = padding + sizeLabelH + (topBarH - barH);
    const tokenPreview = inter.tokens.slice(0, 12).join(', ') + (inter.tokens.length > 12 ? ', +' + (inter.tokens.length - 12) + ' more' : '');
    const memberLabels = inter.setIdxs.map(function (i) { return data.sets[i].label; }).join(' + ');
    const tooltipText = inter.size + ' token' + (inter.size === 1 ? '' : 's') + ' shared by ' + memberLabels + ': ' + tokenPreview;
    parts.push('<g class="upset-col">');
    parts.push('<rect x="' + (x + 4) + '" y="' + barTop + '" width="' + (colW - 8) + '" height="' + barH + '" fill="var(--text-2)" class="upset-bar" rx="2"/>');
    parts.push('<text x="' + (x + colW / 2) + '" y="' + (barTop - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-3)">' + inter.size + '</text>');
    parts.push('<title>' + esc(tooltipText) + '</title>');
    parts.push('</g>');
  });

  parts.push('</svg>');

  let html = parts.join('');
  if (data.totalIntersections > cap) {
    html += '<p class="upset-truncation-note">Showing top ' + cap + ' of ' + data.totalIntersections + ' non-empty intersections (sorted by size).</p>';
  }
  container.innerHTML = html;
}

function renderRecipeStack() {
  const b = document.getElementById('recipe-stack-body');
  if (!app.cards.length) {
    b.innerHTML = `<div class="empty-msg is-italic">No instruments on the canvas yet. Add some to compile a recipe stack.</div>`;
    return;
  }
  const fmt = app.recipeStackFormat || 'rich';
  const text = compileRecipeStack(app.cards, fmt);
  // Header metric: byte-count vs ceiling. Works honestly across all three
  // formats (prose / tags / compact), shows the user how close to budget the
  // current render is, and replaces the prior "unique descriptors" count
  // which lost meaning after the Tags renderer moved to a chunk-per-source
  // model (the chunks repeat tokens across sources by design).
  const CEILING = RECIPE_CHAR_CEILING;
  // All four formats (Prose, Tags, Rich, Compact) respect CEILING. Rich now
  // honors the ceiling via the same 3-phase trim cascade Tags uses.
  const lengthLabel = `${text.length} / ${CEILING} chars`;
  b.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--s4); margin-bottom: var(--s4); flex-wrap: wrap;">
      <div style="font-size: var(--fs-caption); color: var(--text-2);">
        ${app.cards.length} instrument${app.cards.length === 1 ? '' : 's'} · ${lengthLabel}
      </div>
      <div class="stack-format">
        <button data-rfmt="prose" class="${fmt === 'prose' ? 'active' : ''}">Prose</button>
        <button data-rfmt="tags" class="${fmt === 'tags' ? 'active' : ''}">Tags</button>
        <button data-rfmt="rich" class="${fmt === 'rich' ? 'active' : ''}">Rich</button>
        <button data-rfmt="compact" class="${fmt === 'compact' ? 'active' : ''}">Compact</button>
      </div>
    </div>
    <pre class="stack-text" style="white-space: pre-wrap; word-break: break-word; font-family: 'JetBrains Mono', monospace; font-size: var(--fs-caption); line-height: 1.6; background: var(--surface-2); padding: var(--s4); border-radius: 6px; max-height: 60vh; overflow-y: auto; margin: 0;">${text ? esc(text) : '<span class="muted-italic">Nothing configured yet.</span>'}</pre>
    <div class="stack-actions" style="margin-top: var(--s4); display: flex; justify-content: flex-end;">
      <button class="btn btn-secondary" data-rstack-copy>Copy</button>
    </div>
  `;
  b.querySelectorAll('[data-rfmt]').forEach(btn => {
    btn.addEventListener('click', () => {
      app.recipeStackFormat = btn.dataset.rfmt;
      renderRecipeStack();
    });
  });
  const copyBtn = b.querySelector('[data-rstack-copy]');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    if (!text) { showToast('Nothing to copy', 'error'); return; }
    copyToClipboard(text, `Copied recipe stack (${fmt})`, 'Copy failed — try selecting and Cmd/Ctrl+C');
  });

  // UpSet plot — visualizes the intersection structure of descriptor sets
  // across cards in the workspace. At 1-3 cards the prose/tags/compact text
  // already conveys what's shared vs unique clearly enough; UpSet earns its
  // complexity only when Venn-style mental models break down (4+ sets).
  if (app.cards.length >= 4) {
    const upsetWrap = document.createElement('div');
    upsetWrap.className = 'upset-section';
    upsetWrap.innerHTML =
      '<div class="upset-section-title">Descriptor intersections — which tokens appear in which cards</div>' +
      '<div class="upset-render-target"></div>';
    b.appendChild(upsetWrap);
    const upsetData = buildUpSetData(app.cards);
    renderUpSet(upsetWrap.querySelector('.upset-render-target'), upsetData);
  }
}

// ============================================================
// INIT
// ============================================================

// Global error trap. Any uncaught exception or rejected promise reaches here
// and surfaces through a toast so click handlers don't die silently. Also logs
// to console so the trace is recoverable in devtools.
window.addEventListener('error', e => {
  console.error('[codex] uncaught error:', e.error || e.message);
  if (typeof showToast === 'function') {
    showToast('Something went wrong — check the console', 'error');
  }
});
window.addEventListener('unhandledrejection', e => {
  console.error('[codex] unhandled rejection:', e.reason);
  if (typeof showToast === 'function') {
    showToast('Something went wrong — check the console', 'error');
  }
});

// Keep the CSS --app-bar-height variable in sync with the real rendered app
// bar. The sidebar pane (height/top = calc(100vh - app-bar-height)) and the
// mobile drawer offsets are derived from it; measuring the actual bar — which
// shifts with web-font loading and viewport width — keeps those panes
// pixel-aligned to the sticky bar instead of trusting the 56px fallback.
function syncAppBarHeight() {
  const bar = document.querySelector('.app-bar');
  if (!bar) return;
  document.documentElement.style.setProperty('--app-bar-height', bar.offsetHeight + 'px');
}

// Same idea for the pinned recipe bar: below 900px it is fixed to the bottom
// edge, so the scrolling content needs exactly its height in bottom padding or
// the last genre in the tree sits underneath it and cannot be tapped.
function _syncRecipeBarHeight() {
  const rp = document.getElementById('sidebar-recipe-preview');
  const h = rp && isMobileLayout() && rp.childElementCount ? rp.offsetHeight : 0;
  document.documentElement.style.setProperty('--recipe-bar-height', h + 'px');
}

// The compact app bar's overflow sheet. Every item forwards its click to the
// real control in the app bar rather than duplicating its handler, so the
// compact bar cannot drift out of parity with the desktop one — there is still
// exactly one implementation of Save, Saved and Image credits.
function wireOverflowMenu() {
  const btn = document.getElementById('btn-more');
  const menu = document.getElementById('app-more-menu');
  if (!btn || !menu) return;
  let backdrop = null;

  const close = () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (backdrop) { backdrop.remove(); backdrop = null; }
  };
  const open = () => {
    menu.querySelectorAll('[data-proxy]').forEach(i => {
      const src = document.getElementById(i.dataset.proxy);
      i.disabled = !src || src.disabled;
    });
    menu.hidden = false;             // must be laid out before it can be measured
    btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect();
    const w = menu.offsetWidth;
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
    backdrop = document.createElement('div');
    backdrop.className = 'more-menu-backdrop';
    backdrop.addEventListener('click', close);
    document.body.appendChild(backdrop);
    const first = menu.querySelector('.more-menu-item:not(:disabled)');
    if (first) first.focus();
  };

  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  menu.addEventListener('click', e => {
    const item = e.target.closest('[data-proxy]');
    if (!item || item.disabled) return;
    close();
    const src = document.getElementById(item.dataset.proxy);
    if (src) src.click();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); }
  });
}

// Boot gate. Embedded build: CATALOG_READY is null and init runs synchronously
// inside the DOMContentLoaded handler, exactly as it always has. Lazy shell:
// init waits for the one browse-index fetch; a failed fetch renders a
// persistent, honest error state instead of a blank app.
document.addEventListener('DOMContentLoaded', () => {
  if (CATALOG_READY) CATALOG_READY.then(_initApp).catch(_renderBootError);
  else _initApp();
});

function _renderBootError(err) {
  console.error('Catalog boot failed:', err);
  const detail = document.getElementById('workspace-detail') || document.body;
  detail.innerHTML =
    '<div class="empty-state" id="boot-error">' +
    '<h2>Couldn’t load the catalog</h2>' +
    '<p>The browse index (api/browse.json) failed to load. Check your connection and reload the page.</p>' +
    '<div class="empty-state-actions"><button class="btn btn-primary" id="boot-error-reload">Reload</button></div>' +
    '</div>';
  const btn = document.getElementById('boot-error-reload');
  if (btn) btn.addEventListener('click', () => location.reload());
}

function _initApp() {
  // Hydrate all icon placeholders in the static HTML shell. Each
  // <span data-icon="name" data-size="N"></span> placeholder gets its
  // innerHTML populated with the canonical icon() SVG. This keeps the
  // icon library single-source-of-truth: only the ICONS map holds path
  // data, even for icons that appear in the pre-render HTML.
  document.querySelectorAll('[data-icon]').forEach(el => {
    const size = parseInt(el.dataset.size, 10) || 16;
    el.innerHTML = icon(el.dataset.icon, size);
  });
  // Now that the bar's icons are hydrated, measure it; re-measure once the
  // web fonts settle and on every resize so the sidebar/detail panes stay
  // locked to the bar's actual height.
  syncAppBarHeight();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncAppBarHeight).catch(() => {});
  wireOverflowMenu();
  // Crossing 900px swaps the whole model — the detail panel moves between the
  // tree and the right-hand pane — so the app has to repaint, not just
  // restyle. Repaint ONLY on a crossing: a plain resize (or the address bar
  // hiding on scroll) must not rebuild the tree under the user's finger.
  let wasMobile = isMobileLayout();
  window.addEventListener('resize', () => {
    syncAppBarHeight();
    const nowMobile = isMobileLayout();
    if (nowMobile !== wasMobile) { wasMobile = nowMobile; renderAll(); }
    _syncRecipeBarHeight();
  });
  populatePrefaceDatalist();
  // Escape closes any currently-open modal. Backdrop click closes are wired
  // elsewhere via data-close; this adds the keyboard parity for accessibility.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal-bg.open');
      if (open && open.id) closeModal(open.id); // restores focus + clears the trap
      else if (open) open.classList.remove('open');
    }
  });
  // Warn before discarding an unsaved in-progress workspace: the canvas lives in
  // memory only (Save persists it), so a reload/close/crash would silently lose
  // it. Respects the explicit-save model — it warns, it never autosaves.
  window.addEventListener('beforeunload', (e) => {
    if (app.cards && app.cards.length > 0) { e.preventDefault(); e.returnValue = ''; }
  });
  document.getElementById('btn-add').addEventListener('click', () => {
    app.pickerSearch = '';
    app.similarInstFor = null;
    document.getElementById('search-inst').value = '';
    renderInstPicker();
    openModal('modal-add');
  });
  document.getElementById('empty-add').addEventListener('click', () => document.getElementById('btn-add').click());
  // #empty-surprise is a STATIC template element (unlike the innerHTML-rebuilt
  // starter gallery / quick-pick whose listeners die with their nodes), so it is
  // wired exactly once here — never in renderEmpty, which runs every render.
  const emptySurprise = document.getElementById('empty-surprise');
  if (emptySurprise) emptySurprise.addEventListener('click', surpriseTradition);
  const eag = document.getElementById('empty-add-genre');
  if (eag) {
    eag.addEventListener('click', () => {
      app.tradSearch = '';
      app.similarFor = null;
      const si = document.getElementById('search-trad');
      if (si) si.value = '';
      renderTradPicker();
      openModal('modal-trad');
    });
  }
  document.getElementById('btn-traditions').addEventListener('click', () => {
    app.tradSearch = '';
    app.similarFor = null;
    document.getElementById('search-trad').value = '';
    renderTradPicker();
    openModal('modal-trad');
  });
  document.getElementById('btn-save').addEventListener('click', () => {
    if (!app.cards.length) { showToast('Nothing to save yet', 'error'); return; }
    document.getElementById('save-name').value = '';
    openModal('modal-save');
  });
  document.getElementById('save-confirm').addEventListener('click', () => {
    const n = document.getElementById('save-name').value.trim();
    if (!n) { showToast('Name required', 'error'); return; }
    closeModal('modal-save');
    saveWS(n);
  });
  document.getElementById('save-name').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('save-confirm').click(); });
  document.getElementById('btn-saved').addEventListener('click', () => { renderSaved(); openModal('modal-saved'); });
  // Search-input wiring: typing clears any active similarity drill-down
  // ("browse" intent supersedes the "show me what's similar" drill-down).
  document.getElementById('search-inst').addEventListener('input', e => {
    app.pickerSearch = e.target.value;
    app.similarInstFor = null;
    renderInstPicker();
  });
  document.getElementById('search-trad').addEventListener('input', e => {
    app.tradSearch = e.target.value;
    app.similarFor = null;
    renderTradPicker();
  });
  const searchPreface = document.getElementById('search-preface');
  if (searchPreface) {
    searchPreface.addEventListener('input', e => {
      app.prefaceSearch = e.target.value;
      renderPrefaceModalBody();
    });
    // Enter commits the top-listed match — keyboard-first for power users.
    searchPreface.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const first = document.querySelector('#preface-modal-body .preface-pick');
        if (first) { e.preventDefault(); first.click(); }
      }
    });
  }

  // Attribution modal — opens from the footer link added below renderAll().
  const attrLink = document.getElementById('btn-attributions');
  if (attrLink) attrLink.addEventListener('click', () => { renderAttributions(); openModal('modal-attributions'); });

  // Undo / redo — button wireup + keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z).
  // The undo/redo functions guard against out-of-bounds index moves themselves,
  // so it's safe to call them unconditionally; updateHistoryButtons() handles
  // enabling/disabling the buttons based on history position.
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  // Mobile drawer toggle (Phase 9). Toggles .is-open on sidebar + backdrop.
  // Backdrop click closes. Sidebar card-click also closes (to reveal the
  // detail pane the user just selected).
  const drawerBtn = document.getElementById('btn-drawer-toggle');
  const sidebarEl = document.getElementById('workspace-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (drawerBtn && sidebarEl && backdrop) {
    const closeDrawer = () => {
      sidebarEl.classList.remove('is-open');
      backdrop.classList.remove('is-open');
    };
    drawerBtn.addEventListener('click', () => {
      const isOpen = sidebarEl.classList.toggle('is-open');
      backdrop.classList.toggle('is-open', isOpen);
    });
    backdrop.addEventListener('click', closeDrawer);
    // Auto-close after a sidebar card selection on mobile
    sidebarEl.addEventListener('click', e => {
      if (window.innerWidth <= 899 && e.target.closest('.sb-card')) closeDrawer();
    });
  }
  document.addEventListener('keydown', (e) => {
    // Skip if user is typing in an input/textarea/contenteditable — Ctrl+Z
    // is also the OS-level text undo for those.
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if (e.key === 'y' || e.key === 'Y') {
      // Windows-conventional redo shortcut
      e.preventDefault();
      redo();
    }
  });
  // Seed an initial empty-state snapshot so undo can return to "nothing in
  // the workspace" — without this, the first action's pre-state is unreachable.
  pushHistory();

  // Modal close
  document.querySelectorAll('.modal-bg').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });
  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => closeModal(b.dataset.close));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
  });

  renderAll();
}

// ============================================================
// HIERARCHICAL TREE PICKER + SONIC SIMILARITY
// ============================================================
// Tree-shaped tradition picker (genre families → families → leaves),
// sonic-similarity drill-down ("Find similar" from any leaf), and the
// shared instrument picker including the "similar to" mode triggered
// from a card's find-similar action.
// ============================================================

// ---- Sort instruments: family display order, alphabetical within family by displayed (short) name ----
(function sortInstruments() {
  const familyOrder = INSTRUMENT_FAMILIES.map(f => f.id);
  const sortKey = (i) => (i.short || i.name || '').toLowerCase();
  INSTRUMENTS.sort((a, b) => {
    const fa = familyOrder.indexOf(a.family);
    const fb = familyOrder.indexOf(b.family);
    if (fa !== fb) return fa - fb;
    return sortKey(a).localeCompare(sortKey(b), undefined, { sensitivity: 'base' });
  });
})();

// ---- Inject CSS for the new components ----
(function injectV5Styles() {
  const css = `
.tree-node { padding: 0; margin: 0; }
.tree-row { display: grid; grid-template-columns: 20px 1fr auto; gap: var(--s2); align-items: center; padding: var(--s2) var(--s3); cursor: pointer; border-radius: var(--r2); transition: background var(--t-fast) var(--ease); margin: 1px 0; }
.tree-row:hover { background: var(--surface-2); }
.tree-row.depth-0 { font-weight: var(--fw-semibold); }
.tree-row.depth-0 .tree-row-name { font-size: var(--fs-body); letter-spacing: -0.005em; }
.tree-row.depth-1 .tree-row-name { font-size: var(--fs-body); font-weight: var(--fw-medium); }
.tree-row.depth-2 .tree-row-name { font-size: var(--fs-caption); font-weight: var(--fw-medium); color: var(--text-2); }
.tree-chevron { color: var(--text-3); transition: transform var(--t-norm) var(--ease); display: inline-flex; align-items: center; justify-content: center; }
.tree-chevron.expanded { transform: rotate(90deg); }
.tree-row-name { line-height: 1.3; }
.sb-trad-glyphs { display: inline-flex; gap: 2px; align-items: center; flex: 0 0 auto; vertical-align: middle; margin-right: 5px; }
.sb-trad-glyph { display: inline-flex; align-items: center; justify-content: center; padding: 2px; border-radius: 6px; }
.sb-trad-glyph.is-fn { background: var(--surface-2); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent, #c8504a) 50%, transparent); }
.sb-trad-glyph.is-character { background: color-mix(in srgb, #E0A157 18%, transparent); }
.sb-trad-glyph svg { display: block; }
.qp-glyph { display: inline-flex; align-items: center; vertical-align: middle; margin-right: 6px; }
.qp-glyph svg { display: block; }
.tree-row-desc { font-size: var(--fs-caption); color: var(--text-3); margin-top: 2px; line-height: 1.4; }
.tree-row-count { font-size: var(--fs-micro); color: var(--text-3); font-variant-numeric: tabular-nums; padding-left: var(--s2); white-space: nowrap; }

.trad-leaf { display: grid; grid-template-columns: 20px 1fr auto; gap: var(--s2); padding: var(--s3); border: 1px solid var(--border); border-radius: var(--r2); margin: var(--s1) 0 var(--s1) 28px; background: var(--surface); transition: border-color var(--t-fast) var(--ease); }
.trad-leaf:hover { border-color: var(--border-strong); }
.trad-leaf-info { min-width: 0; }
.trad-leaf-name { font-size: var(--fs-body); font-weight: var(--fw-semibold); letter-spacing: -0.005em; }
.trad-leaf-desc { font-size: var(--fs-caption); color: var(--text-2); margin-top: 4px; line-height: 1.5; }
.trad-leaf-meta { font-size: var(--fs-micro); color: var(--text-3); margin-top: 6px; line-height: 1.4; }
.trad-leaf-meta-line { font-family: 'JetBrains Mono', monospace; letter-spacing: -0.005em; }
.trad-leaf-actions { display: flex; flex-direction: column; gap: 4px; align-items: stretch; align-self: flex-start; }
.trad-leaf-actions .leaf-btn { padding: 5px var(--s2); border-radius: var(--r1); font-size: var(--fs-caption); font-weight: var(--fw-medium); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); transition: all var(--t-fast) var(--ease); white-space: nowrap; line-height: 1.3; }
.trad-leaf-actions .leaf-btn:hover { background: var(--text); color: var(--surface); border-color: var(--text); }
.trad-leaf-actions .leaf-btn.ghost { border-color: transparent; color: var(--text-2); }
.trad-leaf-actions .leaf-btn.ghost:hover { background: var(--surface-2); border-color: var(--border-strong); color: var(--text); }

/* Axis fingerprint mini-chart */
.fingerprint { display: inline-flex; align-items: end; gap: 2px; height: 28px; margin-top: 6px; }
.fingerprint-axis { width: 5px; background: var(--text-4); border-radius: 1px; transition: background var(--t-fast) var(--ease); cursor: help; position: relative; }
.fingerprint-axis.neg { background: var(--text-3); }
.fingerprint-axis.pos { background: var(--text); }
.fingerprint-axis.neutral { background: var(--text-4); height: 2px !important; align-self: center; }

/* Similar view */
.similar-back { font-size: var(--fs-caption); padding: 6px var(--s3); margin-bottom: var(--s4); border-radius: var(--r2); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); transition: all var(--t-fast) var(--ease); }
.similar-back:hover { background: var(--surface-2); color: var(--text); }
.similar-source { padding: var(--s4); background: var(--surface-2); border-radius: var(--r3); border: 1px solid var(--border); margin-bottom: var(--s5); }
.similar-source-label { font-size: var(--fs-micro); font-weight: var(--fw-semibold); text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-3); }
.similar-source-name { font-size: var(--fs-title); font-weight: var(--fw-semibold); letter-spacing: -0.01em; margin-top: 4px; }
.similar-source-lineage { font-size: var(--fs-micro); color: var(--text-3); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em; }
.similar-source-desc { font-size: var(--fs-caption); color: var(--text-2); margin-top: var(--s2); line-height: 1.5; }

.similar-grid { display: flex; flex-direction: column; gap: var(--s2); }
.similar-card { padding: var(--s3) var(--s4); border: 1px solid var(--border); border-radius: var(--r3); background: var(--surface); display: grid; grid-template-columns: 1fr auto; gap: var(--s3); align-items: start; transition: border-color var(--t-fast) var(--ease); }
.similar-card:hover { border-color: var(--border-strong); }
.similar-card-name { font-size: var(--fs-body); font-weight: var(--fw-semibold); letter-spacing: -0.005em; }
.similar-card-distance { font-family: 'JetBrains Mono', monospace; font-size: var(--fs-micro); color: var(--text-3); margin-top: 2px; letter-spacing: -0.005em; }
.similar-card-desc { font-size: var(--fs-caption); color: var(--text-2); margin-top: 6px; line-height: 1.5; }
.similar-card-matches { font-size: var(--fs-micro); color: var(--text-3); margin-top: var(--s2); }
.similar-card-matches-row { display: flex; gap: 6px; align-items: baseline; padding: 2px 0; }
.similar-match-axis { font-weight: var(--fw-semibold); color: var(--text-2); }
.similar-match-value { color: var(--text-2); font-style: italic; }
.similar-card-actions { display: flex; flex-direction: column; gap: 4px; }

.tree-search-hits { padding-bottom: var(--s3); }
.tree-search-result { padding: var(--s3) var(--s4); border: 1px solid var(--border); border-radius: var(--r2); background: var(--surface); display: grid; grid-template-columns: 1fr auto; gap: var(--s3); margin-bottom: var(--s2); align-items: start; }
.tree-search-path { font-size: var(--fs-micro); font-weight: var(--fw-semibold); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); margin-bottom: 4px; }

/* Cross-reference (multi-parent) leaf styling */
.trad-leaf.crossref { background: transparent; border-style: dashed; opacity: 0.85; }
.trad-leaf.crossref:hover { opacity: 1; }
.trad-leaf-xref-tag { display: inline-block; font-size: var(--fs-micro); font-weight: var(--fw-semibold); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); padding: 1px 6px; border: 1px solid var(--border-strong); border-radius: 3px; margin-right: 6px; vertical-align: middle; }
.trad-leaf-xref-from { font-size: var(--fs-micro); color: var(--text-3); margin-top: 4px; font-style: italic; }
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

// ---- TREE LOOKUP HELPERS ----
function getTreeNode(id) {
  return TREE_NODES.find(n => n.id === id);
}
function tradParent(tradId) {
  return Catalog.ext(tradId)?.parent || null;
}
function getChildren(nodeId) {
  const internal = TREE_NODES.filter(n => n.parent === nodeId);
  const leaves = Catalog.all().filter(t => tradParent(t.id) === nodeId);
  return [...internal, ...leaves];
}
function getCrossRefLeaves(nodeId) {
  return Catalog.all().filter(t => {
    const ext = Catalog.ext(t.id);
    if (!ext || !ext.crossRefs) return false;
    if (tradParent(t.id) === nodeId) return false; // already shown as primary
    return ext.crossRefs.includes(nodeId);
  });
}
function getRoots() {
  return TREE_NODES.filter(n => n.parent === null);
}
function countDescendantLeaves(nodeId) {
  let count = 0;
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop();
    const kids = getChildren(id);
    kids.forEach(k => {
      if (TREE_NODES.some(n => n.id === k.id)) stack.push(k.id);
      else count++;
    });
  }
  return count;
}
function getAncestorPath(tradId) {
  const path = [];
  let p = tradParent(tradId);
  while (p) {
    const node = getTreeNode(p);
    if (!node) break;
    path.unshift(node.name);
    p = node.parent;
  }
  return path;
}

// ---- SIMILARITY ----
function tradAxes(id) { return Catalog.ext(id)?.axes || null; }

function computeDistance(idA, idB) {
  const a = tradAxes(idA), b = tradAxes(idB);
  if (!a || !b) return Infinity;
  let sum = 0;
  AXIS_DEFINITIONS.forEach(ax => {
    const av = a[ax.id] ?? 0;
    const bv = b[ax.id] ?? 0;
    sum += (av - bv) * (av - bv);
  });
  return Math.sqrt(sum);
}

function findSimilar(idA, n) {
  n = n || 8;
  const a = tradAxes(idA);
  if (!a) return [];
  return Catalog.all()
    .filter(t => t.id !== idA && tradAxes(t.id))
    .map(t => ({ id: t.id, name: t.name, distance: computeDistance(idA, t.id) }))
    .sort((x, y) => x.distance - y.distance)
    .slice(0, n);
}

// Top-3 axes where two traditions agree most strongly (smallest |diff|, both nonzero same sign preferred)
function getMatchingAxes(idA, idB, n) {
  n = n || 3;
  const a = tradAxes(idA), b = tradAxes(idB);
  if (!a || !b) return [];
  return AXIS_DEFINITIONS.map(ax => {
    const av = a[ax.id] ?? 0;
    const bv = b[ax.id] ?? 0;
    return { axis: ax, av, bv, diff: Math.abs(av - bv), shared: av === bv ? Math.abs(av) : 0 };
  })
    // Prefer matching axes with strong shared values (both at +2 or both at -2)
    .sort((x, y) => x.diff - y.diff || y.shared - x.shared)
    .slice(0, n);
}

function axisLabel(axis, value) {
  if (value <= -1.5) return axis.neg;
  if (value <= -0.5) return 'leans ' + axis.neg;
  if (value < 0.5 && value > -0.5) return 'middle';
  if (value < 1.5) return 'leans ' + axis.pos;
  return axis.pos;
}

// ---- AXIS FINGERPRINT MINI-CHART ----
function renderFingerprint(idA) {
  const a = tradAxes(idA);
  if (!a) return '';
  let html = '<div class="fingerprint" aria-label="Axis fingerprint">';
  AXIS_DEFINITIONS.forEach(ax => {
    const v = a[ax.id] ?? 0;
    const cls = v > 0 ? 'pos' : (v < 0 ? 'neg' : 'neutral');
    const h = Math.max(2, Math.abs(v) * 13); // up to 26px
    html += `<div class="fingerprint-axis ${cls}" style="height: ${h}px;" data-tooltip="${esc(ax.name)}: ${v > 0 ? '+' : ''}${v}"></div>`;
  });
  html += '</div>';
  return html;
}

// ---- INSTRUMENT SIMILARITY (parameter-space neighbors over the 9 instrument axes) ----
function instAxes(id) { return Inst(id)?.axes || null; }

function computeInstrumentDistance(idA, idB) {
  const a = instAxes(idA), b = instAxes(idB);
  if (!a || !b) return Infinity;
  let sum = 0;
  INSTRUMENT_AXIS_DEFINITIONS.forEach(ax => {
    const av = a[ax.id] ?? 0;
    const bv = b[ax.id] ?? 0;
    sum += (av - bv) * (av - bv);
  });
  return Math.sqrt(sum);
}

function findSimilarInstruments(idA, n) {
  n = n || 8;
  const a = instAxes(idA);
  if (!a) return [];
  return INSTRUMENTS
    .filter(i => i.id !== idA && instAxes(i.id))
    .map(i => ({ id: i.id, name: i.name, short: i.short, family: i.family, distance: computeInstrumentDistance(idA, i.id) }))
    .sort((x, y) => x.distance - y.distance)
    .slice(0, n);
}

function getMatchingInstrumentAxes(idA, idB, n) {
  n = n || 3;
  const a = instAxes(idA), b = instAxes(idB);
  if (!a || !b) return [];
  return INSTRUMENT_AXIS_DEFINITIONS.map(ax => {
    const av = a[ax.id] ?? 0;
    const bv = b[ax.id] ?? 0;
    return { axis: ax, av, bv, diff: Math.abs(av - bv), shared: av === bv ? Math.abs(av) : 0 };
  })
    .sort((x, y) => x.diff - y.diff || y.shared - x.shared)
    .slice(0, n);
}

function renderInstrumentFingerprint(idA) {
  return renderAxisFingerprint(instAxes(idA));
}

// Generalized fingerprint renderer — accepts any axis object including float-valued centroids.
// classExtra lets callers add 'centroid-fingerprint' or 'small' modifiers.
function renderAxisFingerprint(axesObj, classExtra) {
  if (!axesObj) return '';
  let html = `<div class="fingerprint inst-fingerprint${classExtra ? ' ' + classExtra : ''}" aria-label="Instrument axis fingerprint">`;
  INSTRUMENT_AXIS_DEFINITIONS.forEach(ax => {
    const v = axesObj[ax.id];
    const numeric = typeof v === 'number' ? v : 0;
    const cls = numeric > 0.05 ? 'pos' : (numeric < -0.05 ? 'neg' : 'neutral');
    const h = Math.max(2, Math.min(30, Math.abs(numeric) * 13));
    const valStr = Number.isInteger(numeric)
      ? (numeric > 0 ? '+' + numeric : '' + numeric)
      : (numeric > 0 ? '+' + numeric.toFixed(1) : numeric.toFixed(1));
    html += `<div class="fingerprint-axis ${cls}" style="height: ${h}px;" data-tooltip="${esc(ax.name)}: ${valStr}"></div>`;
  });
  html += '</div>';
  return html;
}

// ---- CROSS-CORRELATION: tradition centroids in the 9-instrument-axis space ----
// A tradition's centroid is the mean axis vector across its canonical instruments.
// This bridges the two parameter spaces: tradition (13-axis stylistic) and instrument (9-axis sonic).
//
// The centroid is a pure function of static catalog data — the same tradId
// always produces the same result. Cached lazily: first call per tradId
// computes and stores; subsequent calls return the cached vector. With
// findTraditionsByVector iterating all 1090 traditions on every render, this
// drops the per-render compute from ~1M ops to ~5K ops after first warmup.
let _TRAD_CENTROID_CACHE = null;

function tradInstrumentCentroid(tradId) {
  if (!_TRAD_CENTROID_CACHE) _TRAD_CENTROID_CACHE = new Map();
  if (_TRAD_CENTROID_CACHE.has(tradId)) return _TRAD_CENTROID_CACHE.get(tradId);
  const trad = Tradition(tradId);
  if (!trad || !trad.instruments || !trad.instruments.length) {
    _TRAD_CENTROID_CACHE.set(tradId, null);
    return null;
  }
  const vectors = trad.instruments.map(id => instAxes(id)).filter(Boolean);
  if (!vectors.length) {
    _TRAD_CENTROID_CACHE.set(tradId, null);
    return null;
  }
  const centroid = {};
  INSTRUMENT_AXIS_DEFINITIONS.forEach(ax => {
    centroid[ax.id] = vectors.reduce((s, v) => s + (v[ax.id] ?? 0), 0) / vectors.length;
  });
  centroid._n = vectors.length;
  _TRAD_CENTROID_CACHE.set(tradId, centroid);
  return centroid;
}

function centroidDistance(a, b) {
  if (!a || !b) return Infinity;
  let sum = 0;
  INSTRUMENT_AXIS_DEFINITIONS.forEach(ax => {
    const av = a[ax.id] ?? 0;
    const bv = b[ax.id] ?? 0;
    sum += (av - bv) * (av - bv);
  });
  return Math.sqrt(sum);
}

// Reverse lookup: given an arbitrary 9-vector, rank traditions by centroid distance.
// Powers "what tradition does this stack of instruments resemble?"
function findTraditionsByVector(vec, n) {
  n = n || 8;
  const results = [];
  Catalog.all().forEach(t => {
    const c = tradInstrumentCentroid(t.id);
    if (!c) return;
    results.push({ id: t.id, name: t.name, distance: centroidDistance(vec, c), instrumentCount: c._n });
  });
  return results.sort((a, b) => a.distance - b.distance).slice(0, n);
}

// Forward lookup: given a tradition, find instruments outside its roster that fit its centroid.
// Powers "what other instruments would belong here?"
function findInstrumentsForTradition(tradId, n) {
  n = n || 8;
  const c = tradInstrumentCentroid(tradId);
  if (!c) return [];
  const trad = Tradition(tradId);
  const existing = new Set(trad.instruments || []);
  return INSTRUMENTS
    .filter(i => !existing.has(i.id) && i.axes)
    .map(i => ({ id: i.id, name: i.name, short: i.short, family: i.family, distance: centroidDistance(c, i.axes) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n);
}

// ---- AXIS FILTERS for the instrument picker ----
// Each pill is a single-axis predicate. Pills compose with AND.

const INSTRUMENT_FILTER_PREDS = {
  sustained:        (a) => a.sustain >= 1,
  decay:            (a) => a.sustain <= -1,
  polyphonic:       (a) => a.polyphony >= 1,
  monophonic:       (a) => a.polyphony <= -1,
  pitched:          (a) => a.harmonicity >= 1,
  noise:            (a) => a.harmonicity <= -1,
  fixed_pitch:      (a) => a.pitchFix >= 1,
  continuous_pitch: (a) => a.pitchFix <= -1,
  low:              (a) => a.register <= -1,
  high:             (a) => a.register >= 1,
  wide_range:       (a) => a.range >= 1,
  acoustic:         (a) => a.transduction <= -1,
  electric:         (a) => a.transduction === 1,
  electronic:       (a) => a.transduction >= 2,
  expressive:       (a) => a.articulation >= 2,
};

const INSTRUMENT_FILTER_PILLS = [
  { id: 'sustained',        label: 'sustained' },
  { id: 'decay',            label: 'decay-only' },
  { id: 'polyphonic',       label: 'polyphonic' },
  { id: 'monophonic',       label: 'monophonic' },
  { id: 'pitched',          label: 'pitched' },
  { id: 'noise',            label: 'noise-leaning' },
  { id: 'fixed_pitch',      label: 'fixed-pitch' },
  { id: 'continuous_pitch', label: 'continuous-pitch' },
  { id: 'low',              label: 'low register' },
  { id: 'high',             label: 'high register' },
  { id: 'wide_range',       label: 'wide range' },
  { id: 'acoustic',         label: 'acoustic' },
  { id: 'electric',         label: 'electric' },
  { id: 'electronic',       label: 'electronic / synth' },
  { id: 'expressive',       label: 'fully expressive' },
];

function passesInstrumentFilter(inst, filterSet) {
  if (!filterSet || filterSet.size === 0) return true;
  if (!inst.axes) return false;
  for (const f of filterSet) {
    const pred = INSTRUMENT_FILTER_PREDS[f];
    if (pred && !pred(inst.axes)) return false;
  }
  return true;
}

// ---- SONG FINGERPRINT: combines instrument-stack centroid with tradition match ----
// Foundation for "label me a song" workflows. Operates on canvas cards.

function buildSongFingerprint(cards) {
  if (!cards || !cards.length) return null;
  const vectors = cards.map(c => instAxes(c.instrumentId)).filter(Boolean);
  if (!vectors.length) return null;

  // Centroid: arithmetic mean across the stack
  const centroid = {};
  INSTRUMENT_AXIS_DEFINITIONS.forEach(ax => {
    centroid[ax.id] = vectors.reduce((s, v) => s + v[ax.id], 0) / vectors.length;
  });

  // Diversity: RMS distance from centroid (homogeneity measure)
  const diversity = Math.sqrt(
    vectors.reduce((s, v) => {
      let d = 0;
      INSTRUMENT_AXIS_DEFINITIONS.forEach(ax => {
        const dv = v[ax.id] - centroid[ax.id];
        d += dv * dv;
      });
      return s + d;
    }, 0) / vectors.length
  );

  // Range: max pairwise distance — "how far apart are the most distant elements"
  let maxPair = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      let d = 0;
      INSTRUMENT_AXIS_DEFINITIONS.forEach(ax => {
        const dv = vectors[i][ax.id] - vectors[j][ax.id];
        d += dv * dv;
      });
      const dist = Math.sqrt(d);
      if (dist > maxPair) maxPair = dist;
    }
  }

  return {
    instrumentCount: vectors.length,
    centroid,
    diversity,
    spread: maxPair,
    nearestTraditions: findTraditionsByVector(centroid, 5)
  };
}

// Diversity-band labels for human-readable stack characterization.
// RMS-distance thresholds: 0..1.5 homogeneous, 1.5..2.5 cohesive, 2.5..3.5 varied, 3.5+ disparate
function diversityLabel(d) {
  if (d < 1.5) return 'homogeneous';
  if (d < 2.5) return 'cohesive';
  if (d < 3.5) return 'varied';
  return 'disparate';
}

// ---- STACK SIGNATURE PANEL (canvas-level song fingerprint) ----
// Renders above the cards when 2+ exist. Shows centroid fingerprint, closest traditions,
// and a homogeneity descriptor. Clicking a tradition name navigates to its similar view.

function wireStackSignatureEvents(el) {
  if (!el) return;
  el.querySelectorAll('[data-stack-trad]').forEach(btn => {
    btn.addEventListener('click', () => {
      app.tradSearch = '';
      app.similarFor = btn.dataset.stackTrad;
      const si = document.getElementById('search-trad');
      if (si) si.value = '';
      renderTradPicker();
      openModal('modal-trad');
    });
  });
  const detailBtn = el.querySelector('[data-stack-detail]');
  if (detailBtn) detailBtn.addEventListener('click', () => {
    // Open the tradition modal pinned to the closest match's similar view
    const fp = buildSongFingerprint(app.cards);
    if (!fp || !fp.nearestTraditions.length) {
      showToast('No tradition match for this stack', 'error');
      return;
    }
    app.tradSearch = '';
    app.similarFor = fp.nearestTraditions[0].id;
    const si = document.getElementById('search-trad');
    if (si) si.value = '';
    renderTradPicker();
    openModal('modal-trad');
  });
}

// ---- LETTER-BAND CSS for instrument picker (large families) ----
(function injectInstPickerStyles() {
  const css = `
.letter-section { margin-top: var(--s2); }
.letter-section:first-child { margin-top: 0; }
.letter-band {
  font-size: var(--fs-micro);
  font-weight: var(--fw-semibold);
  color: var(--text-3);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: var(--s2) 0 var(--s1) 2px;
  margin: 0;
  border-top: 1px solid var(--border-1);
}
.letter-section:first-child .letter-band { border-top: none; padding-top: 0; }

/* Axis filter pills above the family grid */
.axis-filter-bar {
  padding: var(--s3) 0 var(--s4) 0;
  margin-bottom: var(--s3);
  border-bottom: 1px solid var(--border-1);
}
.axis-filter-label {
  font-size: var(--fs-micro);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-3);
  margin-bottom: var(--s2);
}
.axis-filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.axis-filter-pill {
  font-size: var(--fs-caption);
  font-weight: var(--fw-medium);
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
  line-height: 1.3;
  white-space: nowrap;
}
.axis-filter-pill:hover { background: var(--surface-2); color: var(--text); }
.axis-filter-pill.active { background: var(--text); color: var(--surface); border-color: var(--text); }
.axis-filter-pill.active:hover { background: var(--text-2); border-color: var(--text-2); }
.axis-filter-status {
  font-size: var(--fs-micro);
  color: var(--text-3);
  margin-top: var(--s2);
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.005em;
}
.axis-filter-clear {
  display: inline;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  color: var(--text-2);
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
  letter-spacing: inherit;
}
.axis-filter-clear:hover { color: var(--text); }

/* "Instruments that fit" mini-section in tradition similar view */
.fit-instruments {
  margin-top: var(--s3);
  padding-top: var(--s3);
  border-top: 1px dashed var(--border-1);
}
.fit-instruments-label {
  font-size: var(--fs-micro);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-3);
  margin-bottom: var(--s2);
}
.fit-instruments-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.fit-instrument {
  font-size: var(--fs-caption);
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.01em;
}
.fit-instrument-distance {
  color: var(--text-3);
  margin-left: 4px;
  font-size: var(--fs-micro);
}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

// ---- INST PICKER OVERRIDE: alphabetical with letter bands for large families ----
const LETTER_BAND_THRESHOLD = 15;

// Search-side normalization — folds dash variants to space so user queries
// using natural whitespace ("doo wop") match canonical hyphenated names
// ("Doo-wop") and prose with em-dashes. Applied to BOTH query and target
// fields at query time; the underlying data is never modified.
function normalizeSearch(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u002D\u2013\u2014]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderInstPicker() {
  const c = document.getElementById('picker-inst');
  if (!c) return;

  // If we're in a "find similar instruments" drill-down, render that instead
  if (app.similarInstFor) {
    c.innerHTML = renderSimilarInstrumentView(app.similarInstFor);
    wireSimilarInstrumentEvents(c);
    return;
  }

  const q = normalizeSearch(app.pickerSearch);
  const filters = app.instrumentAxisFilters || new Set();
  const sortKey = (i) => (i.short || i.name || '').toLowerCase();
  const firstLetter = (i) => {
    const s = sortKey(i);
    // Strip diacritics for grouping
    const base = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const ch = base.charAt(0).toUpperCase();
    // Special-char fold: ʿ, ', etc → use second char
    if (!/[A-Z]/.test(ch)) {
      const m = base.match(/[a-zA-Z]/);
      return m ? m[0].toUpperCase() : '#';
    }
    return ch;
  };
  const matchesQuery = (i) => !q || (normalizeSearch(i.name).includes(q) || normalizeSearch(i.short || '').includes(q));
  const matchesFilters = (i) => passesInstrumentFilter(i, filters);

  // Filter pill bar — sits above the family grid, shows active filter state
  let filterBar = `<div class="axis-filter-bar">`;
  filterBar += `<div class="axis-filter-label">Axis filters</div>`;
  filterBar += `<div class="axis-filter-pills">`;
  INSTRUMENT_FILTER_PILLS.forEach(p => {
    const active = filters.has(p.id);
    filterBar += `<button class="axis-filter-pill${active ? ' active' : ''}" data-filter-toggle="${esc(p.id)}">${esc(p.label)}</button>`;
  });
  filterBar += `</div>`;
  if (filters.size > 0) {
    const activeCount = INSTRUMENTS.filter(i => matchesFilters(i)).length;
    filterBar += `<div class="axis-filter-status">${activeCount} of ${INSTRUMENTS.length} match · <button class="axis-filter-clear" data-filter-clear>clear</button></div>`;
  }
  filterBar += `</div>`;

  if (!app.instCollapsed) app.instCollapsed = new Set();
  // While searching or filtering, force every family open so matches show.
  const forceExpand = !!q || filters.size > 0;

  let html = '';
  INSTRUMENT_FAMILIES.forEach(fam => {
    const list = INSTRUMENTS.filter(i => i.family === fam.id && matchesQuery(i) && matchesFilters(i));
    if (!list.length) return;
    const collapsed = !forceExpand && app.instCollapsed.has(fam.id);
    html += `<div class="fam-block${collapsed ? ' collapsed' : ''}"><button class="fam-head" data-fam-toggle="${esc(fam.id)}"><span class="fam-chevron">${icon('chevron-down', 12)}</span><span class="fam-name">${esc(fam.name)}</span><span class="fam-count">${list.length}</span></button>`;

    // Letter bands only for large families AND when not actively searching/filtering
    if (list.length >= LETTER_BAND_THRESHOLD && !q && filters.size === 0) {
      // Group by first letter
      const groups = new Map();
      list.forEach(i => {
        const L = firstLetter(i);
        if (!groups.has(L)) groups.set(L, []);
        groups.get(L).push(i);
      });
      const letters = Array.from(groups.keys()).sort();
      letters.forEach(L => {
        html += `<div class="letter-section"><div class="letter-band">${esc(L)}</div><div class="fam-grid">`;
        groups.get(L).forEach(i => html += `<button class="pick-item" data-add="${esc(i.id)}">${esc(i.short || i.name)}</button>`);
        html += `</div></div>`;
      });
    } else {
      // Small family, active search, or active filter — flat grid
      html += `<div class="fam-grid">`;
      list.forEach(i => html += `<button class="pick-item" data-add="${esc(i.id)}">${esc(i.short || i.name)}</button>`);
      html += `</div>`;
    }
    html += `</div>`;
  });

  let body;
  if (!html) {
    const msg = filters.size > 0 && !q ? 'No instruments match the active filters'
              : q ? `No instruments match "${esc(q)}"`
              : 'No instruments';
    body = `<div class="empty-msg">${msg}</div>`;
  } else {
    body = html;
  }
  // Expand/collapse-all only matters when families are collapsible (not while
  // searching/filtering, which force-expands everything).
  const toolbar = (html && !forceExpand)
    ? `<div class="picker-toolbar"><button data-inst-expand="all">Expand all</button><button data-inst-expand="none">Collapse all</button></div>`
    : '';
  c.innerHTML = filterBar + toolbar + body;

  c.querySelectorAll('[data-fam-toggle]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.famToggle;
    if (app.instCollapsed.has(id)) app.instCollapsed.delete(id); else app.instCollapsed.add(id);
    renderInstPicker();
  }));
  c.querySelectorAll('[data-inst-expand]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.instExpand === 'all') app.instCollapsed.clear();
    else INSTRUMENT_FAMILIES.forEach(f => app.instCollapsed.add(f.id));
    renderInstPicker();
  }));

  // Wire filter pill toggles
  c.querySelectorAll('[data-filter-toggle]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.filterToggle;
    if (filters.has(id)) filters.delete(id);
    else filters.add(id);
    renderInstPicker();
  }));
  const clearBtn = c.querySelector('[data-filter-clear]');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    app.instrumentAxisFilters.clear();
    renderInstPicker();
  });
  c.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    const iid = b.dataset.add;
    const card = addCard(iid);
    if (!card) { showToast(`Unknown instrument: ${iid}`, 'error'); return; }
    closeModal('modal-add');
    renderAll();
    showToast(`Added ${Inst(iid)?.short || iid}`, 'success');
    setTimeout(() => {
      const el = document.querySelector(`[data-card-id="${card.id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }));
}

// ---- TREE STATE ----
if (!app.treeExpanded) app.treeExpanded = new Set();
if (!('similarFor' in app)) app.similarFor = null;
if (!('similarInstFor' in app)) app.similarInstFor = null;
if (!app.instrumentAxisFilters) app.instrumentAxisFilters = new Set();

// ---- NESTED TREE PICKER ----
function renderTradPicker() {
  const c = document.getElementById('picker-trad');
  if (!c) return;
  const q = normalizeSearch(app.tradSearch);

  // If we're inside a "find similar" drill-down, render that instead
  if (app.similarFor) {
    c.innerHTML = renderSimilarView(app.similarFor);
    wireSimilarEvents(c);
    return;
  }

  // Search mode — flat results across the whole catalog
  if (q) {
    // Rank by WHERE the query matches, so an exact title beats a mere prose
    // mention: 0 exact name · 1 name prefix · 2 name substring · 3 lineage/
    // description only. Previously this was a flat substring filter rendered in
    // raw catalog order, so a tradition that only *mentions* the term in its
    // description (or a late-array entry) could bury the exact title far down.
    // Secondary sort: shorter name first (more central), then alphabetical.
    const matchRank = (t) => {
      const ext = Catalog.ext(t.id) || {};
      const name = normalizeSearch(t.name);
      if (name === q) return 0;
      if (name.startsWith(q)) return 1;
      if (name.includes(q)) return 2;
      if (normalizeSearch(t.lineage || '').includes(q) || normalizeSearch(ext.description || '').includes(q)) return 3;
      return Infinity;
    };
    const matches = Catalog.all()
      .map((t) => ({ t, r: matchRank(t) }))
      .filter((x) => x.r !== Infinity)
      .sort((a, b) => a.r - b.r || a.t.name.length - b.t.name.length || a.t.name.localeCompare(b.t.name))
      .map((x) => x.t);
    if (!matches.length) {
      c.innerHTML = `<div class="empty-msg">No traditions match &ldquo;${esc(q)}&rdquo;</div>`;
      return;
    }
    let html = `<div class="tree-search-hits">`;
    html += `<div style="font-size: var(--fs-micro); color: var(--text-3); margin-bottom: var(--s3); text-transform: uppercase; letter-spacing: 0.06em; font-weight: var(--fw-semibold);">${matches.length} match${matches.length === 1 ? '' : 'es'}</div>`;
    matches.forEach(t => {
      const path = getAncestorPath(t.id);
      const ext = Catalog.ext(t.id) || {};
      const inst = (t.instruments || []).map(id => Inst(id)?.short || Inst(id)?.name).filter(Boolean);
      html += `<div class="tree-search-result">`;
      html += `<div>`;
      if (path.length) html += `<div class="tree-search-path">${esc(path.join(' / '))}</div>`;
      html += `<div class="trad-leaf-name">${(typeof traditionGlyphsHTML==='function'?traditionGlyphsHTML(t.id,30):'')}${esc(t.name)}</div>`;
      if (ext.description) html += `<div class="trad-leaf-desc">${esc(ext.description)}</div>`;
      if (inst.length) html += `<div class="trad-leaf-meta trad-leaf-meta-line">${esc(inst.join(' · '))}</div>`;
      html += renderFingerprint(t.id);
      html += `</div>`;
      html += `<div class="trad-leaf-actions">`;
      html += `<button class="leaf-btn" data-import="${esc(t.id)}">Import ${(t.instruments || []).length}</button>`;
      if (ext.axes) html += `<button class="leaf-btn ghost" data-similar="${esc(t.id)}">Find similar</button>`;
      html += `</div>`;
      html += `</div>`;
    });
    html += `</div>`;
    c.innerHTML = html;
    wireTreeEvents(c);
    return;
  }

  // Tree mode — render roots and recurse
  let html = '';
  getRoots().forEach(root => { html += renderTreeNode(root, 0); });
  c.innerHTML = html;
  wireTreeEvents(c);
}

function renderTreeNode(node, depth) {
  const expanded = app.treeExpanded.has(node.id);
  const children = getChildren(node.id);
  const leafCount = countDescendantLeaves(node.id);
  const indent = depth * 16;

  let html = `<div class="tree-node" style="padding-left: ${indent}px;">`;
  html += `<div class="tree-row depth-${Math.min(depth, 2)}" data-toggle-tree="${esc(node.id)}">`;
  html += `<span class="tree-chevron ${expanded ? 'expanded' : ''}">${icon('chevron-right', 12)}</span>`;
  html += `<div>`;
  html += `<div class="tree-row-name">${(typeof traditionGlyphsHTML==='function'?traditionGlyphsHTML(node.id,28):'')}${esc(node.name)}</div>`;
  if (node.description && depth > 0) html += `<div class="tree-row-desc">${esc(node.description)}</div>`;
  html += `</div>`;
  html += `<div class="tree-row-count">${leafCount}</div>`;
  html += `</div>`;

  if (expanded) {
    children.forEach(child => {
      if (TREE_NODES.some(n => n.id === child.id)) {
        html += renderTreeNode(child, depth + 1);
      } else {
        html += renderTradLeaf(child, depth + 1, false);
      }
    });
    // Cross-references — traditions that primarily live elsewhere but also belong here
    const crossRefs = getCrossRefLeaves(node.id);
    crossRefs.forEach(t => {
      html += renderTradLeaf(t, depth + 1, true);
    });
  }
  html += `</div>`;
  return html;
}

function renderTradLeaf(tradition, depth, isCrossRef) {
  const ext = Catalog.ext(tradition.id) || {};
  const inst = (tradition.instruments || []).map(id => Inst(id)?.short || Inst(id)?.name).filter(Boolean);
  const indent = depth * 16;
  const cls = isCrossRef ? 'trad-leaf crossref' : 'trad-leaf';
  let html = `<div class="${cls}" style="margin-left: ${indent + 12}px;">`;
  html += `<div></div>`;
  html += `<div class="trad-leaf-info">`;
  html += `<div class="trad-leaf-name">`;
  html += (typeof traditionGlyphsHTML==='function'?traditionGlyphsHTML(tradition.id,30):'');
  if (isCrossRef) html += `<span class="trad-leaf-xref-tag">cross-ref</span>`;
  html += `${esc(tradition.name)}</div>`;
  if (isCrossRef) {
    const primaryParent = getTreeNode(tradParent(tradition.id));
    if (primaryParent) {
      html += `<div class="trad-leaf-xref-from">primary: ${esc(primaryParent.name)}</div>`;
    }
  }
  if (ext.description) html += `<div class="trad-leaf-desc">${esc(ext.description)}</div>`;
  if (inst.length) html += `<div class="trad-leaf-meta trad-leaf-meta-line">${esc(inst.join(' · '))}</div>`;
  if (ext.exemplars && ext.exemplars.length) html += `<div class="trad-leaf-meta">${esc(ext.exemplars.slice(0, 2).join(' · '))}</div>`;
  if (ext.axes) html += renderFingerprint(tradition.id);
  html += `</div>`;
  html += `<div class="trad-leaf-actions">`;
  html += `<button class="leaf-btn" data-import="${esc(tradition.id)}">Import ${inst.length}</button>`;
  if (ext.axes) html += `<button class="leaf-btn ghost" data-similar="${esc(tradition.id)}">Find similar</button>`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

// ---- SIMILAR VIEW ----
function renderSimilarView(tradId) {
  const trad = Tradition(tradId);
  if (!trad) return '<div>Tradition not found</div>';
  const ext = Catalog.ext(tradId) || {};
  const neighbors = findSimilar(tradId, 8);

  let html = `<button class="similar-back" data-similar-back>← Back to tree</button>`;
  html += `<div class="similar-source">`;
  html += `<div class="similar-source-label">Finding traditions sonically near</div>`;
  html += `<div class="similar-source-name">${esc(trad.name)}</div>`;
  if (trad.lineage) html += `<div class="similar-source-lineage">${esc(trad.lineage)}</div>`;
  if (ext.description) html += `<div class="similar-source-desc">${esc(ext.description)}</div>`;
  html += renderFingerprint(tradId);

  // "Instruments that fit" — outside-the-canon instruments closest to this tradition's centroid
  const fits = findInstrumentsForTradition(tradId, 6);
  if (fits.length) {
    html += `<div class="fit-instruments">`;
    html += `<div class="fit-instruments-label">Instruments outside the canon that fit this parameter space</div>`;
    html += `<div class="fit-instruments-list">`;
    fits.forEach(f => {
      html += `<span class="fit-instrument" data-tooltip="${esc(FamName(f.family))} · distance ${f.distance.toFixed(2)}">${esc(f.short || f.name)}<span class="fit-instrument-distance">${f.distance.toFixed(1)}</span></span>`;
    });
    html += `</div></div>`;
  }
  html += `</div>`;

  if (!neighbors.length) {
    html += `<div class="empty-msg">No comparable traditions yet — this one stands alone in the catalog.</div>`;
    return html;
  }

  html += `<div class="similar-grid">`;
  neighbors.forEach(n => {
    const nTrad = Tradition(n.id);
    const nExt = Catalog.ext(n.id) || {};
    const path = getAncestorPath(n.id);
    const matches = getMatchingAxes(tradId, n.id, 3);
    const inst = (nTrad.instruments || []).map(id => Inst(id)?.short || Inst(id)?.name).filter(Boolean);

    html += `<div class="similar-card">`;
    html += `<div>`;
    html += `<div class="similar-card-name">${esc(nTrad.name)}</div>`;
    html += `<div class="similar-card-distance">distance ${n.distance.toFixed(2)}${path.length ? ' · ' + esc(path.join(' / ')) : ''}</div>`;
    if (nExt.description) html += `<div class="similar-card-desc">${esc(nExt.description)}</div>`;
    if (inst.length) html += `<div class="trad-leaf-meta trad-leaf-meta-line" style="margin-top: 6px;">${esc(inst.slice(0, 5).join(' · '))}${inst.length > 5 ? '…' : ''}</div>`;
    html += renderFingerprint(n.id);
    html += `<div class="similar-card-matches">`;
    html += `<div class="label-micro-cap">Closest on</div>`;
    matches.forEach(m => {
      html += `<div class="similar-card-matches-row">`;
      html += `<span class="similar-match-axis">${esc(m.axis.name)}</span>`;
      html += `<span class="similar-match-value">${esc(axisLabel(m.axis, (m.av + m.bv) / 2))}</span>`;
      html += `</div>`;
    });
    html += `</div>`;
    html += `</div>`;
    html += `<div class="similar-card-actions">`;
    html += `<button class="leaf-btn" data-import="${esc(n.id)}">Import ${inst.length}</button>`;
    html += `<button class="leaf-btn ghost" data-similar="${esc(n.id)}">From here</button>`;
    html += `</div>`;
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

// ---- INSTRUMENT SIMILAR VIEW (drill-down inside modal-add) ----
function renderSimilarInstrumentView(instId) {
  const inst = Inst(instId);
  if (!inst) return '<div>Instrument not found</div>';
  const neighbors = findSimilarInstruments(instId, 8);

  let html = `<button class="similar-back" data-similar-inst-back>← Back to instrument list</button>`;
  html += `<div class="similar-source">`;
  html += `<div class="similar-source-label">Finding instruments near</div>`;
  html += `<div class="similar-source-name">${esc(inst.name)}</div>`;
  html += `<div class="similar-source-lineage">${esc(FamName(inst.family))}</div>`;
  html += renderInstrumentFingerprint(instId);
  html += `</div>`;

  if (!neighbors.length) {
    html += `<div class="empty-msg">No comparable instruments — this one stands alone in the catalog.</div>`;
    return html;
  }

  html += `<div class="similar-grid">`;
  neighbors.forEach(n => {
    const matches = getMatchingInstrumentAxes(instId, n.id, 3);
    html += `<div class="similar-card">`;
    html += `<div>`;
    html += `<div class="similar-card-name">${esc(n.name)}</div>`;
    html += `<div class="similar-card-distance">distance ${n.distance.toFixed(2)} · ${esc(FamName(n.family))}</div>`;
    html += renderInstrumentFingerprint(n.id);
    html += `<div class="similar-card-matches">`;
    html += `<div class="label-micro-cap">Closest on</div>`;
    matches.forEach(m => {
      html += `<div class="similar-card-matches-row">`;
      html += `<span class="similar-match-axis">${esc(m.axis.name)}</span>`;
      html += `<span class="similar-match-value">${esc(axisLabel(m.axis, (m.av + m.bv) / 2))}</span>`;
      html += `</div>`;
    });
    html += `</div>`;
    html += `</div>`;
    html += `<div class="similar-card-actions">`;
    html += `<button class="leaf-btn" data-add-inst="${esc(n.id)}">Add to canvas</button>`;
    html += `<button class="leaf-btn ghost" data-similar-inst="${esc(n.id)}">From here</button>`;
    html += `</div>`;
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

function wireSimilarInstrumentEvents(container) {
  const backBtn = container.querySelector('[data-similar-inst-back]');
  if (backBtn) backBtn.addEventListener('click', () => {
    app.similarInstFor = null;
    renderInstPicker();
  });
  container.querySelectorAll('[data-add-inst]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const iid = el.dataset.addInst;
      const card = addCard(iid);
      if (!card) { showToast(`Unknown instrument: ${iid}`, 'error'); return; }
      closeModal('modal-add');
      app.similarInstFor = null;
      renderAll();
      showToast(`Added ${Inst(iid)?.short || iid}`, 'success');
      setTimeout(() => {
        const elc = document.querySelector(`[data-card-id="${card.id}"]`);
        if (elc) elc.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    });
  });
  container.querySelectorAll('[data-similar-inst]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      app.similarInstFor = el.dataset.similarInst;
      renderInstPicker();
      const body = document.querySelector('#modal-add .modal-body');
      if (body) body.scrollTop = 0;
    });
  });
}

// ---- EVENTS ----
function wireTreeEvents(container) {
  container.querySelectorAll('[data-toggle-tree]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.toggleTree;
      if (app.treeExpanded.has(id)) app.treeExpanded.delete(id);
      else app.treeExpanded.add(id);
      renderTradPicker();
    });
  });
  container.querySelectorAll('[data-import]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      importTraditionWithFeedback(el.dataset.import, { closeModalId: 'modal-trad' });
    });
  });
  container.querySelectorAll('[data-similar]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      app.similarFor = el.dataset.similar;
      renderTradPicker();
      const body = document.querySelector('#modal-trad .modal-body');
      if (body) body.scrollTop = 0;
    });
  });
}

function wireSimilarEvents(container) {
  const backBtn = container.querySelector('[data-similar-back]');
  if (backBtn) backBtn.addEventListener('click', () => {
    app.similarFor = null;
    renderTradPicker();
  });
  // Reuse the standard import + similar handlers
  wireTreeEvents(container);
}


