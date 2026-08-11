# RESULTS — the corpus audit (adversary 5)

`quality/audit_corpus.py`, run 2026-08-11 over `corpus/` at 269 files.
Pins: `quality/test_corpus_audit.py`, 32 assertions, all holding.

Six adversaries attack everything downstream of the text. This one attacks the
text. Every corpus-level finding this project owns — doctrines 50, 51, 52, 53,
70, and this session's Malay population case — was made by hand, one file at a
time, and each cost a cell most of a run. This file is the record of making
them cheap, and of what the cheap version then found that the hand versions
had not.

---

## 0. THE HEADLINE, and it is not one of the checks I was asked for

**Ten item bodies in this corpus are byte-identical across two files, and all
ten are attribution errors.** 25,142 items of four or more lines; exactly ten
collisions; zero within-file repeats; and the ten fall into exactly two pairs.

### 0.1 · Coleridge and Wordsworth share nine poems, and all nine are Wordsworth's

`corpus/song/eng_british_samuel_taylor_coleridge.txt` and
`corpus/song/eng_british_william_wordsworth.txt` carry **nine identical item
bodies, 563 lines** — **42.3% of the entire Coleridge file**.

| item | lines |
|---|---:|
| Simon Lee, The Old Huntsman | 104 |
| The Last Of The Flock | 100 |
| The Mad Mother | 100 |
| We Are Seven | 69 |
| Anecdote For Fathers | 60 |
| Lines Written Near Richmond, Upon The Thames | 42 |
| Expostulation And Reply | 32 |
| The Tables Turned | 32 |
| Lines Written In Early Spring | 24 |

Every one is canonically **Wordsworth's**. The mechanism is in the two files'
own headers: both name
`GITenberg/Lyrical-Ballads-With-a-Few-Other-Poems--1798-_9622 9622-8.txt md5
257d8a9370364d7b9357666f717db606` as a source. **The 1798 *Lyrical Ballads*
was published anonymously** — the volume names no author for any poem — so
whatever rule split it into two author files had nothing in the text to split
on, and assigned nine Wordsworth poems to both men.

The cost is not cosmetic. `corpus/song/` is the population for every
`eng_british_*` rate this project quotes, and these 563 lines are in it twice.
As an "independent author", Coleridge is 42.3% a copy of Wordsworth.

### 0.2 · Brady is Tate

`corpus/song/eng_hymn_brady.txt` is **one song, and it is the same song** as
the first item of `corpus/song/eng_hymn_tate.txt`. 12 of 12 distinct verse
lines shared; 100% containment.

Both files name the same source, `GITenberg/The-Otterbein-Hymnal…_16455
16455.n.txt md5 647743d8c980eac4b66f7c35d2a20b37`. Reading that source
settles it: the hymn "Oh, render thanks to God above" is signed
**`Tate-Brady.`** — a JOINT attribution, the standing name of the 1696 *New
Version of the Psalms*. The two hymns the source signs `Nahum Tate, 1696.` are
in the Tate file and not the Brady one. **`Nicholas Brady` appears nowhere in
the source as a sole author, so `eng_hymn_brady.txt` contains nothing that is
his alone**, and its header line `# author: Nicholas Brady (1659-1726)` is a
claim the source does not make.

### 0.3 · Why doctrine 51 did not cover this

Doctrine 51 was written about two URLs serving ONE FILE — `cltk/non_texts` and
`cltk/old_norse_texts_heimskringla`, md5 `c221b376…`, byte-identical. Whole-file
hashing finds that. **It does not find this**, because these files are *not*
byte-identical: they are two different cuts of one joint volume, and the
duplication lives at the ITEM level. The corpus has zero whole-file md5
collisions and two item-level ones.

> **Doctrine 51 extends.** Corroboration across repositories can be a single
> file; corroboration across AUTHORS can be a single volume. The tell is the
> same — count distinct BYTES — but the unit has to be the item, not the file,
> and the cause is a joint or anonymous source whose attribution the extraction
> had to invent.

---

## 1. The check list

269 files. `FAIL` = a defect. `WARN` = a gap in the record. `NOTE` = a
declaration this module makes rather than a complaint.

