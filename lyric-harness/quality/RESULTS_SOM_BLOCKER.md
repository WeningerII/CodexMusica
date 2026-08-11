# RESULTS — what actually blocks Somali, measured

`MISSING.md` K-5. Cell AK, 2026-08-11.

**Command:** `python3 quality/som_channel_audit.py`

K-5 asserted a universal — *Somali can never have a corpus*. A universal is
falsified by one instance, so it was tested rather than restated. Three things
came back, and only one of them is the answer the entry expected.

| | |
|---|---|
| **The universal is FALSE.** | A Latin-script transcription of Somali **verse** was published in 1905, 26 years inside the cutoff and 67 years before the 1972 orthography. "Every written gabay is a modern transcription" does not hold. |
| **The block SURVIVES, reclassified.** | Doctrine 44 **cannot-obtain**, not can-never. Every host carrying that 1905 text is egress-blocked from this container. |
| **The doctrine 92 route FAILS.** | The hypothesis that Somali is a *disjoint* case — admissible text existing but not recording what the form constrains — was tested and **refuted**. The 1972 orthography records both constrained channels. |

The third is the one worth reading first, because it decides whether the rest
matters, and it came back the opposite way from the prior.

---

## 1. The question that decides the others: does the script record the constraint?

The gabay constrains exactly two channels.

| channel | what it reads | `som.py` supplies it via |
|---|---|---|
| **higaad** — one consonant fixed for the whole poem | word-initial consonant identity | `_head`, `alliterates`, `higaad` |
| **quantitative metre** — the grid is the mora | syllable weight | `Syllable.moras` |

**Prominence is in neither.** Somali has pitch accent rather than stress and
`som.prominences()` raises (doctrine 35). K-5 read that refusal as part of the
blockage. It is not. A refusal costs something only when the relation needs the
channel refused (doctrine 60), and **the gabay never reads a prominence
channel** — so the doctrine 35 protection is bought at zero cost to the
constraint. Somali is the one language in this repo whose pitch accent is
irrelevant to its own form, and the module was already right for a reason
nobody had written down.

Somali metre is quantitative and keyed on **vowel length** — a syllable is long
iff its vowel is long (Andrzejewski 1982 on gabay; Banti & Giannattasio 1996;
Johnson 1996; Orwin 2001). **Those are SECONDARY**, reached as search-result
summaries on 2026-08-11; no paper was fetched, because
`journal.oraltradition.org`, `researchgate.net` and `academia.edu` are all
egress-blocked. Recorded as secondary in
`NOTE:somali-orthography-records-what-the-gabay-constrains`.

The 1972 orthography writes vowel length by **doubling**. So it records the
constraint, and **K-5 cannot be closed without a date argument.**

### 1.1 Measured, on the module rather than on a poem

No Somali text is read, quoted or invented anywhere in this runner. Every
string is a **shape** assembled from `som.py`'s own declared inventory — 21
consonants × 5 vowels × {short, long} × {no coda, 21 codas} = **4,620** — so
every claim is about the module and the notation and none is about a poem.
That is forced: this repo holds no admissible Somali text, which is the finding.

```
shapes built from the declared inventory : 4620
unreadable                               : 0
vowel length 1 -> moras [1]
vowel length 2 -> moras [2]
no coda        -> moras [1, 2]
has coda       -> moras [1, 2]
```

**Weight is a total function of vowel length and is blind to the coda.** A
closed short syllable is LIGHT. That is the Somali rule, and it is not the
general one — Greek, Latin, Sanskrit and Arabic all close a heavy syllable with
a consonant. The identical two lines of code would have produced plausible mora
counts in any of them with nothing in the numbers to catch it, which is
doctrine 35 one axis further out. It lived here only as the expression
`2 if len(nuc) == 2 else 1` and is now declared as `Somali.weight_rule`.

---

## 2. What a non-1972 notation does — per channel, not per file

Doctrine 52: check the specific channel, not the general legibility. Doctrine
90: the statistic is chosen with the null, and a legibility count is the wrong
statistic, because a shape can stay readable and read **wrong**. So each
column scores **recovery of the 1972 value** on the sub-population that channel
depends on.

| notation | readable | higaad kept | weight kept |
|---|---:|---:|---:|
| 1972 Latin (what `som.py` reads) | 100.0% | 880/880 | 2310/2310 |
| macron for vowel length | 50.0% | 440/880 | **0/2310** |
| diacritic for the pharyngeals | 66.2% | **0/880** | 1530/2310 |
| abjad: short vowels unwritten | 50.0% | 440/880 | 2310/2310 |

**The rows fail in different channels, and that is the point (doctrine 53).**
A macron witness keeps every higaad class and destroys the weight channel
outright. A witness writing the pharyngeals with diacritics keeps most of the
weight channel and destroys **four** higaad classes — `c`, `x`, `q`, `kh`,
which are four distinct alliterating consonants in a language whose entire form
is one fixed alliterating consonant.

