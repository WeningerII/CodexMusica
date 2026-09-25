# Signature attribution pass

`references/_tradition_signatures.json` gives a tradition a short list of sound-words. Some of those words are not about sound: they claim the tradition belongs to, descends from, or is shaped by a culture (`celtic`, `gagaku-foundational`, `sufi-mystical`, `samba-foundation`). Those claims are published. The atlas (`src/atlas.js`) indexes the table for its "Sound-word match" search and ranks "Kin · shared sound-words" by it, and the connector and the app derive every seeded card's preface label from it. This page records the pass that ruled every such claim against the tradition's own catalog prose and removed the false ones.

## What is ruled, and where

- `references/_soundword_vocab.json` classes every token on a real tradition id: 144 cultural, 57 style, 410 sonic (611 tokens). A token is cultural when it names a specific people, place, language, religion or rite, or a named cultural tradition; genre and idiom words, Western art-music periods, generic function words and species-only materials are style, recorded but not ruled per pair.
- `references/_signature_rulings.json` rules every (tradition, cultural token) pair, 680 in all, against that tradition's own name, lineage and description (as `api/browse.json` publishes them), exemplars, parent tree node and crossRefs. Truth is a property of the pair: `dhrupad-suited` is attested on `dhrupad` and false on `kriti`, whose record sets itself against the Hindustani forms dhrupad belongs to; `celtic` is attested on `breton_folk` and false on `didgeridoo_yidaki_solo`. No token is removed wholesale.
- Verdicts: 360 attested, 85 loose (an umbrella, ancestral or diaspora link the prose supports; kept), 235 false. False tiers: 69 core (no documented link), 46 contradicted (the prose distinguishes or excludes it, quoted verbatim in the ruling), 120 boundary (a neighbouring culture or lineage the prose does not claim).
- The 235 false pairs, on 145 entries, are deleted from the table and so from the `src/app.js` mirror and `codex.html`. Nothing else in the table changed. No entry is left empty; `finnish_kantele_folk` and `swedish_nyckelharpa_folk` are left with one token each (`lament-leaning`), and no replacement tokens were invented.
- `scripts/check_signature_tokens.js` (promise `signature-attribution-ruled`, SKILL.md I8) fails on an unruled cultural pair, on a false pair still in the table, `src/app.js` or `codex.html`, and on a signature token the vocabulary does not class. It runs in the CI `gate` job beside `node scripts/build_signatures.js --check`, and `npm run faults` plants a restored false pair and an unruled cultural pair to prove it goes red.

False pairs by token (core / contradicted / boundary):

| token | false pairs | core | contradicted | boundary |
|---|---|---|---|---|
| `iberian-celtic` | 34 | 18 | 1 | 15 |
| `gagaku-foundational` | 16 | 4 | 3 | 9 |
| `dhrupad-suited` | 15 | 0 | 5 | 10 |
| `sufi-mystical` | 15 | 2 | 3 | 10 |
| `samba-foundation` | 14 | 3 | 6 | 5 |
| `Turkish-makam-base` | 12 | 1 | 3 | 8 |
| `sacred-Latin` | 11 | 5 | 3 | 3 |
| `celtic` | 10 | 9 | 0 | 1 |
| `Scottish-influenced` | 10 | 2 | 4 | 4 |
| `Irish-traditional` | 9 | 2 | 2 | 5 |
| `english-folk` | 8 | 2 | 2 | 4 |
| `Hindu-ritual` | 8 | 1 | 2 | 5 |
| `German-traditional` | 7 | 4 | 0 | 3 |
| `gospel-rooted` | 7 | 3 | 1 | 3 |
| `samba-batería` | 6 | 0 | 2 | 4 |
| `samba-foundational` | 6 | 0 | 2 | 4 |
| `classical-radif` | 5 | 0 | 0 | 5 |
| `french-musette-ready` | 5 | 1 | 1 | 3 |
| `university-fado` | 5 | 0 | 2 | 3 |
| `fado-lead` | 4 | 0 | 1 | 3 |
| `Japanese-classical` | 4 | 0 | 0 | 4 |
| `raga-bound` | 3 | 0 | 0 | 3 |
| `African-craft` | 2 | 0 | 2 | 0 |
| `African-derived` | 2 | 2 | 0 | 0 |
| `African-traditional` | 2 | 2 | 0 | 0 |
| `italian` | 2 | 2 | 0 | 0 |
| `pan-African` | 2 | 2 | 0 | 0 |
| `urban-Greek` | 2 | 0 | 0 | 2 |
| `asian-laminated` | 1 | 1 | 0 | 0 |
| `asian-spruce` | 1 | 1 | 0 | 0 |
| `Chinese-classical` | 1 | 0 | 0 | 1 |
| `cremonese-pre-1750` | 1 | 1 | 0 | 0 |
| `french-renaissance` | 1 | 0 | 1 | 0 |
| `Italian-baroque` | 1 | 0 | 0 | 1 |
| `japanese-factory` | 1 | 1 | 0 | 0 |
| `khyal` | 1 | 0 | 0 | 1 |
| `Korean-classical` | 1 | 0 | 0 | 1 |

## Recipe changes

Every seeded recipe was rendered through the connector engine (`mcp/engine.js` `startRecipe` + `renderRecipe`) in all four formats, on the base commit and on this branch. 96 entries render differently, in every format (compact 96, prose 96, rich 96, tags 96); all other entries, including 49 that lost a false pair, render byte-identically. No card's parts, room, chain or tuning moved: every change is an auto-derived preface label, 276 card labels in all. The app renders the same strings (`scripts/check_app_parity.js`, catalog-wide).

**Responsible pair(s)** are measured, not inferred: on the base commit each false pair was removed ALONE and the entry re-rendered; a pair is listed for a card when its removal alone moves that card's label. Removing all of an entry's false pairs together reproduces this branch's render exactly for every entry. A card with no single responsible pair (marked *joint*) moves only when two or more pairs go together. 17 card label(s) are joint.

Label = the preface id the renderer prints before the instrument's short name (e.g. `wabi-sabi jing`).

