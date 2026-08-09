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


---

# Chinese multi-anthology label — built, verified, and one source disqualified

Pool 311,855 shi rows (全唐诗 57,607 + 全宋诗 254,248). Graded attestation 0..5.
687 positives (0.220%): 499 at grade 1, 146 at 2, 35 at 3, 7 at 4.

**The prior pass replicated exactly.** Restricted to the three book anthologies
for comparability, the all-three count is **17** — the same figure the earlier
label hunt reported, reached by a different build. The ≥1 and ≥2 counts came
out higher (641 vs 620, 151 vs 143) because a near-body channel recovers
textual variants the earlier pass missed.

## One "independent" anthology is a derivative of the pool

The 唐诗三百首 label draws on two printings, and they behave completely
differently:

| printing | exact | normalised | gap |
|---|---|---|---|
| `全唐诗/唐诗三百首.json` | 366 | 366 | **0.0%** |
| `蒙学/tangshisanbaishou.json` | 72 | 141 | **61.1% under-count** |

A 0.0% gap is not a good result, it is a **tell**. That file is an in-repo
derivative of the pool and byte-identical to it, so matching it against the pool
is matching the pool against itself. Counting it as an independent witness would
inflate the attestation grade with a self-match — **doctrine 13 inside the
label**: a resource derived from the data it scores.

The two printings must therefore be unioned as ONE source, which the build does,
and the independence count for the decorrelation argument is **three
anthologies, not four**.

Aggregating the printings hides this entirely — the union gap is only +1 row —
which is why per-source gaps have to be reported and not just the union.

## The matching-strategy cost, now measured per source

- 蒙学 printing of 唐诗三百首: exact finds **38.9%** of normalised
- 千家诗: exact finds **48.9%** of normalised (51.1% under-count)
- Overall positives: exact hashing misses **219 of 687 (31.9%)**

That sharpens the earlier "~58%" estimate into per-source figures, and confirms
its direction. Exact body hashing is not a conservative choice; it is a wrong
one that silently parks a third of the positive class in the negative pool.

## Leak closure

Two-stage: an anthology entry marks *every* pool row sharing its normalised key,
then the flag propagates across the whole content-key duplicate group. **219
rows moved out of the negative pool.** 56 positives sit in 27 multi-row content
groups, so a one-row-per-entry design would have marked 27 and left 29 identical
copies labelled 0. Verified: zero leak violations across all five per-label
files, and zero content keys carrying mixed positive/negative rows.

## 古文观止 — a small result that is not noise

Only 3 pool rows match, and whole-body matching finds none at all: a ~434-char
prose selection can never equal a ~40-char poem. All three arrive through a
containment match and were checked by hand — they are verse codas embedded
inside prose pieces. Correct behaviour, and a reminder that a prose anthology
cannot be joined to a verse pool by any whole-body key.
