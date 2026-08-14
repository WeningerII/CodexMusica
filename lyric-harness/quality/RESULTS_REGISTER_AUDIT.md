# RESULTS — the register, audited

**Adversary 5/6.** Written 2026-08-11 against the repo as it stands at
`1e035cb`. Instrument: `quality/audit_register.py`. Every number below carries
the command that produces it; where a claim cannot be re-derived the verdict is
`UNVERIFIABLE`, not silence and not a restatement of the register.

Four adversaries existed before this one. Nulls attack our RESULTS,
`revise.py` attacks the WRITING, `redteam_band.py` attacks the CODE's
generosity, `mutate.py` attacks the TESTS. Nothing attacked the RECORD.

```
python3 quality/audit_register.py            # consistency + cheap derivations + provenance
python3 quality/audit_register.py --slow     # + corpus-scale derivations
python3 quality/audit_register.py --consistency   # arithmetic only, sub-second
python3 quality/audit_register.py --check    # committed figures only (added 2026-08-14)
```

> ## ⚠ READ §8 FIRST. THIS DOCUMENT IS A 2026-08-11 MEASUREMENT AND MOST OF IT
> ## NO LONGER REPRODUCES.
>
> Re-run 2026-08-14. **Sections 2, 3, 5 and 6 have all moved**, several of them
> completely: all ten consistency checks now pass where eight failed, three
> `CONFIRMED` rows have gone `MOVED`, and the provenance headline — *"117 with
> NO external citation (100%)", "publication-year tokens: 0"* — is now 113 (97%)
> and 23. The entries were rewritten between the two dates, which is the right
> direction; nobody re-ran the file that described them.
>
> **Nothing below this banner has been deleted.** The 2026-08-11 text is the
> record of what was true then, and §8 is the delta, per doctrine 17. Where a
> specific line was materially misleading it is struck in place and dated.
>
> The instrument now has a **`--check`** (exit 0 pass / 1 a figure moved / 2
> cannot tell), which is what should have caught this three days ago.

---

## 0. THE HEADLINE: a doctrine whose evidentiary number reproduces nowhere

**Doctrine 70 is right and its evidence is not measurable as stated.**

Doctrine 70 argues — correctly, and it is one of the better arguments in
`CLAUDE.md` — that the 1900 Straits Rumi spelling must NOT be modernised,
because Malay /u/ and /i/ lower to [o] and [e] in a final closed syllable, so
the old spelling writes the surface form that rhyme is a fact about. To show
the orthography is internally consistent it offers a measurement:

> word-final `-ung` occurs 0 times and `-uk` 0 times, against **14 and 12
> distinct `-ong` and `-ok` types**

That measurement appears in three places in this project and has a different
value in each, and a fourth value when re-run:

| where | `-ong` | `-ok` | unit |
|---|---|---|---|
| `CLAUDE.md` doctrine 70 | 14 | 12 | distinct types |
| `MISSING.md` M-3, "Known answers unmoved" | 28 | 14/15 | types |
| `corpus/song/msa_skeat_pantun.txt` header | 25 | 24 | tokens |
| **measured 2026-08-11** | **38 tokens / 26 types** | **28 tokens / 15 types** | both |

```
python3 quality/audit_register.py --only "M-3 / doctrine 70"
```

Three documents, three answers, one measurement, and none of them is the one
you get by counting. Only the ZEROS reproduce — `-ung` 0 and `-uk` 0 over the
513 verse lines of the staged file — and the zeros are what the argument
actually rests on, so **doctrine 70's conclusion survives and its comparison
figure is unsupported by anything on disk**. It is quoted as evidence three
times and has never been re-derived once.

This is doctrine 58 turned on the doctrine file: a bare n with no stated
tokenisation is a coordinate of a setting nobody wrote down. `M-3` even says
so, in the same sentence that gets the number wrong — *"the count is a
coordinate of the tokenisation — doctrine 58"* — and then quotes a bare count.
The fix is not a number. It is that a figure cited as evidence for a doctrine
must name the rule that produced it, and none of these three do.

**Second, smaller instance in the same file.** Doctrine 88 restates M-2's
"**23** are recoverable by an 異體字 map" and lists seven arrows and an
ellipsis. M-2 lists nineteen. See §2, check C3: 23 is wrong in both places and
the correct figure is 19.

---

## 1. THE CALIBRATION SET

A register auditor that cannot rediscover the four known-false entries is not
working. All four are recovered, and **one of them recovers with the opposite
verdict from the one on file.**

### 1.1 · M-3's `384 of 471` — RE-FOUND, and the entry's own correction stands

`quality/audit_register.py --consistency`, check **C1**:

```
[FAIL] C1   M-3/M-4  do two figures sharing a denominator exceed it?
       300 + 384 share denominator 471 and sum to 684
```

Found from the prose alone, in under a second, with no corpus loaded. This is
the check that should have run before either entry was written.

### 1.2 · M-4's Finnish numbers — ~~CONFIRMED to the token, by arithmetic~~ **MOVED, re-measured 2026-08-14**

> **SUPERSEDED 2026-08-14. This section is kept because it is what a correct
> derivation looked like, and because it is the row that moved.** `j. n. e.` now
> occurs **9** times, not 8 — a third file, `fin_wahanen_laulukirja.txt`, has
> entered the corpus — so the arithmetic below gives **18** tokens, not 16, and
> the split is 7/1/1 rather than 7/1 across "the two Kanteletar files". D7's
> verdict is `MOVED`. §8.2.

M-4 corrects "13" to **16 unreadable tokens** and says the mechanism is that
`e` in `j. n. e.` is readable while `j` and `n` are not. Re-derived:

```
python3 quality/audit_register.py --only M-4
  CONFIRMED  D7  M-4  Finnish j. n. e.
    8 occurrences: {'fin_kanteletar.txt': 7, 'fin_kanteletar_uudempia.txt': 1};
    at 2 vowelless tokens each (j, n -- e is readable) that is 16 tokens
```

8 stub lines · 2 tokens each = **16**, exactly as corrected, and split 7/1
across "the two Kanteletar files", exactly as claimed. The corrected Finnish
row is the best-evidenced quantitative claim in section M.

### 1.3 · M-4's Malay row — **THE WITHDRAWAL IS FALSE. The row was right.**

