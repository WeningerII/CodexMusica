# Geographic catalog expansion — September 2026

This change implements the 96 candidates from the geographic coverage review: 61 tradition additions and 35 named instruments. Sixteen supporting instruments make the selected ensembles usable, and two existing traditions are repaired. The resulting catalog has 2564 traditions and 1457 instruments.

The entry-by-entry source ledger is [geographic-catalog-expansion.json](geographic-catalog-expansion.json). It retains every research candidate ID and distinguishes the supporting instruments and repairs. All 69 source records are listed there.

## Modeling decisions

- Each tradition represents a selected configuration. An archive containing several ensembles does not imply that every listed instrument plays simultaneously.
- Sources establish names, repertoire, instruments and performance context. Axes, optional sound controls and the contemporary digital field-recording chain are authored recording choices, not measured historical studio specifications.
- Performer-relative intonation leaves undocumented interval ratios unspecified. Percussion-only entries have no imposed scale. Unspecified vocal settings avoid inventing physiological measurements or assigning another culture’s training system.
- `parts` is a flat part-to-variant map. The optional `pin_parts: true` keeps reviewed settings through CLI/static optimization; caller swaps still take precedence. Browser and connector imports already honor the flat map. Legacy rows retain scored optimization.
- Geographic coordinates name approximate cultural or documentation anchors, not exclusive origins. New coordinates are not added to the previous model-review list or the human-verified list. Vanuatu’s changed coordinate is removed from the old review list.

The atlas supplements its 1:50m world map with the public-domain Onotoa polygon from Natural Earth v5.1.2 at 1:10m. This keeps the documented Kiribati anchor on its actual atoll while preserving the ordinary offshore-distance gate.

## Specific corrections

Mwinoghe contains one ingina and a two-drum twana/perekete card, with no singing. Katta ashula defaults to a live duet. Himmi uses a leader and chorus; dobana terkiya uses a solo voice. Ob-Ugric bear-festival music does not automatically acquire the secular nyn-yukh fiddle. Banda Linda and Dakpa horn ensembles use separate regional settings. Turkmen dutar settings do not inherit Bukharan shashmaqam. Djanba and junba/balga do not acquire didjeridu from neighbouring styles.

Vanuatu water music now contains water percussion, with sand drawing removed from the musical record. Tongan lakalaka uses poetic choral singing and handclaps rather than a solo nonlexical oli/falsetto preset. Its previous nafa instrument remains independently available.

## Traditions