| entry | pairs removed (tier) | card: before → after | responsible pair(s) |
|---|---|---|---|
| `mariachi` (Mariachi) | `iberian-celtic` (core) | guitarron_mexicano: `sparse-tapping` → `apologizing` | `iberian-celtic` |
| `ranchera` (Ranchera) | `iberian-celtic` (core) | guitarron_mexicano: `sparse-tapping` → `apologizing` | `iberian-celtic` |
| `chicago_blues` (Chicago blues) | `gospel-rooted` (boundary) | electric_guitar_single_coil: `wailing` → `bluesy` | `gospel-rooted` |
|  |  | tonewheel_organ: `bluesy` → `wailing` | `gospel-rooted` |
| `jump_blues` (Jump blues) | `gospel-rooted` (boundary) | drum_kit: `wailing` → `reminiscing` | `gospel-rooted` |
|  |  | upright_piano: `reminiscing` → `wailing` | `gospel-rooted` |
|  |  | electric_guitar_single_coil: `sermonizing` → `gurgling` | `gospel-rooted` |
| `pentecostal_gospel` (Black Pentecostal gospel) | `sacred-Latin` (core) | choir_pentecostal_cogic: `doxological` → `challenging` | `sacred-Latin` |
|  |  | choir_southern_black_gospel: `penitential` → `devoted` | `sacred-Latin` |
| `gothic_rock` (Gothic rock) | `German-traditional` (core), `sacred-Latin` (core) | voice: `intoxicating` → `knee-buckling` | `German-traditional` |
|  |  | electric_guitar_single_coil: `knee-buckling` → `intoxicating` | `German-traditional` |
|  |  | drum_kit: `struggimento` → `brooding` | `German-traditional` |
| `symphonic` (Late Romantic symphonic) | `Italian-baroque` (boundary) | timpani: `struggimento` → `epic` | `Italian-baroque` |
|  |  | contrabassoon: `apollonian` → `conductors` | `Italian-baroque` |
|  |  | oboe: `conductors` → `orchestral` | `Italian-baroque` |
|  |  | french_horn: `epic` → `struggimento` | `Italian-baroque` |
|  |  | tuba: `orchestral` → `apollonian` | `Italian-baroque` |
| `beijing_opera` (Beijing opera (jingju)) | `gagaku-foundational` (boundary) | jinghu: `hissing` → `ma-pausing` | `gagaku-foundational` |
|  |  | erhu: `minority-piping` → `piphat-rolling` | `gagaku-foundational` |
|  |  | yueqin: `ma-pausing` → `hissing` | `gagaku-foundational` |
|  |  | pipa: `yugen` → `minority-piping` | `gagaku-foundational` |
|  |  | luogu: `mono-no-aware` → `yugen` | `gagaku-foundational` |
|  |  | sanxian: `wabi-sabi` → `ambivalent` | `gagaku-foundational` |
| `cantonese_opera` (Cantonese opera (yueju)) | `gagaku-foundational` (core) | yueqin: `hissing` → `ma-pausing` | `gagaku-foundational` |
|  |  | gaohu: `ma-pausing` → `hissing` | `gagaku-foundational` |
|  |  | yangqin: `mono-no-aware` → `ambivalent` | `gagaku-foundational` |
| `hindustani_sarod` (Hindustani classical (sarod-led)) | `Hindu-ritual` (contradicted), `dhrupad-suited` (contradicted), `khyal` (boundary) | tanpura: `shanti` → `undulating` | `Hindu-ritual`, `dhrupad-suited` |
|  |  | sitar: `undulating` → `elevating` | `dhrupad-suited` |
| `fado` (Fado) | `celtic` (core), `iberian-celtic` (boundary), `university-fado` (contradicted) | voice: `heart-breaking` → `demotic-keening` | *joint* |
|  |  | classical_nylon_string_guitar: `lamenting` → `heart-breaking` | *joint* |
|  |  | guitarra_portuguesa: `karuna` → `devastating` | `celtic`, `iberian-celtic`, `university-fado` |
| `morna` (Morna) | `celtic` (core), `fado-lead` (contradicted), `iberian-celtic` (core), `university-fado` (contradicted) | voice: `lamenting` → `demotic-keening` | `university-fado` |
|  |  | classical_nylon_string_guitar: `saudade` → `choro-bantering` | `university-fado` |
|  |  | cape_verdean_cavaquinho: `heart-breaking` → `devastating` | `university-fado` |
|  |  | clarinet: `karuna` → `refined` | `university-fado` |
|  |  | upright_bass: `devastating` → `heart-breaking` | `university-fado` |
| `celtic_irish_trad` (Irish trad session) | `Scottish-influenced` (contradicted), `english-folk` (boundary), `iberian-celtic` (boundary) | tin_whistle: `hiraeth` → `strutting` | *joint* |
|  |  | flute: `strutting` → `two-stepping` | *joint* |
|  |  | celtic_harp: `dor` → `skiffle-makeshift` | `iberian-celtic` |
|  |  | concertina_english: `heart-breaking` → `naive` | `iberian-celtic` |
|  |  | tin_whistle_low: `lamenting` → `apologizing` | `iberian-celtic` |
|  |  | uilleann_pipes: `two-stepping` → `avuncular` | `iberian-celtic` |
| `klezmer` (Klezmer) | `sufi-mystical` (boundary) | clarinet: `intercessory` → `technically-proficient` | `sufi-mystical` |
|  |  | klezmer_ensemble: `sufi-mystical` → `cascading` | `sufi-mystical` |
|  |  | mandola: `yaaburnee` → `dor` | `sufi-mystical` |
| `tango` (Tango) | `iberian-celtic` (core) | cello: `karuna` → `elegiac` | `iberian-celtic` |
| `pagode` (Pagode) | `samba-batería` (contradicted) | cavaquinho: `swaying` → `pulse-quickening` | `samba-batería` |
|  |  | tamborim: `tropical-rolling` → `swaying` | `samba-batería` |
| `sardinian_polyphony` (Sardinian polyphony (cantu a tenore)) | `sacred-Latin` (boundary) | a_tenores_quartet: `annunciatory` → `drone-floating` | `sacred-Latin` |
| `isicathamiya` (Isicathamiya) | `African-craft` (contradicted) | voice: `soukous-cascading` → `head-nodding` | `African-craft` |
|  |  | choir_southern_black_gospel: `balafon-pattering` → `wabi-rustic` | `African-craft` |
|  |  | choir_isicathamiya: `ngoma` → `austere` | `African-craft` |
| `andalusi_nuba` (Andalusī nūba) | `Turkish-makam-base` (contradicted), `sufi-mystical` (contradicted) | oud: `makam-melismatic` → `inshad-cantillating` | `Turkish-makam-base`, `sufi-mystical` |
|  |  | darbuka: `sufi-mystical` → `kakaki-heralding` | `Turkish-makam-base`, `sufi-mystical` |
|  |  | riq: `yaaburnee` → `makam-melismatic` | `sufi-mystical` |
|  |  | bendir: `tarab` → `sufi-mystical` | `Turkish-makam-base` |
| `arab_tarab` (Tarab (Arab East classical)) | `classical-radif` (boundary), `sufi-mystical` (boundary) | voice: `andalusi-modal` → `tahrir-ornamenting` | `sufi-mystical` |
|  |  | oud: `makam-melismatic` → `mizmar-piping` | `sufi-mystical` |
|  |  | qanun: `mizmar-piping` → `andalusi-modal` | *joint* |
|  |  | riq: `tarab` → `makam-melismatic` | `classical-radif`, `sufi-mystical` |
|  |  | kamancheh: `intercessory` → `smearing` | `classical-radif`, `sufi-mystical` |
|  |  | takht_arab: `sufi-mystical` → `mor-lam-storytelling` | `sufi-mystical` |
| `persian_dastgah` (Persian dastgāh) | `Turkish-makam-base` (contradicted), `sufi-mystical` (boundary) | voice: `andalusi-modal` → `vatic` | `Turkish-makam-base`, `sufi-mystical` |
|  |  | setar_persian: `makam-melismatic` → `kakaki-heralding` | `Turkish-makam-base`, `sufi-mystical` |
|  |  | santur: `kakaki-heralding` → `andalusi-modal` | `Turkish-makam-base`, `sufi-mystical` |
|  |  | kamancheh: `intercessory` → `mizmar-piping` | `sufi-mystical` |
|  |  | tar_frame_drum: `ishq` → `intercessory` | `sufi-mystical` |
| `ghazal` (Ghazal) | `Turkish-makam-base` (boundary) | tabla: `andalusi-modal` → `fana` | `Turkish-makam-base` |
| `thumri` (Thumrī) | `dhrupad-suited` (boundary) | voice: `bandish-locking` → `shamanic` | `dhrupad-suited` |
|  |  | tabla: `shanti` → `bandish-locking` | `dhrupad-suited` |
|  |  | sarangi: `shamanic` → `elevating` | `dhrupad-suited` |
|  |  | tanpura: `tantric` → `raga-melismatic` | `dhrupad-suited` |
| `carnatic_vocal` (Carnatic vocal) | `dhrupad-suited` (contradicted) | voice: `rasa` → `oracular` | `dhrupad-suited` |
|  |  | violin_carnatic: `undulating` → `rasa` | `dhrupad-suited` |
|  |  | tanpura: `overtone` → `circling` | `dhrupad-suited` |
|  |  | ghatam: `bandish-locking` → `raga-melismatic` | `dhrupad-suited` |
|  |  | thavil: `bhava` → `desert` | `dhrupad-suited` |
|  |  | kanjira: `circling` → `gamak` | `dhrupad-suited` |
|  |  | morsing: `hasya` → `bandish-locking` | `dhrupad-suited` |
|  |  | shruti_box: `raga-melismatic` → `bhava` | `dhrupad-suited` |
| `carnatic_instrumental` (Carnatic instrumental) | `dhrupad-suited` (contradicted) | ghatam: `bandish-locking` → `circling` | `dhrupad-suited` |
|  |  | kanjira: `circling` → `raga-melismatic` | `dhrupad-suited` |
|  |  | mandolin: `ganas` → `skiffle-makeshift` | `dhrupad-suited` |
|  |  | saxophone: `overtone` → `gamak` | `dhrupad-suited` |
|  |  | nadaswaram: `raga-melismatic` → `bandish-locking` | `dhrupad-suited` |
| `bhajan` (Bhajan) | `dhrupad-suited` (boundary) | manjira: `tantric` → `circling` | `dhrupad-suited` |
|  |  | shruti_box: `upekkha` → `raga-melismatic` | `dhrupad-suited` |
| `kirtan` (Kīrtan) | `dhrupad-suited` (boundary) | khol: `tantric` → `circling` | `dhrupad-suited` |
|  |  | manjira: `upekkha` → `raga-melismatic` | `dhrupad-suited` |
|  |  | shruti_box: `circling` → `tantric` | `dhrupad-suited` |
| `bhangra_modern` (Bhangra (modern)) | `Hindu-ritual` (boundary), `raga-bound` (boundary) | voice: `bhava` → `two-stepping` | `Hindu-ritual` |
|  |  | dholak: `two-stepping` → `bhava` | `Hindu-ritual` |
| `guqin` (Gǔqín) | `gagaku-foundational` (contradicted) | guqin: `hissing` → `ma-pausing` | `gagaku-foundational` |
| `wenrenyue` (Wenrenyue) | `gagaku-foundational` (contradicted) | guqin: `hissing` → `ma-pausing` | `gagaku-foundational` |
|  |  | xiao: `minority-piping` → `hissing` | `gagaku-foundational` |
|  |  | hulusi: `ma-pausing` → `minority-piping` | `gagaku-foundational` |
|  |  | dizi: `mono-no-aware` → `ambivalent` | `gagaku-foundational` |
| `shakuhachi_honkyoku` (Shakuhachi honkyoku) | `gagaku-foundational` (boundary) | shakuhachi: `entrancing` → `ambivalent` | `gagaku-foundational` |
| `samul_nori` (Samul nori) | `gagaku-foundational` (contradicted) | jing_korean: `wabi-sabi` → `challenging` | `gagaku-foundational` |
|  |  | buk_korean: `challenging` → `funking` | `gagaku-foundational` |
| `dangdut` (Dangdut) | `Hindu-ritual` (core), `raga-bound` (boundary) | dholak: `bhava` → `funking` | `Hindu-ritual`, `raga-bound` |
|  |  | tabla: `funking` → `jaw-dropping` | `Hindu-ritual`, `raga-bound` |
| `bambuco` (Bambuco) | `iberian-celtic` (core) | bandola_andina: `dor` → `maracatu-marching` | `iberian-celtic` |
| `rebetiko` (Rebetiko) | `iberian-celtic` (core) | voice: `meraki` → `sabi-patinated` | `iberian-celtic` |
|  |  | bouzouki: `sabi-patinated` → `tarnished` | `iberian-celtic` |
|  |  | baglamas: `tarnished` → `meraki` | `iberian-celtic` |
| `sevdalinka` (Sevdalinka) | `iberian-celtic` (core), `urban-Greek` (boundary) | brass_band_balkan_romani: `meraki` → `maqam-modal` | `iberian-celtic`, `urban-Greek` |
|  |  | gusle: `maqam-modal` → `mizmar-piping` | `iberian-celtic`, `urban-Greek` |
|  |  | kaval: `mizmar-piping` → `meraki` | `iberian-celtic`, `urban-Greek` |
|  |  | tambura_balkan: `karuna` → `desert` | `iberian-celtic` |
| `tin_pan_alley_song` (Tin Pan Alley song) | `italian` (core) | voice: `spine-melting` → `cajoling` | `italian` |
|  |  | choir_ensemble: `maternal` → `spine-melting` | `italian` |
| `chanson_pop_modern` (Chanson pop (modern)) | `french-musette-ready` (boundary) | grand_piano: `spleen` → `swooning` | `french-musette-ready` |
|  |  | acoustic_guitar_om: `futuristic` → `spleen` | `french-musette-ready` |
| `cantautore_italiano` (Cantautore italiano) | `celtic` (core), `fado-lead` (boundary), `iberian-celtic` (core), `university-fado` (boundary) | voice: `karuna` → `spoken-flowing` | `university-fado` |
|  |  | acoustic_guitar_om: `lamenting` → `skiffle-makeshift` | `celtic`, `fado-lead`, `iberian-celtic`, `university-fado` |
|  |  | drum_kit: `saudade` → `strutting` | `celtic`, `fado-lead`, `iberian-celtic`, `university-fado` |
| `galician_kantautor` (Galician kantautor and folk-pop) | `Irish-traditional` (boundary), `Scottish-influenced` (boundary) | gaita_galega: `hiraeth` → `avuncular` | `Irish-traditional`, `Scottish-influenced` |
| `cumbia_colombiana` (Cumbia colombiana) | `samba-foundation` (core) | tambora_colombiana: `batucada` → `fun` | `samba-foundation` |
|  |  | guiro: `fun` → `skittering` | `samba-foundation` |
|  |  | maracas: `skittering` → `strutting` | `samba-foundation` |
|  |  | tambor_alegre: `strutting` → `piercing` | `samba-foundation` |
| `cumbia_peruvian` (Cumbia peruana (chicha)) | `samba-foundation` (contradicted) | timbales: `batucada` → `fun` | `samba-foundation` |
|  |  | congas: `fun` → `jibaro-pulsing` | `samba-foundation` |
| `vallenato` (Vallenato) | `samba-foundation` (core) | acordeon_vallenato: `funking` → `fun` | `samba-foundation` |
|  |  | caja_vallenata: `batucada` → `funking` | `samba-foundation` |
|  |  | guacharaca: `fun` → `groovy` | `samba-foundation` |
| `joropo` (Joropo) | `samba-foundation` (contradicted) | arpa_llanera: `funking` → `fun` | `samba-foundation` |
|  |  | cuatro_venezolano: `batucada` → `funking` | `samba-foundation` |
|  |  | maracas: `fun` → `groovy` | `samba-foundation` |
|  |  | bandola_llanera: `groovy` → `tropical-rolling` | `samba-foundation` |
| `merengue_dominicano` (Merengue dominicano) | `samba-foundation` (core) | guiro: `batucada` → `fun` | `samba-foundation` |
|  |  | guira_dominicana: `fun` → `strutting` | `samba-foundation` |
| `candombe_uruguayan` (Candombe uruguayo) | `samba-foundation` (boundary) | choir_ensemble: `funking` → `two-stepping` | `samba-foundation` |
|  |  | atabaque: `two-stepping` → `funking` | `samba-foundation` |
|  |  | candombe_tamboriles: `batucada` → `fun` | `samba-foundation` |
| `forro_brasileiro` (Forró brasileiro) | `samba-foundation` (contradicted) | triangulo_forro: `batucada` → `fun` | `samba-foundation` |
|  |  | classical_nylon_string_guitar: `fun` → `skittering` | `samba-foundation` |
| `marinera` (Marinera peruana) | `samba-foundation` (contradicted) | voice: `funking` → `fun` | `samba-foundation` |
|  |  | cajon_peruano: `batucada` → `funking` | `samba-foundation` |
|  |  | choir_ensemble: `fun` → `groovy` | `samba-foundation` |
| `russian_bard_song` (Russian bard song (avtorskaya pesnya)) | `iberian-celtic` (core) | balalaika: `dor` → `pulse-quickening` | `iberian-celtic` |
| `cantorial_khazonus` (Cantorial khazonus (chazzanut)) | `sufi-mystical` (core) | choir_ensemble: `intercessory` → `sabi-patinated` | `sufi-mystical` |
| `bothy_ballad_doric` (Bothy ballad (Doric)) | `Irish-traditional` (boundary), `english-folk` (boundary), `iberian-celtic` (boundary) | voice: `hiraeth` → `taladh-soothing` | `Irish-traditional`, `english-folk`, `iberian-celtic` |
|  |  | melodeon_diatonic: `dor` → `hiraeth` | `Irish-traditional`, `english-folk`, `iberian-celtic` |
| `child_ballad_revival` (Child ballad revival) | `Irish-traditional` (boundary), `iberian-celtic` (boundary) | voice: `hiraeth` → `evangelizing` | *joint* |
|  |  | concert_harp: `dor` → `hiraeth` | `iberian-celtic` |
| `english_broadside_revival` (English broadside ballad) | `Irish-traditional` (boundary), `Scottish-influenced` (boundary), `celtic` (boundary), `iberian-celtic` (boundary) | voice: `hiraeth` → `evangelizing` | `Irish-traditional` |
|  |  | concertina_anglo: `dor` → `hiraeth` | `Irish-traditional`, `celtic` |
| `welsh_hymn_balladry` (Welsh hymn-balladry) | `Irish-traditional` (boundary), `Scottish-influenced` (boundary), `english-folk` (contradicted), `iberian-celtic` (boundary) | concert_harp: `dor` → `conductors` | `iberian-celtic` |
|  |  | choir_welsh_male: `heart-breaking` → `han` | `iberian-celtic` |
|  |  | welsh_triple_harp: `karuna` → `dor` | `iberian-celtic` |
| `cape_breton_milling` (Cape Breton milling-frolic) | `Irish-traditional` (contradicted), `english-folk` (boundary), `iberian-celtic` (boundary) | voice: `hiraeth` → `taladh-soothing` | `Irish-traditional`, `english-folk`, `iberian-celtic` |
| `chanson_classique` (Chanson classique) | `celtic` (core), `fado-lead` (boundary), `iberian-celtic` (core), `university-fado` (boundary) | voice: `karuna` → `spoken-flowing` | *joint* |
|  |  | grand_piano: `saudade` → `stride-trotting` | *joint* |
|  |  | accordion: `lamenting` → `karuna` | `university-fado` |
|  |  | clarinet: `heart-breaking` → `refined` | `celtic`, `fado-lead`, `iberian-celtic`, `university-fado` |
| `fado_coimbra_university` (Fado de Coimbra) | `celtic` (core), `iberian-celtic` (boundary) | voice: `lamenting` → `narrating` | *joint* |
|  |  | guitarra_portuguesa: `heart-breaking` → `lamenting` | *joint* |
| `greek_entechno` (Greek éntechno) | `celtic` (core), `fado-lead` (boundary), `iberian-celtic` (core), `university-fado` (boundary) | voice: `lamenting` → `eye-watering` | `celtic`, `fado-lead`, `iberian-celtic`, `university-fado` |
|  |  | bouzouki: `heart-breaking` → `refined` | `celtic`, `fado-lead`, `iberian-celtic` |
|  |  | classical_nylon_string_guitar: `saudade` → `choro-bantering` | *joint* |
|  |  | string_quartet_inst: `karuna` → `experimental` | *joint* |
| `sacred_harp_singing` (Sacred Harp singing) | `gospel-rooted` (boundary), `sacred-Latin` (core) | choir_brother_duet: `messianic` → `choirmasters` | `gospel-rooted` |
|  |  | pump_organ_harmonium: `penitential` → `harmonizing` | `gospel-rooted` |
|  |  | choir_sacred_harp: `repentant` → `asymmetric-rolling` | `gospel-rooted` |
| `anglican_choral_evensong` (Anglican choral evensong) | `gospel-rooted` (core), `sacred-Latin` (contradicted) | choir_ensemble: `messianic` → `annunciatory` | `gospel-rooted` |
|  |  | voice: `paschal` → `messianic` | `gospel-rooted` |
|  |  | pipe_organ: `annunciatory` → `paschal` | `gospel-rooted` |
| `russian_orthodox_chant` (Russian Orthodox liturgical chant) | `gospel-rooted` (core), `sacred-Latin` (contradicted) | choir_ensemble: `messianic` → `annunciatory` | `gospel-rooted` |
|  |  | voice: `paschal` → `messianic` | `gospel-rooted` |
|  |  | choir_russian_orthodox: `annunciatory` → `paschal` | `gospel-rooted` |
| `khayal` (Khayal (Hindustani classical vocal)) | `dhrupad-suited` (contradicted) | voice: `bandish-locking` → `shamanic` | `dhrupad-suited` |
|  |  | tabla: `shanti` → `bandish-locking` | `dhrupad-suited` |
|  |  | tanpura: `tantric` → `raga-melismatic` | `dhrupad-suited` |
|  |  | sarangi: `shamanic` → `elevating` | `dhrupad-suited` |
| `tappa` (Tappa (Punjabi-origin Hindustani semi-classical)) | `Hindu-ritual` (boundary), `dhrupad-suited` (boundary) | tabla: `shanti` → `raga-melismatic` | `dhrupad-suited` |
|  |  | sarangi: `shamanic` → `elevating` | `Hindu-ritual`, `dhrupad-suited` |
| `dadra` (Dadra (Hindustani semi-classical light-vocal)) | `dhrupad-suited` (boundary) | voice: `rasa` → `oracular` | `dhrupad-suited` |
|  |  | tabla: `bandish-locking` → `raga-melismatic` | `dhrupad-suited` |
| `tarana` (Tarana (Hindustani vocalized-syllable composition)) | `Hindu-ritual` (boundary), `dhrupad-suited` (boundary) | voice: `rasa` → `oracular` | `Hindu-ritual`, `dhrupad-suited` |
|  |  | tanpura: `overtone` → `desert` | `Hindu-ritual`, `dhrupad-suited` |
| `kriti` (Kriti (Carnatic devotional composition)) | `dhrupad-suited` (contradicted) | voice: `bhakti` → `nadryv` | `dhrupad-suited` |
|  |  | violin_carnatic: `rasa` → `shamanic` | `dhrupad-suited` |
| `padam` (Padam (Carnatic slow-tempo lyrical genre)) | `dhrupad-suited` (boundary) | voice: `bhakti` → `nadryv` | `dhrupad-suited` |
|  |  | violin_carnatic: `rasa` → `shamanic` | `dhrupad-suited` |
| `javali` (Javali (Carnatic light-classical love-song)) | `Hindu-ritual` (contradicted), `dhrupad-suited` (boundary) | voice: `shanti` → `nadryv` | `Hindu-ritual`, `dhrupad-suited` |
|  |  | mridangam: `hasya` → `circling` | *joint* |
|  |  | violin_carnatic: `bhakti` → `elevating` | `Hindu-ritual`, `dhrupad-suited` |
| `tillana` (Tillana (Carnatic concert-closer rhythmic showpiece)) | `dhrupad-suited` (boundary) | voice: `bhakti` → `nadryv` | `dhrupad-suited` |
|  |  | violin_carnatic: `rasa` → `shamanic` | `dhrupad-suited` |
| `sikh_gurmat_sangeet` (Gurmat Sangeet (Sikh devotional)) | `Hindu-ritual` (boundary), `dhrupad-suited` (boundary) | voice: `hasya` → `nadryv` | `Hindu-ritual`, `dhrupad-suited` |
|  |  | tabla: `tantric` → `asymmetric-rolling` | `Hindu-ritual`, `dhrupad-suited` |
|  |  | harmonium_indian: `bhakti` → `circling` | *joint* |
|  |  | dilruba: `circling` → `gamak` | *joint* |
| `tropicalia` (Tropicália) | `samba-batería` (boundary), `samba-foundation` (boundary), `samba-foundational` (boundary) | voice: `batucada` → `swinging` | `samba-foundation` |
|  |  | classical_nylon_string_guitar: `funking` → `fun` | `samba-foundation` |
|  |  | berimbau: `swaying` → `funking` | `samba-batería`, `samba-foundation` |
|  |  | cavaquinho: `swinging` → `batucada` | `samba-batería`, `samba-foundation` |
| `maracatu` (Maracatu) | `samba-batería` (boundary), `samba-foundation` (boundary), `samba-foundational` (boundary) | voice: `batucada` → `funking` | `samba-batería`, `samba-foundational` |
|  |  | alfaia: `funking` → `groovy` | `samba-batería`, `samba-foundational` |
|  |  | caxixi: `swaying` → `skittering` | `samba-batería`, `samba-foundation`, `samba-foundational` |
|  |  | agogo: `groovy` → `batucada` | `samba-batería`, `samba-foundation`, `samba-foundational` |
|  |  | choir_ensemble: `skittering` → `two-stepping` | `samba-batería`, `samba-foundation` |
| `frevo` (Frevo) | `samba-foundation` (contradicted), `samba-foundational` (contradicted) | voice: `batucada` → `funking` | `samba-foundational` |
|  |  | trumpet: `funking` → `batucada` | `samba-foundational` |
| `sertanejo` (Sertanejo) | `samba-batería` (boundary), `samba-foundation` (boundary), `samba-foundational` (boundary) | voice: `batucada` → `fun` | `samba-foundational` |
|  |  | classical_nylon_string_guitar: `swaying` → `funking` | `samba-batería`, `samba-foundational` |
|  |  | drum_kit: `funking` → `strutting` | `samba-batería`, `samba-foundation` |
|  |  | viola_caipira: `fun` → `swaying` | `samba-batería` |
| `baiao` (Baião) | `samba-batería` (contradicted), `samba-foundation` (contradicted), `samba-foundational` (contradicted) | voice: `batucada` → `narrating` | `samba-batería`, `samba-foundation`, `samba-foundational` |
|  |  | accordion: `funking` → `klezmer-dancing` | `samba-batería`, `samba-foundation`, `samba-foundational` |
|  |  | zabumba: `swaying` → `funking` | `samba-batería`, `samba-foundation`, `samba-foundational` |
| `embolada` (Embolada) | `samba-batería` (boundary), `samba-foundation` (boundary), `samba-foundational` (boundary) | voice: `batucada` → `two-stepping` | `samba-batería`, `samba-foundation`, `samba-foundational` |
| `jibaro` (Jíbaro) | `iberian-celtic` (boundary) | voice: `coughing` → `string-conversing` | `iberian-celtic` |
|  |  | cuatro_pr: `dor` → `coughing` | `iberian-celtic` |
| `shaabi_egyptian` (Shaabi (Egyptian)) | `Turkish-makam-base` (boundary) | voice: `andalusi-modal` → `broken` | `Turkish-makam-base` |
|  |  | oud: `maqam-modal` → `mizmar-piping` | `Turkish-makam-base` |
|  |  | qanun: `mizmar-piping` → `andalusi-modal` | `Turkish-makam-base` |
|  |  | darbuka: `broken` → `makam-melismatic` | `Turkish-makam-base` |
|  |  | electric_bass: `makam-melismatic` → `prancing` | `Turkish-makam-base` |
| `mahraganat` (Mahraganat (Egyptian)) | `Turkish-makam-base` (boundary) | voice: `andalusi-modal` → `mizmar-piping` | `Turkish-makam-base` |
|  |  | drum_machine_808: `makam-melismatic` → `andalusi-modal` | `Turkish-makam-base` |
|  |  | analog_poly_synth: `maqam-modal` → `makam-melismatic` | `Turkish-makam-base` |
| `chaabi_moroccan` (Chaabi (Moroccan)) | `Turkish-makam-base` (boundary) | voice: `andalusi-modal` → `smearing` | `Turkish-makam-base` |
|  |  | darbuka: `makam-melismatic` → `andalusi-modal` | `Turkish-makam-base` |
| `tarab_egyptian` (Tarab (Egyptian classical)) | `classical-radif` (boundary), `sufi-mystical` (boundary) | voice: `andalusi-modal` → `tahrir-ornamenting` | `sufi-mystical` |
|  |  | oud: `makam-melismatic` → `mizmar-piping` | `sufi-mystical` |
|  |  | qanun: `mizmar-piping` → `andalusi-modal` | *joint* |
|  |  | ney: `maqam-modal` → `makam-melismatic` | `sufi-mystical` |
|  |  | takht_arab: `tarab` → `maqam-modal` | `classical-radif`, `sufi-mystical` |
|  |  | kanun: `sufi-mystical` → `inshad-cantillating` | `classical-radif`, `sufi-mystical` |
| `mizrahi_israeli` (Mizrahi (Israeli)) | `Turkish-makam-base` (boundary) | voice: `andalusi-modal` → `smearing` | `Turkish-makam-base` |
|  |  | darbuka: `makam-melismatic` → `andalusi-modal` | `Turkish-makam-base` |
|  |  | electric_bass: `maqam-modal` → `marrow-deep` | `Turkish-makam-base` |
| `persian_pop_los_angeles` (Tehrangeles Persian pop) | `Turkish-makam-base` (boundary) | voice: `andalusi-modal` → `embellished` | `Turkish-makam-base` |
|  |  | analog_poly_synth: `makam-melismatic` → `analog` | `Turkish-makam-base` |
| `lebanese_pop_tarab` (Lebanese tarab-pop) | `Turkish-makam-base` (boundary) | voice: `andalusi-modal` → `smearing` | `Turkish-makam-base` |
|  |  | oud: `maqam-modal` → `mizmar-piping` | `Turkish-makam-base` |
|  |  | qanun: `mizmar-piping` → `andalusi-modal` | `Turkish-makam-base` |
|  |  | electric_guitar_single_coil: `makam-melismatic` → `happy` | `Turkish-makam-base` |
|  |  | analog_poly_synth: `smearing` → `makam-melismatic` | `Turkish-makam-base` |
|  |  | drum_kit: `bodacious` → `maqam-modal` | `Turkish-makam-base` |
| `malhun_maghrebi` (Malhun (Maghrebi)) | `classical-radif` (boundary) | darbuka: `tarab` → `sufi-mystical` | `classical-radif` |
| `iraqi_maqam` (Iraqi maqam (al-Maqam al-Iraqi)) | `classical-radif` (boundary), `sufi-mystical` (boundary) | santur: `tarab` → `mor-lam-storytelling` | `classical-radif` |
|  |  | qanun: `intercessory` → `inshad-cantillating` | `sufi-mystical` |
|  |  | riq: `yaaburnee` → `intercessory` | `sufi-mystical` |
|  |  | joza: `andalusi-modal` → `tarab` | `sufi-mystical` |
|  |  | naqqarat: `devotional` → `yaaburnee` | `sufi-mystical` |
| `historical_informed_performance` (Historically-informed performance recording) | `sacred-Latin` (boundary) | portative_organ: `annunciatory` → `devoted` | `sacred-Latin` |
|  |  | viola_da_gamba: `doxological` → `annunciatory` | `sacred-Latin` |
|  |  | recorder: `paschal` → `doxological` | `sacred-Latin` |
|  |  | lute_renaissance: `theophanic` → `paschal` | `sacred-Latin` |
|  |  | shawm: `pious` → `theophanic` | `sacred-Latin` |
|  |  | crumhorn: `devoted` → `pious` | `sacred-Latin` |
| `chinese_traditional_ensemble` (Chinese conservatory traditional ensemble (民乐 minyue)) | `gagaku-foundational` (boundary) | erhu: `minority-piping` → `mind-numbing` | `gagaku-foundational` |
|  |  | pipa: `mind-numbing` → `minority-piping` | `gagaku-foundational` |
|  |  | hulusi: `mono-no-aware` → `wu-wei` | `gagaku-foundational` |
|  |  | xun: `wabi-sabi` → `vast` | `gagaku-foundational` |
| `bengali_baul` (Bengali baul (mystic-itinerant song)) | `raga-bound` (boundary) | ektara: `rasa` → `elevating` | `raga-bound` |
|  |  | khamak: `bhakti` → `mystified` | `raga-bound` |
| `finnish_kantele_folk` (Finnish kantele folk and Kalevala-recitation) | `Irish-traditional` (core), `Scottish-influenced` (core), `celtic` (core), `english-folk` (core), `iberian-celtic` (core) | voice: `hiraeth` → `spoken-flowing` | *joint* |
| `swedish_nyckelharpa_folk` (Swedish nyckelharpa folk) | `Irish-traditional` (core), `Scottish-influenced` (boundary), `celtic` (core), `english-folk` (core), `iberian-celtic` (core) | voice: `hiraeth` → `nordic-droning` | `Irish-traditional`, `Scottish-influenced`, `celtic`, `english-folk`, `iberian-celtic` |
|  |  | nyckelharpa: `nordic-droning` → `alap-unfolding` | `Irish-traditional`, `Scottish-influenced`, `celtic`, `english-folk`, `iberian-celtic` |
| `hungarian_cimbalom_trad` (Hungarian cimbalom (verbunkos and nóta)) | `sufi-mystical` (core) | voice: `intercessory` → `oracular` | `sufi-mystical` |
|  |  | upright_bass: `devotional` → `avuncular` | `sufi-mystical` |
| `breton_folk` (Breton folk (kan ha diskan, fest-noz)) | `Irish-traditional` (contradicted), `english-folk` (boundary), `iberian-celtic` (boundary) | bombarde: `dor` → `street-pulsing` | `iberian-celtic` |
| `italian_southern_folk` (Italian southern folk (tarantella, pizzica)) | `Turkish-makam-base` (core), `iberian-celtic` (core), `urban-Greek` (boundary) | voice: `meraki` → `embellished` | `Turkish-makam-base`, `iberian-celtic`, `urban-Greek` |
|  |  | ciaramella: `makam-melismatic` → `flamboyant` | `Turkish-makam-base`, `iberian-celtic`, `urban-Greek` |
|  |  | tammorra: `maqam-modal` → `makam-melismatic` | `Turkish-makam-base`, `iberian-celtic`, `urban-Greek` |
| `armenian_traditional` (Armenian liturgical and folk) | `Turkish-makam-base` (contradicted), `sufi-mystical` (contradicted) | voice: `andalusi-modal` → `vatic` | `Turkish-makam-base`, `sufi-mystical` |
|  |  | duduk: `makam-melismatic` → `kakaki-heralding` | `Turkish-makam-base`, `sufi-mystical` |
|  |  | kanun: `tarab` → `andalusi-modal` | `Turkish-makam-base`, `sufi-mystical` |
| `turkish_romani_cumbus` (Turkish-Romani çümbüş music) | `classical-radif` (boundary), `sufi-mystical` (boundary) | voice: `tarab` → `embellished` | `classical-radif`, `sufi-mystical` |
|  |  | darbuka: `yaaburnee` → `tarab` | `classical-radif`, `sufi-mystical` |
|  |  | clarinet: `intercessory` → `mor-lam-storytelling` | `sufi-mystical` |