This is the finding of the round.

M-4 declares the Malay row false and strikes it through:

> `d. s. b.` occurs **zero times** in `corpus/song/msa_skeat_pantun.txt`, the
> only Malay file in the repo. The recorded `b`(101)/`d`(100)/`s`(99) =
> "300 of 471" reproduce exactly — as **tokenizer artifacts of the file's own
> annotation lines**

Both halves fail.

**(a) The zero is true of the wrong file.** `d. s. b.` does occur zero times in
the staged extract — I reproduce that. But the staged extract is **129 blocks,
513 verse lines, 2,113 tokens**, and M-3, three paragraphs above, names its own
population as **"PG47873's 330 Malay verse blocks (3,415 lines, 15,519
tokens)"**. Those are not the same corpus and cannot be. The extract is one
seventh the size. The file M-3 and M-4 both measured is `47873-8.txt` — 1.4 MB,
31,086 lines, 705 indented verse blocks, 5,555 verse lines, the file
`data/sources.tsv` row `GITenberg/Malay-Magic_47873` describes and the file the
staged extract was cut from. In **that** file:

| | measured |
|---|---:|
| `d. s. b.` occurrences (regex `\bd\.\s*s\.\s*b\.`) | **108** |
| of those, inside indented verse lines | **99** |
| of those, LINE-FINAL — the stub position M-4's own table asserts | **95** |
| single-letter verse tokens `b` / `d` / `s` (apostrophe kept) | **107 / 102 / 108** |

```
python3 quality/audit_register.py --only M-4     # section 3 · POPULATION
```

99 line-final stubs × 3 vowelless tokens each (`d`, `s`, `b`) = **297**, against
the recorded **300**. That is the *identical arithmetic* that confirms the
Finnish row in §1.2 — 8 stubs × 2 tokens = 16 — applied to the language M-4
struck out.

**(b) The replacement mechanism does not reproduce.** M-4 attributes the 300 to
`--- RIME:` and `--- SOURCE:` annotation lines, "129 times each". Both counts
are right (129 and 129, measured). But tokenising the staged file gives
**b 130, d 1, s 5** — the 130 is the `B` hemistich label in `--- RIME: A … | B …`,
and there is no `d`- or `s`-producing annotation at all. The proposed mechanism
accounts for one of the three counts and gets the other two wrong by two orders
of magnitude. It was never checked.

**(c) The shipped code already disagrees with the register.**

```
python3 quality/audit_register.py --only M-4
  FALSE  D9  M-4  CHORUS_STUB_FORMS
    CHORUS_STUB_FORMS declares [('eng', '&c. / etc. (et cetera)'),
                                ('fin', 'j. n. e. (ja niin edelleen)'),
                                ('msa', 'd. s. b. (dan sebagainya)')]
```

`lyric_harness.CHORUS_STUB_FORMS` carries the Malay row, with the right gloss
(*dan sebagainya*, "and so forth") and an anchored line-final pattern. The code
implements the finding the register withdrew.

**(d) And the arithmetic never required withdrawing it.** M-3's own corrected
table bills the apostrophe rule **76**, not 384, and puts the `b`/`d`/`s`
tokens in a separate row labelled *"ingestion, elsewhere"* — which is exactly
what a `d. s. b.` stub is. 76 + 300 + 77 = 453, inside 458. **There was never a
contradiction between the corrected M-3 and M-4. The only false number was
M-3's 384, which M-3 itself corrects.** The contradiction 384 + 300 > 471 was
read correctly and then resolved against the wrong entry, and 300 tokens of a
real, cross-linguistically parallel finding were struck out as collateral.

Doctrine 79's lesson, one layer further up than the sentence M-4 wrote to state
it: *reproducing a number checks the arithmetic of the computation, never the
construction of the population* — and **substituting a population is not a
refutation either.**

### 1.4 · The `test_fwer.py` double-report — CONFIRMED at commit level

M-4a records that four `test_fwer.py` failures were twice reported as
"pre-existing, confirmed at clean HEAD", against a HEAD that already contained
the change under test. Verifiable without running anything:

```
git show 6c265ad:lyric-harness/lyric_harness.py | grep -n theta_coda   # 0.60
git show b1d7f64:lyric-harness/lyric_harness.py | grep -n theta_coda   # 0.80
git diff --stat 6c265ad b1d7f64 -- lyric-harness/quality/test_fwer.py  # empty
```

`b1d7f64` changes `theta_coda` 0.60 → 0.80 and does **not** touch
`test_fwer.py`. Any baseline run at `b1d7f64` or later contains the change; the
clean baseline is its parent `6c265ad`. The claim is sound and the commit pair
is now on the record so the next person does not have to find it again.

---

## 2. NEW INTERNAL-CONSISTENCY FAILURES

`python3 quality/audit_register.py --consistency` — no corpus, no imports,
sub-second. Six of the ten checks fail on prose alone.

### C2 · M-3's CORRECTED table does not sum to its own corrected total

```
components before 458 vs stated total 458;
components after  386 vs stated total 384
```

2 + 306 + 78 = **386**. The row below says **384**. Three lines later the same
paragraph gives "read 15,135 / refused 78 / defective 306", and 78 + 306 = 384,
15,135 + 384 = 15,519 — self-consistent. So the table's `after` column
double-counts the 2 surviving apostrophe fragments, or the total omits them,
and the entry does not say which. **A 2-token error introduced by the correction
that fixed a 5× one, in the column written to demonstrate care.**

### C3 · M-2 claims 23 recoverable, lists 19, and 23 + 5 > 24

```
claims 23 of 24 recoverable and lists 19 arrow pairs; 23 + 5 = 28
against a population of 24
```

The enumeration is right — 19 arrows + "the remaining five (怎 樣 褪 做 你)" = 24.
The summary integer is wrong. **This is the M-3/M-4 shape exactly, one section
earlier, and nobody added it up there either.** It has propagated: `CLAUDE.md`
doctrine 88 restates the 23. Correct value: **19**.

### C4 · K-1 quotes two of five statuses as if they partitioned

```
142 SOURCED + 70 NOT_FOUND = 212 against a stated population of 220
(8 rows carry a third status)
```

