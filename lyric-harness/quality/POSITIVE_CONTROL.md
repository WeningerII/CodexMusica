# The positive control, and the corpus that replaces the rap arm

Two things live here. First, the answer to a question the time layer never
asked in three instrument versions: **does the phase statistic detect
periodicity when periodicity is there?** Second, the specification for the
corpus that replaces `verse.txt`, defined by the structural property under test
rather than by a genre.

Run: `python3 quality/positive_control.py` (Part A, the synthetic instrument
check) and `python3 quality/run_positive_control.py` (Parts B/D, the 律詩 arms).

**BOTH NOW HAVE A `--check` THAT CAN FAIL — ADDED 2026-08-13.** This is
doctrine 31's own instrument ("run the positive control before believing any
null"), and CLAUDE.md's reading order sends a session here first of the three.
Until this date neither file could fail: `main()` printed and returned `None`,
`sys.exit` was never called with a code, and NOTHING invoked either one — not
CI, not a test, not another module. `wiring` listed both under "one-shot
runners, standalone by design", which is discoverability, not invocation. The
doctrine that gates every null in the project rested on a command a human had
to remember to type and then read with their own eyes — and, as Part D below
records, it had been printing numbers that disagreed with this document.

Three exits, not two (doctrine 20/28): **0** pass, **1** a pinned figure moved
or a direction flipped, **2** the run could not resolve the question — for Part
A a `n_perm`/`trials` too coarse for the margins (doctrine 57), for Part D the
全唐诗 pool or the rime table being absent, which is the ordinary case off the
machine this was written on.

> ## THIS FILE IS ON THE BOUNDARY OF THE 2026-08-11 RETRACTION, and the boundary
> ## runs THROUGH it rather than around it.
>
> `RESULTS_FWER.md`'s headline is void: `rhyme_events` measured each position's
> family over band SURVIVORS (median 6–13) rather than over the comparisons
> made (89 on a quatrain, 176–265 on a sonnet), and at the honest family size
> the event set is mute on every item in this repository. Three parts of this
> document sit on three different sides of that line, and each is marked where
> it stands:
>
> | part | status | why |
> |---|---|---|
> | **Part A, the power table** | **STANDS** | `positive_control.py` imports `phase_statistic` and NOTHING else from `time_layer`. It plants events directly into a synthetic slot stream. Verified by execution: with `rhyme_events` replaced by a function that raises, the whole of Part A runs and the call count is **0** |
> | **Part A's framing — "the corrected sonnets carry 5–8 events … the top row"** | **`VOID`** | that event count is an input taken from the voided document. At the honest family size a real sonnet carries **0** events or refuses outright |
> | **Part A's Fisher pooling — p = 0.950 (k=23) and p = 0.617 (k=26)** | **`VOID`** | the 23 and 26 per-item p-values being pooled came from `analyse()` → `rhyme_events`. There is nothing left to pool |
> | **Part B, the replacement corpus spec** | **STANDS, and matters more** | it is a specification, not a measurement. Its ≥40-events-per-item constraint is now the binding one for a different reason than the one it was written for |
> | the 律詩 arms in `run_positive_control.py` | **STAND** | verified by the same execution test: `analyse` is called once, always with an explicit `events=` set built from `ltc.rhymes`, so the `events is None` branch is never taken. Call count **0** across all four arms |

## Part A — the instrument works, and it is underpowered

Every arm so far tested material where the right answer was unknown, so a null
said nothing about the instrument. `quality/positive_control.py` plants events
at a known phase in a synthetic slot stream and asks whether the layer recovers
them. It is language-agnostic by construction and needs no corpus, so it dodges
both the monoculture problem and provenance for the instrument question.

**Ceiling — a perfect signal is always detected.**

| events / slots | concentration | power |
|---|---|---|
| 8 / 65 | 1.00 | **1.00** |
| 20 / 120 | 1.00 | **1.00** |
| 40 / 240 | 1.00 | **1.00** |

**Floor — pure noise is not detected.** At concentration 0.25 (= 1/4, exactly
chance for period 4) the false-positive rate is 0.02, 0.03, 0.05 against a
declared α of 0.05. The permutation null delivers what it advertises.

