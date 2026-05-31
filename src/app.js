

// ============================================================
// CODEX v4 — applied perceptual psychology, not theme park
// Cards in two states: signature (small multiple) and composer (focal)
// ============================================================

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

// ---- Lookups ----
// O(1) ID indexes built once at boot from the catalog arrays. Every render
// path used to call `.find()` linear scans on these arrays — at 40+ cards
// the cumulative cost of scanning 505 traditions × 372 instruments × N
// chain items × variants dominated the per-render budget (the heaviest
// single hot path, `findTraditionsByVector`, alone cost ~1M ops/render).
// Maps push every lookup to constant time without changing call sites.
const _INST_BY_ID = new Map();
const _TRAD_BY_ID = new Map();
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
  if (typeof TRADITIONS !== 'undefined') for (const t of TRADITIONS) _TRAD_BY_ID.set(t.id, t);
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

const _traditionSignatureFor = (tradId) => (tradId && TRADITION_SIGNATURES[tradId]) || [];


const Tradition = (id) => _TRAD_BY_ID.get(id);
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
  sidebarFilter: ''
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
    stackPanel: null
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
// card read out of storage; dupCard zeroes them on the copy. Single
// source of truth so a new transient field added later picks up the
// reset semantics at all four sites by being added here once.
const _CARD_TRANSIENTS = { drift: null, stackPanel: null, editingPart: null, editingEnv: null, editingChainStage: null };

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
  const trad = Tradition(tradId);
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
    { name: 'Lucide',  scope: 'UI icons (97 in the codex)', license: 'ISC',     url: 'https://lucide.dev/' },
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
// instrument families across 326 instruments; no UI icon library (Lucide,
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
function inverseConfigureForPreface(card, targetId) {
  if (!card || !targetId) return null;
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
    axes.push({
      kind: 'part',
      id: part.id,
      label: part.name || part.id,
      options: variants.map(function (v) {
        return { id: v.id, label: v.name || v.id, contrib: new Set(v.descriptors || []) };
      }),
      current: (card.parts || {})[part.id],
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
  const ceiling = (options && options.ceiling) || 1000;
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
async function saveWS(name) {
  if (!window.storage) { showToast('Save failed', 'error'); return; }
  try {
    const list = await listSaved();
    const key = 'codex:ws:' + newId('ws');
    const data = { key, name, saved_at: new Date().toISOString(), cards: app.cards.map(c => ({ ...c, ..._CARD_TRANSIENTS })) };
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
    app.cards = (d.cards || []).map(c => {
      const card = { ...c, chain: c.chain || emptyChain(), ..._CARD_TRANSIENTS };
      if (card.prefaceAuto === undefined) card.prefaceAuto = !card.preface;
      return card;
    });
    closeModal('modal-saved');
    renderAll();
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
    const list = await listSaved();
    await window.storage.set('codex:list', JSON.stringify(list.filter(w => w.key !== key)));
    renderSaved();
    showToast('Deleted', 'success');
  } catch { showToast('Delete failed', 'error'); }
}

// ---- Modals ----
function openModal(id) {
  document.getElementById(id).classList.add('open');
  setTimeout(() => {
    const i = document.querySelector('#' + id + ' input[type=search], #' + id + ' input[type=text]');
    if (i) i.focus();
  }, UI_TIMING_MS.MODAL_FOCUS_DELAY);
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

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
    const close = (result) => {
      bg.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
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

function renderAll() {
  renderEmpty();
  renderMeta();
  // Coordinate prefaces across the visible stack before painting. Each
  // card's auto-suggested top-1 is reconciled against all other cards so
  // no two cards share the same preface; collisions resolved by score.
  _applyRecipeDedup();
  renderSidebar();
  renderDetail();
}

function renderEmpty() {
  const e = document.getElementById('empty-state');
  e.style.display = app.cards.length === 0 ? 'block' : 'none';
  if (app.cards.length === 0) {
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
          '<span class="sb-tradition-name">' + esc(name) + '</span>' +
          (tradId !== '__ungrouped__' ? '<span class="sb-status-pill ' + (isPrimary ? 'primary' : 'secondary') + '">' + (isPrimary ? 'PRIMARY' : 'SECONDARY') + '</span>' : '') +
          '<span class="sb-tradition-count">' + cards.length + '</span>' +
          moverButtons +
          (tradId !== '__ungrouped__'
            ? '<button class="sb-tradition-delete" data-delete-tradition="' + esc(tradId) + '" data-tooltip="Remove tradition from workspace" data-tooltip-pos="left" aria-label="Remove ' + esc(name) + ' group">' + icon('trash-2', 11) + '</button>'
            : '') +
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
    if (typeof pushHistory === 'function') pushHistory();
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
        if (typeof pushHistory === 'function') pushHistory();
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
        renderAll();
        return;
      }

      // Card drop: reparent the dragged card to this tradition group
      if (app._dragCardId) {
        const dragCard = app.cards.find(c => c.id === app._dragCardId);
        if (dragCard && dragCard.traditionId !== targetId) {
          if (typeof pushHistory === 'function') pushHistory();
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
          renderAll();
        }
      }
    });
  });

  // Wire tradition-delete buttons — bulk-remove all cards with that traditionId
  // in one undoable action. Uses skipHistory: true per rmCard to avoid one
  // history entry per card; pushHistory() runs once before the batch.
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
      if (typeof pushHistory === 'function') pushHistory();
      for (const c of cards) rmCard(c.id, { skipHistory: true });
      showToast(`Removed ${tradName} (${cards.length} card${cards.length === 1 ? '' : 's'})`, 'success');
    });
  });

  // Wire card selection
  host.querySelectorAll('.sb-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const cardId = btn.dataset.cardId;
      app.selected = cardId;
      renderSidebarTraditions();
      renderDetail();
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
  if (add) add.addEventListener('click', () => {
    if (typeof importTradition === 'function') {
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
  if (app.cards.length === 0) { host.innerHTML = ''; return; }

  const CEILING = 1000;
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

  host.innerHTML =
    '<div class="rp-head">' +
      icon('diamond', 12) +
      '<span class="rp-label">Current recipe</span>' +
      '<span class="rp-count ' + band + '">' + len + ' / ' + CEILING + '</span>' +
      '<button class="icon-btn rp-copy" id="sb-recipe-copy" data-tooltip="Copy recipe" data-tooltip-pos="bottom" aria-label="Copy recipe">' + icon('copy', 12) + '</button>' +
    '</div>' +
    '<div class="rp-progress"><div class="rp-progress-fill ' + band + '" style="width: ' + pct + '%;"></div></div>' +
    (text
      ? '<div class="rp-text">' + esc(text) + '</div>'
      : '<div class="rp-empty">Nothing configured yet.</div>') +
    '<button class="rp-open" id="sb-open-full-stack">Open full stack ' + icon('arrow-right', 12) + '</button>';

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

  // Resolve selection — default to first card if nothing selected.
  let card = app.cards.find(c => c.id === app.selected);
  if (!card) { card = app.cards[0]; app.selected = card.id; }
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
  view.appendChild(renderDetailTabBar(card, inst));
  view.appendChild(renderDetailTabContent(card, inst));

  // Single delegated click handler — reuses the existing per-card action
  // handler that the original full-card UI used. Keeps every variant-picker /
  // tuning-picker / chain-toggle interaction working identically.
  view.addEventListener('click', e => handleCardClick(e, card));

  host.appendChild(view);
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
  const snapshot = JSON.stringify(app.cards);
  // Skip no-op pushes (mutation that left cards array structurally identical).
  if (app.history.length > 0 && app.history[app.history.length - 1] === snapshot) return;
  app.history.push(snapshot);
  if (app.history.length > HISTORY_MAX) app.history.shift();
  app.historyIndex = app.history.length - 1;
  updateHistoryButtons();
}
function undo() {
  if (app.historyIndex <= 0) return;
  app.historyIndex--;
  app.cards = JSON.parse(app.history[app.historyIndex]);
  renderAll();
  updateHistoryButtons();
}
function redo() {
  if (app.historyIndex >= app.history.length - 1) return;
  app.historyIndex++;
  app.cards = JSON.parse(app.history[app.historyIndex]);
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
    part.variants.forEach(v => {
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
      variants.appendChild(b);
    });
    row.appendChild(variants);
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
      opts.innerHTML = `<button class="chip-block ${!card.tuning ? 'selected' : ''}" data-set-tuning="">Not set</button>`;
      TUNINGS.forEach(t => {
        opts.innerHTML += `<button class="chip-block ${card.tuning === t.id ? 'selected' : ''}" data-set-tuning="${esc(t.id)}">${esc(t.name)}<span class="chip-block-sub">${esc(t.sub)}</span></button>`;
      });
    } else {
      opts.innerHTML = `<button class="chip-block ${!card.room ? 'selected' : ''}" data-set-room="">Not set</button>`;
      ROOM_CLUSTERS.forEach(cl => {
        const rooms = ROOMS.filter(r => r.cluster === cl.id);
        if (!rooms.length) return;
        opts.innerHTML += `<div class="env-options-cluster-head">${esc(cl.name)}</div>`;
        rooms.forEach(r => {
          opts.innerHTML += `<button class="chip-block ${card.room === r.id ? 'selected' : ''}" data-set-room="${esc(r.id)}">${esc(r.name)}<span class="chip-block-sub">${esc(entryRenderDescs(r).join(' · '))}</span></button>`;
        });
      });
    }
    row.appendChild(opts);
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
      value = ids.length === 0 ? '—' : (ids.length === 1 ? ChainItem(s.id, ids[0]).name : ids.length + ' selected');
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
        noneBtn.textContent = 'Not set';
        opts.appendChild(noneBtn);
      }
      stageDef.items.forEach(it => {
        const b = document.createElement('button');
        let isSelected;
        if (isMulti) {
          isSelected = (card.chain[stageDef.id] || []).includes(it.id);
        } else {
          isSelected = card.chain[stageDef.id] === it.id;
        }
        b.className = 'chip-block' + (isSelected ? ' selected' : '');
        b.dataset.setChain = stageDef.id;
        b.dataset.item = it.id;
        const descs = entryRenderDescs(it);
        b.innerHTML = `${esc(it.name)}${descs.length ? `<span class="chip-block-sub">${esc(descs.join(' · '))}</span>` : ''}`;
        opts.appendChild(b);
      });
      panel.appendChild(opts);
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

  // Shifts panel — if a previous commitPrefaceChange produced inverse
  // configuration shifts, this surfaces what changed and which target
  // tokens each shift contributed. Persists until next commit or until
  // the user dismisses it.
  renderShiftsPanel(card, sec);

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

// Browse modal: lexicon entries grouped by category, click applies to card.
function openPrefaceModal(card) {
  if (typeof PREFACE_LEXICON === 'undefined') return;
  const body = document.getElementById('preface-modal-body');
  if (!body) return;
  // Group by category (entries may have a `category` field; otherwise 'general').
  const groups = {};
  for (const e of PREFACE_LEXICON) {
    const cat = e.category || 'general';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(e);
  }
  const cats = Object.keys(groups).sort();
  body.innerHTML = cats.map(cat => {
    const items = groups[cat].map(e =>
      `<button class="chip preface-pick" data-pref-id="${esc(e.id)}" data-tooltip="${esc(e.note || '')}">${esc(e.id)}</button>`
    ).join('');
    return `<div class="preface-cat"><div class="preface-cat-title">${esc(cat)}</div><div class="preface-cat-items">${items}</div></div>`;
  }).join('');
  body.querySelectorAll('[data-pref-id]').forEach(b => {
    b.addEventListener('click', () => {
      const prefId = b.dataset.prefId;
      closeModal('modal-preface');
      // Route through commitPrefaceChange so inverseConfigureForPreface
      // fires and reshapes the card's parts/env toward the chosen target.
      commitPrefaceChange(card, prefId);
    });
  });
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
    rerenderCard(card);
    return;
  }
  if (t.dataset.toggleEnv != null) {
    card.editingEnv = card.editingEnv === t.dataset.toggleEnv ? null : t.dataset.toggleEnv;
    rerenderCard(card);
    return;
  }
  if (t.dataset.setPart) {
    card.parts[t.dataset.setPart] = t.dataset.variant;
    if (card.prefaceAuto) card.preface = suggestPrefaceForCard(card);
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
  // / orphan elements with each click. Tony's "the UI interactions are gone"
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
  const CEILING = 1000;
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

document.addEventListener('DOMContentLoaded', () => {
  // Hydrate all icon placeholders in the static HTML shell. Each
  // <span data-icon="name" data-size="N"></span> placeholder gets its
  // innerHTML populated with the canonical icon() SVG. This keeps the
  // icon library single-source-of-truth: only the ICONS map holds path
  // data, even for icons that appear in the pre-render HTML.
  document.querySelectorAll('[data-icon]').forEach(el => {
    const size = parseInt(el.dataset.size, 10) || 16;
    el.innerHTML = icon(el.dataset.icon, size);
  });
  populatePrefaceDatalist();
  // Escape closes any currently-open modal. Backdrop click closes are wired
  // elsewhere via data-close; this adds the keyboard parity for accessibility.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal-bg.open');
      if (open) open.classList.remove('open');
    }
  });
  document.getElementById('btn-add').addEventListener('click', () => {
    app.pickerSearch = '';
    app.similarInstFor = null;
    document.getElementById('search-inst').value = '';
    renderInstPicker();
    openModal('modal-add');
  });
  document.getElementById('empty-add').addEventListener('click', () => document.getElementById('btn-add').click());
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
});

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
  return TRADITION_EXTRAS[tradId]?.parent || null;
}
function getChildren(nodeId) {
  const internal = TREE_NODES.filter(n => n.parent === nodeId);
  const leaves = TRADITIONS.filter(t => tradParent(t.id) === nodeId);
  return [...internal, ...leaves];
}
function getCrossRefLeaves(nodeId) {
  return TRADITIONS.filter(t => {
    const ext = TRADITION_EXTRAS[t.id];
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
function tradAxes(id) { return TRADITION_EXTRAS[id]?.axes || null; }

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
  return TRADITIONS
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
// findTraditionsByVector iterating all 505 traditions on every render, this
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
  TRADITIONS.forEach(t => {
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

  let html = '';
  INSTRUMENT_FAMILIES.forEach(fam => {
    const list = INSTRUMENTS.filter(i => i.family === fam.id && matchesQuery(i) && matchesFilters(i));
    if (!list.length) return;
    html += `<div class="fam-block"><div class="fam-name">${esc(fam.name)}</div>`;

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
  c.innerHTML = filterBar + body;

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
    const matches = TRADITIONS.filter(t => {
      const ext = TRADITION_EXTRAS[t.id] || {};
      return normalizeSearch(t.name).includes(q)
        || normalizeSearch(t.lineage || '').includes(q)
        || normalizeSearch(ext.description || '').includes(q);
    });
    if (!matches.length) {
      c.innerHTML = `<div class="empty-msg">No traditions match &ldquo;${esc(q)}&rdquo;</div>`;
      return;
    }
    let html = `<div class="tree-search-hits">`;
    html += `<div style="font-size: var(--fs-micro); color: var(--text-3); margin-bottom: var(--s3); text-transform: uppercase; letter-spacing: 0.06em; font-weight: var(--fw-semibold);">${matches.length} match${matches.length === 1 ? '' : 'es'}</div>`;
    matches.forEach(t => {
      const path = getAncestorPath(t.id);
      const ext = TRADITION_EXTRAS[t.id] || {};
      const inst = (t.instruments || []).map(id => Inst(id)?.short || Inst(id)?.name).filter(Boolean);
      html += `<div class="tree-search-result">`;
      html += `<div>`;
      if (path.length) html += `<div class="tree-search-path">${esc(path.join(' / '))}</div>`;
      html += `<div class="trad-leaf-name">${esc(t.name)}</div>`;
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
  html += `<div class="tree-row-name">${esc(node.name)}</div>`;
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
  const ext = TRADITION_EXTRAS[tradition.id] || {};
  const inst = (tradition.instruments || []).map(id => Inst(id)?.short || Inst(id)?.name).filter(Boolean);
  const indent = depth * 16;
  const cls = isCrossRef ? 'trad-leaf crossref' : 'trad-leaf';
  let html = `<div class="${cls}" style="margin-left: ${indent + 12}px;">`;
  html += `<div></div>`;
  html += `<div class="trad-leaf-info">`;
  html += `<div class="trad-leaf-name">`;
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
  const ext = TRADITION_EXTRAS[tradId] || {};
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
    const nExt = TRADITION_EXTRAS[n.id] || {};
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
      const tid = el.dataset.import;
      const trad = Tradition(tid);
      if (!trad) { showToast('Tradition not found', 'error'); return; }
      const created = importTradition(tid);
      closeModal('modal-trad');
      app.similarFor = null;
      renderAll();
      if (created.length === 0) {
        showToast(`"${trad.name}" has no recognised instruments`, 'error');
        return;
      }
      const expected = (trad.instruments || []).length;
      if (created.length < expected) {
        showToast(`Imported ${created.length}/${expected} instruments from "${trad.name}"`, 'success');
      } else {
        showToast(`Imported ${trad.name}`, 'success');
      }
      setTimeout(() => {
        const elc = document.querySelector(`[data-card-id="${created[0].id}"]`);
        if (elc) elc.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
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


