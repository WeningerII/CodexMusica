# Results — the relations null, all 77 schemas over the whole panel

**TWO RUNS OF THE SAME PANEL, AND BOTH ARE KEPT (doctrine 17).** This document
was written twice on 2026-08-22 by two sessions working the same step of the
same plan, against the same `quality/relations_null.py` §9 instrument, and the
two runs differ in ONE coordinate: **n = 200 against n = 25**. Neither is
wrong and they do not agree, and the disagreement is the most useful thing in
the file — so §A below is the n=200 reading and §B, unaltered, is the n=25
reading it supersedes. **The admissible set differs by twelve schemas, and the
whole of that difference is replicate count.**

| | §B — n=25 | §A — n=200 |
|---|---:|---:|
| rows | 2,344 | 2,344 |
| rows whose null MOVED | 1,442 | 1,445 |
| rows ABOVE the null max | 217 | **137** |
| expected clears with NO effect | **58.7** | **7.9** |
| …as a share of the clears | **27.1%** | **5.8%** |
| ADMISSIBLE, in tradition | 25 | **17** |
| ADMISSIBLE, rule shape only | 12 | **11** |
| swept, below or at chance | 10 | **19** |
| refused replicate draws | 188 | 1,508 |

**Read the top two rows together.** At n=25 the smallest attainable p is
1/26 = 3.85%, so a row clears by chance once in twenty-six; over 1,442 moved
rows that is 58.7 free clears, and §B says so in its own headline. At n=200
the same criterion costs 1/201 = 0.4975% and the free set is 7.9. **Twelve of
§B's 37 admissible schemas did not survive the eightfold increase in
replicates**, which is within a whisker of the 58.7 − 7.9 ≈ 51 free ROWS §B
predicted for itself. §B's arithmetic was right about §B. Doctrine 57: an
empirical p at 1/(n+1) reports the RESOLUTION, and the cure for a resolution
is n, not argument.

**EVERYTHING §B SAYS ABOUT THE INSTRUMENT STILL STANDS**, including the two
findings §A did not make: the collapsed stanza frame (§B's last paragraph —
the panel readers drop blank lines and `_stream_of` derives stanzas from blank
lines, so every slice is ONE stanza) **applies to the n=200 run identically**;
and §B's warning that every row is a best-of over 4 statistics × 4 nulls ×
9 slices applies to §A unchanged.

> **THE COLLAPSED FRAME IS NOW FIXED IN THE CODE, AND IT COSTS THIS DOCUMENT
> THREE ROWS** (`MISSING.md` M-39, 2026-08-22). Two corrections to §B's
> paragraph first: it is **five** schemas and not six — `line_pair` is
> `line // 2` and took 20 distinct values on all nine slices, so `symploce`
> was never collapsed — and the laundering was not the derivation but
> `_stream_of`, which computed `stanzas_from_blank_lines` over a join of
> TOKENS and passed the all-zero result as an explicit declaration, so
> `Stream.supply('stanza')` answered `present`.
>
> A `frame="stanza"` figure now ASKS for the frame it quantifies over and
> refuses when nobody supplied one; `grid.stanza_ground` supplies it from what
> the sources print. Seven of nine slices ground (eng 7 stanzas, non 5 vísur,
> msa 10 pantun, ltc 10 詞, fas 7 bayts, san 14 verses, cym_cynghanedd 1); the
> Kalevala and Alun print no break of any kind inside the 40 lines read and
> the five schemas **refuse** there rather than reporting a number.
>
> **Struck in §A: `monorhyme / leash` (§A.1, the +227 row) and `monai`
> (§A.2) — TWO rows, not the three this paragraph first claimed; the
> `Aitken's Law` strike was withdrawn on re-measurement, see §A.2.** §B is left
> UNALTERED as promised, and its own copies of those rows (its §"ADMISSIBLE"
> tables, `monorhyme / leash` 268/41 among them) are superseded by this
> paragraph rather than by an edit. Nothing else in either section is
> affected: ~~no other row reads `Unit.stanza`.~~
>
> **THAT LAST CLAUSE WAS FALSE AND IS WITHDRAWN, 2026-08-22.** FIVE schemas
> read `Unit.stanza` — `analysed rhyme`, `monorhyme / leash`,
> `dvitiyakshara-prasa`, `monai`, `blues AAB stanza` — and this document
> struck only the two that CLEARED. The correction was applied to the ROWS
> rather than to the COORDINATE, which is the same mistake one level up from
> the defect it was correcting. The other three are classified below through a
> frame that could not vary and are flagged in place:
>
> * **§A.3.1 "swept, and at or below chance (19)"** carries `analysed rhyme`
>   and `dvitiyakshara-prasa`. Re-measured through the printed ground:
>   `analysed rhyme` eng 26→4, non 93→3, san 98→5, and **fin and cym move
>   from a number to a REFUSAL**; `dvitiyakshara-prasa` moves on all six
>   slices where it fires and refuses on two.
> * **§A.3.3 "runs, and finds nothing (8)"** carries `blues AAB stanza`, which
>   now REFUSES on the two groundless cells rather than being asked there —
>   the difference doctrine 20 is entirely about.
>
> So **§A.0's 19, 8 and 50 are built on superseded classifications.** They are
> left as recorded and flagged rather than re-typed: the re-run that decides
> where the three land is M-39's first remaining piece, and a count edited
> ahead of its measurement is what this document is written against.

---

# §A · THE n=200 READING (superseding)

Run 2026-08-22, seed 20260811, **n = 200**, budget `None`, 2,344 result rows,
**56,723 CPU-seconds** (~1 h 50 m of wall clock on four cores). Chunked across
13 processes by slice group and, on the two most expensive cells, by null —
`sweep(nulls=[...])` — because the replicate seed is derived from the
replicate INDEX, so a chunked run and a whole one draw the same permutations
(doctrine 66). The panel, the slices and the declarations are §B's and are not
restated.

