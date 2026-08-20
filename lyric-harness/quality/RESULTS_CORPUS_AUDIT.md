# RESULTS — the corpus audit (adversary 5)

`quality/audit_corpus.py`, run 2026-08-11 over `corpus/` at 269 files.
Pins: `quality/test_corpus_audit.py`, 33 assertions, all holding.

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

## 0.4 · The author dates the mass load derived were reading other people's deaths

**125 committed files carried a `(birth-death)` annotation that no
evidence supports, and the mechanism is the interesting part.** The
Modern Scottish Minstrel mass load derived each poet's dates with a
regex looking for a year near `died`/`death` in that poet's memoir. The
Minstrel's memoirs are biographical prose about men whose fathers,
patrons and idols also die in them, so the regex was reading **the wrong
person's death year** and no rule in it could tell.

Two of the proofs are self-refuting inside the source's own sentence:

| author | recorded | the year actually belongs to |
|---|---|---|
| Joanna Baillie | 1762-**1778** | her FATHER — *"After his death, which took place in 1778, his daughters both continued..."* |
| Allan Cunningham | 1784-**1796** | ROBERT BURNS — *"at the period of Burns' death, in 1796, he was only twelve years old"* |

**IT WAS FOUND BY A RAIL BUILT FOR SOMETHING ELSE.** The Phase-1 lander
compares the death year an anthology PRINTS against the one the corpus
records before routing an item to an existing author file — a guard
against two men sharing a name (Oxford's Alexander Hume, 1560-1609,
against the corpus's two Minstrel-era Alexander Humes born 1809 and
1811, which it also caught). Six authors came back contradicted —
Baillie, Cunningham, Campbell, Lockhart, Wilson, Stoddart — and in all
six the printed authority is right and the corpus was wrong.

**THE ERROR RATE CANNOT BE BOUNDED FROM INSIDE THE SOURCE, and that is
why the whole annotation goes rather than the six.** An internal
heuristic — implausible lifespan, plus a possessive naming somebody
other than the subject — flags **9 of 125**, and it MISSED four of the
six the external evidence caught, because Campbell dead at 51 instead of
67 looks perfectly ordinary. The repo's own instrument for this,
`data/authority.tsv` (13,997 verified death years behind a provenance
gate), covers **0 of the 112** — it is populated for the Syriac, Arabic
and Hebrew cells, not for nineteenth-century Scottish minor poets. So
there is no bound and no cheap re-derivation, and a derived field with
an unmeasured error rate presented as fact is the defect, not the
annotation's absence.

**WITHDRAWN, NOT DELETED (doctrine 17).** Every one of the 125 files
keeps its own superseded value struck on a `# dates: WITHDRAWN` line
naming the reason, and the **seven** files with contradicting evidence
carry that evidence, so a later sitting can re-derive from authorities
rather than rediscover the contradiction. **Seven, not the six above,
and the difference is the second route**: six were caught by the
death-year rail comparing against an anthology's PRINTED dates, and the
seventh — James Montgomery — was caught by the corpus contradicting
ITSELF, since `eng_hymn_montgomery.txt` records 1771-1854 for the same
man the Minstrel file dated 1771-1790. Both are external to the derived
value and neither is the internal heuristic, which is the point; they
are counted apart because they are different instruments (doctrine 79).

**One of the seven is now CLOSED rather than withdrawn** — Montgomery,
by §0.6 below, whose dates are restored from the Minstrel's own printed
memoir. That leaves six withdrawals carrying contradicting evidence and
112 carrying none, and it is the worked example of what this section
said a later sitting should do: re-derive from an authority rather than
rediscover the contradiction. **The licence claim is
untouched**: these files rest on the parent row's ADMIT reasoning, not
on per-author dates, and every songwriter in an 1855 anthology is long
out of any life+70 term — this was an accuracy defect, never an
admissibility one.

---

## 0.5 · Phase 1 landed two anthologies, held a third, and left 427 regions blank on purpose

**+433 files and +1,266 items, and the two decisions worth recording are
both REFUSALS.** The Oxford Book of English Verse 1250-1900
(`GITenberg/The-Oxford-Book-of-English-Verse-1250-1900_66619`) and Poems
of American History (`PG47476`, Stevenson) landed as 433 new per-author
files carrying 904 items, plus 362 items topped up into 101 files the
corpus already held. English total: **616 → 1,049 files, 6,352 → 7,618
songs.** The corpus audit is at **1,175 files / 1 FAIL / 231 WARN / 902
NOTE**, `--verify-shape` PASS.

### The Home Book of Verse is HELD, and the etext dates itself

Its four volumes were extracted and are **not landed**. The corpus's
licence line for them asserts the 1912 first edition; the etext is not
that printing. Two independent tells, both from inside the file:

- **It prints death years the 1912 edition could not have known.** Over
  the extraction's 1,938 items, **271 items across 112 distinct authors
  carry a death year after 1912**, the latest being **G. K. Chesterton,
  1936**. A further 247 items across 147 authors are open-ended (a birth
  year and no death), which is what an edition prints for an author
  living at the time it was set. *Declared counting rule, because the
  date field has fifteen distinct spellings in this extraction:* split
  on the first `-`; the first 4-digit group after it is the death year;
  no group after it and one before it is open-ended; `fl. YYYY` floruits
  are excluded from both.
- **The body prints "Ford Madox Ford" while the volume's own index still
  reads "Hueffer."** The name change is 1919, so the body was reset
  after the index was.

A 1930s printing's US copyright turns on renewal research this session
cannot perform, and doctrine 85's shape applies to the near miss as much
as to the express grant: the source stays in the lander's `SOURCES` so
the decision is legible, and out of `EXTRACTIONS` so nothing from it can
land by accident. This is the open question the owner inherits, not a
verdict.

### The region axis stopped being total, and that is the taxonomy working

All six Phase-1 extraction agents report independently that **neither
edition prints a nationality or tradition for any author.**
`data/song_regions.tsv`'s evidence rule is *"author's tradition per file
header; edition origin as tiebreak only"* — so filling the axis from
Oxford's UK imprint or Stevenson's US one would rebuild **the
Taylor-sisters defect at scale**, which is the single error this
taxonomy was created to fix. The ruling was blank-where-unevidenced, and
the result is:

| | files |
|---|---:|
| region declared from the closed set | 622 |
| stated blank, each with its own `# region-basis:` line | 427 |
| silently empty | **0** |

Six of the new files DO declare, because their edition prints the signal
itself: King James I of Scotland by his own author heading, and
Callanan, Ferguson, Fox, Rolleston and Hyde by Oxford's `FROM THE IRISH`
headnotes. Everything else carries a basis line saying in full why it is
blank. **The pin changed shape rather than loosening**: `every file
declares a region` became *622 declare a region and 427 declare a stated
blank — every file answers the axis, none is silently empty*, which is
the property actually worth holding. Blank has always been this
taxonomy's honest undeclared state; `report()` counts it into
`undeclared_region` and never into `by_region`, so the invariant
`by_region + undeclared == songs` holds at 6,722 + 896 = 7,618.

**The filename token carries the batch, not the claim.** The new files
are `eng_oxford_*` and `eng_pah_*` rather than `eng_british_*` /
`eng_american_*` — the Taylor pin's own sentence is that the filename is
the ACQUISITION BATCH and not an analytic claim, and a tradition-shaped
token here would state in the filename precisely the claim the header
declines to make.

### 57 self-describing-metadata repairs, all found by the audit

The first write left **58 FAILs**, and 57 were the corpus audit catching
its own bookkeeping rather than any defect in the verse:

- **55 × check C** — a topped-up file's `data/sources.tsv` row still
  recorded the md5 of its PRE-APPEND bytes. Repinned using the table's
  own superseded-md5 convention. Eight of the 55 were missed on the
  first pass because their rows used an older `md5 X (repinned ...), N
  bytes` phrasing my contiguous regex did not match — a reminder that
  the row format has a history.
- **2 × check B** — `# lines:` headers stale after the append (Coleridge
  598 → 726, Wordsworth 1,751 → 2,306). Recomputed **through the audit's
  own `CorpusFile.verse_lines`** rather than by a second line-counting
  rule, which is doctrine 1: the header and the check must not be able
  to disagree.

The 58th is the pre-existing FAIL the audit has carried since before
this load.

### A pin that named the wrong failure, caught on its second occurrence

`test_song_function` §9 pins 14 named blocks the apparatus rule empties,
keyed on `(file, source_line, mark)`. Nine went red after this load —
the six in `eng_hall_john_gay.txt` and three in
`eng_hall_thomas_durfey.txt`. **All nine blocks were still empty.** The
load wrote a multi-source header pair at the top of both files (Gay
topped up from Oxford, Durfey additionally absorbing a twin), so every
address below shifted: **Gay +2, Durfey +3.** The witnesses never moved;
their addresses did.

**The message said `not empty`, which was false of all nine.** That is
two different findings collapsed into one sentence — a block that
stopped being empty is a regression in the apparatus rule, a block that
slid down three lines is bookkeeping — and the same list had already
fired this way once before, on the 2026-08-19 taxonomy backfill's
`# region:`/`# function:` header insertion. Twice is the argument for
fixing the report rather than only the numbers.

The check now resolves a missing address against the witness's own
stable coordinates — same file, same mark, same dropped line in the
window — and reports **MOVED** with its delta or **NO LONGER EMPTY**
separately. Both branches are proven by mutation: restoring a
pre-Phase-1 address reports `MOVED … [597], [3]`, and pointing a witness
at a mark that is not an empty block reports `NO LONGER EMPTY`. The
window is now one helper both halves of §9 call, because the provenance
half's own `lines[n:n+4]` had been *tolerating* the shift silently while
the other half failed on it — one question, two readings (doctrine 1).