Pairs removed on a changed entry whose removal alone moves no label: 28 (they are removed for being false, and the label happens not to depend on them).

### Preface regression fixtures re-blessed

`tests/_preface_regression_fixtures.json` pins 79 (tradition, instrument) preface picks. Five moved, each to the value `scripts/regression_prefaces.js` reported, and each traced by removing one pair at a time on the base commit:

| fixture | before → after | responsible pair(s) |
|---|---|---|
| `andalusi_nuba` / rebab | `andalusi-modal` → `kakaki-heralding` | *joint*: `Turkish-makam-base` + `sufi-mystical` (both contradicted); neither alone moves it |
| `anglican_choral_evensong` / pipe_organ | `messianic` → `annunciatory` | `gospel-rooted` (core) |
| `anglican_choral_evensong` / choir_cathedral_satb | `messianic` → `annunciatory` | `gospel-rooted` (core) |
| `anglican_choral_evensong` / choir_ensemble | `messianic` → `annunciatory` | `gospel-rooted` (core) |
| `bhajan` / harmonium_indian | `shanti` → `circling` | `dhrupad-suited` (boundary) |

## Follow-ups for the owner (not done here)

### New labels named for another culture

Removing a false pair does not choose the new label; the preface matcher does, from the words the card has left. 33 card labels now land on a preface that is new to the entry and whose own id or note names a culture or tradition the entry's prose does not claim. These come from the preface lexicon's token lists (mostly style words such as `court-ceremonial`, `devotional`, `ritual`), not from the signature table, so this pass does not gate them. Hand-reviewed from each preface's id and note; not exhaustive.

