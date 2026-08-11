# RESULTS — Old Norse, K-4, and which of the three blockers it actually is

Cell AJ, 2026-08-11. Every figure below names the command that produced it.
Working files are under `scratchpad/cellAJ/` (doctrine 77).

`MISSING.md` K-4 said:

> **Constraint:** the only complete Háttatal is inside a 1974 editor's
> copyright; the 1848 edition that clears the gate has OCR that destroyed the
> consonants a hending detector reads.

**Both halves reproduce exactly.** Neither is the whole answer, and the entry
was one blocker where the evidence says three, stacked.

---

## 0 · The headline

1. **The `non` cell is NOT doctrine 44 (hard to build).** The phonology is
   built, complete, and validated. `quality/phonology/non.py` is 905 lines and
   implements six syllables, stuðlar/höfuðstafr, skothending, aðalhending,
   the penultimate viðrhending, oddhending/hluthending, Snorri's málfylling
   list, moraic weight, and a tri-state that refuses rather than guesses on a
   vowel-merged edition.
2. **For the CORPUS it is doctrine 92 (disjoint sets), and the arithmetic is
   in §3.** Four reachable Háttatal witnesses. Admissible ∩ complete = **∅**.
3. **For the one witness that is BOTH, it is doctrine 49 (a claim about the
   network).** Finnur Jónsson (d. 1934) is admissible on route (b) and
   complete — and every host carrying him returned `000` again today.
4. **Route 2 is DEAD and now has a price** (§2): the best deterministic
   inverse that can exist — one fitted on the answer key itself — reproduces
   **12.6 %** of Snorri's verse lines and **50.8 %** of his words.
5. **And there is a real unblock, on the axis doctrine 62 says is worth more
   than corpus volume** (§4). The 1848 edition is BILINGUAL. Its facing Latin
   translation carries Snorri's entire specification, the Latin channel was
   never damaged, and it clears the gate on the same date the Norse does. The
   SPEC is admissible even though the VERSE is not.

---

## 1 · The wipe, re-measured from the bytes

`python3 scratchpad/cellAJ/measure_ocr.py`

| quantity | measured |
|---|---:|
| pages in `latin-ocr/eddasnorrasturlu01hafnuoft` | 746 |
| Háttatal window, scans 0610–0730 | **121 pages** |
| bytes / lines / characters in the window | 156,872 / 5,019 / 147,006 |
| occurrences of `þ ð æ ǫ ø œ á é í ó ú ý` in the window | **0** |
| the same, over the whole 746-page book | **0** |
| Greek-block characters in the window | **3,474** |
| distinct Greek codepoints | 129 |

`python3 quality/audit_corpus.py --calibrate` agrees on both pinned figures
(`REDISCOVERED`, `3474`, recorded `3474`), and `quality/test_corpus_audit.py`
passes. The record is not stale.

### 1.1 · WHY — and it is written in the artifact

Nobody had opened the `.hocr` half of the clone. It carries the recognition
pass. `python3 scratchpad/cellAJ/measure_hocr.py`:

```
   tesseract 3.04.00        70 pages   (sampled every 10th of 746)
   lang=lat     21926 words  (94.05%)
   lang=grc      1387 words  (5.95%)
   total recognised words in the 121-page window: 23313
```

**The book was OCR'd with a Latin-plus-Greek model and no Norse model at all.**
That is the whole explanation and it makes every observation fall out:

- the channel count is zero because `þ ð æ ǫ ø œ` and the acutes are **not in
  either charset** — the classifier could not have emitted them;
- the 3,474 Greek-block characters are the `grc` model firing on Old Norse;
- and the scan is FINE. Word confidence is **75.6 mean on the Old Norse
  verso against 81.3 on the Latin recto** — a 5.7-point gap, not a collapse.
  High confidence and total destruction coexist, because a classifier asked
  for the best Latin glyph for `ð` will confidently return one.

This is doctrine 45 committed by an OCR engine: **the language is a declared
coordinate, and this one was silently declared wrong.** It also relocates the
damage — it is a property of the RECOGNITION PASS, not of the page images.

