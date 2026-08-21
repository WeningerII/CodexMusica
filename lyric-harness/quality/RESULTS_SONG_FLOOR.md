# RESULTS — the slop floor gets a song-length profile

Cell BD, 2026-08-11. Everything below is re-derivable by one command:

> **ONE CLAUSE OF THAT OPENING IS FALSE AND IS CORRECTED HERE RATHER THAN
> QUIETLY EDITED.** "Everything below is re-derivable by one command" holds
> for the calibration — the two commands under it re-derive every threshold,
> every held-out rate and every period figure in this document. It does NOT
> hold for the WORKED EXAMPLES: the before/after transcripts run on
> `examples/cherokee_bill.txt` and `examples/never_been_to_a_scene.txt`, and
> both were DELETED ON PURPOSE by commit `11aa19b` (2026-08-12, *"Remove
> Claude-authored example lyrics from the repo"*). `examples/` holds no
> tracked file today. That decision is not in question and is not being
> reversed; what had never been done is telling the record about it.
> Annotated 2026-08-21.
>
> So this document has two halves with two different standings, and the
> distinction is the point: the CALIBRATION is live and a reader can re-run
> it, while the ILLUSTRATIONS are frozen testimony — real when they were
> made, not withdrawn, and no longer checkable from this checkout (doctrine
> 17). Every command block naming an `examples/` path is a record of a run
> and not an instruction.
>
> **`quality/fixtures/anaphoric.txt` IS NOT A SUBSTITUTE.** It is 26 lines;
> `never_been_to_a_scene.txt` was 41 lines / 291 tokens. Swapping it in
> reproduces a different item, which is why `test_floor.py` §13 pins 26 lines
> and this document quotes 41. The claim the two share — that the harness's
> own showcase lyric FAILS its own gate on anaphora — is still mechanically
> pinned, by `test_floor.py` §14, on the fixture that ships.

```
python3 quality/song_profile_calibration.py            # the full report
python3 quality/song_profile_calibration.py --check    # exit 1 if floor.py has drifted
```

`corpus/song/` is volatile by design, so the runner also compares what
`quality/floor.py` ships against what the corpus says today. A number in a
module whose setting lives only in someone's scratchpad is a threshold nobody
wrote down (doctrine 58); this is the fix for that.

**UPDATE, 2026-08-13: a fifth check joined the profile.**
`predictable_pair_fraction_max` — this document's own gap list item 4 (§9) —
was withheld at first calibration because it read a frequency file this
project had already swapped out. That swap settled 2026-08-11; this update
measures the fifth threshold against the source that shipped, closing the gap
rather than leaving it open beside the other four. Every table below now
carries a `predictability` row or column alongside the original four, and the
union figures move from 17.66% to 20.79% accordingly — a fifth check joining a
union can only raise it, never lower one, so this is not corpus drift and is
not doctrine 58's failure mode. The four original numbers are unchanged
everywhere they are reported, which is itself the check that nothing else
moved.

---

## 0. The premise, verified by execution before anything was built

> **THE TWO EXAMPLE SHEETS ARE GONE FROM HEAD — ANNOTATED 2026-08-13.**
> `examples/cherokee_bill.txt` and `examples/never_been_to_a_scene.txt`, and
> the whole `examples/` directory, were deleted in commit `11aa19b`, *"Remove
> Claude-authored example lyrics from the repo; fix the CLI's apparatus-line
> gap"*, 2026-08-12. Confirmed by `ls lyric-harness/examples` → *No such file
> or directory* and `git log --diff-filter=D -- 'lyric-harness/examples/*'` →
> `11aa19b`, nothing since. **The `floor.py` invocations in §0 and §6 are
> unrunnable as written.** Recover the inputs, read-only:
>
>     git show 11aa19b^:lyric-harness/examples/cherokee_bill.txt        > /tmp/cbill.txt
>     git show 11aa19b^:lyric-harness/examples/never_been_to_a_scene.txt > /tmp/nbtas.txt
>     python3 quality/floor.py /tmp/cbill.txt
>     python3 quality/floor.py /tmp/nbtas.txt
>
> Nothing in §1–§5 or §7–§9 touches these two files — the calibration is over
> `corpus/song/eng_*.txt`, which is at head and was **not re-run here (COST)**.
> The example-dependent half is §0 and §6, and both were re-measured against
> the recovered text on 2026-08-13:
>
> | figure | verdict |
> |---|---|
> | `cherokee_bill.txt` — 28 lines, **327 tokens** | **REPRODUCES EXACTLY** |
> | `never_been_to_a_scene.txt` — 41 lines, **291 tokens** | **REPRODUCES EXACTLY** |
> | the two BEFORE blocks below (`0 flag(s), 1 note(s)` / `OUT_OF_CALIBRATED_LENGTH`) | **DOES NOT REPRODUCE, and must not** — this cell's own `song` profile is what closed it. They are the pre-fix record and doctrine 17 keeps them |
> | §6's four metric values for `cherokee_bill`: `mattr` **0.7915**, `fwr` **0.4373**, anaphora **0.2857**, `cv` **0.1355** | **REPRODUCES EXACTLY, to four places, all four** |
> | §6's four metric values for `never_been_to_a_scene`: `mattr` **0.7804**, `fwr` **0.4158**, anaphora **0.3415**, `cv` **0.2130** | **REPRODUCES EXACTLY, to four places, all four** |
> | §6's verdicts: `cherokee_bill` clear, `never_been_to_a_scene` earns `ANAPHORA_OVERLOAD` at severity flag | **REPRODUCES** |
> | §6's AFTER block, `1 flag(s), 0 note(s)` | **PARTLY** — now `1 flag(s), **1** note(s)`. The flag, its evidence and its full line list (`14 of 41`, opening `i` at 34%, lines 5, 7, 8, 14, 15, 17, 18, 19, 23, 34, 35, 37, 38, 39) reproduce **exactly**. The extra note is `PREDICTABLE_RHYME` — **the fifth check this file's own 2026-08-13 UPDATE header says joined the profile**, firing at 18 of 19 rhymes. So the AFTER block is stale by exactly one line, against an update recorded at the top of this same document, and the movement is disclosed rather than corrective |
> | `cherokee_bill` AFTER: clear on all four → now clear on **all five**, `0 flag(s), 0 note(s)` | **REPRODUCES**, and strengthens: the fifth check does not fire on it either |
> | §6's "0 of 27 and 0 of 37 normalised long lines appear in the corpus" | **NOT RE-RUN — COST.** Pinned by `test_floor.py` 17, which is not this annotation's file |
>
> **Bounded (doctrine 79):** 10 figures re-measured, 2 not run for COST. No
> calibration runner (`song_profile_calibration.py`), no test suite and no
> corpus sweep was executed — those are the expensive half and none of them
> reads the deleted files. `floor.py` on both recovered sheets: under 20 s.
>
> Every threshold, band, percentile and corpus count in §1–§5 and §7–§9 is
> therefore **unaffected by the deletion** and **unverified by this annotation**,
> which are two different statements and both are true.

The brief said the length-sensitive half of the floor never runs on a song.
Reproduced, exactly:

```
# THIS COMMAND CANNOT RUN FROM A CLEAN CHECKOUT — the lyric was
# deleted by 11aa19b (see the note at the top of this file). What
# follows is the recorded output of the run, not an invitation.
$ python3 quality/floor.py examples/cherokee_bill.txt        # BEFORE
examples/cherokee_bill.txt — 1 section(s)
=== [(untitled)] 28 lines, 327 tokens
SLOP FLOOR — 0 flag(s), 1 note(s)
  [NOTE] OUT_OF_CALIBRATED_LENGTH: 327 tokens is outside every calibrated
         length; the length-sensitive checks did not run

# THIS COMMAND CANNOT RUN FROM A CLEAN CHECKOUT — the lyric was
# deleted by 11aa19b (see the note at the top of this file). What
# follows is the recorded output of the run, not an invitation.
$ python3 quality/floor.py examples/never_been_to_a_scene.txt   # BEFORE
=== [(untitled)] 41 lines, 291 tokens
SLOP FLOOR — 0 flag(s), 1 note(s)
  [NOTE] OUT_OF_CALIBRATED_LENGTH: 291 tokens ...
```

The brief's figures reproduce to the token: 41 lines / 291 tokens and 28 lines
(327 tokens; the brief gave only the line count for that one). So did the
corpus figures — `corpus/song/eng_*.txt` is **143 files, 143 distinct
`# author:` headers, 4,930 `--- TITLE:` items, 152,325 sung lines**, counted
under `quality/counters.py`'s stated rule. Nothing in the register needed
correcting.

**One thing the brief did not say, and it makes the hole bigger.** Neither
example sheet carries `[section]` markers, so `floor.sections()` returns ONE
section for each and the whole sheet went in as a single unit. A sheet that
*does* carry markers is split into 20-60-token sections, which land in the
`section` profile or in nothing — so the sonnet-and-quatrain pair had no
reading of a song at either unit. Both units are covered now (§6).

---

## 1. The band, and why it is 150–400 tokens

The rule was declared before its answer was read off (it is the module
docstring of `song_profile_calibration.py`):

> (i) every 50-token sub-bin inside `[lo, hi]` holds ≥ 100 items — a 5th
> percentile needs somewhere to sit (doctrine 72); (ii) every sub-bin's own
> threshold sits within 0.02 of the band-wide one (0.03 for anaphora, which is
> one line's worth on a 33-line item and the coarsest that statistic
> resolves) — a threshold that moves across its own band is two profiles
> reported as one, which is the defect doctrine 15 names; (iii) the band is the
> WIDEST contiguous range satisfying both.

The rule returns **150–400 tokens: 1,859 items over 108 authors**. It is not a
choice; the sweep is printed and the neighbours fail for stated reasons:

| band | n | verdict |
|---|---:|---|
| 50–400 | 4122 | no — sub-bin 50–100 `mattr` 0.6475 vs band 0.6837, \|d\| 0.0362 |
| 100–400 | 3103 | no — sub-bin 100–150 `mattr` 0.6687 vs band 0.7066, \|d\| 0.0379 |
| **150–400** | **1859** | **OK** |
| 150–450 | 1966 | no — sub-bin 400–450 `mattr` 0.7474 vs band 0.7244, \|d\| 0.0230 |
| 200–400 | 1162 | OK, but narrower |
| 200–500 | 1345 | no — sub-bin 450–500 has n=74 < 100 |
| 100–800 | 3494 | no — sub-bin 100–150 `mattr` \|d\| 0.0406 |

The drift the rule is refusing, measured on the song corpus and reported here
because it is doctrine 15's first independent confirmation outside the sonnets:

| tokens | n | `mattr` p05 | `fwr` p95 | anaphora p95 | `cv` p05 |
|---|---:|---:|---:|---:|---:|
| 50–80 | 506 | 0.6400 | 0.5049 | 0.3938 | 0.0895 |
| 80–110 | 796 | 0.6492 | 0.4898 | 0.3529 | 0.1051 |
| 110–150 | 961 | 0.6821 | 0.4783 | 0.3182 | 0.1019 |
| 150–200 | 697 | 0.7179 | 0.4716 | 0.3000 | 0.1074 |
| 200–250 | 439 | 0.7191 | 0.4728 | 0.3165 | 0.1147 |
| 250–300 | 333 | 0.7271 | 0.4831 | 0.2881 | 0.1181 |
| 300–350 | 234 | 0.7318 | 0.4645 | 0.3044 | 0.1114 |
| 350–400 | 155 | 0.7384 | 0.4696 | 0.2815 | 0.1310 |
| 400–500 | 181 | 0.7492 | 0.4645 | 0.2708 | 0.1241 |
| 500–700 | 170 | 0.7318 | 0.4816 | 0.2784 | 0.1340 |
| 700–1200 | 87 | 0.7719 | 0.4543 | 0.2171 | 0.1389 |

`mattr`'s low tail moves **0.132** across that range and its median moves
0.022 (0.8069 → 0.8294) — so the level is nearly flat and the TAIL, which is
what a threshold is, is not. Anaphora's 95th percentile falls monotonically
with length, which reproduces METHOD doctrine 15's sonnet-vs-quatrain ordering
(0.286 vs 0.500) on a corpus that shares nothing with it.

---

## 2. The thresholds, and their held-out false-positive rate

**Shipped, 150–400 tokens:**

| | `mattr_min` | `function_word_ratio_max` | `anaphora_max` | `line_length_cv_min` | `predictable_pair_fraction_max` |
|---|---:|---:|---:|---:|---:|
| song profile | 0.7226 | 0.4716 | 0.3000 | 0.1123 | 0.9286 |
| (sonnet, for contrast) | 0.7557 | 0.4788 | 0.2857 | 0.0939 | 0.8333 |
| (section, for contrast) | 0.7568 | 0.5161 | 0.5000 | 0.0525 | — |

`predictable_pair_fraction_max` calibrated 2026-08-13, once known gap 4 (below)
closed: `predictability` reads the frequency layer this project swapped
2026-08-11 (`data/opensubtitles_en_50k.tsv` via `Lexicon.freq_rank`), and this
is the first measurement of it against the new source at song length.

**The split, declared: BY AUTHOR.** 108 authors in the band, 50/50, 200 seeds.
Items by one author are not independent of each other, so an item-level split
scores a cell with a resource that is not independent of it (doctrine 13). The
item split was run anyway and is reported below purely to price what the wrong
one would have bought.

**The false-positive rate, which is the statement of the threshold (doctrine
22 — a percentile on a scale is not one).** Median over 200 seeds, with the
5th–95th percentile of seeds, because one seed is a coin flip reported as a
verdict (doctrine 73):

| check | AUTHOR-held-out FPR | item-held-out FPR |
|---|---|---|
| `LEXICAL_MONOTONY` | **5.43%** [1.51 – 11.07] | 4.97% [3.29 – 6.97] |
| `FUNCTION_WORD_HEAVY` | **5.23%** [1.86 – 10.64] | 4.87% [3.46 – 6.54] |
| `ANAPHORA_OVERLOAD` | **5.01%** [1.44 – 11.15] | 4.59% [3.56 – 6.29] |
| `UNIFORM_LINE_LENGTH` | **5.13%** [3.04 – 7.81] | 5.13% [3.55 – 7.00] |
| `PREDICTABLE_RHYME` | **4.81%** [2.52 – 7.43] | 4.64% [3.44 – 6.24] |
| **union of the five** | **20.79%** [12.57 – 29.43] | 19.34% [16.62 – 22.48] |
| (union of the four, for contrast) | (17.66%) [10.78 – 25.58] | (16.17%) [13.50 – 18.92] |

**The headline is the union: one held-out human song in five trips something.**
Five checks at a nominal 5% do not add to 25% because they are correlated, and
they do not stay at 5% either — the interval is what a caller needs and the
point estimate is not.

**Doctrine 13's price, made numeric.** The two splits agree on the median to
within 0.5pp and disagree on the SPREAD by roughly a factor of two: the author
split's `mattr` FPR ranges 0.37%–14.61% across seeds, the item split's
1.50%–7.73%. The wrong split does not move the answer; it halves the error bar,
by letting an author's other songs vouch for this one. Anyone reporting the
item-split interval would be reporting confidence they had not earned.

**Author concentration, since the percentiles are ITEM-weighted.** Median items
per author in the band is 3; the top five authors are 51.7% of it (Watts 285,
Barnes 209, Hemans 202, Burns 145, D'Urfey 121). Leave-one-author-out moves the
thresholds by at most 0.0052 (`mattr`), 0.0018 (`fwr`), 0.0172 (`anaphora`),
0.0013 (`cv`), 0.0055 (`predictability`), so no single author is load-bearing.
An author-weighted alternative — one median per author, n=108 — gives 0.7262 /
0.4801 / 0.2679 / 0.1194 / 0.8571, so the two weightings disagree most on
anaphora. **Item-weighted ships, because the rate the gate delivers is an item
rate**, and the disagreement is recorded in the profile note rather than
resolved silently.

---

## 3. What this profile is NOT

There is **no generated song class in this repo**. So the song profile has no
AUC, no separation, and makes no claim to detect machine text. This is a
structurally weaker kind of calibration than the `sonnet` and `section`
profiles carry, and the code now enforces the distinction rather than trusting
a reader to remember it:

* `Profile.measured_auc` is `{}` and `n_generated` is 0. `test_floor.py` test
  10 fails if a profile with no negative class carries an AUC — the old
  assertion was `all(p.measured_auc for p in profiles)`, which the song profile
  could only have satisfied by borrowing the sonnet's.
* `Profile.evidence_for()` writes the right sentence into every finding: the
  sonnet profile's findings say *AUC 0.870 against the generated class*, the
  song profile's say *NO generated class exists at this length, so there is no
  AUC and no separation claim; the evidence is a false-positive rate of 5.01%
  on HELD-OUT human song … It says how often this fires on a human songwriter,
  not whether it catches a machine.*
* `banner()` prints the same thing per run, where the reader is.

`PREDICTABLE_RHYME` now runs at song length, calibrated 2026-08-13 — closing
known gap 4 (§9). It was withheld at first calibration for two reasons
stacked: doctrine 11's OOV artifact withdrew it once already, and it was
computed against `wordfreq20k.txt`, which a sibling cell replaced 2026-08-11
(`data/opensubtitles_en_50k.tsv`, via `Lexicon.freq_rank`), so a threshold
measured before that swap would have been a coordinate of a file that no
longer exists. Threshold 0.9286 (human 95th percentile), held-out FPR 4.81%
median [2.52–7.43%] — see §2's table above. The section profile still has no
reading at this check: it never measured a threshold at its own length, which
is a different cell's to move.

---

## 5·A — ADOPTED 2026-08-21: the closing sitting, and the two constants
that did not move are why it could happen at all

The profile is re-adopted over the loaded corpus. **1,297 files, 1,294
distinct authors, 8,667 items, 283,534 sung lines**; restricted to 150–400
tokens, **3,571 items over 879 authors** (~~143 files, 4,930 items, 152,325
lines, 1,859 items over 108 authors~~). Same command, same seeds, same
author-held-out protocol; a corpus 1.9× longer on lines and 8.1× on authors.

| constant | shipped | adopted | |
|---|---:|---:|---|
| band lo / hi (tokens) | 150 / 400 | 150 / 400 | unmoved |
| `mattr_min` | 0.7226 | **0.7128** | moved |
| `function_word_ratio_max` | 0.4716 | **0.4773** | moved |
| `anaphora_max` | 0.3000 | 0.3000 | **unmoved** |
| `line_length_cv_min` | 0.1123 | **0.1094** | moved |
| `predictable_pair_fraction_max` | 0.9286 | 0.9286 | **unmoved** |
| held-out FPR ANY | 20.79% | **19.71%** | moved |
| anaphora period rho / p_perm | 0.2750 / 0.0042 | **−0.008 / 0.8695** | moved |

**THE HEADLINE IS THE TWO UNMOVED ROWS, NOT THE FOUR MOVED ONES.** The
closing sitting had been deferred on one argument: adopting the thresholds
that drifted while `predictable_pair_fraction_max` still described the
143-file corpus would make this profile half a description of one corpus and
half of another (doctrine 1). That was never a claim that predictability
*would* move — it was a refusal to find out later. It re-derives to **0.9286
against a shipped 0.9286**, and `anaphora_max` to 0.3000 against 0.3000. So
the objection is answered rather than waived, and the set is adopted as a set.

**The band rule survived a corpus 1.9× longer.** 150–400 is what it returns
on 3,571 items exactly as on 1,859 — the widest contiguous range where every
50-token sub-bin holds ≥100 items and every sub-bin threshold sits within
0.02 of the band-wide one. That is the strongest evidence in this document
that the band was a property of English song and not of one anthology
sample.

**What it cost to get here, stated because it bounds the next one.** The
predictability arm is 96% of a cold run: 9,072 CPU-seconds over 8,667 items,
against 26 seconds for the four cheap features. The memo now holds 8,663
entries under fingerprint `1ca985c44f5a`, so the next re-derivation is
minutes. The fingerprint covers `lyric_harness.py`, `quality/features.py`,
CMUdict and the frequency lexicon — editing any of them discards the cache,
which is the correct direction to be wrong in.

**AND THE FIVE DECLARED DRIFTS ARE NOW SPENT.** `quality/expected_drift.py`
held a dated ruling for each of the five values above that had drifted while
the sitting was deferred. Adoption did not merely permit deleting them — it
**required** it: that reconciler fails on a declared drift that no longer
occurs, because an allowlist outliving its reason is the staleness it was
built to catch. First real use of that direction, hours after it was built.

**Not claimed.** The four moved thresholds are percentiles of a wider corpus,
not evidence that the earlier ones were wrong; the FPR tuples were repinned
WITH them because they are measured through the thresholds and a tuple kept
from the old cuts would describe how often thresholds that no longer ship
interrupt a corpus that no longer exists. The Wilson CI and author-cluster
bootstrap on `CLICHE_PAIR` were computed on the 1,859-item band and are NOT
re-derived by the runner, so they still name that population. The MATTR
window sweep in `quality/FLOOR.md` was not re-run either, and says so.

---

## 4·R — REPINNED 2026-08-20 at the frozen corpus, and the confounded
feature is NOT the one this section named

The closing sitting re-derived §4 over the loaded corpus: **407 dated
authors, born 1340-1888, median 1810** against the **108, born
1563-1872** below. Nothing here is tuned; the same command, the same
seed, the same null, a corpus 3.8x wider on the author axis.

| check | rho @108 | p @108 | rho @407 | p @407 | |
|---|---:|---:|---:|---:|---|
| `mattr` | −0.228 | 0.0180 | **−0.125** | **0.0103** | **now SURVIVES** |
| `fwr` | +0.090 | 0.3503 | **+0.144** | **0.0046** | **now SURVIVES** |
| `anaphora` | **+0.275** | **0.0042** | −0.008 | 0.8695 | **GONE** |
| `cv` | +0.171 | 0.0734 | +0.090 | 0.0712 | still does not survive |

**THE HEADLINE: anaphora's period slope does not reproduce.** It was
+0.275 at p 0.0042 and is −0.008 at p 0.8695 — not weaker, ABSENT, and
sign-flipped. The sentence below, *"So anaphora is a third feature
caught reading period rather than quality"*, is the claim this repin
withdraws. It is kept visible rather than deleted (doctrine 17).

**AND THE SHIPPED MESSAGES CARRYING IT ARE REPAIRED — 2026-08-20, the
same day, and this paragraph is what asked for it.** It used to end
*"the `ANAPHORA_OVERLOAD` finding text still carries it, which is now a
stale claim inside a shipped message and is named here so it can be
repaired deliberately rather than discovered"* — a correct diagnosis
left as a to-do, which is the shape doctrine 48 is about. Three
surfaces stated the withdrawn slope as live and all three now carry the
withdrawal with the struck figure legible beside it: the
`ANAPHORA_OVERLOAD` finding's own evidence (`quality/floor.py`, the
only one a writer reads), the `song` profile's shipped `note`, and
`floor.py`'s module docstring. `quality/test_floor.py` §15 moved with
them — it used to assert the LIVE slope, and now asserts that the
finding carries a withdrawal, that `+0.275` appears only as struck, and
that the two non-claims below are stated; 3 of its 5 checks go red
against the pre-repair message, proven by mutation, and the 2 that
survive are the controls. The old check was also vacuous by
construction (`all(... for f in fs if f.code == ...)` is True over no
findings), and the population is named first now.

**WHAT IS NOT REPAIRED, ON PURPOSE.**
`song_profile_calibration.py --check` still pins rho 0.275 and p_perm
0.0042 as this profile's shipped constants, so it DRIFTS against the
loaded corpus — which is that runner's contract working, not a defect:
a drift is argued and repinned in a closing sitting, never tuned to
(doctrine 58). Repinning those two is the same sitting that repins the
five thresholds, and it is held open on the predictability arm. The
structural gate requiring the note to quote `+0.275` is KEPT and its
job has changed: what would trip it now is an edit that DELETES the
struck figure instead of striking it.

**AND THE CONFOUND DID NOT VANISH — IT RELOCATED.** `mattr` and `fwr`
both survive Bonferroni now, at the same SIGNS they already had and
with 3.8x the authors: what changed is the power, not the direction.
§4b agrees independently on `fwr` — EARLY→LATE threshold transfer at
**11.87% observed against a 5.88% null median, p 0.0005 SURVIVES**. So
the population of period-reading features is still about two; the
IDENTITY of them is what this corpus overturns.

**THE POPULATION CAVEAT, STATED RATHER THAN BURIED.** 407 of 879
in-band authors carry printed dates; **472 are UNDATED and dropped from
this check alone**. They are not missing at random — they are
disproportionately the anthology material whose editions print no dates
for their authors, plus the 125 Modern Scottish Minstrel files whose
derived dates were WITHDRAWN. So this is a correlation over a BIASED
46% subsample, and it is quoted as one. It is enough to withdraw the
anaphora claim (an effect that large should not evaporate on a wider,
better-powered sample) and it is NOT enough to adopt `mattr`/`fwr` as
settled period confounds. Doctrine 11's own count is the owner's to
move; this section reports the measurement.

**NO CONSTANT IS REPINNED ON THIS RUN, AND THAT IS A DECISION.** The
`--check` answered 15 of 20 and REFUSED 5 — every predictability-
dependent one — because the expensive half needs the item cache and the
container this ran in restarts before it can finish. Three thresholds
drifted (`mattr` 0.7226→0.7128, `fwr` 0.4716→0.4773, `cv`
0.1123→0.1094) while all five held-out FPRs stayed on target and
`anaphora` did not move at all. Adopting three of the five and leaving
`predictability` at its old value would make `floor.py`'s `song`
profile half a description of one corpus and half of another — one
question, two answers, in one object (doctrine 1). The profile is
adopted as a SET or not at all, so it is not adopted here.

---

## 4. The period confound, measured (doctrine 11)

The corpus is pre-1931 by construction. In the band: **108 authors, born
1563–1872, median 1806, latest death 1929.** No song here was written by anyone
alive in the last hundred years, and both example lyrics were written in 2026.

**4a. Author-level Spearman against birth year**, one median per author so a
prolific author cannot vote 200 times, against a label-permutation null over
authors (10,000 draws, seed 20260811). Bonferroni over the five checks cuts at
0.0100:

| check | rho | p_perm | |
|---|---:|---:|---|
| `mattr` | −0.228 | 0.0180 | does not survive |
| `fwr` | +0.090 | 0.3503 | does not survive |
| **`anaphora`** | **+0.275** | **0.0042** | **SURVIVES Bonferroni** |
| `cv` | +0.171 | 0.0734 | does not survive |
| `predictability` | −0.018 | 0.8572 | does not survive |

**So anaphora is a third feature caught reading period rather than quality**,
after the two doctrine 11 already names — later-born authors in this corpus
open more of their lines with the same word. That finding is now carried in the
`ANAPHORA_OVERLOAD` finding text itself, not only in a document.
`predictability` is the one check here with essentially NO period slope
(rho −0.018 is the smallest magnitude of the five) — the recalibration this
round did not import a fourth period-confounded feature, it added one that
happens to read clean on this axis.

**4b. Cross-cohort threshold transfer.** Split the 108 authors at the median
birth year 1806 (EARLY 54 authors / 1,407 items; LATE 54 / 452), calibrate on
one side, measure the FPR on the other. The control permutes the COHORT LABEL
over the same authors at the same partition sizes, 2,000 draws — it holds the
split structure fixed and varies only the thing under test, so it is not
defined in terms of the quantity it controls (doctrine 14). Bonferroni over the
**12** comparisons (five checks + the union, both directions) cuts at
**0.00417** — this used to read "eight … 0.00625" here and in the script's own
printed output, correct for the four checks the profile shipped with at the
time; `song_profile_calibration.py`'s `report_period()` computed it dynamically
off `len(CHECKS)` for §4a already and now does the same for §4b, so a sixth
check later cannot leave this line quoting a stale denominator again:

| direction | check | observed | null median [5th–95th] | p |
|---|---|---:|---|---:|
| EARLY → LATE | `mattr` | 10.62% | 4.92% [1.49 – 11.53] | 0.0805 |
| EARLY → LATE | `fwr` | 12.39% | 5.17% [2.03 – 11.03] | 0.0280 |
| EARLY → LATE | `anaphora` | 4.42% | 4.69% [1.66 – 10.42] | 0.5597 |
| EARLY → LATE | `cv` | 4.42% | 5.09% [2.90 – 8.34] | 0.6552 |
| EARLY → LATE | `predictability` | 5.97% | 4.69% [2.62 – 7.50] | 0.2294 |
| EARLY → LATE | union (five) | 27.43% | 20.12% [12.98 – 29.48] | 0.1109 |
| LATE → EARLY | `mattr` | 3.06% | 5.20% [1.51 – 11.42] | 0.7846 |
| LATE → EARLY | `fwr` | 1.49% | 4.96% [1.90 – 10.70] | 0.9750 |
| LATE → EARLY | `anaphora` | 5.26% | 4.71% [1.62 – 10.46] | 0.4748 |
| LATE → EARLY | `cv` | 5.54% | 5.04% [2.88 – 8.25] | 0.3693 |
| LATE → EARLY | `predictability` | 4.05% | 4.71% [2.58 – 7.39] | 0.7166 |
| LATE → EARLY | union (five) | 15.78% | 20.12% [12.67 – 29.07] | 0.7961 |

`predictability` transfers unremarkably in both directions (p 0.23, p 0.72) —
neither close to surviving, and neither the smallest nor largest p in the
table. It does not change which direction the union moves, and does not
change the conclusion below.

**Nothing survives multiplicity, so this is a DIRECTION and not a finding.** But
the direction is one-sided and it is the unfavourable one: thresholds fitted on
earlier-born authors OVER-flag later-born ones on both level-sensitive checks,
and the reverse direction runs at or below nominal on all five (`predictability`
included: 4.05% observed against a 4.71% null median LATE → EARLY). A 2026
lyric sits further along that same axis than any author in the corpus.

**Note the two halves disagree, and the disagreement is the useful part.**
Anaphora has the only significant period SLOPE (4a) and the flattest cohort
TRANSFER (4b, p 0.56 and 0.47); `fwr` has no slope (p 0.35) and the worst
transfer (p 0.028). A level slope does not have to move a tail, and a tail can
move without a level slope. Reporting only one of the two would have named the
wrong feature either way.

**Power, so the null means something (doctrine 76).** Injecting a constant
delta into the held-out cohort's feature, the smallest shift whose FPR clears
the cohort-permutation null's 95th percentile is 0.0030 for `mattr` (0.06 of
the in-band SD), 0.0005 for `fwr` (0.01 SD), 0.0105 for `cv` (0.13 SD) and
0.0505 for `anaphora` (0.71 SD). So the cohort test is very sensitive on
`mattr` and `fwr` and weakly sensitive on `anaphora` — the null in 4b is
well-powered for the two checks whose transfer looks worst and poorly powered
for the one whose slope is real.

