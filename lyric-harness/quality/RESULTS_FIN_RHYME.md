# RESULTS — Finnish end-rhyme (loppusointu), and what its corpus actually is

**Runner:** `python3 quality/fin_rhyme_rate.py` · **verify arm:**
`python3 quality/fin_rhyme_rate.py --verify` · **regressions:**
`python3 quality/test_phonology.py` §5c–5d, `python3 quality/test_msa_fin.py` §8–17.

**Seed 20260811, N=200 replicates, depth 1 unless a row says otherwise.** Every
rate below is over JUDGED pairs and is printed beside its MANDATED and REFUSED
counts, because a refusal is not a failure and putting it in the numerator
charges the comparator for the ingestion layer's misses (doctrine 79).

---

## 0 · What this cell was asked, and what it found instead

`BACKLOG.md` §2.7 / `MISSING.md` M-6 read, and still read at HEAD:

> ### 2.7 · `fin.py` implements alliteration and nothing else `M-6`
> No `rhymes()`. Nine of the ten staged Finnish files are rhymed strophic verse
> whose actual constraint the module cannot check.

**Both sentences are false at HEAD, and they are false in different ways.**

1. `fin.rhymes()` **exists** and landed at commit `f94383c` (2026-08-11), with
   `rime()`, `relation_type()`, `refusal_reason()`, `readability_census()` and a
   corpus arm in `quality/test_msa_fin.py`. The backlog entry and M-6 were never
   closed. That half is bookkeeping.
2. "Nine of the ten staged Finnish files are rhymed strophic verse" is a
   **claim about the corpus**, and measured it is wrong twice over: there are
   **eleven** staged files, and the metre split is not 1 : 9. §1 below.

So the work of this cell was not to build the relation. It was to **execute
every figure the relation rests on**, which had never been run by anything but
the session that wrote them, and none of which named the coordinates it was a
function of. `quality/fin_rhyme_rate.py` is that runner and it did not exist.

---

## 1 · The corpus, counted — and the metre MEASURED

`ls corpus/song/fin_*.txt` → **11 files.** The eleventh,
`fin_wahanen_laulukirja.txt` (1864 song-book, PG 72965), landed at `debf64e` on
2026-08-11, *after* `fin.py` was written. It is a tenth rhymed volume and adds
214 four-line units, so the module's "nine rhymed volumes, 1,132 four-line
units" is now **ten volumes and 1,346 units**.

### 1a · The four-line unit is a minority of the printed units

| file | printed units | 4-line | share | lines | syl/line | 8-syllable |
|---|---:|---:|---:|---:|---:|---:|
| fin_aleksis_kivi | 332 | 133 | 40.1% | 2885 | 9.34 | 16.3% |
| fin_eino_leino | 833 | 359 | 43.1% | 4254 | 8.51 | 19.6% |
| fin_jaakko_juteini | 19 | 5 | 26.3% | 158 | 8.10 | 53.2% |
| fin_jh_erkko | 503 | 115 | 22.9% | 3110 | 7.82 | 21.9% |
| fin_julius_krohn | 168 | 52 | 31.0% | 1216 | 9.46 | 26.5% |
| fin_kaarlo_kramsu | 171 | 134 | 78.4% | 753 | 8.45 | 29.1% |
| fin_kanteletar | 2326 | 325 | 14.0% | 22113 | 7.98 | **90.8%** |
| fin_kanteletar_uudempia | 232 | 51 | 22.0% | 897 | 10.63 | 21.9% |
| fin_kasimir_leino | 181 | 60 | 33.1% | 1263 | 9.74 | 22.2% |
| fin_paavo_cajander | 608 | 223 | 36.7% | 3171 | 10.95 | 20.7% |
| fin_wahanen_laulukirja | 390 | 214 | 54.9% | 2037 | 7.36 | 26.8% |
| **TOTAL** | **5763** | **1671** | **29.0%** | | | |

**Every fixed-slot figure in `fin.py` is conditioned on `len(unit) == 4`, and
that is a selection rule nobody declared as one.** It keeps 14.0% of the
Kanteletar's printed units and 78.4% of Kramsu's. §4 drops the filter.

### 1b · Which metre each file is in — measured, not read off the filename

Weak alliteration against the across-line permutation null
`quality/kalevala_rate.py` uses:

| file | weak | null median | excess |
|---|---:|---:|---:|
| **fin_jaakko_juteini** | 92.41% | 33.54% | **+58.86pp** |
| **fin_kanteletar** | 81.83% | 31.18% | **+50.65pp** |
| fin_wahanen_laulukirja | 55.03% | 33.43% | +21.60pp |
| fin_julius_krohn | 67.68% | 46.38% | +21.30pp |
| fin_eino_leino | 72.52% | 52.52% | +20.00pp |
| fin_kasimir_leino | 71.42% | 53.52% | +17.89pp |
| fin_jh_erkko | 56.01% | 38.36% | +17.65pp |
| fin_kanteletar_uudempia | 73.13% | 57.41% | +15.72pp |
| fin_aleksis_kivi | 58.37% | 46.66% | +11.72pp |
| fin_kaarlo_kramsu | 55.64% | 46.48% | +9.16pp |
| fin_paavo_cajander | 57.93% | 55.25% | +2.68pp |

**`fin_jaakko_juteini.txt` carries a higher alliteration excess than the
Kanteletar itself**, with 53.2% of its lines at exactly eight syllables. It is
Kalevala-metre material and it was in the "rhymed" arm. At 19 printed units its
rhyme arm resolves nothing — its empirical p sits at the floor 1/(N+1), which is
the resolution and not an effect (doctrine 57).

**The corpus's Kalevala-metre negative control has two members, not one**, and
the second was on disk unlabelled. Doctrine 41: a positive control can pass for
the wrong reason and only a second control tells you which.

---

## 2 · The grades, and the reading that lost its last argument

2&4 slot of the four-line units. Null: permute each unit's own end words among
its own four line slots. **95.7% of permuted units differ from the printed one**
— measured, so the null is demonstrably not the identity map (doctrines 63, 68).

**Ten rhymed volumes, 1,346 units:**

| reading | mandated | judged | refused | observed | null med | null max | excess | lift | p |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **depth 1 (SHIPPED)** | 1346 | 1328 | 18 | 62.58% | 24.76% | 27.04% | **+35.53pp** | 2.31x | 0.0050 |
| depth 2 (rich grade) | 1346 | 1316 | 30 | 43.31% | 14.26% | 16.57% | +26.75pp | 2.61x | 0.0050 |
| depth 3 | 1346 | 1312 | 34 | 36.05% | 11.62% | 13.74% | +22.31pp | 2.62x | 0.0050 |
| prominent (ENGLISH PORT) | 1346 | 1312 | 34 | 31.25% | 9.71% | 11.93% | +19.32pp | 2.62x | 0.0050 |
| depth 2, harmony=paired | 1346 | 1316 | 30 | 43.62% | 14.78% | 17.10% | +26.52pp | 2.55x | 0.0050 |

`p 0.0050` is `1/(N+1)`: **no replicate reached the observation.** That is the
resolution of a 200-replicate null, not a smaller number in disguise
(doctrine 57).

**The tenth volume takes `prominent`'s last argument away.** On nine volumes the
English port had the best lift (2.90x) and `fin.py` had to argue at length that
lift adjudicates rival *readings* and not a *grade* against itself. On ten it is
2.62x against depth 3's 2.62x and depth 2's 2.61x — a three-way tie inside any
noise. The reading that survives the tradition test is now also the reading
nothing prefers on lift, and the argument's evidential burden is lighter.

`harmony="paired"` loses on both corpora: +0.31pp of observation for +0.53pp of
null max, lift 2.61x → 2.55x, and its false-positive rate rises 0.67% → 0.88%.
Doctrine 61 — the rule that fires more often is not the better rule.

---

## 3 · Which slot, and the pooled row is an average over four schemes

**Pooled, ten rhymed volumes, four-line units:**

| depth | slot | mandated | judged | refused | observed | null max | excess | p |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2&4 | 1346 | 1328 | 18 | 62.58% | 27.04% | **+35.53pp** | 0.0050 |
| 1 | 1&3 | 1346 | 1340 | 6 | 28.21% | 27.61% | +0.60pp | 0.0050 |
| 1 | 1&2 + 3&4 | 2692 | 2666 | 26 | 23.26% | 27.52% | −4.27pp | 0.9851 |
| 2 | 2&4 | 1346 | 1316 | 30 | 43.31% | 16.57% | +26.75pp | 0.0050 |
| 2 | 1&3 | 1346 | 1329 | 17 | 16.55% | 16.24% | +0.32pp | 0.0050 |
| 2 | 1&2 + 3&4 | 2692 | 2645 | 47 | 11.72% | 16.52% | −4.80pp | 1.0000 |