**So the design is sound.** The statistic is not broken and never was.

### The minimum detectable effect — the number this project never had

Power at α=0.05, sweeping periods (2,3,4,6,8) exactly as the real layer does:

| events | slots | c=0.40 | c=0.50 | c=0.60 | c=0.75 | c=0.90 |
|---|---|---|---|---|---|---|
| **8** | **65** | 0.02 | 0.06 | 0.13 | **0.82** | 1.00 |
| 12 | 75 | 0.04 | 0.09 | 0.37 | 1.00 | 1.00 |
| 20 | 120 | 0.04 | 0.24 | 0.88 | 1.00 | 1.00 |
| 40 | 240 | 0.24 | **0.94** | 1.00 | 1.00 | 1.00 |
| 80 | 300 | **0.78** | 1.00 | 1.00 | 1.00 | 1.00 |

**EVERY CELL ABOVE REPRODUCES EXACTLY — RE-RUN 2026-08-13.** All 31 cells, to
two decimals, against a fresh `python3 quality/positive_control.py`. This is
the only table in this document that did not move (contrast Part D, below).

> **THE 0.82 IS A LUCKY DRAW, AND THE SENTENCE BELOW RESTS ON IT — REPINNED
> 2026-08-13.** Each cell is a share of 100 Bernoulli trials at a fixed seed.
> `power(65, 8, 0.75)` re-run under **ten seeds** (`trials=100, n_perm=400`)
> gives `0.68 0.72 0.73 0.74 0.74 0.74 0.77 0.79 0.80 0.82` — **median 0.74,
> and 0.82 is the MAXIMUM**. Only 2 of 10 seeds reach 0.80 at all.
>
> So the value to quote is **0.74 (0.68–0.82 over ten seeds)**; ~~0.82~~ is
> superseded and kept visible (doctrine 17). The paragraph two below, and
> CLAUDE.md's known gap 3 — *"8 events needs ~75% of an item's rhymes on one
> phase to reach 0.80 power"* — turned this one draw into a threshold
> crossing that **does not reproduce**: at 75% concentration the layer reaches
> about 0.74, not 0.80. The direction of the finding is untouched and if
> anything sharpened — 8 events is underpowered, and slightly more so than
> recorded.
>
> This is doctrine 57 one axis out. An empirical p at 1/(n+1) reports the
> resolution; a Monte Carlo power estimate quoted to two decimals reports the
> replicate count. It is also why `--check` pins **thresholds and orderings**
> here rather than the table's own numbers: a `--check` that pinned 0.82 would
> have been red on nine seeds out of ten, which is how a required check
> becomes one people delete.
>
> The other cells the check reads were swept the same way: ceiling 1.00 with
> **zero spread** across 10 seeds × 3 sizes, floor 0.00–0.08 against a declared
> α of 0.05, `c=0.60` at 8 events 0.04–0.21 (median 0.15, recorded 0.13),
> `c=0.60` at 40 events 1.00 with zero spread.

~~The corrected sonnets carry **5–8 events over 60–75 slots** — the top row.~~
**`VOID` 2026-08-11: 5–8 events is the count at `m` = scored. At the candidate
family a corrected sonnet carries ZERO events over 58–74 slots, and 18 of 20
refuse before they get that far.** The table is unchanged and it is the row
selection that has to move: the honest question is no longer "what power do we
have at 8 events" but "what does it cost to make an event attainable at all",
and the answer to that is `null_samples` and `window`, not concentration.

At 8 events the layer needs **three quarters of an item's internal rhymes on a
single metrical phase** before it can see anything — and even there it reaches
only ~0.74 power, not the 0.80 this sentence used to imply (repinned
2026-08-13, box above). That is an enormous effect,
far larger than any real form plausibly imposes — and it was the OPTIMISTIC
reading. The pessimistic one, which is now the true one, is that a real item
produces no events for the statistic to be underpowered on.

### What this does to every null the layer has reported

**The rap arm was never testable.** One item, ~15 events, power ≈ 0.13 unless
concentration exceeded 0.75. Its p = 0.132 did not mean "no effect"; it meant
"no power". The same is true of the earlier 0.626 and 0.087. H1's positive half
was not refuted three times — it was **never once tested**, and reporting those
as failed predictions overstated what the runs could deliver.