| | check | doctrine | FAIL | WARN | NOTE | verdict |
|---|---|---|---:|---:|---:|---|
| A | ROW — every file reaches a `sources.tsv` row, every row a file | 34, 39 | **0** | 0 | 7 | PASS |
| B | HEADER — the file's own header against its row | 34, 54, 79 | **0** | 8 | 4 | PASS |
| C | HASH — recorded bytes against present bytes | 34, 79 | **0** | **217** | 0 | PASS with a large exposure |
| D | LANGUAGE — the declared phonology's readable fraction | 50 | **1** | 0 | 0 | one finding |
| E | DISTINCT — count distinct BYTES | 51 | **2** | 1 | 0 | **two findings, §0** |
| F | CHANNEL — the channel, not the legibility | 52 | **0** | 1 | 0 | PASS |
| G | ORTHOGRAPHY — the destroying alternant | 50, 70 | **0** | 0 | 182 | PASS, one live cost §4 |

Exit status is 1, on E's two.

### A · ROW (doctrine 34) — 0 failures

**Every one of the 269 files reaches a row.** Three declared routes:
`local:<path>` row (54 files), the file's header naming a parent `source_id`
(210), a row's prose naming the path (5). `verse.txt`'s rule holds.

The 5 prose-only files (`sonnets.txt`, `whitman.txt`, `cym_alun_strict.txt`,
`cym_twm_or_nant_cywydd.txt`, `fas_hafez.LICENSE.txt`) are reported as NOTE:
that route survives only as long as somebody keeps writing the path into a
note, and it is one edit away from becoming the `verse.txt` case. Proposed
`local:` rows for all five are in the cell's scratch `sources_rows.tsv`.

The reverse direction finds two rows naming paths that do not exist —
`corpus/song/ltc_ci_*` and `corpus/song/ltc_yuefu_*`, both from
`rime-aca/corpus` rows that say **REJECTED** (doctrine 85). **This is the
record working, not failing**, and the auditor says so rather than counting it:
doctrine 39's whole point is that a refused or unfound source gets a row naming
the path the material would have occupied.

### B · HEADER — 0 failures, and two of my own removed

134 files carry an upstream md5 in their header that their parent row also
records; **134 of 134 agree**. 44 numeric count fields (`# songs:`,
`# lines:`) and 30 `N staged` prose counts; **74 of 74 agree** with the
`--- TITLE:` and verse-line counts measured from the file.

WARN ×8: files with no `#` header at all (`sonnets.txt`, `whitman.txt`,
`fin_kalevala.txt`, `fas_hafez.json`, `fas_hafez.LICENSE.txt`,
`cym_alun_strict.txt`, `cym_twm_or_nant_cywydd.txt`,
`generated/sonnets_generated.txt`) — the eight oldest files in the repo, all
predating the header convention. NOTE ×3: no declared language, so checks D, F
and G do not run on them.

**THIS CHECK RAISED 33 FAILURES ON ITS FIRST RUN AND ALL 33 WERE ITS OWN, IN
TWO CLASSES, AND BOTH ARE NOW PINNED.** Recorded because an auditor that manufactures findings is
worse than one that misses them — a reader cannot tell a manufactured finding
from a real one, so every real finding it prints loses its warrant too.

1. **A prose sentence is not a declared count** (22 false FAILs).
   `cym_song_alun.txt` says "(3 hymns + 3 songs; the free-metre half of Gwaith
   Alun" and its `# songs:` field says 6, which is right.
   `fas_attar.txt` says "852 ghazals in the source; 284 staged" — the 852 is
   the SOURCE's population, correctly labelled, and 17 of the 22 were that
   sentence in 17 Persian files. `ltc_huajianji.txt` says "Its 50 songs are
   present" about one 卷 of twelve. `fin_kanteletar.txt` says the source's
   AINEHISTO lists 238 + 354 + 60 = 652 numbered songs and the file has 653
   blocks — 652 songs plus the `[motto]` block, and both numbers are right.
   The check now reads declarations and one unambiguous prose form, and
   everything else is left alone with the decision written down.
2. **An extract's md5 is not its source's md5** (11 false FAILs). A `local:` row
   records the STAGED bytes; a header records the UPSTREAM bytes. Comparing
   the two is comparing an extract to its source and calling the difference a
   defect — **doctrine 79's error, committed by the instrument built to find
   it.** The comparison now goes against the PARENT row and is still exercised on 134 files.

### C · HASH — 0 drift, and the exposure is the finding

**No file has drifted.** 52 files carry a hash in their row (19 md5, 33
sha256) and all 52 reproduce exactly.