`fin.py` said *"the 1&3 slot and the 1&2 / 3&4 slots are AT OR BELOW their own
nulls"*. On the ten-volume corpus the 1&3 slot is marginally **above** its null
max at both depths. Beside +35.53pp that is nothing; as written it is false.

**Per file, depth 1, four-line units — excess over that file's own null max:**

| file | n | 2&4 excess | p | 1&3 excess | p |
|---|---:|---:|---:|---:|---:|
| fin_eino_leino | 359 | **+57.73pp** | 0.0050 | −6.53 | 0.7114 |
| fin_kaarlo_kramsu | 134 | **+33.93pp** | 0.0050 | +14.61 | 0.0050 |
| fin_kanteletar_uudempia | 51 | +33.33pp | 0.0050 | −21.57 | 0.9303 |
| fin_wahanen_laulukirja | 214 | +26.42pp | 0.0050 | +4.50 | 0.0050 |
| fin_jh_erkko | 115 | +18.95pp | 0.0050 | +12.34 | 0.0050 |
| fin_kasimir_leino | 60 | +15.25pp | 0.0050 | −27.85 | 0.9851 |
| fin_paavo_cajander | 223 | +15.07pp | 0.0050 | −26.06 | 1.0000 |
| fin_jaakko_juteini | 5 | +0.00 | 0.0100 | +0.00 | 0.0100 |
| **fin_aleksis_kivi** | 133 | **−3.77** | 0.3881 | +3.62 | 0.0050 |
| **fin_julius_krohn** | 52 | **−7.84** | 0.0697 | −11.54 | 0.2289 |
| *fin_kanteletar* (negative) | 325 | −12.92 | 1.0000 | −11.08 | 0.9950 |

Seven of the ten rhymed volumes clear on the 2&4 slot. One is unresolvable at
n=5. **Two sit below their own null**, and they are below it for two different
reasons — §4.

---

## 4 · The offset profile: drop the four-line filter and four forms appear

`offset k` = does line *i* rhyme line *i+k*, pooled over every *i* with both
inside one printed unit, units of every length. Depth 1, excess over that file's
own null max.

| file | units | offset 1 | offset 2 | offset 3 |
|---|---:|---:|---:|---:|
| fin_kaarlo_kramsu | 170 | −15.89 (p1.0000) | **+28.34 (p0.0050)** | −32.65 (p1.0000) |
| fin_eino_leino | 762 | −1.20 (p0.3134) | **+13.50 (p0.0050)** | −11.93 (p1.0000) |
| fin_wahanen_laulukirja | 367 | +0.63 (p0.0050) | **+10.04 (p0.0050)** | −7.99 (p1.0000) |
| fin_paavo_cajander | 547 | +1.97 (p0.0050) | +5.38 (p0.0050) | −9.82 (p1.0000) |
| fin_kanteletar_uudempia | 232 | +2.56 (p0.0050) | +4.16 (p0.0050) | −10.82 (p1.0000) |
| **fin_julius_krohn** | 159 | **+2.23 (p0.0050)** | **+4.08 (p0.0050)** | −8.52 (p1.0000) |
| fin_jh_erkko | 464 | +2.07 (p0.0050) | +2.97 (p0.0050) | −7.75 (p1.0000) |
| fin_kasimir_leino | 170 | +5.47 (p0.0050) | −1.76 (p0.0597) | −6.77 (p1.0000) |
| **fin_aleksis_kivi** | 322 | **−1.39 (p0.6716)** | **−0.15 (p0.0100)** | −0.97 (p0.4527) |
| fin_jaakko_juteini | 19 | −13.67 (p0.9602) | +0.00 (p0.0149) | −11.88 (p0.6965) |
| *fin_kanteletar* (negative) | 2325 | **+10.64 (p0.0050)** | +0.86 (p0.0050) | −2.42 (p1.0000) |

**Four behaviours, and the pooled row hid three of them.**

* **ABCB and nothing else** — Kramsu (+28.34 at offset 2, −15.89 and −32.65 at
  1 and 3). Eino Leino and the 1864 song-book are the same shape.
* **AAAx with a refrain word** — Krohn. His printed unit is
  `lentimin / nope'in / kuitenkin / riennä`: three rhyming lines and a refrain
  word in slot 4. That is *why* his 2&4 rate is below his own null, and a
  pooled ABCB claim mis-describes him.