---

## 2 · Route 2 priced: is the wipe invertible?

The substitution looked systematic, so it was worth asking whether a mapping
exists. **It does not, and the reason is arithmetic rather than effort.**

**Method.** `scratchpad/cellAJ/align_ocr.py` aligns the OCR window against an
INDEPENDENT WITNESS — `cltk/non_texts` `Snorra-Edda/haattatal.txtl`, Guðni
Jónsson's normalisation, which `data/sources.tsv` rows 62 and 78 REFUSE for
staging. It is used here as a **ruler and never as a repair**: nothing derived
from it is written to `corpus/`. It is independent in the only sense this
question needs — a different editor, a different century, a different
collation, no shared bytes with the 1848 scan. Where the two editions genuinely
disagree the alignment simply fails, which costs recall and cannot manufacture
a collision.

707 of 905 witness verse lines aligned at ratio ≥ 0.62 (**78.1 %**).

### 2.1 · The fan-in

```
n      image identity? pre-image
448    'b'   YES       'ð'×133, 'b'×122, 'ö'×80, 'þ'×56, 'ó'×27, 'Þ'×10
394    'h'   YES       'h'×342, 'H'×28, 'b'×16, 'þ'×4, 'ð'×2
328    'd'   YES       'd'×319, 'ð'×6, 'D'×2, 'ó'×1
945    'i'   YES       'i'×855, 'í'×79, 'y'×4, 'f'×3
1283   'a'   YES       'a'×1248, 'á'×20, 'ö'×3, 'ú'×3
100    'p'   YES       'p'×84, 'þ'×7, 'f'×6, 'Þ'×2
 91    'ae'  no        'æ'×85, 'é'×6
```

**60 OCR images have a channel character somewhere in their pre-image; 16 of
them also stand for themselves.** That second number is the one that kills the
route. `b` is not a code for `ð` — `b` is a code for `ð`, `b`, `ö`, `þ`, `ó`
and `Þ` at once, and 122 of its 448 appearances are a genuine `b`. There is
nothing to rewrite: the wipe is many-to-one **into the ambient alphabet**, so
its image contains no free symbol.

### 2.2 · The ceiling

`python3 scratchpad/cellAJ/price_repair.py` builds the **Bayes-optimal**
single-valued inverse — every image emits its modal source, fitted on the
answer key. No hand-written table can beat it.

| | |
|---|---:|
| channel-bearing blocks | 1,103 |
| recovered by the best rule | 623 (**56.5 %**) |
| non-channel blocks destroyed as collateral | 745 of 14,585 (**5.11 %**) |
| þ recovered | **18.9 %** |
| í recovered | **27.7 %** |
| ö recovered | **37.0 %** |
| **verse lines reproduced character-for-character** | **89 / 707 = 12.6 %** |
| words reproduced exactly | 1,372 / 2,701 = **50.8 %** |
| line-final words reproduced exactly | 450 / 707 = **63.6 %** |

Rewriting every `b` to its modal source **corrupts 316 characters to fix 133**.

A hending is a relation between two words and needs both intact. At a 63.6 %
line-final word rate the pair ceiling is ≈ 0.32 — and all of this is measured
with the answer key in hand, on an alignment the witness itself supplied. A
real repair has no witness to align to and cannot reach any of it.

**And it could not be shipped even if it worked**, because a table fitted on
Guðni Jónsson makes the repaired corpus a derivative of the edition the gate
refuses, and then makes the resource that produced the text non-independent of
the text being scored (doctrine 13). Both objections are fatal on their own.

**What IS alive is the other repair: re-OCR with a Norse model.** §1.1 shows
the damage is in the recognition pass, not the images. That is a live route
blocked on one thing only — the page images are on `archive.org`, re-probed
today at `000`. Doctrine 49: dated, falsifiable, and about the network.

---

## 3 · Route 3: the disjointness, as arithmetic