## A.0 The headline

1. **50 of the 77 are swept.** 17 clear their own null inside their own
   declared tradition; 11 more clear only where `tradition_scope` is not
   `in_tradition`; 19 are swept and sit at or below chance; 3 fire and no
   randomisation in `NULLS` moves them at all.
2. **The 27 not swept are three findings kept apart** (doctrine 79): 8 NO
   INSTANCE, 17 refusing on a capability a declaration could carry that no
   honest input here can fill, 2 on a capability `Stream.supply` has no branch
   for. All 27 are named in §B and the split is unchanged between the runs.
3. **A count from this layer sitting BELOW chance is the ordinary case.** Of
   the 1,445 moved rows, **1,308 (90.5%) sit at or below the null's max** —
   superseding the 2026-08-13 reading's 126 of 181 on 34 schemas and one text.
   `consonance` on the English slice reads **30 against a null max of 222**
   (lift 0.30, superseding ~~23 against 191, lift 0.19~~); `head rhyme
   (positional)` **4 against 36** (0.21, superseding ~~4 against 30~~);
   `internal rhyme` **1,247 against a null median of 1,500** (0.83).
4. **`line_permutation` is the identity map on 203 count-rows**, of 899 rows
   (38.4% of 2,344) where the null returned the observation exactly —
   superseding 24 of 87 (32.5%) on one slice. The file's finding 1 now holds
   across eight languages.
5. **CANNOT FAIL is no longer inconclusive by construction.**
   `OFF_MENU_MOVERS` records that the verdict "has never been measured on a
   text where its schemas fire". It has now: the three reduplications fire on
   six slices and **0 of 200 replicates moved them on any of 44 rows**. §B
   reports the same three and the n=200 run is what makes it a measurement
   rather than a derivation.
6. **All 1,508 refused replicate draws are ONE schema.** `epistrophe / radif`
   on the Persian cell: every null destroys the shared trailing run
   `mark_refrain_tail` computes, so the frame the schema REQUIRES is absent
   and `realise()` refuses. Under `global_redeal` **200 of 200 draws refused**
   and that row's null is EMPTY; under `line_permutation` 21 of 200 survived.
   §B reports this schema as ADMISSIBLE on 6 of 6 moved rows; at n=200 it is
   **at or below chance**, and §A.4 below is why that row should not be
   believed in either direction.
7. **28 admissible names are at most 26 admissible measurements.** Two pairs
   collapse — see §A.4.

## A.1 ADMISSIBLE — in tradition (17)

`nulls` is how many of the four randomisations the schema cleared under on
that slice; `rows` is cleared / moved over the whole panel.

| schema | statistic | null | slice | observed | null max | gap | lift | nulls | rows |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| `perfect rhyme` | count | within_line_shuffle | eng | 261 | 30 | **+231** | 32.62× | 4/4 | 6/36 |
| ~~`monorhyme / leash`~~ | ~~count~~ | ~~global_redeal~~ | ~~eng~~ | ~~268~~ | ~~41~~ | ~~**+227**~~ | ~~17.87×~~ | ~~4/4~~ | ~~6/42~~ |
| `alliteration` | count | global_redeal | fin | 45 | 19 | +26 | 5.00× | 2/4 | 5/18 |
| `Kalevala alliteration (weak)` | count | global_redeal | fin | 45 | 19 | +26 | 5.00× | 2/4 | 11/36 |
| `mosaic rhyme` | count | within_line_shuffle | eng | 53 | 33 | +20 | 6.62× | 2/4 | 2/60 |
| `cynghanedd sain drosgl` | count | line_final_permutation | cym | 95 | 78 | +17 | 1.38× | 2/4 | 5/14 |
| `cynghanedd sain lafarog` | count | line_final_permutation | cym | 77 | 61 | +16 | 1.40× | 2/4 | 5/18 |
| `repetition` | count | within_line_shuffle | eng | 35 | 24 | +11 | 5.00× | 2/4 | 7/42 |
| `light rhyme` | count | within_line_shuffle | cym_cynghanedd | 23 | 12 | +11 | 5.75× | 4/4 | 8/29 |
| `Kalevala alliteration (strong)` | count | global_redeal | fin | 15 | 5 | +10 | 15.00× | 2/4 | 4/28 |
| `compound / phrasal rhyme` | count | within_line_shuffle | eng | 23 | 17 | +6 | 2.88× | 2/4 | 5/75 |
| `cynghanedd sain gadwynog` | count | global_redeal | cym | 20 | 15 | +5 | 2.86× | 1/4 | 6/18 |
| `cynghanedd sain` | count | global_redeal | cym | 17 | 14 | +3 | 3.40× | 1/4 | 6/18 |
| `rime riche` | count | within_line_shuffle | eng | 5 | 3 | +2 | ∞ | 2/4 | 4/23 |
| `pantun ABAB` | count | global_redeal | msa | 17 | 15 | +2 | 2.43× | 1/4 | 19/32 |
| `chain rhyme (rap)` | local_fraction@2 | global_redeal | eng | 0.696093 | 0.610169 | +0.0859 | 1.34× | 2/4 | 2/72 |
| `internal rhyme` | local_fraction@2 | within_line_shuffle | eng | 0.141139 | 0.134550 | +0.0066 | 1.07× | 2/4 | 7/62 |

`lift = observed / null MEDIAN`; `∞` means the median was zero, which says the
relation is rare under the null and NOT that the effect is large — read the
gap, which for `rime riche` is two instances.

