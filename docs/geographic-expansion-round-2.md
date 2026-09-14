# Geographic coverage audit — round 2

This round turns 24 verified gaps into catalog configurations and map anchors,
with 10 supporting instruments. It also preserves 16 additional repertoire leads
for the next batch. The baseline is commit `cac9cb8` after the previous geographic
expansion. The machine-readable source ledger is
[`geographic-expansion-round-2.json`](geographic-expansion-round-2.json).

A sparsely populated map is a discovery aid. It does not establish that a country
has no musical traditions, or that every blank patch needs a genre pin. This pass
checks named repertoires against the catalog and uses approximate cultural or
recording locations. Pins are not territorial boundaries or unique-origin claims.

## Catalog additions

| Area | Added repertoires | Arrangement distinctions |
| --- | --- | --- |
| Lesotho | Famo; mohobelo; litolobonya | Accordion song, communal men's dance song, and women's tin-drum/whistle song remain separate. |
| Rwanda | Intore musical performance | Singing and drums; unspecified drum construction and player count. |
| Burundi | Royal drum ritual repertoire | A dedicated synchronized drum section with poetry and song. |
| Seychelles | Moutya | Leader/group response and the documented three-drum ensemble. |
| São Tomé | Tchiloli instrumental theatre repertoire | Bamboo flute, drums and sucalo basket rattles; selected scene accompaniment. |
| Nenets territory | Syudbabc; yarabc; personal songs | Narrative singer/assistant configurations differ from personal solo song. |
| Nganasan Taymyr | Personal songs; keingeirsya | Autobiographical solo performance and a selected sung dialogue. |
| Palau | Chesóls; ruk | Solo chant and group vocal/body-rhythm performance. |
| Slovakia | Terchová music; Horehronie multipart singing | Bowed ensemble with small two-string bass versus unaccompanied multipart voices. |
| Uganda | Bigwala; Ma’di bowl-lyre music | Interlocking single-tone trumpets versus a five-string plucked bowl lyre. |
| Mozambique | Chopi timbila orchestral music | Reuses timbila with an explicit graduated-register ensemble option. |
| Chewa region | Gule Wamkulu musical repertoire | Song and drums for masked dance, anchored in Malawi without excluding Zambia or Mozambique. |
| Haida Gwaii | Welcome-song repertoire | A selected documented solo recital, not an inventory of potlatch music. |
| Shuar region | Anent; nampet | Intimate ritual song and festive song represented by separate vocal selections. |
| Oman / UAE | Al-Ayyala | Facing vocal rows with drums, tambourines and brass cymbals. |

The new instruments are sekupu tin drum, signal whistle, Burundi royal drum
ensemble, Moutya drum trio, Tchiloli bamboo flute, sucalo, Terchová two-string bass,
Bigwala trumpet ensemble, Ma’di O’di lyre, and Al-Ayyala percussion section.
An instrument card can represent a documented section; it does not imply one
physical instrument or one player.

## Evidence and modeling limits

The sources establish repertoire identities, selected ensemble roles, and
performance contexts. The recording chains, numeric axes, and optional setup
controls are authored recording models. The field-recorder chain is a
contemporary documentary option, not a claim about historic recording equipment.
Performer-relative tuning is used where precise intervals have not been verified.

These entries deliberately describe selected arrangements. Ruk's clapping card
covers only part of its bodily percussion. The Chopi selection includes m’zeno
singing within a larger orchestral performance. Nenets epic songs can also be
performed by a narrator repeating their own lines. Keingeirsya includes monologues
as well as the duet selected here. A vocal recital of nampet does not establish
that the wider festive practice is always unaccompanied.

Several UNESCO pages returned bot challenges when opened; their indexed
institutional text and nomination/inventory documents supplied the relevant
information. Music in Africa articles were checked through indexed excerpts
where direct access was unavailable. The source ledger records URLs and the
specific configuration supported; it does not claim a new audio transcription
or consultation with every community.

## Next-batch research queue

These leads remain research candidates. None is silently counted as a playable
addition or a new map pin in this PR. Before importing each, verify a specific
recording/ensemble and reconcile aliases against the catalog again.