**What this cannot say.** All of the above is measured *inside* the provenance
gate. It prices drift across the corpus's own 309 years of author birth years.
It does not price drift to 2026 and no rearrangement of this corpus can. **The
false-positive rate of this profile on contemporary lyric is UNKNOWN, and the
only measured gradient points at it being higher than 20.79%, not lower.**
That sentence belongs beside every use of this profile on new writing.

---

## 5. The tolerance, which nobody had ever measured

`Profile.tolerance` shipped at 2.0 from the first calibrated commit and appears
in no results document — an uncalibrated constant of exactly the kind doctrine
16 is about. Measured here for the first time: thresholds calibrated on half
the in-band authors, applied to held-out authors' items across the whole
applied band.

| factor | applied band | `mattr` | `fwr` | anaphora | `cv` | predictability | union (five) | (union of four) |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1.00 | 150–400 | 5.43% | 5.23% | 5.01% | 5.13% | 4.81% | **20.79%** | (17.66%) |
| 1.10 | 136–440 | 6.01% | 5.68% | 5.17% | 5.24% | 5.46% | 22.46% | (18.71%) |
| **1.25** | **120–500** | 6.22% | 5.68% | 5.37% | 5.64% | 5.62% | **23.12%** | (19.36%) |
| 1.50 | 100–600 | 6.78% | 5.72% | 5.84% | 6.52% | 6.21% | 24.46% | (20.69%) |
| 2.00 | 75–800 | 7.95% | 6.55% | 6.43% | 6.69% | 7.34% | **26.33%** | (22.05%) |
| 3.00 | 50–1200 | 8.60% | 7.23% | 7.12% | 7.32% | 8.75% | 28.19% | (23.29%) |