> **THE `nulls` COLUMN IS OVER-COUNTED FOR SEVEN OF THESE ROWS (`MISSING.md`
> M-42, 2026-08-22).** `line_permutation` and `line_final_permutation` each
> shuffle once off the same `random.Random(seed + 1 + k)`, so they draw the
> same permutation. Measured over 200 replicates: **200 of 200 place the same
> line-final token in the same line**, while 0 of 200 produce identical token
> grids. For a schema declaring `both_line_final` — 28 of the 77 — the two are
> ONE randomisation, so the denominator is **3, not 4**. Affected here:
> `perfect rhyme`, `monorhyme / leash`, `mosaic rhyme`, `light rhyme`,
> `compound / phrasal rhyme`, `rime riche`, `pantun ABAB`.
>
> **This does not say those seven are wrong.** `perfect rhyme` clears at +231
> against a null max of 30; a gap that size is not manufactured by counting a
> randomisation twice. What is wrong is the robustness figure beside it — and
> for the rows that cleared under exactly one of four, "one of four" and "one
> of three" are different sentences about how hard the row tried. The column
> is left as recorded and flagged rather than re-typed, because fixing it
> properly means giving the second null its own stream and re-running.

> **`monorhyme / leash` IS STRUCK, 2026-08-22, and the row is the second in
> this table.** Both §A and §B measured it — and the four other
> `frame="stanza"` schemas, and `Scots vowel-length rhyme (Aitken's Law)` in
> §A.2, which returns the identical instance set — over a stanza frame THAT
> COULD NOT VARY. `_stream_of` computed `stanzas_from_blank_lines` over a join
> of tokens, which carries no blank line, and passed the all-zero result as an
> explicit declaration; every panel slice was therefore one stanza and a leash
> was enumerated across all forty lines. Grounded on what the sources print
> (`MISSING.md` M-39, closed the same day), the eng observation is **30
> instances, not 268** — a leash is a run of one rhyme sound inside ONE
> stanza. **The +227 gap is not re-stated as smaller: it is withdrawn**, since
> the null was drawn through the same collapsed frame and has to be re-run
> before any gap can be quoted. What survives unchanged is `perfect rhyme` at
> the top of this table and every unframed row below it; what does not is this
> row and `monai` in §A.2. (This paragraph first named the `Aitken's Law` row
> as a third casualty; it is not one, and §A.2 records why the strike was
> withdrawn.)
>
> **THE RE-RUN IS DONE, 2026-08-22, and it RESTORES the row on a different
> cell.** Six schemas re-nulled over the grounded panel at the recorded
> coordinates — n=200, seed 20260811, budget None — for **93.8 CPU-seconds**,
> where the original 77-schema panel cost 56,723. 368 live rows, 223 moved,
> **16 clear**, and `expected_false_clears(223, 200) = 1.109`, so ~7% of the
> clears are free.
>
> **`monorhyme / leash` is ADMISSIBLE IN TRADITION again — and its best row is
> `non`, not `eng`:**
>
> | schema | statistic | null | slice | observed | null max | gap | lift | scope |
> |---|---|---|---|---:|---:|---:|---:|---|
> | `monorhyme / leash` | count | global_redeal | **non** | 37 | 8 | **+29** | 18.50× | **in_tradition** |
> | `monorhyme / leash` | count | within_line_shuffle | non | 37 | 11 | +26 | 9.25× | in_tradition |
> | `monorhyme / leash` | count | global_redeal | eng | 30 | 7 | +23 | 15.00× | in_tradition |
> | `monorhyme / leash` | count | within_line_shuffle | eng | 30 | 11 | +19 | 15.00× | in_tradition |
>
> Höfuðlausn is a **drápa in runhent** — end-rhymed Old Norse, the one metre in
> the corpus built out of single-sound runs — so the schema's strongest row is
> now on a text whose form it names. That is a better outcome than the row it
> replaces: the withdrawn +227 was Poe measured over forty lines with no
> stanza boundary, and this is 37 instances inside real vísur.
>
> **THE COLLIDED-NULL CAVEAT APPLIES HERE TOO (M-42).** Four of the sixteen
> clears are `line_final_permutation` **and** `line_permutation` on the same
> schema and slice — one randomisation counted twice — and the affected rows
> are marked as such below rather than counted as two.
>
> **`analysed rhyme` is NOT banked, on the re-run agent's own advice and mine.**
> Its single clear is that collided pair; its observation is **1.0**, the
> statistic's CEILING; and its denominator is **3 instances**. It clears
> nothing in its own tradition (eng: 4 against a null max of 15). A clear that
> is one randomisation, at a ceiling, over three instances is not a finding.
>
> `monai` restates at **exactly** +4 / 2.31× — unchanged, because
> `cym_cynghanedd`'s printed ground is one group, so its frame never varied
> either way. What moved is its provenance, from a laundered `declared` to a
> measured `printed_breaks, n=1`.

**Three cleared under all four randomisations** — `perfect rhyme`,
~~`monorhyme / leash`~~ (struck above), `light rhyme` — and fourteen of the
seventeen under two
or more nulls that destroy different coordinates. **Three cleared under
exactly one of four** (`cynghanedd sain`, `cynghanedd sain gadwynog`,
`pantun ABAB`) and three have gaps of two or three instances (`cynghanedd
sain` +3, `rime riche` +2, `pantun ABAB` +2). Those are where the ~8 free
clears sit if they sit anywhere.

**EIGHT OF §B's 25 ARE NOT HERE**, and each is a row whose clear did not
survive n=200: `semirhyme`, `cross rhyme`, `interlaced rhyme`, `linked rhyme`,
`anaphora`, `epistrophe / radif`, `cynghanedd groes o gyswllt`, `cynghanedd
lusg`. Four of those (`interlaced rhyme` 1.30×, `chain rhyme (rap)` 1.38×,
`cynghanedd sain lafarog` 1.47×, `internal rhyme` 1.48×) are the rows §B's own
"the reading I would not want quoted without its caveats" nominated as the
likeliest false clears, and §B was right about three of them.