Both figures are individually CONFIRMED (`--only K-1`, D10). The remaining 8
are 4 `COMPOSER_NOT_LYRICIST`, 3 `NOT_SOURCED`, 1 `CONTESTED`. Doctrine 79 asks
for three counts, always; this is the same failure at the corpus-status layer.

### C7 · K-6 says four text files and names five

`cym_alun_strict.txt`, `cym_twm_or_nant_cywydd.txt`, `fin_kalevala.txt`,
`fas_hafez.json`, `san_dcs_verse.txt`.

### C8 · M-1's false-verdict denominator is larger than its own population

```
the entry says 'False at mandated positions' and then divides by 26773,
while its own mandated-position count is 15887 F -- the denominator
exceeds the population by 10886
```

"the top 30 pairs carry 34% of 26,773 false verdicts" cannot be a share of
False-at-mandated-positions, because there are 15,887 of those. It is presumably
mandated + control positions pooled, but the entry never says. **A percentage
whose denominator exceeds the population it claims to partition** — the check
that caught 684 > 471, pointed at one entry instead of two.

### C9 · N-1's excess column is off by 0.1 in two of seven rows

```
Twm o'r Nant cywydd:      51.3 - 36.5 = +14.8, table says +14.7
Twm o'r Nant cerdd rydd:  28.4 - 17.5 = +10.9, table says +10.8
```

Rounding, not substance — and the two wrong rows are the two the entry
describes in prose as "the graded middle … at +10.8, about half", so the wrong
figure is the quoted one.

### C10 · N-1 concludes "the effect goes to zero" over a row at p = 0.015

Welsh hwiangerddi: excess over null **max** −0.2, and p = **0.015** against the
null distribution. Those are two different questions in one row, they disagree,
and the entry's conclusion — *"the effect goes to zero off the strict metre"* —
follows only from the first. Doctrine 57's neighbour: an excess-over-max and a
distributional p are not interchangeable, and reporting both without noting
that they point opposite ways lets the reader take whichever supports the
sentence.

### Checks that PASS

- **C5** K-1's repeat blocks: 1603 + 604 + 247 = 2454 ✓
- **C6** K-6's language table: 279 staged + 13 refused + 5 blocked = 297 ✓

---

## 3. DERIVATIONS

`python3 quality/audit_register.py --slow`. 26 claims; each row's command is in
the runner output.

### CONFIRMED — reproduces at the stated value

| id | entry | claim | measured |
|---|---|---|---|
| D1 | K-1 | 5,006 English songs | 5006 |
| D3 | K-1 | 1,603 BURDEN / 604 REFRAIN / 247 CHORUS | exact |
| D4 | K-1 | 143 authors | 143 |
| D7 | M-4 | Finnish `j. n. e.` on 8 stub lines → 16 tokens | 8 / 16 |
| D10 | K-1 | 142 SOURCED, 70 NOT_FOUND, 220 eng rows | exact |
| D11 | K-5 | 18 Somali poets, 13 REFUSED_DATE, 5 BLOCKED_ORTHOGRAPHY | exact |
| D14 | M-2 | 魂 unlookupable; 477 chars carry it; 58 rhyme labels | exact |
| D15 | M-2 | 諄 真 殷 桓 戈 in `_LEGACY_GROUPS`, absent from the data file | all 5 |
| D16 | E-1 | ternary cell space 27, of which 8 named | 3³ = 27, 8 |
| D17 | C-1 | 2^(n−1): 64 at 7, 256 at 9, 255 variants | exact |
| D18 | E-5 | `now ~ why` scores 0.902 and types RHYME | 0.902 RHYME |
| D19 | doctrine 94 | `five/of` passes at nucleus 0.603 vs 0.600 | 0.603, by 0.003 |

Two caveats inside CONFIRMED rows. **D14**: 魂/477/58 are exact, but the entry's
"58 rhyme labels × 4 tones" is not the table's cardinality — the realised
label × tone cells number **197**, not 232, and the entry's own comparison
("not the 193 the docstring cites") is against a figure closer to 197 than
either. **D19** confirms the loosest threshold in the harness is still loose,
which is the point of recording it.

### MOVED — real, and the number has changed

| id | entry | register | today | what moved it |
|---|---|---|---|---|
| D2 | K-1 | 154,346 sung lines | **154,334** | the counting rule is not stated; mine is non-blank lines that are not `#`, `---` or `[` |
| D6 | A-1 | 941 chorus stubs | **777 eng** (818 all langs) | `is_chorus_stub` has tightened, or "the staged corpus" meant a different set; three rules give 776 / 777 / 918 and none gives 941 |
| D12 | K-6 | 297 non-English lyricists, "every row PENDING_TEXT" | **319**; ltc 59→76, cym 35→40; **33 PENDING_TEXT and 47 SOURCED** | rows landed; the sourcing round succeeded and the entry did not follow |
| D13 | K-6 | 18 century-only bounds across cym/som/san | **68** across six languages (san 36, som 15, non 13, cym 2, fas 1, msa 1) | more rows, more guessed lives |
| D20 | F-1 | "eight phonologies, and English is not one" | **nine**, and `eng.py` exists | commit `c74fb48`, "declare English as the ninth phonology" |
| D21 | M-15 | `traditions` populated on **ZERO** | **75 of 77** populated, 298 distinct Tradition rows | commit `e4cc054`. See §5 — the fix propagated an unsourced canon into executable code |
| D22 | M-16 | 1,325 lines, no caller, no `__main__` | **1,326** lines, still no `__main__`, callers `test_relations.py` and `relations.py` | line count is a coordinate of the counting convention; the knowledge-set idea was mined as M-16 proposed |
| D23 | L-5 | `CLAUDE.md` carries 76 numbered items | **102** | L-5's own complaint, worse: the drift it names has continued and its number is stale |
| D26 | M-3 / doctrine 70 | `-ong` 14–28 types, `-ok` 12–15 | 38 tokens / 26 types; 28 / 15 | §0 |

### FALSE — does not reproduce, mechanism named

| id | entry | why |
|---|---|---|
| D8 | M-4 | `d. s. b.` occurs **108** times in the population M-3 names, 99 in verse, 95 line-final. §1.3 |
| D9 | M-4 | `CHORUS_STUB_FORMS` ships the Malay row the register struck out. §1.3(c) |

### UNVERIFIABLE — the repo does not hold what the claim needs