Two predicates. **P1 ADMISSIBLE** = clears the provenance gate on route (a)
express PD affirmation, (b) editor death + 70, or (c) publication ≤ 1931 / the
95-year default. **P2 COMPLETE-AND-READABLE** = the 102 vísur present in an
orthography whose channel survives.

| witness | P1 | P2 | reachable | evidence |
|---|:--:|:--:|:--:|---|
| `cltk/non_texts` + `cltk/old_norse_texts_heimskringla` (Guðni Jónsson, d. 1974; edns 1935–54) | ✗ | ✓ | ✓ | rows 62, 78. 102/102 vísur, 51,755 bytes, ð 1224 / þ 426 / æ 340. Term to **2044** |
| `vsnrweb-publications.org.uk` (Faulkes, VSNR) | ✗ | ✓ | ✗ | row 77. Express **reservation**, living editor |
| `latin-ocr/eddasnorrasturlu01hafnuoft` (Arnamagnæan **1848**) | **✓** | ✗ | ✓ | row 76 + §1. 1848 on its own title page; **0** channel characters |
| Finnur Jónsson (d. **1934**; 1912–15, 1931) | **✓** | ✓ | **✗** | row 79. Every host `000`, re-probed 2026-08-11 |

**|P1 ∩ P2 ∩ reachable| = 0.** The two properties we need never co-occur in a
file we can open. That is doctrine 92's founding shape, and note that it is
*not* one blocker: strike out the egress row and the set is non-empty, so the
disjointness is **contingent on the channel map**, not on the world.

Doctrine 51 still binds on the left column: the two `cltk` entries are ONE
file, md5 `c221b3761633838018e24ccf4e43e7fd`, confirmed identical again by
`--calibrate` today. Four URLs, three editions, one refusal each.

### 3.1 · The corpus half of K-4 is smaller than the entry implies

K-4's title says "no licensed corpus", but the constraint sentence is only
about Háttatal. Doctrine 32 says a corpus is defined by the property under
test, and the property is the hending, not the text:

- `sveinbjornt/sagadb.org` (row 61) carries an **express PD affirmation** —
  `All saga source texts are in the public domain.` — over 8 `*.on.xml`,
  160 poetry blocks / 1,228 verse lines, of which **585 are dróttkvætt** and
  already extracted (`scratchpad/non_sagadb_drottkvaett.txt`) and already
  measured (row 89: 55.63 % skothending against a null median of 30.72 %).
  It is `contested=true`, not refused: the affirmation is the compiler's
  claim about the medieval WORK and cannot reach the unnamed 20th-century
  normalisation it was copied from. **That is a HUMAN CALL that has not been
  made**, and it is the cheapest thing standing between this project and a
  staged `corpus/song/non_*.txt`.
- What sagadb cannot supply is Háttatal, and therefore Snorri's prose. That
  is what makes Háttatal irreplaceable and it is a claim about the SPEC, not
  about volume.

---

## 4 · The unblock: the spec is admissible even though the verse is not

**The 1848 Arnamagnæan Háttatal is bilingual.** Old Norse on the verso, a
facing Latin translation headed `CLAVIS METRICA` on the recto. Latin uses none
of `þ ð æ ǫ ø œ á é í ó ú ý`, so the substitution that wiped the Norse had
nothing to bite on.

`python3 scratchpad/cellAJ/measure_latin.py`, over the same 121 pages:

| | Old Norse verso | Latin recto |
|---|---:|---:|
| pages | 44 | **62** |
| Greek-block characters per 1,000 chars | 40.05 | **11.39** |
| clean all-Latin tokens | 67.2 % | **84.7 %** |

Language classified from the page's own running text, not from scan parity —
and parity then falls out as a result: 57 of 60 odd scans are Latin, 44 of 61
even scans are Norse.

**All nine of the sentences doctrine 62 rests on are legible**, located by
their Latin and read out of the bytes:

| rule `non.py` implements | the 1848 Latin, verbatim from the OCR | scan |
|---|---|---:|
| six syllables to the line | `Quemlibet versum faciunt sex sj‘llabae.` | 0613 |
| twelve stafir, three per fjórðungr | `duodecim literae in una stropha, quarum ternae in singulos strophae quadrantes dispositae sunt` | 0613 |
| höfuðstafr first in the even line | `Initio versus secundi litera posita est, quam LITERAM parx—c1PEM vocamus` | 0613 |
| two stuðlar in the odd line | `quam literam in primo versu bis initium syllabae facere reperies3 has literas vocamus SERVAS` | 0613 |
| vowel höfuðstafr → vowel stuðlar, and *fegra* if they differ | `Sin vero litera princeps est vocali57 vocales et servae debent esse, atque elegantius est, diversas esse vocales.` | 0613 |
| **the málfylling list** | `plures voces in eodem quadrante a vocali incipere in pronominibus aut in particulis hypermetris7 verbi caussa: ele, aut' en7 er7 at, i, ο, Of> af, um3 sed boc ad licentiam poeticam pertinet7 non ad positionem regularem.` | 0613 |
| **skothending — and the onsets MUST DIFFER** | `una syllaba in utroque Ιοοο7 in quibus syllabis diversae sunt vocales, diversaeque literae initiales, sed in utraque voce eaedem consonantes vocalem excipiunt` | 0615 |
| **aðalhending — the onsets DISTINGUISH the words** | `hic eadem vocalis est7' eaedemque omnes consequentes litcrae in utraque voce, litcrae vero initiales distinguunt voces` | 0615 |
| viðrhending on the PENULTIMATE; frumhending initial or medial | `posterior cujusque versus syllaba harmonica, quae secundana dicitur7 syllabam vorsus extremae proxi—mam (penultimam) occupet. Quae vero dicitur syllaba harmonica priniana, ea interdum in initio versus locum habet, tumque eam initialem vocamus, interdum in medio7 quum dicimus mediam.` | 0615 |

Two of those are the exact pair doctrine 62 was written for.
`diversaeque literae initiales` and `literae vero initiales distinguunt voces`
are `upphafstafir greina orðin` — doctrine 3 in the 1220s — and
`particulis hypermetris` plus the nine-item list is doctrine 46 attested
rather than assumed. `non.py` had both, taken from the REFUSED edition. They
are now **independently attested in a source that clears the gate**.

Doctrine 87 is the reason this counts: the point of corroboration was never
agreement, it was independence. These two witnesses are 87 years and one
language apart and they do not share a byte.

### 4.1 · Who wrote the Latin, from the book's own praefatio

Scan 0013, verbatim including OCR damage:

> `a nobis confisius, ad virum doctissimum et in liis literis versatissimum`
> `Sveinbjo'rnumEyilsson, Dr. Tlieol„ nune scliolce Reylcjavieanoe in Islandia`
> `rectorem, transmissus est, qui operam latinoe interpretationis elaborandoe`
> `eoe optione colleyii nostri susceperat.`

= Sveinbjörn Egilsson, then rector of the Reykjavík school, undertook the
Latin interpretation. **Read from the bytes, not from a search result.**
Admissibility does not rest on his dates in any case: route (c) carries the
whole volume on its printed `1848`, exactly as row 76 records for the edition.

### 4.2 · What this does and does not buy

It does **not** produce a line of dróttkvætt. `MISSING.md` K-4 stays `BLOCKED`
for the corpus and the arithmetic in §3 is why.

It **does** move `non.py`'s rules off a refused edition and onto an admissible
one, which is the difference between a checker whose spec came from a text it
may not use and a checker whose spec is independently sourced. Doctrine 62
says the primary source is a spec; §4 is that sentence with a licence.

---

## 5 · Searches run this session, all recorded as rows

Doctrine 39. Every probe below is a row in `data/sources.tsv`; the rows carry
the query and the yield.

- **HuggingFace, a channel no earlier Norse search used** (`CHANNELS.md`
  lists it; row 79 did not probe it). `hub_repo_search` for `old norse`,
  `Old Norse skaldic Edda`, `norse`, `saga icelandic corpus text`,
  `Icelandic wikisource`: **no Old Norse text anywhere on the Hub.** The ten
  `norse` hits are synthetic English "Norse paganism" fine-tuning sets and
  protein-activity tables.