## A.2 ADMISSIBLE — rule shape only (11)

Never summed with A.1 (doctrine 43/79). Each is a real measurement of a real
number and none is a measurement of the relation the canon names.

| schema | statistic | null | slice | gap | lift |
|---|---|---|---|---:|---:|
| `Scots vowel-length rhyme (Aitken's Law)` | count | global_redeal | eng | +227 | 17.87× |
| `anaphora` | local_fraction@2 | line_permutation | msa | +0.5263 | 8.00× |
| `cluster consonance / skothending span` | local_fraction@2 | within_line_shuffle | cym_cynghanedd | +0.5 | 11.00× |
| `syllabic rhyme` | local_fraction@2 | line_final_permutation | non | +0.3333 | 10.00× |
| `leonine rhyme` | count | global_redeal | ltc | +9 | 13.00× |
| ~~`monai`~~ | ~~count~~ | ~~within_line_shuffle~~ | ~~cym_cynghanedd~~ | ~~+4~~ | ~~2.31×~~ |
| `cynghanedd lusg` | count | within_line_shuffle | eng | +3 | 5.00× |
| `symploce` | count | line_permutation | msa | +3 | ∞ |
| `semirhyme` | count | global_redeal | fin | +2 | 3.17× |
| `incremental repetition` | count | global_redeal | msa | +2 | ∞ |
| `consonance` | local_fraction@2 | line_final_permutation | non | +0.0185 | 2.40× |

> **ONE OF THE ELEVEN IS STRUCK: `monai`, which is `forall stanza` in its own
> right and whose eng-side sibling fell with it.** Ten stand. The count in this
> heading is left at eleven and not re-typed to ten: re-running `monai` is what
> decides where it lands, and a heading edited ahead of the measurement would
> be the thing this document is written against.
>
> ~~**TWO OF THE ELEVEN ARE STRUCK for the same reason as §A.1's second row.**
> `Scots vowel-length rhyme (Aitken's Law)` returns the IDENTICAL instance set
> to `monorhyme / leash` on eng (§A.4 measures that), so the collapsed stanza
> frame carried it too.~~ **THAT REASONING WAS WRONG AND THE STRIKE IS
> WITHDRAWN, 2026-08-22, on an independent re-measurement rather than on the
> summary it was taken from.** `Scots vowel-length rhyme` is `frame='song'`.
> Measured on the eng slice through both stream builds: **268 instances over
> the collapsed frame and 268 over the printed ground** — the stanza
> coordinate does not touch it, and its row was never a casualty of M-39. What
> was true is the OPPOSITE of what I wrote: the two schemas returned the same
> set BECAUSE the collapsed frame erased the only thing separating them, and
> the fix has now separated them (268 against 30). See §A.4.1, which this
> correction rewrites.

The remedy for all eleven is a corpus, not a null. `monai` is Tamil and
`Scots vowel-length rhyme` is Scots, and this repo has neither a phonology nor
a corpus for either. `cynghanedd lusg` HAS both — and it cleared on Poe and on
neither Welsh cell, which is §A.4's problem rather than this section's.

## A.3 What did NOT clear — by name, in four kinds

An absent schema and a schema that found nothing must not look the same
(doctrine 20), so every one of the 60 is named here rather than counted.

**A.3.1 SWEPT, and at or below chance (19).** The instrument ran, the null
moved, and the observed count did not beat it. Enforcing any of these would
be enforcing the null.

`assonance` · `parechesis / general consonance` · `pararhyme` ·
`reverse rhyme` · `additive rhyme` · `subtractive rhyme` ·
`apocopated rhyme` · `enjambed rhyme` · `cross rhyme` · `interlaced rhyme` ·
`linked rhyme` · `head rhyme (positional)` · `epistrophe / radif` ·
`epanalepsis` · `analysed rhyme`† · `dvitiyakshara-prasa`† ·
`cynghanedd draws` · `cynghanedd groes o gyswllt` ·
`Middle Chinese end rhyme (同用 group)`

Deepest on the `count` statistic: `subtractive rhyme` 1 against a null median
of 16 on `eng` (0.062×); `pararhyme` 2 against 21 on `cym` (0.095×); `cluster
consonance` 1 against 9 on `cym_cynghanedd` (0.111×); `apocopated rhyme` 1
against 6 on `san` (0.167×). The mechanism is the one the file already names
for `internal rhyme`: these schemas carry a `both_line_final` or a DIFFER
channel that EXCLUDES the material the poet actually rhymed, and a shuffle
scatters that material into the positions the schema counts.
**`Middle Chinese end rhyme (同用 group)` is here and it is the first time it
has been asked at all** — it fires 25 instances on 花間集 and its own null
beats it.

† **MEASURED OVER A COLLAPSED STANZA FRAME (M-39).** These three are
`frame="stanza"` and their classification here was drawn before the frame had
a ground. Their observations move on every cell that grounds and become
REFUSALS on `fin` and `cym`, which supply no ground at all. The bucket they
belong in is decided by the re-run, not by this table; see the header note.

**A.3.2 SWEPT, and no randomisation moved them (3).** `rhyming reduplication`
(25 instances, six slices, 24 rows) · `exact reduplication` (7 instances, four
slices, 16 rows) · `ablaut reduplication` (2 instances, one slice, 4 rows).
44 rows, 200 replicates each, 0 differing. A reduplication is a relation
between two spans of ONE token, so no permutation of lines, of line finals, of
words within a line, or of the whole token sequence can touch it. The remedy
is a randomisation that destroys the token's own internal composition and this
file has none; reporting a p for any of these would be a p with no experiment
under it.