The four original columns are unchanged at every factor — re-running the
tolerance sweep with `predictability` added moved only the union, which is the
consistency check that nothing else drifted when the fifth check joined.

Every check degrades monotonically, so the tolerance is a real cost and not a
free courtesy. **The song profile declares 1.25** and its shoulder is priced at
23.12% (five checks; 19.36% at the four this was first measured against). The
other two keep 2.0: re-measuring them needs the sonnet classes and
that is a different cell's to move — it is written up in
`scratchpad/cellBD/PATCHES-not-mine.md`.

Findings in the shoulder are still downgraded to notes, as before, so the extra
1.7pp buys notes rather than rejections. That is the right shape and it is now
a measured shape.

---

## 6. What the profile says about the two example songs

> **THE TWO SONGS ARE GONE FROM HEAD — see the annotation block at the head of
> §0 for the `git show` that recovers them and for the per-figure verdict.
> Short version, re-measured 2026-08-13 against the recovered text: every one
> of the eight numbers in the table below reproduces exactly, and the AFTER
> block reads `1 flag(s), 1 note(s)` rather than `1 flag(s), 0 note(s)` because
> the fifth check announced in this file's own UPDATE header now fires.**

**They are not in the calibration set.** Checked rather than assumed: 0 of 27
and 0 of 37 normalised long lines (≥ 12 chars, case/punctuation/U+2019
normalised) appear anywhere in the 150,923 distinct normalised long lines of
`corpus/song/eng_*.txt`. `test_floor.py` test 17 pins it, and it is the one
thing that makes any of these numbers mean anything about these songs
(doctrine 13).