| id | entry | claim | what is missing |
|---|---|---|---|
| D5 | K-1 / M-11 | 331 of 5,006 songs carry a named air (6.6%) | **there is no `--- AIR:` field.** Markers present: TITLE, SOURCE, SECTION, JUAN, AUTHOR, SYLLABLES, RIME, FROM, NOTE. The air lives inside free-text TITLE strings under at least two conventions; the nearest mechanical rule gives **318**. M-11 calls this "the field this whole round was chasing" and M-8 faults Welsh editions for not printing one — and our own corpus does not declare it either |
| D24 | M-4 | all ten `fin_*` 155 → 139 unreadable | the module's own tokenizer and `readability_census` give **139,506 tokens and 689 unreadable** — two orders off. No tokenizer, no reason-code filter, no population stated |
| D25 | N-2 | cym reads five Welsh files at **100.00%**, 0 unreadable in 29,571 | ~~**`cym` exposes no `readability_census`**, unlike `msa` and `fin`, so read/refused/defective cannot be separated. Under the module's own `WORD_RE` the five files give 29,714 tokens and 271 that `syllabify()` declines (bare `--` runs, proclitic fragments `F'`, `'N`). A bare 100.00% is not checkable without the three counts doctrine 79 requires~~ — **FALSE SINCE 2026-08-11, CORRECTED 2026-08-14. `cym.readability_census()` has existed since commit `b609ba0`** (the cell that gave Welsh a `rhymes()` predicate), and `MISSING.md` N-2 was told — its own body reads `CLOSED 2026-08-11: cym.readability_census() exists`. The register was updated and the instrument auditing the register was not. Both figures were also wrong: **29,569 tokens / 126 declines**, not 29,714 / 271. See §8.3 |
| — | M-1 | 47.4% on 1,518 ci, 14,302 T / 15,887 F / 724 refused | `data/qindingcipu_ge.tsv` holds 2,333 rows; the 817 per-詞牌 files and the 1,518 matched ci are not on disk. Internally the T/F/refused triple is coherent — 14,302/(14,302+15,887) = 47.37% ✓, and it correctly excludes refusals from the denominator (doctrine 79 applied). Only C8's denominator fails |
| — | M-3 | 458 / 384 / 15,519 / 330 blocks / 3,415 lines | measured over PG47873, which is **not in the repository**. It is on this machine at `/workspace/mm47873/47873-8.txt`; nothing in the repo points at it and `.gitignore` does not reach it |
| — | N-3 | 131/129 vs 82/80, 705 blocks, 5,555 lines | 705 blocks / 5,555 lines re-derive **exactly** from PG47873 (same caveat). The 131/129 and 82/80 depend on a function-word list N-3 itself says nobody wrote down |
| — | M-9, M-10, M-12, M-13 | egress probes, GITenberg enumeration, EPUB contents | network state at a moment, and files outside the repo. Doctrine 49 already says a sourcing result is a claim about the network at a moment; these rows are correctly dated and correctly unverifiable later |

---

## 4. POPULATIONS: three sizes for one corpus, in one section

The M-3/M-4 error was never arithmetic. Section M quotes **three incompatible
sizes** for "the Malay corpus", in adjacent entries, without ever saying that
they are different objects:

| | blocks | verse lines | tokens | where |
|---|---:|---:|---:|---|
| `corpus/song/msa_skeat_pantun.txt` (in the repo) | **129** | **513** | **2,113** | measured |
| M-3's stated population | 330 | 3,415 | 15,519 | `MISSING.md` M-3 |
| N-3 / `data/sources.tsv` | **705** | **5,555** | — | re-derives exactly from PG47873 |

```
python3 quality/audit_register.py --only M-4     # section 3 · POPULATION
```

The runner reports this automatically now: `INCOMPATIBLE sizes quoted for the
Malay corpus: blocks [330, 705]; lines [3415, 5555]`. The staged file's own
census, for the record, is **2,113 tokens / read 2,101 / refused 10 /
defective 2** — three counts, as doctrine 79 asks.

**The generalisable rule.** Every n-of-N in this register needs its population
named as precisely as doctrine 58 says it needs its threshold named. "The only
Malay file in the repo" and "PG47873's Malay verse blocks" differ by a factor
of seven, and one of them was used to refute a measurement taken on the other.

---

## 5. TASK 2 — every named entry, and whether the only witness is us

`python3 quality/audit_register.py --provenance`

### What the repository contains

```
RHYME_CANON.md: 117 named structures, 117 with NO external citation (100%)   <- 2026-08-14: 113 (97%)
publication-year tokens in the whole 94 KB file: 0                           <- 2026-08-14: 23
every `from:` line indexes a six-agent survey array: 611 references
   {'X': 187, 'S': 125, 'G': 94, 'E': 73, 'I': 68, 'C': 64}                  <- holds; 654 multi-line
relations.py: 77 schemas, 75 carry traditions,
              75 of those cite ONLY R<n> pointers back into RHYME_CANON.md   <- holds
```

> **SUPERSEDED 2026-08-14 — and this is the one direction of drift to be glad
> of.** The §4b repair (`quality/canon_index.tsv`, 601 declared indices) did not
> exist when this was written and now resolves **116 of 117** named structures
> to a witness outside this project. The sentence below — *"from inside the
> repository, the citation graph is closed"* — was true on 2026-08-11 and is
> false now. Nothing here is struck, because it is the correct record of the
> state that motivated the repair. §8.4.

- **117 named canon entries. 611 provenance references. Zero publication years
  in 94 KB.** Every `from:` line resolves to a cell index — `✓E1`, `C22`,
  `X110` — into a survey array that **is not in the repository**.
- **`relations.py` hangs 298 distinct `Tradition` rows off 77 schemas, 319
  attachments, and every single `Tradition.source` is an `R<n>` pointer back
  into `RHYME_CANON.md`.** Not one cites anything outside this project.
- Two schemas carry no tradition at all: `blues AAB stanza`,
  `refrain by reference`.

So **from inside the repository, the citation graph is closed.** A reader who
clones this repo can resolve exactly none of the 611 references, and every
tradition scoping in executable code terminates in a document that cites
nothing datable.

### What is one hop outside it, and this must not be overstated