**217 of 269 files have no hash of their own recorded anywhere.** Their parent
row records the UPSTREAM bytes, which is a different object: it detects a
change to the Gutenberg file and cannot detect a change to the staged extract.
Two more (`corpus/generated/sonnets_generated.txt`, `corpus/san_dcs_verse.txt`)
have a `local:` row and no hash in it.

This is not corruption; it is the absence of the instrument that would find
corruption. `python3 quality/audit_corpus.py --check C` prints the measured
md5 of every one of the 217, so the fix is a paste.

### D · LANGUAGE — one finding, and the check is weaker than it looks

**`corpus/fas_hafez.LICENSE.txt` is declared `fas` by its filename prefix and
reads at 1.0%** under `fas.in_inventory`. It is a licence text in English
sitting in `corpus/` under a language prefix: script census 2,894 Basic Latin
letters against 27 Arabic. Not a corruption — a non-corpus file in the corpus
directory, which the language-keyed checks D, F and G then all mis-audit. It
is also one of the five files that reach a row only by prose mention.

**AND HERE IS A DOCTRINE FALSIFIED ON CONTACT WITH THE DATA — the check I was
asked to build does not do what the brief says it does.** The brief says "a
file declared `cym` that reads at 2% under `cym` is mislabelled or
misencoded." True. But the converse does not hold, and the converse is what a
reader takes from a high number. Measured, 3,000 tokens of Shakespeare's
sonnets read under each declared phonology:

| read as | cym | fin | non | san | msa |
|---|---:|---:|---:|---:|---:|
| English text | **95.8%** | **99.7%** | 78.9% | 71.7% | 67.2% |

**English is 95.8% readable as Welsh and 99.7% readable as Finnish.** A
readability rate cannot answer "is the declared language the language the file
reads as" among Latin-script languages; it answers "are these bytes the script
the phonology declares". A module that reported 95.8% as confirmation would be
laundering its own input, so the number is printed with this baseline beside
it and the check is declared a SCRIPT test.

**The discriminating instrument is F, and that is doctrine 52 one level up:
check the specific channel, not the general legibility.** The eight Welsh
digraphs run 48.8–65.0 per 1000 characters on Welsh and are structurally
different in English, where `ll`, `dd`, `rh` are near-absent. Doctrine 52 was
written about a corrupted text; it turns out to be the right answer to a
MISLABELLED one as well.

### E · DISTINCT (doctrine 51) — 2 failures, §0

Whole-file md5: **0 collisions among 269 files.** Item bodies: 10 collisions
in 25,142 items, in two groups, both reported in §0. Line containment at
floor 0.60: one pair (Brady ⊂ Tate at 100%). At floor 0.35 the
Coleridge/Wordsworth pair appears at 47% (611 of 1,312 distinct lines) —
recorded so the two instruments can be seen agreeing.

### F · CHANNEL (doctrine 52) — 0 zero-channel files

Every file's own tradition's constraint characters, counted:

| lang | channel | floor / 1000 | observed on the corpus |
|---|---|---:|---|
| cym | the eight digraphs `ch dd ff ng ll ph rh th` | 20.0 | 48.8–65.0 |
| non | `þ ð æ ǫ ø œ` + `á é í ó ú ý` | 10.0 | 74.7–100.5 (external) |
| fin | `a e i o u y ä ö` | 300.0 | 770.6–792.5 |
| san | the IAST diacritics | 40.0 | 166.7–252.1 |
| msa | `a e i o u` | 200.0 | 652.9 |
| fas | Perso-Arabic letters | 300.0 | 763.7 |
| eng | the vowel letters | 200.0 | 434.3–623.2 |
| ltc | tone-bearing characters, per `data/qieyun_mc.tsv` | 500.0 | 807.7–833.5 |

One WARN, and it is the LICENSE file again: 6.3 per 1000 against a floor of
300. **No shipped corpus file is a Háttatal case.** The auditor rediscovers
the Háttatal case itself on the real 1848 OCR — §2.

### G · ORTHOGRAPHY (doctrines 50, 70) — 182 notes, one live cost

Doctrine 70 generalised: for each declared language, a pair of ALTERNANT
SPELLING SETS that write the same sound, one of which the constraint can read
and one of which it cannot. **Malay's `-ung`/`-uk` against `-ong`/`-ok` is one
row of this table, not a special case.**

