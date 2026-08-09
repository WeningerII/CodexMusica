# Survival labels — verified inventory

From a 5-agent hunt (941k tokens, 403 tool calls) whose brief demanded numbers,
not plausibility. It **rejected more than it accepted**, including candidates
this project had itself proposed. The rejections are the more valuable half and
are recorded first-class below.

Labels are the bottleneck: 27 languages have usable text, and text without a
label contributes nothing to the experiment.

## Verified, clean (no subset leak) — usable now

| lang | label | positive | negative | type |
|---|---|---|---|---|
| **hbo** | Sefaria `pagesheetrank` citation centrality | verses cited by any post-biblical work | never-cited verses sit at exactly 0.04 | **continuous** |
| **fi** | SKVR type-index variant count | 2,132 of 7,555 types with ≥10 variants | 2,827 singleton types (37.4%) | **continuous** |
| **fi** | geographic spread: distinct parishes per type | max 362 parishes, mean 8.13 | 3,216 of 7,555 types in a single parish | **continuous** |
| **krl** | same SKVR count, Karelian subset | 10,527 of 10,949 poems type-linked (96.1%) | 703 in low-variant types | **continuous** |
| **et** | unified type-index variant count | 730 of 2,482 clean types with ≥10 variants | 830 singleton types | **continuous** |
| **izh/vot** | same, Ingrian/Votic subset | 15,776 of 15,980 type-linked (98.7%) | 818 poems in <10-variant types | **continuous** |
| **ces** | reprint count across distinct books | 5,987 distinct poems (10.0%) in ≥2 books | 54,151 poems in exactly one | binary |
| **lzh** | 宋词三百首 membership, tagged on pool rows | 280 ci | 20,773 remaining ci in 全宋詞 | binary |
| **lzh** | modern PRC curriculum membership | 112 rows (小学 47 / 初中 58 / 高中 12) | remaining ~311,700 of the Tang+Song pool | binary |
| **la** | intertextual-reuse count | passages cited by later authors, ~1,490 labelled pairs | remaining 90.5K passage rows | **continuous** |
| **ur** | circulating-divan membership | 2,546 verse units in the متداول divan | 1,374 units in four excluded appendices | binary |

## Verified but carrying a subset leak — fixable by deduplication

| lang | label | note |
|---|---|---|
| **lzh** | multi-anthology attestation across 3 independent anthologies | 620 rows in ≥1, 143 in ≥2, **17 in all three**. The graded version is the single best-designed label found — agreement across independently compiled anthologies is exactly the decorrelation argument — but the positives sit inside the 311,855-poem pool and must be deduplicated first. |
| **ja** | 小倉百人一首 (Teika, c.1235) against the 八代集 | 93 of 100 matched into a 9,499-poem pool of the same eight imperial anthologies |
| **sa** | subhāṣita anthologization count, 4 independent anthologies | 690 of 4,707 verses (14.7%) from 10 kāvya works |
| **sa** | editor-supplied citation count, Amaruśataka | 84 of 210 verses (40%) cited; same poem, same author, same metre |
| **pa** | bani membership within the shipped scripture | 8,382 distinct lines of 141,264 (5.9%) |
| **de** | school-canon membership | 155 poems against DLK's 72,588 |
| **spa** | canonical-author membership | 5,078 Golden Age sonnets by 53 canonical poets vs 1,088 by 472 minor authors |

## Rejected — and why this half matters more

**Candidates this project proposed that do not survive:**

- **OpenITI GAL@ Brockelmann codes.** Named in the brief as a canon signal. All
  160 distinct values are genre (fiqh 1,006, hadith 887), region (syria 1,180),
  or period (period-classical 1,251). No witness counts, no selection evidence.
  Textbook classification metadata.
- **OpenITI version counts, for poetry.** This is the important one: it *looks
  exactly like* the Czech reprint count and is not. Every anthology has exactly
  2 versions whose token counts differ by <0.5% (Mufaddaliyyat 28,984 vs
  28,859). That is **one text digitised twice, not a book reprinted twice.**
  The distribution collapses to {1,2,3} with 149 of 199 at exactly 2. The same
  measure on *prose* is genuinely informative and validates against the
  canonical core — so the artifact is specific to how verse was ingested.
- **Syriac critical-edition membership.** 533 of 632 files have exactly one
  `biblStruct` and zero `msIdentifier`; the other 99 the reverse; the sets are
  disjoint and no file has two of either. Every text has exactly one source, so
  the field separates nothing.
- **Syriaca BHSE manuscript-witness counts.** Real transmission data that meets
  the quality bar (1,028 works with ≥2 manuscripts, max 66) — and it joins to
  **zero verse**. BHSE covers hagiographic prose at work ids <3000; the verse
  corpus lives entirely at 8000–9999.
- **Ben-Yehuda `source_edition`.** Present on 10,711 of 13,140 poetry rows, but
  only 206 of 12,882 title+author pairs recur at all. Not a reprint count.
- **Tamil work/category/source_text**, **Thirukkural paal/iyal/athikaaram**:
  uniform source-work attribution, and in the Thirukkural case literally one
  work's table of contents.
- **ELTE Hungarian "critical canon"**: canon is a property of the *poet*, every
  poem in the corpus is by a canonical poet, and no non-canonical poet is
  present. No contrast exists.

## Two corrections to claims this project had already made

**The Finnish/Estonian headline number was partly garbage.** The "~1,270 max
variants" figure came from ERAB type id 1 `- Jääb ära -` (code 999999999) and
id 1347 `Määramata` — **administrative placeholder and disposal buckets, not
song types.** Separately, `hsci-r/filter-data` used unfiltered links every
Estonian song to 14,827 `erab_orig*` pseudo-types alongside its real unified
type. The label survives and is still the best continuous measure available,
but the specific number previously quoted does not.

**Czech reprints are not "across independently compiled books."** That phrasing
was wrong. **Zero of the 1,305 corpusCzechVerse books has more than one
poem-author** — there are no editor-compiled anthologies in the corpus at all.
The 5,987 repeat poems are *same-author re-editions*, which is a weaker signal
than independent anthology selection. Two further cautions: 66% of positives
come from 10 authors, with within-author reprint rates from 0.1% to 56.4%, so
the split must be stratified by author; and exact body-text hashing as the dedup
key **under-counts by ~58%** (on one 1918-vs-1927 pair, exact matching catches
36 of 49 poems).

## What this changes

The claim that seven cells carry labels was too generous. **Eleven labels are
verified and leak-free, but only a handful are continuous**, and the two
strongest families — Finnic variant counts and Chinese multi-anthology
attestation — are the ones to build on, because both measure transmission
rather than editorial opinion, and the Chinese one measures agreement across
*independently compiled* selections, which is the decorrelation property the
whole matrix argument rests on.