| entry | card | label now | the label names | was |
|---|---|---|---|---|
| `swedish_nyckelharpa_folk` | nyckelharpa | `alap-unfolding` | slow exposition of a raga | `nordic-droning` |
| `sacred_harp_singing` | choir_sacred_harp | `asymmetric-rolling` | Korean janggu pattern | `repentant` |
| `sikh_gurmat_sangeet` | tabla | `asymmetric-rolling` | Korean janggu pattern | `tantric` |
| `sikh_gurmat_sangeet` | dilruba | `gamak` | Carnatic-style oscillating ornament | `circling` |
| `morna` | classical_nylon_string_guitar | `choro-bantering` | id names Brazilian choro | `saudade` |
| `greek_entechno` | classical_nylon_string_guitar | `choro-bantering` | id names Brazilian choro | `saudade` |
| `welsh_hymn_balladry` | choir_welsh_male | `han` | Korean concept of unresolved sorrow — pansori voice | `heart-breaking` |
| `cumbia_peruvian` | congas | `jibaro-pulsing` | id names Puerto Rican jíbaro | `fun` |
| `andalusi_nuba` | darbuka | `kakaki-heralding` | Hausa-Fulani court long-trumpet | `sufi-mystical` |
| `armenian_traditional` | duduk | `kakaki-heralding` | Hausa-Fulani court long-trumpet | `makam-melismatic` |
| `baiao` | accordion | `klezmer-dancing` | id names klezmer | `funking` |
| `guqin` | guqin | `ma-pausing` | Japanese aesthetic of the gap | `hissing` |
| `bambuco` | bandola_andina | `maracatu-marching` | Pernambuco rural carnival | `dor` |
| `arab_tarab` | takht_arab | `mor-lam-storytelling` | Lao-Isan storytelling singing | `sufi-mystical` |
| `iraqi_maqam` | santur | `mor-lam-storytelling` | Lao-Isan storytelling singing | `tarab` |
| `turkish_romani_cumbus` | clarinet | `mor-lam-storytelling` | Lao-Isan storytelling singing | `intercessory` |
| `kriti` | voice | `nadryv` | Russian word (надрыв); no note | `bhakti` |
| `padam` | voice | `nadryv` | Russian word (надрыв); no note | `bhakti` |
| `javali` | voice | `nadryv` | Russian word (надрыв); no note | `shanti` |
| `tillana` | voice | `nadryv` | Russian word (надрыв); no note | `bhakti` |
| `sikh_gurmat_sangeet` | voice | `nadryv` | Russian word (надрыв); no note | `hasya` |
| `beijing_opera` | erhu | `piphat-rolling` | Thai piphat ensemble | `minority-piping` |
| `cantorial_khazonus` | choir_ensemble | `sabi-patinated` | koto or shakuhachi line | `intercessory` |
| `arab_tarab` | voice | `tahrir-ornamenting` | Persian dastgah vocal | `andalusi-modal` |
| `tarab_egyptian` | voice | `tahrir-ornamenting` | Persian dastgah vocal | `andalusi-modal` |
| `bothy_ballad_doric` | voice | `taladh-soothing` | Scottish Gaelic … Hebridean vocal style (the record is Doric Scots) | `hiraeth` |
| `carnatic_vocal` | thavil | `desert` | Saharan modal-cycling register | `bhava` |
| `sevdalinka` | tambura_balkan | `desert` | Saharan modal-cycling register | `karuna` |
| `tarana` | tanpura | `desert` | Saharan modal-cycling register | `overtone` |
| `persian_dastgah` | kamancheh | `mizmar-piping` | id names the Arab mizmar | `intercessory` |
| `isicathamiya` | choir_southern_black_gospel | `wabi-rustic` | id names Japanese wabi | `balafon-pattering` |
| `andalusi_nuba` | oud | `inshad-cantillating` | Islamic devotional inshad (the record: "absence of dhikr framing") | `makam-melismatic` |
| `tarab_egyptian` | kanun | `inshad-cantillating` | Islamic devotional inshad (the record is secular) | `sufi-mystical` |