~~**The sonnet arm is genuinely null, and now has pooled power.**~~ Combining
the per-item p-values with Fisher's method — legitimate here because each item's
KL is phase-invariant, so the p-values are comparable even though the phases are
not:

```
stress    k=23 items, median p=0.701, X2=31.4 on 46 df  ->  p = 0.950
syllable  k=26 items, median p=0.554, X2=48.4 on 52 df  ->  p = 0.617
```

~~That is the predicted null holding under a test that pools 23–26 items instead
of correcting across them.~~ Benjamini-Hochberg controls false discovery; it
never *combined* evidence, so the aggregate question had gone unasked, and
**that argument for pooling survives everything below.**

> **`VOID` 2026-08-11, on two grounds, and the second erases the first.**
>
> 1. **The p is not calibrated** (doctrine 74). Under 200 H0 replicates at the
>    real item sizes the per-item p has median 0.559, not 0.500, and pooled
>    Fisher reaches ≥0.950 in 8.5% of H0 arms rather than 5% — so 0.950 was
>    ~1-in-12. The cause is structural: rhymes arrive in PAIRS inside a window
>    while `analyse()` draws independent positions.
> 2. **There are no per-item p-values.** The `k=23` and `k=26` items were the
>    ones that survived a correction whose family was measured over band
>    survivors. At the candidate family, 18 of 20 real sonnets return
>    `cannot tell` and the other 2 return zero events. `k` is 0.
>
> "The sonnet arm is genuinely null" is now **"the sonnet arm cannot tell"** —
> doctrine 28's own distinction, applied to the arm that was citing it. What is
> NOT touched: the Fisher machinery itself, the phase-invariance argument that
> licenses it, and the observation that BH was answering a different question.
> Those are why the pooling is still the right move once the layer produces
> events again.

### The design constraint this imposes on any future corpus

**A cell needs ≥40 events per item, or pooling across enough items to reach
it.** Below that, corpus quality is irrelevant — the cell cannot answer the
question no matter how well chosen. This, not genre and not language, is what
should drive corpus selection from here.

> **AMENDED 2026-08-11, and the amendment is the operative sentence.** The
> constraint is unchanged and its binding end has moved. It was written as a
> constraint on the CORPUS: pick items that carry enough events. At the honest
> family size the English event set delivers **zero** events on a Shakespeare
> sonnet, so no corpus satisfies it — the constraint now binds on the
> INSTRUMENT first. `null_samples` and `window` decide whether an event is
> attainable at all (at `null_samples=2000` the Šidák cut is 2.5e-4 and the
> p-value floor is 5e-4; best attainable p / loosest cut is 1.7–1.8× on real
> items). Choosing a corpus before fixing those two coordinates would be
> choosing a corpus for an instrument that cannot fire on any of them.

## Part B — the replacement corpus, defined by property not genre

`verse.txt` is deleted (in copyright; see `data/sources.tsv`). Its replacement
is not "a second rap corpus", and not one tradition swapped for another. Two
errors were made in proposing that, both of them violations of doctrine 8 by
the person who wrote it down: a **single source**, and a **single language**.

The corpus is therefore defined by the property under test:

> **Forms in which sound-repetition is constrained to fixed metrical
> positions by the form itself.**

Genre is irrelevant to that. So is language — and *especially* so, because a
constraint that appears in one family and not another is exactly the kind of
finding this design exists to surface. No single tradition conceptualizes it
the same way, which is the reason to take many rather than a reason to pick one.

### Positive cells — the form mandates positional sound-repetition