**A.3.3 RUNS, and finds nothing on this panel (8).** `paroemion` ·
`amphisbaenic rhyme` · `broken rhyme` · `qafiya (before the radif)` ·
`anadiplosis` · `cynghanedd groes` · `平仄 tonal template` ·
`blues AAB stanza`†. A null against an observation of zero is inconclusive by
construction: the observation sits at the statistic's floor and no replicate
can go lower. The remedy is a text the relation occurs in, and for at least
one of these the 40-line limit is the likelier cause than the language —
`cynghanedd groes` is the strictest rule of a set whose *sain* members fire
17, 20, 77 and 95 times on the same Welsh cells.

**A.3.4 REFUSES on a capability, on every slice (17 + 2).** `Stream.supply`
has a branch for every capability in the first table, so none of those is a
gap in the gate; what is missing is an honest INPUT, and the panel declines to
fake one. `relations.UNPROVIDABLE` already measured what faking one does —
forcing `provides('frequency')` True makes `trite rhyme` return exactly
`perfect rhyme`'s instances with nothing in the output able to tell them
apart — and that argument does not weaken when the missing resource is easier
to fake than a frequency table.

| schema(s) | capability | blocker |
|---|---|---|
| `antanaclasis` | `sense` | obtain — no sense inventory here; `data/nltk/` carries taggers and tokenizers, not WordNet. With a token-keyed resource it degenerates to `repetition`, a different schema in the same registry |
| `homoioteleuton`, `polyptoton` | `morphology` | build — the resource is a callable a caller declares; a suffix-strip written in the null runner would decide both verdicts by its own heuristic and report them as morphology |
| `holorhyme`, `rhyming slang` | `lexicon` | obtain — keying `lexeme` on lowercased token text makes it an alias of `token` and collapses a declared coordinate |
| `family rhyme`, `multisyllabic rhyme` | `quotient:manner` | build, and it belongs in a phonology — `_quotient_of` reads it from the declaration or from `phon.quotients`, and `ltc`'s 同用 is the only `quotients` field in the tree |
| `proest` | `quotient:vowel_class` | build — same mechanism; `quality/phonology/cym.py` declares no quotients |
| `eye rhyme` | `orthography` | build — a second stream under the orthography surface |
| `historical rhyme` | `earlier` | obtain — `declared_inputs.PeriodPhonology` refuses to construct without a named reconstruction, and that refusal is correct |
| `dialect rhyme` | `poet` | obtain — the surface has been reachable since `poet` joined `ALT_SURFACES` on 2026-08-13; the data is not |
| `wrenched rhyme`, `transformative / bent rhyme` | `delivered` | obtain — what the singer sang against what the page prints |
| `sung-delivery rhyme` | `sung` | obtain — same family |
| `alliterative long line`, `fourth lift must not alliterate` | `lifts` | **build, and it is the one gap the panel could have closed and cannot.** `provides('lifts')` reads `frames.lift_source` and MEASURED over this whole repository NOTHING assigns it — no scanner, no declarer, no caller. `caesura` and `refrain_tail` had `search_caesura` and `mark_refrain_tail` to call; this has no function to call |
| `offbeat internal rhyme` | `beat` | disjoint — `frames.beat` is doctrine 4's declared-inert field and stays None on purpose, so this refuses by design and not by omission |

And the two nothing can supply: **`trite rhyme`** needs `frequency`,
**`refrain by reference`** needs `stub_resolution`. Both are
`relations.UNPROVIDABLE` entries; the panel adds only that no cell of nine
supplies either, which is what `NEVER_PROVIDED` claims and which had until now
been asserted on one slice.

**SIX OF THESE ALSO MISS `prominence` ON THE `msa` AND `fas` CELLS, AND THAT
IS NOT THE BLOCKER.** 32 schemas name `prominence` and 22 name nothing else,
so the whole of `msa`'s 46 − `eng`'s 22 = 24 extra refusals is one missing
channel — a property of the phonology module, not of Malay or Persian.
`Refusal.capability` is `missing[0]` and `missing[0]` is ALPHABETICAL, so it
names `prominence` for four of these schemas and hides the structural
blocker; `Coverage.missing` now carries the whole set and the panel takes the
INTERSECTION across slices for exactly that reason (doctrine 44 — "declare a
prominence-bearing phonology" reads as the whole answer when it closes half
the gap).

## A.4 Three places the instrument is measuring the wrong thing

**A.4.1 ~~Two PAIRS of admissible schemas are one measurement each.~~ ONE
PAIR IS. The other pair was one measurement BECAUSE OF THE COLLAPSED FRAME,
and M-39 has separated them.**

*Re-measured independently 2026-08-22, both claims checked by hand rather than
carried over from the run's summary.*

`Scots vowel-length rhyme (Aitken's Law)` and `monorhyme / leash` differ by
one channel (`moras` AGREE at anchor scope) and by their `figure` — and the
figure difference IS the frame: `song` against `stanza`. Over a frame
collapsed to one group the figures cannot differ, so the two schemas were
reduced to their channel difference alone, and they returned the **identical
instance set** (268 on the English slice, span for span). Grounded on what the
page prints, the same slice reads **268 against 30**. The identity was an
artefact of the defect, not a property of the schemas.

**The inert-channel finding SURVIVES the correction and is in fact what the
identity proved.** Two schemas differing by one channel returned the same set,
which is exactly what it looks like when that channel never fires: `moras` is
inert under `eng`, there is no `sco` phonology to make it bite, and
`Scots vowel-length rhyme`'s +227 at 17.87× still carries no information about
Aitken's Law specifically. A schema whose distinguishing channel never fires
is a name, not a measurement — `relations.check_inert`'s question asked of a
CHANNEL rather than of a field. What is withdrawn is only the claim that the
two schemas are ONE MEASUREMENT: they are two, and one of them was being
measured over a frame that could not vary.