* **Not rhymed verse** — Kivi, 322 units. His offset excesses are −1.39 / −0.15
  / −0.97, so on the excess-over-null-max convention every `fin.py` table uses
  he clears at no offset. The honest qualifier: his offset-2 empirical p is
  0.0100, i.e. AT the top of his own null rather than past it, and his largest
  positive excess anywhere is +3.62pp against Kramsu's +28.34pp.
* **Parallelism, which is not rhyme** — the Kanteletar, +10.64 at offset 1 and
  +0.86 at offset 2. §5.

---

## 5 · The negative arm (doctrine 76)

`fin_kanteletar.txt` — Kalevala metre, unrhymed by construction, same language,
same collector, same printing, same instrument. Four-line units.

| depth | slot | mandated | judged | refused | observed | null med | null max | excess | p |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2&4 | 325 | 325 | 0 | **21.85%** | 29.85% | 34.77% | −12.92pp | 1.0000 |
| 1 | 1&3 | 325 | 325 | 0 | 24.62% | 29.85% | 35.69% | −11.08pp | 0.9950 |
| 1 | 1&2 + 3&4 | 650 | 650 | 0 | **44.77%** | 30.00% | 34.46% | **+10.31pp** | 0.0050 |
| 2 | 2&4 | 325 | 323 | 2 | 7.43% | 10.53% | 14.24% | −6.81pp | 0.9851 |
| 2 | 1&3 | 325 | 324 | 1 | 6.48% | 10.53% | 14.51% | −8.02pp | 1.0000 |
| 2 | 1&2 + 3&4 | 650 | 647 | 3 | 18.55% | 10.66% | 13.45% | +5.10pp | 0.0050 |

**The two arms, same slot, same instrument, depth 1: 62.58% rhymed vs 21.85%
Kalevala-metre, and the second is BELOW its own null.**

**The third row of each block is the trap.** *"44.77% of adjacent Kanteletar
lines rhyme"* is true and is not rhyme: Kalevala parallelism repeats a syntactic
frame across two lines, so both end in the same inflectional ending. Reported as
a rate it reads as a discovery. Doctrine 64: report the excess, never the rate —
and this is the case where the excess is real and the *interpretation* is still
wrong, which is why the offset profile in §4 is beside it.

---

## 6 · False-positive rate (doctrines 16, 22) — UNCALIBRATED

20,000 pairs drawn **with replacement from the ten-volume rhymed arm's
line-final TOKENS**, seed 20260811.

| reading | mandated | judged | refused | admits |
|---|---:|---:|---:|---:|
| depth 1 (shipped) | 20000 | 19746 | 254 (1.27%) | **5.98%** |
| depth 2 | 20000 | 19548 | 452 (2.26%) | **0.67%** |
| depth 3 | 20000 | 19525 | 475 (2.38%) | 0.60% |
| prominent | 20000 | 19482 | 518 (2.59%) | **0.13%** |
| depth 2, harmony=paired | 20000 | 19548 | 452 (2.26%) | 0.88% |

**Uncalibrated.** These are the readings' chance rates on this corpus. Nothing
was swept, nothing was targeted, and no threshold was set to hit one of them
(doctrine 16 — an uncalibrated threshold fails toward whoever guessed).

**The figure this replaces does not reproduce, and the missing coordinate is the
sampling rule.** `fin.py` recorded *"depth 1 admits 5.09%, depth 2 admits 0.81%,
`prominent` 0.18%"* with no seed, no population and no draw stated. Twelve draws
were tried — end-word tokens, end-word types, all word tokens, all word types ×
seeds 20260811 / 20260810 / 0 — and none gives the triple:

| population | depth 1 | depth 2 | prominent |
|---|---|---|---|
| end-word tokens | 5.50–5.73% | 0.64–0.79% | 0.10–0.14% |
| end-word types | 5.95–6.02% | 0.17–0.21% | 0.05–0.07% |
| all word tokens | 6.07–6.41% | 2.10–2.17% | 0.36–0.41% |
| all word types | 6.26–6.54% | 0.13–0.19% | 0.02–0.04% |
| *recorded* | *5.09%* | *0.81%* | *0.18%* |

**The spread over sampling rules is larger than the gap between two of the
grades.** That is doctrine 70's amendment in a second language: three documents,
one measurement, and the coordinate nobody wrote down.