| tradition | family | what the form fixes |
|---|---|---|
| dróttkvætt | Germanic (Old Norse) | skothending in odd lines, aðalhending in even, at set syllable positions |
| cynghanedd | Celtic (Welsh) | consonance and rhyme mirrored around the caesura |
| dán díreach | Celtic (Irish) | uaithne and amus at set positions |
| ghazal (radif + qafiya) | Indo-Iranian / Semitic | fixed repetend closing every line, rhyme immediately before it |
| prāsa / yamaka | Indo-Aryan (Sanskrit) | syllable repetition at fixed pāda positions |
| 律詩 regulated verse | Sinitic (Classical Chinese) | rhyme at fixed line positions, over a tonal template |
| Kalevala metre | Uralic (Finnish/Karelian) | alliteration positionally constrained inside the line |
| gabay | Cushitic (Somali) | one fixed alliterating consonant sustained across the whole poem |
| pantun | Austronesian (Malay) | abab with cross-couplet sound linking |

Nine families. The harness already ships `check_cynghanedd` and `prasa`, and
the qafiya/radif machinery is built and tested.

### Negative cells — the form mandates no positional constraint

Free verse (Whitman, already held), biblical parallelism (Hebrew, already in
`sources.tsv`), and prose. These must come out null or the statistic is reading
something other than form.

### The two blockers, stated rather than discovered later

**Phonology — THE THREE CHEAPEST ARE NOW UNBLOCKED.** `quality/phonology/`
ships `fin`, `som` and `ltc`, tested in `quality/test_phonology.py`. They were
cheap for three *different* reasons, which is why they are three
implementations and not one G2P with three tables:

| cell | why it was cheap | what it gives |
|---|---|---|
| `fin` | near-phonemic orthography, fully regular syllabification, stress fixed on syllable 1 | Kalevala alliteration, strong and weak grades |
| `som` | phonemic 1972 Latin script, (C)V(V)(C), no onset clusters | gabay higaad, measured as a share of lines |
| `ltc` | one character = one syllable, sound classes lexicalised | rhyme category (韻, 聲) and the 平/仄 binary |

Two results from building them are worth more than the code.

**Prominence is not always stress.** Somali has pitch accent and quantitative
metre, so `som` declares `grid_unit = "mora"` and **raises** rather than
returning a stress pattern. Middle Chinese has no stress at all; its binary is
平/仄, which is what the regulated-verse template constrains. Either module
could have returned a plausible-looking stress pattern and nobody would have
caught it in the numbers.

**A rime dictionary is finer than any poet worked to.** The Qieyun distinguishes
193 rhymes; Tang practice authorised 同用 groupings. On raw lookup 流 (尤) and
樓 (侯) do **not** rhyme — and they are the rhyme of 登鸛雀樓. The grouping is
load-bearing, and it is validated against canonical verse rather than trusted.

**Still blocked:** Welsh, Indic and Old Norse, exactly as gap 6 has always
said. A cell without phonology cannot be run, and listing one here is a plan,
not a capability.

**Reachability.** Measured this session: Project Gutenberg returns nothing
(blocked), GitHub *search* is scoped to this repository so it cannot discover
sources, and Hugging Face has none of these corpora. GitHub **raw** works when
an exact path is already known — `cltk/old_norse_text_perseus` resolves. So
sourcing is possible and hand-guided, and each cell needs its licence checked
separately: the medieval **texts** are public domain, but modern critical
editions and translations are not. `sources.tsv` already rejects the Sangam
Tamil dataset for precisely this — ancient PD text bundled with a living
translator's apparatus.

## Part C — sourcing, attempted

### gabay: NO ADMISSIBLE SOURCE, and the reason is structural

Searched and recorded in `data/sources.tsv` so nobody repeats it. Hugging Face
holds **30 Somali datasets and not one literary text** — all ASR/TTS audio,
Alpaca instruction translations and MT sentence pairs. Wikisource and Gutenberg
are both blocked (curl 000). GitHub search is scoped to this repository.

The interesting part is not the failed search, it is the bind underneath it:

> `som` reads the **1972** Latin orthography — that is precisely why the cell
> was cheap. The provenance cutoff is **1931**. A text old enough to clear
> provenance predates the script by 41 years and `som` cannot read it; a text
> `som` can read was written down in or after 1972.

Somali gabay was overwhelmingly **oral**. The compositions of Sayyid Maxamed
Cabdulle Xasan (d. 1920) clear the gate's death-year route, but every
1972-orthography transcription of them is a modern editorial act. This is not
the familiar old-text/new-edition trap that `sources.tsv` already flags for
Sangam Tamil — here **the writing system itself postdates the cutoff**.