The list stays keyed on the line number deliberately: that is what makes
it a provenance record rather than a text search. What changed is that a
growing corpus now produces a self-explaining failure. This is the
corpus-file instance of the defect this repo already records for
`data/sources.tsv:NNN` citations — **a line number into a file that
grows is not an address, it is an offset from a moving origin.**

### 19 twin merges, and the control that says the rule is not "same surname"

Near-name scanning against the live corpus found 19 authors already
staged under a variant spelling; each merge was confirmed against the
**editions' own printed dates** before the files were joined. The
control is Oxford printing two men side by side: **Sir Aubrey de Vere
(1788-1846)** and his son **Aubrey Thomas de Vere (1814-1902)**. They
are kept in separate files, and they are the reason the merge rule reads
dates rather than names — the same rail that caught Oxford's Alexander
Hume (1560-1609) as a third man against the corpus's two Minstrel-era
Humes, and the same rail that produced §0.4 above.

---

## 0.6 · The Montgomery twin: one man, two files, three traditions, and a blank

`eng_celtic_msm_james_montgomery.txt` (6 items, region `scottish`) and
`eng_hymn_montgomery.txt` (45 items, region `english`) were the same
person. They are now one file at **1,174 corpus files / 1,048 eng
files**, item count **unmoved at 7,618** — a merge rehouses items, it
does not remove them, which is why `files` moved in every pin and
`songs` moved in none.

### Identity, from the edition's own memoir and not from the surname

The Minstrel prints a biography, and it matches the hymn editions' James
Montgomery (1771-1854) at every joint: born at Irvine, Ayrshire, 4 Nov
1771; a Moravian father who came from Ireland days before the birth;
schooling at Grace Hill, Antrim, then Fulneck; the Sheffield *Register*
and *Iris*; **two imprisonments in the Castle of York**, which is what
the merged item *VERSES TO A ROBIN RED-BREAST, WHICH VISITS THE WINDOW
OF MY PRISON EVERY DAY* is about; death at The Mount, Sheffield, 30 Apr
1854, "in the eighty-second year of his age."

### The dates come back, and the memoir convicts the regex a third time

§0.4's withdrawal struck `(1771-1790)` for this author. **1790 is in
that memoir**: *"His mother died at Barbadoes, in November 1790."* Same
mechanism as Baillie's father and Cunningham's Burns — and the same
memoir prints **both** correct years, so for the third time the source
contained the right answer in the very prose the regex was searching.
`# author: James Montgomery (1771-1854)` is restored with a
`# dates-basis:` line quoting both sentences, and two independent
authorities (the Minstrel, the hymnals) now concur.

### Region: CONTESTED, therefore BLANK

`data/song_regions.tsv` makes region single-valued and says a contested
region stays blank, recorded, never doubled. Three traditions have a
claim, and the file records all three:

| | the claim |
|---|---|
| **scottish** | born Irvine, Ayrshire; an 1855 book titled *The Songs of Scotland* includes him on that basis |
| **english** | left Scotland in his fourth year, never returned to live, and spent from his twenty-first year to his death at 82 in Sheffield, where the 45 hymn items were written |
| **irish** | the memoir's own account: a Moravian father out of Ireland, and schooling at Grace Hill, Co. Antrim, ages 4–7 |

**The orthographic route cannot break the tie, and I checked before
relying on it.** The table offers *"Scots orthography corroborates"* for
`scottish`, and Montgomery's six Minstrel items carry **zero** Scots
markers — which looked at first like evidence that the `scottish` tag
was the Taylor defect one axis over. It is not: **92 of the 245 Minstrel
files (37.6%) carry no Scots marker**, and that group includes Gaelic
poets in translation (Rob Donn, Dougal Buchanan, William Ross, Evan
MacLachlan) who are indisputably Scottish. A null there distinguishes
nothing, so it is not evidence against `scottish` and the retag it
seemed to license would have been wrong. **What settles this is that two
DELIBERATE assignments disagreed** — the taxonomy backfill's `english`,
read off a Sheffield life, against the Minstrel file's `scottish`, read
off the anthology's own claim — and blank is the taxonomy's answer to
exactly that, not a failure to look.

### The function header had to go, and the reader is why

`resolve_songs` computes `funcs = s["functions"] or header["function"]`
— **a per-song value can only FILL from the header, never clear it.** So
a file-level `# function: hymn` would have silently tagged a German
war-song, an Odd Fellows lodge song and a prison poem as hymns. The
header default is deleted; the 45 hymn items carry `--- FUNCTION: hymn`
each and the six carry nothing, which is the honest undeclared state.
The per-song override lines have existed since the taxonomy shipped and
**this is the corpus's first file to use them.**

*Recorded, not fixed:* a file whose items genuinely differ has no way to
say "this one is undeclared" except by tagging every sibling. That will
recur as authors accumulate sources, and it is a reader change rather
than a merge decision, so it is named here for the owner rather than
made mid-merge.