- **`wikimedia/wikisource` `20231201.is` IS reachable through the HF MCP
  tools** and carries dróttkvætt in the **unmerged classical orthography** —
  row index 2, `Vísur`, prints `gengr ulfr ok ǫrn of ynglings bǫrn`,
  `heitu, hrœrikytjur`, `fox es illt í øxi`, `flǫsur margar`. **`ǫ`, `ø` and
  `œ` all present**, which no text this project has ever held contains.
  `is.wikisource.org/wiki/Snorra_Edda/Háttatal` exists. **Not staged**, and
  the reason is in the row: the dump names no edition for the Norse verse
  while the SAME file carries `Andvökur, úrval Sigurðar Nordals, 2. útgáfa
  1980` — an in-copyright edition of a 20th-century poet, sitting four rows
  from 13th-century verse. Doctrine 40 at its sharpest: the CC-BY-SA-3.0 is a
  licence on the compilation and the compilation demonstrably mixes the two.
- **GitHub, four new queries.** `"Clavis metrica" Snorri` → 3 hits, all
  encyclopaedia text. `"skjaldedigtning" Finnur` → 37 hits, none a text.
  `"Nu frak nordr" OR "Njoti aldrs" OR "Sottak fremd"` → **0**.
  `"syllabas harmonicas" OR "harmonicae plenae" OR "harmonicas semiplenas"`
  → **exactly 1 file on all of GitHub**, and it is
  `latin-ocr/eddasnorrasturlu01hafnuoft_0615.txt` itself. There is no second
  OCR of this Latin anywhere.
- **Egress re-probed 2026-08-11** (doctrine 49). `archive.org`,
  `is.wikisource.org`, `huggingface.co`, `hf.co`,
  `datasets-server.huggingface.co`, `septentrionalia.net`, `skaldic.org`,
  `baekur.is` → all `000`. `raw.githubusercontent.com` → `200`.
  Note the split: `huggingface.co` is unreachable by `curl` and reachable by
  the HF MCP tools. A blocked HOST is not a blocked CHANNEL.
- **One correction to row 79.** It says `org:latin-ocr contains exactly 2
  repos`. The org contains many books (`christianaerelig00calv`,
  `doctrinanumorum04hohlgoog`, `germaniaandagri00boetgoog`, …). What is true
  is the narrower claim: `org:latin-ocr edda OR snorra OR island OR norr`
  returns **2**, both volumes of the 1848 Arnamagnæan Edda. Appended as a
  correcting row rather than edited in place, because row 79 is a sibling's.

---

## 6 · What a later cell should do, in cost order

1. **Make the human call on `sveinbjornt/sagadb.org`** (row 61). It is the
   only Old Norse source found with an express PD affirmation AND verse
   markup, 585 dróttkvætt lines are already extracted and measured, and the
   only thing between them and `corpus/song/` is a decision nobody has taken.
   Separate the metres first: Höfuðlausn is runhent and
   Sonatorrek/Arinbjarnarkviða are kviðuháttr, and neither carries hendings.
2. **Get `archive.org` on the egress allowlist and re-OCR scans 0610–0730**
   with an Icelandic/Norse model. §1.1 shows the images are fine and the
   recognition pass was wrong; this is the only route that yields an
   admissible AND complete Háttatal without a rights argument.
3. **Name the edition behind `is.wikisource.org`'s Old Norse verse.** The
   `ǫ ø œ` orthography is a pre-1931 classical normalisation's fingerprint.
   If a cell can put a name and a death year to it, a text with a channel
   nothing in this repo has becomes admissible.
4. **Do not re-probe** `vsnrweb-publications.org.uk` (row 77, express
   reservation), the Finnur Jónsson hosts (row 79, re-probed today), or the
   `cltk` pair (rows 62/78, one file, term to 2044).