---

## 7 · Where the refusal falls (doctrine 67)

| depth | population | mandated | judged | refused | True \| judged |
|---:|---|---:|---:|---:|---:|
| 1 | MANDATED (the 2&4 pairs) | 1346 | 1328 | 18 (1.34%) | 62.58% |
| 1 | RANDOM, from line-final tokens | 20000 | 19746 | 254 (1.27%) | 5.98% |
| 1 | CANDIDATE, rejection-sampled | 20000 | 19983 | 17 (0.08%) | 51.87% |
| 1 | CANDIDATE, drawn class-first | 20000 | 18903 | 1097 (5.49%) | 51.82% |
| 2 | MANDATED (the 2&4 pairs) | 1346 | 1316 | 30 (2.23%) | 43.31% |
| 2 | RANDOM, from line-final tokens | 20000 | 19548 | 452 (2.26%) | 0.67% |
| 2 | CANDIDATE, rejection-sampled | 20000 | 19745 | 255 (1.27%) | 6.03% |
| 2 | CANDIDATE, drawn class-first | 20000 | 18645 | 1355 (6.78%) | 13.04% |

The Finnish refusal is **blunt, not aimed** — a flat ~2% that falls almost
equally on the mandated and random populations, because its trigger is a
property of a *word* and not of a *pair*. `fas.py` refuses 60.2% of real Ḥāfiẓ
rhyme pairs and ~5% of random ones; that is an aimed refusal, and this is not
one. The conclusion `fin.py` records survives.

**But the last two rows are the same English sentence read two ways, and they
differ by 5x.** *"Pairs that already agree on the final nucleus"* is not a
population until the draw is stated. Rejection-sampling from the corpus's own
line-final tokens weights a nucleus class by its size squared → 1.27% refused.
Drawing a class uniformly and then two members of it weights the *small* classes
up, and the small classes are exactly where `ie` / `uo` / `yö` live, so the
designed refusal fires five times as often → 6.78%, and "blunt, not aimed"
inverts on that population. `fin.py`'s recorded row (1.20% / 6.55%) matches
neither. Doctrine 58: the sampling rule is a coordinate of the number.

---

## 8 · The tradition test (doctrine 37), 11/11

Every pair is a real line-end from a staged file.

| case | expected | got |
|---|---|---|
| Kramsu refrain 2&4 `yksinään : itsekään` | True | True |
| …the same pair at depth 2 (rich grade) | False | False |
| …under the ENGLISH PORT (`rule="prominent"`) | False | False |
| Kramsu refrain 1&3 `katoaa : suruinen` | False | False |
| Kramsu v4 `tahdokaan : niitäkään` (harmony) | False | False |
| …which `harmony="paired"` would admit | True | True |
| Krohn v2 1&2 `lentimin : nope'in` | True | True |
| Krohn v2 2&3 `nope'in : kuitenkin` | True | True |
| Krohn v2 2&4 `nope'in : riennä` (refrain word) | False | False |
| `maa : vapaa` — what Finnish poets do | True | True |
| …and what the ENGLISH PORT says about it | False | False |

**The anchor is the coordinate this whole module turns on.** Finnish stress is
fixed on syllable 1 and never falls word-final, so "from the last stressed
vowel to the end of the word" — the English predicate — puts the origin of a
three-syllable word's rime at its *first letter*. Ported, it calls `maa : vapaa`
False and Kramsu's own refrain rhyme False. It is kept reachable as
`rule="prominent"` so that is a function call and not an assertion (doctrine 84).

---

## 9 · What `--verify` re-derives, and what it cannot

`python3 quality/fin_rhyme_rate.py --verify`, on the module's own nine-volume
set (every `fin_*.txt` except `fin_kanteletar.txt` and
`fin_wahanen_laulukirja.txt`): **1,132 four-line units, exactly as recorded**,
and **all fifteen figures of the grades table re-derive to the printed digit**:

```
ok   depth 1 2&4         obs 62.2760%  med 23.6396%  max 26.9231%
ok   depth 2 2&4         obs 43.6199%  med 13.2313%  max 15.7466%
ok   depth 3 2&4         obs 37.8747%  med 11.1611%  max 13.9367%
ok   prominent 2&4       obs 31.6076%  med  8.7703%  max 10.8992%
ok   depth 2 paired 2&4  obs 43.8914%  med 13.7590%  max 16.5611%
```