The survey **does** survive — in the six inventory agents' transcripts under
`/root/.claude/projects/.../workflows/wf_c1e2a9c5-60b/`. **578 named entries**
are recoverable from them, and most carry a `source` string naming something
real: 詞林正韻 via ctext.org, `cls.lib.ntu.edu.tw 唐詩入門`, Snorri's own
Háttatal prose, Turco's list, Wikipedia/en-academic, Turkish school taxonomy.
The canon is one hop from evidence. **The hop lands outside the repository and
outside anything a future reader inherits**, in a session store that no clone,
no checkout and no `git log` will ever contain.

### The `gabay higaad` class — the deliverable

Names whose **every** recorded source is this project (a `quality/phonology/*`
module, a `CLAUDE.md` doctrine, or the author's memory). The test errs toward
"external": any mention of a web host, a year, `WebSearch`, `Snorri`,
`Háttatal` or `standard` counts a source as external.

```
Finnic vowel-initial alliteration class
Hindi anuprās subtypes
Kalevala weak alliteration
Malay reduplication
Thai named rhyme faults
Welsh orthographic substrate: the eight digraphs, the elision apostrophe, the gwant
anaphora
chan (ฉันท์) quantitative template
cynghanedd in English (Hopkins's imitation)
end rhyme
epistrophe
hā-yi ghayr-i malfūẓ as rawī (the silent-h dispute)
khlong tone-mark constraint
qaṣīda monorhyme
refrain / burden / chorus
repetend
repetition (same-word rhyme)
syair monorhyme quatrain
同用 / 通押 — rhyme-group merging
```

**and `gabay higaad` itself**, which has no survey entry at all — RHYME_CANON.md
§0 records that Somali appears in no inventory cell and that the name entered
the canon from repo doctrine alone.

Two of these say it in their own source string, and both are worth quoting:

- `chan (ฉันท์) quantitative template` — *"quality/phonology/san.py (guru/laghu);
  **Thai chan from memory**"*. `C-2` already declares the rule: `register_named()`
  REFUSES an entry without a source, *because a catalogue written from memory is
  unsourced data in the evidence base*. This is that, admitted in the record, in
  a file that has no such gate.
- `hā-yi ghayr-i malfūẓ as rawī (the silent-h dispute)` — *"the prosodic dispute
  is **MY characterisation**"*.

**I have not guessed a source for any of these.** An honest "unsourced" is the
deliverable; a plausible fill is the `gabay higaad` error repeated.

### Why this got worse, not better

M-15 asked for `RelationSchema.traditions` to be populated, and warned in its
own text: *"Inventing a language scope from the schema NAMES would be
guessing."* It was populated (D21, commit `e4cc054`, message: "75 of 77
traditions **sourced**"). The scoping was not invented from names — it was
taken from `RHYME_CANON.md`, which is better. But "sourced" is the wrong word
for a pointer into a document with zero publication years whose own §0 states
that its Norse, Persian, Sanskrit, Tamil, Chinese and Malay entries were
*"reconstructed from the repository's own `quality/phonology/*` modules and
CLAUDE.md doctrine … therefore not independent of the code they were meant to
critique."*

**298 Tradition rows now scope 77 executable schemas to traditions, on a
citation chain that ends inside the modules being scoped.** That is
`gabay higaad` promoted from a footnote in one document to a field on every
schema in a production module. It is not a reason to unpopulate the field — the
rule shapes are right and M-15 was a real gap. It is a reason for
`Tradition.source` to hold what the survey entry actually cited, and for
`RHYME_CANON.md` to inline those source strings before the transcripts are
garbage-collected, at which point the provenance of 117 named structures is
gone for good.

---

## 6. WHAT THIS AUDIT DID NOT CHECK

```
python3 quality/audit_register.py --coverage
  70 entries, 70 carry numbers, 661 numbers in total
  entries with a derivation or a consistency check: 19 of 70
```

**Every one of the 70 entries carries at least one number, and 51 of them have
no check at all.** 26 declared claims and 10 consistency checks reach 19
entries. So this pass touched roughly a quarter of the register's entries and a
much smaller share of its 661 numbers. Not audited, and the reason in each case:

- **B-1, B-2** (Forte set classes, n-TET dyad counts) — pure combinatorics with
  nothing in the repo to run them against. The dyad counts are internally
  consistent (C(12,2)=66, C(19,2)=171, C(24,2)=276, C(31,2)=465) and 208 Forte
  classes is not re-derived here.
- **L-1 through L-4, K-3, and doctrine 4's whole time-layer block** — these are
  `NULL_AUDIT.md`'s territory and re-running them means re-running the nulls.
  Adversary 1's ground, not adversary 5's.
- **N-4, N-5, M-14** (Sanskrit and Persian) — the corpora are present
  (`corpus/san_dcs_verse.txt`, `corpus/fas_hafez.json`) and the derivations are
  minutes of compute each. The next round of this file should add them; the
  arithmetic inside them already checks out (27.75 − 9.68 = 18.07 ✓;
  90.8/36.4 = 2.49 ≈ "2.5×" ✓; Ḥāfiẓ 60.2 None + 38.8 True + 1.0 False = 100 ✓,
  which agrees with doctrine 59 independently).
- **M-4a's four-row table** — re-deriving it means running `test_fwer.py` at two
  commits, which is the one thing §1.4 shows was done wrong before. It should be
  done properly, with `6c265ad` named as the baseline, and it was not done here.
- **The 941 / 331 / 155 figures** are marked MOVED or UNVERIFIABLE above rather
  than chased to a rule that reproduces them, because inventing a tokenisation
  that lands on a recorded number is exactly the tuning doctrine 58 forbids.

---

## 7. WHAT SHOULD CHANGE

1. **Reinstate M-4's Malay row** and withdraw the withdrawal. Proposed text is
   in the patch that accompanies this file. The `d. s. b.` finding is real,
   cross-linguistically parallel to the Finnish one, already implemented in
   `CHORUS_STUB_FORMS`, and was struck out by a population substitution.
2. **Every n-of-N gets its population, not only its threshold.** Doctrine 58
   says write the setting next to the number. Section M shows the setting is
   not enough: three entries quote three sizes for one corpus. The population
   is a coordinate too.
3. ~~**`cym` needs a `readability_census`.** `msa` and `fin` have one and their
   claims are checkable; `cym`'s 100.00% is not, and the missing function is
   the whole difference.~~ **CLOSED — it was already closed when this line was
   written.** `cym.readability_census()` landed in commit `b609ba0` on
   2026-08-11, the same day this file was written, and `MISSING.md` N-2
   recorded it. The item stood open for three days because the instrument that
   raised it never re-asked. Measured 2026-08-14 through the census: **29,443
   read / 0 refused / 126 defective of 29,569** — the three counts doctrine 79
   asks for, so the `100.00%` is checkable now and reads **99.57%**. §8.3.
4. **Declare the air field.** `--- AIR:` as a marker would make K-1's 331 and
   M-11's 0-of-8,009 re-derivable. Right now the rarest field in the corpus is
   the one field the corpus does not declare.
5. **Inline the survey's `source` strings into `RHYME_CANON.md`**, and put the
   real citation in `Tradition.source` instead of an `R<n>` pointer. The
   transcripts are not backed up by anything this project controls.
6. **Fix the three propagated integers**: M-2's 23 → 19 (and doctrine 88's),
   M-3's after-column 386 vs 384, and doctrine 70's `-ong`/`-ok` figures — or
   delete the figures and keep the zeros, which is what the argument needs.
