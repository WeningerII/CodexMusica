# RESULTS — Welsh end-rhyme (*odl*), and the form that falsifies the English anchor

**Runner:** `python3 quality/cym_rhyme_rate.py` (add `--quick` for 20 replicates)
· **regressions:** `python3 quality/test_phonology.py` §10g–10j.

**Seed 20260811, N=200 replicates, depth 1 unless a row says otherwise.** Every
rate is over JUDGED pairs and is printed beside its MANDATED and REFUSED counts,
because a refusal is not a failure and putting it in the numerator charges the
comparator for what the notation did (doctrine 79).

---

## 0 · What was true before this cell, verified rather than taken on trust

`quality/RESULTS_NULL_SHAPES.md` §4 records:

> ```
> cym       5         18        108       0      108        - | NO `rhymes` PREDICATE
> ```
> * `eng` and `cym` declare no `rhymes` predicate, so through this path they
>   refuse 100% — 4758/4758 and 108/108. English is not thereby unmeasured; it
>   has the whole arm in `negative_control.py`. **Welsh is.**

Re-checked at HEAD before anything was written, and **both halves reproduce**:

| claim | check | result |
|---|---|---|
| `cym.py` has no `rhymes()` | `grep -n "def rhymes" quality/phonology/cym.py` | no match |
| …and no other module answers for Welsh | `grep -n "def rhymes" quality/phonology/*.py` | 6 of 9 modules have one; `cym`, `eng`, `som` do not |
| the corpus is staged | `wc -l corpus/song/cym_*` | **5 files, 7,044 lines** |
| the four song books | — | `cym_song_alun` 299, `cym_song_hwiangerddi` 2,294, `cym_song_mynyddog` 3,412, `cym_song_twm_or_nant` 890 |
| the cywydd | — | `cym_cynghanedd_llywelyn_goch_cywydd` 149 lines of file, **108 lines of verse** |
| the 108 | `python3 quality/negative_control.py --langs` | `cym 5 18 108 0 108` — 18 four-line blocks × 6 pairs |

**Known gap 6's "TEXT blocked for Welsh" is a claim about a DIFFERENT corpus and
is not falsified here.** `CLAUDE.md` reads:

> TEXT blocked for Welsh: see SEARCH:welsh-cynghanedd-corpus in
> `data/sources.tsv`. The capability is built; the corpus is not reachable.

That row is `SEARCH:welsh-cynghanedd-corpus`, and `data/sources.tsv` marks it
**`OVERTURNED — source located via GITenberg`**. Whatever remains blocked, it is
not "rhymed Welsh song", of which five files are on disk with rows. The blocker
this cell removed was doctrine 44's cheap kind: **the MODULE**.

---

## 1 · The corpus, counted

| file | printed units | lines | unit-length histogram |
|---|---:|---:|---|
| cym_cynghanedd_llywelyn_goch_cywydd | 1 | 108 | 108:1 |
| cym_song_alun | 29 | 215 | 1:1 6:5 7:8 8:14 16:1 |
| cym_song_hwiangerddi | 305 | 1408 | 1:4 2:36 3:10 **4:172** 5:11 6:23 7:3 |
| cym_song_mynyddog | 403 | 2756 | 1:45 2:3 3:3 4:77 5:7 6:44 7:4 |
| cym_song_twm_or_nant | 71 | 759 | 4:2 5:6 8:27 10:25 14:1 15:1 16:3 |
| **TOTAL** | **809** | **5246** | |

Two further Welsh files sit outside `corpus/song/`, staged by an earlier round
from the same two GITenberg sources: `corpus/cym_alun_strict.txt` (1,558 lines)
and `corpus/cym_twm_or_nant_cywydd.txt` (156). They are read below as extra
tradition tests and are **never pooled** into a song rate — one source, two
extractions, and pooling them would be doctrine 51's error.

---

## 2 · The cywydd is a POSITIVE arm, not the negative one — and that is the finding

The brief for this cell proposed `cym_cynghanedd_llywelyn_goch_cywydd.txt` as the
negative arm, on the ground that a cywydd's constraint is ALLITERATIVE. Measured,
that is wrong, and the file's own staged header says so first:

> `# structure: [CYWYDD]. A cywydd is 7-syllable rhymed couplets; there are no
> stanzas and none are marked.`

A cywydd carries cynghanedd *and* end-rhyme. So the file is the sharpest
POSITIVE arm in the Welsh corpus, and the negative arm has to come from inside
it: the pairs the form does **not** mandate.

**The arms.** Line *2k* with *2k+1* is a couplet and is mandated; line *2k+1*
with *2k+2* straddles two couplets and is not. Same text, same words, same
instrument, same line distance — only the parity differs, and parity is
typographic, so the control is not defined in terms of the quantity it controls
(doctrine 14).