| Area | Candidate repertoire | Source lead and remaining work |
| --- | --- | --- |
| Namibia | Ma /Gaisa; Shambo | [Music in Africa: Popular music in Namibia](https://musicinafrica.net/magazine/popular-music-namibia/). Select documented band/keyboard arrangements and distinguish the two styles. |
| Namibia | Nama ancestral music | [UNESCO archival record](https://www.unesco.org/archives/multimedia/document-5355). Choose a specific bow, accordion or guitar-led configuration instead of combining all possible instruments. |
| Benin | Tchinkoumé; Tchink System | [IPS historical report](https://www.ipsnews.net/1998/10/music-benin-funeral-music-becomes-national-rhythm/), [Tohon Stan label release](https://hotcasarecords.bandcamp.com/album/dans-le-tchink-syst-me-2). Verify water-calabash construction and the distinct electric adaptation; existing Vanuatu water percussion is not an equivalent instrument. |
| Guinea-Bissau | Gumbé | [Ramiro Naka performer page](https://worldmusicproduction.org/en/artist/ramiro-naka). Select a documented local arrangement and avoid conflating it with similarly named traditions elsewhere. |
| São Tomé | Ússua; socopé; puita; dançá Congo | [ARIPO cultural-industry study](https://www.aripo.org/storage/copyright-publication/1674828596_phpOXoVfx.pdf), [Bialoborska's ethnographic thesis](https://repositorio.iscte-iul.pt/bitstream/10071/25201/1/phd_mgdalena_anna__bialoborska.pdf). Reconcile spelling and overlapping labels; establish a separate ensemble for each. |
| Marshall Islands | Christmas biit | [Marshall Islands Journal: Evolution of Christmas beat](https://marshallislandsjournal.com/evolution-of-christmas-beat/). Verify the selected choir and backing-band configuration. Jepta names the performing groups, not a second genre. |
| Sierra Leone | Bubu | [Janka Nabay: Build Music](https://jankanabay.bandcamp.com/album/build-music). Separate traditional pipe/horn ensemble evidence from the electronic recording adaptation. |
| Cook Islands | ʻUte; kapa rima; ura paʻu performance music | [Cook Islands Tourism: Te Maeva Nui](https://cookislands.travel/es/node/890), [Te Papa language-week resource](https://blog.tepapa.govt.nz/wp-content/uploads/2017/08/cook-island-language-week-resource.pdf). Verify vocal, string and drum roles separately; do not substitute Hawaiian drums solely because they are Pacific instruments. |
| Nicaragua / Honduras Caribbean coast | Miskito song repertoire | [Smithsonian Folkways album](https://folkways.si.edu/music-of-the-miskito-indians-of-honduras-and-nicaragua/american-indian-struggle-protest-world/album/smithsonian). Select tracks and inspect liner-note instrumentation before defining a default. |

Fiji, Samoa, Greenland, Iceland and New Caledonia already have catalog coverage.
Apparent gaps there can involve sparse anchors, overlapping points or basemap
geometry. They should not be treated as entirely absent cultures on the basis of
the overview map.

## Validation

`node scripts/check_geographic_round2.js` checks all new IDs, provenance links,
map-anchor records, authored part validity, pinned settings through optimization,
and browser/connector equality across all four recipe formats (96 renders).
It protects the specific ensemble distinctions above. It is part of
`npm run test:geography`, alongside the previous round's independent gate.

The normal catalog, atlas, build and artifact checks remain required. See the PR
for the actual executed checks and any outstanding CI results.

### Reviewed regression effect

The catalog's existing neighbor scorer uses taxonomy membership and axis distance.
Adding traditions changes those neighborhoods even when every existing source
record remains identical. Fifteen canonical recipe fixtures changed in this round:
`blend_qawwali_drone`, `karelian_rune_singing`, `maori_waiata_tangi`,
`san_bushman_hunting`, `borgeet_assamese`, `shona_mbira_praise`,
`navajo_healing_chantways`, `sfyria_antia`, `estonian_setu_leelo`,
`korean_chongmyo_jeryeak`, `lithuanian_sutartines`, `vietnamese_quan_ho`,
`hawaiian_mele_inoa`, `qawwali`, and `apache_hunting_medicine`.

The reviewed differences are neighboring-tradition labels and, in some fixtures,
unpinned vocal or accordion/harmonium descriptors. The roster and environment
source records were not edited. These are consequences of the existing scoring
model, not newly researched claims about those older repertoires. Only those 15
snapshot fixtures were refreshed. The new optional voice and timbila variants
are explicit-only (`auto: false`), and all authored new settings are pinned.