It also exposes a gap in the gate: `provenance.py` keys admission on the
AUTHOR, and has no concept of an edition or transcription layer with its own
date and its own rights. For most corpora that gap is harmless. For an oral
tradition it is the whole question.

### cynghanedd: PHONOLOGY BUILT, TEXT FOUND 2026-08-10 — THIS CELL NOW RUNS

> **THE HEADING ABOVE READ "TEXT NOT REACHABLE" UNTIL 2026-08-13, AND HAD BEEN
> FALSE FOR THREE DAYS.** `data/sources.tsv:56` has read **OVERTURNED — source
> located via GITenberg** since 2026-08-10, and seven Welsh files totalling
> 8,758 lines are on disk with their own rows. The cell has RUN: Gwaith Alun,
> 1,558 lines, answers **57.1%** in search mode against a 200-shuffle null max
> of **21.8%** — **+35.3 pp, p at the 0.005 floor** — and Twm o'r Nant's
> cywydd **46.2%** against a null max of 26.9%. Both measured 2026-08-13 at
> the script's full n=200.
>
> THE PARAGRAPHS BELOW ARE KEPT (doctrine 17) BECAUSE THEIR CHANNEL MAP IS
> STILL CORRECT — Hugging Face really does hold no strict metre. What was
> wrong was the conclusion drawn from it, and doctrine 49 names the error:
> a sourcing failure is a claim about the network at a moment, and this one
> was re-run and fell. The route nobody had tried was GITenberg over
> `raw.githubusercontent.com`, which answers 200.
>
> ONE BELIEF IN THIS SECTION IS THE REASON THE ORIGINAL SEARCH FAILED, and it
> is stated below as if it were a fact: that GitHub search "is scoped to this
> repository". It is not — `search_repositories` and `search_code` query all
> of GitHub. `data/sources.tsv:56` records this as the single wrong belief
> that cost the search.
>
> STILL GENUINELY BLOCKED, and recorded where it belongs rather than here: no
> cerdd-dafod treatise, no Welsh PROSE negative arm, and the hymn and
> medieval-cywydd corpora (`data/sources.tsv:271`, `:272`).

Cynghanedd is the cell that would matter most, because its constraint is
**internal to the line** rather than line-final — the one thing every control
this project can currently reach lacks (see Part D, arm C1).

**The corpus is blocked.** *(Superseded — see the box above.)* Hugging Face
holds 25 Welsh datasets and no strict
metre; the Hub's own full-text search on `cynghanedd englyn cywydd` returns
empty; PyPI has no such distribution; 16 GitHub raw probes 404; Gutenberg and
Wikisource are **403 CONNECT policy denials**, confirmed in the proxy relay log
rather than inferred. The closest miss is `openai/welsh-texts` — CC-BY-SA-4.0,
National Library of Wales authorised — and it is **prose**: a 1716 history and
a biographical dictionary, 3 GB of page scans.

**The phonology is now built anyway**, because the blocker was never
difficulty. `quality/phonology/cym.py` handles the eight digraphs
(ch dd ff ng ll ph rh th) that are single consonants, the diphthongs,
penultimate stress, and implements croes / traws / sain on Welsh units.
Splitting `ll` into two /l/ would corrupt every consonant skeleton in the
language *and still look plausible*, which is precisely why this could not be
approximated with an English G2P.

**And it exposed a defect in the existing checker.**
`lyric_harness.check_cynghanedd` has existed since the first commit and builds
its skeleton with `word_syllable_map` — CMUdict. It checks the **rule shape
against English phonology** and has never read a word of Welsh. The seven rule
errors CLAUDE.md credits to it are real findings about the rules; they are not
findings about Welsh.

So the state is: capability unblocked, corpus unreachable. The moment any
Welsh strict-metre text arrives — a licence conversation, a manual paste — the
cell runs.

### 律詩: SOURCED AND VALIDATED — this is the cell that runs

`chinese-poetry/chinese-poetry`, already on disk from the earlier label work.
MIT on the compilation; the verse is 8th–13th century and long out of any term.
Two separable layers, and only the outer one is licensed.