**Null:** permute the poem's 108 end words and re-cut on the original couplet
boundaries. PRESERVES the poem's exact end-word inventory; DESTROYS only which
two lines the form pairs.

| reading | mandated | judged | refused | observed | null med | null max | excess | p_hi | differ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **depth 1 (SHIPPED)** | 54 | 51 | 3 | **100.00%** | 1.85% | 9.26% | **+90.74pp** | 0.0050 | 100.0% |
| depth 2 (rich grade) | 54 | 51 | 3 | 88.24% | 1.85% | 7.41% | +80.83pp | 0.0050 | 100.0% |
| **prominent (ENGLISH PORT)** | 54 | 52 | 2 | **3.85%** | 0.00% | 3.85% | **+0.00pp** | 0.0149 | 99.0% |
| diacritics=keep | 54 | 51 | 3 | 98.04% | 1.85% | 9.26% | +88.78pp | 0.0050 | 100.0% |
| glide=vocalic | 54 | 54 | 0 | 96.30% | 1.85% | 9.26% | +87.04pp | 0.0050 | 100.0% |
| glide=consonantal | 54 | 54 | 0 | 98.15% | 1.85% | 9.26% | +88.89pp | 0.0050 | 100.0% |

**Negative arm, same instrument, same text:**

| arm | mandated | judged | refused | observed | null med | null max | p_lo |
|---|---:|---:|---:|---:|---:|---:|---:|
| the 53 straddling pairs | 53 | 53 | 0 | **0.00%** | 1.89% | 9.43% | 0.2985 |

**51 of 51 against 0 of 53.** `p 0.0050` is `1/(N+1)`: no replicate reached the
observation, which is the resolution of a 200-replicate null and not a smaller
number in disguise (doctrine 57).

**The negative arm's own p is the wrong thing to read, and doctrine 71 is what
says so.** `p_lo 0.2985` looks like a failure to separate. It is not: the null
median on the straddle is **1.89%, i.e. one pair in 53**, so there is almost no
room below chance and no arm could clear a lower-tail test there. What carries
the finding is that the two arms separate **from each other** on one text with
one instrument at one line distance — and that the positive arm clears its own
null by 90.7 points while the negative arm sits on top of its own. Reading
`p_lo` as if it meant something would be quoting the tail the design cannot
populate.

### 2a · The three couplets that are not TRUE are REFUSALS, and all three are the same refusal

```
couplet 10  L19 canwyf    L20 wyf      -> None   (('wy','f'),)  | (('wy','f'), ('y','f'))
couplet 28  L55 fynych    L56 wych     -> None   (('y','ch'),)  | (('wy','ch'), ('y','ch'))
couplet 34  L67 anfynych  L68 wych     -> None   (('y','ch'),)  | (('wy','ch'), ('y','ch'))
```

`wych` is `w` + `ych` or the diphthong `wy` + `ch`, and no rule in this
orthography tells them apart. The two readings give opposite verdicts against
`fynych`, so the pair is refused rather than guessed — doctrine 53's rule, a
verdict that turns on a distinction the orthography has already collapsed. Both
decided readings are reachable and neither is asserted better: `glide="vocalic"`
calls it False, `glide="consonantal"` calls it True.

### 2b · Why the English anchor cannot be ported, stated as a mechanism

Welsh stress is **penultimate**. So:

* on a polysyllable, "from the last prominent nucleus to the end of the word"
  covers **two** syllables;
* on a monosyllable it covers **one**.

*Cywydd deuair hirion* pairs exactly those two on purpose: one line of the
couplet ends *acennog* (accented final syllable), the other *diacen* (accent on
the penult). The port therefore compares a two-syllable span against a
one-syllable span on **every** couplet of the form, and answers True on 2 of 52.

It also **refuses outright on a proclitic line-end**, because a proclitic has no
prominent syllable at all — 117 of 5,246 staged line-ends are proclitics, and
that is doctrine 46 deciding whether a rule can answer rather than merely
tidying one up.

This is `fin.py`'s `maa : vapaa` arriving from the opposite direction. There the
port failed because Finnish stress is fixed on syllable **1** and never final;
here it fails because Welsh stress is fixed on the **penult**. Two languages,
two fixed-stress rules, one ported predicate, and it is wrong in both — which is
a stronger statement about the English anchor than either cell could make alone.

---

## 3 · The songs: an offset profile, because no slot was declared

The Welsh free-metre song is not one form and the corpus does not declare a
rhyme slot for any of the four books. `offset k` asks whether line *i* rhymes
line *i+k*, pooled over every *i* with both inside one printed unit. Depth 1,
excess over that file's own null max; `fz` is FROZEN, §7.