| Candidate | Catalog ID | Place anchor | Instruments | Sources |
| --- | --- | --- | --- | --- |
| T001 | `salegy` | Antsiranana | voice, single-coil solid-body electric guitar, electric bass, drum kit, accordion | S1, X1 |
| T002 | `tsapiky` | Toliara | voice, single-coil solid-body electric guitar, electric bass, drum kit | S2 |
| T003 | `hiragasy` | Antananarivo | voice, fiddle, trumpet, hiragasy drums | S3, X2 |
| T004 | `vimbuza` | Rumphi | voice, Vimbuza drums, clap | S4 |
| T005 | `tchopa` | Mulanje | voice, Tchopa drums | S5, X13 |
| T006 | `mwinoghe` | Chitipa | ingina drum, twana drum pair | S5, X3 |
| T007 | `kaligo_playing` | Ntchisi | kaligo | S5 |
| T008 | `malipenga` | Chintheche | malipenga singing horn, malipenga drum pair | S6, X10 |
| T009 | `himmi` | Tibesti | voice | S7, X14 |
| T010 | `dobana_terkiya` | Tibesti | voice | S7, X15 |
| T011 | `terdegna` | Tibesti | voice, acoustic membrane drum | S7 |
| T012 | `dinka_song_traditions` | Warrap | voice | S8 |
| T013 | `fang_bwiti` | Kango region | voice, ngombi | S9 |
| T014 | `mbiri` | Kango region | voice, ngombi | S9 |
| T015 | `banda_linda_polyphony` | Bambari region | Banda horn ensemble | S10 |
| T016 | `banda_dakpa_polyphony` | Grimari region | Banda horn ensemble | S10 |
| T017 | `budima` | Gwembe | nyele ensemble, Budima drums, voice | S11, X4, X5 |
| T018 | `khanty_mansi_bear_festival` | Khanty-Mansiysk region | voice, nars yukh | S12, S15 |
| T019 | `khanty_personal_songs` | Surgut region | voice | S13 |
| T020 | `chukchi_personal_songs` | Egvekinot | voice | S17 |
| T021 | `koryak_personal_songs` | Tilichiki region | voice | S18 |
| T022 | `tebe_tebe` | Liquiçá | voice, babadok | S19 |
| T023 | `zhungdra` | Thimphu | voice | S20, X18 |
| T024 | `boedra` | Thimphu | voice, chiwang, dranyen | S20, X18, X19 |
| T025 | `boduberu` | Malé | voice, boduberu drum | S21 |
| T026 | `thaara_jehun` | Malé | voice, Thaara frame drum | S21 |
| T027 | `bandiyaa_jehun` | Malé | voice, bandiyaa pot | S21 |
| T028 | `dhandi_jehun` | Malé | voice, dhandi sticks | S21 |
| T029 | `falak` | Kulob | voice | S22 |
| T030 | `katta_ashula` | Fergana | voice | S23, X17 |
| T031 | `turkmen_bagshy` | Ashgabat | voice, dutar | S24 |
| T032 | `north_udmurt_krez` | Glazov region | voice | S25 |
| T033 | `mari_song_dance` | Yoshkar-Ola | voice, shuvyr, tumyr | S26 |
| T034 | `maltese_ghana` | Żejtun | voice, classical guitar | S28 |
| T035 | `yupik_yuraq` | Quinhagak / Qanirtuuq | voice, cauyaq | S30, S31 |
| T036 | `greenlandic_drum_song` | Tasiilaq | voice, qilaat | S32, X9 |
| T037 | `dene_handgame` | Chateh | voice, Dene hand drum | S33, X6 |
| T038 | `awasa` | Papaïchton | voice, awasa drum trio | S35, X8, X16 |
| T039 | `aleke` | Apatou | voice, aleke doon, dyas drum and cymbal | S34, X16 |
| T040 | `kawina` | Nieuw Amsterdam / Commewijne | voice, kawina drum | S34, X7 |
| T041 | `wayapi_tule` | Trois Sauts / Zidock | tule clarinet ensemble, voice | S36, S37 |
| T042 | `parixara` | Amajari region | voice, kewei, ruwe | S38 |
| T043 | `selknam_hain` | Lago Fagnano / Tierra del Fuego | voice | S39 |
| T044 | `selknam_shamanic_laments` | Lago Fagnano / Tierra del Fuego | voice | S39 |
| T045 | `kiribati_ruoia` | Tabiteuea | voice | S40 |
| T046 | `kiribati_bino` | Tabiteuea | voice | S40 |
| T047 | `kiribati_tirere` | Nonouti / Routa | voice, tirere rods | S40 |
| T048 | `kiribati_batere` | Onotoa / Buariki | voice, acoustic membrane drum | S40 |
| T049 | `yap_churu` | Yap | voice, clap | S41 |
| T050 | `tuvalu_fatele` | Funafuti | voice, pokisi, kaapa | S42 |
| T051 | `bosavi_gisalo` | Bosavi | voice | S43 |
| T052 | `bosavi_koluba` | Bosavi | voice | S43 |
| T053 | `bosavi_iwo` | Bosavi | voice | S43 |
| T054 | `bosavi_sabio` | Bosavi | voice | S43 |
| T055 | `bosavi_ilib_kuwo` | Bosavi | kundu | S43, S44 |
| T056 | `bosavi_sung_weeping` | Bosavi | voice | S43 |
| T057 | `bosavi_string_band` | Bosavi | voice, dreadnought acoustic guitar | S43 |
| T058 | `wangga` | Wadeye | voice, didgeridoo, clapsticks | S46 |
| T059 | `lirrga` | Wadeye | voice, didgeridoo, clapsticks | S46 |
| T060 | `junba_balga` | Gibb River region | voice, clapsticks, clap | S46 |
| T061 | `djanba` | Wadeye | voice, clapsticks, clap | S46 |