~~*Also worth a line:* `# region:`/`# function:` accept any text and
comma-split it, so a prose note written on those keys becomes a set of
bogus declarations. `check_file` caught exactly that during this merge
and named all seven fragments — the gate working.~~ **STRUCK AND FIXED
2026-08-20 — see §0.7, and the sentence understated it: `check_file`
catching it is not the same as the corpus being safe from it, because
`report()` never calls `check_file`.** The `-basis:` suffix is the
spelling for prose, and both `# region-basis:` and `# function-basis:`
use it.

### The merge is visible in the duplication census, which is the check working

`Montgomery~Montgomery` was one of the 8 named cross-file variant
printings — his Minstrel *Slavery That Was* against his hymnal's *Ages,
ages have departed* at 0.54. It is now a **within-file** pair. The
cross-file series falls 8 → 7 at the 0.30 cut and 5 → 4 at 0.50, the
within-file series rises 45 → 46 and 38 → 39, and **the totals are
unmoved at 53 / 43 / 31 / 24 / 5**. Nothing was deleted and no verse
byte changed; a pair moved between two counts that are deliberately kept
apart. A new pin asserts the total series for that reason, so a future
merge that actually loses an item cannot hide inside a reshuffle. Every
readability rate is likewise unmoved, which is the independent check
that this was a rehousing.

---

## 0.7 · A prose note on a value key was becoming data, and the checker that caught it was not the reader

The Montgomery merge (§0.6) produced a `# function:` line carrying an
explanatory paragraph. `check_file` refused it — as **seven** violations,
each a fragment of English dressed as a bogus vocabulary word, because
the reader had comma-split the sentence. That was the visible half and
it looked like a message defect.

**It was not. `report()` never calls `check_file`.** Probed on a file
whose header reads `# region: CONTESTED, therefore blank -- see the note
below`, the report:

| | before |
|---|---|
| `by_region` | `{'CONTESTED, therefore blank -- see the note below': 1}` |
| `by_function` | `{'none': 1, 'really; this file is mixed': 1}` |
| `cells` | a **two-cell** coverage grid, from one song |
| `multi_tag` | `{2: 1}` — inflating the tag-inflation metric this taxonomy exists to watch |
| `undeclared_region` | **0**, for a file that says the word "blank" in its own header |

`report()` is where every pinned count in this document and in the test
suite comes from. The validation lived beside the reader instead of
inside it, which is doctrine 48 exactly: applied as often as someone
remembers to run the other function.

### Two gates, and they fail differently

`VALUE_SHAPE = ^[a-z][a-z0-9_]*$` now runs **at the read**, and it is
deliberately separate from the closed table:

- **shape** — is this line a declaration at all?
- **table** — is this declared value in the closed vocabulary?

A shaped-but-unknown value (`atlantean`) is a **typo of a value** and
still refuses *by name*, unchanged — that behaviour is pinned, and two
controls in the new test section exist to prove the shape gate did not
swallow the table gate. Text failing the shape is **not a value**, never
reaches any count, and is carried apart as `malformed` with its file,
line, key and raw text. The underscore is in the character class because
two reserved values need it (`african_american`, `tin_pan_alley`).

**All or nothing per line.** The first cut still harvested the
well-shaped fragments out of a sentence — `# function: none, really;
this file is mixed` contributed the value `none` *and* a malformed
record, so the leak survived in miniature. A line that fails the shape
is prose entire.

**Malformed is counted at the LINE, undeclared at the SONG.** A song
under an unreadable header genuinely has no declared region, so it stays
in `undeclared_region` and the invariant `by_region + undeclared ==
songs` is kept whole rather than grown a third term every pin would have
to restate. What doctrine 20 forbids is the collapse being *silent*, and
it is not: `--check` refuses at exit 2, and the printed report shouts a
`MALFORMED declarations:` block whenever one exists. Two counts that are
not summable even in principle — one about songs, one about lines.

### Latent by measurement, not by construction

Swept over every header and song value in the live corpus, the distinct
set is `{american, english, hymn, irish, nursery, patriotic, scottish,
stage}` and **0 fail the shape**. No recorded count moves; `--check`
still prints *the closed set holds*. A planted prose line is what turns
the gate red.

### Proven by mutation, because a check that cannot fail reads like one that passes

`test_corpus_taxonomy` §3b is 10 checks. Disabling the shape gate fails
**6 of 6** substantive checks and **0 of 4** controls. A second mutation
restoring only the partial harvest fails 4, including the leak check,
which reports the smoking gun directly: `{'none': 1} / {1: 1}`. The four
controls — shaped-unknown still refuses by name, it is not diverted to
malformed, a `-basis:` key stays invisible to the value reader, and a
legal declaration beside prose is untouched — pass on both trees, which
is what makes them controls.

---

## 0.8 · The Home Book of Verse, landed as the safe subset

The four HBV volumes were HELD at Phase 1 because the corpus's licence
line asserted *"edition published 1912"* and the text refutes it on its
face: it credits authors dead as late as 1936 and prints "Ford Madox
**Ford**" in the body while its own index still reads "Hueffer", the
name he changed in 1919. It is a 1930s printing whose source edition the
Project Gutenberg header never names.