| lang | destroying spelling | preserving spelling | files | destroying total |
|---|---|---|---:|---:|
| msa | Ejaan Rumi Baharu `-ung`/`-uk` | 1900 Straits `-ong`/`-ok` | 1 | **0** |
| non | Modern Icelandic epenthetic `-ur` | Old Norse `-r` | 0 | — |
| cym | pre-1588 `dh` for `dd` | the standard digraphs | 7 | **0** |
| fin | word-initial `<w>` for `<v>` | `<v>` | 12 | **287** |
| san | Harvard-Kyoto `aa ii uu` | IAST `ā ī ū` | 3 | **0** |
| fas | Arabic `ي ك` | Persian `ی ک` | 33 | **0** |
| eng | `over ever never heaven power flower` | `o'er e'er ne'er heav'n pow'r flow'r` | 126 | reported as HABIT |

**No verdict is a bare zero.** Doctrine 79's Malay lesson is exactly that a
zero is a property of a POPULATION, so every zero this check prints carries the
verse-line and token counts it was measured over and the sentence "`-uk` is 0
on the 513-line Malay extract and 2 on the 330 blocks it was cut from."

`eng` is declared a **HABIT** probe rather than an ALTERNANT one and can never
raise a FAIL: `never` is a legitimate word in its own right and not always a
regularised `ne'er`, so the ratio is evidence about an edition's habit and
never proof on its own. Building it any other way is how an auditor
manufactures 126 findings.

---

## 2. The calibration set — and it is not optional

`python3 quality/audit_corpus.py --calibrate`. Each case runs **twice**: a
PLANTED fixture carrying the mechanism, which travels with the test and needs
no network; and, when the tree is reachable, the REAL bytes against the
RECORDED figure. `UNREACHABLE` does not fail the run (doctrine 49) and is
never silent.

### Case 1 · the Háttatal consonant wipe — doctrine 52 — **REDISCOVERED, both halves**

Real tree: the 1848 Arnamagnæan *Edda Snorra Sturlusonar* OCR, 746 page files.

* **0 channel characters in the whole book.** Not one `þ ð æ ǫ ø œ á é í ó ú ý`
  across 746 pages.
* 24,507 Greek-block characters in the book. **The 121-page window with the
  Greek count closest to the recorded 3,474 carries exactly 3,474**, and it
  runs `…_0610.txt` … `…_0730.txt`. The doctrine's figure reproduces *to the
  character*, and the audit additionally recovers **which 121 pages** it was
  measured over — a coordinate the doctrine never wrote down.

### Case 2 · the byte-identical cltk pair — doctrine 51 — **REDISCOVERED, both halves**

`cltk/non_texts/Snorra-Edda/haattatal.txtl` and
`cltk/old_norse_texts_heimskringla/Snorra-Edda/txt_files/haattatal.txtl` both
hash to `c221b3761633838018e24ccf4e43e7fd`, the recorded value.

### Case 3 · the Malay extract-vs-source population — doctrine 79 / 70 — **REDISCOVERED, both halves**

Re-derived from the bytes, with the block rule restated rather than imported
(a calibration that shares code with the thing it calibrates proves nothing):

| | recorded | measured |
|---|---|---|
| PG47873 verse blocks (indent ≥ 4) | 705 / 5,555 lines | **705 / 5,555** |
| Malay-majority blocks | 330 / 3,442 lines | **330 / 3,442** |
| `-uk` over the 330 blocks | 2 | **2 — `teluk`, `bertepuk`** |
| `-ung` over the 330 blocks | 0 | **0** |
| `-ong` / `-ok` over the 330 blocks | 257 / 151 | **257 / 151** |
| staged extract | 513 verse lines | **513** |
| staged `-ong` / `-ok` | 38 / 28 | **38 / 28** |
| staged `-ung` / `-uk` | 0 / 0 | **0 / 0** |

Doctrine 70's amended figure, its two tokenisations and this session's
population finding all reproduce exactly. Pinned in
`test_corpus_audit.py::test_doctrine_70_figure_on_the_staged_file`, which runs
with no scratch tree because the staged file is committed.

**The auditor finds the errors we already know about.** It also finds the two
in §0, which nobody knew about.

---

## 3. A header claim that does not reproduce

`corpus/song/msa_skeat_pantun.txt`'s own header states:

> word-final `-ung` and `-uk` occur ZERO times against **25 `-ong` and 24
> `-ok`** tokens

The zeros reproduce. **The 25 and the 24 do not, under any of the six
tokenisations swept**: the measured values are 38 and 28 under doctrine 70's
stated rule, 41 and 30 letters-only, and 35/26, 38/28, 38/28, 37/28 under the
other four. This is already recorded as `UNVERIFIABLE` in `MISSING.md` M-3;
recorded here because it is the one live disagreement between a corpus file's
own header and a measurement of that file, and because it is what check B
would catch if the header wrote it as a field instead of as prose.