One more, moved rather than new: `andalusi_nuba` still renders a `sufi-mystical` preface, now on bendir (it was on darbuka), from other words on the card, although the record says it is "distinguished from Sufi sama by court-classical context and absence of dhikr framing". The gate reads the signature table and its copies, not preface labels, which is why the promise says "any copy of it the product publishes" and not more.

### Readings the owner may want to revisit

- `gospel-rooted` is ruled in its gloss's sense, descent from Black-church or Southern Protestant church song. Under a stricter Black-church-descent reading, `southern_gospel` and `southern_gospel_quartet` (attested; both records distinguish themselves from Black gospel) would be false:contradicted. Under a strict genre reading (gospel proper), `spirituals_african_american` and `jubilee_quartet` (loose, kept on the Black-church umbrella) would be false:contradicted, because both records make gospel their descendant. The rulings carry `flag` fields naming these readings.
- `iberian-celtic` is ruled as the compound its gloss states (Iberian + Celtic, e.g. Galicia and Asturias), so one half alone does not attest it. Under an Iberian-OR-Celtic reading, several boundary pairs (fado, celtic_irish_trad, breton_folk, welsh_hymn_balladry and others) would be loose.
- Four pairs are false on the prose but plausible from outside knowledge (`flag: prose-silent-world-plausible`): `persian_dastgah` / `sufi-mystical`, `sikh_gurmat_sangeet` / `dhrupad-suited`, `historical_informed_performance` / `sacred-Latin`, `string_quartet` / `cremonese-pre-1750`. The alternative fix is to state the link in the record's prose and re-rule the pair. The same holds for `sardinian_polyphony` / `sacred-Latin` (the cuncordu Holy-Week Latin repertoire).