7. **Run `quality/audit_register.py --consistency` before committing a change to
   `MISSING.md`.** It costs under a second and it is where five of the seven
   findings in this file came from.

---

## 8. RE-RUN 2026-08-14 — the auditor of the record had no check on its own record

Everything above was measured on 2026-08-11 at `1e035cb`. Nothing re-ran it for
three days. This section is what reproduces today, with every superseded value
kept visible and dated (doctrine 17).

**The finding is the shape, not any one row.** This instrument is CLAUDE.md's
adversary 8 — *"the one that found four false entries in a week: 1–7 all attack
the WORK and nothing attacked the RECORD of it"* — and it was the last member of
its family with no `--check`. Six siblings were closed this session
(`audit_spans`, `audit_corpus`, `audit_tang_null`, `audit_kalevala_null`,
`canon_sources` twice, `audit_hafez_radif`) and every one had printed its own
drift and exited 0. **This one is not quite that shape, and the difference is
worse.** Its exit code *is* meaningful and it has been exiting **1** the whole
time — on D8/D9, a standing calibration pair nobody intends to clear this week.
So there was a signal, it was red, it was red for a reason unrelated to drift,
and it never moved. Meanwhile every drift this instrument can detect lands in
`MOVED`, and `MOVED` deliberately does not fail the run. A number that has been
1 since the file was written is not a signal: **six derivation verdicts changed
and eleven rows' printed figures moved** beneath it, and it never budged.

### 8.1 · Consistency: eight of ten failed, none fails now, and one has gone inert

| | 2026-08-11 (§2) | 2026-08-14 |
|---|---|---|
| C1 M-3/M-4 shared denominator | **FAIL** `300 + 384 share 471, sum 684` | `ok` — the 384/471 claim is withdrawn in place |
| C2 M-3 corrected table | **FAIL** `after 386 vs stated 384` | `ok` — and both columns moved: `471`/`394`, not `458`/`384` |
| C3 M-2 enumeration | **FAIL** `claims 23, lists 19` | `ok` — the entry now says 19; item 6 below, half done |
| C4 K-1 status partition | **FAIL** `142 + 70 = 212 vs 220` | `ok` — the entry now states its population as 211 |
| C5 K-1 repeat blocks | ok `1603 + 604 + 247 = 2454` | `ok` — but the figures moved to `1592 + 604 + 247 = 2443` |
| C6 K-6 language table | ok `279 + 13 + 5 = 297` | `ok`, unchanged |
| C7 K-6 file enumeration | **FAIL** `says four, names five` | `ok` — the entry now says five |
| C8 M-1 false-verdict denominator | **FAIL** `26,773 against a population of 15,887` | **`n/a`** — see below |
| C9 N-1 excess column | **FAIL** two rows off by 0.1 | `ok`, 7 rows |
| C10 N-1 null direction | **FAIL** a row at p = 0.015 | `ok` |

**§2's own header is wrong, and it is the shape this file audits.** It says
*"Six of the ten checks fail on prose alone"* and then enumerates **seven**
failing sections (C2, C3, C4, C7, C8, C9, C10), with C1 failing in §1.1 and only
C5/C6 listed as passing — **eight** of ten. A summary integer that contradicts
its own enumeration is check C3's exact defect, committed one section later by
the file that reports C3.

**C8 IS THE ONE THAT MATTERS, AND THE EXIT CODE CANNOT SEE IT.** `n/a` means
`_chk_m1_false_verdict_denominator` no longer finds its own subject: M-1 has
been reworded and the `of N false verdicts` regex matches nothing. `main()`
scores `None` as neither pass nor fail, so **a check can go permanently inert
and the run stays exactly as green as if it had passed.** Whether M-1's
contradiction was *fixed* or merely *reworded past the detector* is not
something this instrument can tell, and it must not read silence as a pass
(doctrine 20/28). `--check` pins the ten outcomes **positionally**, so `n/a` is
now a committed state that has to be argued rather than a hole.

### 8.2 · Derivations: six verdicts changed, and more figures moved than verdicts