---

## 4. What the audit found that the record did not have

### 4.1 · The most `<w>`-mixed book in the corpus arrived today, and it costs 2.11 pp

`corpus/song/fin_wahanen_laulukirja.txt` — *Wähänen Laulu-kirja*, Turku 1864,
staged by a sibling cell during this session — writes **175 word-initial `w`
against 326 `v`**. That is **35% of its /v/-initial tokens in the glyph the
default reading does not fold.**

`quality/phonology/fin.py` has the fold and does not apply it by default in
`alliterates` / `line_alliteration`, on the stated ground that every recorded
rate is a coordinate of the unfolded reading (doctrine 58). Its docstring also
states the mechanism: *"a printing that used `<w>` THROUGHOUT would cost
nothing, and it is the MIXING that costs."* Measured:

| file | weak alliteration, `fold_w=False` → `True` | Δ | strong | Δ |
|---|---|---:|---|---:|
| `fin_kalevala.txt` | 82.60% → 82.60% | **+0.00 pp** | 55.92% → 55.92% | +0.00 pp |
| `fin_kanteletar.txt` | 81.84% → 82.15% | +0.32 pp | 60.21% → 60.43% | +0.22 pp |
| **`fin_wahanen_laulukirja.txt`** | **54.99% → 57.10%** | **+2.11 pp** | 24.13% → 25.11% | **+0.98 pp** |

The Kanteletar row reproduces `MISSING.md` M-5's figures to four decimals
(81.8342 → 82.1529 weak, 60.2134 → 60.4297 strong), which is what says the
instrument is measuring the right thing. **The new file's cost is 6.7× the
Kanteletar's on the weak channel and 4.5× on the strong**, and it is the
largest instance of M-5 in the corpus — found mechanically, on a file that had
been on disk for hours.

The probe also separates the two causes without being told to: the 7 `w`
tokens in `fin_paavo_cajander.txt` are `weberin`, `wecksell`, `windsorin`,
`walleniukselta` — foreign proper names, correctly spelled `w` — while the 175
in the Wähänen are `waan`, `wahinko`, `waeltain`, Finnish common words.

### 4.2 · The language code namespace in `data/sources.tsv` is not one namespace

108 of 386 rows open their `note` with a language code, and the table carries
`en` beside `eng`, `fi` beside `fin`, `sa` beside `san`, and **`lzh` beside
`ltc` for Literary Chinese** — 78 rows on one code and 1 on the other. Nothing
downstream reads these, so nothing is broken; recorded because an auditor that
compares a filename prefix against a row code has to map them, and the map is
now in `audit_corpus.ROW_LANG_ALIAS` where a future consumer will find it.

---

## 5. Doctrines: one extended, one qualified, none falsified outright

**Doctrine 51 EXTENDS (§0.3).** Corroboration across repositories can be a
single file; corroboration across AUTHORS can be a single volume. Whole-file
hashing — the form doctrine 51 states — finds zero of the two live instances
in this corpus, because neither pair is byte-identical. The unit has to be the
ITEM, and the cause is a joint or anonymous source volume whose attribution the
extraction had to invent.

**The brief's check 4 is QUALIFIED (§D).** "Is the declared language the
language the file reads as" is not answerable by a readability rate inside one
script: English reads at 95.8% under Welsh. The check is kept, relabelled a
SCRIPT test, and shipped with its own falsifying baseline printed beside it.
The language test is check F, which is doctrine 52 applied to a mislabelled
text rather than a corrupted one.

**Doctrine 79 held against its own instrument.** The first version of check B
compared an extract's md5 to its source's and reported 8 defects. The rule that
found that error is the rule the check was built to enforce.

---

## 6. Reproduce

```
python3 quality/audit_corpus.py                       # every check, corpus/
python3 quality/audit_corpus.py --check E             # the two duplications
python3 quality/audit_corpus.py --check C             # the 217 unhashed files
python3 quality/audit_corpus.py --calibrate           # the three known cases
python3 quality/audit_corpus.py --baseline            # the number that makes D weak
python3 quality/audit_corpus.py --only 'msa*' --check G
python3 quality/test_corpus_audit.py                  # 30 pins
```

Exit status is meaningful: non-zero on any FAIL, and non-zero when
`--calibrate` fails to rediscover a known case.
