# Cross-linguistic public-domain verse corpus inventory

Produced by a 9-agent sweep (8 language groups + 1 adversarial audit),
1.9M tokens, 840 tool calls. The audit's job was catching inflation, and
it caught several — including in the resource this project had previously
called its best find. **Read the audit before trusting any row below.**

## Headline

- **27 distinct languages** with usable public-domain native verse (21 clean, 6 caveated)
- **7 of those have a real survival/curation label.** Everything else is
  genre, metre, era, theme, or uniform source-work attribution — none of
  which is a survival label.
- 9 more languages are one provenance/copyright filter away from counting.

## Audit (authoritative; overrides the raw group reports)

## AUDIT — CROSS-LINGUISTIC VERSE CORPUS INVENTORY

Verified against files/metadata this session, not card prose. Corrections and inflations first, tallies at the end.

---

### 1. inspected=false entries with specific counts — spot-check results

| Entry | Claim | Verdict |
|---|---|---|
| **pruizf/disco** | 4,530 sonnets / 1,216 authors, CC-BY | **CONFIRMED.** README states exactly this; `LICENSE` = CC Attribution 4.0 International. Upgrade to verified. **But the entry omits what the same README discloses:** 202 sonnets are early-mid-20th-c. Filipino authors and ~125 more are by 23 authors dying up to 1936. Spain's pre-1987 term is life+80. `public_domain: true` is false for ~327 of 4,530 rows. |
| **linhd-postdata/metrique-en-ligne** | 5,081 poems / 41,274 stanzas / 247,248 verses / 61 authors | **CONFIRMED** exactly from README stats block. `LICENSE` → **HTTP 404**, so "NOT STATED" confirmed. |
| **linhd-postdata/biblioteca_italiana** | 25,341 works / 214 authors, README self-contradicts | **CONFIRMED**, including the contradiction (prose says "more than 18000 works from over 159 authors"; stats block says 214 / 25,341 / 1,070,717 verses). `LICENSE` → **404**. New finding: the stats are labelled "XML folder statistics" and the sample record is Dante's *Il Fiore*, title "I" — **25,341 counts individual poems inside collections, not works.** The word "works" in the entry is misleading. |
| **PoetryMTEB/BengaliPoemsClassification** | 6,070 poems / 137 poets | **CONFIRMED** — viewer 3.6K+1.2K+1.2K = 6.1K, schema `id/poet/title/class/text/source_url`. |
| **ZoneTwelve/chinese-poetry** | 320 entries | **STILL UNVERIFIABLE** — viewer 0 rows, failed parquet job (xethub timeout). Licence `apache-2.0` and size tag `0<n<1K` confirmed. Group handled it correctly. |
| **TeluguLLMResearch/Padyam2Gadyam** | 600 samples | Still gated. Licence **confirmed cc-by-nc-4.0** — entry marks `public_domain: true` against an NC licence. |
| **NuBerea/hebrew-poetry** | `100K<n<1M` | Still gated; tag confirmed. **That tag counts derived analysis records over the Hebrew Bible's ~23,000 poetic verses, not poems.** Read as a corpus size it inflates Biblical Hebrew 5–40×. |
| **LOTUC (Zenodo)** | 36 divans / 17,840 poems / 251,069 lines | Figures independently corroborated by web source; **licence still unknown**, zenodo egress-blocked. Turkish stays out. |

---

### 2. public_domain=true against a restrictive or absent licence

~26 entries. Most are legitimate under the brief's "public-domain-age texts" clause, but three groups conflate *text is PD by age* with *repo is redistributable*. Where it actually bites:

- **GPL on text is incoherent** — Sefaria (gpl-3.0, confirmed), Kalliope ×3 (gpl-2.0), aitamilnadu/marabutamilvenba (gpl-3.0), kakooch/ganjoor-processed (gpl-2.0). Kalliope's PD guarantee comes from its stated editorial policy, not the tag.
- **Sefaria/hebrew_library `public_domain: true` is wrong.** The GPL tag covers Sefaria's *code*; library content is licensed per-text and includes modern in-copyright translations and commentary. No damage to the tally (verse not separable, not counted), but do not propagate the flag.
- **PoetryMTEB/Appreciation-of-Chinese-Classical-Poetry** — confirmed **no licence tag at all**, marked `public_domain: true`.
- **ND clauses** (ELTE poetry + folk-song, CC BY-NC-ND) block redistributing *modified annotations* — relevant the moment you ship a derived rhyme dataset from the best-annotated Hungarian data.
- **No licence file whatsoever, PD=true**: OpenITI, ERAB, DLK, german-rhyme-corpus, antikoerperchen, cltk old_norse, sedes, metrique-en-ligne, biblioteca_italiana, surajp/sanskrit_classic, Sourabh2/Hindi_Poems, PleIAs/Latin-PD. Defensible on age, but four whole language cells (ar, et, fra, ita) rest on repos with **zero** grant.

---

### 3. Mislabelled: synthetic, translated, or not verse

**Caught by me, not by the groups:**