`alliteration` and `Kalevala alliteration (weak)`, BOTH inside A.1's
seventeen, **still return the identical 45 on the Finnish slice** — verified
span for span after the fix. Neither is stanza-framed, nothing about M-39
touches them, and that pair genuinely is one measurement wearing two names.

**A.4.2 `epistrophe / radif`'s null is 21 draws wearing an n of 200.** Every
randomisation in `NULLS` destroys the shared trailing run the schema requires,
so the replicate refuses. Counting the refusals rather than dropping them is
doctrine 27 one layer out — a draw the instrument could not answer belongs in
a count of its own, never silently outside the denominator — but counting them
does not make the row interpretable. No null in this inventory is a null ABOUT
the radif: they all destroy the DEFINITION rather than the effect, which is
doctrine 69's shape. What would be one is a randomisation that PRESERVES the
refrain and permutes what sits before it. §B's ADMISSIBLE verdict for this
schema and §A's below-chance verdict are both readings of that.

**A.4.3 The reader is a coordinate and it was doing uncounted work.** `_read`
— the LEDGER's reader, deliberately unchanged — keeps `--- TITLE:` rows, and
**2 of the ledger slice's 40 lines are `--- TITLE: THE RAVEN.` and
`--- SOURCE: PG10031`**, so the recorded 34-schema sweep tokenised `TITLE`,
`THE`, `RAVEN`, `SOURCE` and `PG10031` as verse. On other cells it is not a
rounding error: 20 of 40 rows of `msa_skeat_pantun.txt` and 18 of 40 of
`ltc_huajianji.txt` are marker rows, and `corpus/san_dcs_verse.txt` is a
seven-column TSV whose first six columns would have made `Gītagovinda` the
most frequent word in the slice. The panel reads through `_read_slice` /
`_read_dcs` / `_read_one_song` and the difference is MEASURED rather than
assumed: on the shared English slice, dropping the two marker rows moves two
census verdicts — `apocopated rhyme` and `light rhyme`, NO INSTANCE →
EXTENDABLE. `light rhyme` is in A.1. **And §B's collapsed-stanza finding is
this same defect one clause further on**: the readers drop blank lines too, so
the stanza frame cannot vary. Neither run fixes it.

## A.5 The dependency moved DURING the run, and it was re-derived

`quality/relations.py` was edited by another cell at 16:04 while this panel
ran 14:30–16:20, so processes started at different times could have imported
different modules. `RESULTS_NULL_SHAPES.md` §4b records exactly this hazard
once already. It was re-derived rather than argued: every slice's census was
recomputed against `relations.py` at md5
`da20bc640d90daa115d6a02ba9bcce0b` and diffed against the census the run
recorded. **693 (schema, slice) verdicts and instance counts, 0 moved.** The
one change that does bear on the panel landed BEFORE both runs and is visible
in both: `Stream.provides` became population-based, so a DECLARED-BUT-EMPTY
frame is `vacuous` rather than present — which is why `refrain_tail` is
supplied on one cell of nine and not on all nine.

## A.6 Reproduce

```
python3 quality/relations_null.py --panel --n=200        # §A  (hours)
python3 quality/relations_null.py --panel --n=25         # §B  (~5,600 s)
python3 quality/relations_null.py --verify               # exit 0
python3 quality/relations_null.py --verify --deep        # exit 0
python3 quality/test_relations_null.py                   # exit 0, 54 checks
python3 quality/test_null_shapes.py                      # exit 0, 27 checks
```

`--panel --n=1` is the cheapest demonstration that the false-clear line is
load-bearing: it prints **721 clears against 584.5 expected**, i.e. an
admissible set that is almost entirely the sweep's own freedom.

Coordinates: seed `20260811`; budget `None`; readers `_read_slice` /
`_read_dcs` / `_read_one_song`; declaration steps `caesura:searched` and
`refrain:all_lines` (`refrain:alternate` on `fas`); `git` HEAD `9d46ffc`;
`quality/relations.py` md5 `da20bc640d90daa115d6a02ba9bcce0b`.

## A.7 What §A does not claim

* It does not claim any relation is a rule. It claims 17 relations produce a
  count their own matched control does not reach, inside the tradition that
  names them, on one 40-line slice per language, with ~8 of the 137 clearing
  rows expected free.
* It does not claim the 19 at-or-below-chance schemas are absent from verse.
  The planted-signal detection floor (`--sensitivity`, doctrines 31/76) was
  NOT re-run over these nine cells; the last measurement of it is
  `RESULTS_NULL_SHAPES.md` §4b's, on the English slice alone — floor clears
  52, does not clear 30, statistic constant 30. "Below chance" and "no
  instance" are only interpretable where the statistic could have gone up,
  and for eight of nine cells that has not been demonstrated.
* It does not re-record `EXTENSION_LEDGER`. That ledger pins the 34-schema
  census on its own slice through its own reader and it still holds
  (`--verify`, exit 0). The panel is a second population beside it.

---

# §B · THE n=25 READING (superseded by §A on power, unaltered otherwise)

Written 2026-08-22 by the parallel session. Every sentence below is its own;
nothing in it has been edited. Its numbers are the n=25 run's and its two
instrument findings — the best-of caveat and the collapsed stanza frame —
carry into §A unchanged.

**Run 2026-08-22.** `python3 quality/relations_null.py --panel --n=25`, seed
20260811, 5,640s wall clock, exit 0. Nine slices, one per language this repo
has both a phonology and a corpus for, first 40 lines of each (doctrine 58:
the slice is a coordinate of the number, so it is written beside it):