The scheme table (`10.58% / 15.20% / p=1.0000`) and the negative-control table
(`7.43% / 14.24%`, `18.55% / 13.45%`) also re-derive exactly — **at depth 2**,
which neither table states, while the module's shipped default is depth 1. The
two most quotable tables in the module were coordinates of a setting it does not
ship. Doctrine 58, turned on the module's own docstring.

**Not re-derivable, each a missing coordinate rather than a wrong sum:**

| recorded | status |
|---|---|
| FPR triple 5.09 / 0.81 / 0.18 | no sampling rule reproduces it (§6) |
| refusal table, RANDOM + CANDIDATE rows | draw not stated; MANDATED row exact (§7) |
| "155 unreadable — 118 `vowelless_token`, 37 `out_of_inventory`" | **total exact, split wrong**: 130 / 25 |
| "138,974 tokens" | 139,028 on the same ten files, tokenisation unstated |
| "251 line-final tokens carry a final cluster" | 250 on ten files, 276 in 218 types on eleven |

The census row is the one that matters. `UNREADABLE_REASONS` exists *because*
doctrine 88 says a refusal rate is uninterpretable until an ingestion miss and a
designed refusal are told apart — so a table that gets the total right and the
split wrong has failed at the only thing it was for.

Current census, eleven files, `fin._tokens` over verse lines: **145,717 tokens,
144,999 read, 567 refused, 151 defective** — 151 `vowelless_token` (ingestion,
someone else's layer), 29 `out_of_inventory` (foreign proper names, a correct
refusal), 538 `non_initial_opening_diphthong` (designed). The Kalevala itself has
zero unreadable.

---

## 10 · Open, and which blocker each one is (doctrines 44, 92)

1. **`fin_aleksis_kivi.txt` and `fin_jaakko_juteini.txt` are staged in the wrong
   arm.** Not hard to build and not hard to obtain — the files are on disk with
   their rows. What is missing is a **declared metre field** on the corpus
   header, so "which arm is this file in" is a lookup rather than a re-run of
   §1b. That is a stagers change and this cell does not own the corpus.
   *Blocker: neither of the three — it is a schema gap.*
2. **The four-line unit is a selection rule with no declaration.** Fixable here
   and partly fixed: §4 is the arm without it. What is not fixable without the
   corpus is the *form's own* unit, which the 1864 song-book prints as 7-line
   groups and the Kanteletar as 6- and 8-line ones.
3. **No reachable Finnish source states the rekilaulu's rhyme rule in its own
   words.** Doctrine 62 asked for the tradition's own statement, and the only
   primary statement inside the repo is Lönnrot's on *alliteration* — quoted in
   `corpus/song/fin_kanteletar_uudempia.txt` from 7078-8.txt line 2361,
   `'sanojen yksialanta (allitteratio) on sattumoissa'`, the word-alliteration is
   by accident. He nominates the rhymed set as a control and says nothing about
   what its rhyme *is*. ~~The unblock route is `BACKLOG.md` §3.4 — Finno's 1583
   hymnal on `doria.fi` / `kansalliskirjasto.fi`, never probed.~~ **REPOINTED
   2026-08-21: it WAS probed, on 2026-08-11** (`data/sources.tsv:392`) —
   twenty-one hosts, all 403 CONNECT, including all five of the Finnish ones
   this sentence names. Both copies are located and neither is reachable:
   Hemming's complete hymnal, printed Rostock **1607**, at
   `digital.slub-dresden.de/werkansicht/dlf/114166/1/`; Finno's c.1583 in one
   incomplete copy at Uppsala. The route is those two GERMAN and SWEDISH hosts
   by name, and it also needs OCR of 1607 blackletter, so it is not the cheap
   unblock this line assumed.
   *Blocker: **cannot obtain**, not hard-to-build — the rule is already
   implemented and measured; what is missing is the tradition's own words to
   check it against.*

---

## 11 · The battery did not move

`python3 battery.py` → `mandated 1064, judged 1014, refused 50`,
`violations 82 (8.1%)`. Unchanged by THIS cell. Nothing here touches the
English comparator, and the invariant is the check that says so.

REPINNED 2026-08-13 from `81 (8.0%)`, the value `battery.py` printed when this
was written. The invariant still holds: the move came later and from cell BA's
coda-identity fix, not from anything in this cell. `mandated` / `judged` /
`refused` are unchanged at 1064 / 1014 / 50.