| | `mattr` | `fwr` | anaphora | `cv` | verdict |
|---|---:|---:|---:|---:|---|
| cut | < 0.7226 | > 0.4716 | > 0.3000 | < 0.1123 | |
| `cherokee_bill.txt` (28 lines, 327 tok) | 0.7915 | 0.4373 | 0.2857 | 0.1355 | **clear on all four** |
| `never_been_to_a_scene.txt` (41 lines, 291 tok) | 0.7804 | 0.4158 | **0.3415** | 0.2130 | **`ANAPHORA_OVERLOAD`, flag** |

```
$ python3 quality/floor.py examples/never_been_to_a_scene.txt        # AFTER
# THIS COMMAND CANNOT RUN FROM A CLEAN CHECKOUT — the lyric was deleted
# by 11aa19b (see the note at the top of this file). TRANSCRIPT AS OF
# 2026-08-13: the elided period clause below is the one §4·R withdrew
# and the 2026-08-20 repair rewrote; the FINDING, the threshold and
# the flag are unchanged.
=== [(untitled)] 41 lines, 291 tokens
SLOP FLOOR — 1 flag(s), 0 note(s)
  [FLAG] ANAPHORA_OVERLOAD: 14 of 41 lines open with the same word
         (lines 5, 7, 8, 14, 15, 17, 18, 19, 23, 34, 35, 37, 38, 39)
         opening 'i' at 34% of lines > 30% (human 95th percentile, song
         profile); NO generated class exists at this length, so there is no
         AUC and no separation claim; the evidence is a false-positive rate of
         5.01% on HELD-OUT human song ... And on the song corpus it carries a
         measured PERIOD slope — author-level Spearman +0.275 against birth
         year, p_perm 0.0042 ... Deliberate anaphora is a figure ...
```