| slice | text |
|---|---|
| eng | `corpus/song/eng_american_edgar_allan_poe.txt` |
| fin | `corpus/fin_kalevala.txt` |
| cym | `corpus/cym_alun_strict.txt` |
| cym_cynghanedd | `corpus/song/cym_cynghanedd_llywelyn_goch_cywydd.txt` |
| non | `corpus/song/non_egils_saga_hofudlausn.txt` |
| san | `corpus/san_dcs_verse.txt` |
| msa | `corpus/song/msa_skeat_pantun.txt` |
| ltc | `corpus/song/ltc_huajianji.txt` |
| fas | `corpus/song/fas_hafez_ganjoor.txt` |

## What this answers, and what it is FOR

Step 0 of the relation ladder: **nothing becomes an enforceable mandate
before it clears its own null.** A schema that fires more often than a matched
control is a candidate; one that does not is noise with a name, and admitting
it would be admitting the null back into the harness wearing a tradition's
word (doctrines 56/61/63).

## THE HEADLINE, AND THE NUMBER THAT QUALIFIES IT

```
schemas declared 77   rows 2,344   rows whose null MOVED 1,442   rows ABOVE the null max 217
expected clears with no effect at n=25:  58.7  of the 1,442 moved rows
replicate draws the schema REFUSED on:   188
```

**217 clears against 58.7 expected by chance.** That is 3.7x the freedom the
sweep had, so there is signal — and **roughly one clear in four is expected
from the sweep alone**. The expected figure is charged PER ROW at that row's
own used `n` (`expected_false_clears_over`), because a null that destroys a
frame makes that replicate refuse and shrinks the row's distribution below the
run's nominal 25.

**THE ADMISSIBLE SET IS AN ARGMAX AND MUST BE READ AS ONE (doctrine 19).**
Each schema was offered up to 4 statistics x 4 nulls x 9 slices, and the row
below is its BEST. That is why every row carries `N of M moved rows clear`:
`pantun ABAB` clears on 20 of its 32 moved rows and `mosaic rhyme` on 4 of 60,
and those are not the same kind of evidence even though both appear here.

**188 REFUSED REPLICATE DRAWS ARE A THIRD COUNT, NEVER A SILENT DROP**
(doctrines 27/79). `global_redeal` can scatter the trailing run a refrain tail
is computed from, so a replicate legitimately refuses where it used to return
`[]` — a null made only of draws that survived the schema's own gate is not
that schema's null.

## The eight-way split — one verdict per declared schema

| verdict | count |
|---|---:|
| **ADMISSIBLE, in tradition** | **25** |
| **ADMISSIBLE, rule shape only** | **12** |
| swept, below or at chance | 10 |
| swept, null never moved | 3 |
| no instance on any slice | 8 |
| cannot obtain — declarable | 17 |
| cannot obtain — never provided | 2 |
| too expensive | 0 |
| | **77** |

**THE DENOMINATOR IS NOT 77.** 19 schemas were never measurable here (17 + 2
cannot-obtain), which `MISSING.md` M-36 declared in advance and which this run
confirms to the schema. Of the **58 that could be swept**, 37 cleared and 21
did not.

## ADMISSIBLE — in tradition (25)

The rule shape matched AND the schema's `tradition_scope` says the tradition
did too.

| schema | statistic | null | lift | observed / null max | rows clearing |
|---|---|---|---:|---|---|
| `perfect rhyme` | count | global_redeal | **37.29x** | 261 / 18 | 6 of 36 moved (of 48) |
| `rime riche` | count | global_redeal | **infx** | 5 / 4 | 7 of 23 moved (of 32) |
| `repetition` | count | global_redeal | **15.00x** | 15 / 6 | 10 of 42 moved (of 56) |
| `alliteration` | count | global_redeal | **5.00x** | 45 / 13 | 6 of 18 moved (of 36) |
| `Kalevala alliteration (weak)` | count | global_redeal | **5.00x** | 45 / 13 | 12 of 36 moved (of 72) |
| `Kalevala alliteration (strong)` | count | global_redeal | **15.00x** | 15 / 4 | 7 of 28 moved (of 56) |
| `semirhyme` | local_fraction@2 | global_redeal | **infx** | 1 / 0.5 | 5 of 47 moved (of 72) |
| `light rhyme` | local_fraction@2 | line_final_permutation | **9.50x** | 0.826087 / 0.217391 | 10 of 29 moved (of 60) |
| `mosaic rhyme` | count | within_line_shuffle | **7.57x** | 53 / 26 | 4 of 60 moved (of 72) |
| `compound / phrasal rhyme` | count | within_line_shuffle | **3.29x** | 23 / 12 | 8 of 74 moved (of 96) |
| `internal rhyme` | local_fraction@0 | line_final_permutation | **1.48x** | 0.0296712 / 0.0240577 | 13 of 62 moved (of 84) |
| `cross rhyme` | count | global_redeal | **2.00x** | 12 / 11 | 3 of 16 moved (of 16) |
| `interlaced rhyme` | count | line_permutation | **1.30x** | 60 / 58 | 2 of 21 moved (of 28) |
| `linked rhyme` | count | line_permutation | **3.00x** | 3 / 2 | 1 of 20 moved (of 20) |
| `anaphora` | count | global_redeal | **5.50x** | 11 / 5 | 6 of 35 moved (of 56) |
| `epistrophe / radif` | local_fraction@2 | line_final_permutation | **1.67x** | 0.333333 / 0.2 | 6 of 6 moved (of 8) |
| `monorhyme / leash` | count | within_line_shuffle | **22.33x** | 268 / 41 | 9 of 42 moved (of 112) |
| `chain rhyme (rap)` | local_fraction@2 | line_permutation | **1.38x** | 0.696093 / 0.65407 | 7 of 72 moved (of 108) |
| `cynghanedd groes o gyswllt` | count | line_final_permutation | **infx** | 1 / 0 | 1 of 3 moved (of 4) |
| `cynghanedd sain` | count | global_redeal | **3.40x** | 17 / 8 | 7 of 18 moved (of 36) |
| `cynghanedd sain gadwynog` | count | global_redeal | **3.33x** | 20 / 10 | 8 of 18 moved (of 36) |
| `cynghanedd sain lafarog` | count | global_redeal | **1.47x** | 87 / 73 | 7 of 18 moved (of 36) |
| `cynghanedd sain drosgl` | count | line_final_permutation | **1.38x** | 95 / 74 | 6 of 14 moved (of 28) |
| `cynghanedd lusg` | count | within_line_shuffle | **infx** | 3 / 2 | 3 of 18 moved (of 24) |
| `pantun ABAB` | count | global_redeal | **2.83x** | 17 / 14 | 20 of 32 moved (of 32) |