Validated against the form with `quality/phonology/ltc.py`. Filtering 全唐诗 to
poems of eight uniform lines of five or seven characters:

| | |
|---|---|
| poems checked | 253 |
| rhyme agreement at mandated positions (lines 2,4,6,8) | **88.1%** |
| character coverage by the rime table | **99.3%** |

> **THE SIBLING ARM MOVED 2026-08-13, AND THIS ONE WAS NOT RE-MEASURED.**
> `quality/audit_tang_null.py`'s 300-poem arm — Part D arm A, not this table —
> now reads **90.0%** agreement (recorded 88.0%) and **12848/12864 = 99.9%**
> coverage (recorded 99.3%). The rime table reads 68 characters it could not
> read when those figures were written.
>
> This table is the **253-poem** arm and reproducing it needs the filter that
> produced 253, which the runner's `limit` argument does not express. So the
> 88.1% and the 99.3% here are **NOT VERIFIED, NOT REFUTED** — the honest third
> state (doctrine 28), and the direction of the sibling arm's movement suggests
> both would rise rather than fall if run. What is certain is that the coverage
> figure this table shares with its sibling, 99.3%, is stale in the sibling and
> is unlikely to be current here.
>
> The residue argument below is unaffected either way: it is about WHICH pairs
> fail (通押 pairs the 平水韻 standard later separated), not about how many.

**The 11.9% residue is diagnostic, not noise, and it is not being tuned away.**
Every recurring failure is a documented **通押** pair — adjacent rhymes Tang
poets used together that the 13th-century 平水韻 standard later separated:

```
庚 / 青    停/生/傾/聲,  星/驚/縈/行
支 / 微    幃/遲/滋/悲
魚 / 虞    符/書/書/胡
上 / 去    喜/翠/異/志   (same 支 group, different tones)
```

Plus fragments: one "failure" is titled 句, which means *fragment* and is not a
complete poem. Loosening the grouping to absorb these would raise the number by
fitting the reference table to the data, which is the same error as tuning a
threshold to a result. 88.1% is a **measurement of how closely Tang practice
matches the standard that codified it centuries later** — the exact analogue of
the sonnet battery's Early Modern residue, named rather than removed. (That
residue was quoted here as 11.6%; corrected 2026-08-10 to **7.2%** — the old
figure divided by the 1064 MANDATED pairs while 50 of them were refusals the
harness declined to judge. See RESULTS_BAND.md.)

## Part D — Part B run on the real corpora

`python3 quality/run_positive_control.py`, on 300 全唐诗 poems of eight uniform
lines of five or seven characters. Grid unit **syllable**, because one
character is exactly one syllable and the grid is therefore perfect. Periods
swept (2,4,5,7,10,14) — a 5-character couplet is 10 syllables, a 7-character
couplet is 14.

**REPINNED 2026-08-13 — three of the four arms had drifted, and this table was
never told.** The row that matters is arm A: its 264/36 is the same statistic
`quality/audit_tang_null.py` repinned to **90.0%** (= 270/300) on 2026-08-13
when that file was wired into CI. That file found the drift, was corrected, and
this table's copy of the identical number was left standing — doctrine 58 one
axis out, a count is a coordinate of the rime table, and two documents quoting
it drift independently. Superseded values kept visible (doctrine 17).

| arm | n | refused | sat | median p | sig | Fisher |
|---|---|---|---|---|---|---|
| **A** mandated rhyme, lines 2/4/6/8 | **270** ~~264~~ | **30** ~~36~~ | 10.0% | 0.000 | **270/270** ~~264/264~~ | **0** |
| **B** internal, line-finals excluded | 300 | 0 | 50.0% | **0.543** ~~0.529~~ | **15/300** ~~18/300~~ | **0.923** ~~0.883~~ |
| **C1** same positions, rhyme NOT required | 300 | 0 | 10.0% | 0.000 | **300/300** | **0** |
| **C2** rhyming, positions randomised | **270** ~~264~~ | **30** ~~36~~ | 10.0% | 0.584 | **14/270** ~~15/264~~ | **1** |