| file | units | offset 1 | offset 2 | offset 3 |
|---|---:|---|---|---|
| alun | 29 | 16.7% / 22.0% −5.4 (p0.194) fz4.3% | **36.7% / 22.8% +13.9 (p0.005)** fz4.1% | 0.0% / 23.8% −23.8 fz4.0% |
| hwiangerddi | 305 | 29.4% / 26.3% +3.1 (p0.005) fz15.2% | 24.6% / 25.7% −1.1 (p0.035) fz11.1% | 10.6% / 23.8% −13.2 fz9.8% |
| mynyddog | 403 | 21.0% / 16.4% +4.6 (p0.005) fz5.1% | **31.2% / 16.3% +14.8 (p0.005)** fz4.5% | 4.1% / 16.0% −12.0 fz4.1% |
| twm_or_nant | 71 | **28.3% / 14.4% +13.9 (p0.005)** fz2.4% | 17.7% / 14.3% +3.4 (p0.005) fz2.3% | 3.3% / 14.1% −10.8 fz2.2% |

**Three behaviours, and a pooled row would have hidden two.**

* **Alternate rhyme (offset 2 dominant)** — Alun and Mynyddog, both by more than
  13 points over their own null max, with offset 1 at or below its null on Alun.
* **Couplet rhyme (offset 1 dominant)** — Twm o'r Nant, +13.9 at offset 1 against
  +3.4 at offset 2. His edition names the AIR for all twelve songs; these are
  words written to tunes.
* **Neither, strongly** — the *hwiangerddi*. Its largest excess anywhere is
  +3.1pp and its offset 2 is *below* its own null. A nursery-rhyme collection of
  274 items is not one form, and 36 of its 305 units are two lines long, where
  the null is half-degenerate (§7).

Offset 3 is below its own null in all four books, which is what a form with a
short repeating period looks like.

---

## 4 · The 108, and a null that turned out to be the identity map

The arm that recorded the refusal takes four-line blocks, cap 8 per file, and
asks **all six pairs**. Same material, same six pairs, now with a predicate:

| reading | mandated | judged | refused | observed | null med | null max | excess | **differ** | frozen |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| depth 1 (SHIPPED) | 108 | **108** | **0** | 26.85% | 26.85% | 26.85% | +0.00pp | **0.0%** | 16.3% |
| depth 2 | 108 | 108 | 0 | 17.59% | 17.59% | 17.59% | +0.00pp | 0.0% | 16.3% |
| prominent | 108 | 102 | 6 | 15.69% | 15.69% | 15.69% | +0.00pp | 0.0% | 16.3% |

**`108, 0, 108` becomes `108, 108, 0`.** The three counts are the finding; the
RATE beside them is not, and the reason is worth its own paragraph.

**THE NULL ON THOSE ROWS IS THE IDENTITY MAP.** All six unordered pairs of a
four-line unit are the same six pairs after any permutation of its four end
words, and `rhymes` is symmetric — so "how many of the six rhyme" is a symmetric
function of the unit's end-word multiset and the randomisation returns the
observation **exactly, every replicate**. `differ 0.0%`, obs == null median ==
null max, excess +0.00pp.

This is a **third mechanism** for a trap the repo has now recorded three times:

| | mechanism | how it was caught |
|---|---|---|
| doctrine 63 | the PREDICATE is symmetric over the line's word multiset (Kalevala) | p = 1.0000 at 200 replicates |
| doctrine 68 | the ELEMENTS permuted are identical (Persian radif) | 94.5% of replicates byte-identical |
| **here** | the STATISTIC pools every pair the permutation could have moved between | differ 0.0%, obs == null exactly |

And the finer diagnostic **would not have caught it**: `frozen 16.3%` on the
same rows, because 4 of the 24 permutations of a quatrain fix any given slot's
pair, so an individual slot moves 83.7% of the time while the pooled statistic
never moves at all. Both diagnostics are printed on every arm in the runner for
exactly this reason.

**What the null CAN move is which DISTANCE each rhyming pair lands at**, which
is the statistic `negative_control.py --langs` already uses and which is not
degenerate:

| reading | rhyming pairs | d1 | d2 | d3 | TV obs | null MAX | gap | p |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| depth 1 | 29 | 0.7586 | 0.1379 | 0.1034 | 0.2448 | 0.2741 | −0.0293 | 0.0952 |
| depth 2 | 19 | 0.8947 | 0.1053 | 0.0000 | 0.3711 | 0.3974 | −0.0263 | 0.0952 |