**Owner's ruling: land the safe subset.** 1,938 items extracted, **1,049
landed** — 272 new files and 615 items topped up into 191 existing ones.
Corpus **1,174 → 1,423 files**, songs **7,618 → 8,667**.

### The gate reads the author, never the edition

No claim here rests on the edition date. Each item is admitted on its
author's OWN printed death year, which this edition sets beside every
credit, and every item whose admissibility would have depended on the
unnameable date is **dropped**:

| verdict | items |
|---|---:|
| closed death year ≤ 1928 | 1,538 |
| open or unknown death, born after 1828 | **245** |
| closed death year ≥ 1929 | **108** |
| truncated year (unbounded, not small) | **40** |
| no year printed at all | **7** |

**400 of 1,938 (20.6%) refused**, 489 more dropped as cross-source
duplicates by the dedup rail. The licence line on every landed item now
says what it rests on and what it declines to claim.

**AND MY OWN GATE HAD A FALSE-SAFE, CAUGHT BY THE AUDIT.** The first cut
extracted years with `\d{3,4}` and read Carolyn Wells's `186?--` as
**the year 186**, concluded *"max printed year 186 ≤ 1828, certainly
dead"*, and admitted an author who died in **1942**. A truncated year is
UNBOUNDED, not small — and it is the one shape that turns the gate's
safest branch into its most dangerous. Any digit run shorter than four
now refuses outright; 41 items in this batch carry one, every last of
them a 19th-century birth with no printed death, and not one a genuine
three-digit medieval year.

**A SECOND DEFECT OF MINE, CAUGHT BY CHECK B.** The top-up path never
filled the dated licence slot, so the first WRITE put the
`_HBV_UNDATED` placeholder — a line whose own text reads *"REFUSED …
should be unreachable"* — into **191 files as 315 licence lines**. The
new-file path had done it correctly since it was written; the two paths
disagreed about one thing, which is doctrine 1 inside one function. The
audit reported it as a licence-regime disagreement, which is the gate
working.

### Four death-year conflicts, and only one was two people

The death-year rail deferred four authors. **Three were the edition
contradicting itself in its own pages**, with the corpus already holding
the correct year and HBV's own majority reading agreeing:

| author | HBV prints | correct |
|---|---|---|
| William Cowper | 1731-1800 ×2 **and** 1731-1808 | 1800 |
| Hartley Coleridge | 1796-1849 **and** 1796-1840 | 1849 |
| John Godfrey Saxe | 1816-1887 **and** 1816-1877 | 1887 |

Corrected per (author, printed-dates), so the fix cannot reach another
author or another year — and nothing is DERIVED: each value is one the
same edition prints elsewhere and the corpus independently records.

**The fourth is a real homonym.** Oxford stages James Thomson
(1700-1748) of *The Seasons* and *Rule, Britannia*; HBV credits James
Thomson (1834-1882), "B.V." of *The City of Dreadful Night*. 134 years
apart, each date printed by its own edition. Routing on the bare name
would have merged them — the Alexander Hume case exactly, and what the
rail is for.

### 23 twins merged, and the surname guard earned its place

A near-name scan over the WHOLE corpus found 23 pairs the exact-name
router could not see — a fuller form in one edition against a shorter
one already staged (`Alfred Tennyson` / `Alfred Tennyson, Lord
Tennyson`; `Carolina Nairne` / `Carolina Oliphant, Lady Nairne`).
Identity is the editions' own printed death years agreeing inside the
corpus's existing `DEATH_SLACK` of 2 — which is what admits Nairne,
printed **1763**-1845 in one book and **1766**-1845 in the other.

**A SURNAME GUARD REJECTED THE ONE FALSE POSITIVE** the death year alone
would have merged: **Frederick William Faber (1814-1863)** and
**Frederick William Thomas (1811-1864)** share two given names and a
death year to within a year, and are two men — a hymnwriter and an
American novelist. Songs are unmoved at 8,667 across all 23 merges: a
merge rehouses items and removes none.

### The duplication census sees exactly one new cross-file pair

Cross-file variants go 7 → **8**, and the addition is **Jones~Raleigh**:
Robert Jones's Elizabethan song-book prints a lyric HBV credits to
Walter Raleigh — the same contested-attribution shape as the
Jones~Durfey pair beside it, and correctly kept rather than deduped.
**Everything at the 0.60 dedup floor and above is unmoved through three
loads: 31 / 24 / 5.**

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
| G | ORTHOGRAPHY — the destroying alternant | 50, 70 | **0** | 0 | 182 | PASS, one live cost §5.1 |

**423 findings: 3 FAIL, 227 WARN, 193 NOTE.** Exit status is 1, on the three
FAILs — E's two duplications (§0) and D's one mislabelled file. The audit takes
19 seconds over 26 MB; the calibration takes half a second, with the real
trees present or absent, so there is no excuse for skipping it.