### Configuration the prose does not support

Many false tokens trace to a record's own instrument picks, which this pass does not change:

- `voice_tradition` pinned to `persian_dastgah_tradition` on `arab_tarab`, `tarab_egyptian`, `malhun_maghrebi` and `iraqi_maqam` (an `arabic_maqam_tradition` variant exists); `kamancheh_use` pinned to `kamancheh_dastgah` on `arab_tarab`.
- `voice_tradition` pinned to `hindustani_dhrupad_tradition` on `bhajan`, `kirtan` and `sikh_gurmat_sangeet`; `voice_microtone` `shruti_inflected` on `bhangra_modern`.
- `ney_lineage` pinned to `ney_sufi_mevlevi` on `arab_tarab` and `tarab_egyptian`.
- `pandeiro_context` pinned to `pandeiro_samba` on `embolada`.
- `fado`'s voice pins the Connemara sean-nós ornament catalog, and its tuning (shared with `basque_kantautor`) is the minority-language kantautor tuning; `basque_kantautor` configures a Galician gaita its prose distinguishes it from.

### Taxonomy

- `finnish_kantele_folk` and `swedish_nyckelharpa_folk` sit under `balladPoetry.celticBalladic`, whose own description enumerates only Irish, Scottish, English, Welsh, Cape Breton and Newfoundland traditions; the placement is likely where their Celtic and British tokens came from.
- `sikh_gurmat_sangeet`'s parent is `ritualDevotional.hindu`, whose membership (kirtan, bhajan, abhang, dhrupad-bhakti, Tamil Saiva, ārtī, Vedic chant) does not include Sikh music.

### Other Phase 1 items of the August plan, still open

- The nine signature keys that name no tradition (`mariachi_traditional`, `jingju`, `mongolian_xoomii`, `tibetan_gyuto`, `kompa_song_form`, `kizomba_song_form`, `coptic_liturgical`, `melodic_death_swedish`, `norwegian_2nd_wave_black`) are untouched and reported as advisory by the gate; reconciling them (and recovering `tibetan_gyuto`'s and `mongolian_xoomii`'s tokens for the live entries) is separate work. Their three orphan-only tokens are not classed.
- `MISSING_PARENT` in `scripts/validate.js`, fonts, egress, contrast, the app size budget and the publish manifest.

### Style pairs

This pass fixes **cultural** attributions only. The `style` class of
`references/_soundword_vocab.json` (57 tokens: genre / idiom descriptors, Western art-music periods and
training, generic function words, species-only materials, one gear lineage) is **recorded but not ruled and
not gated**, and no style pair is deleted here. This list is for the owner. It collects the style pairs whose
tradition's own catalog prose (name, lineage and description in `api/browse.json`) plainly contradicts them
or gives no link to them. It does not rule every style pair.

- 101 pairs across 74 entries and 25 tokens, out of 774 style-class pairs on in-catalog keys.
- **contradicted** (52): the prose excludes the claim or dates the tradition before the idiom existed. Each row quotes that prose verbatim.
- **no link** (49): the prose places the tradition somewhere else and never names the idiom or function. Each row quotes the context.
- The reference dates for the idioms come from the catalog's own records: funk, "Funk (codified 1965-1971" (`funk`), and folk rock, "codified mid-1965 through 1972" (`folk_rock`).
- Every quote below is a verbatim substring of that tradition's prose, and every pair is present in `references/_tradition_signatures.json` (both re-checked when this page was written; no style pair is changed by this pass).

**Deliberately left out:**
- Affordance words (`jazz-friendly`, `dub-friendly`, `funk-friendly`, `gospel-friendly`) say a sound suits an idiom. They do not claim a lineage.
- Feel adjectives (`funky`, `bluesy`, `romantic`).
- Pairs the prose supports even loosely, for example `funk-derived` on the hip-hop keys (breakbeat and P-funk sampling), `jazz-influenced` on lofi_hiphop and vaporwave (jazz samples), and `court-ceremonial` on byzantine_chant, klezmer and hasidic_niggun (their records name a court).
- Cultural-class pairs noticed while re-classing, such as `gospel-rooted` on black_metal, byzantine_chant, russian_orthodox_chant, anglican_choral_evensong and sacred_harp_singing, or `African-derived` / `African-traditional` on inuit_katajjaq and powwow. These are cultural and are ruled in `references/_signature_rulings.json`.

### Genre / idiom descriptors