**It does not separate, and the honest reading is the material, not the
language.** 29 rhyming pairs is below the n=30 pair floor `negative_control.py`
itself enforces (doctrine 72), and the arm now says so in its own output rather
than printing a number. 18 four-line blocks were selected out of **809 printed
units** by a TYPOGRAPHIC rule plus a cap of 8 per file. Welsh song is not
written in fours: 172 of 305 *hwiangerddi* units are, 77 of 403 Mynyddog units
are, and the cap discards the rest. **§3 is the arm to read.**

---

## 5 · False-positive rate (doctrines 16, 22) — UNCALIBRATED

20,000 pairs drawn **with replacement from the 5,246 line-final tokens of all
five staged files**, seed 20260811. The draw is stated because
`RESULTS_FIN_RHYME.md` §6 found the spread over sampling rules larger than the
gap between two grades.

| reading | mandated | judged | refused | admits |
|---|---:|---:|---:|---:|
| **depth 1 (SHIPPED)** | 20000 | 19656 | 344 (1.72%) | **2.111%** |
| depth 2 (rich grade) | 20000 | 19656 | 344 (1.72%) | 1.597% |
| prominent (ENGLISH PORT) | 20000 | 18703 | 1297 (6.49%) | 0.572% |
| diacritics=keep | 20000 | 19656 | 344 (1.72%) | 2.050% |
| glide=vocalic | 20000 | 19657 | 343 (1.72%) | 2.111% |
| glide=consonantal | 20000 | 19657 | 343 (1.72%) | 2.116% |

**UNCALIBRATED, and there is nothing here to calibrate.** These are the
readings' chance rates on this corpus. Nothing was swept, nothing targeted, and
no threshold was set to hit one of them — `cym.rhymes` has **no threshold at
all**; it is exact tuple equality, so doctrine 16's "fails toward whoever
guessed" has no guesser to fail toward. The numbers are here so that a later
reader comparing a Welsh rate to an English one knows what chance looks like on
each side.

**The FPR does not adjudicate the anchor, and this table is where that gets
tested.** `prominent` has by far the lowest chance rate (0.572%) and would win
any contest scored on selectivity. It is the reading that answers True on 2 of
52 attested couplets. Doctrine 61 says pick by lift over a **matched** control,
and the matched control is §2's permutation null, where depth 1 leads
(+90.74pp against +0.00pp) — not this one.

---

## 6 · Where the refusal falls (doctrines 67, 79, 88)

**Word level** — `cym.readability_census`:

| population | total | read | refused | defective | by code |
|---|---:|---:|---:|---:|---|
| ALL tokens, 5 files | 29569 | 29443 | 0 | 126 | `vowelless_token` 126 |
| line-final tokens | 5246 | 5198 | 0 | 48 | `vowelless_token` 48 |

Zero `out_of_inventory`, which corroborates the five staged headers' own claim
that `cym.py` reads 100% of their tokens. The 126 defective are the ingestion
layer's, not this module's — the whole head of the distribution, in order:
`c` 40, `'n` 17, `'r` 14, `f'` 11, `v` 11, `mr` 6, `jpg` 4, then a tail of
singletons. Footnote markers, plate filenames and bare elision fragments left
behind by the extraction.

**Pair level** — `cym.pair_census`, which is the count the word-level census
cannot produce:

| population | mandated | judged | refused | by code |
|---|---:|---:|---:|---|
| MANDATED (cywydd couplets) | 54 | 51 | 3 (5.56%) | `undecided_glide` 3 |
| the straddling pairs | 53 | 53 | 0 (0.00%) | — |
| RANDOM line-final tokens | 20000 | 19656 | 344 (1.72%) | `vowelless_token` 343, `undecided_glide` **1** |

**`undecided_glide` is an AIMED refusal in doctrine 67's sense, and it is aimed
by construction rather than by luck.** It is the only refusal in this module that
is a property of the PAIR: the word-level marker is on 34 of 5,246 line-final
tokens, but the refusal fires only where the two readings actually DISAGREE
about the pair in front of them — **3 of 54 mandated couplets against 1 of
20,000 random pairs**. `fas.rhymes` refuses 60.2% of real Ḥāfiẓ rhyme pairs and
~5% of random ones and that is called aimed; this is the same shape at a
hundredth of the size. The other two codes are word properties and are blunt by
construction, which is `fin`'s profile.

---

## 7 · Is the null the identity map? Three shapes, measured (doctrines 63, 68)

Doctrine 68 says check what fraction of replicates differ from the observation
at all. Doing that alone would have passed §4's entirely degenerate null, so
this cell measures **three** things and reports that no one of them implies the
others:

| diagnostic | question | where it is printed |
|---|---|---|
| per-unit | does the permutation return the unit itself? | this section |
| per-slot (`frozen`) | does it return that slot's unordered pair? | every arm |
| per-statistic (`differ`) | does it return the pooled rate? | every arm |