**The harness's own flagship example song fails its own new gate**, on the one
check that also carries a period slope. That is the strongest available
evidence that the thresholds were not chosen to make the examples pass — and
`test_floor.py` test 14 pins that outcome, so a later change that loosens
`anaphora_max` until this lyric passes turns a green suite red.

Whether the finding is *right* is not the gate's business. Fourteen of those
lines open with "I" in a song whose whole subject is a dispatcher who is never
at the scene; the anaphora is the argument. The finding says so in its own
evidence — *deliberate anaphora is a figure … the finding is a decision handed
back, not a verdict* — and it is now a decision the writer gets to make,
instead of a check that never ran.

**The sheet unit.** Both example sheets carry no `[section]` markers, so they
are one section each and the song profile reads them whole. For a marked-up
sheet, `python3 quality/floor.py FILE` now runs BOTH passes: per-section as
before, and then a WHOLE-SHEET pass restricted to the length-sensitive codes.
The relation-level half is deliberately not pooled, because the REPEAT band
inverts across a section boundary (doctrine 3) and a pooled self-rhyme count
over two chorus instances is a false accusation by construction. The
length-sensitive half has the opposite property: the corpus items it was
calibrated on are whole songs with their refrains printed, so a repeated chorus
is INSIDE the calibration and costs nothing by itself.