| token(s) | tradition | verdict | own prose (verbatim) | why |
|---|---|---|---|---|
| `gospel-runs` | `black_metal` (Black metal) | contradicted | "anti-Christian thematic vocabulary" | Black-church vocal idiom on a genre the record defines by anti-Christian polemic; no gospel contact anywhere in the prose. |
| `blues-shouter` | `black_metal` (Black metal) | contradicted | "shrieked or rasped vocal delivery far above conversational pitch" | Record fixes the vocal as a treble shriek; no blues link in the prose. |
| `jazz-influenced` | `gagaku` (Gagaku) | contradicted | "codified during the Nara and Heian periods (eighth through twelfth centuries CE)" … "Distinguished from later Japanese folk and popular musics by court-classical preservation lineage" | Court repertoire codified a millennium before jazz and defined by continuous preservation. |
| `jazz-influenced` | `rumba_yambu` (Yambú) | contradicted | "Slow-tempo Cuban rumba subform 1850s-onward" … "The repertoire preserves the oldest pre-conga rumba percussion vocabulary" | Pre-jazz cajón rumba whose record stresses preservation of the oldest vocabulary. |
| `jazz-influenced` | `guaguanco` (Guaguancó) | contradicted | "codified 1880s-onward in Havana-and-Matanzas Afro-Cuban barrios" … "distinguished from later salsa by acoustic-percussion-only ensemble" | Pre-jazz, percussion-and-voice-only form; the record separates it from the later band idioms. |
| `jazz-influenced` | `rumba_columbia` (Columbia) | contradicted | "Fast-tempo Cuban rumba subform 1880s-onward" | Pre-jazz Afro-Cuban drum-and-voice form; no jazz contact in the prose. |
| `jazz-influenced` | `danzon` (Danzón) | contradicted | "codified 1879-onward in Matanzas-and-Havana" | Codified decades before jazz; record traces it to contradanza and names no jazz contact. |
| `jazz-influenced` | `rumba_cubana` (Rumba cubana) | no link | "Afro-Cuban secular drum-and-vocal folkloric tradition" | Umbrella for yambú / guaguancó / columbia (above); no jazz in the prose. |
| `funk-derived` | `son_cubano` (Son cubano) | contradicted | "late-19th-century" | Funk is codified 1965 on (the funk record: "Funk (codified 1965-1971"); son predates it by ~70 years and is named as the template for later Latin music, not a descendant. |
| `funk-derived` | `mambo` (Mambo) | contradicted | "pre-1965 timestamp" | The record itself dates mambo before funk existed. |
| `funk-derived` | `cha_cha_cha` (Cha-cha-chá) | contradicted | "invented 1953-onward in Havana" | Predates funk (1965). |
| `funk-derived` | `danzon` (Danzón) | contradicted | "codified 1879-onward in Matanzas-and-Havana" | Predates funk by ~85 years. |
| `funk-derived` | `charanga` (Charanga) | contradicted | "codified into the canonical charanga-francesa instrumentation by 1930s" | Predates funk (1965); lineage given is danzón, son, mambo. |
| `funk-derived` | `rumba_yambu` (Yambú) | contradicted | "Slow-tempo Cuban rumba subform 1850s-onward" | Predates funk by a century. |
| `funk-derived` | `guaguanco` (Guaguancó) | contradicted | "codified 1880s-onward in Havana-and-Matanzas Afro-Cuban barrios" | Predates funk. |
| `funk-derived` | `rumba_columbia` (Columbia) | contradicted | "Fast-tempo Cuban rumba subform 1880s-onward" | Predates funk. |
| `funk-derived` | `rumba_cubana` (Rumba cubana) | no link | "Afro-Cuban secular drum-and-vocal folkloric tradition" | Umbrella of three 19th-century subforms; no funk in the prose. |
| `funk-derived` | `guaracha` (Guaracha) | no link | "sibling form to son with faster tempo and looser narrative structure" | Son-family song form; no funk in the prose. |
| `funk-derived` | `tropical_bolero` (Bolero (tropical romantic)) | contradicted | "the first bolero Tristezas by José Pepe Sánchez 1883" | Predates funk by ~80 years. |
| `funk-derived` | `merengue_dominicano` (Merengue dominicano) | contradicted | "national-couple-dance and rhythm 1850s-origin" | Predates funk; later brass layer is credited to Cuban mambo, not funk. |
| `funk-derived` | `vallenato` (Vallenato) | contradicted | "codified 1940s-onward in Valledupar" | Predates funk; lineage given is 19th-century troubadour song. |
| `funk-derived` | `marinera` (Marinera peruana) | contradicted | "codified 1893 onward" | Predates funk. |
| `funk-derived` | `candombe_uruguayan` (Candombe uruguayo) | contradicted | "traced to 18th-century African slave processions through Montevideo" | Predates funk by two centuries. |
| `funk-derived` | `joropo` (Joropo) | contradicted | "codified 19th century in the Venezuelan-and-Colombian llanos plains region" | Predates funk. |
| `funk-derived` | `cumbia_colombiana` (Cumbia colombiana) | contradicted | "originating mid-17th-century onward in Cartagena-and-Barranquilla" | Predates funk by three centuries. |
| `funk-derived` | `kompa` (Kompa) | contradicted | "invented in 1955 by Nemours Jean-Baptiste" | Predates funk (1965). |
| `funk-derived` | `forro_brasileiro` (Forró brasileiro) | contradicted | "Codified mid-20th-century" | Predates funk; the 1990s electronic variant is the record's only later layer and it names no funk. |
| `funk-derived` | `bachata` (Bachata) | contradicted | "Bachata (1962 onward" … "1960s-foundational (acoustic-guitar bolero-rural-rhythm)" | Founded as acoustic-guitar bolero before funk; the record gives bolero, not funk, as parent. |
| `folk-rock` | `pre_commercial_country` (Pre-commercial country roots) | contradicted | "distinguished from old-time as defined post-bluegrass by pre-1945 timestamp" | Folk rock is codified mid-1965 (the folk_rock record: "codified mid-1965 through 1972"); this tradition is pre-1945. |
| `folk-rock` | `western_swing` (Western swing) | contradicted | "codified 1934-1955" | Ends a decade before folk rock begins. |
| `folk-rock` | `honky_tonk` (Honky-tonk) | contradicted | "dominated commercial country from 1945-1955" | Predates folk rock (1965). |
| `folk-rock` | `early_rock_and_roll_50s` (Early rock-and-roll (1954–1958)) | contradicted | "recordings from 1954 through 1958 inhabit this transitional position" | Window closes seven years before folk rock. |
| `folk-rock` | `rockabilly_50s` (Rockabilly) | contradicted | "All Right Mama 1954 (the founding rockabilly recording)" | Mid-1950s genre; predates folk rock. |
| `folk-rock` | `surf_rock` (Surf rock) | contradicted | "brief golden era 1962-1964 before the British-Invasion eclipse of late 1964" | Golden era ends before folk rock is codified (mid-1965). |
| `metal-context` | `industrial` (Industrial) | contradicted | "distinguished from industrial-metal (later subgenre) by absence of metal-derived guitar foundation" | The record explicitly excludes the metal foundation. |
| `metal-context` | `noise_music` (Noise music) | no link | "the Japanese Noise (Japanoise) and American/UK industrial-noise lineages" | Lineage given is Futurism / Japanoise / industrial noise; no metal. |
| `blues-derived` | `field_holler_solo` (Field holler) | contradicted | "predating recorded blues" … "became foundational to delta blues" | An ancestor of the blues, not a derivative. |
| `blues-derived` | `work_songs_hollers` (Field hollers and work songs) | contradicted | "Distinguished from later electric-blues by acoustic-non-instrumental form and pre-commercial-recording-era origin" | Record places it before the blues. |
| `blues-derived` | `parchman_prison_song` (Parchman prison work song) | contradicted | "distinguished from later commercial blues by absence of instrumental accompaniment" … "field-holler-derived melismatic ornamentation" | Record derives it from field hollers and sets it before commercial blues. |
| `blues-shouter` | `talking_blues_dustbowl` (Talking blues) | contradicted | "Distinguished from straight blues by spoken-not-sung delivery" | A spoken form; the shouter vocal idiom is excluded by the record. |
| `blues-shouter` | `piedmont_fingerpicking` (Piedmont fingerpicking blues) | contradicted | "intimate vocal-and-guitar duo or solo-performer format" | Record frames it as the lighter, intimate counterpart to harder-edged Delta blues. |
| `gospel-runs` | `byzantine_chant` (Byzantine chant) | no link | "the Eastern Orthodox liturgical chant tradition" | Orthodox psaltic chant; no gospel contact. (Its cultural token gospel-rooted is ruled in `references/_signature_rulings.json`.) |
| `gospel-runs` | `russian_orthodox_chant` (Russian Orthodox liturgical chant) | no link | "Russian Orthodox liturgical chant tradition codified across the medieval-Kievan and Muscovite periods" | Orthodox choral chant; no gospel contact. |
| `gospel-runs` | `anglican_choral_evensong` (Anglican choral evensong) | no link | "Church of England" | Anglican cathedral choir psalmody; no gospel contact. |
| `gospel-runs` | `sacred_harp_singing` (Sacred Harp singing) | no link | "Southern-US shape-note congregational hymn-singing tradition" | Shape-note hymnody; nothing about gospel vocal runs. |
| `marching-bateria` | `gothic_rock` (Gothic rock) | no link | "drum-machine-or-live-drums with prominent reverb-treated snare backbeat" | Kit or drum machine; no marching drum section. |
| `marching-bateria` | `doom` (Doom metal) | no link | "tempos pushed down to 60-80 BPM" | Rock-kit doom; no marching drum section anywhere in the prose. |
| `conga-influenced` | `aleke` (Aleke (Guianese Maroon popular music)) | no link | "This seed selects the later three-tall-drum configuration with a bass-drum/cymbal part and singing" | Maroon tall drums; no Afro-Cuban conga contact in the prose. |
| `jazz`, `rock`, `rock-context` | `salegy` (Salegy (northern Madagascar)) | no link | "Northern Malagasy dance music with an electric rhythm section and overlapping vocal responses" | Record gives no jazz or rock link. |
| `jazz`, `rock`, `rock-context` | `tsapiky` (Tsapiky / tsapika (southwestern Madagascar)) | no link | "Southwestern Malagasy dance music centered here on a fast electric-guitar band" | An electric-guitar band is not a jazz or rock lineage; the record names neither. |
| `rock-context` | `free_improvisation` (Free improvisation (non-idiomatic)) | no link | "genre-disavowal posture" | Non-idiomatic improvisation; no rock link. |
| `rock-context` | `electroacoustic_improv` (Electroacoustic improvisation) | no link | "laptops, prepared electric instruments, and modular electronics as primary sound sources" | Electronics-led improvisation; no rock link. |
| `classical-jazz` | `minimalist` (Minimalist) | no link | "American art-music movement characterized by repetitive cells" | Art-music minimalism; no jazz in the prose. |