**Read the abjad row carefully: `2310/2310` is not a pass.** An abjad preserves
the weight of every syllable it *writes*, because the long vowels are the ones
it writes; the short syllables are simply gone, which is the other half of the
same 50% legibility. Per surviving syllable the channel is perfect; per **line**
the mora total is destroyed — and the quantitative metre is a constraint on the
line. A channel score is a coordinate of the unit it is scored on (doctrine 58),
and the unit here is the one the form constrains, not the one the table happens
to iterate.

This table is the test to run against a pre-1931 witness the day one is
reachable. It will very likely be admissible for higaad and refused for the
mora grid, out of the same file.

---

## 3. A defect found on the way: `higaad()` does not refuse, it shrinks

`higaad()` silently drops a word it cannot read — `_head` returns `None`, the
word never joins the line's head set — so a text in a notation outside the 1972
inventory yields a plausible **low share** instead of a refusal.

Six shape lines carrying a perfect higaad on `g` by construction, arranged so
the one higaad-bearing word per line is also the only one with a long vowel:

```
1972 Latin                       higaad='g' share=100.0%   words read 24/24
macron for vowel length          higaad='x' share= 50.0%   words read 18/30
diacritic for the pharyngeals    higaad='g' share=100.0%   words read 24/24
```

**That is a wrong answer, not a lost one.** The macron notation deletes exactly
the words carrying the constraint, so `higaad` reports a *different* fixed
consonant at half the share, with total confidence, computed over whatever
stayed inside the 1972 inventory. Nothing raises, nothing returns `None`, and
the output keeps the exact shape of a finding about the **poem**.

Doctrine 79 inside a phonology: the orthography's miss was being billed to the
poet — the same triage error the sonnet battery made charging 50 CMUdict
absences to the comparator. It is also the *kind* of the third hyphen bug,
which produced a wrong answer where the first two produced refusals.

**Fixed additively.** `som.Somali.readability(lines)` returns
`tokens/read/unread/read_share` plus the declared notation, so a low share with
`read == tokens` is a fact about the poem and a low share with `read < tokens`
is a fact about the notation (doctrine 28). `higaad()`'s three return values are
unchanged, so `quality/test_phonology.py` test 8 is untouched.

This matters for K-5 specifically: the moment a pre-1931 witness becomes
reachable it will be in a pre-1972 notation — precisely the input that used to
produce a confident wrong number.

---

## 4. The date arithmetic, recomputed

K-5 said *13 fail the DATE gate ... the remaining 5 clear the date*. **At the
declared 95-year term it is 14 and 4.**

`data/lyricists.tsv` computes `pd_expired` as `died + 70` — verified
mechanically: across all 424 rows carrying both a numeric `died` and
`pd_expired` the difference is **exactly 70 and no other value occurs** — while
`quality/provenance.py` declares `term_years = 95`, which is the 1931 cutoff
this project states everywhere else. Doctrine 58: the count was a coordinate of
a term nobody wrote down.

The row that moves is **Cilmi Boodheri / Cilmi Bowndheri, 1900–1940**: 2010 at
life+70, **2035** at the declared life+95, which has not come.

**And this is the only place in the ledger where the choice is load-bearing.**
Across all 551 rows, **423 clear at life+70 and 422 at life+95** — exactly one
row flips, and it is this one. The undeclared term is harmless everywhere in the
project except the single entry whose count turns on it.

### 4.1 K-5's stated *reason* for the 13 was wrong, and pointed the opposite way

The entry read: lives *"recorded only as '19th–20th century', whose upper bound
is 1900+70 past the term"*. **1900 + 70 = 1970, which expired 56 years ago** —
so the sentence as written *admits* the thirteen poets it is refusing.

The ledger rows are right and apply doctrine 81 correctly: the END of a
"19th–20th century" window is **2000**, the rows say `death bounded at 2000
(century), not verified; life+70 = 2070 has not expired`, and 2070 is what
refuses them. The defect is in the **prose**, which had copied the bound of the
*other* Somali group — the three "19th century" poets, correctly bounded at 1900
— onto the thirteen. Two bounds, one sentence, the wrong one quoted.

That is the shape the register audit found in doctrine 88 and doctrine 70: the
enumeration was right and nobody added it up.

**Both corrections make Somali more blocked, not less**, which is the direction
a ledger that is evidence rather than an estimate should fail in.

### 4.2 `BLOCKED_ORTHOGRAPHY` names the wrong thing

All 18 Somali rows carried: *"Somali BLOCKED regardless of author date: the
Latin orthography dates from 1972 and the cutoff is 1931"*. Section 1 refutes
the orthographic half. The note on the 4 surviving `BLOCKED_ORTHOGRAPHY` rows is
corrected in place: the label names the **date of the transcription**, not a
defect in the script. What blocks those four is that any 1972-script witness to
an oral composition is a post-1972 editorial act with its own rights, which
`provenance.py` does not model (doctrine 38/80) — and that no pre-1931 witness
is reachable. The status string itself is left alone; renaming a status across a
shared file is not this cell's to do.

---

## 5. The instance that breaks the universal, and why it is still blocked