**Per-unit, 200 replicates:**

| file | permutable units | replicate-units identical to the printed one | all-one-word units |
|---|---:|---:|---:|
| cym_cynghanedd_llywelyn_goch_cywydd | 1 | 0.00% | 0 |
| cym_song_alun | 28 | 0.00% | 0 |
| cym_song_hwiangerddi | 301 | **9.36%** | 1 |
| cym_song_mynyddog | 358 | 1.48% | 0 |
| cym_song_twm_or_nant | 71 | 0.23% | 0 |

The *hwiangerddi*'s 9.36% is doctrine 68's mechanism arriving from unit LENGTH
rather than from a radif: 36 of its units are two lines long, and half the
permutations of two elements are the identity. It is not fatal — the excesses
in §3 are computed against a null that is diluted by exactly that much, so they
are conservative — but it is a coordinate of every *hwiangerddi* number above
and it is stated rather than left to be rediscovered.

§4's rows have per-unit 0.0% and `frozen 16.3%` and `differ 0.0%`. **Two of the
three diagnostics pass a null that returns the observation on every replicate.**

---

## 8 · The tradition test (doctrine 37), 14/14

Every pair is a real line-end from a staged file, and the fixture is checked
against the file before any verdict is asked of it — on its first run the
fixture said `hoewfardd` and `rodded` where the edition prints `hoew-fardd` and
`trwch--`, and the assertion caught both.