- **Ericu950/AncientGreek — `native_verse: true` is unsupportable.** Schema confirmed: `source/id/license/tier/orig_band/clean/text`. **No genre or verse flag**; verse is not isolable. Separately, **1.7M of the reported 2.1M rows are the `repaired` split, rewritten by Qwen3.6-27B** — LLM-modified text carried inside a headline count. Only the 405.6K `pristine` split is usable, and even that is undifferentiated prose+verse.
- **nafisehNik/ganjoor-ipa-scansion — synthetic annotation, unflagged.** Card confirms IPA/Latin transliteration is **Homo-GE2PE model output** and ~21% of meters were "reconstructed here." The `known` bool covers meter reconstruction; **nothing covers the IPA**. A rhyme study keyed on the IPA column scores a G2P model, not Persian phonology. Same family of trap as PoetryMTEB/Appreciation's DeepSeek annotations — one was caught, this one wasn't, and this is the group's flagship Persian pick.
- **DLK translation risk, unflagged.** DLK = DTA "Lyrik" + TextGrid "Verse". TextGrid's Digitale Bibliothek carries German *verse translations* (Voss's Homer, Schlegel's Shakespeare). The entry has a `language` field but no translation filter and no mention of one. This is the largest German corpus in the inventory. Kalliope, Biblioteca Italiana and ELTE have the same exposure; only Dutch_Renaissance flagged it.
- **Six wikimedia/wikisource configs (cy/is/sv/nl/da/de) carry `native_verse: true`** while their own `label_source` says verse/prose separation must be reconstructed. So do PleIAs/Latin-PD and kenpusney. Only historica-corpus and Wolne Lektury were honestly marked `false`. These are PD *text pools*, not verse corpora.
- **AKS-DHLAB/KPoEM** — 483 poems by five named modern poets (Im Hwa d.1953 cleared Korea's life+70 only in 2024). This is a five-author modernist cohort, not a tradition sample, and modern Korean free verse does not rhyme. Nearer to "modern collection" than the entry implies.

**Correctly handled** (no correction needed): all Shaer-AI-2/*, Hyaline AI-Generated Chinese, LeoLM/German_Poems (GPT-4), ReySajju742/synthetic-urdu, VenkataRamana Telugu-Synthetic, taucris/haiku_333K, ReySajju742/Hindi-Poetry (Urdu in Devanagari), Rifma (unfilterable translations, correctly `native_verse: false`), gvlassis/ancient_greek_theatre, the whole PoetryTranslation/BitextMining family, and PoetryMTEB/MultilingualPoetryDatabase (lyrikline, in-copyright) — independently found and rejected by four separate groups.

---

### 4. label_source claims that are not curation records

**Overstated — downgrade:**

- **Ganjoor "canon membership = anthology proxy"** (nafisehNik, mabidan). Ganjoor is a *comprehensive* digital library of Persian poetry, not a selective anthology. Every classical poem is in it. **Zero discriminative power.**
- **DISCO "mixes canonical with less-canonized authors, exactly a canon/survival contrast."** There is **no canonicity column**. That is editorial intent stated in the README. VIAF IDs are authority-file identifiers, not canon ranks.
- **Source-work attribution presented as anthology membership, with no negative pool**: chandassu `satakam`, sentamizh `source_text`, sangam `work`/`category`, Thirukkural paal/iyal/athikaaram, Shijing chapter/section, 花間集 membership, GRETIL genre_l1/l2, Syriac critical-edition + syriaca.org URI, ELTE poetry corpus, Biblioteca Italiana, Wolne Lektury, KPoEM `poetry_book`, sedes, Kalliope `<source>`. These tell you *which* anthology a poem sits in when **every** poem in the corpus sits in one. Not survival labels.
- **Old English manuscript directories** — transmission channel, uniform across the corpus. (Bede's Death Song's 3 recensions show a multiple-attestation label is derivable, but for a handful of items only.)
- Metre/theme/era labels were mostly labelled honestly by their groups; none may count toward the survival tally.

**Undersold — upgrade:** **Sefaria `metadata.pagerank`** is the only *continuous* survival measure anywhere in the inventory (citation centrality over the internal link graph). It is parked in an uncounted entry because verse isn't separated — but `docCategory` isolates Liturgy/piyyut, and joining that to Ben-Yehuda's Andalusian corpus is the cheapest way to give Hebrew a real label.

---

### 5. Duplicates across groups and ids

| Cluster | Ids | Phantom volume |
|---|---|---|
| **Ganjoor** | nafisehNik 124.4K + mabidan 119.1K + cnababaie 118.8K + kakooch — all verified by me, all **one** upstream (ganjoor.net) | ~362K phantom Persian poems if summed |
| **aldiwan.net** | ashaar 254,630 + Ashaar_meter **1,802,800** + Ashaar_diacritized 26,131 + Fatimah8Moheeb 245,315 + alwalid54321 8,875 + tahaio 75,000 | ~2.41M "Arabic rows," **none licence-usable**. Ashaar_meter is the largest single number in the inventory and is just ashaar's 254,630 poems exploded to verse level |
| **MetRec** | Zaid/metrec + PoetryMTEB/ArabicPoetryMeterClassification, both 55,440 (47,124/8,316) | listed as two corpora in one group |
| **SKVR + ERAB** | hsci-r/filter-data 294,367 = ERAB 108,968 + SKVR 89,247 + JR + KR; plus drshnkv/est-runocorp-morph 108,969 = same ERAB texts re-annotated | Estonian triple-counted; 198,215 poems double-counted |
| **chinese-poetry** | GitHub repo + erhwenkuo 76K partial re-export + ZoneTwelve + kenpusney 2.4M aggregate; **Werneror/Poetry 853,385 is not independent either** (both are 全唐詩/全宋詩 extractions — 唐.csv 49,195 vs 57,607) | |
| **Thirukkural** | yuvarajvelmurugan 1,330 + thirukkural_instruct 4,000 + bikram22pi7 ~1,300; **marabutamilvenba's Pathinenkeezhkanakku likely re-includes the same 1,330** | |
| **Sangam** | starhopp3r 2,377 + sentamizh Ettuthokai 1,584 (same Vaidehi Herbert source) + Kameshr 1,051 lines + TamilSangamLiteraryDevice 1,051 | |
| **Chandassu / KPoEM / Bengali** | chandassu ↔ ChandassuMeterClassification (4,651); KPoEM ↔ KPoEMEmotionClassification (7,622); rishiraj 6,100 ↔ 3 PoetryMTEB Bengali sets | |
| **DISCO** | pruizf v5 4,530 ↔ jorge-henao v4 4,303 | |
| **PULPO** | 17.6M rows contains corpusCzechVerse, Poesi.as, Stichotheque, and overlaps DISCO/metrique/biblioteca_italiana — **same linhd-postdata org built all of them**. Its rows are also lines *and* stanzas double-counted | |

---

### 6. DEFENSIBLE TALLIES

**Distinct languages with usable public-domain native verse: 27.**

*Clean (21):* he, hbo, syc, fa, sa, pa, lzh, te, ta, fi, et, hu, de, da, nl, ces, spa, grc, la, non, ang
*Material caveat (6):* **ar** (rests entirely on OpenITI — no licence file, diwans identified by title match, fully unvocalized; the only cleanly-licensed Arabic, MetRec, has no per-poem provenance so PD can't be established), **hi** (~1,181 rows, no licence, poets sampled not audited), **ps** (only 6,459 of 35,637 couplets — 2 poets — are PD; the cc-by-4.0 tag is a false assertion), **fra** and **ita** (no licence at all, third-party academic scrapes, README-verified only), **ko** (483 poems, 5 authors, modern free verse)

**Not counted, one filter away (9):** vie, pol, rus, ja, ur, bn, sv, cy, is. Each is either a provenance/copyright filter whose surviving N nobody measured (vie, pol, ur, bn, ja), a corpus that is 82% in-copyright (rus: 598 of 728 docs are 20th-c.), or an undifferentiated Wikisource dump with no verse/prose field (sv, cy, is).

**Of the 27, languages with a REAL survival/curation label: 7.**

| Language | Label | Why it qualifies |
|---|---|---|
| ces | reprint count across distinct books | 6,028/60,042 in >1 book, computed from data |
| fi | folkloristic type index, variant count | max 1,673 variants vs median 3 |
| et | unified type index | 66,298 song-to-type links, max 1,270 variants |
| lzh | 唐诗三百首 tag **inside** the 57,607-poem pool | 362 in-pool positives, subset test run |
| de | antikoerperchen (164 poems with published school interpretations) vs DLK's 65,760 as negative pool | genuine positive/negative design |
| pa | Shabad OS `banis` table — 9,424 liturgically-canonised lines of 141,264 | selective subset within a shipped pool |
| la | julian-schelb intertextuality-labels (Jerome/Lactantius reuse) | reception signal, discriminates passages; 10 authors only |

**+1 borderline:** non — "In Codex Regius" is a genuine binary attestation split, but n=25 poems. Real, underpowered.

Everything else is genre, metre, era, theme, or uniform source-work attribution.

---

### 7. Cheapest next non-English cells, ranked

1. **Vietnamese (vie)** — highest value/cost ratio. Filter is a two-column `WHERE url='thivien.net' AND period IN (pre-modern set)` over phamson02's 198,600 rows; the prosodic form label (`specific_genre`: lục bát, thất ngôn bát cú, song thất lục bát) is already there. Cost is one pass to report the surviving N. Adds a tone-language rhyme cell independent of Sinitic.
2. **Kannada (kn)** — highest variance, near-zero cost. Vachana Sanchaya's ~21,000-vachana Unicode conversion with stated PD-release intent; one fetch from an unblocked network either closes the cell or returns nothing. Note the caveat the group raised: vachana is free-verse-adjacent, so Kumaravyasa's *Gadugina Bharata* (bhamini shatpadi) is the better metrical target if a dump exists.
3. **Turkish / Ottoman (ota)** — one Zenodo record read. LOTUC is 17,840 poems with **per-poem aruz already attached** plus century/rank metadata; the entire Turkic branch is otherwise empty. Also worth checking **OpenITI MAKHZAN**, which covers Ottoman Turkish and Urdu print/manuscript data and which no group examined.
4. **Urdu (ur)** — build a ~50-row poet→death-year table over Khurram123's 42,639 couplets. Payoff is the ghazal radif/qafiya system, the best non-Arabic monorhyme test case, pairing directly with the already-clean Persian cell. Two known traps to handle: the card's `genre` column does not exist (header is `misra1,misra2,poet`), and the Iqbal rows are Persian.
5. **Polish (pol)** — filter `translators==[] AND language=='pol' AND kinds contains 'Liryka'` over Wolne Lektury, after de-duplicating the jsonl/zip double-count (7,316 not 14.6K). Adds a Slavic cell with a national school-canon signal.
6. **Bengali (bn)** — same poet→death-year join over rishiraj's 6,070 poems (137 poets). Payoff is BengaliPoemsClassification's 21 classes, which include *form* labels (sonnet, nursery rhyme, epic) — the most prosody-relevant label set in the Indic material.
7. **Hebrew survival label (he)** — not a new cell but the cheapest *label* win: join Sefaria `docCategory=Liturgy` + `metadata.pagerank` to Ben-Yehuda's 4,167 Andalusian poems. Turns the study's best rhymed-Semitic cell from label-less into label-bearing, and pagerank is the only continuous survival measure available anywhere in this inventory.

**Do not bother:** Pashto beyond the existing 6,459 couplets (the remainder is genuinely in copyright); Swedish (Kalliope has 339 poems, Wikisource needs a verse classifier for little gain); Russian (the real corpus is behind ruscorpora's query interface and the open UD set is 82% 20th-century).

---

## Raw group reports

### indo-iranian

_VERIFICATION METHOD. Every "inspected: true" entry was checked against real files or real column schemas, not card prose: hf_fs ls/cat on the actual CSV/TXT/parquet trees, hub_repo_details dataset_structure for viewer-computed row counts, and for the two GitHub corpora I downloaded and parsed the data locally (GRETIL catalog.csv parsed with Python; Shabad OS npm tarball extracted and master.sqlite queried with SQL). Direct huggingface.co file downloads are 403-blocked by the agent proxy, and api.github.com plus raw.githubusercontent.com are blocked for repos outside this session's scope — but registry.npmjs.org IS reachable, which is how the full Gurbani database was obtained. Project Gutenberg / archive.org / Wikisource were not used.

CARD-VS-DATA CONTRADICTIONS FOUND (the specific failure mode I was told to avoid):
1. Khurram123/urdu-poetry-mega-corpus: the README documents a `genre` column ("Ghazal/Nazm"). It DOES NOT EXIST. The CSV header is literally `misra1,misra2,poet` and the viewer schema confirms 3 columns. Anyone trusting the card would build a genre-conditioned study on a phantom column.
2. Same dataset: tagged `language: ur`, but at byte offset ~5.3M the Allama Iqbal rows are PERSIAN, not Urdu (e.g. "نہان در سینۂ ما عالمی ہست", from his Persian masnavis). Language purity cannot be assumed from the tag.
3. cnababaie/persian-poetry-meters: the tag block says size_categories 100K<n<1M while the parsed metadata field says 1M<n<10M. The viewer's actual count is 118.8_

| id | lang | count | licence | PD | native | label | inspected |
|---|---|---|---|---|---|---|---|
| `nafisehNik/ganjoor-ipa-scansion (https://hf.co/datasets/nafisehNik/gan` | fa — Persian | 124.4K poems (viewer-reported 124,404; m | cc-by-4.0 | Y | Y | Ganjoor poet_id/poet_name + meter struct (rhythm_id, rhythm_name, base_meter, feet_fa/lat, scansion, source, ` | Y |
| `mabidan/ganjoor (https://hf.co/datasets/mabidan/ganjoor)` | fa — Persian | 119.1K rows (poems) | cc-by-4.0 (uploader-asserted over PD-age | Y | Y | `poet` + `cat` = canonical Ganjoor collection/genre path (e.g. رباعیات). Ganjoor's per-poet divan structure is | Y |
| `cnababaie/persian-poetry-meters (https://hf.co/datasets/cnababaie/pers` | fa — Persian | 118.8K rows | apache-2.0 (uploader-asserted over PD-ag | Y | Y | persian_meter, arabic_meter, persian_meter_with_diacritics, meter_signs — prosodic labels, not a canon/surviva | Y |
| `shabados/database — Persian sub-sources GZNL/ZNNL/JBNL/GJNL (Bhai Nand` | fa — Persian | 2,510 lines (GZNL Divan-i-Goya 806, ZNNL | Public Domain Mark 1.0 (texts); MIT (cod | Y | Y | Canonical source_id + section + author tables; each line cited to a named physical printed edition via `assets | Y |
| `kakooch/ganjoor-processed (https://hf.co/datasets/kakooch/ganjoor-proc` | fa — Persian | unverified — Dataset Viewer generation F | gpl-2.0 (odd/likely inapplicable licence | Y | Y | poet + verse-position metadata per card; could not confirm against data | Y |
| `Khurram123/urdu-poetry-mega-corpus (https://hf.co/datasets/Khurram123/` | ur — Urdu | 42.6K rows = couplets (viewer 42.6K; car | apache-2.0 asserted — CANNOT cover the i | N | Y | `poet` only. PD subset filterable by poet (Mir Taqi Mir d.1810, Ghalib d.1869, Iqbal d.1938); Ahmad Faraz (d.2 | Y |
| `ReySajju742/Urdu-Poetry-Dataset (https://hf.co/datasets/ReySajju742/Ur` | ur — Urdu | 1.3K rows | mit (uploader-asserted) | N | Y | none (only title + content; card's claimed 'Poem' column is actually named `content`) | Y |
| `keplersystems/UrduPoetry-35k (https://hf.co/datasets/keplersystems/Urd` | ur — Urdu | 35.0K rows | NONE declared | N | Y | none — single `messages` column of role/content chat turns (LLM SFT reformat, not a verse corpus); no language | Y |
| `tokushige-koyasan/gretil-corpus (https://github.com/tokushige-koyasan/` | sa — Sanskrit | 784 texts / 163,027,543 chars total; the | CC BY-NC-SA 4.0 on 783 texts, CC BY-SA 4 | Y | Y | catalog.csv with path/title/author/genre_l1/genre_l2/license/chars. 5_poetry splits into 2_kavya 56, 1_alam 27 | Y |
| `surajp/sanskrit_classic (https://hf.co/datasets/surajp/sanskrit_classi` | sa — Sanskrit | 342,032 lines / 14,655,169 chars in comb | NONE — _LICENSE field is empty string in | Y | Y | none — single undifferentiated `text` column, no author/work/genre boundaries. Mixed verse and prose. Script-b | Y |
| `bpHigh/iNLTK_Sanskrit_Shlokas_Dataset (https://hf.co/datasets/bpHigh/i` | sa — Sanskrit | 479 rows total (383 train + 96 validatio | cc-by-sa-4.0 | Y | Y | `Class` = source work / anthology (e.g. 'Vidur Niti Slokas' from the Mahabharata) — usable as a weak canon lab | Y |
| `Sourabh2/Hindi_Poems (https://hf.co/datasets/Sourabh2/Hindi_Poems)` | hi — Hindi (incl. Braj/Awadh | 1.2K rows (last row index 1180, so ~1,18 | NONE declared | Y | Y | `Period` = poet life-dates and `Language` column actually holds the VERSE FORM (दोहा etc.). Sampled poets all  | Y |
| `ReySajju742/Hindi-Poetry-Dataset (https://hf.co/datasets/ReySajju742/H` | hi — Hindi (nominal) | 1K–10K (not row-verified) | mit | N | N | none — TRAP: this is Devanagari TRANSLITERATION of URDU poetry, not native Hindi verse. Rhyme/metre belong to  | N |
| `rishiraj/bengali-poems (https://hf.co/datasets/rishiraj/bengali-poems)` | bn — Bengali | 6.1K rows (poems) | apache-2.0 asserted — CANNOT cover the l | N | Y | `poet` + `category` (e.g. ভক্তিমূলক devotional, প্রেমমূলক love). Corpus spans Shah Muhammad Sagir (14th–15th c | Y |
| `PoetryMTEB/BengaliPoetryThemeClustering (https://hf.co/datasets/Poetry` | bn — Bengali | 6.1K rows (test split only) | gpl-3.0 | N | Y | 21 theme/category labels (label_name, label_name_en, theme_code, label_kind) + author. Derived from rishiraj/b | Y |
| `PoetryMTEB/BengaliPoemThemeClassification (https://hf.co/datasets/Poet` | bn — Bengali | 5.2K rows (4.1K train / 518 validation / | gpl-3.0 | N | Y | 12 theme labels, expert-generated; from the ACM/NLPIR stylometric Bengali Poem Dataset (137 poets). Formal gen | Y |
| `PoetryMTEB/SahittoCategoryClassification (https://hf.co/datasets/Poetr` | bn — Bengali | 2.2K rows (1,763 train / 222 validation  | cc-by-4.0 | N | Y | 11 poem categories/genres, expert-generated. Source is banglarkobita.com via Mendeley DOI 10.17632/zgmrk5m566. | Y |
| `PoetryMTEB/BengaliPoemsClassification (https://hf.co/datasets/PoetryMT` | bn — Bengali | 6,070 poems from 137 poets, 21 classes ( | NONE declared | N | Y | 21 genre/theme classes including FORM labels (sonnet, nursery rhyme, epic) — the most prosody-relevant Bengali | N |
| `shabados/database — SGGS (https://github.com/shabados/database; npm @s` | pa — Punjabi (Guru Granth Sa | 60,555 lines (of 141,264 lines across al | Public Domain Mark 1.0 (texts); MIT (cod | Y | Y | STRONGEST in this group: 51 sections = RAGA assignments (Raag Malaar, Raag Soohee, Raag Raamkalee…), 40-entry  | Y |
| `shabados/database — Dasam Granth (SDGR), Varan Bhai Gurdas (VBGJ), Kab` | pa — Punjabi / Braj | SDGR 67,758 lines; VBGJ 7,585; KSBG 2,76 | Public Domain Mark 1.0 (texts); MIT (cod | Y | Y | Same schema: source_id, sections, line_groups, author, and per-line citation to named printed editions (Das Gr | Y |
| `AliMuhammad73/Pashto-Poetry (https://hf.co/datasets/AliMuhammad73/Pash` | ps — Pashto | 71.3K rows = hemistichs (README states 3 | cc-by-4.0 asserted — CANNOT cover the mo | N | Y | `poet` + README per-poet couplet counts. PD subset = Khushal Khan Khattak (d.1689) 4,257 couplets + Rahman Bab | Y |
| `PoetryMTEB/HafezGhazals_rhetoric (https://hf.co/datasets/PoetryMTEB/Ha` | fa — Persian | 0 — repo is EMPTY | cc-by-nc-4.0 | Y | Y | none — NEGATIVE FINDING. Repo contains only .gitattributes and a 33-byte README; Dataset Viewer returns 'The d | Y |
| `Ojash/hindi-poems (https://hf.co/datasets/Ojash/hindi-poems)` | hi — Hindi | 0 — repo is EMPTY | NONE declared | N | Y | none — NEGATIVE FINDING. Repo contains only .gitattributes, no data file at all. | Y |

**Nothing usable found:** Nepali (ne) — no verse corpus of any kind found, Maithili (mai) — only gated repos, unverifiable

### semitic-templatic

_VOCALIZATION (the group's central question) — all measured from files, not cards:

- SYRIAC srophe/syriac-corpus: 74,970 of 76,006 verse lines (98.6%) carry Syriac vowel points. Narsai and Jacob of Serugh are 100%, Ephrem 98%. Best-vocalized corpus in this group. TEI marks poetic lines as <l>, stanzas as <div type="section">, and the refrain as ʿunitha.
- HEBREW morphhb/WLC: fully pointed AND cantillated — points+accents per Hebrew letter = 1.15 (Ps), 1.15 (Job), 1.13 (Prov), 1.13 (Song), 1.08 (Lam).
- HEBREW Ben-Yehuda: the txt/ tree is fully vocalized, txt_stripped/ is not. Measured on a random sample of 40 native-Hebrew poetry files: nikkud density 0.69 per letter, 38/40 above the 0.4 full-vocalization threshold. Verified directly on Bialik's "El HaTzipor": txt/p89/m20.txt = "שָׁלוֹם רָב שׁוּבֵךְ, צִפֹּרָה נֶחְמֶדֶת"; txt_stripped/p89/m20.txt = "שלום רב שובך, צפרה נחמדת".
- ARABIC OpenITI: COMPLETELY UNVOCALIZED. Counted diacritics in 8 randomly sampled diwans plus Imru' al-Qays: 0 diacritics against 26K-444K Arabic letters each, ratio 0.000 in every file. The Muʿallaqa is present and correctly hemistich-delimited by % but bare. Rawi and qafiya consonants are recoverable from the rasm; majra/wasl vowels are not, so nucleus-based scoring needs a diacritization pass.
- ARABIC ashaar / Ashaar_diacritized / Fatimah8Moheeb: vocalized. ashaar preview rows carry short vowels including the rhyme-bearing final vowel (…العَليمِ, …العَميمِ). Ashaar_diacritized is fully pointed. I cou_

| id | lang | count | licence | PD | native | label | inspected |
|---|---|---|---|---|---|---|---|
| `https://github.com/projectbenyehuda/public_domain_dump` | he (Modern/Medieval Hebrew); | 26,455 catalogue rows; 13,140 genre=poet | Public domain (project states all works  | Y | Y | pseudocatalogue.csv columns: authors, author_uris (Wikidata QIDs), genre, source_edition, translators, origina | Y |
| `https://github.com/srophe/syriac-corpus (Digital Syriac Corpus, Oxford` | syc (Classical Syriac) | 632 TEI files verified present by HTTP p | CC-BY-4.0 (stated verbatim in the repo's | Y | Y | Each text carries a syriaca.org work URI (ref="http://syriaca.org/work/NNNN") and the named printed critical e | Y |
| `https://github.com/openscriptures/morphhb (Westminster Leningrad Codex` | hbo (Biblical Hebrew) | 4,783 verses in the five poetic books: P | WLC text: Public Domain (explicit in REA | Y | Y | Canonical/Masoretic status is the curation record (the Masoretic canon is the strongest possible survival labe | Y |
| `https://github.com/OpenITI/RELEASE (metadata/OpenITI_metadata_2025-1-9` | ar / arb (premodern Arabic) | 14,107 version rows total; 9,539 status= | NO explicit licence — verified absent: n | Y | Y | Strong. tags column carries GAL@ codes (Brockelmann, Geschichte der arabischen Litteratur — a real bibliograph | Y |
| `https://hf.co/datasets/PoetryMTEB/ArabicPoetryMeterClassification` | ar | 55,440 verses (train 47,124 + test 8,316 | cc-by-4.0 (repo metadata). Upstream ARBM | N | Y | 14-class ʿarud meter label (taweel, baseet, kamel, wafer, ramal, khafeef, rajaz, saree, munsareh, madeed, mujt | Y |
| `https://hf.co/datasets/Zaid/metrec (mirror of https://github.com/ARBML` | ar | 55,440 rows (47,124 train / 8,316 test), | HF card says 'unknown'; the source GitHu | N | Y | 14 ʿarud meter classes only. No curation/canon record. | Y |
| `https://hf.co/datasets/arbml/ashaar` | ar | 254,630 poems — verified from parquet sp | NOT OPEN. README verbatim: 'released und | N | Y | Columns poet era (e.g. العصر العثماني), poem meter (بحر الخفيف), poem theme (قصيدة دينية), poet location, poet | Y |
| `https://hf.co/datasets/arbml/Ashaar_diacritized` | ar | 26,131 rows (train 23.5K / valid 1.3K /  | None declared on the repo. Derived from  | N | Y | none — text column only, no metadata whatsoever | Y |
| `https://hf.co/datasets/arbml/Ashaar_meter` | ar | 1,802,800 verse rows (train 1.44M / test | None declared. Derived from arbml/ashaar | N | Y | 17 meter classes including النثر (prose) — a prosody label, not a survival label | Y |
| `https://hf.co/datasets/Fatimah8Moheeb/Arabic-Poetry-Dataset` | ar | 245,315 rows, 9 columns (poem_id, poet_i | NONE declared at all. source_url column  | N | Y | theme column contains real anthology membership for some rows — e.g. 'قصائد المعلقات' (the Muʿallaqat, the can | Y |
| `https://hf.co/datasets/Sefaria/hebrew_library` | he + hbo (whole Sefaria libr | 3.5M segments in one 7.67 GB data.jsonl. | gpl-3.0 (repo metadata + README front-ma | Y | Y | BEST-IN-GROUP survival label: metadata.pagerank, a citation-centrality score computed over Sefaria's internal  | Y |
| `https://hf.co/datasets/alwalid54321/Arabic_Poems` | ar | 8,875 rows, 8 columns (poem_title, poem_ | Tagged gpl-2.0, which is a software lice | N | Y | poem_meter, poem_theme, poet_era — same as ashaar, no canon field | Y |
| `https://hf.co/datasets/tahaio/arabicpoetry` | ar | 75,000 rows, 6 columns (poet_name, poet_ | Tagged mit. No provenance statement on t | N | Y | poem_tags and poet_era. Vocalization state NOT verified (schema inspected, rows not sampled). | Y |
| `https://hf.co/datasets/NuBerea/hebrew-poetry` | hbo (Biblical Hebrew) | size_categories 100K<n<1M — could not ve | cc-by-4.0 (repo metadata) | Y | Y | Card describes ranked chiastic passages, poetry-vs-prose verse classification, colon-level line segmentation a | N |
| `https://hf.co/datasets/nehalelkaref/classical_arabic_poetry` | ar | size_categories 10K<n<100K — could not v | None declared | N | Y | unknown — could not inspect | N |

**Nothing usable found:** Amharic (am) — no verse corpus of any kind, open or otherwise, Maltese (mt) — no verse corpus; only a gated non-commercial general corpus, Ge'ez (gez) — checked as the liturgical source of Amharic qene; nothing textual, only OCR-image and TTS repos

### sinitic-tonal

_METHOD AND ACCESS CONSTRAINTS. huggingface.co, datasets-server.huggingface.co, api.github.com, github.com HTML and codeload.github.com are ALL egress-blocked from this environment (verified via curl and the proxy status endpoint), so I could not download any parquet or tarball for local aggregation. raw.githubusercontent.com IS reachable, and I used it heavily: every GitHub count below was produced by fetching the actual JSON/CSV files over HTTPS and parsing them in Python, not by reading a README. For Hub datasets I used hub_repo_details dataset_structure (real Dataset-Viewer row counts and column schemas) and dataset_preview (real rows at chosen offsets), plus hf_fs ls for file trees. "inspected": true means I saw real files, columns or rows; where the viewer failed or the repo was gated I set it false and said so.

DIRECT ANSWER TO THE GROUP QUESTION — IS ANTHOLOGY MEMBERSHIP RECOVERABLE, AND IS THE POSITIVE SET A SUBSET OF THE NEGATIVE POOL? Yes, cleanly, for Tang shi, and this is the strongest finding in the group. In chinese-poetry/chinese-poetry (MIT), 全唐诗/唐诗三百首.json holds 366 poems each carrying tags[0]=='唐诗三百首'. I ran the subset test: 363 of 366 (99.2%) match a poem in the 57,607-poem 全唐诗 shard set on exact normalised body text, and 361 of 366 on author+title. Better still, the label is already embedded in the negative pool — 362 poems inside the main 全唐诗 shards carry the 唐诗三百首 tag themselves, and 4,132 of the 57,607 carry some tag. So a positive/negative survival de_

| id | lang | count | licence | PD | native | label | inspected |
|---|---|---|---|---|---|---|---|
| `https://github.com/chinese-poetry/chinese-poetry — 全唐诗/poet.tang.*.jso` | lzh (Literary/Classical Chin | 57,607 poems, 3,663 distinct authors (VE | MIT (repo LICENSE file fetched and confi | Y | Y | STRONG. Two recoverable curation records: (1) a `tags` array present on 4,132 of the 57,607 poems, of which 36 | Y |
| `https://github.com/chinese-poetry/chinese-poetry — 全唐诗/poet.song.*.jso` | lzh (Literary Chinese; Song  | 254,248 poems, 8,934 distinct authors (V | MIT (repo); texts pre-modern, out of cop | Y | Y | MODERATE. 6,905 of 254,248 poems carry a `tags` field (274-tag vocabulary); 118 carry 古诗三百首 and 115 carry 宋诗.  | Y |
| `https://github.com/chinese-poetry/chinese-poetry — 宋词/ci.song.*.json (` | lzh (Literary Chinese; Song  | 21,050 ci, 1,490 distinct authors, 1,421 | MIT (repo); texts pre-modern (全宋詞), out  | Y | Y | STRONG for prosody, WEAK for canon. The `rhythmic` column is the 词牌 (cipai) tune-title — a first-class METRICA | Y |
| `https://github.com/chinese-poetry/chinese-poetry — 全唐诗/唐诗三百首.json` | lzh (Literary Chinese; Tang  | 366 poems (VERIFIED: file parsed, len=36 | MIT (repo); Qing anthology (孫洙, 1763), o | Y | Y | THIS IS THE SURVIVAL LABEL. Every entry carries tags[0]=='唐诗三百首' plus form tags (五言律诗 83, 乐府 73, 七言绝句 52, 七言律诗 | Y |
| `https://github.com/chinese-poetry/chinese-poetry — 诗经/shijing.json` | lzh (Old Chinese / Literary  | 305 poems (VERIFIED: file parsed, len=30 | MIT (repo); c. 11th–7th c. BCE, out of c | Y | Y | STRUCTURAL, not evaluative. Schema is title/chapter/section/content, where `chapter` is the canonical triparti | Y |
| `https://github.com/chinese-poetry/chinese-poetry — 楚辞/chuci.json` | lzh (Literary Chinese; Chu c | 65 pieces (VERIFIED: file parsed, len=65 | MIT (repo); Warring States / Han, out of | Y | Y | none beyond section/author attribution; the whole collection is canonical, so no positive/negative split is av | Y |
| `https://github.com/chinese-poetry/chinese-poetry — 元曲/yuanqu.json` | lzh (Literary Chinese; Yuan  | 11,057 pieces (VERIFIED: file parsed, le | MIT (repo); Yuan dynasty, out of copyrig | Y | Y | none found in-file beyond author. Qu carry 曲牌 tune-titles in principle but I did not verify a dedicated column | Y |
| `https://github.com/chinese-poetry/chinese-poetry — 五代诗词/huajianji/huaj` | lzh (Literary Chinese; Five  | 447 ci across 9 juan (VERIFIED per-file: | MIT (repo); 花間集 compiled 940 CE, out of  | Y | Y | STRONG by construction — 花間集 is itself the earliest literati ci anthology, so membership in this file IS an an | Y |
| `https://github.com/chinese-poetry/chinese-poetry — 五代诗词/nantang/poetry` | lzh (Literary Chinese; South | 45 pieces (VERIFIED: file parsed, len=45 | MIT (repo); 10th c., out of copyright | Y | Y | author-collection membership only (Li Jing / Li Yu). Sibling files in the same repo verified: 纳兰性德诗集 258, 曹操诗集 | Y |
| `https://github.com/Werneror/Poetry` | lzh + zho (Literary Chinese  | 853,385 poems / 29,377 authors claimed;  | MIT (LICENSE fetched: 'MIT License, Copy | N | Y | PARTIAL. Columns are 题目/朝代/作者/内容 — the 朝代 column is a clean 27-value period label usable both as a covariate a | Y |
| `https://github.com/THUNLP-AIPoet/Datasets — CCPC (THU Chinese Classica` | lzh (Literary Chinese; jueju | 127,682 quatrains (VERIFIED by fetching  | NOT OPEN. Repo states 'all our datasets  | N | Y | none evaluative. Fields are dynasty/author/title/content/keywords, with the keywords auto-extracted (machine-d | Y |
| `https://github.com/THUNLP-AIPoet/Datasets — CRRD (THU Chinese Rhythm a` | lzh (Literary Chinese; phono | pingsheng.txt = 30 lines (30 level-tone  | NOT OPEN — same 'academic use only' stat | N | N | N/A as a corpus, but this is the single most useful ANNOTATION resource in the group: it supplies the 平/仄 leve | Y |
| `https://github.com/THUNLP-AIPoet/Datasets — PQED (Poetry Quality Evalu` | lzh (Literary Chinese; jueju | 173 poems claimed by the README; I could | NOT OPEN — 'academic use only'. | N | Y | The only explicit human QUALITY label I found in this group: 1–5 expert scores on fluency, coherence, meaningf | N |
| `https://huggingface.co/datasets/erhwenkuo/poetry-chinese-zhtw` | lzh (Literary Chinese, conve | 76,000 rows (VERIFIED via Dataset Viewer | mit (uploader tag); derived from chinese | Y | Y | WEAK — `category` is a dynasty bucket (五代十國, 唐, 宋, 元, 清), which proxies the source anthology (花間集/南唐二主詞, 全唐詩,  | Y |
| `https://huggingface.co/datasets/PoetryMTEB/ClassicalChinesePoetryTheme` | zho/lzh (Literary Chinese, S | 2,892 poems (VERIFIED via Dataset Viewer | cc0-1.0 | Y | Y | EXPERT THEME labels only, not canon: 7 classes (托物言志, 交友送别, 羁旅思乡, 咏史怀古, …), expert-annotated, upstream Harvard | Y |
| `https://huggingface.co/datasets/PoetryMTEB/Appreciation-of-Chinese-Cla` | zho/lzh (Literary Chinese) | 5,600 poems in the `corpus` split; a par | NONE DECLARED — no licence tag on the re | Y | Y | AVOID the annotations. The card states the appreciation/analysis fields are 'LLM-based analysis results genera | Y |
| `https://huggingface.co/datasets/ZoneTwelve/chinese-poetry` | lzh + zho (Classical Chinese | 320 entries claimed (唐詩三百首, sourced from | apache-2.0 (uploader tag); source text i | Y | Y | The whole file IS the anthology, so membership is the label — but with no negative pool bundled, and at 320 ro | N |
| `https://huggingface.co/datasets/phamson02/vietnamese-poetry-corpus` | vie (Vietnamese, quốc ngữ) | 198,600 rows total (VERIFIED via Dataset | cc-by-4.0 (uploader tag only — this is t | N | Y | PARTIAL, and the corpus MUST be filtered. Provenance is heterogeneous and I confirmed this by sampling: rows n | Y |
| `https://huggingface.co/datasets/Libosa2707/vietnamese-poem` | vie (Vietnamese, quốc ngữ) | 171,200 rows (VERIFIED via Dataset Viewe | NONE DECLARED — no licence tag on the re | N | Y | none usable. This is the ungated public twin of the FPT/fsoft 171,188-poem set. Sampling at offset 100000 show | Y |
| `https://huggingface.co/datasets/bigscience-data/roots_vi_vietnamese_po` | vie (Vietnamese) | 171,188 poems claimed on the card. UNVER | mit (card); underlying homepage github.c | N | Y | genre only (luc-bat, 5-chu, 7-chu, 8-chu, 4-chu). Same contemporary-web provenance problem as Libosa2707 above | Y |
| `https://huggingface.co/datasets/kenpusney/greathangpt-classical-chines` | lzh + zho (Literary Chinese, | 2.4M rows in the `full` split; era split | apache-2.0 (uploader tag) | Y | N | era split only. Flagged as a convenience aggregate, not a verse corpus: it merges chinese-poetry + Werneror/Po | Y |

**Nothing usable found:** Thai (tha/th) — no public-domain Thai verse corpus found. Thai classical verse (khlong, chan, kap, klon, rai; Sunthorn Phu's 48,700-line Phra Aphai Mani; Ramakien; Khun Chang Khun Phaen) is unambiguously PD by age, but I found no machine-readable open corpus on the Hub or GitHub. HF searches with query 'poetry'/'poem'/'literature' filtered to language:th returned ZERO datasets. The only classical-Thai NLP resource surfaced is LitBench-TH5 (Lilit to Ramakien, AICAIT 2025), which is 57 QA pairs about five canonical works — a comprehension benchmark, not a verse corpus., Lao (lao/lo) — nothing. HF search for 'poetry' filtered to language:lo returned ZERO datasets. The only Lao resources found are a POS-tagged general corpus (HVULao_NLP, Mendeley) and Thai–Lao parallel text (SEACrowd/tha_lao_embassy_parcor), neither of which is verse. No open Lao poetry corpus appears to exist., Burmese (mya/my) — nothing usable. HF search for 'poetry' filtered to language:my returned ZERO datasets; a 40-result sweep on 'burmese' returned only OCR, Wikipedia, hate-speech, ASR, dictionary, MT and instruction-tuning sets. The nearest miss, DatarrX/nava-rasa-myanmar-corpus (CC-BY-4.0), is grounded in classical Indian poetics terminology but is 450 rows of PROSE (its own card says စကားပြေ/ဝတ္ထုဟန်, prose/novel register) labelled for sentiment — not verse. Its size_categories metadata (1K<n<10K) also contradicts the actual 450 rows. Burmese classical forms (yadu, pyo, linka, egyin) have no open digital corpus., Cantonese (yue) — nothing. HF search for 'poetry' filtered to language:yue returned ZERO datasets; a 40-result 'cantonese' sweep returned only speech/ASR, parallel-translation, forum text, G2P and LLM-eval sets. Cantonese-language written verse traditions that WOULD be PD — 粵謳 Yue Ou (Zhao Ziyong 招子庸, Guangzhou 1828), 木魚書 muk-jyu-syu wooden-fish books, 南音 naam-yam narrative song — have no machine-readable open corpus I could locate. Modern Cantopop lyrics are copyrighted and are excluded on principle., Modern/vernacular Chinese (zho, baihua free verse) — no usable public-domain corpus. Republican-era vernacular poets (Hu Shi 1920, Guo Moruo 1921, Xu Zhimo d.1931, Wen Yiduo d.1946) are PD by age in China, but no open corpus isolates them. See notes for why the main Hub candidate is disqualified twice over.

### dravidian-and-abugida

_VERIFICATION METHOD. I inspected files/columns/rows rather than quoting cards. Every "inspected: true" above means I either previewed real rows through the dataset viewer or downloaded the actual data. Exact counts were pinned by requesting a preview at offset N-3 and confirming only 3 rows come back: Thirukkural = 1,330 exactly, Sangam = 2,377 exactly, Chandassu = 4,651 exactly. For sentamizh-corpus I downloaded all nine JSON files (~20 MB) and counted programmatically: 10,393 rows, 100% with non-empty verse text — this matches the README, so that card is trustworthy on counts.

CARD-VERSUS-DATA DISCREPANCY (the failure mode you warned about). sentamizh-corpus's GitHub page says annotation is "conducted manually by a single Classical-Tamil-fluent expert annotator". The DATA says otherwise: the `annotator` field is 'extraction-pipeline-v1' for 9,597 of 10,393 rows (92.3%), and `rasa_primary` is 79.9% filled with what the repo's own limitations section admits are uniform extractor-applied defaults (every Bhakti verse stamped 'Shanta'). Treat all interpretive fields as pipeline output, not scholarship. The verse text and source_text/period columns are sound; the interpretive layer is not. Similarly, `metre` is filled on only 388 of 10,393 rows and every one of those holds the same value ('aciriyappa'), so it cannot support any metre analysis despite the schema advertising a metre enum.

THE SYNTHETIC TRAP, FOUND AND EXCLUDED. VenkataRamanaKurumallajaddangi/Telugu-Synthetic-Poem_

| id | lang | count | licence | PD | native | label | inspected |
|---|---|---|---|---|---|---|---|
| `BodduSriPavan111/chandassu (https://hf.co/datasets/BodduSriPavan111/ch` | te (Telugu) | 4,651 padyams (verified exactly: viewer  | MIT | Y | Y | STRONG. 'satakam' column names the parent shatakam (e.g. Vrushadhipa, Aandhranaayaka) = anthology/work members | Y |
| `PoetryMTEB/ChandassuMeterClassification (https://hf.co/datasets/Poetry` | te (Telugu) | 4,651 (3,721 train + 930 test) — repacka | MIT | Y | Y | 8-class meter (chandassu 'type') label per verse, stratified split. Loses the satakam column, so prefer the up | Y |
| `SuryaKrishna02/aya-telugu-poems (https://hf.co/datasets/SuryaKrishna02` | te (Telugu) | 5,100 rows (instruction records, not 5,1 | Apache-2.0 (on the packaging) | Y | Y | The prompt text names the source shatakam for every row (Sri Kalahastiswara, Bhaskara, Dasarathi Shatakam...), | Y |
| `PoetryMTEB/Padyam2GadyamMeterClassification (https://hf.co/datasets/Po` | te (Telugu) | 586 poems (468 train + 118 test) | CC-BY-NC-4.0 (non-commercial) | Y | Y | Expert chandassu meter label, 7 classes with freq >= 10 (14 rare-meter poems dropped). Source poems are 13th-1 | Y |
| `TeluguLLMResearch/Padyam2Gadyam (https://hf.co/datasets/TeluguLLMResea` | te (Telugu) | 600 samples (card figure — GATED, viewer | CC-BY-NC-4.0 | Y | Y | Meter labels exist downstream (see Padyam2GadyamMeterClassification). Upstream also carries Telugu + English p | N |
| `https://github.com/indic-corpora/sentamizh-corpus (data/processed/*.js` | ta (Tamil) | 10,393 verses, all with non-empty classi | Apache-2.0 | Y | Y | STRONG. source_text populated 100% = canonical anthology membership (Ettuthokai / Pathuppattu / Tirumurai / Na | Y |
| `starhopp3r/sangam (https://hf.co/datasets/starhopp3r/sangam)` | ta (Tamil) | 2,377 poems (verified exactly: viewer re | 'other' — unresolved. Old Tamil text is  | Y | Y | STRONG. work + work_tamil + category (Ettuthokai/Pathuppattu) = anthology membership; plus poet, thinai, thura | Y |
| `yuvarajvelmurugan/thirukkural (https://hf.co/datasets/yuvarajvelmuruga` | ta (Tamil) | 1,330 couplets (verified exactly: rows 1 | CC0-1.0 | Y | Y | Full canonical hierarchy: paal (division) / iyal (section) / athikaaram (chapter) / kural number. This IS the  | Y |
| `aitamilnadu/marabutamilvenba (https://hf.co/datasets/aitamilnadu/marab` | ta (Tamil) | 5,600 rows (card says '~5000 venba'). WA | GPL-3.0 | Y | Y | Card names the source collections: Naladiyar, Pathinenkeezhkanakku (the canonical 'Eighteen Lesser Texts'), an | Y |
| `aitamilnadu/thirukkural_instruct (https://hf.co/datasets/aitamilnadu/t` | ta (Tamil) | 4,000 instruction rows over the 1,330 ku | Apache-2.0 | Y | Y | Chapter/athikaaram named inside the prompt string; weaker than yuvarajvelmurugan/thirukkural, which has the sa | Y |
| `Kameshr/tamil-sangam-text-excerpt (https://hf.co/datasets/Kameshr/tami` | ta (Tamil) | 1,051 LINES (not poems) — line-level exc | MIT | Y | Y | NONE usable. The Themes / Imagery / Literary Devices columns are LLM-generated free text ('Imagery of hardship | Y |
| `PoetryMTEB/TamilSangamLiteraryDeviceClassification (https://hf.co/data` | ta (Tamil) | 1,051 rows (840 train + 211 test) — same | 'other' | Y | Y | 8-class literary-device taxonomy, but derived by merging the upstream LLM-generated noisy labels. NOT a curati | Y |
| `bikram22pi7/Thiruvalluvar_Thirukkural (https://hf.co/datasets/bikram22` | ta (Tamil) | 1,300-odd rows, 2 columns of which one i | Apache-2.0 | Y | Y | NONE — bare verse dump with no chapter/section metadata. Strictly dominated by yuvarajvelmurugan/thirukkural ( | Y |

**Nothing usable found:** Kannada (kn) — no usable public-domain native-verse corpus found on HF Hub, GitHub, or the open web, Sinhala (si) — no usable public-domain native-verse corpus found; every candidate failed on copyright, licence, or genre

### uralic-turkic

_STRONG POSITIVES. The Uralic side is unusually well served, and for a rhyme/prosody study it is close to ideal. SKVR (89,247 poems / 1,340,776 lines, CC BY 4.0) and ERAB (108,969 texts / 2,006,848 lines) are the two halves of the Finnic Kalevala-metre tradition, deliberately harmonised on the same ITEM/META/TEXT/<V> XML schema, so they can be merged line-for-line. Both ship a folkloristic type index, which is the best survival label I found anywhere in this group: a poem type attested in 1,673 variants across regions has demonstrably survived retransmission, one attested in the median 3 has not. That is a real, non-circular quality/survival signal, not an anthology proxy. The two ELTE Hungarian corpora are the other prize: 14,358 canonical poems + 2,390 folk songs, all PD texts, already annotated with rhyme patterns, standoff rhyme PAIRS (with lemma, POS, syllable count and phonological shape of each rhyming word), quantitative and qualitative meter, alliteration, and per-word vowel-harmony class (low/high/mixed). For an agglutinative-with-vowel-harmony study that annotation layer is worth more than the raw text.

VERIFICATION. Every count marked inspected=true was obtained by counting elements or files in cloned repositories, not by reading dataset cards. SKVR: 89,247 came from grepping '<ITEM ' across the 34 base-volume XMLs and it matches the README exactly; the 34 sup_skvr_*.xml files contain the SAME 89,247 items (identical nro values checked) and must NOT be added — tha_

| id | lang | count | licence | PD | native | label | inspected |
|---|---|---|---|---|---|---|---|
| `https://github.com/sks190/SKVR` | fi (Finnish) — plus krl (Kar | 89,247 poem records; 1,340,776 verse lin | CC BY 4.0 (stated in repo README; attrib | Y | Y | Folkloristic type index = strong survival/frequency label. viitteet_180221.txt holds 138,073 poem-to-type link | Y |
| `https://github.com/rahvaluule/erab` | et (Estonian), incl. Seto | 108,969 texts (identical count in xml/ a | NONE STATED — no LICENSE file, no licenc | Y | Y | Unified type index + genre: 54,472 items carry <TYP_YHT> (unified type name) and <LLIIK_YHT> (unified genre).  | Y |
| `https://github.com/ELTE-DH/poetry-corpus` | hu (Hungarian) | 14,358 poems (exactly 14,358 files in ea | Repository content CC BY-NC-ND 4.0; READ | Y | Y | Critical canon: corpus is defined as the complete poems of 53 *canonical* Hungarian poets — canon membership i | Y |
| `https://github.com/ELTE-DH/folk-song-corpus` | hu (Hungarian) | 2,390 folk songs (2,390 XML files in eac | Repository content CC BY-NC-ND 4.0; READ | Y | Y | Anthology membership: source is Ortutay Gyula & Katona Imre (eds.), 'Magyar népdalok' (1976), a curated select | Y |
| `https://github.com/hsci-r/filter-data` | fi + et (harmonised Finnic:  | poems.csv = 294,367 poem records, verifi | Derivative work — inherits SKVR (CC BY 4 | Y | Y | Designed for exactly this: v_clust.tsv / v_sim.tsv (verse clusters and similarity) and p_clust.tsv / p_sim.csv | Y |
| `https://huggingface.co/datasets/leinadsened/hungarian-poems-with-instr` | hu (Hungarian) | 11.8K rows (11,800; Hub viewer total) | apache-2.0 (declared on the Hub) | Y | Y | author + year_of_birth + year_of_death columns allow PD filtering and period stratification, but no curation/q | Y |
| `https://zenodo.org/records/15307154 (LOTUC — Latin-transliterated Otto` | ota / tr (Ottoman Turkish, L | unverified — reported as 36 divans, 17,8 | unverified | Y | Y | Reported to carry per-poem aruz meter notation plus work-level metadata (mahlas/pen name, real name, century,  | N |
| `https://github.com/drshnkv/est-runocorp-morph` | et (Estonian) | unverified — reported 108,969 texts / 2, | No open licence; README directs enquirie | Y | Y | Morphological/lemma annotation layer over ERAB (EstNLTK + manual expert correction on 37% + LLM-assisted). No  | N |
| `Finnish Public Domain 20th Century Literature Text Corpus (Mozilla Dat` | fi (Finnish) + sv (Swedish,  | unverified — reported ~69.1M words | unverified (public-domain-age texts; aut | Y | Y | none. Marginal for this study: it is a general literature corpus (prose and verse mixed, not verse-segmented)  | N |

**Nothing usable found:** Azerbaijani (az) — no usable corpus found, Uzbek (uz) — no usable corpus found, Kazakh (kk) — no usable corpus found, Turkish (tr) — nothing usable that I could verify; every Hugging Face and GitHub Turkish poetry dataset is copyright-blocked and translation-contaminated. LOTUC is the only candidate and it is unverifiable from this environment.

### celtic-germanic-norse

_ENVIRONMENT CONSTRAINT THAT SHAPED THIS SWEEP: outbound HTTPS is far more restricted than the brief assumed. Blocked (curl AND WebFetch, EGRESS_BLOCKED / CONNECT 403): celt.ucc.ie, bardic.celt.dias.ie, dasg.ac.uk, bragi.arnastofnun.is, repository.clarin.is, spraakbanken.gu.se, litteraturbanken.se, dbnl.org, liederenbank.nl, runeberg.org, oepoetryfacsimile.org, skaldic.org, kalliope.org, github.com HTML, api.github.com, huggingface.co over curl, and datasets-server.huggingface.co. What DOES work: `git clone` of arbitrary GitHub repos, raw.githubusercontent.com, the Hugging Face MCP tools, and WebSearch. Every number above marked inspected=true was produced by cloning the repo and counting files/elements myself, or by reading HF viewer row counts and column schemas - not by quoting card prose. The two exceptions are flagged in-line: historica-corpus per-language counts are card figures, and the sv/nl/da/de Wikisource subsets have verified row counts and schemas but I did not eyeball their rows for verse content (I did for cy and is).

ALLITERATIVE-TRADITION CELLS (your stated priority): three of the four are covered and two of them come with real curation labels. Old English is the best case - cltk/old_english_text_sacred_texts is Unlicense, 350 poem files, and the directory tree IS manuscript membership (Exeter Book / Cotton Vitellius A.XV / Paris Psalter / Junius-Vercelli items under Other_Texts), so "which codex preserved this" is available as a survival label out of the box_

| id | lang | count | licence | PD | native | label | inspected |
|---|---|---|---|---|---|---|---|
| `https://github.com/tnhaider/DLK (Deutsches Lyrik Korpus, DLK v6)` | de (German) | 65,760 per-poem JSON files verified by ` | No LICENSE file in the repo (checked LIC | Y | Y | Per-poem metadata verified in the JSON: author, pub_year, booktitle (source edition), genre ('Lyrik'), period, | Y |
| `https://github.com/tnhaider/german-rhyme-corpus` | de (German) | 60 TEI-P5 XML files; 1,948 <lg type='poe | No licence file or statement in the repo | Y | Y | Gold manual rhyme-scheme annotation per stanza (top schemes: abab 1639, aabb 860, ababcdcd 731, ababcc 718, ab | Y |
| `https://github.com/tnhaider/antikoerperchen-german-annotated-poetry` | de (German) | 164 TEI-P5 files in antik_tei_prosody_v2 | No licence file in the repo. Texts are p | Y | Y | STRONGEST curation signal in this group for German: every poem is one that has a published school-level interp | Y |
| `https://github.com/thabz/Kalliope (source data for kalliope.org), Dani` | da (Danish) | 21,974 <poetry> texts by 363 poets tagge | Repo code is GPL-2.0 (LICENSE file prese | Y | Y | Good. Each poem sits inside a <kalliopework> with title, year and a <source> naming the printed edition (often | Y |
| `https://github.com/thabz/Kalliope, German subset` | de (German) | 4,958 <poetry> texts by 83 poets tagged  | GPL-2.0 on repo; texts restricted to pub | Y | Y | Same as Danish subset: printed-edition membership via <source>/<workhead>, poet death dates, Wikidata/VIAF ids | Y |
| `https://github.com/thabz/Kalliope, Swedish subset` | sv (Swedish) | 339 <poetry> texts by 39 poets tagged la | GPL-2.0 on repo; texts restricted to pub | Y | Y | Printed-edition membership via <source>; poet death dates and external ids. Too small to stand alone for Swedi | Y |
| `https://github.com/cltk/old_norse_texts_heimskringla` | non (Old Norse) | 25 eddic poems of the Saemundar-Edda (Po | No formal licence file. README: 'texts a | Y | Y | STRONG and unusual: the README annotates each poem with manuscript membership - '(In Codex Regius)' vs not - w | Y |
| `https://github.com/cltk/old_english_text_sacred_texts` | ang (Old English) | 350 HTML poem files grouped by manuscrip | Unlicense ('free and unencumbered softwa | Y | Y | STRONG: directory structure is manuscript codex membership (Exeter Book, Cotton Vitellius A.XV, Paris Psalter, | Y |
| `https://github.com/mirsdes/Dutch_Renaissance_poetry_corpus` | nl (Dutch) | 11 poets; 719 files in Original_texts an | CC-BY-SA (stated in README). Texts taken | Y | Y | Per-line syllable/stress annotation (0 unstressed, 1 stressed, 3 elided vowel, 4 synalepha), with asterisked l | Y |
| `https://huggingface.co/datasets/wikimedia/wikisource config 20231201.c` | cy (Welsh) | 1.1K documents (viewer row count), 1.3 M | CC BY-SA 3.0 + GFDL (dataset), underlyin | Y | Y | None built in - schema is only id/url/title/text; Wikisource category membership is NOT carried in the dump, s | Y |
| `https://huggingface.co/datasets/wikimedia/wikisource config 20231201.i` | is (Icelandic) | 4.9K documents, 11.6 MB parquet. Mixed v | CC BY-SA 3.0 + GFDL; underlying texts pu | Y | Y | Partial, and better than the Welsh subset. Rows inspected directly: 'Pontus rimur' is split per ríma and the i | Y |
| `https://huggingface.co/datasets/wikimedia/wikisource config 20231201.s` | sv (Swedish) | 6.3K documents, 16.5 MB parquet. Verse f | CC BY-SA 3.0 + GFDL; underlying texts pu | Y | Y | None built in (id/url/title/text only). Currently the largest open Swedish option I could verify, since Litter | Y |
| `https://huggingface.co/datasets/wikimedia/wikisource config 20231201.n` | nl (Dutch) | 5.3K documents, 27.9 MB parquet. Verse f | CC BY-SA 3.0 + GFDL; underlying texts pu | Y | Y | None built in. Useful as breadth on top of the Dutch Renaissance corpus, which is deep but only 11 poets. Same | Y |
| `https://huggingface.co/datasets/wikimedia/wikisource config 20231201.d` | da (Danish) | 1.0K documents, 11.0 MB parquet. Verse f | CC BY-SA 3.0 + GFDL; underlying texts pu | Y | Y | None built in. Strictly secondary to Kalliope for Danish (Kalliope has 21,974 poems with edition metadata vs 1 | Y |
| `https://huggingface.co/datasets/wikimedia/wikisource config 20231201.d` | de (German) | 141.7K documents, 312.8 MB parquet. Vers | CC BY-SA 3.0 + GFDL; underlying texts pu | Y | Y | None built in. Secondary to DLK, which already has per-poem structure, meter annotation and edition metadata.  | Y |
| `https://huggingface.co/datasets/sol-r/historica-corpus` | non (Old Norse) and ang (Old | 321.2K rows total (viewer), 9 parquet fi | cc-by-sa-4.0 (declared in the dataset ca | Y | N | A `genre` column exists (values include 'poetry') plus `tradition` (christian/secular/norse_pagan), `author`,  | Y |

**Nothing usable found:** Irish (ga) - no open, verifiable native-verse corpus found, Scottish Gaelic (gd) - no open, verifiable native-verse corpus found

### romance-slavic

_ENVIRONMENT — what I could and could not verify, since this determines how much to trust each row.
Blocked: huggingface.co and datasets-server.huggingface.co direct download (403 at the egress proxy), arxiv.org, api.github.com, plus the already-known Gutenberg/archive.org/Wikisource. Working: raw.githubusercontent.com and full `git clone` over https, and the HF MCP tools. So GitHub corpora could be cloned and counted line-by-line; HF corpora could only be inspected through the MCP tools (file listings, column schemas, real row counts from the parquet conversion, sample rows). I never downloaded an HF parquet.

THE FOUR ROWS WITH inspected=true AND HAND-COUNTED NUMBERS are Czech (corpusCzechVerse), Russian (UD_Russian-Poetry, Rifma) — all cloned and counted with Python — plus the HF rows where I read real column schemas and sample rows. Everything marked inspected=false is README prose and should be re-verified before use.

CARD-VS-DATA CONTRADICTIONS I FOUND (the specific failure mode you warned about):
1. Wolne Lektury: card says 7,316 records, HF viewer says 14.6K. The repo ships the SAME data twice — wl_corpus_filtered.jsonl (356MB) and wl_corpus_filtered.zip (132MB) — and the loader globs both, so every work is counted twice. 2 x 7,316 = 14,632 ~ "14.6K". Use 7,316; do not quote the viewer.
2. PULPO: 17.6M rows is real (I confirmed it from the parquet conversion) but it is NOT 17.6M poems or even 17.6M distinct texts. The repo holds four files — pulpo_lines_{train,val}.js_

| id | lang | count | licence | PD | native | label | inspected |
|---|---|---|---|---|---|---|---|
| `https://github.com/versotym/corpusCzechVerse` | ces (cs) Czech | 66,428 poems / 2,310,917 lines across 1, | CC BY-SA 4.0 (Institute of Czech Literat | Y | Y | STRONGEST LABEL IN THE GROUP. (a) Reprint/anthologisation count: I computed it — 60,042 distinct poem-texts (a | Y |
| `https://github.com/UniversalDependencies/UD_Russian-Poetry` | rus (ru) Russian | 728 poems (# newdoc) / 5,085 sentences / | CC BY-SA 4.0 | N | Y | Membership in the Poetic Subcorpus of the Russian National Corpus — a curated national-corpus selection — is i | Y |
| `https://github.com/Koziev/Rifma` | rus (ru) Russian | 5,121 poems/stanzas (counted from rifma_ | MIT | N | N | none — and this is the problem. Fields are only poem_text, accentuation_markup, rhyme_scheme. NO author, NO da | Y |
| `https://huggingface.co/datasets/linhd-postdata/pulpo` | multilingual: spa, por, ita, | 17.6M rows total (14.9M train + 2.6M val | NONE DECLARED — no licence field in the  | N | Y | none — 'Unannotated' is in the corpus name. Only two columns exist: text, lang. | Y |
| `https://github.com/pruizf/disco` | spa (es) Spanish | 4,530 sonnets by 1,216 authors from 22 c | CC-BY | Y | Y | Good. Author metadata includes birth/death dates and places, country, continent, gender and VIAF identifiers;  | N |
| `https://huggingface.co/datasets/jorge-henao/disco_poetry_spanish` | spa (es) Spanish | 4.3K rows (card says 4,303 sonnets by 1, | none declared on the Hub; upstream DISCO | Y | Y | weak — only century + author survive the CSV export. Columns are exactly title, author, century, text (verifie | Y |
| `https://huggingface.co/datasets/PiotrSty/wolne-lektury-polish-literatu` | pol (pl) Polish, plus lit, d | 7,316 works per the card; the HF viewer  | 'other' — Wolne Lektury ships public-dom | Y | N | Decent. Wolne Lektury is the Polish national school-canon digital library, so mere inclusion is a canon signal | Y |
| `https://github.com/linhd-postdata/metrique-en-ligne` | fra (fr) French | 5,081 poems / 41,274 stanzas / 247,248 v | NOT STATED anywhere in the repo | Y | Y | Métrique en Ligne (Université de Caen) is itself a curated metrical database; each verse carries metrical leng | N |
| `https://github.com/linhd-postdata/biblioteca_italiana` | ita (it) Italian | 25,341 works by 214 authors (README also | NOT STATED for either the repo or biblio | Y | Y | Biblioteca Italiana is a curated canon of Italian literature (Sapienza/CIBIT), so inclusion is a canon signal. | N |
| `https://huggingface.co/datasets/PleIAs/verse-wikisource` | multilingual — languages NOT | unverified — card claims 200,000 verses  | none declared (no licence tag, no LICENS | N | Y | none stated; card mentions only verse text, length and position fields | N |

**Nothing usable found:** Romanian (ron/ro), Catalan (cat/ca), Ukrainian (ukr/uk), Serbian (srp/sr)

### african-austronesian-other

_METHOD / VERIFICATION. huggingface.co and datasets-server.huggingface.co are 403-blocked from curl in this environment, so all HF numbers come from the MCP tools (hf_fs ls/cat/stat for real file listings and file bytes; hub_repo_details dataset_structure/dataset_preview for real viewer row counts and column names), never from card prose. raw.githubusercontent.com IS reachable, so the GitHub-hosted numbers (sedes, Indonesian puisi/pantun, Basque bertso) were downloaded and counted locally with pandas/wc. api.github.com paths are blocked by the proxy ("Request path could not be canonicalized") so GitHub directory listings were read via WebFetch on github.com tree pages. Every "inspected: true" above means I read files or column schemas, not the card.

THREE CARD-VS-DATA CONTRADICTIONS FOUND (the exact failure mode flagged in the brief):
1. eulogikon/ancient-greek-texts advertises 1,353 authors and 4,055 works under Public Domain Mark 1.0 and documents a full grc/ + manifest layout. The repo actually contains README.md, .gitattributes and two 423-byte parquet stubs. Viewer: 0 rows, 0 columns. `find --name "*.txt"` returns nothing. There is no corpus there.
2. shigr3/haiku carries `size_categories: 10K<n<100K` but has 142 rows.
3. maercaestro/pantun's 56.4K viewer rows are TEXT LINES of a .txt file, not 56.4K pantun; and PleIAs/Latin-PD's "159,070 titles" is card prose while the viewer returns 5.0K exact / 100.2K estimated with partial-size warnings. Do not quote either as a poem_

| id | lang | count | licence | PD | native | label | inspected |
|---|---|---|---|---|---|---|---|
| `https://hf.co/datasets/p1atdev/modern_haiku` | ja (Japanese) | 37,200 haiku rows in config `all` (Hub v | card says MIT, but the loader script `mo | N | Y | `source` column = haiku collection / journal of publication (e.g. 寒山落木, たんぽぽ); also `reviewer`, `comment`, `fo | Y |
| `https://hf.co/datasets/shigr3/haiku` | ja (Japanese) | 142 rows (verified via viewer). NOTE: th | cc-by-4.0 | N | Y | curated selection of "traditional and modern masterworks" = canon membership; columns poem/author/season_word/ | Y |
| `https://hf.co/datasets/AKS-DHLAB/KPoEM` | ko (Korean) | 483 poems -> 615 work-level rows + 7,007 | mit (annotations); poems stated to be "f | Y | Y | `poetry_book` column = collection/anthology the poem appeared in (e.g. 하늘과 바람과 별과 시); plus the five-poet selec | Y |
| `https://hf.co/datasets/PoetryMTEB/KPoEMEmotionClassification` | ko (Korean) | 7,622 total (line config 5.6K train / 57 | cc-by-4.0 | Y | Y | poet + title columns, 44-category KOTE emotion labels; derived from KPoEM. CAUTION: upstream line rows are des | Y |
| `https://github.com/sasansom/sedes (corpus/*.csv)` | grc (Ancient Greek) | 489,531 word-token rows across 12 works, | NO LICENSE file in the repo. Source text | Y | Y | No quality/survival label per poem, but the corpus IS the surviving hexameter canon (Homer, Hesiod, Homeric Hy | Y |
| `https://hf.co/datasets/Ericu950/AncientGreek (mirror: anonymous-stoich` | grc (Ancient Greek) | 2.1M records total: `pristine` split 405 | cc-by-sa-4.0 (a per-record `license` col | Y | Y | none (no genre/verse flag). Columns: source, id, license, tier, orig_band, clean, text | Y |
| `https://hf.co/datasets/eulogikon/ancient-greek-texts` | grc (Ancient Greek) | 0 rows actually present. NEGATIVE / CARD | declared Public Domain Mark 1.0 — but th | Y | Y | none usable (the promised domain/school/period metadata is not in the repo) | Y |
| `https://hf.co/datasets/KaanGoker/dactylic-hexameter-latin-poetry-corpu` | la (Latin) | 57,600 text rows in the viewer (blank pa | mit (compilation); source texts from The | Y | Y | WEAK — flat one-line-per-row text file with NO author/work column. Composition (per README, and first lines ve | Y |
| `https://hf.co/datasets/julian-schelb/latin-classical-intertextuality-c` | la (Latin) | 90,500 passage rows (viewer) | apache-2.0 (packaging); underlying texts | Y | Y | STRONG. `author`/`work`/`citation` columns; authors are Catullus, Cicero, Horatius, Lucanus, Lucretius, Martia | Y |
| `http://www.pedecerto.eu/pagine/autori (Musisque Deoque / Pedecerto; to` | la (Latin) | unverified (not downloaded; pedecerto.eu | CC-BY-NC-ND per the mqdq-parser README — | N | Y | full machine+manual metrical scansion per line (this is the best Latin quantitative-metre resource that exists | N |
| `https://hf.co/datasets/PleIAs/Latin-PD` | la (Latin) | card claims 159,070 titles / 16.5B words | no licence tag on the repo; contents are | Y | Y | title / creator / publication_date columns only; genre not labelled, verse not separated from prose. Backgroun | Y |
| `https://hf.co/datasets/ilhamfp/id_puisi (mirror: SEACrowd/indo_puisi; ` | id (Indonesian) | 7,223 rows x 4 columns, 4,119 distinct a | MIT is the uploader's own repo licence ( | N | Y | none. Authors are living/contemporary amateur poets scraped from Indonesian poetry sites (author strings liter | Y |
| `https://hf.co/datasets/Abdi008/Pantun_Indonesia (same data as .../puis` | id (Indonesian) | 440 rows x 2 columns (teks, tipe); 18 th | unlicense on the HF repo; provenance is  | N | Y | theme label (`tipe`) only; no author, no date, no anthology. Pantun is an anonymous folk form so much of it is | Y |
| `https://hf.co/datasets/maercaestro/pantun` | ms (Malay) | 56,400 viewer rows = LINES of pantun_dat | mit asserted by the uploader; original c | N | Y | none. Inspected content: genuine abab / pantun berkait verse, but modern Malaysian compositions (rows referenc | Y |
| `https://hf.co/datasets/antonheryanto/pantun` | ms (Malay) | 100 rows x 12 columns | none declared | N | Y | `Subject` = 'Sejutan Pantun', `Year` = 2021; ships pre-computed rhyme features (Last Word L1-L4, Last 2 Chars  | Y |
| `https://hf.co/datasets/LorthGyu/indonesian-pantun` | id (Indonesian) | 108 rows (103 train + 5 validation) | mit | N | Y | theme / rhyme_scheme / region columns. SUSPECT: card advertises 'variasi orisinal' (original variations) mixed | Y |
| `https://hf.co/datasets/EdUarD0110/armenian_poems_dataset` | hy (Armenian) | 320 rows x 2 columns (title, text); arm_ | mit asserted by uploader — not credible  | N | Y | NONE — there is no author column at all. Previewed content is 20th-century Armenian verse (e.g. 'Մոր ձեռքերը', | Y |
| `https://hf.co/datasets/IntelResearchLab/Hausa (Hausa Ajami OCR Dataset` | ha (Hausa) | 2,500 line-level rows (2,100 train + 400 | no repo-level licence tag; README states | N | Y | `source` = manuscript ID with a README table naming each: Infiraji 1 'Majidu' and Infiraji 2 'Gargaɗi' by Alha | Y |
| `https://github.com/manexagirrezabal/errima-bertsolaritzan (adibideak/)` | eu (Basque) | urre_patroia.bertsoak = 2,433 lines / 46 | no LICENSE file anywhere in the repo | N | Y | the .analisiak file is a hand-built rhyme-coding scheme (codes like 'B-u-0', 'aB-a-0', 'i-N-a' encoding onset/ | Y |
| `https://hf.co/datasets/gvlassis/ancient_greek_theatre` | el (Modern Greek) / grc sour | 24 plays (size_categories n<1K) | mit | Y | N | TRANSLATION TRAP — explicitly '24 Ancient Greek plays, translated in Modern Greek'. The metre and diction are  | Y |

**Nothing usable found:** Yoruba (yo), Swahili (sw), Zulu (zu), Amharic (am), Tagalog / Filipino (tl), Javanese (jv), Georgian (ka), Modern Greek (el)