---

## 7. `OUT_OF_CALIBRATED_LENGTH` still fires

The profile was not widened to swallow everything. Over the whole 4,930-item
corpus, after the change:

| profile | exact | items | share |
|---|---|---:|---:|
| song | yes | 1859 | 37.7% |
| song | no (shoulder, notes only) | 472 | 9.6% |
| sonnet | yes | 437 | 8.9% |
| sonnet | no | 1160 | 23.5% |
| section | yes | 86 | 1.7% |
| section | no | 631 | 12.8% |
| **`OUT_OF_CALIBRATED_LENGTH`** | — | **285** | **5.8%** |

Above 500 tokens and below 14, no profile reaches and the length-sensitive
checks still decline. `test_floor.py` test 16 pins 501, 700 and 3000 tokens as
refusals.

**One rule changed with the third profile.** `declaration_for` used to break a
tie between reaching profiles by nearest MIDPOINT. That was fine while two
narrow profiles sat far apart and broke the moment a 250-token-wide one was
added: at 149 tokens it chose the sonnet, extrapolating 23 tokens past a
measured 126, over a profile whose measured range starts at 150. It now
minimises the SIZE OF THE EXTRAPOLATION — nearest measured edge — which is what
the tolerance concept was always about.

---

## 8. A defect found on the way, unrelated to length