## Instruments

| Candidate | Catalog ID | Source records |
| --- | --- | --- |
| I001 | `kaligo` | S5 |
| I002 | `ingina` | S5 |
| I003 | `twana_perekete` | S5 |
| I004 | `malipenga_singing_horn` | S6 |
| I005 | `keleli` | S7 |
| I006 | `bilil` | S7 |
| I007 | `ongo_horns` | S10 |
| I008 | `lenga` | S10 |
| I009 | `mvrele` | S10 |
| I010 | `nars_yukh` | S12 |
| I011 | `tor_sapl_yukh` | S14 |
| I012 | `nyn_yukh` | S15 |
| I013 | `tumran` | S16 |
| I014 | `babadok` | S19 |
| I015 | `boduberu_drum` | S21 |
| I016 | `krez_zither` | S27 |
| I017 | `udmurt_kubyz` | S27 |
| I018 | `uzy_gumy` | S27 |
| I019 | `chipchirgan` | S27 |
| I020 | `shuvyr` | S26 |
| I021 | `tumyr` | S26 |
| I022 | `iya_kovyzh` | S26 |
| I023 | `zaqq` | S29 |
| I024 | `tanbur_maltese` | S29 |
| I025 | `cauyaq` | S31 |
| I026 | `qilaat` | S32 |
| I027 | `apinti` | S34 |
| I028 | `aleke_doon` | S34 |
| I029 | `tule_clarinets` | S37 |
| I030 | `kewei` | S38 |
| I031 | `ruwe` | S38 |
| I032 | `pokisi` | S42 |
| I033 | `kaapa` | S42 |
| I034 | `kundu` | S44 |
| I035 | `susap` | S45 |
| D001 | `vimbuza_drums` | S4 |
| D002 | `tchopa_drums` | X13 |
| D003 | `malipenga_drums` | S6 |
| D004 | `acoustic_membrane_drum` | S7 |
| D005 | `nyele_ensemble` | X4 |
| D006 | `budima_drums` | X5 |
| D007 | `thaara_frame_drum` | S21 |
| D008 | `bandiyaa_pot` | S21 |
| D009 | `dhandi_sticks` | S21 |
| D010 | `dene_hand_drum` | X6 |
| D011 | `kawina_dron` | X7 |
| D012 | `tirere_rods` | S40 |
| D013 | `water_percussion` | X12, X20, X21 |
| D014 | `hiragasy_drums` | X2 |
| D015 | `awasa_drums` | X8 |
| D016 | `dyas_tapu_patu` | X16 |

## Verification

`npm run test:geography` verifies all 96 candidate mappings, the 51 instrument additions, all 63 added/repaired configurations, and 252 browser/connector renders. It checks that authored settings survive optimization, source flags survive API projection, explicit edits win, and key musical distinctions remain intact. It runs in the regular test suite.

Regenerate the static API before the atlas sidecars: `npm run build:api`, then `node scripts/build_atlas_geo.js` and `node scripts/build_atlas_tree.js`. Rebuild signatures with `node scripts/build_signatures.js` after editing their canonical JSON, and regenerate the HTML with `npm run build:html`.

## Existing recipe effects

The two repaired traditions intentionally change their frozen recipe outputs. Five older optimized mixtures also select different nearest-neighbor tokens after the catalog grows: `koto`, `mbira_tradition`, `donsongoni_hunter_harp`, `fuji`, and `flamenco_solea`. Their authored instrument rosters remain unchanged; their snapshot updates record the optimizer’s new selections. The new acceptance test separately requires every reviewed configuration to keep its authored instruments and pinned parts through optimization.