## ADMISSIBLE — rule shape only (12)

These cleared their null **only on slices where the schema does not claim the
tradition**. Doctrine 43: the RULE SHAPE matched and the tradition did not.
They are evidence the predicate has bite; they are NOT evidence the relation
belongs to the text it fired on.

| schema | statistic | null | lift | observed / null max | rows clearing |
|---|---|---|---:|---|---|
| `assonance` | count | global_redeal | **1.55x** | 93 / 84 | 1 of 36 moved (of 48) |
| `consonance` | local_fraction@2 | line_final_permutation | **2.40x** | 0.222222 / 0.166667 | 4 of 42 moved (of 56) |
| `cluster consonance / skothending span` | local_fraction@2 | within_line_shuffle | **infx** | 1 / 0.25 | 2 of 29 moved (of 60) |
| `additive rhyme` | count | global_redeal | **1.78x** | 32 / 29 | 3 of 32 moved (of 48) |
| `syllabic rhyme` | local_fraction@2 | global_redeal | **infx** | 0.833333 / 0.375 | 7 of 41 moved (of 84) |
| `leonine rhyme` | count | global_redeal | **13.00x** | 13 / 3 | 2 of 15 moved (of 20) |
| `head rhyme (positional)` | local_fraction@2 | within_line_shuffle | **1.11x** | 0.104938 / 0.099631 | 1 of 49 moved (of 72) |
| `symploce` | count | global_redeal | **infx** | 1 / 0 | 5 of 9 moved (of 24) |
| `analysed rhyme` | local_fraction@2 | line_final_permutation | **1.83x** | 0.144737 / 0.131579 | 3 of 36 moved (of 72) |
| `monai` | count | global_redeal | **2.47x** | 37 / 32 | 3 of 58 moved (of 108) |
| `Scots vowel-length rhyme (Aitken's Law)` | local_fraction@2 | line_final_permutation | **infx** | 0.75 / 0.25 | 9 of 42 moved (of 84) |
| `incremental repetition` | count | global_redeal | **infx** | 2 / 0 | 3 of 12 moved (of 16) |

## What did NOT clear, and the difference between the three ways of not clearing

**SWEPT, BELOW OR AT CHANCE (10)** — measured and did not beat their own null:
`parechesis / general consonance`, `pararhyme`, `reverse rhyme`, `subtractive
rhyme`, `apocopated rhyme`, `enjambed rhyme`, `epanalepsis`,
`dvitiyakshara-prasa`, `cynghanedd draws`, `Middle Chinese end rhyme (同用
group)`.

**SWEPT, NULL NEVER MOVED (3)** — `rhyming reduplication`, `ablaut
reduplication`, `exact reduplication`. Every null in their menu is the
identity map for their statistic, so the count CANNOT FAIL (doctrines 63/68).
That is not a weak result, it is **no result**: an instrument that cannot come
out low has not been tested.

**NO INSTANCE (8)** — fired nowhere on any of the nine slices. A fact about
these texts, not about the schema.

## The reading I would not want quoted without its caveats

- `internal rhyme` clears at **1.48x** on `local_fraction@0` under
  `line_final_permutation` — the schema whose 18,290 instances on 200 lines of
  Poe started this whole null layer, and which read **0.897, BELOW chance**, on
  `count`. The arc is real and it is also an argmax over statistic and null:
  the count still does not clear.
- Five in-tradition rows sit under 1.5x — `internal rhyme` 1.48, `cynghanedd
  sain lafarog` 1.47, `chain rhyme (rap)` 1.38, `cynghanedd sain drosgl` 1.38,
  `interlaced rhyme` 1.30. Against 58.7 expected false clears these are the
  rows most likely to be among them.
- Four rows report `lift infx` because the null max is 0. That is a real
  separation and an unbounded ratio; the GAP (+1, +0.5) is the honest figure.
- **`epistrophe / radif` clears on 6 of 6 moved rows, but on ONE slice (fas).**
  A clean sweep of a small denominator.

## What this licenses, and what it does not

It licenses **step 3** — routing schemas into the mandate — for the 25
in-tradition rows, and licenses nothing for the 21 that were swept and did not
clear. The 12 rule-shape rows are a separate question: they may be admitted as
PREDICATES without any claim that the tradition they name is present.

It does NOT license quoting any single lift as an effect size. Every row is a
best-of, the sweep's freedom is printed beside the finding, and the honest
summary is the pair — **217 clears, 58.7 expected**.

**AND SIX SCHEMAS WERE MEASURED OVER A COLLAPSED FRAME.** `Figure.frame` is
`stanza` on 5 schemas and `line_pair` on 1. The panel's reader drops blank
lines along with the apparatus rows, and `_stream_of` derives stanzas FROM
blank lines — so every slice is one stanza (measured: 24 lines, 0 blanks, 1
distinct stanza). Those six were quantified over a frame that could not vary.
Their rows are reported above unaltered and are the weakest in the run; the
remedy is `MISSING.md` M-39's section coordinate, which lands after this and
wants a re-run of those six.