| case | expected | got |
|---|---|---|
| cywydd L1/L2 `hoew-fardd : fardd` (diacen : acennog) | True | True |
| …under the ENGLISH PORT | False | False |
| cywydd L3/L4 `heddiw : lliw` | True | True |
| cywydd L5/L6 `trwch-- : degwch` (through the edition's em dash) | True | True |
| cywydd L9/L10 `Wynedd : bedd` (digraph coda kept whole) | True | True |
| cywydd L31/L32 `sidan : lân` (circumflex against plain vowel) | True | True |
| …with `diacritics="keep"` | False | False |
| cywydd L55/L56 `fynych : wych` (glide) | **None** | None |
| …decided `glide="vocalic"` | False | False |
| …decided `glide="consonantal"` | True | True |
| cywydd straddle L2/L3 `fardd : heddiw` | False | False |
| treiglad `tân : dân`, `brân : frân`, `môr : fôr` | True | True |
| a proclitic line-end under the ENGLISH PORT | **None** | None |

**And on the two strict-metre files outside `corpus/song/`:**

| file | reading | couplet parity | straddle |
|---|---|---:|---:|
| cym_twm_or_nant_cywydd | depth 1 (SHIPPED) | **69/77 = 89.6%** | **0/77 = 0.0%** |
| cym_twm_or_nant_cywydd | diacritics=keep | 61/78 = 78.2% | 0/77 = 0.0% |
| cym_twm_or_nant_cywydd | prominent (PORT) | 1/71 = 1.4% | 0/69 = 0.0% |
| cym_alun_strict | depth 1 | 289/775 = 37.3% | 423/771 = 54.9% |
| cym_alun_strict | prominent (PORT) | 8/758 = 1.1% | 14/758 = 1.8% |

`cym_twm_or_nant_cywydd.txt` is ONE cywydd and its couplets sit at even line
indices, so the parity cut is the form: **89.6% against 0.0%**, a second
independent replication of §2 on a different poet three centuries later.

`cym_alun_strict.txt` is **not** a clean arm and is printed as an aggregate,
labelled as one. It is 1,558 lines of several awdl and cywydd pieces with no
unit markers, so no single global parity can be its couplet boundary; both of
its columns are high because an awdl is monorhymed across many lines. It is
reported because omitting the row that does not behave would be selecting the
evidence.

### 8a · The circumflex, which is where the tradition overruled the module

Unfolded, **8 of the 78 couplets** of `cym_twm_or_nant_cywydd.txt` come back
False on nothing but a length mark:

```
dygyfor : môr      wâg : rhedeg-wag    fôn : galon     dôn : galon
gân : ddatgan      uchel : chêl        sôn : gofion    amcan : gân
```

Folding recovers every one of the eight (61 True → 69). A form whose end-rhyme
is obligatory does not miss one couplet in ten, so the fold is chosen by the
tradition and not by taste.

**The second argument is the one doctrine 50 asks for: what does the
transcription do to the constraint?** The staged corpus writes the same language
two ways, and the split is by ENCODING:

| file | body characters (blank and `#` lines excluded) | combining circumflex | header's own statement |
|---|---:|---:|---|
| cym_song_mynyddog | 92,519 | **0** | "the transcription is ISO-646-US ASCII, so the circumflexes … are FLATTENED" |
| cym_song_alun | 6,243 | **0** | "ASCII so circumflexes are flattened" |
| cym_song_hwiangerddi | 48,421 | 122 | "UTF-8 with real circumflexes" |
| cym_song_twm_or_nant | 25,097 | 47 | UTF-8 |
| cym_cynghanedd_llywelyn_goch_cywydd | 3,062 | 6 | UTF-8 |

Over all seven Welsh files the mark count is **191 combining circumflexes
against 2 combining diaereses**, so the mark being folded is overwhelmingly the
length mark. This is `fin.py`'s `<w>`/`<v>` case (MISSING M-5) in a second
language: one distinction, two transcriptions, MIXED ACROSS the corpus. Not
folding would make a Welsh rhyme verdict a function of which volume the line
came out of.

**The cost is declared and it is small**: over the staged corpus's 8,115
offset-1 and offset-2 pairs, `diacritics="keep"` changes **22** verdicts —
21 that the shipped fold calls True become False, and 1 that it REFUSES becomes
False. Nothing moves the other way. What is folded is a length contrast that
two of the five staged files do not record at all.

**The fold drops a mark only over a VOWEL, which is not fussiness.** A blanket
"strip every combining mark" would turn `ñ` into `n` and quietly admit a foreign
proper name that `units()` correctly refuses — the monoculture error walking in
through a normaliser. Pinned in §10j of the tests.

---

## 9 · REPEAT, and the trap that made `whitman.txt` ineligible

Doctrine 3: identity is not rhyme. Half of `corpus/whitman.txt`'s detected chain
links are REPEAT on an identical token — `now` closing four consecutive lines —
which is why that file was never an eligible negative control. A Welsh **song**
corpus is full of refrains, so the same trap is live here.

| file | TRUE verdicts (offsets 1–2) | REPEAT | RIME_RICHE | RHYME |
|---|---:|---:|---:|---:|
| cym_cynghanedd_llywelyn_goch_cywydd | 51 | 0 (0.0%) | 6 | 45 |
| cym_song_alun | 89 | 0 (0.0%) | 10 | 79 |
| cym_song_hwiangerddi | 521 | **42 (8.1%)** | 58 | 421 |
| cym_song_mynyddog | 1106 | 39 (3.5%) | 94 | 973 |
| cym_song_twm_or_nant | 303 | 1 (0.3%) | 37 | 265 |

`relation_type` types it rather than deleting it (doctrine 24), and the numbers
say the trap is real but not dominant: 8.1% of the nursery-rhyme book's TRUE
adjacent verdicts are the same word twice. The cywydd carries none at all, which
is a property of the strict metre and a further reason it is the arm to read.

**The Finnish trap was looked for and is not the same here.** In the Kalevala
control, ADJACENT lines agreed above chance because parallelism repeats an
inflectional ending. The Welsh straddle arm — the same structural position — is
**0 of 53**, so nothing analogous is happening in the cywydd. Where a Welsh
excess at offset 1 does appear it is in the *song* books, and there it is the
form (Twm o'r Nant's couplets), not parallelism.

---

## 10 · Open, and which blocker each one is (doctrines 44, 92)

1. **No dated source stating the Welsh *odl* rule was reachable from this
   cell.** Doctrine 62 asks for the tradition's own statement of the rule before
   a checker is written for it, and this cell could not obtain one, so every
   coordinate above is chosen by MEASUREMENT against attested verse instead. The
   search is recorded, not remembered (doctrine 39) — the row is in
   `PATCHES-not-mine.md` for `data/sources.tsv`. Measured on 2026-08-11:
   `archive.org` and `en.wikisource.org` return `EGRESS_BLOCKED` from this
   environment; `gutenberg.org`, `babel.hathitrust.org`, `google.com/books` and
   `journals.library.wales` return HTTP 000 through the proxy;
   `raw.githubusercontent.com` is the only channel that answers. Over GITenberg,
   a repository search `org:GITenberg welsh` returns **35 repositories** (some
   matching the surname rather than the language) and **none is a grammar of the
   language or a treatise on cerdd dafod**. Two Welsh reference works are there:
   `A-Pocket-DictionaryWelsh-English_19704`, FETCHED (902,120 bytes, HTTP 200,
   PG header verbatim "Transcribed from the 1861 Hughes and Son edition by David
   Price"), and `Geiriadur-Cymraeg-a-Saesneg-Byr_49685`, NOT fetched. The
   dictionary's entries are glosses and not rules — verbatim, `Odli, v. to make
   rhyme; to rhyme`, `Cywydd, n. a kind of metre; perception; conscience`,
   `Cynghanedd, n. consonancy` — and its Rhagymadrodd states no prosody.
   `Welsh-Lyrics-of-the-Nineteenth-Century_15165` was fetched (85,900 bytes,
   HTTP 200) and its translator's preface discusses metre without stating a
   rhyme rule.
   **Named unblock route, unverified because it is unreachable:** a web search
   returns an archive.org item `dosparthedeyrnd01abergoog`, whose returned title
   string is *"Dosparth Edeyrn Davod Aur; or, The ancient Welsh grammar … to
   which is added Y pum llyfr kerddwriaeth, or The rules of Welsh poetry … with
   English translations and notes"*. Nothing about that item is asserted here
   beyond the identifier and the title string as returned, because the fetch was
   refused. *Blocker: **cannot obtain**, not hard-to-build — the rule is
   implemented and measured; what is missing is the tradition's own words to
   check it against.*
2. **A shared grammatical ending is not typed.** `fin.relation_type` returns
   `SUFFIX_RHYME` because it holds a declared list of Finnish endings. No
   comparable Welsh list is reachable (item 1), and inventing a plausible one
   would be the thing this repo forbids. `shared_tail()` ships the raw
   diagnostic instead, and the size of the unanswered question is visible: over
   the cywydd's 45 non-REPEAT TRUE couplets the commonest shared written tails
   are `edd` 4, `u` 3, `ir` 2, `ud` 2, `erch` 2, `eg` 2, `i` 2, `ae` 2 — a flat
   distribution with no dominant ending, so whatever the answer is it is not
   carrying the relation the way agglutination carries it in Finnish.
   *Blocker: **cannot obtain**, same row as item 1.*
3. **No Welsh text in which end-rhyme is ABSENT is staged.** All five files in
   `corpus/song/cym_*` and both files in `corpus/cym_*` are rhymed verse forms.
   The negative arm in §2 is therefore a POSITION inside a rhymed text and not
   an independent text, and it is labelled as one throughout. What would close
   this is Welsh **prose** lines or *rhyddiaith* staged with a row — the
   equivalent of what `fin_kanteletar.txt` is for Finnish. This cell does not
   own `corpus/` and has staged nothing.
   *Blocker: neither — it is a staging request, and the material is one `curl`
   away on a channel that already answers.*
4. **The four-line block is a selection rule nobody declared as one**, and in
   Welsh it is a much heavier one than in Finnish: 18 blocks survive out of 809
   printed units. §3 is the arm without it. What is not fixable here is the
   *form's own* unit, which the corpus does not carry as a field.
   *Blocker: a schema gap, and this cell does not own the corpus.*
5. **`DIPHTHONGS` carries a dead entry.** `"yb"` can never match, because the
   merge fires only where both members are classed `V` and `b` is a consonant;
   `"aw"` is listed twice and the set collapses it. Both are left in place and
   annotated rather than silently deleted — removing them is provably a no-op,
   and an inventory with an entry nobody checked is worth a sentence.

---

## 10a · None of the four declared coordinates is inert (`relations.py --inert`'s question)

Doctrine 1's inverse failure — a coordinate nobody reads is a stated assumption
that is not in force — measured over the staged corpus's 8,115 offset-1 and
offset-2 pairs, by counting how many PAIR VERDICTS each setting changes against
the shipped default. A coordinate that changes none is a constant wearing a
coordinate's name.

| coordinate | setting | verdicts changed | breakdown |
|---|---|---:|---|
| anchor depth | `depth=2` | 673 | grades, not rival rules |
| anchor rule | `rule="prominent"` | 1416 | the falsified English port |
| diacritics | `diacritics="keep"` | 22 | True→False 21, None→False 1 |
| glide | `glide="vocalic"` | 13 | None→True 6, None→False 7 |
| glide | `glide="consonantal"` | 13 | None→False 6, None→True 7 |

The glide rows are the informative pair: `undecided` refuses **13** pairs that
either decided reading would answer, and the two decided readings **disagree
about all 13** — 6/7 one way and 7/6 the other. That is the refusal doing
exactly what it is for, and it is measured rather than argued.

`mutation` is the one declared coordinate with no setting, and it is not inert
in that sense either — it is a DERIVATION with nothing to switch. §10h of the
tests measures it: `tân/dân/thân`, `brân/frân`, `môr/fôr`, `cân/gân/chân` have
one rime between them because the rime begins at a nucleus and never reads its
own first onset. A mutation flag would be a field with one behaviour, which is
the shape `relations.INERT` exists to catch, so none is offered.

---

## 10c · One defect in this cell's own code, found by reading it rather than by watching a rate

`rhymes` took the verdict over the CROSS-PRODUCT of the two words' undecided
glide readings. That is right for two DIFFERENT words — `wych` and `wynt` each
carry the ambiguity and their answers are separate lexical facts. It is wrong
for two occurrences of ONE form: whatever the truth about `wych` is, both copies
of it have it, so `wych : wych` came back **None** where a REPEAT is certain
under either reading.

**It occurs 0 times in the staged corpus**, which is why it had to be found by
reading the method rather than by watching a number move — and it is exactly the
shape doctrine 3 says to watch for, since a Welsh *song* corpus is full of
refrains and §9 already measures 42 REPEAT verdicts in the *hwiangerddi* alone.
Fixed by `_same_form`, which is the comparison `units()` itself makes: case,
apostrophe, hyphen, and the length mark when `diacritics="fold"`. Pinned in
§10g of the tests, including that `tân : tan` is a REPEAT under the shipped fold
and NONE under `diacritics="keep"` — the fold decides whether they are one word,
and that is the declared choice rather than a side effect of it.

**One figure in this file moved because of the fix and it is not an arm's
value:** the straddle arm's `p_lo` went 0.3085 → 0.2985 and its `differ`
69.5% → 70.5%, because a NULL replicate can pair a word with itself and that
replicate now scores True instead of refusing. Every observed rate, every count
and every excess is byte-identical.

---

## 10b · The hyphen defect that was just closed for English cannot occur here

`72a91b3` made the anchor-layer hyphen defect a REFUSAL for English: the last
piece of a hyphenated word went unread, the anchor was built from an earlier
piece, and any two Dorset participles scored as rhyming on the schwa of `a-`.

**Welsh cannot inherit it, because Welsh JOINS on the hyphen.** `cym.units()`
deletes an internal hyphen — `di-baid` is one phonological word printed with a
joint (doctrine 65, and the opposite of the Finnish rule). Measured over the
five staged files:

* **41 hyphenated line-final tokens** (37 distinct: `ben-felen`, `boch-goch`,
  `canol-fys`, `ddi-daro`, `bi-drot`, `--cyd-fyw` …).
* `rime(whole) == rime(de-hyphenated)` on **41 of 41**.
* `rime(whole) == rime(LAST piece)` on **41 of 41** — the last piece is always
  read, which is precisely the property whose absence was the English defect.
* Instances where the rime is built from an EARLIER piece: **0 of 41**.

`hoew-fardd : fardd`, the staged cywydd's first couplet, is the case in the
tests (§10i): it rhymes THROUGH the hyphen, at rime `('a', 'rdd')`.

---

## 11 · The battery did not move

`python3 battery.py` → `mandated 1064, judged 1014, refused 50`,
`violations 81 (8.0% of judged)`. Unchanged, and it must be: the battery is
English sonnets and nothing in this cell touches the English comparator.

`python3 quality/cynghanedd_rate.py corpus/cym_alun_strict.txt 20` →
`caesura='search' 890/1558 = 57.1%`, which is the figure `cym.py`'s own
docstring records for the class rule. **The rime path is deliberately separated
from the cynghanedd path** so this could not move: the diacritic fold and the
glide alternative are applied inside `rimes()` and by nothing else, and
`syllabify`, `skeleton`, `answer` and `cynghanedd` are byte-identical in
behaviour. §10j of `quality/test_phonology.py` pins it.

Also green: `quality/test_fit.py` (§14 enumerates all nine phonologies),
`quality/test_phonology.py`, `quality/verify_doctrines.py`,
`quality/test_crosslinguistic.py`, `quality/test_declared_inputs.py`,
`quality/test_null_shapes.py`, `quality/test_relations.py`,
`quality/test_homograph.py`, `quality/test_msa_fin.py`, `quality/test_verbs.py`,
`quality/test_taxonomy.py`.

**`quality/test_taxonomy.py` §14 went red because of this cell and was REPINNED,
not deleted.** Its check *"a phonology that declares NO rhyme predicate is not
consulted"* used `cym` as its example. The invariant it guards is unchanged — an
inherited stub's `None` must not read as a refusal — so it now points at `eng`,
and three checks were added pinning the SHAPE of the repair: that `cym` IS
consulted now, that `consult=False` still reaches the channel path (doctrine 84),
and that cym's DESIGNED refusal propagates as `None` where the channels answer
`False`. **The example has now moved twice — `fin` → `cym` → `eng` — and the pool
is down to one.** Seven of the nine registered phonologies declare their own
`rhymes` (cym, fas, fin, ltc, msa, non, san); only `eng` and `som` inherit the
stub, and `som` is ineligible for the same reason it was last time — it declines
a stress grid, so the default anchor raises there for an unrelated reason. When
`eng` declares one, this check has no shipped target and the comment says what to
do: replace it with a synthetic `Phonology` subclass that inherits the stub on
purpose. The distinction between a stub's `None` and a refusal's `None` does not
stop mattering when no shipped module happens to exhibit it.