**No conclusion in this Part changes.** Arm A is still unanimous, C1 still
matches it exactly, and B and C2 are still null — which is why `--check` pins
the *shape* (n / refused / saturation, all exact functions of the corpus and
the rime table) as numbers, and holds the *p-values* to directions only. The
median p and Fisher figures above ride a seeded permutation draw at
`n_perm=2000`; pinning them to three decimals would witness `n_perm` rather
than the effect (doctrine 57), which is the same reasoning
`quality/audit_time_pooled_null.py` applies to the pooled-Fisher calibration.

> **AND UNTIL 2026-08-13 THIS ARM COULD NOT REPORT ITS OWN DRIFT.**
> `run_positive_control.py`'s `main()` returned `None`, `sys.exit` was never
> called with a code, and nothing invoked it — `quality/audit_tang_null.py`
> imports `tang_poems` from it, which is import reachability, not invocation
> reachability. The four arms had no automated caller of any kind, so the run
> above exited 0 while printing numbers that disagreed with this table.
> `--check` now exits 1 when the shape moves or a direction flips, and **2 —
> CANNOT TELL** when the 全唐诗 pool or `data/qieyun_mc.tsv` is absent. That
> third exit is the ordinary case off this machine: the pool is an absolute
> path outside the repository, and `ltc.py::_load_table` returns an empty dict
> rather than raising when the rime table is missing — so before this change,
> **an absent corpus rendered as `med_p= nan / Fisher_p= n/a` and exit 0**,
> which is a corpus that is not there reported as a result (doctrine 20/28).

### Arm A passed, and C1 shows the pass was tautological

Arm A is unanimous — every one of **270** (~~264~~, repinned 2026-08-13) poems
significant, Fisher p = 0. It
establishes something real and something the project had never had: **the
plumbing works on natural non-English text.** A stream built by `ltc` rather
than CMUdict, indexed, run through the statistic and its permutation null, on
1,200-year-old verse.

It establishes **nothing about rhyme**, and C1 is why. Drop the rhyme
requirement — take every line-final of lines 2/4/6/8 whether or not `ltc` says
they rhyme — and the result is *identical*: 300/300, Fisher p = 0. Arm A's
p-value is carried entirely by **line length**. Every second line-end in an
isosyllabic form is periodic whether or not anything rhymes there.

That is the H3 tripwire from `TIME_PREREGISTRATION.md`, and it bites **harder
in Chinese than in English**. English sonnets are isosyllabic but not
iso-*stress*-count, so line-final position varies on the stress grid and the
English `against_all` control came out null. In Chinese, one character is one
syllable, so the degeneracy is exact and total.

C2 is the control that behaves: keep the rhyme, randomise the positions, and it
goes to Fisher p = 1. The same number of events placed at random detects
nothing. Between C1 and C2 the attribution is unambiguous — **position, not
rhyme**.

### Arm B is the real question, and it replicates the English null

With the guaranteed line-final periodicity excluded, internal rhyme placement
in Tang regulated verse shows **no periodic structure**: **15/300** at α=0.05,
Fisher p = **0.923** (~~18/300, 0.883~~, repinned 2026-08-13). The null is
unchanged and marginally stronger.

That is the Chinese analogue of H1, and it agrees with the English sonnet arm
(Fisher p = 0.950, k=23). **Two language families, two unrelated prosodic
systems, same answer.** Forms fix sound-repetition at line ends; they do not
additionally organise internal rhyme against a period. This is the
cross-family replication the corpus specification was built to get, and the
answer it returns is negative in both cells.

Saturation in arm B runs at 50% — Chinese rhyme categories are coarse (58
groups), so half of all positions share a category with something. That is high
but under the 0.75 ceiling, and it is a property of the writing system's rhyme
inventory rather than of the verse.

### What Part D changes

The layer now has a validated non-English path and a second family reporting
the same null. What it still does not have is a cell where the *mandated*
constraint is internal rather than line-final — which is exactly what
dróttkvætt, cynghanedd and gabay would have supplied, and all three remain
blocked. Until one of them is sourced, every positive control available to this
project is positional by construction, and its passing says only that the
instrument runs.

## Part E — the sourcing round, six cells in parallel