> **REPINNED 2026-08-20 (second sitting): 830 findings — 1 FAIL, 231
> WARN, 598 NOTE**, over **742 files** (~~514 files, 429 NOTE~~, earlier
> the same day). The **Tier-1 concurrent load** staged every remaining
> personally-attributed item from five already-licence-ADMITted song
> anthologies: Southern War Songs (PG37538), American War Ballads vol. 2
> (PG54211), the Golden Treasury of American Songs and Lyrics (PG15553),
> Lyrics from the Song-Books of the Elizabethan Age (PG27129), and
> Victorian Songs (PG26715) — **234 new per-author files (514 songs) and
> 46 top-up songs into 18 existing files**, the corpus's first
> multi-agent sitting: four extraction agents ran in parallel, each
> validating its own parse by full reconciliation against its edition's
> own contents or first-line index (Golden Treasury 147 of 148 with the
> 148th credited '(?)' by the edition itself; Victorian 131 of 131 with
> a per-line ledger; Elizabethan all 234 index entries, 14 skipped where
> the edition's credit names no person; the war-songs pair 175 of 298
> body items, 123 skips recorded by reason — no printed attribution,
> pseudonym-only, music/arranger/performer-only). A single writer then
> landed everything behind the containment dedup, which dropped **114
> cross-source reprints** — including the 58 Elizabethan items that were
> the corpus's original Campion/Dowland staging from the same book,
> found rather than assumed. Routing caught five edition-spelling
> variants of existing corpus authors ('Paul Lawrence Dunbar', 'Stephen
> Collins Foster', 'Father Ryan', 'Christina G. Rossetti', 'Dinah Maria
> Mulock Craik') that would otherwise have made duplicate author files,
> and merged joint-songbook items into the Campion file per that file's
> own precedent. Per-author regions were adjudicated for the Victorian
> anthology's new authors ('Victorian' is an era, not a region): 4
> irish, 2 scottish, remainder english. THE LOAD'S OWN POST-WRITE CHECK
> CAUGHT A FORMATTING DEFECT AND THE FIRST FIX WAS WRONG TOO: the
> war-song books print chorus apparatus two ways — a stanza-heading
> `CHORUS--text` STATES the chorus, and a bare trailing `CHORUS.` after
> a later stanza is the printer's REPEAT POINTER — and the first render
> staged both as verse text. A first repair mistyped the pointers as
> `[CHORUS]` marks on the FOLLOWING verse (Goober Peas's verses 3-5
> briefly became three choruses) before the shape census over the
> extraction itself settled the semantics: 49 inline statements are real
> `[CHORUS]` blocks, 105 trailing pointers are apparatus and are
> stripped, the same reading the return machinery gives `&c.`. The
> affected files were regenerated from the extraction, not patched.
> AND A SYSTEMATIC NEAR-NAME SCAN AFTER THE LANDING found six
> cross-book spelling-variant TWIN FILES the exact-name routing had
> created — George H./George Henry Boker, Harry Macarthy/McCarthy,
> H. L./Harry L. Flash, Carrie Bell Sinclair with and without 'Miss',
> Lieut./Robert Falligant (the edition ties both credits to Savannah),
> Forceythe/Byron Forceythe Willson — each pair identified by the
> editions' own indexes and merged into one file carrying both credits,
> so the NET new-file count is 228 and the corpus lands at **616 eng
> files / 6,352 songs**. The edition's own roster also SEPARATES one
> near-pair — 'Hewett, John M.' and 'Hewitt, John H.' are two index
> entries — so those two files stay apart, recorded not resolved.
> WARN is UNCHANGED at 231 —
> every new file ships its own per-file `local:` row with the staged
> md5; the +172 NOTEs are all check G's elision-orthography disclosures
> ('tis, o'er — 19th-century song verse triggers it by nature); FAIL is
> the same pre-existing `fas_hafez.LICENSE.txt` mislabel.
>
> **REPINNED 2026-08-20: 661 findings — 1 FAIL, 231 WARN, 429 NOTE**, over
> **514 files** (~~269 files, 202 NOTE~~, 2026-08-19). The owner-directed
> mass load staged **245 new `eng_celtic_msm_*` files (812 songs)** — every
> unstaged author section of the already-licence-ADMITted Modern Scottish
> Minstrel (PG22515), one file per author, behind dedup (CorpusIndex
> against the live corpus AND in-batch), a non-English-orthography rail,
> a TOC-shaped rail, and a 4-line floor. WARN is UNCHANGED at 231 because
> every new file ships with its own per-file `local:` `data/sources.tsv`
> row carrying the staged md5 — check C's "no hash recorded" exposure did
> not grow by one file. The +227 NOTEs are check G's per-file
> elision-orthography disclosures, which Scots files trigger by their
> nature; the FAIL is the same pre-existing `fas_hafez.LICENSE.txt`
> mislabel.
> **THE LOAD'S FIRST CUT (238 files / 790 songs) WAS FULLY RESTAGED THE
> SAME SITTING, never committed.** A post-load cross-check of every staged
> heading against the edition's own CONTENTS author lists found: three
> pseudo-author files named after SONG TITLES ('Oh, The Happy Time
> Departed!', 'Broadswords Of Scotland', 'Her Hair Was Like The Cromla
> Mist'), each carved out of a real author's section (Charles Mackay,
> J. G. Lockhart, Robert Allan) because a column-0 italic music credit
> (`_Air by Sir H. R. Bishop._`) between a song's title and its verse
> made the title classify as an author heading; ~26 songs silently
> DROPPED wherever that credit shape, a column-0 editorial headnote
> (Macintyre's 350-line 'Bendourain'), or a two-line comma title
> ('CABERFAE,' / 'THE STAGHEAD.') sat between title and verse;
> vol II's INTRODUCTION quotes staged as 8 fake HUNTER/OWL "songs" under
> Norman Macleod (sections now CLIP at 'END OF VOL.' markers); John
> MacOdrum's one song absorbed into Duncan Macintyre's file, and four
> more authors' songs absorbed into neighbours, because the biographical
> regex missed their memoirs' wording (the CONTENTS census is now a head
> authority alongside it); and one song ('WATTY M'NEIL') attributed to
> Alexander Tait that is Charles Fleming's. The rev-2 restage also
> merged multi-volume re-appearances of one author into one file (Rob
> Donn's vol I + vol II selections; Evan M'Coll, whose second section the
> edition itself cross-references 'For Biographical Sketch, see p. 222')
> while keeping the memoir-attested name-twins apart (two William
> Camerons, two John Finlays, two Alexander Humes — a section with its
> own printed memoir is its own author identity). Two corpus CORRECTIONS
> to previously-committed files shipped with the load: (1) five songs
> staged under `eng_celtic_walter_scott.txt` on 2026-08-19 are **Rob
> Donn's** — the edition's own `ROBERT MACKAY (ROB DONN).` heading sits
> above them; moved to `eng_celtic_msm_robert_mackay_rob_donn.txt`
> (Scott 19 -> 14 items). (2) One Robert Hogg song had been swallowed by
> a FOOTNOTES pseudo-section; restored (5 -> 6).
> **REPINNED 2026-08-19: 434 findings — 1 FAIL, 231 WARN, 202 NOTE**, over the
> same 269 files (~~229 WARN, 199 NOTE~~, 2026-08-16). Pass-1 same-gate
> top-ups appended 49 new hymns to eleven `eng_hymn_*` files from
> already-cited editions (Otterbein, Book of Hymns, and Watts's three own
> collections) — real content growth, not drift. THIS REPIN SUPERSEDES A
> FIRST ATTEMPT AT THE SAME PIN, never committed: that attempt's extraction
> had let PG13341's own trailing scripture-index appendix and full Project
> Gutenberg licence footer run on as the last item's own verses (the
> source's LAST matched header had no next header to bound it, so its
> block ran to end-of-file) — caught by an unrelated readability-statistic
> investigation (`unreadable_final_piece` carrying thirteen literal
> `Gutenberg-tm` tokens), reverted via `git checkout --`, and re-staged
> after the extraction scripts were given a shared book-end boundary
> detector. That detector's own first cut was ALSO wrong the same way one
> layer down: Watts's `Hymns-and-Spiritual-Songs` divides into three
> internal books, each closing with a real "End of the First/Second/Third
> Book." line, and cutting at the FIRST such line (rather than the
> source's true tail markers — the appendix's own `AN INDEX` title and the
> Gutenberg boilerplate) discarded two of the source's three books outright
> (48 items down to 13). Fixed by dropping the ambiguous book-divider
> pattern and keying the boundary on markers that are structurally
> guaranteed to appear once, at the true tail.
> Five findings moved, all genuine and none a defect this (corrected) batch
> introduced: check E gained four rows on `eng_hymn_watts.txt` (2 WARN, 2
> NOTE) — RUN-ONs and TITLE ECHOes that PRE-DATE this batch (confirmed:
> none of the five swallowed/echoing items carries the `--- SOURCE:` tag
> every newly-staged item does), newly VISIBLE only because the batch's
> own additions happen to supply titles the check cross-references
> against ("Hosanna to the King" among them); recorded, not repaired, in
> `CORPUS_LOADING_PROTOCOL.md`'s scope. And check G gained one NOTE for
> `eng_hymn_cennick.txt` — the elision-ratio measurement, a disclosure not
> a finding about correctness, firing because the file crossed the
> population size the check reads at all. Repinned together by re-running
> the command, over an isolated `git worktree` at the prior HEAD to get a
> trustworthy before/after (a `git stash`-based comparison earlier in the
> same sitting popped an unrelated stash from a different worktree by
> accident — caught immediately, the popped changes reverted byte-for-byte
> before anything else happened, and the stash left untouched for its
> owner; the worktree route has no such failure mode).
> **REPINNED 2026-08-16: 429 findings — 1 FAIL, 229 WARN, 199 NOTE**, over the
> same 269 files (~~230 WARN, 198 NOTE~~, 2026-08-13). ONE finding changed
> SEVERITY and none appeared or vanished: `_ABSENT_ON_PURPOSE` gained the
> `FAILED SOURCE SEARCH` phrasing, so
> `SEARCH:non-hattatal-third-edition-2026-08-11` — a doctrine 39 recorded
> failed search, spelled the way the table actually spells it — stopped being
> charged as a doctrine 34 WARN and became a NOTE. The total is unchanged at
> 429 because it is one finding counted in a different column.
> **AND THIS LINE IS WHY THE REPIN IS HERE AND NOT ONLY IN THE `.py`.**
> `--verify-shape` announces itself as *"RESULTS_CORPUS_AUDIT.md's committed
> shape against this run"* and then reads `PINNED_SHAPE` out of
> `audit_corpus.py`; it has never read this file. So the sentence a human
> greps for and the constant the gate compares are TWO records with one name,
> and only one of them can go red. Repinned together, by re-running the
> command — not by editing a number to meet a gate.
> `python3 quality/audit_corpus.py`, exit 1. **TWO of the three
> FAILs were fixed and this file was never told**: E's two duplications are
> gone, and the survivor is D's `corpus/fas_hafez.LICENSE.txt`, declared `fas`
> and unreadable under it (1.0% of 626 sampled tokens). The WARN and NOTE
> counts rose by 3 and 5 as the corpus grew.
>
> **AND NOTHING RUNS THIS.** An audit of all eight adversaries found this one —
> adversary 5, "the CORPUS" — has ZERO automated callers: no CI step, no test,
> no caller anywhere; only a `__main__` that fires when somebody types the
> command. Its committed output had therefore drifted for as long as nobody
> typed it. It already exits 1 on FAIL and takes three minutes, so it was
> CI-shaped the whole time and simply unwired. Wired into the `record` job the
> same day.
>
> Two things follow, and the second is the one worth keeping. First: a repin
> where the FAIL count FALLS is still a repin — the number moved, and a record
> that only gets corrected when it gets worse is a record nobody checks in the
> good direction. Second: this is doctrine 48 at the level of a whole
> instrument rather than a line of code. The audit could always fail; nothing
> ever asked it to.

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

## 3. The tokenisation is a coordinate, and the auditor got it wrong first

Check G's first version read the Malay file with the module's default token
rule and reported **39** `-ong` where doctrine 70 records **38**. The whole
difference is one token: `munchong-'kau`. The module default splits it into
`munchong` + `kau`; doctrine 70's amended rule — *"tokens are maximal runs of
`[A-Za-z'`’-]`, lowercased, over verse lines only"* — keeps the hyphen inside
the token, and then nothing ends in `-ong`.

**This is doctrine 58 landing on the instrument written to enforce it**, and
the same shape as the disagreement doctrine 70's amendment was written about:
three documents quoted three different `-ong` figures and the coordinate nobody
had written down was the tokenisation. A `Probe` now carries its own
`token_pattern`, the Malay probe carries doctrine 70's rule verbatim, the rule
is printed beside every count, and the pin
`test_corpus_audit.py::test_doctrine_70_figure_on_the_staged_file` requires
check G to print "66 preserving over … 2111 tokens" — 38 + 28, on 2,111 tokens,
which is the record.

---

## 4. A header claim that does not reproduce

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

## 5. What the audit found that the record did not have

### 5.1 · The most `<w>`-mixed book in the corpus arrived today, and it costs 2.11 pp

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

### 5.2 · The language code namespace in `data/sources.tsv` is not one namespace

108 of 386 rows open their `note` with a language code, and the table carries
`en` beside `eng`, `fi` beside `fin`, `sa` beside `san`, and **`lzh` beside
`ltc` for Literary Chinese** — 78 rows on one code and 1 on the other. Nothing
downstream reads these, so nothing is broken; recorded because an auditor that
compares a filename prefix against a row code has to map them, and the map is
now in `audit_corpus.ROW_LANG_ALIAS` where a future consumer will find it.

---

## 6. Doctrines: one extended, one qualified, none falsified outright

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
compared an extract's md5 to its source's and reported 11 defects. The rule
that found that error is the rule the check was built to enforce.

**Doctrine 58 held against its own instrument, twice (§B.1, §3).** The auditor
read a prose sentence as a declared count and raised 22 failures that were its
own; and it read the Malay file on a tokenisation one token away from the one
doctrine 70 records, and got 39 where the record says 38. Both are the exact
error the doctrines describe, committed by the module written to catch them.
Recorded rather than quietly fixed, because a fix that is not written down is a
fix that comes back — and both are now pinned.

---

## 7. Reproduce

```
python3 quality/audit_corpus.py                       # every check, corpus/
python3 quality/audit_corpus.py --check E             # the two duplications
python3 quality/audit_corpus.py --check C             # the 217 unhashed files
python3 quality/audit_corpus.py --calibrate           # the three known cases
python3 quality/audit_corpus.py --baseline            # the number that makes D weak
python3 quality/audit_corpus.py --only 'msa*' --check G
python3 quality/test_corpus_audit.py                  # 33 pins
```

Exit status is meaningful: non-zero on any FAIL, and non-zero when
`--calibrate` fails to rediscover a known case.