`SlopFloor._anaphora` read `max(set(firsts), key=firsts.count)`. Iterating a
set of strings is iterating a hash order that Python randomises per process, so
on a tie the RATE was stable and the reported WORD was not:

```
$ for s in 0 1 2 3 4 5; do PYTHONHASHSEED=$s python3 -c '...' ; done
(0.5, 'alpha')   (0.5, 'beta')   (0.5, 'alpha')
(0.5, 'beta')    (0.5, 'beta')   (0.5, 'alpha')
```

The finding's `locations` follow the word, so the line numbers a writer is
handed did not reproduce across runs — doctrine 66, in the part of the output a
writer actually acts on. Fixed: the tie goes to the word that appears FIRST.
`test_floor.py` test 18 spawns six subprocesses at different `PYTHONHASHSEED`s
and requires one answer, because nothing inside a single process could have
found it.

---

## 8a. `CLICHE_PAIR` gets a false-positive rate — 2026-08-14

The three shipping flags above were the only checks in this gate with a
measured interruption rate. `CLICHE_PAIR` is a hard flag and had never had
one. It does now, off the same machinery: **author-held out, 200 seeds, 50/50,
same 150–400 band.** The protocol reproduces §2's `LEXICAL_MONOTONY` 5.43%,
`FUNCTION_WORD_HEAVY` 5.23% and `ANAPHORA_OVERLOAD` 5.01% exactly, which is
what makes the new row comparable to them.

| check | AUTHOR-held-out FPR | point estimate | Wilson 95% CI | author-cluster bootstrap |
|---|---|---|---|---|
| `CLICHE_PAIR` | **6.36%** [4.23 – 8.37] | 118/1859 = 6.35% | [5.33 – 7.55] | 6.20% [4.02 – 9.10] |

**It is in the family of the three that ship, and the measurement does not
support demoting it.** It is NOT folded into §2's union of five: that union is
over the length-sensitive checks the band rule, the tolerance and every
threshold were chosen against, and a sixth member would silently redefine "one
human song in five".

### What the measurement did compel: a severity change OUTSIDE the band

Bucketed by the live `declaration_for()` over all 4,930 corpus items:

| bucket | items | fire | rate |
|---|---:|---:|---:|
| `exact:section` | 86 | 0 | 0.00% |
| `exact:sonnet` | 437 | 24 | 5.49% |
| `exact:song` | 1859 | 118 | **6.35%** |
| `EXTRAPOLATED:section` | 631 | 14 | 2.22% |
| `EXTRAPOLATED:sonnet` | 1160 | 43 | 3.71% |
| `EXTRAPOLATED:song` | 472 | 34 | 7.20% |
| `OUT_OF_CALIBRATED_LENGTH` | 285 | 42 | **14.74%** |