### Western art-music period / training

| token(s) | tradition | verdict | own prose (verbatim) | why |
|---|---|---|---|---|
| `medieval` | `baroque_period` (Baroque period-instrument) | contradicted | "1600-1750 European art-music period" … "Distinguished from Renaissance polyphony by figured-bass texture" | The record dates it after the Renaissance. |
| `medieval` | `shape_note` (Shape-note singing (fasola tradition)) | contradicted | "The Easy Instructor (1801)" | An 1801-onward American singing-school practice. |
| `medieval` | `sacred_harp_singing` (Sacred Harp singing) | contradicted | "compiled by B.F. White and E.J. King 1844" | An 1844-onward tunebook tradition. |
| `baroque-leaning` | `british_brass_band` (British brass band (Northern English)) | contradicted | "formalized 1850s onward through industrial-mill-and-mining-village ensembles" | A Victorian industrial tradition; no Baroque link. |
| `period-performance` | `celtic_irish_trad` (Irish trad session) | no link | "Irish traditional session music (codified from 1950s onward through Comhaltas Ceoltóirí Éireann revival)" | Historically-informed performance is a classical early-music movement; the session record never mentions it. |
| `classical`, `classical-trained` | `hiragasy` (Hiragasy (Malagasy highland performance)) | no link | "Malagasy highland performance combining song, oratory and dance" | Troupe performance; no Western art-music training in the prose. |
| `classical-trained` | `maltese_ghana` (Għana (Maltese improvised song)) | no link | "This seed selects an improvised exchange between two singers" | Improvised folk song duel; no conservatory training in the prose. |
| `late-Romantic-onward` | `scandi_pop` (Scandi pop) | no link | "Nordic mainstream pop production school codified through Stockholm-based Cheiron Studios" | 1990s pop production school; no late-Romantic lineage. |

### Generic function words

| token(s) | tradition | verdict | own prose (verbatim) | why |
|---|---|---|---|---|
| `liturgical` | `gothic_rock` (Gothic rock) | contradicted | "melancholic-and-occult-and-apocalyptic lyric content" | Secular rock with occult lyrics; no liturgy. |
| `sacred-traditional`, `ceremonial` | `inuit_katajjaq` (Katajjaq (Inuit throat-singing game)) | contradicted | "the katajjaq is performed as a vocal-game-and-competition between two women face-to-face" | A game between two women, not a sacred or ceremonial rite (the record adds it was missionary-suppressed). |
| `liturgical` | `shape_note` (Shape-note singing (fasola tradition)) | contradicted | "It differs from choral church music in having no audience" | A singing-school practice the record sets apart from church music. |
| `devotional`, `sacred-traditional` | `hindustani_sarod` (Hindustani classical (sarod-led)) | contradicted | "distinguished from the rudra Dhrupad branch by faster tempo elaboration and concert-not-temple framing" | The record says concert, not temple. |
| `devotional`, `sacred-traditional` | `javali` (Javali (Carnatic light-classical love-song)) | contradicted | "explicit rather than sublimated in religious framing" … "overtly erotic and worldly themes" | Record calls it an erotic, worldly love-song, explicitly not religious. |
| `devotional`, `sacred-traditional` | `tappa` (Tappa (Punjabi-origin Hindustani semi-classical)) | no link | "derived from Punjabi camel-drivers’ songs" | Record gives a secular folk-song origin and no devotional function. |
| `devotional` | `klezmer` (Klezmer) | no link | "wedding-band tradition that was the central popular-celebratory music" | Record defines it as celebratory wedding music. |
| `devotional`, `court-ceremonial` | `turkish_romani_cumbus` (Turkish-Romani çümbüş music) | no link | "Anatolian-Romani urban entertainment tradition" | Wedding / tavern entertainment; neither devotional nor court. |
| `devotional`, `court-ceremonial` | `hungarian_cimbalom_trad` (Hungarian cimbalom (verbunkos and nóta)) | no link | "Hungarian-Romani (cigány) urban-restaurant ensemble tradition" | Restaurant ensemble; neither devotional nor court. |
| `devotional`, `ceremonial` | `garifuna_paranda` (Paranda (Garifuna)) | contradicted | "individual-singer-and-guitarist solo presentation rather than ensemble drum-and-chorus context" … "Romantic and reflective lyric register" | Record sets paranda apart from the ceremonial drum context (that is punta). |
| `devotional`, `sacred-traditional`, `liturgical`, `ceremonial` | `historical_informed_performance` (Historically-informed performance recording) | no link | "Recording tradition rooted in the historically-informed-performance (HIP) movement" … "appropriate period-or-period-suitable acoustic spaces (parish churches, palace chapels)" | A performance-practice movement; churches appear only as recording rooms. |
| `congregation-loud` | `anglican_choral_evensong` (Anglican choral evensong) | contradicted | "congregation participates only in the Lord's Prayer and creed" | The record says the congregation mostly does not sing. |
| `congregation-loud` | `jump_blues` (Jump blues) | no link | "urban-combo swing-derived dance music bridging swing-era big-bands and rhythm-and-blues" | Dance-hall combo music; no congregation. |
| `court-ceremonial` | `qawwali` (Qawwali) | no link | "ceremonial performance contexts at Sufi shrines (dargahs)" | Shrine, not court. |
| `court-ceremonial` | `sufi_sama` (Sufi sama (Indian-subcontinental Sufi devotional ceremony)) | no link | "performed at dargah (Sufi shrine) settings" | Shrine, not court. |
| `court-ceremonial` | `cantorial_khazonus` (Cantorial khazonus (chazzanut)) | no link | "Ashkenazi Jewish synagogue cantorial tradition" | Synagogue, not court. |
| `court-ceremonial` | `sephardi_bakkashot` (Sephardi bakkashot) | no link | "unaccompanied vocal performance in synagogue contexts" | Synagogue, not court. |
| `court-ceremonial` | `yemenite_torah_cantillation` (Yemenite Torah cantillation) | no link | "Yemenite Jewish liturgical recitation of the Pentateuch" | Synagogue reading, not court. |
| `court-ceremonial` | `athan_call_prayer` (Athān (Islamic call to prayer)) | no link | "broadcast five times daily from mosque minarets" | Mosque call to prayer, not court. |
| `court-ceremonial` | `quranic_recitation_tajweed` (Qur'anic recitation (tajwīd)) | no link | "Islamic scriptural recitation tradition" | Scriptural recitation; no court in the prose. |
| `court-ceremonial` | `naat_devotional` (Naʿat (Islamic devotional song)) | no link | "private home and mosque gatherings" | Home / mosque / procession, not court. |
| `court-ceremonial` | `islamic_anasheed` (Anāshīd (Islamic vocal-only devotional)) | no link | "Islamic instrument-free devotional vocal tradition" | Devotional song, recorded canon from 2003; no court. |
| `court-ceremonial` | `malhun_maghrebi` (Malhun (Maghrebi)) | no link | "Fez and Meknes urban poetic circles" | Urban poetic circles, not court. |
| `court-ceremonial` | `russian_orthodox_chant` (Russian Orthodox liturgical chant) | no link | "Russian Orthodox parish-and-monastic-foundation network" | Parish and monastery, not court. |
| `court-ceremonial` | `anglican_choral_evensong` (Anglican choral evensong) | no link | "sung daily across the cathedral foundations of the Church of England" | Cathedral service, not court. |

### Counts by token

| token | pairs listed |
|---|---|
| `funk-derived` | 20 |
| `court-ceremonial` | 14 |
| `devotional` | 8 |
| `folk-rock` | 6 |
| `jazz-influenced` | 6 |
| `gospel-runs` | 5 |
| `sacred-traditional` | 5 |
| `rock-context` | 4 |
| `blues-derived` | 3 |
| `blues-shouter` | 3 |
| `ceremonial` | 3 |
| `liturgical` | 3 |
| `medieval` | 3 |
| `classical-trained` | 2 |
| `congregation-loud` | 2 |
| `jazz` | 2 |
| `marching-bateria` | 2 |
| `metal-context` | 2 |
| `rock` | 2 |
| `baroque-leaning` | 1 |
| `classical` | 1 |
| `classical-jazz` | 1 |
| `conga-influenced` | 1 |
| `late-Romantic-onward` | 1 |
| `period-performance` | 1 |