Six independent sourcing units, each returning a `data/sources.tsv` row rather
than a conclusion. Four found admissible text, two did not, and the two
failures are as informative as the finds.

| cell | outcome | scale |
|---|---|---|
| Persian ghazal | **FOUND** `kavehbc/hafez`, MIT + author d.1390 | 495 ghazals, radif visible in **297** |
| Finnish Kalevala | **FOUND** `GITenberg/Kalevala_7000`, PD both routes | **22,795 verse lines**, 81.3% alliterate *(REPINNED 2026-08-13 from 22,822 / 81.2%)* |
| Finnish SKVR | already held; row sharpened | 87,898 poems / 1,305,915 lines |
| Sanskrit | **FOUND** DCS, **CC BY 4.0** | 270 texts; yamaka sarga complete |
| Old Norse | **CONTESTED** `sagadb.org`; Háttatal **blocked** | 1,228 lines / 814 blocked |
| Irish | **FOUND at n=1** | one 1655 poem, 42 quatrains |
| Malay | **NOT FOUND** — network, not rights | target identified exactly |

### The channel map was wrong, twice

Both corrections came out of the parallel round and neither was the thing being
looked for.

**`git clone` of any public GitHub repo works.** I briefed all six agents that
only raw fetches work and search is scoped. A whole repository is fetchable
from its *name*, without knowing paths — verified directly.

**Gutenberg is mirrored on GitHub as `GITenberg`, and GitHub is reachable.**
`gutenberg.org` is 403 at the gateway;
`raw.githubusercontent.com/GITenberg/<slug>_<PGID>/master/<PGID>-8.txt` is 200.
This **directly overturns a NOT-FOUND row this project had already written**:
the Finnish Kalevala was recorded as unreachable and is now fetched, 636 KB,
validated at 81.2% alliteration. Every earlier search that failed *because
Gutenberg is blocked* should be re-run through it — including Welsh.

### Two finds that change what the layer can test

**Sanskrit gives explicit half-verse boundaries.** DCS marks `sent_counter` and
`sent_subcounter` per line, so pāda boundaries are machine-readable. That is
exactly what the Irish cell lacks — there the quatrains are flattened into one
string and must be re-segmented by syllable count before anything internal can
be scored.

**Old Norse holds the best positive control this project has found, and cannot
use it.** Háttatal is 814 lines, all dróttkvætt, and it ships *Snorri's own
worked examples of the two hendings* — a 13th-century built-in ground truth for
an internal-constraint detector. It is blocked on Guðni Jónsson's 1935–54
edition. Finnur Jónsson (d. 1934) would clear it outright and exists only on
hosts the gateway denies.

### Two orthographic traps, both caught before use

Both are the same shape as the Somali bind and neither was predicted:

- **Old Norse modernised Icelandic inserts epenthetic `-ur`** (`Lætr` →
  `Lætur`), which breaks the six-syllable dróttkvætt line and makes hending
  positions unrecoverable. 5,270 lines rejected on that basis.
- **Irish `text_standard`** carries modernised spelling that destroys the
  orthographic rhymes. Present in the same file as the usable text.

And one bind that did **not** apply: Malay Rumi orthography *predates* the
cutoff (Wilkinson 1904, van Ophuijsen 1901), so unlike Somali there is a
genuine pre-1931 pantun collection in a readable script. Wilkinson & Winstedt
1914 is identified precisely and is purely egress-blocked. One URL would
convert it.

### Order of work

1. **Part A is done** and it gates everything: the instrument is sound, and the
   binding constraint is events per item, not corpus choice.
2. ~~**Phonology before corpora.**~~ **DONE for the cheapest three** —
   `fin`, `som`, `ltc`. Welsh, Indic and Old Norse remain blocked.
3. **Pooling before more items.** Fisher across items is already implemented in
   this document's Part A analysis and recovers most of what n=1 threw away.
4. **律詩 first**, because it is the only cell currently sourced, phonology-clean
   and provenance-clean at once — and pooling across thousands of poems is what
   defeats the events-per-item constraint from Part A.
5. Then the remaining positive cells, in family order, each with its own
   provenance row. gabay is **blocked, not pending**: see Part C.