| id | 2026-08-11 | 2026-08-14 | |
|---|---|---|---|
| D1 K-1 English songs | CONFIRMED 5,006 | **MOVED** | register now 4,993, measured **4,930** — both sides moved and they still disagree |
| D2 K-1 sung lines | MOVED 154,346 → 154,334 | **MOVED** | register now 153,534, measured **152,313** |
| D3 K-1 repeat blocks | CONFIRMED 1,603/604/247 | **MOVED** | register 1,592/604/247, measured **1,580/601/247** |
| D4 K-1 authors | CONFIRMED 143 | CONFIRMED 143 | holds |
| D5 K-1/M-11 named airs | UNVERIFIABLE | UNVERIFIABLE | still no `--- AIR:`; the marker list itself moved — `SECTION`, `JUAN`, `SYLLABLES`, `RIME` are gone, `SPLIT` is new. Nearest rule still 318 |
| D6 A-1 chorus stubs | MOVED 777 eng / 818 all | **MOVED** | 777 eng / 33 cym / 14 fin = **824** all |
| **D7 M-4 Finnish `j. n. e.`** | **CONFIRMED**, §1.2: *"CONFIRMED to the token"*, *"the best-evidenced quantitative claim in section M"* | **MOVED** | **8 → 9 occurrences, 16 → 18 tokens.** A third file appeared: `fin_wahanen_laulukirja.txt`. §1.2 above is stale and its superlative with it |
| D8 M-4 Malay `d. s. b.` | FALSE | FALSE | holds — 108 / 99 / 95, the standing calibration pair |
| D9 M-4 `CHORUS_STUB_FORMS` | FALSE | FALSE | holds |
| D10 K-1 eng statuses | CONFIRMED 142/70, 5 statuses | CONFIRMED | **verdict holds, figures moved: 141/70, and 6 statuses** — `JOINT_ATTRIBUTION_ONLY` is new. Both sides moved together, which is exactly the case a verdict cannot report |
| **D11 K-5 Somali gate** | **CONFIRMED** 13 REFUSED_DATE / 5 BLOCKED_ORTHOGRAPHY | **MOVED** | **14 / 4** — one row crossed |
| D12 K-6 non-English table | MOVED 319, 47 SOURCED | **MOVED** | **331**, **70 SOURCED**; `fin` 14 → 26 joined `ltc` and `cym` |
| D13 K-6 century-only | MOVED 68 | MOVED 68 | holds, same six languages |
| D14 M-2 qieyun | CONFIRMED | CONFIRMED | holds; the row now also reports 窗 absent / 窓 present |
| D15 M-2 orphaned groups | CONFIRMED | CONFIRMED | holds |
| D16–D19 | CONFIRMED | CONFIRMED | all four hold, including `now~why` 0.902 and `five/of` 0.603 |
| D20 F-1 phonologies | MOVED 9 | MOVED 9 | holds |
| D21 M-15 traditions | MOVED 75/77, 298 rows | MOVED | holds; now also reports **0** of 298 cite a non-`R<n>` source |
| **D22 M-16 `rhyme_constraints`** | MOVED 1,326 lines, **no `__main__`**, 2 callers | **MOVED** | **1,612 lines, `__main__` PRESENT, 3 callers** (`counters.py` joined). All three fields moved again |
| **D23 L-5 doctrines** | **MOVED** 76 → 102 | **CONFIRMED 95** | the verdict flipped the good way: the 2026-08-11 doctrine split landed and the counter was rebuilt to read both files between the markers |
| D24 M-4 Finnish census | UNVERIFIABLE 139,506 / 689 | UNVERIFIABLE | **145,280 total; 144,562 read / 567 refused / 151 defective** — and see §8.3, the single figure was a doctrine-79 collapse |
| **D25 N-2 Welsh readability** | **UNVERIFIABLE** on a premise that was already false | **MOVED** | §8.3 |
| D26 M-3 / doctrine 70 | MOVED 38/26, 28/15 | MOVED | holds — the headline in §0 is the one part of this file that reproduces intact |

### 8.3 · Doctrine 79 — the instrument broke it twice, in its own subject

CLAUDE.md's roster gives this file **both** adversary 6 (`--provenance`, the
TAXONOMY) and adversary 8 (the RECORD). Doctrine 79 — *a REFUSAL is not a
failure, and putting it in the numerator charges the wrong layer* — is what it
audits other entries for. It was breaking it in two of its own rows, in the two
shapes two sibling lots found the same week.

**(a) `_d_cym_readability` — the bare boolean, `has_radif`'s shape.** The row
asserted *"`cym` exposes no `readability_census` … so read / refused / defective
cannot be split"* and then computed `if not C.syllabify(w): bad += 1` — **one
bit for a three-state question.** It answered the question it had just declared
unanswerable, with the wrong arity, and returned `UNVERIFIABLE` on the strength
of it. `cym.readability_census()` has existed since commit `b609ba0`,
**2026-08-11** — and `MISSING.md` N-2 *knew*: its body reads `CLOSED
2026-08-11: cym.readability_census() exists`. The register was corrected and
the instrument that audits the register was not.

Its two figures were wrong as well, and the mechanism is doctrine 58 one axis
out. `cym.WORD_RE` admits `'` and `-` because both occur inside Welsh words, so
it also matches a run of bare punctuation — the gwant `--`, a lone elision
apostrophe — as if it were a word. **Every caller inside `cym.py` drops those
with `if w.strip("'-")`; this file did not**, so it counted 145 punctuation runs
*both* as tokens *and* as declines:

| | tokens | declines |
|---|---:|---:|
| ~~this file, 2026-08-11 (private tokenizer + `syllabify()`)~~ | ~~29,714~~ | ~~271~~ |
| **the module's own tokenizer + `readability_census`, 2026-08-14** | **29,569** | **126** |

145 tokens and 145 declines, the same 145. And the split the row said was
impossible is **0 refused / 126 defective**, all `vowelless_token` — so the
`100.00%` is checkable now and reads **99.57%** (29,443 read of 29,569).

**(b) `_d_fin_census` — `Fallback.three_counts`' shape, charging the wrong
column.** `fin.readability_census` returns read / refused / defective as three
counts *precisely so they are never summed*, and this row did
`unread += c["refused"] + c["defective"]` and printed the one number. Measured:
**567 refused, 151 defective.** So 567 correct refusals — the phonology
declining to read a non-initial opening diphthong, which is a *decision* — were
being charged to the same column as 151 genuine defects, at a ratio of nearly
4:1. Both rows now report three counts and never sum them.

*(A third, milder instance in the footer: `main()` printed
`consistency failures + FALSE derivations: N`, one integer over two questions,
so `2` could not be told from one of each. Split; the exit code stays a single
non-zero.)*

### 8.4 · Provenance and coverage

| §5 headline | 2026-08-11 | 2026-08-14 |
|---|---|---|
| named structures | 117 | 117 — holds |
| with NO external citation | ~~117 (100%)~~ | **113 (97%)**, and the runner now says the detector reads only years and six repo names, so §4b is the repair's measure |
| publication-year tokens | ~~0~~ — *"the sharpest single finding here"* | **23** |
| `from:` references | 611 single-line | 611 single-line, **654 multi-line over 555 distinct indices** — the runner names the single-line rule as *its own* doctrine-58 error |
| schemas / traditions | 77 / 75, 298 rows, 319 attachments | holds, and now split **212 external / 26 project / 60 cannot tell** (three counts) |
| the 19-name `gabay higaad` list | 19 + `gabay higaad` | **holds verbatim** |

