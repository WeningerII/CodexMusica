// references/07_preface_lexicon.js

const PREFACE_LEXICON = [
  {
    id: 'sobbing',
    tokens: ['choir-blendable', 'thick', 'grounded', 'breath-heavy', 'rapid-tremolo', 'covered', 'speech-derived', 'intimate-aspirated', 'vibrato-y']
  },
  {
    id: 'keening',
    tokens: ['characteristic-cry', 'lament-wail', 'sustained-high-register', 'melismatic', 'glissando-heavy', 'mournful', 'projecting', 'hyped-mids', 'moving-coil']
  },
  {
    id: 'wailing',
    note: "blues lament voice — vocal cry-and-bend register, gospel-rooted but secular-mourning",
    tokens: ['lament-wail', 'blues-shouter', 'blues-derived', 'blues-inflected', 'bluesy', 'mournful', 'melismatic', 'glissando-heavy', 'gospel-rooted']
  },
  {
    id: 'groaning',
    note: "low-register vocal anguish or deep sub-rumble — register-break threshold sounds with throat strain",
    tokens: ['low-register', 'rough', 'rough-tone', 'throat-singing', 'low-mid-rich-spectrum', 'low-mid-thick', 'chest-resonance-low-mid', 'dark', 'growly']
  },
  {
    id: 'moaning',
    tokens: ['blues-shouter', 'slide', 'glissando-heavy', 'bluesy', 'blues-derived', 'blues-inflected', 'mournful', 'gospel-rooted', 'intimate-aspirated']
  },
  {
    id: 'howling',
    tokens: ['choir-blendable', 'thick', 'grounded', 'high-falsetto', 'characteristic-cry', 'blues-shouter', 'vibrato-rich', 'speech-derived', 'chest-resonance-low-mid']
  },
  {
    id: 'shrieking',
    note: "black-metal-style high-register shriek — folk-shrill at peak intensity, glassy and cutting",
    tokens: ['folk-shrill', 'metal-context', 'metallic', 'sustained-high-register', 'transient-grab-aggressive', 'high-gain-cascading-saturation', 'sharp', 'glassy', 'cutting']
  },
  {
    id: 'brooding',
    tokens: ['low-mid-thick', 'late-Romantic-onward', 'haunted-romantic', 'sub-bass-foundational', 'dark-romantic', 'mournful', 'dark', 'low-end-heavy', 'sustained-tone']
  },
  {
    id: 'pleading',
    tokens: ['choir-blendable', 'thick', 'grounded', 'blues-shouter', 'gospel-runs', 'melismatic', 'ornamental-melismatic', 'speech-derived', 'gospel-rooted']
  },
  {
    id: 'conspiring',
    tokens: ['whispered', 'breathy-low', 'close-harmony', 'speech-mimicry', 'intimate-aspirated', 'close', 'rhythmic-speech', 'speech-mimicking', 'choir-blendable']
  },
  {
    id: 'sermonizing',
    note: "preacher-cadence vocal — rhythmic gospel oratory, declamatory speech-mimicking with chest-anchored projection",
    tokens: ['rhythmic-speech', 'speech-mimicking', 'speech-mimicry', 'declaimed', 'gospel-rooted', 'sacred-traditional', 'blues-inflected', 'projecting', 'congregation-loud']
  },
  {
    id: 'purring',
    tokens: ['soft-onset', 'warmed', 'intimate-aspirated', 'smoothed', 'breathy-low', 'chest-resonance-low-mid', 'plush', 'warm-glowing', 'cozy']
  },
  {
    id: 'bellowing',
    tokens: ['characteristic-cry', 'blues-shouter', 'congregation-loud', 'projecting', 'low-fundamental-tuning', 'low-end-heavy', 'glissando-heavy', 'slide', 'balanced']
  },
  {
    id: 'babbling',
    tokens: ['fast-tremolo', 'speech-mimicry', 'speech-mimicking', 'rapid-tremolo', 'speech-like', 'tremolo', 'rhythmic-speech', 'articulated', 'dry']
  },
  {
    id: 'crooning',
    tokens: ['choir-blendable', 'thick', 'grounded', 'classical-jazz', 'jazz-trained', 'jazz-influenced', 'speech-derived', 'blanket-damped', 'vibrato-rich']
  },
  {
    id: 'raging',
    tokens: ['high-gain-cascading-saturation', 'distorted', 'transient-grab-aggressive', 'percussive', 'growly', 'high-gain-saturation', 'articulate', 'balanced', 'fast-attack-transient']
  },
  {
    id: 'swooning',
    tokens: ['late-Romantic-onward', 'haunted-romantic', 'recital', 'romantic-orchestra', 'romantic', 'dark-romantic', 'singing', 'sustained-high-register', 'vibrato-rich']
  },
  {
    id: 'choking',
    tokens: ['choir-blendable', 'thick', 'grounded', 'rough', 'breath-heavy', 'transient-grab-aggressive', 'covered', 'speech-derived', 'blues-shouter']
  },
  {
    id: 'coughing',
    tokens: ['rough', 'breath-heavy', 'breathy-low', 'gritty', 'folkloric', 'folk-tradition', 'dark-romantic', 'lament-leaning', 'iberian-celtic']
  },
  {
    id: 'caressing',
    tokens: ['soft-onset', 'intimate-aspirated', 'vibrato-rich', 'breathy-low', 'plush', 'warm-glowing', 'speech-derived', 'ringing', 'expressive']
  },
  {
    id: 'clutching',
    tokens: ['vibrato-rich', 'vibrato-y', 'sustained-projection', 'sustained-tone', 'close', 'intimate-aspirated', 'full', 'asymmetric-saturation', 'balanced']
  },
  {
    id: 'embracing',
    tokens: ['warm-glowing', 'plush', 'thick', 'warmed', 'soft', 'intimate-aspirated', 'low-overtone-rich', 'cozy', 'smoothed']
  },
  {
    id: 'cradling',
    tokens: ['plush', 'warm-glowing', 'soft', 'intimate-aspirated', 'warmed', 'soft-onset', 'smoothed', 'breathy-low', 'mellow']
  },
  {
    id: 'rocking',
    tokens: ['rock-context', 'backbeat', 'folk-rock', 'distorted', 'articulate', 'balanced', 'hyped-mids', 'boomy', 'slappy']
  },
  {
    id: 'staggering',
    tokens: ['choir-blendable', 'thick', 'grounded', 'slide', 'speech-mimicking', 'rhythmic-speech', 'covered', 'ringing', 'speech-derived']
  },
  {
    id: 'trudging',
    tokens: ['low-end-heavy', 'sub-bass-foundational', 'marching-bateria', 'dark', 'sticks', 'low-fundamental-tuning', 'articulate', 'backbeat', 'balanced']
  },
  {
    id: 'marching',
    tokens: ['military-tight', 'drilled', 'marching', 'marching-bateria', 'tight-rhythmic-articulation', 'tight-low-end', 'foundational', 'controlled', 'acoustic-only']
  },
  {
    id: 'strutting',
    tokens: ['swung', 'funky', 'funk-derived', 'asymmetric-saturation', 'solid-state', 'transformer-coupled-input', 'backbeat', 'full-bodied', 'british']
  },
  {
    id: 'prancing',
    tokens: ['snappy', 'fast-attack-transient', 'dance-driving', 'articulate', 'balanced', 'walking', 'hyped-mids', 'moving-coil', 'mid-rich']
  },
  {
    id: 'thrashing',
    tokens: ['transient-grab-aggressive', 'growly', 'high-gain-cascading-saturation', 'sub-bass', 'metallic', 'fast-attack-transient', 'mid-rich', 'midrange', 'articulate']
  },
  {
    id: 'huffing',
    tokens: ['breath-heavy', 'breathy-low', 'fast-tremolo', 'rapid-tremolo', 'vibrato-y', 'soft-onset', 'intimate-aspirated', 'rhythmic-speech', 'speech-mimicking']
  },
  {
    id: 'screaming',
    note: "hardcore/death-metal harsh vocal — saturated mid-range aggression with growly under-edge",
    tokens: ['metal-context', 'metallic', 'transient-grab-aggressive', 'high-gain-cascading-saturation', 'saturation-distortion-headroom', 'growly', 'hf-distortion-prone', 'asymmetric-saturation', 'shouted']
  },
  {
    id: 'mourning',
    tokens: ['lament-leaning', 'mournful', 'melismatic', 'lament-wail', 'glissando-heavy', 'ornamental-melismatic', 'ornament-heavy', 'balanced', 'full']
  },
  {
    id: 'lamenting',
    tokens: ['fado-lead', 'university-fado', 'iberian-celtic', 'celtic', 'lament-leaning', 'mournful', 'lament-wail', 'glissando-heavy', 'melismatic']
  },
  {
    id: 'boasting',
    note: "hip-hop bravado delivery — sub-bass anchor, swagger-cadence over warm trap-leaning production",
    tokens: ['rhythmic-speech', 'speech-mimicking', 'speech-mimicry', 'sub-bass', 'sub-bass-foundational', 'funk-derived', 'hip-hop-warm', 'projecting', 'low-fundamental-tuning']
  },
  {
    id: 'ruminating',
    tokens: ['meditative', 'meditative-tempo', 'contemplative', 'drone-foundation', 'drone-like', 'beat-free', 'sustained-tone', 'minimal', 'key-locked']
  },
  {
    id: 'seething',
    tokens: ['growly', 'sub-bass', 'high-gain-cascading-saturation', 'dark-romantic', 'transient-grab-aggressive', 'dark', 'low-mid-thick', 'sticks', 'articulate']
  },
  {
    id: 'erupting',
    tokens: ['shouted', 'high-gain-cascading-saturation', 'distorted', 'transient-grab-aggressive', 'rock-context', 'high-gain-saturation', 'metal-context', 'growly', 'fast-attack-transient']
  },
  {
    id: 'face-melting',
    tokens: ['high-gain-cascading-saturation', 'sub-bass', 'metal-context', 'metallic', 'transient-grab-aggressive', 'low-mid-thick', 'growly', 'high-gain-saturation', 'articulate']
  },
  {
    id: 'spine-rooting',
    tokens: ['sub-bass-foundational', 'high-gain-saturation', 'synthesized', 'asymmetric-saturation', 'transformer-coupled-input', 'low-fundamental-tuning', 'rock-context', 'solid-state', 'marching-bateria']
  },
  {
    id: 'bone-rattling',
    tokens: ['sub-heavy', 'foundational-sub', 'sub-bass-foundational', 'sub-fundamental-buzz', 'sub-driven', 'rapid-tremolo', 'low-fundamental-tuning', 'tremolo', 'sub-bass']
  },
  {
    id: 'heart-breaking',
    note: "the line that wounds — grief carried in tone, the listener undone before the song ends",
    tokens: ['lament-leaning', 'mournful', 'lament-wail', 'glissando-heavy', 'melismatic', 'ornamental-melismatic', 'fado-lead', 'iberian-celtic', 'celtic']
  },
  {
    id: 'scalp-prickling',
    tokens: ['rapid-tremolo', 'sustained-high-register', 'sustained-projection', 'vibrato-rich', 'haunted-romantic', 'baroque-leaning', 'asymmetric-saturation', 'balanced', 'classical']
  },
  {
    id: 'blood-curdling',
    tokens: ['folk-shrill', 'high-falsetto', 'sustained-high-register', 'cutting', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'metal-context', 'sub-bass', 'growly']
  },
  {
    id: 'eye-watering',
    tokens: ['high-falsetto', 'lament-wail', 'sustained-high-register', 'speech-derived', 'expressive', 'classical', 'mournful', 'vibrato-rich', 'chest-resonance-low-mid']
  },
  {
    id: 'knee-buckling',
    tokens: ['late-Romantic-onward', 'sub-bass-foundational', 'sustained', 'asymmetric-saturation', 'transformer-coupled-input', 'balanced', 'dark-romantic', 'haunted-romantic', 'romantic']
  },
  {
    id: 'marrow-deep',
    tokens: ['sub-bass-foundational', 'asymmetric-saturation', 'transformer-coupled-input', 'controlled', 'balanced', 'low-fundamental-tuning', 'articulate', 'dark', 'solid-state']
  },
  {
    id: 'nerve-jangling',
    tokens: ['high-frequency', 'sharp', 'cutting', 'glassy', 'metallic', 'high-gain-saturation', 'transient-grab-aggressive', 'sub-bass', 'hyped-mids']
  },
  {
    id: 'skull-splitting',
    tokens: ['transient-grab-aggressive', 'thunderous', 'high-gain-cascading-saturation', 'sub-driven', 'metal-context', 'metallic', 'high-gain-saturation', 'sub-bass', 'growly']
  },
  {
    id: 'pulse-quickening',
    tokens: ['strummed', 'rhythmic', 'dance-rhythm', 'treble-extended', 'articulate', 'dance-driving', 'rapid-tremolo', 'hyped-mids', 'dynamic']
  },
  {
    id: 'jaw-dropping',
    tokens: ['classical', 'sustained-projection', 'vibrato-rich', 'projecting', 'speech-derived', 'ornamental-melismatic', 'melismatic', 'ringing', 'chest-resonance-low-mid']
  },
  {
    id: 'spine-tingling',
    tokens: ['sustained-high-register', 'sustained-projection', 'vibrato-y', 'rapid-tremolo', 'vibrato-rich', 'haunted-romantic', 'asymmetric-saturation', 'balanced', 'baroque-leaning']
  },
  {
    id: 'tongue-tying',
    tokens: ['continuous-airflow', 'legato', 'lyrical', 'versatile', 'jazz-trained', 'jazz-influenced', 'virtuoso', 'treble-extended', 'alto']
  },
  {
    id: 'cheek-flushing',
    note: "warm romantic-flush vocal — close-miked tenderness, breath-forward and slightly destabilized",
    tokens: ['warmed', 'warm-glowing', 'intimate-aspirated', 'breath-heavy', 'soft-onset', 'breathy-low', 'smoothed', 'plush', 'vibrato-y']
  },
  {
    id: 'shoulders-tensing',
    tokens: ['growly', 'sub-bass-foundational', 'thumpy', 'dark-romantic', 'fast-attack-transient', 'transient-grab-aggressive', 'walking', 'articulate', 'balanced']
  },
  {
    id: 'hip-rocking',
    tokens: ['funky', 'funk-derived', 'backbeat', 'swung', 'snappy', 'treble-extended', 'breathing', 'full-bodied', 'strummed']
  },
  {
    id: 'toe-tapping',
    note: "the rhythm the foot answers before the listener decides to — mid-tempo groove pocket",
    tokens: ['beat-suited', 'swung', 'foundational', 'dance-driving', 'breaks-and-loops', 'chopped', 'clean', 'low-distortion-low-coloration', 'low-fundamental-tuning']
  },
  {
    id: 'spine-melting',
    tokens: ['jazz-trained', 'smoothed', 'jazz-influenced', 'warmed', 'dark-romantic', 'classical-jazz', 'intimate-aspirated', 'italian', 'mellow']
  },
  {
    id: 'ear-shattering',
    tokens: ['high-gain-cascading-saturation', 'metal-context', 'thunderous', 'folk-shrill', 'sustained-high-register', 'sub-bass', 'metallic', 'growly', 'hyped-mids']
  },
  {
    id: 'mind-numbing',
    tokens: ['drone-foundation', 'minimal', 'drone-like', 'sustained-tone', 'overtone-rich', 'naturally-reverberant', 'balanced', 'beat-free', 'full']
  },
  {
    id: 'muscle-loosening',
    tokens: ['round', 'swung', 'jazz-trained', 'jazz-influenced', 'classical-jazz', 'controlled', 'body-resonance-low-mid', 'drafty', 'breathing']
  },
  {
    id: 'eye-burning',
    tokens: ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'sub-bass', 'cutting', 'sub-driven', 'sub-bass-foundational']
  },
  {
    id: 'throat-burning',
    tokens: ['gospel-rooted', 'shouted', 'blues-shouter', 'gospel-runs', 'congregation-loud', 'high-gain-cascading-saturation', 'growly', 'transient-grab-aggressive', 'rasping']
  },
  {
    id: 'sepulchral',
    tokens: ['drone-foundation', 'reverberant', 'medieval', 'sacred-Latin', 'naturally-reverberant', 'low-mid-rich', 'sustained-tone', 'ceremonial', 'sustained-projection']
  },
  {
    id: 'oracular',
    tokens: ['choir-blendable', 'thick', 'grounded', 'melismatic', 'ornamental-melismatic', 'covered', 'speech-derived', 'sacred-traditional', 'chest-resonance-low-mid']
  },
  {
    id: 'eldritch',
    tokens: ['metal-context', 'metallic', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'growly', 'folk-shrill', 'sustained-high-register', 'high-falsetto', 'blues-shouter']
  },
  {
    id: 'liturgical',
    tokens: ['sacred-Latin', 'ceremonial', 'devotional', 'reverberant', 'medieval', 'singing-sustain', 'choir-blendable', 'sacred-traditional', 'liturgical']
  },
  {
    id: 'elegiac',
    tokens: ['late-Romantic-onward', 'lament-leaning', 'dark-romantic', 'legato', 'sustained', 'expressive', 'romantic', 'haunted-romantic', 'full']
  },
  {
    id: 'vatic',
    tokens: ['choir-blendable', 'thick', 'grounded', 'declaimed', 'court-ceremonial', 'ceremonial', 'covered', 'speech-derived', 'ornamental-melismatic']
  },
  {
    id: 'monastic',
    tokens: ['choir-blendable', 'sacred-Latin', 'medieval', 'sustained-high-register', 'ceremonial', 'sacred-traditional', 'devotional', 'liturgical', 'classical']
  },
  {
    id: 'apocalyptic',
    tokens: ['thunderous', 'sub-bass-foundational', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'distorted', 'metal-context', 'asymmetric-saturation', 'articulate', 'balanced']
  },
  {
    id: 'liminal',
    tokens: ['lush-ambient', 'ambient', 'layered-ambient', 'drone-foundation', 'sustained-tone', 'beat-free', 'naturally-reverberant', 'drone-like', 'key-locked']
  },
  {
    id: 'hymnic',
    tokens: ['choir-blendable', 'sustained-projection', 'ceremonial', 'medieval', 'sacred-Latin', 'liturgical', 'sacred-traditional', 'congregation-loud', 'singing-sustain']
  },
  {
    id: 'ecstatic',
    tokens: ['devotional', 'sufi', 'sustained-projection', 'sufi-mystical', 'melismatic', 'ornamental-melismatic', 'court-ceremonial', 'raga-bound', 'ceremonial']
  },
  {
    id: 'shamanic',
    tokens: ['sacred-traditional', 'devotional', 'drone-foundation', 'drone-like', 'Hindu-ritual', 'microtonal', 'contemplative', 'flexible', 'meditative-tempo']
  },
  {
    id: 'penitential',
    tokens: ['devotional', 'liturgical', 'medieval', 'congregation-loud', 'sacred-Latin', 'mournful', 'gospel-rooted', 'singing-sustain', 'ceremonial']
  },
  {
    id: 'messianic',
    tokens: ['ceremonial', 'congregation-loud', 'sacred-Latin', 'liturgical', 'sacred-traditional', 'devotional', 'court-ceremonial', 'gospel-rooted', 'cavernous']
  },
  {
    id: 'doxological',
    tokens: ['choir-blendable', 'congregation-loud', 'ceremonial', 'medieval', 'sacred-Latin', 'liturgical', 'sustained-projection', 'devotional', 'sacred-traditional']
  },
  {
    id: 'apollonian',
    tokens: ['baroque-soloistic', 'contemporary-classical', 'baroque-leaning', 'legato', 'sustained', 'full', 'balanced', 'Italian-baroque', 'classical']
  },
  {
    id: 'dervish',
    tokens: ['shruti-inflected', 'raga-bound', 'flexible', 'sustained-projection', 'sufi-mystical', 'ornamental-melismatic', 'devotional', 'melismatic', 'ceremonial']
  },
  {
    id: 'annunciatory',
    tokens: ['ceremonial', 'sacred-traditional', 'sacred-Latin', 'court-ceremonial', 'medieval', 'congregation-loud', 'liturgical', 'sustained-projection', 'devotional']
  },
  {
    id: 'sabbatical',
    tokens: ['classical', 'medieval', 'sacred-Latin', 'sacred-traditional', 'grounded', 'thick', 'choir-blendable', 'chest-resonance-low-mid', 'devotional']
  },
  {
    id: 'resurrectional',
    tokens: ['sacred-Latin', 'liturgical', 'choir-blendable', 'congregation-loud', 'medieval', 'sustained-projection', 'ceremonial', 'sacred-traditional', 'cavernous']
  },
  {
    id: 'tantric',
    tokens: ['raga-bound', 'devotional', 'shruti-inflected', 'sacred-traditional', 'Hindu-ritual', 'melismatic', 'ornamental-melismatic', 'dhrupad-suited', 'contemplative']
  },
  {
    id: 'theophanic',
    tokens: ['liturgical', 'sacred-Latin', 'court-ceremonial', 'sustained-high-register', 'congregation-loud', 'sustained-projection', 'sacred-traditional', 'devotional', 'ceremonial']
  },
  {
    id: 'paschal',
    tokens: ['devotional', 'sacred-traditional', 'medieval', 'congregation-loud', 'sacred-Latin', 'liturgical', 'gospel-runs', 'ceremonial', 'gospel-rooted']
  },
  {
    id: 'saudade',
    tokens: ['fado-lead', 'university-fado', 'singing-sustain', 'celtic', 'mournful', 'lament-leaning', 'iberian-celtic', 'body-resonance-low-mid', 'cozy']
  },
  {
    id: 'duende',
    tokens: ['lament-wail', 'ornamental-melismatic', 'iberian-celtic', 'melismatic', 'blues-shouter', 'raga-bound', 'cozy', 'glissando-heavy', 'mournful']
  },
  {
    id: 'tarab',
    tokens: ['ceremonial', 'classical-radif', 'Turkish-makam-base', 'sufi-mystical', 'Middle-Eastern', 'ornament-heavy', 'ornamental-melismatic', 'devotional', 'melismatic']
  },
  {
    id: 'sehnsucht',
    tokens: ['dark-romantic', 'German-traditional', 'late-Romantic-onward', 'haunted-romantic', 'romantic', 'sustained-projection', 'baroque-leaning', 'contemporary-classical', 'asymmetric-saturation']
  },
  {
    id: 'mono-no-aware',
    tokens: ['sustained-tone', 'pure', 'beat-free', 'classical', 'minimal', 'drone-foundation', 'naturally-reverberant', 'gagaku-foundational', 'key-locked']
  },
  {
    id: 'wabi-sabi',
    tokens: ['drone-foundation', 'sustained-tone', 'gagaku-foundational', 'pure', 'beat-free', 'minimal', 'naturally-reverberant', 'ceremonial', 'low-mid-rich']
  },
  {
    id: 'yugen',
    tokens: ['drone-foundation', 'sustained-tone', 'minimal', 'gagaku-foundational', 'pure', 'naturally-reverberant', 'straight', 'beat-free', 'Chinese-classical']
  },
  {
    id: 'hiraeth',
    tokens: ['celtic', 'iberian-celtic', 'Irish-traditional', 'Scottish-influenced', 'english-folk', 'lament-leaning', 'low-mid-rich', 'natural-absorption', 'choir-blendable']
  },
  {
    id: 'dor',
    tokens: ['european-folk', 'folkloric', 'folk-tradition', 'singing-sustain', 'lament-leaning', 'iberian-celtic', 'celtic', 'cozy', 'plush']
  },
  {
    id: 'dukkha',
    tokens: ['pure', 'beat-free', 'key-locked', 'meditative-tempo', 'sustained-tone', 'sacred-traditional', 'drone-foundation', 'contemplative', 'ceremonial']
  },
  {
    id: 'iki',
    tokens: ['smoothed', 'jazz-trained', 'jazz-influenced', 'classical-jazz', 'intimate-aspirated', 'body-resonance-low-mid', 'chamber-fed', 'compound-architecture', 'controlled']
  },
  {
    id: 'hozho',
    tokens: ['pure', 'beat-free', 'key-locked', 'ceremonial', 'sacred-traditional', 'drone-foundation', 'drone-like', 'sustained-tone', 'devotional']
  },
  {
    id: 'yaaburnee',
    tokens: ['melismatic', 'devotional', 'sufi-mystical', 'court-ceremonial', 'ornament-heavy', 'ornamental-melismatic', 'thick', 'sufi', 'ceremonial']
  },
  {
    id: 'meraki',
    tokens: ['urban-Greek', 'Turkish-makam-base', 'ornament-heavy', 'melismatic', 'ornamental-melismatic', 'expressive', 'virtuoso', 'iberian-celtic', 'controlled']
  },
  {
    id: 'spleen',
    tokens: ['dark-romantic', 'thick', 'french', 'french-trad', 'french-musette-ready', 'late-Romantic-onward', 'haunted-romantic', 'baroque-leaning', 'intimate-aspirated']
  },
  {
    id: 'razbliuto',
    tokens: ['late-Romantic-onward', 'intimate-aspirated', 'haunted-romantic', 'romantic', 'dark-romantic', 'baroque-leaning', 'contemporary-classical', 'rapid-tremolo', 'asymmetric-saturation']
  },
  {
    id: 'natsukashii',
    tokens: ['cassette', 'wow-and-flutter-noticeable', 'warm-glowing', 'warmed', 'vibrato-y', 'bandwidth-narrow', 'consumer-format', 'hf-distortion-prone', 'jazz-influenced']
  },
  {
    id: 'rasa',
    tokens: ['raga-bound', 'shruti-inflected', 'microtonal', 'ornamented', 'Hindu-ritual', 'dhrupad-suited', 'melismatic', 'ornamental-melismatic', 'drone-foundation']
  },
  {
    id: 'shanti',
    tokens: ['raga-bound', 'drone-foundation', 'drone-like', 'Hindu-ritual', 'dhrupad-suited', 'sacred-traditional', 'contemplative', 'devotional', 'flexible']
  },
  {
    id: 'upekkha',
    tokens: ['drone-foundation', 'drone-like', 'dhrupad-suited', 'raga-bound', 'shruti-inflected', 'Hindu-ritual', 'contemplative', 'devotional', 'flexible']
  },
  {
    id: 'han',
    note: "Korean concept of unresolved sorrow — pansori voice in its scarred, weathered register",
    tokens: ['seongeum-rough-pressed-chaotic-source', 'rough-tone', 'ornamental-melismatic', 'sustained-projection', 'speech-derived', 'drone-foundation', 'traditional', 'foundational', 'jinyangjo-slowest-18-8-extended-lament']
  },
  {
    id: 'jeong',
    tokens: ['thick', 'grounded', 'speech-derived', 'warm-glowing', 'intimate-aspirated', 'plush', 'covered', 'soft', 'chest-resonance-low-mid']
  },
  {
    id: 'yi',
    tokens: ['drone-foundation', 'minimal', 'sustained-tone', 'drone-like', 'naturally-reverberant', 'ornamental-melismatic', 'beat-free', 'key-locked', 'pure']
  },
  {
    id: 'wu-wei',
    tokens: ['beat-free', 'pure', 'key-locked', 'sustained-tone', 'minimal', 'drone-foundation', 'drone-like', 'naturally-reverberant', 'balanced']
  },
  {
    id: 'fingerspitzengefuhl',
    tokens: ['jazz-influenced', 'jazz-trained', 'articulated', 'classical-jazz', 'swung', 'round', 'flatpicked', 'drafty', 'thumpy']
  },
  {
    id: 'flaneur',
    tokens: ['french', 'french-trad', 'french-musette-ready', 'romantic', 'dark-romantic', 'soft-onset', 'late-Romantic-onward', 'intimate-aspirated', 'haunted-romantic']
  },
  {
    id: 'depaysement',
    tokens: ['reverberant', 'naturally-reverberant', 'sustained-tone', 'drone-foundation', 'ambient', 'lush-ambient', 'layered-ambient', 'drone-like', 'hollow']
  },
  {
    id: 'dolce-far-niente',
    tokens: ['smoothed', 'italian', 'warm-glowing', 'singing-sustain', 'warmed', 'intimate-aspirated', 'soft-onset', 'cozy', 'plush']
  },
  {
    id: 'struggimento',
    tokens: ['Italian-baroque', 'singing-sustain', 'haunted-romantic', 'dark-romantic', 'romantic', 'asymmetric-saturation', 'German-traditional', 'intimate-aspirated', 'late-Romantic-onward']
  },
  {
    id: 'nadryv',
    tokens: ['thick', 'grounded', 'speech-derived', 'haunted-romantic', 'vibrato-y', 'dark-romantic', 'covered', 'expressive', 'transient-grab-aggressive']
  },
  {
    id: 'maternal',
    tokens: ['cozy', 'soft', 'plush', 'warmed', 'close-harmony', 'intimate-aspirated', 'close', 'low-mid-thick', 'singing-sustain']
  },
  {
    id: 'processional',
    tokens: ['marching', 'court-ceremonial', 'ceremonial', 'sustained-projection', 'sacred-Latin', 'liturgical', 'foundational', 'devotional', 'sacred-traditional']
  },
  {
    id: 'intercessory',
    tokens: ['sacred-Latin', 'sacred-traditional', 'sufi-mystical', 'devotional', 'ornamental-melismatic', 'melismatic', 'sustained-projection', 'court-ceremonial', 'classical']
  },
  {
    id: 'devotional',
    tokens: ['devotional', 'sacred-Latin', 'Hindu-ritual', 'sufi-mystical', 'melismatic', 'sacred-traditional', 'ornamental-melismatic', 'choir-blendable', 'court-ceremonial']
  },
  {
    id: 'tender',
    tokens: ['soft-onset', 'warmed', 'warm-glowing', 'intimate-aspirated', 'soft', 'folk', 'plush', 'cozy', 'smoothed']
  },
  {
    id: 'covetous',
    tokens: ['choir-blendable', 'thick', 'grounded', 'breath-heavy', 'blues-shouter', 'blues-derived', 'blues-inflected', 'intimate-aspirated', 'chest-resonance-low-mid']
  },
  {
    id: 'avuncular',
    note: "warm-elder storyteller voice — folk narrative tradition, speech-derived delivery with weathered authority",
    tokens: ['folk', 'folk-tradition', 'narrative', 'speech-mimicking', 'rhythmic-speech', 'oral-history', 'folkloric', 'european-folk', 'close-harmony']
  },
  {
    id: 'accusatory',
    tokens: ['rhythmic-speech', 'speech-mimicking', 'grounded', 'speech-derived', 'declaimed', 'blues-shouter', 'transient-grab-aggressive', 'articulated', 'chest-resonance-low-mid']
  },
  {
    id: 'inviting',
    tokens: ['intimate-aspirated', 'warm-glowing', 'soft-onset', 'plush', 'singing-sustain', 'close-harmony', 'smoothed', 'close', 'modern']
  },
  {
    id: 'seductive',
    tokens: ['breathy-low', 'intimate-aspirated', 'jazz-influenced', 'smoothed', 'vibrato-y', 'soft-onset', 'close', 'classical-jazz', 'soft']
  },
  {
    id: 'taunting',
    tokens: ['rhythmic-speech', 'speech-mimicking', 'declaimed', 'articulated', 'speech-like', 'speech-derived', 'grounded', 'solid-state', 'rapid-tremolo']
  },
  {
    id: 'evangelizing',
    tokens: ['blues-shouter', 'gospel-runs', 'gospel-rooted', 'chest-resonance-low-mid', 'speech-derived', 'expressive', 'classical', 'congregation-loud', 'choir-blendable']
  },
  {
    id: 'apologizing',
    note: "confessional indie-folk voice — close-miked, breath-forward, small-room intimacy",
    tokens: ['intimate-aspirated', 'soft-onset', 'breathy-low', 'breath-heavy', 'rhythmic-speech', 'speech-mimicking', 'folk', 'folk-tradition', 'close-harmony']
  },
  {
    id: 'forgiving',
    note: "gospel-rooted vocal of consolation — choir-blended warmth and chest-anchored release",
    tokens: ['gospel-rooted', 'sacred-traditional', 'devotional', 'choir-blendable', 'low-mid-rich-spectrum', 'sustained-projection', 'chest-resonance-low-mid', 'foundational', 'melismatic']
  },
  {
    id: 'comforting',
    tokens: ['cozy', 'soft', 'plush', 'warmed', 'jazz-trained', 'smoothed', 'close-harmony', 'intimate-aspirated', 'gentle']
  },
  {
    id: 'cajoling',
    tokens: ['choir-blendable', 'thick', 'grounded', 'warmed', 'warm-glowing', 'intimate-aspirated', 'jazz-influenced', 'speech-derived', 'smoothed']
  },
  {
    id: 'challenging',
    tokens: ['shouted', 'blues-shouter', 'transient-grab-aggressive', 'high-gain-cascading-saturation', 'projecting', 'growly', 'hyped-mids', 'moving-coil', 'plosive-resistant']
  },
  {
    id: 'petitioning',
    tokens: ['sacred-Latin', 'sacred-traditional', 'sustained-projection', 'sufi-mystical', 'gospel-rooted', 'melismatic', 'devotional', 'ornamental-melismatic', 'singing-sustain']
  },
  {
    id: 'reminiscing',
    tokens: ['archival', 'pre-war', 'shellac', 'surface-noise-bedded', 'horn-mechanical-pickup', 'disc', 'no-bass-extension', 'strummed', 'bandwidth-narrow']
  },
  {
    id: 'thrumming',
    tokens: ['sub-bass-foundational', 'sub-driven', 'low-fundamental-tuning', 'low-end-heavy', 'low-mid-thick', 'metal-context', 'sub-bass', 'foundational-sub', 'sub-heavy']
  },
  {
    id: 'clangoring',
    tokens: ['sharp', 'glassy', 'metallic', 'articulate', 'balanced', 'fast-attack-transient', 'transient-grab-aggressive', 'high-gain-saturation', 'hyped-mids']
  },
  {
    id: 'thundering',
    tokens: ['sub-driven', 'foundational-sub', 'low-fundamental-tuning', 'sub-bass-foundational', 'sustained-tone', 'sub-heavy', 'deep-bass', 'dark-romantic', 'German-traditional']
  },
  {
    id: 'shuddering',
    tokens: ['sub-fundamental-buzz', 'rapid-tremolo', 'balanced', 'hyped-mids', 'top-rolled-off-12k', 'low-fundamental-tuning', 'transient-grab-aggressive', 'articulate', 'moving-coil']
  },
  {
    id: 'rustling',
    tokens: ['surface-noise-bedded', 'wow-and-flutter-noticeable', 'cassette', 'consumer-format', 'quiet', 'hyped-mids', 'top-rolled-off-12k', 'asymmetric-saturation', 'bandwidth-narrow']
  },
  {
    id: 'sputtering',
    tokens: ['sharp', 'tremolo', 'fast-tremolo', 'articulated', 'rapid-tremolo', 'fast-attack-transient', 'transient-grab-aggressive', 'asymmetric-saturation', 'solid-state']
  },
  {
    id: 'screeching',
    tokens: ['transient-grab-aggressive', 'folk-shrill', 'sustained-high-register', 'high-gain-cascading-saturation', 'high-falsetto', 'cutting', 'metal-context', 'metallic', 'growly']
  },
  {
    id: 'buzzing',
    tokens: ['drone-like', 'metal-context', 'sub-driven', 'clean', 'strummed', 'sub-fundamental-buzz', 'rapid-tremolo', 'high-gain-cascading-saturation', 'low-fundamental-tuning']
  },
  {
    id: 'rasping',
    tokens: ['rough', 'breath-heavy', 'breathy-low', 'blues-shouter', 'blues-derived', 'bluesy', 'slide', 'glissando-heavy', 'lament-leaning']
  },
  {
    id: 'whooshing',
    tokens: ['pad', 'analog-drift-character', 'layered-ambient', 'lush-ambient', 'ambient', 'drone-foundation', 'sustained-tone', 'beat-free', 'key-locked']
  },
  {
    id: 'skittering',
    tokens: ['articulated', 'rapid-tremolo', 'fast-attack-transient', 'balanced', 'hyped-mids', 'top-rolled-off-12k', 'dance-driving', 'moving-coil', 'plosive-resistant']
  },
  {
    id: 'throbbing',
    tokens: ['sub-bass-foundational', 'sub-driven', 'foundational-sub', 'sub-bass', 'rhythmic', 'low-fundamental-tuning', 'hyped-mids', 'moving-coil', 'low-end-heavy']
  },
  {
    id: 'hissing',
    tokens: ['minimal', 'naturally-reverberant', 'drone-foundation', 'gagaku-foundational', 'sustained-tone', 'balanced', 'beat-free', 'Chinese-classical', 'full']
  },
  {
    id: 'fizzing',
    tokens: ['rapid-tremolo', 'tremolo', 'fast-tremolo', 'high-frequency', 'sharp', 'articulated', 'glassy', 'full-bodied', 'airless']
  },
  {
    id: 'whirring',
    tokens: ['analog-drift-character', 'sub-bass', 'crisp', 'metallic', 'distinctive', 'articulated', 'rapid-tremolo', 'tremolo', 'fast-tremolo']
  },
  {
    id: 'gurgling',
    tokens: ['glassy', 'fast-tremolo', 'tremolo', 'rapid-tremolo', 'articulated', 'low-mid-thick', 'rhythmic-speech', 'speech-like', 'asymmetric-saturation']
  },
  {
    id: 'booming',
    tokens: ['sub-bass-foundational', 'foundational-sub', 'sub-heavy', 'deep-bass', 'sub-driven', 'low-fundamental-tuning', 'sustained-tone', 'dark-romantic', 'German-traditional']
  },
  {
    id: 'loping',
    tokens: ['backbeat', 'walking', 'twangy', 'woody', 'articulate', 'balanced', 'folk', 'folkloric', 'controlled']
  },
  {
    id: 'swaying',
    tokens: ['vibrato-y', 'samba-foundation', 'dance-rhythm', 'samba-batería', 'dance-driving', 'controlled', 'hyped-mids', 'lively', 'moving-coil']
  },
  {
    id: 'scatting',
    tokens: ['choir-blendable', 'thick', 'grounded', 'overtone-rich-sustained', 'classical-jazz', 'jazz-trained', 'jazz-influenced', 'blanket-damped', 'jazz-friendly']
  },
  {
    id: 'shoulder-bouncing',
    tokens: ['African-derived', 'pan-African', 'African-traditional', 'hyped-mids', 'dance-rhythm', 'African-craft', 'controlled', 'lively', 'moving-coil']
  },
  {
    id: 'two-stepping',
    tokens: ['dance-rhythm', 'asymmetric-saturation', 'transformer-coupled-input', 'balanced', 'solid-state', 'articulate', 'hyped-mids', 'moving-coil', 'dynamic']
  },
  {
    id: 'skanking',
    tokens: ['rapid-tremolo', 'beat-suited', 'breaks-and-loops', 'low-distortion-low-coloration', 'chopped', 'sampled', 'clean', 'foundational', 'crisp']
  },
  {
    id: 'squelching',
    tokens: ['beat-suited', 'dance-driving', 'low-distortion-low-coloration', 'chopped', 'sampled', 'synthetic', 'breaks-and-loops', 'clean', 'digital']
  },
  {
    id: 'ishq',
    tokens: ['melismatic', 'ceremonial', 'devotional', 'shruti-inflected', 'sufi-mystical', 'raga-bound', 'sacred-traditional', 'ornamental-melismatic', 'sufi']
  },
  {
    id: 'fana',
    tokens: ['shruti-inflected', 'raga-bound', 'flexible', 'ecstatic', 'sustained-projection', 'sufi-mystical', 'ornamental-melismatic', 'sufi', 'melismatic']
  },
  {
    id: 'ngoma',
    tokens: ['ceremonial', 'African-traditional', 'African-derived', 'African-craft', 'pan-African', 'dance-rhythm', 'lively', 'controlled', 'hyped-mids']
  },
  {
    id: 'jouvert',
    tokens: ['Trinidadian-traditional', 'walking-bass', 'dance-driving', 'swung', 'funky', 'controlled', 'hyped-mids', 'lively', 'dub-friendly']
  },
  {
    id: 'bhava',
    tokens: ['raga-suited', 'raga-bound', 'ornamental-melismatic', 'shruti-inflected', 'expressive', 'Hindu-ritual', 'dhrupad-suited', 'flexible', 'melismatic']
  },
  {
    id: 'sukha',
    tokens: ['meditative', 'beat-free', 'pure', 'sacred-traditional', 'drone-foundation', 'ambient', 'lush-ambient', 'layered-ambient', 'key-locked']
  },
  {
    id: 'ganas',
    tokens: ['raga-bound', 'shruti-inflected', 'percussive', 'dhrupad-suited', 'contemplative', 'devotional', 'drone-foundation', 'drone-like', 'flexible']
  },
  {
    id: 'batucada',
    tokens: ['samba-batería', 'samba-foundational', 'samba-foundation', 'percussive-attack', 'dance-rhythm', 'swung', 'dance-driving', 'hyped-mids', 'controlled']
  },
  {
    id: 'swinging',
    tokens: ['swung', 'jazz-influenced', 'jazz-trained', 'dance-rhythm', 'classical-jazz', 'woody', 'bias-bump-low-mid', 'thumb-driven', 'even-harmonic-rich']
  },
  {
    id: 'lurking',
    tokens: ['foundational-sub', 'sub-bass-foundational', 'sub-driven', 'sub-bass', 'speech-mimicking', 'rhythmic-speech', 'dark', 'modern', 'digital']
  },
  {
    id: 'gleaming',
    tokens: ['pad', 'analog-drift-character', 'synthesized', 'synthetic', 'smoothed', 'warm-glowing', 'vibrato-y', 'layered-ambient', 'sustained']
  },
  {
    id: 'shuffling',
    tokens: ['backbeat', 'swung', 'sticks', 'jazz-trained', 'crisp', 'washy', 'low-end-heavy', 'drafty', 'low-fundamental-tuning']
  },
  {
    id: 'honking',
    tokens: ['jazz-trained', 'jazz-influenced', 'continuous-airflow', 'classical-jazz', 'legato', 'swung', 'body-resonance-low-mid', 'drafty', 'even-harmonic-rich']
  },
  {
    id: 'smearing',
    tokens: ['microtonal-bend', 'vibrato-rich', 'neutral-third', 'modal', 'classical', 'ornament-heavy', 'ornamental-melismatic', 'chest-resonance-low-mid', 'choir-blendable']
  },
  {
    id: 'funking',
    tokens: ['funk-derived', 'dance-rhythm', 'swung', 'dance-driving', 'samba-foundation', 'hyped-mids', 'top-rolled-off-12k', 'plosive-resistant', 'controlled']
  },
  {
    id: 'rumbling',
    tokens: ['foundational-sub', 'sub-bass-foundational', 'sub-driven', 'sub-bass', 'walking-bass', 'swung', 'hyped-mids', 'moving-coil', 'dub-friendly']
  },
  {
    id: 'shoegazing',
    tokens: ['haunted-romantic', 'sub-bass-foundational', 'rapid-tremolo', 'distorted', 'dark', 'rock-context', 'high-gain-saturation', 'articulate', 'whispered']
  },
  {
    id: 'samul-percussive',
    tokens: ['fast-attack-transient', 'percussive', 'articulate', 'sharp', 'naturally-reverberant', 'ceremonial', 'balanced', 'focused-low-end-decay', 'fundamental']
  },
  {
    id: 'raga-melismatic',
    tokens: ['raga-bound', 'ornament-heavy', 'ornamental-melismatic', 'Hindu-ritual', 'melismatic', 'devotional', 'contemplative', 'drone-foundation', 'flexible']
  },
  {
    id: 'makam-melismatic',
    tokens: ['Turkish-makam-base', 'Middle-Eastern', 'ornament-heavy', 'ornamental-melismatic', 'sufi-mystical', 'court-ceremonial', 'modal', 'neutral-third', 'microtonal-bend']
  },
  {
    id: 'andalusi-modal',
    tokens: ['Turkish-makam-base', 'Middle-Eastern', 'ornament-heavy', 'ornamental-melismatic', 'sufi-mystical', 'court-ceremonial', 'modal', 'neutral-third', 'microtonal-bend']
  },
  {
    id: 'mc-flowing',
    tokens: ['choir-blendable', 'thick', 'grounded', 'speech-mimicry', 'speech-mimicking', 'rhythmic-speech', 'covered', 'speech-derived', 'declaimed']
  },
  {
    id: 'belting',
    note: "voice flung outward to fill the room — chest voice at maximum, theater-trained or stadium-trained",
    tokens: ['projecting', 'chest-resonance-low-mid', 'vibrato-rich', 'late-Romantic-onward', 'ringing', 'blues-shouter', 'characteristic-cry', 'choir-blendable', 'classical']
  },
  {
    id: 'harmonizing',
    note: "voices stacked deliberately — barbershop close-harmony, doo-wop, gospel, vocal-jazz arrangement",
    tokens: ['pure', 'beat-free', 'key-locked', 'choir-blendable', 'sacred-traditional', 'devotional', 'congregation-loud', 'low-mid-rich', 'natural-absorption']
  },
  {
    id: 'meandering',
    note: "the line wanders without urgency — improvisation that takes its time, refuses to resolve",
    tokens: ['virtuoso', 'classical-jazz', 'jazz-trained', 'jazz-influenced', 'swung', 'bias-bump-low-mid', 'body-resonance-low-mid', 'drafty', 'lyrical']
  },
  {
    id: 'cloud-floating',
    tokens: ['ambient', 'pad', 'lush-ambient', 'naturally-reverberant', 'layered-ambient', 'drone-foundation', 'sustained-tone', 'drone-like', 'beat-free']
  },
  {
    id: 'concrete-precise',
    note: "the sound under a microscope, each grain heard separately",
    tokens: ['chopped', 'sampled', 'breaks-and-loops', 'beat-suited', 'swung', 'foundational', 'low-distortion-low-coloration', 'modern-standard', 'airless']
  },
  {
    id: 'overtone',
    note: "the harmonic series audible above the fundamental — sympathetic strings, just-intoned chords, throat-singing",
    tokens: ['overtone-rich', 'undamped-resonance', 'drone-foundation', 'dhrupad-suited', 'shruti-inflected', 'drone-like', 'flexible', 'Hindu-ritual', 'melismatic']
  },
  {
    id: 'spiraling',
    note: "the line curling upward in widening circles — the figure rising as it repeats",
    tokens: ['pad', 'sustained', 'trance-suited', 'edgy', 'energetic', 'layered-ambient', 'digital', 'high-gain-saturation', 'lead-and-pad']
  },
  {
    id: 'four-stomping',
    note: "the kick lands on every quarter, the body submits",
    tokens: ['beat-suited', 'sub-driven', 'fast-attack-transient', 'club-staple', 'Chicago-foundational', 'sub-bass', 'sub-fundamental-buzz', 'sub-bass-foundational', 'solid-state-clean']
  },
  {
    id: 'micro-stuttering',
    note: "tiny rhythmic clicks and gaps engineered to ear-tug",
    tokens: ['chopped', 'sampled', 'breaks-and-loops', 'digital', 'low-distortion-low-coloration', 'clean', 'lively', 'modern', 'modern-standard']
  },
  {
    id: 'tropical-rolling',
    note: "lo-end pulse and sample-flips that move hip and shoulder",
    tokens: ['dance-rhythm', 'production-staple', 'twenty-first-century', 'snappy', 'funk-derived', 'versatile', 'dance-driving', 'swung', 'jazz-influenced']
  },
  {
    id: 'modular-mutating',
    note: "patch-cable timbre that drifts and recombines over the bar",
    tokens: ['Buchla-derived', 'patient', 'timbral', 'arranged', 'experimental', 'extended-techniques', 'pad', 'digital', 'modern']
  },
  {
    id: 'billowing',
    note: "the sound expanding outward as it sustains — fabric in slow wind, pad swelling at the edges",
    tokens: ['pad', 'sustained', 'swimming', 'layered-ambient', 'lush-ambient', 'paraphonic', 'soaring', 'dense', 'classic']
  },
  {
    id: 'kora-cascading',
    note: "two-handed harp arpeggios rolling down and back up",
    tokens: ['fingerpicked', 'deep', 'narrative', 'open-chord-ringing-overtones', 'articulate', 'balanced', 'full', 'low-mid-rich-spectrum', 'singing']
  },
  {
    id: 'balafon-pattering',
    note: "wooden bars and gourd resonators answering each other in quick five-tone runs",
    tokens: ['oral-history', 'natural-material-resonance', 'kora-and-ngoni-and-balafon-ensemble', 'dense', 'dry', 'African-craft', 'African-derived', 'African-traditional', 'pan-African']
  },
  {
    id: 'dunun',
    note: "the Mande hand-drum's foundational pattern, supporting the lead djembe and balafon",
    tokens: ['foundational', 'melodic', 'modern', 'extended', 'concert', 'kora-and-ngoni-and-balafon-ensemble', 'griot-family-lineage', 'African-traditional', 'African-derived']
  },
  {
    id: 'orchestral',
    note: "ensemble-frame register — the soloist supported by a body of sustained tone behind them",
    tokens: ['orchestral', 'soloistic', 'professional', 'late-Romantic-onward', 'sustained-projection', 'dark-romantic', 'legato', 'classical', 'asymmetric-saturation']
  },
  {
    id: 'jibaro-pulsing',
    note: "hand-percussion pattern that makes the dancer hesitate then commit",
    tokens: ['martillo-pattern', 'layered', 'consistent', 'hands', 'traditional', 'modern', 'swung', 'dance-driving', 'funk-derived']
  },
  {
    id: 'oro-rolling',
    note: "tempo and ornament that pulls feet into the chain dance",
    tokens: ['dance-driving', 'commercial', 'twenty-first-century', 'production-staple', 'snappy', 'versatile', 'digital', 'modern', 'controlled']
  },
  {
    id: 'klezmer-dancing',
    note: "rolling oompah that wants both feet at once",
    tokens: ['straight', 'melodic', 'supple', 'mellowed', 'loud', 'classic', 'overtone-rich-sustained', 'projecting', 'vibrato-y']
  },
  {
    id: 'cutting',
    note: "the high-frequency strike that opens space in the mix — punctuation more than sustain",
    tokens: ['treble-extended', 'snappy', 'hyped-mids', 'glassy', 'fast-attack-transient', 'projecting', 'articulate', 'balanced', 'expansive-reverb']
  },
  {
    id: 'mizmar-piping',
    note: "paired double-reed bending through neutral thirds, raw and circular-breathed",
    tokens: ['microtonal-bend', 'neutral-third', 'ornamented', 'modal', 'ornament-heavy', 'Middle-Eastern', 'ornamental-melismatic', 'microtonal', 'classical']
  },
  {
    id: 'skiffle-makeshift',
    note: "household objects pressed into musical service, more rhythm than tone",
    tokens: ['saturation-distortion-headroom', 'low-mid-rich-spectrum', 'folk', 'strummed', 'fingerpicked', 'boxy', 'articulate', 'balanced', 'full']
  },
  {
    id: 'choro-bantering',
    note: "nylon string fast and conversational, six lines talking",
    tokens: ['broken-in-fast', 'modern-classical', 'soft-attack', 'singing-sustain', 'brighter', 'cutting', 'full', 'low-mid-rich-spectrum', 'open-chord-ringing-overtones']
  },
  {
    id: 'sparse-tapping',
    note: "hand on skin, quiet, the texture more than the pulse",
    tokens: ['soft-attack', 'soft', 'plush', 'cozy', 'lament-leaning', 'iberian-celtic', 'folk-tradition', 'top-rolled-off-8k', 'body-resonance-low-mid']
  },
  {
    id: 'breath-coloring',
    note: "air moving through the tube colored by the player's mouth shape",
    tokens: ['octave-below-concert', 'soloistic', 'continuous-airflow', 'overtone-rich', 'full', 'balanced', 'drone-foundation', 'ornamental-melismatic', 'legato']
  },
  {
    id: 'string-conversing',
    note: "two or three strings tracing a melodic line, casual register",
    tokens: ['fingerpicked', 'folk', 'folk-tradition', 'narrative', 'deep', 'articulate', 'balanced', 'full', 'Western']
  },
  {
    id: 'reed-singing',
    note: "free reeds in chorus, breath sustaining the tone past comfort",
    tokens: ['straight', 'melodic', 'supple', 'mellowed', 'classic', 'loud', 'overtone-rich-sustained', 'projecting', 'legato']
  },
  {
    id: 'roda-circling',
    note: "all six choro instruments in conversation, the wheel that gives the form its name",
    tokens: ['historical', 'foundational', 'european-folk', 'rhythmic', 'jazz-influenced', 'jazz-trained', 'classical-jazz', 'cozy', 'soft']
  },
  {
    id: 'donso',
    note: "the pre-Islamic Mande hunter brotherhoods' invocational register",
    tokens: ['donso', 'hunters', 'pre-islamic-rooted', 'invocational', 'pentatonic-rooted', 'ritual', 'pre-modern', 'fingerpicked', 'lyrical']
  },
  {
    id: 'grounding',
    note: "the low end the rest of the ensemble stands on — bassoon, tuba, contrabass, bass voice",
    tokens: ['continuous-airflow', 'legato', 'low-overtone-rich', 'full', 'foundation-bass', 'concert', 'overtone-rich', 'sub-driven', 'low-fundamental-tuning']
  },
  {
    id: 'atmospheric',
    note: "the sound describes the room more than the source — air more than notes",
    tokens: ['lush-ambient', 'ambient', 'floating', 'halo', 'swimming', 'layered-ambient', 'sustained', 'sustained-tone', 'drone-foundation']
  },
  {
    id: 'street-pulsing',
    note: "phone-speaker beat made for the street, all attack and no decay",
    tokens: ['twenty-first-century', 'production-staple', 'commercial', 'snappy', 'versatile', 'headroom-generous', 'digital', 'dance-driving', 'modern']
  },
  {
    id: 'xalam-tracing',
    note: "four-string Senegambian lute, oral-history pace, finger-rolls under the voice",
    tokens: ['oral-history', 'genealogical', 'fingerpicked', 'African-craft', 'narrative', 'African-traditional', 'African-derived', 'pan-African', 'folk-tradition']
  },
  {
    id: 'minority-piping',
    note: "Yunnan minority-tradition free-reed pipe, plain and breathy, drone underneath",
    tokens: ['Chinese-classical', 'sustained-tone', 'drone-foundation', 'gagaku-foundational', 'naturally-reverberant', 'beat-free', 'minimal', 'balanced', 'full']
  },
  {
    id: 'stride-trotting',
    note: "left hand stride pattern over right-hand melodic improvisation, concert-piano body",
    tokens: ['hammer-low-mid-emphasis', 'block-chord', 'classical-jazz', 'archival', 'recital', 'romantic-orchestra', 'singing', 'jazz-trained', 'hyped-top']
  },
  {
    id: 'analog',
    note: "analog electronics character — drift, warmth, the era marker",
    tokens: ['analog-drift-character', 'vintage-electronic', 'swimming', 'paraphonic', 'classic-bass', 'pad', 'sustained', 'synthesized', 'classic']
  },
  {
    id: 'shringara',
    note: "Sanskrit aesthetic: the love rasa — eros and romantic longing, ornamented vocal line answering a sarangi or sustained bowed string",
    tokens: ['shruti-inflected', 'vocal-imitating', 'sustaining', 'expressive', 'raga-bound', 'Hindu-ritual', 'flexible', 'drone-foundation', 'ornamented']
  },
  {
    id: 'karuna',
    note: "Sanskrit aesthetic: the compassion-sorrow rasa, the lamenting register — voice or bansuri carrying loss",
    tokens: ['legato', 'mournful', 'lament-leaning', 'fado-lead', 'university-fado', 'celtic', 'iberian-celtic', 'body-resonance-low-mid', 'figure-8']
  },
  {
    id: 'vatsalya',
    note: "Sanskrit affect: parental tenderness — quiet bansuri, soft harmonium drone, voice in lullaby register",
    tokens: ['shruti-inflected', 'soft', 'plush', 'soft-onset', 'low-overtone-rich', 'intimate-aspirated', 'cozy', 'lament-leaning', 'traditional']
  },
  {
    id: 'viraha',
    note: "Sanskrit affect: separation-longing — thumri and dadra territory, voice and sarangi tracing absence",
    tokens: ['shruti-inflected', 'raga-bound', 'vocal-imitating', 'melismatic', 'ornamental-melismatic', 'Hindu-ritual', 'dhrupad-suited', 'drone-foundation', 'drone-like']
  },
  {
    id: 'bhakti',
    note: "devotional surrender — bhajan, kirtan, gurmat-sangeet: voice and ritual ensemble pointed at the divine",
    tokens: ['shruti-inflected', 'Hindu-ritual', 'raga-bound', 'ceremonial', 'sacred-traditional', 'devotional', 'melismatic', 'dhrupad-suited', 'contemplative']
  },
  {
    id: 'raudra',
    note: "Sanskrit aesthetic: the rage-and-martial rasa — pakhawaj and tabla driving, voice in declamatory register",
    tokens: ['raga-bound', 'shruti-inflected', 'projecting', 'transient-grab-aggressive', 'declaimed', 'dhrupad-suited', 'ornamental-melismatic', 'drone-foundation', 'meend-rich']
  },
  {
    id: 'vira',
    note: "Sanskrit aesthetic: the heroic rasa — declamatory dhrupad register, large voice over pakhawaj",
    tokens: ['shruti-inflected', 'sustained-projection', 'dhrupad-suited', 'projecting', 'raga-bound', 'Hindu-ritual', 'flexible', 'drone-foundation', 'traditional']
  },
  {
    id: 'adbhuta',
    note: "Sanskrit aesthetic: the wonder rasa — sudden veena or sitar register-shift that catches the listener still",
    tokens: ['shruti-inflected', 'undamped-resonance', 'biting', 'natural-material-resonance', 'microtonal', 'ornamented', 'dhrupad-suited', 'Hindu-ritual', 'silvery']
  },
  {
    id: 'hasya',
    note: "Sanskrit aesthetic: the joy-and-laughter rasa — tarana and tillana territory, virtuoso vocal-percussive play",
    tokens: ['shruti-inflected', 'raga-bound', 'virtuoso', 'flexible', 'expressive', 'Hindu-ritual', 'dhrupad-suited', 'drone-foundation', 'classical']
  },
  {
    id: 'alap-unfolding',
    note: "slow exposition of a raga, no tabla yet — long notes pulling the listener into the modal interior",
    tokens: ['shruti-inflected', 'raga-bound', 'floating', 'halo', 'low-overtone-rich', 'legato', 'sustained', 'Hindu-ritual', 'flexible']
  },
  {
    id: 'gamak',
    note: "Carnatic-style oscillating ornament — a note made to shake at the player's chosen frequency, raga-bound interval",
    tokens: ['raga-bound', 'shruti-inflected', 'meend-rich', 'microtonal-bend', 'ornamental-melismatic', 'melismatic', 'drone-foundation', 'classical-trained', 'ornamented']
  },
  {
    id: 'undulating',
    note: "the line refuses a fixed pitch — oscillation as content, the wave itself the message",
    tokens: ['microtonal', 'melismatic', 'ornamental-melismatic', 'ornamented', 'devotional', 'traditional', 'dhrupad-suited', 'drone-foundation', 'drone-like']
  },
  {
    id: 'meend-sliding',
    note: "glide between notes through every microtone, the line vocal-like even when bowed or blown",
    tokens: ['gliding', 'vocal-mimicking', 'microtonal', 'shruti-inflected', 'legato', 'dhrupad-suited', 'raga-bound', 'Hindu-ritual', 'flexible']
  },
  {
    id: 'jhala-cascading',
    note: "fast tremolo climax — sitar or sarod entering the closing phase, drone strings ringing through the picking",
    tokens: ['percussive', 'undamped-resonance', 'biting', 'microtonal', 'virtuoso', 'ornamented', 'neutral', 'present', 'tremolo']
  },
  {
    id: 'bandish-locking',
    note: "the composition-core lands and locks — voice and harmonium agreeing on the bandish line",
    tokens: ['raga-bound', 'dhrupad-suited', 'meditative-tempo', 'contemplative', 'melismatic', 'ornamental-melismatic', 'devotional', 'shruti-inflected', 'drone-foundation']
  },
  {
    id: 'qi-flowing',
    note: "breath-as-life-force — erhu or dizi line that never breaks, the tone always settling toward a centered breath",
    tokens: ['legato', 'sustained', 'pentatonic', 'vocal-imitating', 'overtone-rich', 'expressive', 'full', 'balanced', 'drone-foundation']
  },
  {
    id: 'ya-refining',
    note: "literati elegance — guzheng or pipa in scholarly register, no haste, full overtones allowed to bloom",
    tokens: ['Chinese-classical', 'classical-trained', 'plucked', 'meditative', 'string-attack', 'soloistic', 'beat-free', 'drone-foundation', 'sustained']
  },
  {
    id: 'shanshui-misting',
    note: "mountain-and-water painting aesthetic — sustained pipa or dizi suggesting depth without describing it",
    tokens: ['sustained', 'beat-free', 'pure', 'overtone-rich', 'classical', 'balanced', 'key-locked', 'full', 'drone-foundation']
  },
  {
    id: 'piercing',
    note: "the high-pitch sustained note that pierces the listener's attention — soprano forte, jinghu, bagpipe chanter",
    tokens: ['sustained-high-register', 'projecting', 'treble-extended', 'folk', 'hyped-mids', 'moving-coil', 'plosive-resistant', 'top-rolled-off-12k', 'dynamic']
  },
  {
    id: 'erhuang',
    note: "Beijing opera erhuang mode — slow, contemplative, tragic-leaning",
    tokens: ['legato', 'sustained', 'expressive', 'sustaining', 'stable', 'full', 'balanced', 'melodic', 'romantic']
  },
  {
    id: 'jiangnan-suiting',
    note: "Jiangnan silk-and-bamboo aesthetic — refined Han chamber ensemble pace, balanced pentatonic interplay",
    tokens: ['jiangnan-suited', 'Chinese-classical', 'pentatonic', 'pentatonic-rooted', 'balanced', 'beat-free', 'overtone-rich', 'meditative', 'classical-trained']
  },
  {
    id: 'wabi-rustic',
    note: "rustic-imperfect aesthetic — soft attack, breath audible, the tone allowed to be plain",
    tokens: ['pure', 'beat-free', 'low-overtone-rich', 'soft', 'plush', 'key-locked', 'cozy', 'celtic', 'Scottish-influenced']
  },
  {
    id: 'sabi-patinated',
    note: "lonely-elegant patina — koto or shakuhachi line carrying the weight of the years that played it",
    tokens: ['archival', 'horn-mechanical-pickup', 'pre-war', 'surface-noise-bedded', 'bandwidth-narrow', 'disc', 'mid-emphasized', 'no-bass-extension', 'pre-microgroove']
  },
  {
    id: 'ma-pausing',
    note: "negative-space pause — Japanese aesthetic of the gap, the silence between notes carrying the weight of the note",
    tokens: ['beat-free', 'naturally-reverberant', 'minimal', 'sustained-tone', 'pure', 'sustained', 'key-locked', 'drone-foundation', 'Chinese-classical']
  },
  {
    id: 'gei-refining',
    note: "refined-art practice — koto sōkyoku or shamisen in formal classical register, the technique invisible to the listener",
    tokens: ['pure', 'beat-free', 'classical', 'key-locked', 'virtuoso', 'drone-foundation', 'ceremonial', 'sustained-tone', 'expressive']
  },
  {
    id: 'subwoofer',
    note: "low end you feel in the chest before you hear it — club system, car system, body in the room",
    tokens: ['sub-bass', 'sub-driven', 'sub-fundamental-buzz', 'low-fundamental-tuning', 'club-staple', 'walking-bass', 'low-mid-thick', 'sub-bass-foundational', 'boomy']
  },
  {
    id: 'drone-floating',
    note: "long sustained electronic tone holding without resolution, the air pressurized by it",
    tokens: ['drone-foundation', 'minimal', 'sustained-tone', 'drone-like', 'naturally-reverberant', 'ornamental-melismatic', 'beat-free', 'key-locked', 'pure']
  },
  {
    id: 'drowning',
    note: "the source mostly gone, only the tail of the room reading — voice or instrument submerged in space",
    tokens: ['naturally-reverberant', 'lush-ambient', 'reverberant', 'ambient', 'layered-ambient', 'drone-foundation', 'sustained-tone', 'sustained', 'beat-free']
  },
  {
    id: 'roaring',
    note: "the source pushed past its comfortable threshold — bass cabs, blown speakers, throats at full extension",
    tokens: ['high-gain-saturation', 'growly', 'transient-grab-aggressive', 'distorted', 'mid-rich', 'fast-attack-transient', 'percussive', 'walking', 'hf-distortion-prone']
  },
  {
    id: 'breaks-skittering',
    note: "classic breakbeat chops at jungle/drum-bass tempo — the breakbeat refuses to settle",
    tokens: ['chopped', 'breaks-and-loops', 'beat-suited', 'sampled', 'foundational', 'low-distortion-low-coloration', 'modern-standard', 'clean', 'modern']
  },
  {
    id: 'elevating',
    note: "the line that lifts the room — ecstatic register, voice or instrument carrying listeners past ordinary attention",
    tokens: ['melismatic', 'devotional', 'ecstatic', 'microtonal', 'ornamented', 'ornamental-melismatic', 'sacred-traditional', 'contemplative', 'drone-foundation']
  },
  {
    id: 'circling',
    note: "the figure returns and returns until the listener stops counting — repetition as elevation",
    tokens: ['devotional', 'raga-bound', 'drone-like', 'melismatic', 'sacred-traditional', 'drone-foundation', 'sustained', 'ornamental-melismatic', 'contemplative']
  },
  {
    id: 'inshad-cantillating',
    note: "Islamic vocal art of inshad — sustained text-driven melismatic devotional singing",
    tokens: ['melismatic', 'microtonal', 'ornamented', 'devotional', 'ornamental-melismatic', 'sacred-traditional', 'court-ceremonial', 'classical', 'traditional']
  },
  {
    id: 'taqsim-roaming',
    note: "Arabic-Persian instrumental improvisation through a maqam — oud or qanun finding the mode by walking it",
    tokens: ['microtonal', 'ornamented', 'tarab-suited', 'microtonal-bend', 'modal', 'ornamental-melismatic', 'classical', 'expressive', 'thick']
  },
  {
    id: 'piphat-rolling',
    note: "Thai piphat ensemble — gongs and xylophones interlocking at competition tempo",
    tokens: ['pure', 'minimal', 'naturally-reverberant', 'beat-free', 'key-locked', 'gagaku-foundational', 'classical', 'virtuoso', 'drone-foundation']
  },
  {
    id: 'mor-lam-storytelling',
    note: "Lao-Isan storytelling singing over khaen free-reed pipes — pentatonic-modal vernacular",
    tokens: ['melodic', 'ornamental-melismatic', 'expressive', 'melismatic', 'sustaining', 'ornament-heavy', 'devotional', 'court-ceremonial', 'versatile']
  },
  {
    id: 'kalangu-talking',
    note: "Hausa talking drum bending pitch under the singer — the drum as second voice answering text",
    tokens: ['low-fundamental-tuning', 'vocal-accompaniment', 'pitched', 'virtuoso', 'flexible', 'shruti-inflected', 'raga-bound', 'Hindu-ritual', 'dhrupad-suited']
  },
  {
    id: 'desert',
    note: "Saharan modal-cycling register — the figure becomes a place, the place becomes the song",
    tokens: ['authentic', 'modal', 'drone-like', 'drone-foundation', 'ornamental-melismatic', 'sustained-tone', 'sustained-projection', 'traditional', 'classical']
  },
  {
    id: 'soukous-cascading',
    note: "Congolese rumba lead-guitar lines that flutter and roll — sebene section dance imperative",
    tokens: ['dance-rhythm', 'African-craft', 'snappy', 'African-derived', 'strummed', 'treble-extended', 'African-traditional', 'pan-African', 'balanced']
  },
  {
    id: 'dembow-stomping',
    note: "dembow riddim — the boom-cha pattern that defines reggaeton and latin trap rhythm bed",
    tokens: ['speech-mimicking', 'rhythmic-speech', 'twenty-first-century', 'production-staple', 'commercial', 'snappy', 'dance-driving', 'versatile', 'digital']
  },
  {
    id: 'mc-cadencing',
    note: "rap delivery prioritizing flow-pattern and internal rhyme over melodic content — language as percussion",
    tokens: ['rhythmic-speech', 'speech-mimicking', 'speech-mimicry', 'speech-derived', 'sub-bass', 'funk-derived', 'synthesized', 'synthetic', 'layered-ambient']
  },
  {
    id: 'maracatu-marching',
    note: "Pernambuco rural carnival — alfaia drums marching with afoxé and gonguê over voice call-and-response",
    tokens: ['folk-tradition', 'dance-driving', 'iberian-celtic', 'folk', 'characteristic-cry', 'controlled', 'close', 'lively', 'even-harmonic-rich']
  },
  {
    id: 'sufi-mystical',
    note: "sufi-mystical register — the Islamic mystical tradition's sustained devotional aesthetic",
    tokens: ['sufi-mystical', 'ornament-heavy', 'melismatic', 'ceremonial', 'devotional', 'sacred-traditional', 'court-ceremonial', 'ornamental-melismatic', 'liturgical']
  },
  {
    id: 'maqam-modal',
    note: "Arabic-Persian maqam aesthetic — modal exploration with quarter-tone color, ornamentation as content",
    tokens: ['microtonal-bend', 'modal', 'tarab-suited', 'classical-radif', 'neutral-third', 'ornament-heavy', 'ornamental-melismatic', 'Middle-Eastern', 'Turkish-makam-base']
  },
  {
    id: 'asymmetric-rolling',
    note: "Korean janggu pattern — asymmetric hourglass-drum rolls answering the lead gong",
    tokens: ['ceremonial', 'classical', 'sacred-traditional', 'devotional', 'liturgical', 'sacred-Latin', 'full', 'medieval', 'reverent']
  },
  {
    id: 'kakaki-heralding',
    note: "Hausa-Fulani court long-trumpet — six-foot brass tube heralding royal ceremony",
    tokens: ['court-ceremonial', 'call', 'ritual', 'Rosh-Hashanah-Yom-Kippur', 'sufi-mystical', 'sufi', 'common', 'devotional', 'ornamental-melismatic']
  },
  {
    id: 'string-swimming',
    note: "paraphonic string-machine pad — vintage analog ensemble swimming through reverb",
    tokens: ['paraphonic', 'swimming', 'vintage-electronic', 'sweetened', 'soaring', 'overtone-rich-sustained', 'high', 'warmed', 'classic']
  },
  {
    id: 'energizing',
    note: "the sound that raises the room's heart-rate — kick-drum and synth lead pushing listeners forward in time",
    tokens: ['energetic', 'trance-suited', 'edgy', 'lead-and-pad', 'high-gain-saturation', 'dance-driving', 'digital', 'modern', 'pad']
  },
  {
    id: 'refined',
    note: "the technique invisible to the listener — the line so well-formed it sounds inevitable",
    tokens: ['classical', 'controlled', 'ornamented', 'articulate', 'virtuoso', 'lively', 'versatile', 'balanced', 'overtone-rich']
  },
  {
    id: 'cascading',
    note: "falling water on a metal staircase — fast descending figure the ear can't quite count",
    tokens: ['lead-melodic', 'lead-melody', 'ornamental', 'ornamental-melismatic', 'virtuoso', 'fast-attack-transient', 'articulate', 'narrow-attack-onset', 'clean-articulation-low-blur']
  },
  {
    id: 'paternal',
    note: "the voice that has shouldered weight — low resonance and unhurried tempo, the speech of someone who's been listened to before",
    tokens: ['chest-resonance-low-mid', 'declaimed', 'sustained-projection', 'warm-glowing', 'low-mid-rich', 'grounded', 'thick', 'choir-blendable', 'classical']
  },
  {
    id: 'stuttering',
    note: "the signal interrupting itself — chops, fragments, the rhythm refusing to settle",
    tokens: ['chopped', 'cassette', 'consumer-format', 'hf-distortion-prone', 'beat-suited', 'breaks-and-loops', 'sampled', 'fast-attack-transient', 'percussive']
  },
  {
    id: 'head-nodding',
    note: "the involuntary nod — pocket-locked groove the body answers before the mind does",
    tokens: ['foundation', 'amapiano-signature', 'foundational-sub', 'pan-African', 'African-derived', 'dance-driving', 'African-traditional', 'funky', 'funk-derived']
  },
  {
    id: 'entrancing',
    note: "the cycle that draws the listener in — repetition becomes invitation",
    tokens: ['meditative', 'minimal', 'gagaku-foundational', 'drone-like', 'drone-foundation', 'beat-free', 'naturally-reverberant', 'key-locked', 'pure']
  },
  {
    id: 'intoxicating',
    note: "the room slightly off-axis after the second bar — sweetness pushed past safety",
    tokens: ['late-Romantic-onward', 'haunted-romantic', 'romantic', 'dark-romantic', 'asymmetric-saturation', 'German-traditional', 'intimate-aspirated', 'low-fundamental-tuning', 'mournful']
  },
  {
    id: 'haunting',
    note: "the line that suggests what isn't there — voice in a room too large, instrument reverbed past its source",
    tokens: ['layered-ambient', 'ambient', 'cavernous', 'beat-free', 'pure', 'key-locked', 'drone-foundation', 'sustained-tone', 'naturally-reverberant']
  },
  {
    id: 'struggling',
    note: "audible effort — the technique near its limit, the line reaching past what the body can comfortably give",
    tokens: ['gospel-rooted', 'gospel-runs', 'blues-shouter', 'shouted', 'congregation-loud', 'devotional', 'sacred-traditional', 'liturgical', 'sacred-Latin']
  },
  {
    id: 'effortless',
    note: "the run that costs nothing — articulation so clean the listener forgets there's a player",
    tokens: ['virtuoso', 'legato', 'controlled', 'jazz-trained', 'classical-jazz', 'swung', 'articulate', 'jazz-influenced', 'flowing']
  },
  {
    id: 'snarling',
    note: "anti-virtuosic raw distorted rock — Pacific-Northwest grunge register, chest-belt aggression over chugged power-chord riffs in dropped tunings",
    tokens: ['rock-context', 'distorted', 'high-gain-saturation', 'palm-muting-chugged-riff', 'power-chord-fifths-no-third', 'drop-tunings-common-d-and-c', 'seattle-grunge-defining', 'pacific-northwest-rain-aesthetic', 'chest-resonance-low-mid']
  },
  {
    id: 'dream-floating',
    note: "hazy reverb-washed female-vocal-buried-in-mix shoegaze-dream-pop register — guitar layers smoothed into atmosphere, synth-pad foundation, modal ambiguity",
    tokens: ['smoothed', 'synthesized', 'uk-4ad-and-creation-shoegaze', 'late-80s-early-90s-uk-shoegaze-dream-pop-canon', 'wall-of-guitars-aesthetic', 'reverb-and-delay-and-tremolo-foundational', 'tremolo-and-glide-detuning', 'chromatic-non-diatonic-vocabulary', 'modal-ambiguity-major-minor-blurred']
  },
  {
    id: 'primitive-meandering',
    note: "solo-acoustic-fingerpicked-steel-string raga-influenced drone-and-melody, single-mic intimate home-recording aesthetic — instrumental wandering between blues vamp, hymnody, and raga suspension",
    tokens: ['instrumental-fingerpicked-solo', 'instrumental-fingerstyle-solo', 'open-tuning-drone', 'indian-raga-harmonic-suspension', 'delta-blues-bones', 'ragtime-and-hymnody-residual', 'minimalist-classical-influence', 'single-mic-or-stereo-pair', 'home-recording-aesthetic']
  },
  {
    id: 'mbira-cycling',
    note: "thumb-piano cyclic-pattern Shona ceremonial trance — breath-and-beat pulsation with whispered overtone halo, woody-treble resonance over sustained drone",
    tokens: ['whispering', 'breathing-beat', 'breathy', 'drone-foundation', 'drone-like', 'sustained-tone', 'traditional', 'woody', 'treble-extended']
  },
  {
    id: 'nordic-droning',
    note: "Norwegian hardanger-fele sympathetic-resonance modal-fiddle aesthetic — lydian/mixolydian drone over open-string-and-understring resonance, fjord-and-stabbur context",
    tokens: ['nordic-folk-modal', 'lydian-and-mixolydian-modes', 'sympathetic-string-resonance', 'hardanger-fele-tradition', 'western-norway-fjord-context', 'norwegian-folk-fiddle', 'drone-foundation', 'drone-like', 'sustained-tone']
  },
  {
    id: 'psy-pulsing',
    note: "psytrance/goa hour-long-build hypnotic-acid-bass — analog-drift mono-synth lead over vast layered-ambient pad, sustained-projection lead and dance-driving pulse",
    tokens: ['analog-drift-character', 'synthesized', 'synthetic', 'layered-ambient', 'vast', 'sustained-projection', 'lead', 'dance-driving', 'low-mid-thick']
  },
  {
    id: 'gospel-belting',
    note: "Pentecostal-and-Black-American gospel vocal — melismatic blues-inflected call-response group-vocal with characteristic gospel-runs and congregation-loud projection",
    tokens: ['gospel-pentecostal', 'gospel-rooted', 'gospel-runs', 'blues-inflected', 'melismatic', 'chest-resonance-low-mid', 'projecting', 'vibrato-rich', 'mixed-belt']
  },
  {
    id: 'griot-praising',
    note: "Mande jeli/griot praise-narrative vocal — Manding-pentatonic kora-and-ngoni-accompanied praise-singing with accumulated-epithet ancestral-name declamation",
    tokens: ['mande-jeli-vocal', 'griot-praise-narrative-vocal', 'pentatonic-jeli-modal-vocal', 'west-african-praise-vocal-lineage', 'call-response', 'modal-improvisation', 'speech-derived', 'projecting', 'classical']
  },
  {
    id: 'kobushi-ornamenting',
    note: "Japanese min'yo folk-vocal kobushi-ornament style — subtle pitch-bend ornament traces and koe-on resonance characteristic of Edo-Meiji folk lineage",
    tokens: ['min-yo', 'japanese-folk-vocal', 'kobushi-ornament-traces', 'koe-on-resonance', 'edo-meiji-folk-lineage', 'ornamented', 'vibrato-rich', 'expressive', 'classical']
  },
  {
    id: 'sigimsae-bending',
    note: "Korean minsogak folk-vocal sigimsae-ornament style — characteristic pitch-bending and jeong-affect emotional-saturation across Korean folk repertoire",
    tokens: ['korean-minsogak-folk-vocal', 'jeong-affect', 'sigimsae-ornament-traces', 'gyemyeon-pyeong-modal', 'ornamented', 'yoseong-pitch-oscillation-ornament', 'minsogak', 'jinyangjo-slowest-18-8-extended-lament', 'call-response']
  },
  {
    id: 'qing-yi-intoning',
    note: "Chinese classical vocal qing-yi style — tonal-language melody-locked Mandarin-syllabic delivery with characteristic role-type voicing",
    tokens: ['chinese-classical-vocal', 'tonal-language-melody-locked', 'mandarin-syllabic-tradition', 'qing-yi-laodan-role-types', 'classical', 'expressive', 'projecting', 'sustained-tone', 'flowing']
  },
  {
    id: 'oli-chanting',
    note: "Polynesian oli ceremonial-chant — Hawaiian glottal-onset 'okina-marked free-meter recitative, kahiko-mele canonical-tradition",
    tokens: ['polynesian-oli-chant', 'hawaiian-okina-glottal-onset', 'kahiko-mele-tradition', 'recitative-free-meter', 'solo-unaccompanied', 'speech-derived', 'classical', 'sustained-tone', 'flowing']
  },
  {
    id: 'oriki-naming',
    note: "Yoruba oriki praise-naming — tonal-language melody-locked accumulated-epithet praise tradition with characteristic call-response architecture",
    tokens: ['yoruba-tonal-vocal', 'oriki-praise-tradition', 'tonal-language-melody-locked', 'west-african-call-response-vocal', 'call-response', 'speech-derived', 'classical', 'modal-improvisation', 'projecting']
  },
  {
    id: 'taladh-soothing',
    note: "Scottish Gaelic taladh-tradition lullaby and Hebridean vocal style — modal-affect with puirt-a-beul-adjacent ornamentation",
    tokens: ['scottish-gaelic-vocal', 'taladh-tradition', 'hebridean-vocal', 'puirt-a-beul-adjacent', 'scottish-modal-affect', 'classical', 'sustained-tone', 'flowing', 'expressive']
  },
  {
    id: 'demotic-keening',
    note: "Mediterranean demotic-folk vocal — modal-melismatic-folk delivery with descending-cry cadence, drawing on professional-keening tradition lineage",
    tokens: ['mediterranean-demotic-vocal', 'modal-melismatic-folk', 'descending-cry-cadence', 'professional-keening-tradition-lineage', 'mournful', 'lament-wail', 'ornamented', 'melismatic', 'glissando-heavy']
  },
  {
    id: 'tahrir-ornamenting',
    note: "Persian dastgah vocal — modal-improvisation with characteristic avaz ornamentation and tahrir vocal-yodel ornament",
    tokens: ['dastgah', 'persian-classical', 'modal-improvisation', 'avaz-ornamentation', 'avaz-ornamentation', 'persian-classical', 'modal-improvisation', 'ornamented', 'melismatic']
  },
  {
    id: 'interlocking-hocketing',
    note: "Hocket-articulation vocal — interlocking-pitch group-vocal architecture where individual singers contribute single-pitch parts to a collective polyphonic cycle (Baaka pygmy, Inuit katajjaq lineage)",
    tokens: ['hocket-articulation', 'katajjaq', 'inuit-throat-singing', 'duet-game', 'breathing-rhythm', 'throat-singing', 'overtone-singing', 'paired-vocal-game-katajjaq', 'arctic-inuit-katajjaq-context']
  },
  {
    id: 'antiphoning',
    note: "Call-and-response group vocal — antiphonal leader-and-group architecture typical of work-songs, freedom-songs, and processional traditions",
    tokens: ['callresponse-articulation', 'antiphonal-articulation', 'choir-blendable', 'sacred-Latin', 'liturgical', 'historical', 'ensemble', 'homophonic-chordal-rhythm-aligned', 'call-response']
  },
  {
    id: 'hollering',
    note: "Mississippi Delta field-holler and pre-blues vocal-cry tradition — melismatic field-cry stylized-shouting across rural-agricultural and prison-labor contexts",
    tokens: ['unrestrained', 'outdoor-pitched', 'lament-wail', 'characteristic-cry', 'blues-shouter', 'projecting', 'speech-derived', 'unaccompanied', 'gospel-rooted']
  },
  {
    id: 'narrating',
    note: "Narrative declamatory vocal style — storytelling delivery for ballad, praise-poetry, recitation, and bardic-text settings",
    tokens: ['narrative', 'declamatory', 'storytelling', 'speech-derived', 'narrative', 'classical', 'sustained-tone', 'expressive', 'flowing']
  },
  {
    id: 'clapping-and-syllabicizing',
    note: "Staccato syllabic vocal — punctuated rhythmic delivery typical of nursery rhyme, hand-clap game, jump-rope, and counting-rhyme contexts",
    tokens: ['punctuated', 'percussive', 'syllabic-singing-one-note-per-syllable', 'call-response', 'rhythmic-speech', 'syllabic-singing-one-note-per-syllable', 'projecting', 'percussive', 'ensemble']
  },
  {
    id: 'melisma-spinning',
    note: "Melismatic singing — many-notes-per-syllable elaborate vocal-ornament typical of lament, devotional, qawwali, and praise-poetry traditions",
    tokens: ['melismatic-singing-many-notes-per-syllable', 'ornamental', 'expressive', 'melismatic', 'ornamented', 'glissando-heavy', 'sustained-tone', 'vibrato-rich', 'expressive']
  },
  {
    id: 'declaiming',
    note: "Recitative free-rhythm declamation — rhythmically-free pitched-speech for praise-recitation, name-and-genealogy chant, and bardic text-setting",
    tokens: ['recitative-rhythmically-free-pitched-speech', 'declamatory-free-rhythm', 'declamatory', 'speech-derived', 'narrative', 'projecting', 'rhythmic-speech', 'classical', 'expressive']
  },
  {
    id: 'ametrical-intoning',
    note: "Ametrical pitched chant — sustained-tone free-rhythm chant for liturgical, devotional, and contemplative-ritual contexts",
    tokens: ['ametrical-pitched-chant-free-rhythm', 'sustained-tones-free-rhythm', 'tibetan-buddhist', 'gyuto', 'gyume', 'multiphonic-vocal', 'vajrayana', 'low-fundamental', 'throat-singing']
  },
  {
    id: 'orating',
    note: "Heightened-speech stylized intonation — theatrical-projection no-fixed-pitch delivery for praise-orator, izibongo-reciter, and ceremonial-declamation contexts",
    tokens: ['heightened-speech-stylized-intonation', 'theatrical-projection-no-fixed-pitch', 'speech-derived', 'projecting', 'classical', 'narrative', 'rhythmic-speech', 'expressive', 'ensemble']
  },
  {
    id: 'spoken-flowing',
    note: "Rhythmic-spoken-flow no-pitch syncopated speech-rhythm — rap, hip-hop, dub-poetry, and spoken-word delivery",
    tokens: ['rhythmic-spoken-flow-no-pitch', 'syncopated-speech-rhythm', 'rhythmic-speech', 'speech-derived', 'rhythmic-speech', 'narrative', 'flowing', 'connected', 'syllabic-singing-one-note-per-syllable']
  },
  {
    id: 'syllabicizing',
    note: "One-note-per-syllable singing — folk-strophic delivery for ballad, hymn, work-song, lullaby, and group-anthem contexts",
    tokens: ['syllabic-singing-one-note-per-syllable', 'syllabic-singing-one-note-per-syllable', 'speech-derived', 'rhythmic-speech', 'choir-blendable', 'liturgical', 'ensemble', 'historical', 'classical']
  },
  {
    id: 'yodel-throating',
    note: "Mongolian-Tuvan khoomei throat-singing — multi-pitch-simultaneous overtone vocal-production characteristic of steppe hunter-herder tradition",
    tokens: ['khoomei', 'overtone-singing', 'multi-pitch-simultaneous', 'urtiin-duu-long-song-and-khoomei-overtone-pastoral-context', 'khoomei', 'tuvan-throat', 'mongolian-throat', 'overtone-singing', 'harmonic-series']
  },
  {
    id: 'qawwali-flying',
    note: "Sufi qawwali devotional-vocal — call-response Persian-melismatic ecstatic-praise tradition",
    tokens: ['qawwali', 'sufi-devotional', 'call-response', 'persian-melismatic', 'sufi-devotional', 'qawwali', 'call-response', 'persian-melismatic', 'melismatic']
  },
  {
    id: 'sean-nos-cascading',
    note: "Sean-nós Gaelic-vocal — unaccompanied free-rhythm ornamented Gaelic-tradition vocal",
    tokens: ['sean-nos', 'unaccompanied', 'gaelic-tradition', 'free-rhythm', 'sean-nos', 'unaccompanied', 'free-rhythm', 'ornamented', 'melismatic']
  },
  {
    id: 'jondo-tearing',
    note: "Flamenco cante jondo — flamenco-deep gypsy-Andalusian melismatic-raw lament vocal",
    tokens: ['cante-jondo', 'flamenco-deep', 'gypsy-andalusian', 'melismatic-raw', 'cante-jondo', 'flamenco-deep', 'gypsy-andalusian', 'melismatic-raw', 'lament-wail']
  },
  {
    id: 'articulate',
    note: "clean transient consonants and crisp diction — every syllable lands distinctly, pop-vocal-training and contemporary-commercial register",
    tokens: ['fast-attack-transient', 'speech-derived', 'tight-articulation', 'clean-articulation-low-blur', 'projecting', 'controlled', 'balanced', 'modern-pop-training', 'minimal-AES-narrowing']
  },
  {
    id: 'nuanced',
    note: "subtle dynamic shading and controlled micro-register shifts — chamber-music, lieder, and jazz-ballad delivery where every gesture is intentional",
    tokens: ['subtle', 'subtle-virtuosity', 'expressive', 'expressive-extended', 'controlled', 'soft-attack', 'balanced', 'intimate-aspirated', 'plush']
  },
  {
    id: 'hyperbolic',
    note: "exaggerated theatrical projection — register-extreme, dynamics-extreme, ornament-heavy bel-canto and operatic-belt delivery",
    tokens: ['dramatic', 'operatic', 'italian-operatic', 'declamatory', 'belt-projection', 'sustained-projection', 'projection-prioritized', 'expressive-extended', 'ornament-heavy']
  },
  {
    id: 'storytelling',
    note: "narrative-arc delivery — speech-derived melodic line shaped by paragraph-pacing, bard-and-griot-and-balladeer register where words carry the form",
    tokens: ['narrative', 'speech-derived', 'speech-like', 'bardic', 'wandering-bardic', 'rhythmic-speech', 'recitative-rhythmically-free-pitched-speech', 'griot-praise-narrative-vocal', 'heightened-speech-stylized-intonation']
  },
  {
    id: 'dismissive',
    note: "clipped quick delivery with dropped tails — bored register, throwaway phrasing, low-investment articulation",
    tokens: ['speech-derived', 'rhythmic-speech', 'conversational', 'soft-attack', 'minimal', 'controlled', 'balanced', 'low-projection-volume', 'speech-quality-modal-neutral-larynx']
  },
  {
    id: 'mocking',
    note: "exaggerated mimicry register — ironic singsong, parodic pitch-distortion, satirical-imitation phrasing",
    tokens: ['conversational', 'rhythmic-speech', 'expressive', 'ornamented', 'speech-mimicry', 'characteristic-cry', 'expressive-extended', 'speech-derived', 'speech-pitched']
  },
  {
    id: 'nagging',
    note: "repetitive fixed-pitch insistent rhythm — pressure-pattern delivery, no-melodic-development register",
    tokens: ['rhythmic-speech', 'syncopated-speech-rhythm', 'speech-derived', 'no-pitch-organization-speech', 'speech-pitched', 'controlled', 'projecting', 'tight-articulation', 'punctuated']
  },
  {
    id: 'apologetic',
    note: "soft hesitant delivery with descending phrases — low-energy contrition register, restraint as posture",
    tokens: ['soft-attack', 'speech-derived', 'intimate-aspirated', 'controlled', 'low-projection-volume', 'plush', 'breath-heavy', 'subtle', 'covered']
  },
  {
    id: 'warning',
    note: "emphatic projected declarative — caution-issuing register, mid-projected with rhythmic-marker accents",
    tokens: ['declamatory', 'projecting', 'declaimed', 'tight-articulation', 'controlled', 'rhythmic-speech', 'punctuated', 'characteristic-cry', 'speech-derived']
  },
  {
    id: 'consoling',
    note: "slow low-register sustained breath-paced intimate — comfort-giving register, close-mic and present",
    tokens: ['intimate-aspirated', 'soft-attack', 'sustained-tone', 'breath-heavy', 'plush', 'cozy', 'low-mid-rich-spectrum', 'controlled', 'speech-derived']
  },
  {
    id: 'coaxing',
    note: "gentle rising-phrase persuasive cadence — soft-pressure encouragement register",
    tokens: ['soft-attack', 'expressive', 'rhythmic-speech', 'speech-derived', 'subtle', 'intimate-aspirated', 'plush', 'controlled', 'speech-pitched']
  },
  {
    id: 'fawning',
    note: "exaggerated soft-sweet breathy-sustained deferential — over-flattering register, courtesy-as-performance",
    tokens: ['intimate-aspirated', 'breath-heavy', 'plush', 'cozy', 'expressive-extended', 'soft-attack', 'ornamented', 'sustained-tone', 'subtle']
  },
  {
    id: 'oratorial',
    note: "formal-stage rhetorical projection — public-address register with declamatory-projection and classical-rhetoric cadence",
    tokens: ['declamatory', 'declaimed', 'projecting', 'belt-projection', 'sustained-projection', 'speech-derived', 'heightened-speech-stylized-intonation', 'projection-prioritized', 'theatrical-projection-no-fixed-pitch']
  },
  {
    id: 'lobbying',
    note: "persuasive repeated-argument formal-political register — sustained-effort case-making delivery",
    tokens: ['speech-derived', 'rhythmic-speech', 'declamatory', 'projecting', 'controlled', 'narrative', 'conversational', 'heightened-speech-stylized-intonation', 'expressive']
  },
  {
    id: 'eulogizing',
    note: "slow sustained low-register reverent — dignified praise-of-the-dead register, funeral-oration cadence",
    tokens: ['sustained-tone', 'low-mid-rich-spectrum', 'declaimed', 'declamatory', 'controlled', 'balanced', 'speech-derived', 'lament-wail', 'plush']
  },
  {
    id: 'conversational',
    note: "natural-speech casual-cadence varied-pitch — everyday register, untheatrical talking-singing",
    tokens: ['speech-derived', 'speech-like', 'rhythmic-speech', 'speech-pitched', 'subtle', 'controlled', 'balanced', 'soft-attack', 'speech-quality-modal-neutral-larynx']
  },
  {
    id: 'nostalgic',
    note: "sustained slow vibrato-rich sad-but-fond delivery — longing-back-look register, time-distance phrasing",
    tokens: ['sustained-tone', 'expressive', 'vibrato-y', 'low-mid-rich-spectrum', 'controlled', 'plush', 'soft-attack', 'expressive-extended', 'speech-derived']
  },
  {
    id: 'charming',
    note: "gentle attractive warmth — performed-but-untroubled, supper-club register, draws the listener in without seducing or coaxing",
    tokens: ['expressive', 'vibrato-y', 'soft-attack', 'plush', 'balanced', 'speech-derived', 'controlled', 'subtle', 'cozy']
  },
  {
    id: 'cheeky',
    note: "playful impertinence with a raised-eyebrow vocal-color — wink-and-grin register, light springy phrasing with hidden mischief",
    tokens: ['expressive', 'speech-derived', 'conversational', 'rhythmic-speech', 'vibrato-y', 'characteristic-cry', 'soft-attack', 'subtle', 'ornamented']
  },
  {
    id: 'swindlers',
    note: "con-artist register — smooth-projected speech with persuasive intimate-aspirated lean-in and sudden ornamented shifts, the carnival-barker / snake-oil cadence drawing the mark in",
    tokens: ['speech-derived', 'rhythmic-speech', 'conversational', 'expressive', 'low-mid-rich-spectrum', 'intimate-aspirated', 'vibrato-y', 'ornamented', 'narrative']
  },
  {
    id: 'vagabonds',
    note: "wandering-outsider register — bardic dust-road register that's earned its scratches, world-weary-romantic narrative delivery with breath-heavy low-mid-rich sustain",
    tokens: ['bardic', 'wandering-bardic', 'speech-derived', 'narrative', 'low-mid-rich-spectrum', 'breath-heavy', 'rhythmic-speech', 'expressive-extended', 'sustained-tone']
  },
  {
    id: 'galloping',
    note: "a driving three-beat gait — the figure breaking into a run, hooves answering the downbeat",
    tokens: ['snappy', 'fast-attack-transient', 'dance-driving', 'articulate', 'balanced', 'walking', 'hyped-mids', 'backbeat', 'percussive']
  },
  {
    id: 'playful',
    note: "light springy mischief — the line winking as it skips, never quite serious",
    tokens: ['expressive', 'speech-derived', 'conversational', 'rhythmic-speech', 'vibrato-y', 'characteristic-cry', 'soft-attack', 'subtle', 'ornamented']
  },
  {
    id: 'weeping',
    note: "open crying carried in the tone — breath broken by the sob, the pitch sliding under the grief",
    tokens: ['lament-wail', 'mournful', 'breath-heavy', 'rapid-tremolo', 'glissando-heavy', 'lament-leaning', 'vibrato-y', 'intimate-aspirated', 'speech-derived']
  },
  {
    id: 'tragic',
    note: "the fall written into the line — late-Romantic weight, the ending known before it arrives",
    tokens: ['late-Romantic-onward', 'lament-leaning', 'dark-romantic', 'mournful', 'sustained', 'expressive', 'romantic', 'haunted-romantic', 'full']
  },
  {
    id: 'numinous',
    note: "the sacred felt as pressure in the room — vast reverberant sustain pointing past itself",
    tokens: ['sacred-Latin', 'ceremonial', 'reverberant', 'naturally-reverberant', 'sustained-tone', 'drone-foundation', 'sacred-traditional', 'devotional', 'cavernous']
  },
  {
    id: 'disgusted',
    note: "the recoil in the voice — rough speech-derived delivery curling away from its object",
    tokens: ['speech-derived', 'rhythmic-speech', 'conversational', 'rough', 'growly', 'dark', 'low-mid-rich-spectrum', 'expressive', 'declaimed']
  },
  {
    id: 'lustful',
    note: "appetite close to the mic — breath-forward and slow, the tone leaning in",
    tokens: ['breathy-low', 'intimate-aspirated', 'smoothed', 'vibrato-y', 'soft-onset', 'close', 'warm-glowing', 'plush', 'covered']
  },
  {
    id: 'experimental',
    note: "timbre as the subject — patch-cable drift, extended technique, the sound recombining as it goes",
    tokens: ['experimental', 'extended-techniques', 'timbral', 'arranged', 'patient', 'Buchla-derived', 'pad', 'digital', 'synthesized']
  },
  {
    id: 'regretful',
    note: "the backward look that wishes otherwise — sustained, vibrato-shaded, the phrase descending into what can't be undone",
    tokens: ['sustained-tone', 'expressive', 'vibrato-y', 'low-mid-rich-spectrum', 'controlled', 'plush', 'soft-attack', 'mournful', 'speech-derived']
  },
  {
    id: 'happy',
    note: "unguarded brightness — lively attack and forward lift, the line smiling through every phrase",
    tokens: ['lively', 'snappy', 'dance-driving', 'hyped-mids', 'expressive', 'vibrato-y', 'articulate', 'balanced', 'controlled']
  },
  {
    id: 'tickled',
    note: "the laugh about to break loose — light bright phrasing with a catch of delight in it",
    tokens: ['expressive', 'vibrato-y', 'soft-attack', 'characteristic-cry', 'conversational', 'speech-derived', 'subtle', 'plush', 'lively']
  },
  {
    id: 'humiliated',
    note: "the voice made small — soft descending phrases, low projection, the body folding inward",
    tokens: ['soft-attack', 'speech-derived', 'intimate-aspirated', 'controlled', 'low-projection-volume', 'plush', 'breath-heavy', 'subtle', 'covered']
  },
  {
    id: 'guilty',
    note: "the confession that won't quite land — hesitant breath-forward delivery, eyes down",
    tokens: ['intimate-aspirated', 'soft-onset', 'breathy-low', 'breath-heavy', 'rhythmic-speech', 'speech-mimicking', 'soft-attack', 'covered', 'controlled']
  },
  {
    id: 'grumpy',
    note: "the low muttered complaint — rough chest-anchored register grumbling under its breath",
    tokens: ['low-register', 'rough', 'rough-tone', 'low-mid-rich-spectrum', 'dark', 'growly', 'speech-derived', 'rhythmic-speech', 'chest-resonance-low-mid']
  },
  {
    id: 'tense',
    note: "the spring wound tight — low fast-attack pulse coiled and waiting, every transient clenched",
    tokens: ['growly', 'sub-bass-foundational', 'thumpy', 'dark-romantic', 'fast-attack-transient', 'transient-grab-aggressive', 'walking', 'articulate', 'balanced']
  },
  {
    id: 'suspenseful',
    note: "the held breath before the turn — dark sustained low-end and reverb leaving room for what's coming",
    tokens: ['dark', 'sub-bass-foundational', 'drone-foundation', 'sustained-tone', 'beat-free', 'naturally-reverberant', 'low-mid-thick', 'layered-ambient', 'cavernous']
  },
  {
    id: 'epic',
    note: "the scale that dwarfs the listener — orchestral mass and thunderous low end, the heroic register",
    tokens: ['thunderous', 'sub-bass-foundational', 'orchestral', 'late-Romantic-onward', 'sustained-projection', 'dark-romantic', 'asymmetric-saturation', 'balanced', 'full']
  },
  {
    id: 'cinematic',
    note: "scored for an unseen screen — lush orchestral sustain layered into wide ambient space",
    tokens: ['orchestral', 'late-Romantic-onward', 'sustained-projection', 'layered-ambient', 'lush-ambient', 'dark-romantic', 'asymmetric-saturation', 'sustained-tone', 'full']
  },
  {
    id: 'warm',
    note: "glowing low-mid embrace — close, plush, the tone radiating comfort from the chest",
    tokens: ['warm-glowing', 'warmed', 'plush', 'intimate-aspirated', 'soft-onset', 'low-overtone-rich', 'cozy', 'smoothed', 'mellow']
  },
  {
    id: 'cold',
    note: "glassy and distant — sharp high overtones with no warmth left in, the surface of ice",
    tokens: ['glassy', 'sharp', 'cutting', 'metallic', 'high-frequency', 'treble-extended', 'clean', 'digital', 'airless']
  },
  {
    id: 'chilling',
    note: "the eerie register that raises the hair — cavernous reverb and sustained tone suggesting a presence",
    tokens: ['cavernous', 'naturally-reverberant', 'drone-foundation', 'sustained-tone', 'beat-free', 'pure', 'key-locked', 'layered-ambient', 'haunted-romantic']
  },
  {
    id: 'funny',
    note: "the comic turn played straight-faced — mimicry and characteristic-cry color landing the joke",
    tokens: ['conversational', 'rhythmic-speech', 'expressive', 'speech-mimicry', 'characteristic-cry', 'speech-derived', 'vibrato-y', 'soft-attack', 'ornamented']
  },
  {
    id: 'savage',
    note: "the attack with the teeth still in it — saturated mid-range aggression, raw and unrelenting",
    tokens: ['growly', 'high-gain-cascading-saturation', 'transient-grab-aggressive', 'metallic', 'sub-bass', 'distorted', 'fast-attack-transient', 'mid-rich', 'articulate']
  },
  {
    id: 'barbaric',
    note: "the primal stomp — thunderous low end under distorted brute force, ceremony before civilization",
    tokens: ['thunderous', 'sub-bass-foundational', 'transient-grab-aggressive', 'distorted', 'metal-context', 'growly', 'low-mid-thick', 'percussive', 'articulate']
  },
  {
    id: 'sad',
    note: "plain sorrow in the line — mournful, falling, the grief stated without ornament's distraction",
    tokens: ['mournful', 'lament-leaning', 'lament-wail', 'melismatic', 'glissando-heavy', 'dark-romantic', 'sustained-tone', 'expressive', 'full']
  },
  {
    id: 'fun',
    note: "the groove that just wants the body moving — swung, funky, no weight to it",
    tokens: ['dance-rhythm', 'swung', 'dance-driving', 'snappy', 'funky', 'funk-derived', 'hyped-mids', 'lively', 'controlled']
  },
  {
    id: 'soothing',
    note: "the line that lowers the pulse — soft, warm, close-harmony comfort with nothing sharp left in it",
    tokens: ['cozy', 'soft', 'plush', 'warmed', 'jazz-trained', 'smoothed', 'close-harmony', 'intimate-aspirated', 'gentle']
  },
  {
    id: 'grateful',
    note: "thanks carried on a warm release — gospel-rooted chest-anchored gratitude, choir-blended",
    tokens: ['warm-glowing', 'gospel-rooted', 'choir-blendable', 'chest-resonance-low-mid', 'sustained-projection', 'devotional', 'plush', 'melismatic', 'low-mid-rich']
  },
  {
    id: 'nervous',
    note: "the jitter under the surface — rapid tremolo and shallow breath, the line unable to hold still",
    tokens: ['rapid-tremolo', 'fast-tremolo', 'vibrato-y', 'breath-heavy', 'breathy-low', 'articulated', 'fast-attack-transient', 'soft-onset', 'intimate-aspirated']
  },
  {
    id: 'frustrated',
    note: "the effort hitting a wall — growling low-mid tension that can't quite break through",
    tokens: ['growly', 'transient-grab-aggressive', 'dark', 'low-mid-thick', 'sticks', 'articulate', 'sub-bass', 'fast-attack-transient', 'balanced']
  },
  {
    id: 'adored',
    note: "the beloved seen up close — warm vibrato-rich tenderness, breath-forward and cherishing",
    tokens: ['warm-glowing', 'intimate-aspirated', 'plush', 'soft-onset', 'vibrato-rich', 'breathy-low', 'smoothed', 'cozy', 'expressive']
  },
  {
    id: 'adoring',
    note: "love pointed outward — intimate warm singing leaning toward its object, devotion in the sustain",
    tokens: ['intimate-aspirated', 'warm-glowing', 'vibrato-rich', 'soft-onset', 'expressive', 'plush', 'breathy-low', 'singing-sustain', 'romantic']
  },
  {
    id: 'hopeful',
    note: "the line that lifts toward something — warm soft onset rising, the phrase reaching upward",
    tokens: ['warm-glowing', 'soft-onset', 'sustained-tone', 'expressive', 'plush', 'vibrato-y', 'legato', 'balanced', 'soaring']
  },
  {
    id: 'optimistic',
    note: "bright forward-leaning ease — major-keyed lift, lively and balanced, sure it works out",
    tokens: ['lively', 'warm-glowing', 'expressive', 'snappy', 'balanced', 'articulate', 'vibrato-y', 'controlled', 'dance-driving']
  },
  {
    id: 'satisfying',
    note: "the resolution that lands in the body — round swung groove settling into the pocket",
    tokens: ['warm-glowing', 'plush', 'smoothed', 'round', 'swung', 'controlled', 'balanced', 'body-resonance-low-mid', 'cozy']
  },
  {
    id: 'satisfied',
    note: "the contented exhale — warm, mellow, nothing left wanting, the tone at rest",
    tokens: ['warmed', 'warm-glowing', 'plush', 'cozy', 'smoothed', 'soft-onset', 'intimate-aspirated', 'mellow', 'soft']
  },
  {
    id: 'uplifting',
    note: "the build that carries the room up — energetic lead and pad pushing forward into light",
    tokens: ['energetic', 'trance-suited', 'lead-and-pad', 'high-gain-saturation', 'dance-driving', 'digital', 'modern', 'pad', 'soaring']
  },
  {
    id: 'jaded',
    note: "the world-weary register — low-mid breath-worn delivery that has heard it all already",
    tokens: ['low-mid-rich-spectrum', 'breath-heavy', 'speech-derived', 'rhythmic-speech', 'sustained-tone', 'dark', 'expressive', 'mournful', 'controlled']
  },
  {
    id: 'bitter',
    note: "resentment held in dark sustain — late-Romantic shadow, the sweetness gone sour",
    tokens: ['dark-romantic', 'low-mid-thick', 'haunted-romantic', 'mournful', 'dark', 'late-Romantic-onward', 'intimate-aspirated', 'sustained-tone', 'expressive']
  },
  {
    id: 'furious',
    note: "rage past control — cascading saturation and shouted aggression, every transient grabbing",
    tokens: ['high-gain-cascading-saturation', 'distorted', 'transient-grab-aggressive', 'growly', 'metal-context', 'shouted', 'fast-attack-transient', 'percussive', 'articulate']
  },
  {
    id: 'angry',
    note: "the heat in the voice — distorted forward aggression, the line shoving against its limits",
    tokens: ['distorted', 'transient-grab-aggressive', 'growly', 'high-gain-saturation', 'shouted', 'rock-context', 'fast-attack-transient', 'articulate', 'metal-context']
  },
  {
    id: 'thankful',
    note: "gratitude raised as praise — gospel-rooted congregational warmth, the thanks sung outward",
    tokens: ['gospel-rooted', 'sacred-traditional', 'devotional', 'choir-blendable', 'sustained-projection', 'chest-resonance-low-mid', 'melismatic', 'congregation-loud', 'warm-glowing']
  },
  {
    id: 'fearful',
    note: "the shrinking from a threat — trembling breath and dark low end, the voice pulling back",
    tokens: ['breath-heavy', 'breathy-low', 'rapid-tremolo', 'vibrato-y', 'soft-onset', 'intimate-aspirated', 'dark', 'sub-bass-foundational', 'covered']
  },
  {
    id: 'rebellious',
    note: "the refusal made loud — distorted rock defiance shouted against the chest's full push",
    tokens: ['rock-context', 'distorted', 'high-gain-saturation', 'shouted', 'transient-grab-aggressive', 'chest-resonance-low-mid', 'growly', 'hyped-mids', 'balanced']
  },
  {
    id: 'impatient',
    note: "the clipped hurry — fast-attack speech-rhythm pushing ahead of the beat, drumming its fingers",
    tokens: ['fast-attack-transient', 'rhythmic-speech', 'speech-derived', 'snappy', 'articulated', 'transient-grab-aggressive', 'punctuated', 'controlled', 'rapid-tremolo']
  },
  {
    id: 'bashful',
    note: "the shy half-turn away — soft breath-forward intimacy, the tone ducking from attention",
    tokens: ['soft-onset', 'breathy-low', 'intimate-aspirated', 'soft', 'plush', 'subtle', 'controlled', 'low-projection-volume', 'covered']
  },
  {
    id: 'disappointed',
    note: "the deflation after the hope — sustained line sagging downward, the let-down carried in a dimming tone",
    tokens: ['sustained-tone', 'expressive', 'vibrato-y', 'low-mid-rich-spectrum', 'controlled', 'plush', 'soft-attack', 'mournful', 'dark']
  },
  {
    id: 'terrified',
    note: "raw fear at full pitch — trembling breath over dark low end, the body braced against a threat",
    tokens: ['breath-heavy', 'breathy-low', 'rapid-tremolo', 'vibrato-y', 'soft-onset', 'intimate-aspirated', 'dark', 'sub-bass-foundational', 'transient-grab-aggressive']
  },
  {
    id: 'ambivalent',
    note: "the line that won't choose — drifting unresolved between poles, neither rising nor falling",
    tokens: ['drone-foundation', 'sustained-tone', 'beat-free', 'key-locked', 'minimal', 'naturally-reverberant', 'balanced', 'pure', 'layered-ambient']
  },
  {
    id: 'jovial',
    note: "hearty good cheer — warm full-throated lift, the laugh just under every phrase",
    tokens: ['lively', 'warm-glowing', 'expressive', 'vibrato-y', 'dance-driving', 'hyped-mids', 'plush', 'balanced', 'conversational']
  },
  {
    id: 'merry',
    note: "festive bright skip — snappy dance-lift, the line tipsy on its own gladness",
    tokens: ['lively', 'snappy', 'dance-driving', 'hyped-mids', 'articulate', 'balanced', 'swung', 'vibrato-y', 'controlled']
  },
  {
    id: 'gleeful',
    note: "barely-contained delight — bright excited phrasing on the edge of a laugh",
    tokens: ['expressive', 'vibrato-y', 'soft-attack', 'characteristic-cry', 'lively', 'snappy', 'dance-driving', 'hyped-mids', 'articulate']
  },
  {
    id: 'hostile',
    note: "cold aggression held just in check — dark growling low-mid, menace that hasn't struck yet",
    tokens: ['growly', 'sub-bass', 'transient-grab-aggressive', 'dark', 'low-mid-thick', 'sticks', 'articulate', 'fast-attack-transient', 'distorted']
  },
  {
    id: 'somber',
    note: "grave and low-lit — dark sustained weight, the register of a service for the dead",
    tokens: ['low-mid-thick', 'dark', 'dark-romantic', 'sub-bass-foundational', 'mournful', 'sustained-tone', 'late-Romantic-onward', 'low-end-heavy', 'controlled']
  },
  {
    id: 'solemn',
    note: "ceremonial gravity — sacred reverberant sustain, the room hushed for ritual weight",
    tokens: ['sacred-Latin', 'ceremonial', 'sustained-projection', 'reverberant', 'naturally-reverberant', 'drone-foundation', 'devotional', 'low-mid-rich', 'sustained-tone']
  },
  {
    id: 'repentant',
    note: "the penitent's lowered head — devotional contrition, sin confessed in a liturgical register",
    tokens: ['devotional', 'liturgical', 'medieval', 'congregation-loud', 'sacred-Latin', 'mournful', 'gospel-rooted', 'singing-sustain', 'ceremonial']
  },
  {
    id: 'mystifying',
    note: "the line that casts a spell — enigmatic reverbed sustain suggesting more than it states",
    tokens: ['layered-ambient', 'ambient', 'cavernous', 'beat-free', 'pure', 'key-locked', 'drone-foundation', 'sustained-tone', 'naturally-reverberant']
  },
  {
    id: 'mystified',
    note: "struck still by wonder — a sudden resonance the listener can't account for",
    tokens: ['undamped-resonance', 'microtonal', 'ornamented', 'drone-foundation', 'sustained-tone', 'naturally-reverberant', 'beat-free', 'pure', 'balanced']
  },
  {
    id: 'exposed',
    note: "nothing to hide behind — dry close-miked bareness, every breath and flaw audible",
    tokens: ['intimate-aspirated', 'breathy-low', 'breath-heavy', 'dry', 'close', 'soft-attack', 'speech-derived', 'covered', 'low-projection-volume']
  },
  {
    id: 'shamed',
    note: "the voice that wants to disappear — dark covered contrition, projection pulled to the floor",
    tokens: ['soft-attack', 'intimate-aspirated', 'breath-heavy', 'covered', 'low-projection-volume', 'dark', 'mournful', 'controlled', 'speech-derived']
  },
  {
    id: 'sheepish',
    note: "caught out and half-grinning — shy soft delivery ducking away from its own admission",
    tokens: ['soft-onset', 'breathy-low', 'intimate-aspirated', 'soft', 'subtle', 'controlled', 'low-projection-volume', 'conversational', 'plush']
  },
  {
    id: 'timid',
    note: "the meek half-step forward — quiet soft onset, the line afraid to take up room",
    tokens: ['soft-onset', 'breathy-low', 'intimate-aspirated', 'soft', 'plush', 'subtle', 'controlled', 'low-projection-volume', 'quiet']
  },
  {
    id: 'exhilarating',
    note: "the rush that lifts the pulse — energetic lead and fast tremolo driving the room upward",
    tokens: ['energetic', 'trance-suited', 'dance-driving', 'lead-and-pad', 'high-gain-saturation', 'rapid-tremolo', 'hyped-mids', 'digital', 'soaring']
  },
  {
    id: 'braggadocious',
    note: "swagger over a sub-bass anchor — hip-hop bravado, the boast carried as cadence",
    tokens: ['rhythmic-speech', 'speech-mimicking', 'speech-mimicry', 'sub-bass', 'sub-bass-foundational', 'funk-derived', 'hip-hop-warm', 'projecting', 'low-fundamental-tuning']
  },
  {
    id: 'bewildered',
    note: "the listener lost in it — drifting beat-free haze with no landmark to fix on",
    tokens: ['drone-foundation', 'sustained-tone', 'beat-free', 'naturally-reverberant', 'layered-ambient', 'minimal', 'key-locked', 'pure', 'dark']
  },
  {
    id: 'bewildering',
    note: "engineered to disorient — chopped fragments and shifting timbre refusing to resolve into sense",
    tokens: ['chopped', 'sampled', 'breaks-and-loops', 'digital', 'experimental', 'layered-ambient', 'modern', 'beat-suited', 'low-distortion-low-coloration']
  },
  {
    id: 'melancholic',
    note: "the sweet ache of dwelling in sorrow — late-Romantic shadow, longing with nowhere to go",
    tokens: ['dark-romantic', 'haunted-romantic', 'mournful', 'lament-leaning', 'late-Romantic-onward', 'intimate-aspirated', 'sustained-tone', 'low-mid-rich-spectrum', 'expressive']
  },
  {
    id: 'vengeful',
    note: "grievance sharpened to a point — dark driven declamation, the strike being readied",
    tokens: ['dark-romantic', 'growly', 'transient-grab-aggressive', 'sub-bass-foundational', 'low-mid-thick', 'declaimed', 'projecting', 'fast-attack-transient', 'articulate']
  },
  {
    id: 'alcoholic',
    note: "the room tilting after the third — warm tape-wobble drift, pitch and time loosening their grip",
    tokens: ['wow-and-flutter-noticeable', 'cassette', 'warm-glowing', 'warmed', 'vibrato-y', 'bandwidth-narrow', 'hf-distortion-prone', 'consumer-format', 'drift']
  },
  {
    id: 'slurred',
    note: "the consonants gone soft — smeared gliding line, every note running into the next",
    tokens: ['glissando-heavy', 'slide', 'microtonal-bend', 'vibrato-y', 'smoothed', 'legato', 'blues-shouter', 'breathy-low', 'intimate-aspirated']
  },
  {
    id: 'improvisational',
    note: "made up in the moment — jazz and modal improvisation taking its own unrepeatable path",
    tokens: ['virtuoso', 'classical-jazz', 'jazz-trained', 'jazz-influenced', 'swung', 'jazz-improvisation', 'lyrical', 'expressive', 'modal-improvisation']
  },
  {
    id: 'imperfect',
    note: "the rough edge left in on purpose — wabi-rustic plainness, the flaw that makes it human",
    tokens: ['pure', 'beat-free', 'low-overtone-rich', 'soft', 'rough', 'gritty', 'broken-in', 'surface-noise-bedded', 'natural-material-resonance']
  },
  {
    id: 'sensual',
    note: "the body in the tone — breathy vibrato-rich warmth leaning slow against the listener",
    tokens: ['breathy-low', 'intimate-aspirated', 'vibrato-rich', 'soft-onset', 'smoothed', 'plush', 'close', 'warm-glowing', 'jazz-influenced']
  },
  {
    id: 'authentic',
    note: "unprocessed and rooted — acoustic traditional sound with the room left honestly in",
    tokens: ['authentic', 'traditional', 'folk-tradition', 'folkloric', 'acoustic-only', 'natural-absorption', 'low-distortion-low-coloration', 'naturally-reverberant', 'classical']
  },
  {
    id: 'heavy',
    note: "weight you feel in the floor — sub-driven low-mid mass, the sound pressing down",
    tokens: ['sub-bass', 'sub-driven', 'low-fundamental-tuning', 'low-mid-thick', 'sub-bass-foundational', 'foundational-sub', 'low-end-heavy', 'boomy', 'dark']
  },
  {
    id: 'light',
    note: "weightless and bright — airy soft onset with the low end stripped away",
    tokens: ['airy', 'soft', 'soft-attack', 'breath-tone-airy', 'treble-extended', 'bright', 'plush', 'gentle', 'clean']
  },
  {
    id: 'airy',
    note: "more air than note — breath-toned top end floating in open space",
    tokens: ['airy', 'breath-tone-airy', 'silky-airy-top', 'breathy', 'floating', 'halo', 'ambient', 'lush-ambient', 'naturally-reverberant']
  },
  {
    id: 'focused',
    note: "narrowed to a point — tight controlled output with no blur at the edges",
    tokens: ['focused', 'focused-low-end-decay', 'focused-narrow-output', 'articulate', 'tight-articulation', 'controlled', 'clean-articulation-low-blur', 'balanced', 'dry']
  },
  {
    id: 'alert',
    note: "sharp and forward-leaning — fast transients and bright presence, every sense switched on",
    tokens: ['fast-attack-transient', 'snappy', 'treble-extended', 'articulate', 'bright', 'present', 'transient-grab-aggressive', 'crisp', 'hyped-mids']
  },
  {
    id: 'cramped',
    note: "the small dead room — boxy dry close sound with the walls pressing in",
    tokens: ['boxy', 'dry', 'close', 'intimate', 'airless', 'natural-absorption', 'low-mid-rich-spectrum', 'controlled', 'articulate']
  },
  {
    id: 'spacious',
    note: "the big room breathing — long reverberant decay opening wide behind the source",
    tokens: ['expansive-reverb', 'naturally-reverberant', 'cavernous', 'reverberant', 'wide', 'wide-soundstage', 'ambient', 'sustained-tone', 'vast']
  },
  {
    id: 'panoramic',
    note: "the wide vista — image spread edge to edge, the field opening past the speakers",
    tokens: ['panoramic-image', 'wide-soundstage', 'wide', 'dynamic-range-wide', 'expansive-reverb', 'layered-ambient', 'vast', 'soaring', 'naturally-reverberant']
  },
  {
    id: 'stereophonic',
    note: "width as the subject — hard-panned spread and wide-format image, the field fully opened",
    tokens: ['panoramic-image', 'wide-soundstage', 'stereo-pair-tracking', 'wide', 'dynamic-range-wide', 'wide-frequency', 'expansive-reverb', 'head-bump-wide-format', 'soaring']
  },
  {
    id: 'unpredictable',
    note: "refusing the expected turn — extended technique and chopped recombination, never twice the same",
    tokens: ['experimental', 'extended-techniques', 'timbral', 'arranged', 'chopped', 'sampled', 'breaks-and-loops', 'digital', 'modern']
  },
  {
    id: 'catchy',
    note: "the hook that won't leave — snappy commercial production built to lodge on first listen",
    tokens: ['twenty-first-century', 'production-staple', 'commercial', 'snappy', 'versatile', 'dance-driving', 'hyped-mids', 'digital', 'modern']
  },
  {
    id: 'dynamic',
    note: "the full sweep from hush to roar — wide dynamic arc shaping every phrase",
    tokens: ['dynamic', 'dynamic-range-wide', 'dynamic-arc-foundational', 'expressive', 'expressive-extended', 'controlled', 'balanced', 'projecting', 'articulate']
  },
  {
    id: 'transient',
    note: "all attack, no tail — the strike itself, fast onset cleanly cut from its decay",
    tokens: ['fast-attack-transient', 'transient-grab-aggressive', 'snappy', 'percussive', 'narrow-attack-onset', 'articulate', 'clean-articulation-low-blur', 'dry', 'balanced']
  },
  {
    id: 'technically-proficient',
    note: "the run that costs nothing — virtuoso articulation so clean it sounds inevitable",
    tokens: ['virtuoso', 'controlled', 'articulate', 'legato', 'classical', 'clean-articulation-low-blur', 'fast-runs', 'balanced', 'expressive']
  },
  {
    id: 'choirmasters',
    note: "voices ruled into one — pure key-locked choral blend, every part placed by a guiding ear",
    tokens: ['choir-blendable', 'pure', 'beat-free', 'key-locked', 'sacred-traditional', 'devotional', 'congregation-loud', 'sustained-projection', 'close-harmony']
  },
  {
    id: 'conductors',
    note: "the ensemble shaped by one arm — orchestral mass moving as a single dynamic body",
    tokens: ['orchestral', 'soloistic', 'professional', 'late-Romantic-onward', 'sustained-projection', 'dark-romantic', 'legato', 'classical', 'dynamic-arc-foundational']
  },
  {
    id: 'tight',
    note: "locked to the grid — drilled rhythmic articulation with no slack anywhere in it",
    tokens: ['tight-rhythmic-articulation', 'tight-low-end', 'military-tight', 'controlled', 'tight-articulation', 'fast-attack-transient', 'articulate', 'drilled', 'balanced']
  },
  {
    id: 'loose',
    note: "the easy pocket — swung and slightly behind, the rhythm section breathing not gripping",
    tokens: ['swung', 'backbeat', 'low-bridge-loose-action', 'drafty', 'washy', 'breathing', 'jazz-trained', 'controlled', 'walking']
  },
  {
    id: 'twangy',
    note: "the country pluck — bright woody string snap with the bend left ringing",
    tokens: ['twangy', 'country-twang', 'woody', 'flatpicked', 'backbeat', 'articulate', 'balanced', 'bright', 'snappy']
  },
  {
    id: 'jangling',
    note: "twelve strings ringing at once — bright chime-shimmer guitars, the chord blooming in overtones",
    tokens: ['jangly', 'chimey', 'chime-shimmer', 'treble-extended', 'strummed', 'bright', 'open-chord-ringing-overtones', 'articulate', 'backbeat']
  },
  {
    id: 'patient',
    note: "unhurried to a fault — long sustained tone letting the figure arrive in its own time",
    tokens: ['patient', 'meditative', 'beat-free', 'sustained', 'drone-foundation', 'sustained-tone', 'naturally-reverberant', 'key-locked', 'pure']
  },
  {
    id: 'anxious',
    note: "the worry that won't settle — rapid tremolo and shallow breath edged with dark tension",
    tokens: ['rapid-tremolo', 'fast-tremolo', 'vibrato-y', 'breath-heavy', 'articulated', 'fast-attack-transient', 'dark', 'transient-grab-aggressive', 'breathy-low']
  },
  {
    id: 'calming',
    note: "the line that lowers the pulse — soft warm sustain with every sharp edge smoothed off",
    tokens: ['cozy', 'soft', 'plush', 'warmed', 'smoothed', 'soft-onset', 'intimate-aspirated', 'gentle', 'mellow']
  },
  {
    id: 'generous',
    note: "giving warmth without stint — full choir-blended low-mid radiance opening outward",
    tokens: ['warm-glowing', 'plush', 'full', 'choir-blendable', 'sustained-projection', 'low-mid-rich', 'chest-resonance-low-mid', 'gospel-rooted', 'balanced']
  },
  {
    id: 'livid',
    note: "rage gone white — cascading saturation and shouted overload past any restraint",
    tokens: ['high-gain-cascading-saturation', 'distorted', 'transient-grab-aggressive', 'shouted', 'growly', 'metal-context', 'fast-attack-transient', 'percussive', 'mid-rich']
  },
  {
    id: 'irked',
    note: "the low irritated mutter — grumbling speech-rhythm worrying at a small grievance",
    tokens: ['rhythmic-speech', 'speech-derived', 'growly', 'dark', 'low-mid-rich-spectrum', 'controlled', 'punctuated', 'articulate', 'conversational']
  },
  {
    id: 'malfunctioning',
    note: "the signal eating itself — glitched chops and tape artifacts, the machine coming apart",
    tokens: ['chopped', 'sampled', 'breaks-and-loops', 'hf-distortion-prone', 'cassette', 'consumer-format', 'fast-attack-transient', 'percussive', 'digital']
  },
  {
    id: 'broken',
    note: "the gear past saving — degraded narrow-band noise riding under a failing source",
    tokens: ['broken', 'degraded', 'surface-noise-bedded', 'bandwidth-narrow', 'hf-distortion-prone', 'wow-and-flutter-noticeable', 'cassette', 'consumer-format', 'gritty']
  },
  {
    id: 'devastating',
    note: "the line that levels the room — grief at full melismatic extension, the wound laid open",
    tokens: ['lament-leaning', 'mournful', 'lament-wail', 'glissando-heavy', 'melismatic', 'ornamental-melismatic', 'dark-romantic', 'sustained-tone', 'full']
  },
  {
    id: 'devastated',
    note: "the hollow after — breath-worn and emptied, sorrow with the strength gone out of it",
    tokens: ['breath-heavy', 'breathy-low', 'intimate-aspirated', 'mournful', 'lament-leaning', 'soft-attack', 'low-mid-rich-spectrum', 'sustained-tone', 'covered']
  },
  {
    id: 'flawed',
    note: "the take with the cracks kept in — slight degrade and surface grit, honest about its seams",
    tokens: ['broken-in', 'surface-noise-bedded', 'wow-and-flutter-light', 'gritty', 'rough', 'bandwidth-narrow', 'hf-distortion-prone', 'low-mid-rich-spectrum', 'cassette']
  },
  {
    id: 'crushed',
    note: "flattened under the weight — dark low-mid mass pressing the voice down and covered",
    tokens: ['low-mid-thick', 'dark', 'sub-bass-foundational', 'mournful', 'breath-heavy', 'covered', 'sustained-tone', 'low-end-heavy', 'controlled']
  },
  {
    id: 'confident',
    note: "sure of every note — projected chest-anchored assurance, nothing tentative in the line",
    tokens: ['projecting', 'chest-resonance-low-mid', 'sustained-projection', 'declaimed', 'belt-projection', 'controlled', 'balanced', 'full', 'articulate']
  },
  {
    id: 'upbeat',
    note: "glad and forward-driving — snappy swung lift, the tempo pulling everyone along",
    tokens: ['lively', 'snappy', 'dance-driving', 'dance-rhythm', 'swung', 'hyped-mids', 'articulate', 'balanced', 'funky']
  },
  {
    id: 'downbeat',
    note: "weight on the one — heavy on-beat groove anchoring the body to the floor",
    tokens: ['foundation', 'foundational-sub', 'dance-driving', 'funky', 'funk-derived', 'backbeat', 'low-fundamental-tuning', 'controlled', 'low-mid-thick']
  },
  {
    id: 'up-tempo',
    note: "fast and lifting — quick dance-driving pulse pushing past the comfortable",
    tokens: ['fast-tempo-110-160', 'dance-driving', 'snappy', 'fast-attack-transient', 'lively', 'hyped-mids', 'articulate', 'dance-rhythm', 'controlled']
  },
  {
    id: 'down-tempo',
    note: "slow and low — dub-leaning sub groove unspooling under no hurry",
    tokens: ['beat-suited', 'swung', 'low-fundamental-tuning', 'sub-bass', 'dub-friendly', 'meditative-tempo', 'layered-ambient', 'controlled', 'low-mid-thick']
  },
  {
    id: 'groovy',
    note: "deep in the pocket — funk-derived swung backbeat the body answers on its own",
    tokens: ['funk-derived', 'dance-rhythm', 'swung', 'dance-driving', 'hyped-mids', 'backbeat', 'funky', 'controlled', 'top-rolled-off-12k']
  },
  {
    id: 'radical',
    note: "loud and unbothered — rock-context energy shoved forward with an edge of revolt",
    tokens: ['rock-context', 'distorted', 'backbeat', 'energetic', 'hyped-mids', 'dance-driving', 'edgy', 'articulate', 'balanced']
  },
  {
    id: 'bodacious',
    note: "big and brash and fun — bold funky swing that takes up all the room it wants",
    tokens: ['funky', 'funk-derived', 'swung', 'dance-driving', 'snappy', 'hyped-mids', 'lively', 'backbeat', 'controlled']
  },
  {
    id: 'tubular',
    note: "bright surf-rock spring — twangy reverbed treble, the wave caught at its crest",
    tokens: ['rock-context', 'backbeat', 'twangy', 'bright', 'treble-extended', 'hyped-mids', 'snappy', 'articulate', 'balanced']
  },
  {
    id: 'ornate',
    note: "every surface carved — ornament-heavy melismatic line where decoration is the content",
    tokens: ['ornament-heavy', 'ornamental-melismatic', 'ornamented', 'baroque-ornamental', 'melismatic', 'microtonal-bend', 'expressive', 'classical', 'ornamental']
  },
  {
    id: 'embellished',
    note: "the plain line dressed up — trills and runs added over a melody that didn't need them",
    tokens: ['ornamented', 'ornamental', 'ornamental-melismatic', 'ornament-heavy', 'melismatic', 'expressive', 'vibrato-rich', 'glissando-heavy', 'classical']
  },
  {
    id: 'unembellished',
    note: "the bare melody, nothing added — one note per syllable, plainness as a discipline",
    tokens: ['pure', 'beat-free', 'key-locked', 'syllabic-singing-one-note-per-syllable', 'minimal', 'controlled', 'balanced', 'clean-articulation-low-blur', 'speech-derived']
  },
  {
    id: 'tarnished',
    note: "the patina of years on it — shellac surface-noise and narrowed band, beauty under the wear",
    tokens: ['archival', 'pre-war', 'shellac', 'surface-noise-bedded', 'horn-mechanical-pickup', 'disc', 'no-bass-extension', 'bandwidth-narrow', 'mid-emphasized']
  },
  {
    id: 'austere',
    note: "stripped to the essential — bare meditative sustain, no comfort and no excess",
    tokens: ['austere-meditative', 'pure', 'beat-free', 'key-locked', 'minimal', 'controlled', 'drone-foundation', 'sustained-tone', 'balanced']
  },
  {
    id: 'minimalist',
    note: "as few elements as will hold — sparse sustained tone, the space between the notes load-bearing",
    tokens: ['minimal', 'drone-foundation', 'sustained-tone', 'beat-free', 'key-locked', 'pure', 'naturally-reverberant', 'drone-like', 'balanced']
  },
  {
    id: 'maximalist',
    note: "everything at once — dense layered pads stacked until the field is full to the edges",
    tokens: ['layered-ambient', 'lush-ambient', 'dense', 'sustained', 'pad', 'paraphonic', 'soaring', 'overtone-rich', 'full']
  },
  {
    id: 'brutal',
    note: "force without mercy — cascading metal saturation over a sub floor, sheer crushing mass",
    tokens: ['high-gain-cascading-saturation', 'sub-bass', 'metal-context', 'metallic', 'transient-grab-aggressive', 'low-mid-thick', 'growly', 'thunderous', 'articulate']
  },
  {
    id: 'brutalist',
    note: "raw monolithic concrete — distorted dry sub-mass with the surfaces left harsh and unsoftened",
    tokens: ['distorted', 'sub-bass', 'transient-grab-aggressive', 'airless', 'dry', 'low-mid-thick', 'metallic', 'foundational-sub', 'articulate']
  },
  {
    id: 'luxurious',
    note: "plush and unhurried wealth — lush sweetened orchestral-soul warmth wrapping the listener",
    tokens: ['lush-ambient', 'lush-orchestral-soul-aesthetic', 'plush', 'sweetened', 'warm-glowing', 'overtone-rich-sustained', 'soaring', 'paraphonic', 'full']
  },
  {
    id: 'indulgent',
    note: "more than enough on purpose — rich ornamented sustain laid on thick, excess as the point",
    tokens: ['lush-ambient', 'plush', 'sweetened', 'ornament-heavy', 'overtone-rich', 'warm-glowing', 'dense', 'sustained', 'full']
  },
  {
    id: 'opulent',
    note: "gilded and ornate — baroque ornament over sweetened orchestral richness, the sound of gold",
    tokens: ['ornate', 'ornament-heavy', 'lush-orchestral-soul-aesthetic', 'sweetened', 'plush', 'overtone-rich', 'baroque-ornamental', 'full', 'sustained-projection']
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PREFACE_LEXICON };
}