**J. W. C. Kirk (b. 1878), *A grammar of the Somali language, with examples in
prose and verse, and an account of the Yibir and Midgan dialects*, Cambridge
University Press, 1905.**

- **Publication 1905 ≤ 1931.** Route 3 (verified publication year, anonymous /
  traditional material) is the applicable route.
- **The title page has not been seen.** Year and publisher come from
  search-result metadata — Cambridge Core, Open Library `OL23378049M`, Internet
  Archive `grammarofsomalil00kirkuoft` and `agrammarsomalil00unkngoog` — **not
  from the object**. Recorded that way in the row.
- **Kirk's death year was not found on any reachable channel**, so route 2 is
  unavailable and only route 3 is in play.

**It is unreachable.** Every host is egress-blocked, re-probed 2026-08-11:
`archive.org` (download, metadata, `ia601409`), `web.archive.org`,
`openlibrary.org`, `books.google.com`, `cambridge.org`, `hathitrust.org` — all
curl `000`. The proxy names the cause verbatim: `kind: "connect_rejected",
detail: "gateway answered 403 to CONNECT (policy denial or upstream failure)",
host: "archive.org:443"`. `WebFetch` on `archive.org` and `cambridge.org`
returns `EGRESS_BLOCKED`, **reconfirming on a second date** `CHANNELS.md`'s
"the block is per-host, not per-tool".

**Two things remain unverified and they are the whole risk.** (1) Whether the
verse specimens include *gabay* rather than only *geeraar*/*hees* — a snippet
reports Kirk classifying "Gerar, Gabei and Hes" at p. 170 ff., which is
secondary. (2) **Whether his transcription records vowel length and the four
pharyngeal/laryngeal consonants.** Section 2 is the test, and it says the two
likely failure modes are different and channel-specific.

**Unblock route, in the same breath as the refusal (doctrine 85):** one fetch of
`archive.org/download/grammarofsomalil00kirkuoft/grammarofsomalil00kirkuoft_djvu.txt`
from any host with egress, then section 2's table, then the gate.

---

## 6. Every probe run, and its outcome

All 2026-08-11. Rows in `data/sources.tsv`.

| probe | outcome |
|---|---|
| GITenberg org name-search `Somali` / `Somaliland` | 4 repos, union; **all English colonial travel writing** |
| fetched all four (2.27 MB, md5s in the row) | **zero** occurrences of gabay/gabei/gabai |
| Swayne 1895 read for quoted verse | describes the *gerara* minstrel, camel songs "of very ancient origin", verse complaints — **every one rendered as English prose paraphrase.** Doctrine 93: not one line of Somali printed |
| `archive.org` × 3 paths, `web.archive.org` | `000` — gateway 403 on CONNECT |
| `openlibrary.org`, `books.google.com`, `cambridge.org`, `hathitrust.org` | `000` |
| `WebFetch` on `archive.org`, `cambridge.org` | `EGRESS_BLOCKED` — reconfirms per-host, not per-tool |
| `journal.oraltradition.org`, `researchgate.net`, `jstor.org`, `glottolog.org`, `core.ac.uk`, `scholar.archive.org` | `000` |
| HF `hub_repo_search` "Somali", datasets, limit 50 | 50 returned, **zero literary** — ASR/TTS, Alpaca translations, ~30 MT sentence-pair sets |
| HF `hub_repo_search` "Somali poetry gabay maanso" | *No repositories found* |
| HF `wikimedia/wikisource` — the channel that reaches Wikisource past its host block | **72 language editions and no `so`.** `ls` and `find '*.so*'` both empty |
| GitHub code search `gabei` | 45 hits, every one a wordlist or NLP vocab file |
| GitHub repo search somali poetry/maanso/gabay/suugaan | no verse corpus; 3 modern NLP corpora |
| LICENSE/LICENSE.md/LICENSE.txt/COPYING on `goobolabs/SomNLP-Corpus`, `goobolabs/somali-language-standard`, `apjama/Somali_NLP_data` | **12 probes, 12 × 404. Refused** — silence is not permission, and modern web text besides |

The 2026-08-10 row `SEARCH:somali-gabay-corpus` was re-probed under doctrine 49
and **stands**. Its argument is confirmed; its *framing* is superseded — the
bind is real for the 1972 **script** and is not a universal over Somali verse in
Latin letters.

---

## 7. What K-5 is, in the taxonomy

**Doctrine 44 `cannot obtain`.** Not `hard to build` — `som.py` is built,
tested, and measured here to record both constrained channels. Not doctrine 92
`disjoint` — that was the hypothesis, it was tested, and it failed: the
admissible property and the complete property are **not** known to be disjoint
in Kirk 1905, because nobody has been able to look.

The honest statement the evidence supports is not *never*. It is:

> No admissible Somali verse text is **reachable from this container**. One
> admissible-by-date candidate is known to exist and to be digitised, and the
> only thing between this project and testing it is an egress block — which
> doctrine 49 says is a claim about the network at a moment, not about the
> world.