**§4b did not exist when §5 was written.** `quality/canon_index.tsv` — 601
declared indices, 501 external / 68 project / 32 unrecorded — now resolves
**116 of 117** named structures to a witness outside this project, against §5's
flat *"from inside the repository, the citation graph is closed."* That
sentence is now false, which is the one direction of drift this file should be
glad of. Remediation item 5 is substantially done; §5's text is not struck
because it is the correct record of the state that motivated the repair.

| §6 coverage | 2026-08-11 | 2026-08-14 |
|---|---|---|
| entries | 70 | **75** |
| numbers in total | 661 | **1,702** |
| entries with any check | 19 of 70 (27%) | **19 of 75 (25%)** |

**The audited count did not move at all.** Five entries were added, the number
count nearly tripled, and the check count is the same 19 — so coverage fell.
§6's *"51 of them have no check at all"* is now **56**.

### 8.5 · What `--check` pins, and what it deliberately does not

`python3 quality/audit_register.py --check` → **0** pass · **1** a figure moved ·
**2** cannot tell. Green as committed; **2.5 s wall / 2.5 s CPU**, measured.

It does **not** inherit `main()`'s exit policy, on purpose: D8/D9 will read
FALSE until M-4 reinstates the Malay row, and a gate that is red for a reason
nobody intends to fix this week is a gate people learn to skip.

**Pinned** — one-sided, repo-side facts that move only when the thing measured
moves: the `RHYME_CANON.md` detector counts (117 / 113 / 23 / 611 / 654 / 555),
the `canon_index.tsv` repair (601 rows, 501/68/32, 116/1/0), `relations.py`
(77 schemas, 75 populated, 2 bare, 298/319/212/26/60), both phonology censuses
as **three counts each** — `fin` 145,280 / 144,562 / 567 / 151 and `cym` 29,569
/ 29,443 / **0** / 126 — and the ten consistency outcomes **positionally**.
`cym_refused: 0` is pinned *because* it is zero: if a re-ingestion starts
refusing Welsh tokens the read rate slides while every other figure still
matches, which is the same call `audit_hafez_radif.PINNED` makes for its own
`refused: 0`.

**Not pinned, and these are stated rather than assumed:**

1. **There is no draw anywhere on this instrument's path** — verified by three
   consecutive runs under `PYTHONHASHSEED=random`, byte-identical. The
   siblings' clause *"pin the exact counts, leave the Monte Carlo to the printed
   p"* has no referent here, so the exclusions below take its place.
2. **The register side.** `_k1_claims` reads K-1's figures out of `MISSING.md`
   at runtime, by design — its docstring says a transcribed constant would
   compare the corpus against a number the register had already struck through
   and then name the wrong side as the thing that moved. Pinning those would
   re-introduce exactly that, so **no derivation verdict is pinned either**: a
   verdict is a comparison of two sides and one of them is meant to move as
   entries are fixed. D1/D3/D10 in §8.2 are the worked case — the register side
   moved *with* the corpus side.
3. **Anything measured over a population not in the repository.** D8's
   108/99/95 come from `/workspace/mm47873/47873-8.txt`; the provenance pass's
   *"578 entries recovered"* and its 19-name list come from agent-session
   transcripts under `/root/.claude/projects/` (`in_repo: False`, printed on
   every run). Pinning a figure that is `UNVERIFIABLE` on a fresh clone would
   make the check a fact about one machine — **the population substitution this
   instrument exists to catch, committed by its own checker** (§4's own rule).
4. **`coverage()`'s `numbers_total`** (1,702). A raw count of every numeral in
   `MISSING.md`'s prose; it moves when anyone edits a sentence, and a gate that
   goes red on a typo fix is a gate people learn to skip.

**Proven red before it was trusted**, both kinds of pin, and green again on
revert:

```
[FAIL] traditions_project       committed 27, measured 26      # scalar
[FAIL] consistency C8           committed ok  , measured n/a   # positional
```

### 8.6 · Also fixed, and also this instrument's own

- **`--json` did not emit JSON.** The seven `_hr()` section rules printed to
  stdout alongside the document, so the one mode whose purpose is to be
  machine-readable failed `json.loads` at line 2. Every other print in `main()`
  was already gated on `not a.json`; the rules were not, and nothing consumed
  the flag, so nothing noticed. Gated.
- **`quality/verify_entries.py` — which *is* in CI — already shells out to this
  file** and parses its printed derivation block with `DERIV_RE`, treating an
  unparseable block as `ERROR`. Every change above is additive to that block;
  re-run after the fixes, `verify_entries.py` parses all 26 rows and exits
  `PASS`. It deliberately does not let these verdicts move its own exit code,
  so it was never going to catch the drift in §8.2.

---

## Appendix · the standard this file holds itself to

Every number above has a command. Where a claim could not be re-derived the
verdict is `UNVERIFIABLE` and the missing thing is named — a population, a
tokenisation, a census function, a file outside the repo. Nothing here is
restated from `MISSING.md` as though restating it were checking it, because
that is the error the file exists to catch.

Three places where I could be wrong, stated so the next adversary starts there:

- **§1.3 rests on identifying M-3's population as PG47873.** The identification
  is from M-3's own words ("PG47873's 330 Malay verse blocks") and from scale —
  the staged file is 129 blocks and 2,113 tokens against M-3's 330 and 15,519.
  My crude Malay-block filter on PG47873 gives 385 blocks / 3,592 lines /
  17,689 tokens, close but not exact, so the *filter* is unrecovered even though
  the *file* is not in doubt.
- **The 19 unsourced names depend on my internal/external regex**, which is
  deliberately generous toward "external". A stricter reading of "external"
  puts the figure at 65 of 578. Both are in the runner; the conservative one is
  reported.
- **D2, D6 and D24 are marked MOVED/UNVERIFIABLE under my counting rules**, not
  under the register's, because the register states none. If a rule is recovered
  that reproduces 154,346 or 941 or 155, those rows should be re-verdicted —
  and the rule written down beside the number, which is the point.