`floor.py`'s `_relation_findings` hardcoded `"flag"` and is appended **after**
`check()`'s `sev()` closure has run — and on the `prof is None` path the gate
has already returned. So `CLICHE_PAIR` was emitted as a HARD FLAG on **133
items where every length-sensitive finding had been downgraded to a note**, 42
of them in the one bucket nothing was ever calibrated at, at 2.3× the in-band
rate, where it was the only flag the gate could still emit. It now runs through
`sev()`: exact → flag, extrapolated or out-of-range → note.

**In band that costs nothing, and this is measured rather than asserted.**
Re-running the same protocol against the changed gate, counting only items
where `CLICHE_PAIR` is emitted as a **FLAG**: 118 of 1859, 6.35%, median
6.36% [4.23 – 8.37]. Identical. All 133 out-of-band emissions became notes and
no in-band one did.

`quality/song_profile_calibration.py --check` now compares the shipped
`held_out_fpr["cliche"]` against the corpus like every other constant here
(judges 14 of 19, was 13 of 18); it needs no frequency layer, so
`--without-predictability` decides it in ~75 CPU-s.

### What the rate does NOT license

An FPR says how often a check interrupts a human songwriter. It says nothing
about what the check is FOR, and this list does not measure over-familiarity to
a living listener. Measured against this repo's own pair table
(`data/song_rhymepair_en.tsv`, 15,409 distinct pairs, 91,636 tokens, per
author):

- only **4 of the top 30** pairs by author dispersion are on the hand-typed
  list — **13.3%** overlap; **3 of 10** at the top ten;
- the list's own **median dispersion rank is #254 of 15,409**, and 7 of the 30
  do not appear in the table at all;
- **9 of the 30 never fire anywhere** in `corpus/song/eng_*`: `alone/phone`,
  `baby/crazy`, `beats/streets`, `cash/stash`, `chance/dance`, `dough/flow`,
  `feel/real`, `fun/sun`, `girl/world`.

The table's most dispersed rhymes are `away/day` (61 authors), `be/me` (57),
`me/thee` (51), `be/thee` (50); the first list member appears at #5. So the
list has **low sensitivity** against the only rhyme-frequency evidence this
repo owns. `quality/relations.py`'s `frequency` Unprovidable and
`quality/phrase_commonplace.py` both REFUSE the over-familiarity claim at their
own levels — every admissible English source here is pre-1931 — and a
thirty-item list does not earn the claim they declined. The finding says so on
its face, so a reader of a `CLICHE_PAIR` flag sees the limit, not just the hit.

`CLICHE_PAIR` is also now a declared coordinate: `FloorDeclaration.
cliche_pairs`, defaulting to the shipped 30 (doctrine 1). It was the only floor
threshold with no field to disagree in. Replacing the set replaces the 6.35%
with it, and the finding disowns the number when it does.

### One precision defect, priced and recorded rather than fixed

There is **no rhyme test in front of the membership test** — it is raw
string-set membership on the two end words. `tears`/`years` fires **21 times
over the corpus, 5 in band**, on couplets `song_rhymepair_en.tsv` records as
NOT rhyming (count zero). That is a homograph: cmudict gives `tears` both
`T EH1 R Z` (rips) and `T IH1 R Z` (weeping), and the table's `rime_key` reads
`prons[0]`, which is the rips sense. Neither layer read which sense is on the
page. Both candidate fixes were measured in band before this was left alone:

| gate | in-band items firing |
|---|---:|
| none (shipped) | 118/1859 = 6.35% |
| `prons[0]` perfect-rhyme | 114/1859 = 6.13% |
| any-pronunciation perfect-rhyme | 118/1859 = 6.35% |

The `prons[0]` gate buys its 4 items by asserting *tears-is-rips*, swapping one
unmeasured convention for another. The any-pronunciation gate is a provable
no-op here — all 136 in-band listed pairs pass it, and all 313 over the whole
corpus — so it would be a gate that changes nothing, added to look careful. The
defect is real on arbitrary text and is written down instead, in this section
and in the finding a writer reads.

---

## 9. What would have to be true for this profile to mean more

Stated so the next cell does not have to rediscover the boundary.

1. **A generated song class.** Until one exists there is no AUC, no separation,
   and no evidence that any of these five checks distinguishes writing anyone
   would want to reject. The FPR bounds the nuisance, not the benefit. This is
   doctrine 7 read strictly: a floor is a rejection gate, and a rejection gate
   with a measured false-positive rate and no measured true-positive rate is
   half an instrument.
2. **Post-1930 human song text this project may hold.** §4 can only price
   period drift inside the provenance gate, and every gradient it can see runs
   the wrong way for contemporary use. What is blocked here is the TEXT, not
   the method (doctrine 44): the identical calibration would run on a modern
   corpus in one command. Nothing in `data/sources.tsv` currently offers one on
   admissible terms, and this cell staged nothing.
3. **A second language.** Every threshold here is English and two of the five
   checks presume English on their face — `function_word_ratio` presumes a
   clean function/content split and does not transfer to an agglutinative or
   polysynthetic language, and `predictable_pair_fraction_max` is computed
   against an English frequency list. Doctrine 8: never fit on one tradition.
   The song corpus has 117 non-English files and none of them were used.
4. ~~`predictable_pair_fraction_max` at song length, once the frequency layer
   settles.~~ **CLOSED 2026-08-13.** The frequency layer settled 2026-08-11
   (`data/opensubtitles_en_50k.tsv`); this cell measured `predictable_pair_
   fraction_max` against it at song length for the first time — threshold
   0.9286, held-out FPR 4.81% median [2.52–7.43%], no period slope (§4a). All
   five floor thresholds now carry a song reading.

None of the remaining three is a reason to withhold the profile. A gate that
had no reading at all on the two songs this project has written was the worse
state, and the new one states exactly what it does and does not know.
