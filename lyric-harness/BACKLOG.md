# BACKLOG — everything we owe, ordered

Written 2026-08-11. `MISSING.md` is the gap REGISTER (what does not exist).
This is the WORK LIST (what to do about it, in what order, and why).

---

## 0. The adversary question, answered empirically

The claim was "we have 2 of 3 adversaries." That was wrong twice over: the
count is lower than 2 in one place and the denominator is higher than 3.

**Proof the third is not finished.** Mutation test, run 2026-08-11: revert the
head/tail alignment fix — the one made hours earlier, which changes the band's
verdict on **79.9% of unequal-length anchor pairs** — and run all 23 test files
plus the battery.

| mutation | detected? |
|---|---|
| **M1 · revert `channel_agreement` to head alignment** | **SURVIVED. Nothing caught it.** |
| M2 · `theta_rhyme` 0.75 → 0.50 | caught by `test_readability` |
| M3 · coda channel ignored entirely | caught by `test_band` |

So today's most consequential fix is **unprotected**, and the suite that
"passes" would pass identically with the bug back in. `redteam_band.py` found
the defect once, by hand, chasing one bad report line. Nothing stops it
returning.

**The adversary taxonomy, honestly counted:**

| # | attacks | status | instrument |
|---|---|---|---|
| 1 | our RESULTS — is the effect real? | **built** | line-permutation nulls, matched redeals, shuffled controls |
| 2 | the WRITING — is the draft any good? | **built** | `quality/revise.py` |
| 3 | the CODE's generosity — is the rule too loose? | **partial** | `quality/redteam_band.py`, band only |
| 4 | the TESTS — can the suite detect a broken harness? | **built** | `quality/mutate.py` — ~~30 mutations, 29 caught~~ ~~33 declared~~ **declared: the counters table below holds the live total** (33 `M*` plus the 24 quality-layer `Q*` added 2026-08-13), all of them applying cleanly; 1 allowlisted equivalent (`M4`) with its premise tested; the CAUGHT count is a `--slow` measurement and is not recorded here (`python3 quality/counters.py --slow`) |
| 5 | the CORPUS — is the text what its header claims? | ~~**ad hoc**~~ **built** | `quality/audit_corpus.py` (landed `c661b93`), `quality/RESULTS_CORPUS_AUDIT.md`, regressions `quality/test_corpus_audit.py` — the by-hand era is doctrines 50/52/53 |
| 6 | the TAXONOMY — does every named entry have a source? | **built** | `quality/audit_register.py --provenance` |
| 7 | the REPORT — do the number, the label and the evidence agree? | ~~**missing**~~ **built** | `quality/audit_spans.py` (landed `a914dc0`), `quality/RESULTS_SPANS.md` — its first run: of 1,014 judged sonnet pairs, **382 report lines name a pair that did not produce the number** |
| 8 | the RECORD — do the documents agree with each other and with the code? | **built** | `quality/audit_register.py` — 7 consistency failures found and closed on 2026-08-11, 2 remaining and both deliberate; `quality/verify_entries.py` for the ENTRY CLAIMS the counters table never covered |

**EIGHT, not seven, and the file used to say both.** ~~Four to six of seven, not
one of three.~~ ~~adversaries 1–7 all attack the WORK~~ — the table has had
**eight** rows since the eighth was added, and three places in this one file
still counted seven: the sentence above, the counters row `adversaries built, of
7`, and the summary. One roster, two denominators, and nothing was checking.
`python3 quality/verify_entries.py` now reads the **instrument column** of this
table — `quality/audit_corpus.py` and `quality/audit_spans.py` either exist or
they do not — which is the checkable half of a row whose STATUS column stays a
judgement (`quality/counters.py` refuses that column for exactly that reason,
and still does). **That is the boundary, and it runs through the middle of a
single row.**

~~Adversary 4 is the highest-value item in this document~~ — it is **built**,
and the eighth was not on the list when the list was written. **Adversary 8 is
the one that found four false entries in a week**, and the argument for it is
that adversaries 1–8 all attack the WORK or the RECORD of it while, until
2026-08-11, nothing attacked the ENTRIES. Its cheapest pass costs under a
second: `python3 quality/audit_register.py --consistency`, no corpus, no
imports. **Remaining: none of the eight is `missing`; 3 is still `partial`
(`redteam_band.py` attacks the band only).**

---

## TIER 1 — blocks the next song. Do these first.

### 1.1 · Mutation testing (adversary 4) `DONE 2026-08-11`
Kill M1. A small runner that applies N declared mutations to the comparator,
the band, the anchor rule and the scheme mandate, runs the suite, and FAILS if
any mutation survives. Start with the three above and grow the list every time
a defect is found by hand — a defect found by hand is a mutation the suite
should have caught.
**Acceptance:** M1 is caught. The runner is in CI-shaped form (`__main__`) and
its surviving-mutation list is empty or explicitly declared.
**MET.** `quality/mutate.py` declares ~~**30** mutations; **29 are caught**~~
~~**33 mutations**~~ **the count in the counters table, all of them applying
cleanly to the current source**
(`python3 quality/mutate.py --dry-run`), including M1 and M30 — and it grew
again on 2026-08-13, when the `Q*` quality-layer block was added, which is the
whole reason the number is not written out here a third time. The one
ALLOWLISTED survivor
is **M4, proved equivalent rather than missed**, allowlisted in
`quality/test_mutation.py` with the proof — and the allowlist entry's premise is
itself under test, since M11 mutates the `cluster_sim` line M4's equivalence
depends on and is caught.
**The CAUGHT count is deliberately not written down here.** It forks the whole
suite once per mutation, so `quality/counters.py` REFUSES it on the cheap path
for COST and reaches it with `python3 quality/counters.py --slow`. A number that
costs money to check is exactly the number that gets copied forward instead of
re-derived — which is how `30 / 29` survived three mutations being added.
**And the three coordinates declared on 2026-08-11 — `scalar_alignment`,
`nucleus_agreement`, `nucleus_licence_unstressed_only` — now have M31/M32/M33,
each caught by the file that declares it.** A new coordinate with a default is a
new place for a silent drift; it belongs in the list so that stays true.

### 1.2 · `best_score` does not report which span won `M-17, CLOSED 2026-08-17`
`line_anchors` returns several candidate spans per line; `best_score` takes the
max; `check_scheme` prints the score beside `endwords[i]/endwords[j]`. When the
winner is an interior mosaic reach, **the report names a pair that had nothing
to do with the number** — `go/receipt 0.579 RHYME` was `get to go` ~ `ceipt`.
This is the original bad report line and it is still there. Doctrine 45.
**Acceptance:** every score carries the two spans that produced it, and
`check_scheme`/`brief` print them. Adversary 7's first instrument.

**CLOSED IN TWO HALVES, AND THE SECOND ONE WAS THE WRITER'S.** Adversary 7
closed the first: `best_score` returns a `Scored` carrying an `Attribution`
that names the winning span pair, the words each covers, `search_k`, ties and
the mosaic/substituted verdicts, and `check_scheme` prints it through
`spans_note`. **`brief` did not**, and `brief` is the half a writer reads.
`inspect()`'s findings printed two end words and a number — the assertion —
without ever evaluating it. `Reviser._attribution` is the repair, and it is
GATED ON `Attribution.claims`: the provenance is appended exactly when the
ordinary sentence would be false.

**The gate is the design, and it was measured, not assumed.** On rung 3's
26-line draft **325 of 325** pairs carry a provenance note and **208** name
something other than the two end words, so printing it always buries the cases
that matter under two hundred `scored on: humming ~ coming`. **4 of the 13
MANDATED pairs** on that draft name a pair that is not the evidence, so this
was live and not latent. Both report paths in `grade()` — `verdicts` and
`collisions` — read the one gate, so they cannot drift about one question
(doctrine 1).

`quality/test_revise.py` §44 is 6 checks on BACKLOG 1.2's own `go/receipt`
example plus an exact-span control, and needs THREE mutations: removing the
gate reds the two control checks (the note appears where the ordinary sentence
is true), cutting the finding's call site reds the writer-facing check, and
dropping the collision call site reds the no-drift check. Two checks are
controls that the VERDICT did not move — same score, same relation, same
`why`. This is a report repair and nothing else.

### 1.3 · `theta_nucleus` is a coin flip `CLOSED 2026-08-11`
`five`/`of` passes at nucleus similarity **0.603** against a threshold of
**0.600**. ~~The held-out sweep says tightening it is a worse trade than the
coda fix was (2.7pp of true positives for 4.4pp of false), so it was left alone~~
— but "left alone" is not a decision. Options: a per-vowel-pair rule instead of a
scalar threshold, or accept and DECLARE that the nucleus channel is the loose
one.
**Acceptance:** either a change with a held-out price, or a written declaration
that 0.600 is chosen and what it costs.

**CLOSED by declaration, and the REASON changed.** Shipped: the second option,
made mechanical. `theta_nucleus` is unchanged at 0.600;
`Declaration.nucleus_agreement` declares the SHAPE with `identity` and
`licensed` reachable and an undeclared value raising; `quality/test_nucleus.py`
prints the enumerated 40-of-105 cut and pins `five`/`of` at 0.603 and
`bed`/`bead` at 0.758 as the declared cost.

**Not "a worse trade" — the trade cannot be computed on this corpus.** Of the 31
mandated pairs a 0.60 → 0.70 tightening newly refuses, the syllable pairs
partition with no remainder: 28 a stressed vowel difference (gone/alone,
tongue/song, have/grave, blood/good — correct refusals in the declared dialect),
6 CMUdict writing one reduced vowel two ways, 1 a promotion, and no fourth
category. The sonnet violation rate prices the **`dialect`** coordinate on this
channel, not the threshold.
**NEW ENTRY OWED AND WRITTEN: `MISSING.md` M-19** — a true-positive corpus in
the declared dialect, which this repo does not have. Doctrine 44: "cannot
obtain", not "hard to build".

### 1.4 · The revision loop cannot grade a song with no letter scheme `CLOSED 2026-08-11`
Doctrine 2 says the graph is the object and letter schemes are lossy
projections that sometimes do not exist — and the song written this week HAS no
letter scheme. `brief(lines, scheme=None)` then passed **vacuously**: nothing
declared, nothing mandated, "nothing flagged". The loop only worked on the
structures the doctrine calls lossy.
**Acceptance:** `brief` accepts a declared PARTITION or `schemes.Cover`, not
only a letter string, and refuses loudly when given neither.

**MET.** `python3 lyric_harness.py brief quality/fixtures/mandate_song.txt`
with no mandate prints a REFUSAL and **exits 2**; `--cliques` and
`--groups=1,3;2,4` both take. `Reviser.mandate_from_graph` returns a `Cover`
marked `source=derived` and NOT INDEPENDENT of the grader (doctrine 14).

> **~~21 maximal cliques, overlapping~~ — the figure was never a clique count,
> and the correction has to say so or it is just a fresher wrong number.**
> Re-derived 2026-08-11 by running the code of the commit that wrote this line
> (`6c265ad`, `theta_coda=0.60`, before the head/tail alignment fix) against the
> song file of that commit: **18 cliques and 21 OVERLAPPING NODES**. So `21` was
> the PIVOT count — the lines belonging to more than one clique — carrying the
> word "cliques". Two quantities from one call, and the wrong one was written
> down. At the shipped `theta_coda=0.80`,
> `python3 lyric_harness.py graph examples/never_been_to_a_scene.txt` reports
> **8 maximal cliques and 1 overlapping node** (L27, `ones`, in cliques 3 and 7).
> Calibrating `theta_coda` 0.60 → 0.80 on 2026-08-11 removed 20 of the 21 pivots.
>
> **AND THERE ARE TWO CLIQUE COUNTS ON THIS SONG, BOTH CORRECT.** `brief
> --cliques` reports **12 groups and 5 pivots** on the same 41 lines, because
> `Reviser.mandate_from_graph` builds its cover with `promote=True` and admits
> REPEAT edges, while `rhyme_graph` reads anchors with `promote=False` and does
> not — a divergence `revise.py` states in its own docstring and defends, since
> deriving a cover under one setting and grading it under the other would make
> the cover an approximate fixed point of the grader. Doctrine 91: the count is
> a coordinate of the RENDERING. **Never quote a clique count for this song
> without naming which of the two produced it.**
>
> **AMENDED 2026-08-11 — both counts moved, and it is the coda channel again.**
> `Declaration.coda_agreement` defaulting to `identity` (cell BA,
> `quality/RESULTS_CODA_SHAPE.md`) changed which pairs type as RHYME across
> this whole file. Re-measured: `graph` at `theta=0.75` now reports **6
> maximal cliques and ZERO overlapping nodes** — L27 (`ones`) no longer
> clears threshold with either of its former clique partners at all, so it is
> not in the graph, not merely un-pivoted. `mandate_from_graph`
> (`promote=True`) gives **7 groups**, also fully disjoint. The song is
> **letter-representable now**, which it was not at any point in this
> passage's history. `quality/test_verbs.py`'s doctrine-2/pivot demonstration
> lost its real witness and moved to a constructed fixture (doctrine 94) —
> see that file's own note for the vowel-similarity chain that reproduces the
> non-transitive shape without depending on this song's own text.

### 1.5 · Duplicate findings in the brief `CLOSED 2026-08-21`
`SHARED_SUFFIX` printed six times identically for one line. Cosmetic, one line
of code, actively obscures the real findings.

**THE FIX WAS SHIPPED LONG AGO; THE REGRESSION WAS VACUOUS UNTIL TODAY, AND
THAT IS THE ONLY REASON THIS ENTRY IS INTERESTING.** Two guards hold it —
`revise.py`'s `seen` bucket inside `inspect()`'s `add()`, and
`dict.fromkeys(f.locations)` in the fan-out loop — plus
`lyric_harness.dedupe_findings` at the print layer, which `test_spans.py`
covers in 5 checks. `test_revise.py` §16 was named for this entry and asked
whether any brief on `song_lines()` repeated a finding.

**It could not have said yes.** Measured 2026-08-21: no floor finding on that
song repeats a line at all — ANAPHORA_OVERLOAD 15 locations / 15 distinct,
CLICHE_PAIR 3 / 3 — and `SHARED_SUFFIX`, the code this entry is ABOUT, is not
emitted on it. The check passed over a population in which the defect could
not occur (doctrine 20), and the mutation confirmed it: restoring the original
`for ln in f.locations` left the section green.

**Repaired by giving it a witness, not by strengthening the assertion.**
`SUFFIX_PILEUP` is six lines in one mandate group with six `-ing` end words on
six different stems: 15 pairs, all homeoteleuton, and
`SHARED_SUFFIX.locations` comes back `[1,1,1,1,1,2,2,2,2,3,3,3,4,4,5]` — one
entry per PAIR, the exact fan-out shape. §16 check 1 now REFUSES if that ever
stops reproducing, so the section cannot go quietly vacuous again.

**AND THE TWO GUARDS ARE REDUNDANT, WHICH IS WORTH WRITING DOWN BECAUSE THE
REVERSE INFERENCE IS DANGEROUS.** Measured on that witness: disabling the
`seen` bucket alone changes nothing; disabling `dict.fromkeys` alone changes
nothing; disabling BOTH gives 5 / 4 / 3 / 2 / 1 blocks — the original defect
exactly. So **a green suite after deleting one guard is not evidence the other
is unnecessary**, and no single-substitution mutation can ever be caught here.
`quality/mutate.py` **QR7** spans the pair for that reason, and it is the only
mutation this code shape admits. Verified by hand at the time of writing —
disabling both guards reds §16 check 2, and dropping `f.code` from the dedupe
key reds check 3, the control — and QR7 applies cleanly in the 58/58 dry run;
the harness's own `--only QR7` pass was still in flight when this landed.

**Not one line of production code changed.** This is a test repair and a record
repair; the behaviour was already correct.

---

## TIER 2 — load-bearing defects with a measured cost

### 2.1 · `ltc.rhymes` uses the 詩 standard on 詞 `M-1` — `CLOSED 2026-08-21`
Returns True on **47.4%** of positions the 欽定詞譜 of 1715 marks as rhymes. As
shipped it reports Li Qingzhao failing to rhyme. Tabulating the false verdicts
recovers the 詞林正韻 partition from practice alone. **Fix shape is known:**
`standard='pingshui'|'cilin'` as a declared coordinate, the move
`check_cynghanedd` made for `language`.

**SHIPPED, AND THIS HEADING WAS THE LAST PLACE THAT DID NOT SAY SO.**
`MiddleChinese(standard=...)` takes `('qieyun', 'pingshui', 'cilin')`,
`rhymes()` takes a per-call override, an undeclared value is REFUSED rather
than defaulted, and a rhyme key names the standard that produced it
(`('平水第26部','平')` vs `('詞林第12部','平')`) so two standards' keys can
never silently compare equal. Every group pair M-1 named as recovered from
practice flips exactly as predicted — 東/冬, 魚/虞, 支/微, 蕭/豪, 眞/文 are all
False under `pingshui` and True under `cilin`.

**RE-DERIVED 2026-08-21, `python3 quality/test_ltc.py` §6, exit 0.** Against
the 欽定詞譜 of 1715 at the 1,844 positions it marks 韻/叶 across 413 of the
花間集's 500 songs (matching a 格 exactly on length AND 句讀, 60 詞牌):

| | 韻/叶 (mandated) | 句 (control) |
|---|---:|---:|
| 平水韻, as shipped | 78.4% (1393/1776) | 1.3% (7/520) |
| 詞林正韻 + 異體 map | **94.0%** (1723/1833) | 3.4% (18/535) |

**+15.6 pp on the mandated positions against +2.1 on the control** — the gap to
the control widens 77.1 → 90.6 pp, so this is not a standard that lifted
everything (doctrine 71). And 廣韻 54.1% < 平水韻 78.4% < 詞林正韻 94.0%: the
reference work's own granularity is the wrong one for BOTH forms, which is
doctrine 36 one rung further in than it was written.

**THE 47.4% IN THIS HEADING IS NOT THE FIGURE THAT WAS RE-DERIVED, AND CANNOT
BE.** It was measured on 1,518 later ci whose corpus was refused on an express
non-commercial grant (doctrine 85) and is not on disk. Different century of the
form, different pair construction — the two numbers are not comparable and are
not presented as a before/after. What replicates is the DIRECTION, the control
gap, and the 韻 pairs that fail. See `M-1` for the withdrawn denominator.

**Also rejected, by lift (doctrine 61):** merging 平 with 仄 inside a 詞林部
buys 韻 +0.4 pp against 句 +5.2 pp. 詞林正韻 keeps those halves apart and so
does this module; where a tune licenses 平仄通叶 that is the TUNE's licence to
grant, not the phonology's.

### 2.2 · `qieyun_mc.tsv` is keyed on one orthographic norm `M-2` — `CLOSED 2026-08-21`
**SHIPPED AS `data/qieyun_variants.tsv`, and the CC0 original is untouched.**
All 19 異體字 arrows read (`variants=True` reads 21 of 21 on the arrows plus
你 and 來; `variants=False` reads 1), 魂 resolves `via` 䰟, and the refusal
this entry's last sentence asks for is TWO methods rather than one —
`refusal()` for a character that does not read, `hazard()` for one that
reads and may be another word's. See `MISSING.md` M-2 for the full table and
for the declaration that stood here wrongly for two hours.

The character that NAMES the 魂 rhyme group cannot be looked up, while 477
characters carry 魂 as their label. ~~**23**~~ **19 of the 24 commonest
unreadable characters are recoverable by an 異體字 map** to a variant already in
the table — re-derived character by character against `data/qieyun_mc.tsv`:
19 of 19 have the source absent and the variant present, and all five of the
remainder are absent as the "correct refusal" reading requires. 23 + 5 = 28 > 24
and nobody had added it up (M-2, check C3);
the other five are vernacular characters postdating the rime book, where
refusal is correct — and nothing currently tells an ingestion defect from a
correct refusal.

### 2.3 · ~~`msa.py`'s apostrophe rule causes 82% of its own unreadability~~ **17%** `M-3` — `CLOSED 2026-08-11`
~~384 of 471 Malay failures are the syncope split leaving a vowelless
fragment~~ — **79 of 471**, re-derived 2026-08-11. 384 is the before-fix count
of vowelless tokens and only 79 of them came from the syncope split (`s'ri`,
`t'ada`, `b'ras`); the other 305 are whole tokens the rule never touched, and
they are the `d. s. b.` stub of §2.4. The arithmetic was right and the
ATTRIBUTION was not. The module already ACCEPTS the identical process spelled
without the apostrophe (`prang`, `Brapa`). **The fix is shipped and this line is
now a record, not a task.** `MISSING.md` M-3 has read `CLOSED` since 2026-08-11
and this heading did not say so, so the two files disagreed about whether a TIER
2 item was still owed — caught by `python3 quality/verify_entries.py`, shape
`STATUS_XREF`.

### 2.4 · ~~The `&c.` refrain stub is not an English convention~~ — **four traditions, three forms, and the Welsh one was `&c.` all along** `M-4` — `CLOSED 2026-08-21`
**TASK DISCHARGED — `M-4` STAYS OPEN.** The task this entry set was *read the
Welsh refrain pointer as Welsh*, and it is done and guarded. M-4 stays PARTIAL
on a different clause entirely: the Malay `d. s. b.` row's count is
`UNVERIFIABLE` because PG47873 — the 705-block source it was measured against —
is not on disk here, and the staged 129-block extract is a different population
(M-18). No amount of work on the Welsh pointer closes that, and marking M-4
CLOSED to make the two files agree would erase a real gap.

**WHAT THE ENTRY EXPECTED WAS NOT WHAT THE CORPUS HAD.**
`lyric_harness.CHORUS_STUB_FORMS` declares `eng` (`&c.`/`etc.`), `fin`
(`j. n. e.`) and `msa` (`d. s. b.`), each returning its LANGUAGE as a
coordinate through `chorus_stub_match` — which is the fix this entry asks
for. This entry's own last sentence says *"Welsh makes it four languages"*,
and `chorus_stub_match('Y gan a ganwyd, ac ati.')` returns `None` — which
turned out to be the CORRECT answer, because `ac ati` is not what the Welsh
corpus prints. ~~So the entry is PARTIAL rather than open or closed, and the
remaining work is one anchored pattern plus the corpus evidence for it.~~
~~**TESTED WHILE OPEN** — `test_spans.py` §8 guards the three that shipped
(`quality/triage.py`).~~ The remaining work was not a pattern; see below.

Finnish `j. n. e.` is **100%** of the two Kanteletar files' unreadable tokens
(16 tokens on 8 stub lines, CONFIRMED to the token); Malay `d. s. b.` is
**305 of 471** — the row that was withdrawn on 2026-08-11 and reinstated the
same day, because the withdrawing grep read the 129-block staged extract while
the claim was about the 705-block source (`M-18`). Both are end-of-line, so the
existing anchored regex extends directly. ~~Welsh makes it four languages.~~

**THE REMAINDER, MEASURED AND CLOSED — 2026-08-21.** This entry asked for one
more anchored pattern: a Welsh word for *et cetera*. There is none to add.
`ac ati`, `ac yn y blaen` and `a.y.y.b` occur **0** times line-final in the
staged Welsh; `&c.` occurs **33**, all in `corpus/song/cym_song_mynyddog.txt`
(1915 Ab Owen edition), and they are unambiguously Welsh lines —
`Rhowch, &c.` · `Ond dyma'r gwirionedd, &c.` · `Dysgwch ddweyd "Na," &c.`
The Welsh printer reached for the same Latin abbreviation an English one would.

So the defect was not a missing form, it was the TABLE'S SHAPE: one language
per form. Both failures doctrine 45 names followed from it —

    chorus_stub_match("Ond dyma'r gwirionedd, &c.")        -> ('eng', ...)
    chorus_stub_match("Ond dyma'r gwirionedd, &c.", 'cym') -> None

the first attributing a Welsh line to English, the second telling a caller who
KNOWS the line is Welsh that it carries no pointer at all — which is how 33
refrain pointers reach rhyme extraction as if they were sung text.

**THE FIX.** `CHORUS_STUB_FORMS`' first field is a **set of the traditions the
form is attested in**, not a language. `&c.`/`etc.` is attested for `eng` and
`cym`; `j. n. e.` for `fin`; `d. s. b.` for `msa`. Declaring a language answers
with that language and only tries the forms it attests. Leaving it undeclared
answers `(None, gloss)` when the form is shared — *`None` means cannot tell,
never a guess*, the contract `Phonology.rhymes` already carries — and still
answers `stub`, so every caller that only asks IS IT A POINTER is unchanged.
`chorus_stub_languages(line)` reports the attestation set.

**AND THE SET PAID OUT IN THE OTHER DIRECTION.** Five lines in
`corpus/song/fin_wahanen_laulukirja.txt` end in `etc.` and are NOT refrain
pointers — they are truncated source citations in editorial Finnish prose
(`Mukailtu C. M. Bellmanin teoksesta "Fader Berg i hornet stöter" etc.`).
**No punctuation rule separates them**, and that was tried: three Welsh and two
English lines carry the identical `"quoted," &c.` shape and ARE genuine
pointers (`cym_song_mynyddog.txt:935,947,960`,
`eng_british_richard_lovelace.txt:1273`, `eng_celtic_msm_richard_gall.txt:189`).
The refuted rule is kept as a check (doctrine 17) so nobody ships it without
re-refuting it. What separates them is the coordinate: `etc.` is not attested
for `fin`, so `language='fin'` drops all five with no heuristic at all.

`quality/audit_register.py` D6 already knew each file's language from its name
and threw it away. Asked with it, the derivation now reports
**989 eng / 33 cym / 9 fin / 0 msa**, and names the 5 undeclared fin matches as
*not that tradition's pointer* instead of counting them. D9 reads Welsh as
`cym/eng` rather than crediting M-4's Welsh row to English — the phantom
`_m4_stub_rows`' own docstring predicted, now answered rather than explained.

**GUARDED BY** `quality/test_spans.py` §8b, 19 checks, whose first check
re-derives the 33 from the file and refuses if the witness stops reproducing.
Three mutations confirm it is not vacuous: restoring the first-language guess,
dropping `cym` from the attestation set, and ignoring the declared language
fail 2, 8 and 9 checks respectively.

### 2.5 · ~~`RelationSchema.traditions` is declared on 77 schemas, populated on 0~~ — **75 of 77 populated** `M-15` — `CLOSED 2026-08-21`
**TASK DISCHARGED — `M-15` STAYS OPEN.** The task was *populate the field*, and
75 of 77 schemas now carry traditions — 298 distinct `Tradition` rows, 319
attachments, taken from `quality/RHYME_CANON.md` rather than invented from
schema names. M-15 stays PARTIAL because the fill has a gap of its own, filed
as M-15a: **every one of the 298 `Tradition.source` values is an `R<n>` pointer
back into `RHYME_CANON.md`**, which itself carries 611 `from:` references into
a survey array that is not in this repository, and zero publication years in
94 KB. From inside a clone the citation graph is closed. Populating the field
was the task; sourcing it is the capability, and it is still missing. Two
schemas — `blues AAB stanza` and `refrain by reference` — also still carry
none.
~~populated on 0~~. Measured by `python3 quality/audit_register.py --provenance`
(derivation D21): **77 schemas, 75 carrying traditions, 298 distinct `Tradition`
rows over 319 attachments**. The two with no tradition at all are `blues AAB
stanza` and `refrain by reference`.
**`MISSING.md` M-15 already recorded this and §2.5 did not**, so the two
documents disagreed with each other over one field — adversary 8's exact remit,
and the reason `python3 quality/verify_entries.py` exists.
**What is still owed is not population but WITNESS**: of the 298 rows, 212 are
externally witnessed, 26 are this project's own and 60 cannot be told — three
counts, doctrine 79 — and that is `MISSING.md` M-15a, still `OPEN`. The original
complaint stands only in the sense that "Middle Chinese 同用 rhyme" firing on
English was never the population problem it was written up as. `requires` is
populated on only 17 of 77 and that half is unchanged.

### 2.6 · `relations.py` counts have no matched control — `CLOSED 2026-08-21`
`search_k` is carried on every span and **nothing consumes it**. `internal
rhyme` returns 18,290 instances on 200 lines of Poe. Doctrines 56/61 apply
directly and there is no null.

**ALL THREE CLAUSES ARE ANSWERED, and `quality/relations_null.py` — whose
first line names this entry — is the answer.**

**The null exists, and it is FIVE nulls rather than one**, each recording what
it PRESERVES and what it DESTROYS, chosen PER PREDICATE and never per corpus
(doctrine 75), with the statistic chosen alongside it (doctrine 90) and the
observation routed through `NULLS['identity']` so a difference between
observation and replicate can never be the rendering (doctrine 91).

**`search_k` IS consumed.** `relations.search_burden()` reads it, and
`test_relations.py` pins the discrimination: a SEARCHED rule (`chain rhyme
(rap)`) reports `mean_k > 1` and a LOOKUP rule (`perfect rhyme`) reports
`mean_k == 1.0`. The defect that entry named — *"a count obtained by SEARCH
looked identical to one obtained by lookup"* — is now a failing check if it
returns.

**THE FINDING IS SHARPER THAN THE ASK, AND IT IS ABOUT THIS REPO'S OWN
HABIT.** `line_permutation` — the null used for Whitman, the Kalevala,
Bilhaṇa and the sonnet arms — **is the IDENTITY MAP** for `internal rhyme`,
`perfect rhyme` and Kalevala alliteration: 0 of 200 replicates differ by so
much as one instance, because none of the three declares a bounded
line-distance placement, so permuting whole lines moves no unit's line-final
status and no line's word multiset. It hands a clean p=1.0000 to anyone who
reaches for the obvious null. Doctrine 63 caught that shape in Finnish and
doctrine 68 in Persian; this is the third mechanism, inside this repo's own
relations layer.

**The 18,290 in the sentence above is superseded and NOT repinned as a
before/after** — the count reads 20,472 on the current corpus, and the point
was never the integer: it is that the integer shipped bare. It now ships
beside its nulls, its lift and the fraction of replicates that differ at all.

Under test in `quality/test_null_shapes.py` (27 checks, §5–8) and
`quality/test_relations.py`.

### 2.7 · ~~`fin.py` implements alliteration and nothing else~~ — BOTH SENTENCES WERE FALSE `M-6`, `CLOSED 2026-08-11`
~~No `rhymes()`. Nine of the ten staged Finnish files are rhymed strophic verse
whose actual constraint the module cannot check.~~
**This item was never true at the commit that wrote it, and on 2026-08-11 a cell
was briefed off it and sent to build a relation that already existed.**
`Finnish.rhymes()` landed at `f94383c`, whose own commit title is *"two of my own
MISSING entries were false"*; and `ls corpus/song/fin_*.txt | wc -l` returned
**11** at `debf64e`, not ten, with `fin_jaakko_juteini.txt` measuring a HIGHER
Kalevala-metre alliteration excess than the Kanteletar itself. The corpus half
is VOLATILE — other cells write that directory — so it is pinned to a commit and
re-derived rather than recorded. Full account in `MISSING.md` M-6 and
`quality/RESULTS_FIN_RHYME.md`; the instrument that would have caught it is
`python3 quality/verify_entries.py`, shapes `SYMBOL_ABSENT` and
`STAGED_FILE_COUNT`.

### 2.8 · ~~Five relations.py defects left OPEN by triage~~ `ALL FIVE CLOSED 2026-08-11 — THIS SUMMARY WAS STALE, REPINNED 2026-08-17`
~~`Span.unit` (needs the granularity ladder), `SpanRule.terminator` (duplicates
`magnitude`), chorus-stub line status, homograph knowledge sets, text-order
convention. All asserted as OPEN in the suite so closing one fails a test.~~

**THE WORK WAS DONE AND THIS LINE DID NOT FOLLOW IT.** Every one of the five
reached one of the three honest ends on 2026-08-11, and
`quality/test_relations.py::test_known_open_defects` asserts each closure — so
RE-OPENING one is now the test failure, exactly as closing one used to be.
Verified green 2026-08-17, 0 failures. What the five actually became:

- **`SpanRule.terminator` — DELETED.** Measured a strict function of
  `magnitude` across all 154 member rules, so it carried zero information;
  wiring it would have invented a semantics no schema asks for.
- **`Span.unit` — KEPT AND DECLARED INERT**, with the blocker named as
  `disjoint` rather than `build`: every piece exists (three phonologies
  declare `grid_unit='mora'`, all nine return Syllables, the consumer is in
  `rhyme_constraints.read_channel`) and no two are in one object.
  `check_inert()` re-derives it and fails in BOTH directions.
- **text-order — WIRED, and the earlier DECLINE was FALSE.** It had been
  recorded as "a naming decision, not a defect, for no measurable gain".
  Measured: 114 instances recovered across 17 asymmetric schemas, 72 of them
  TRUE, and ZERO on any of the 60 symmetric ones. `mosaic rhyme` alone
  recovered 69 true instances that existed only because the positional skip
  was removed — a schema's recall was a function of which member the text
  printed first.
- **chorus-stub line status — CLOSED as a declared coordinate.**
  `Stream.line_status` holds it; `relations.py` ships no detector and does not
  import `lyric_harness`, so the tokeniser is unchanged.
- **homograph knowledge sets — CLOSED both halves.** A channel may hold a
  `Readings` and an unresolved homograph reads UNDECIDED end to end, with an
  uncertain read acting as a WILDCARD in the candidate index so the pair
  survives to be refused rather than being deleted from the sample.

**The lesson is the entry, not the code.** A summary line that outlived its
subject by six days is the same defect as the coverage denominator that did
not follow its own repin (doctrine 91) — a rendering used as the source of
truth. Anyone reading this file for what is open was being told five things
were broken that the suite would fail if anyone re-broke.

---

## TIER 3 — corpus and provenance

### 3.1 · The clean Chinese route `K-7` — `CLOSED 2026-08-21`
**TASK DISCHARGED — `K-7` STAYS OPEN.** The task was *find and build a clean
route*, and it was built: 66 `ltc_siku_kr4j*.txt` files, 70 `data/sources.tsv`
rows, a runner, and a segmentation refusal that closed the last item said to
need a re-stage. K-7 stays PARTIAL on the thing no route can fix — the
digitiser of the 4,347 ci and 734 樂府 grants `資料自由使用，但不得為商業用途`,
an express NON-COMMERCIAL condition, which is a rejection and not a licence
(doctrine 85). Those texts are located, extracted, validated, measured and
REFUSED. The capability *the Chinese ci and yuefu are usable* is exactly as
missing as it was; what changed is that a different, admissible corpus now
stands beside the refusal (doctrine 92: admissible and complete sources can be
disjoint).
4,347 ci and 734 樂府 refused on an express non-commercial grant. The unblock
route carries **no living copyright**: `kanripo/KR4j` 白文 (文淵閣四庫全書, 1782)
segmented by the 欽定詞譜 (1715). ~~Needs a build; the pieces are all
reachable.~~

**THE BUILD LANDED THREE HOURS AND FIVE MINUTES BEFORE `MISSING.md` K-7 WAS
WRITTEN TO SAY IT HAD NOT** (`16cb073` 02:14 against `ad7edca` 05:19), and this
heading was written earlier still (`b5e73f7`, 00:04) and was merely stale. K-7
carries the full account; the short version is **10,029 ci across 687 詞牌 in
66 files**, `corpus/song/ltc_siku_kr4j*.txt`, every juan declaring
`BASEEDITION WYG`, segmented by `data/qindingcipu_ge.tsv` — 2.3× the 4,347 that
were refused, with no living copyright anywhere in either chain. **The refusal
still stands and the build re-acquires none of it by any door.**

**K-7 stays `PARTIAL`** and names what is left; one item of it is closed here —
see below.

### 3.2 · ~~ZERO named airs across EVERY non-English song staged~~ — **31, and `--- AIR:` was NOT the blocker** `M-11` — `CLOSED 2026-08-21`
**TASK DISCHARGED — `M-11` STAYS OPEN.** The task was *make the named-air rate re-derivable and find out whether the ZERO holds*. Both are done: the rate is a command, and the ZERO is false by 31. M-11 stays PARTIAL because its finding was never only about readability — Persian, Malay and Sanskrit still record **0** over 8,504 songs, and each for a reason no reader can fix (M-13's EPUBs carry no per-poem musical metadata, M-12's rāga and tāla headings are refused on licence, M-8's Welsh metre index does not exist).
The field the whole sourcing round was chasing. ~~The English corpus has 331 of
5,006.~~ ~~8,009 non-English songs~~ — **the denominator has moved and the ZERO
has not**, which is why this heading no longer carries one: `M-11` records the
per-prefix table, measured at run time, and the 0 is the finding and does not
depend on it. **There is no `--- AIR:` marker anywhere in `corpus/song/`.** The
declared markers are TITLE, SOURCE, AUTHOR, GE, RHYME, JU, SECTION, JUAN, RIME,
SYLLABLES, FROM, NOTE. The 331 reproduces exactly and is a **substring count** —
TITLE strings containing the word "air" anywhere, which includes *"The Birds Of
The Air"*. The figure the corpus supports is **318**, the `[air: NAME]`
convention, with a 13-title residue that is 9 ordinary uses of the noun and 4
airs under other conventions. **So the rarest field in the corpus is the one
field the corpus does not declare, and neither the 331 nor M-11's zero is
re-derivable until `--- AIR:` exists.** Declaring it is a one-line change to the
stagers and it makes two recorded numbers checkable.
The Gītagovinda's rāga/tāla headings exist and are CC BY-**NC**-SA
(doctrine 92: the admissible copy and the complete copy are disjoint).

**`--- AIR:` WAS NOT ADDED, AND THAT IS THE FINDING — 2026-08-21.** This entry
had already located the `[air: NAME]` convention and measured it (318 then,
**539** now over a grown `eng_`), and still concluded that a `--- AIR:` line
was needed before anything was re-derivable. It was not. The value is present,
in every case, in the title. What was missing is that **nothing SPLIT it**, so
`grid.MarkedSong.title` read `'CHWI FEIBION DEWRION  [air: Marseillaise]'` for
11,099 songs — the air was a substring of another coordinate rather than a
coordinate (doctrine 45). Writing a second line carrying the same string into
29,053 staged titles would have made a duplicate copy of one fact, which is
the defect this codebase spends most of its time deleting. If the owner wants
the literal field anyway it is a mechanical follow-on from
`split_named_air`; it is not a prerequisite for anything.

**SHIPPED.** `quality/grid.py` gains `split_named_air`, `named_air_kind`,
`named_air_census` and `MarkedSong.air`; `quality/audit_corpus.py:_items`
splits it too; `audit_register` D5 stops returning `UNVERIFIABLE` and reads
the whole corpus rather than `eng_` alone.

**MEASURED, two numerators, never summed** (doctrine 79):

| | songs | air of its OWN | air RESTATING the title |
|---|---:|---:|---:|
| M-11's five (`fas` `fin` `cym` `msa` `san`) | 9,857 | **31** | 0 |
| `eng_` | 8,667 | 539 | 0 |
| `ltc_` | 10,529 | 0 | 10,529 |

The 31 are Welsh (13) and Finnish (18) — `DAU FYWYD  [air: Rodney]`,
`MAALLENI.  [air: Ur svenska hjärtans djup en gång]`. The 10,529 are **not**
what falsifies the ZERO: a ci's title IS its 詞牌 and
`quality/build_ci_corpus.py:1137` prints one variable into both fields, so the
equality is guaranteed by the stager and is not evidence that anybody recorded
a tune. Counting them in would answer a different question from the one M-11
asks, and M-11's own text already drew that line before it was mechanical.

**AND THE SPLIT FOUND SOMETHING ELSE, filed as `M-20`.**
`audit_corpus.false_unit_items` compares body lines against other items'
titles, and a title with an air glued on could never be matched. Splitting it
gains 2 findings and loses 0 (19 → 21 corpus-wide, RUN-ON 9 → 11 over `eng_`):
Hogg's `LOVE IS LIKE A DIZZINESS` and Rodger's `BEHAVE YOURSEL' BEFORE FOLK`
are each staged TWICE in their own file — same opening line, ~25 shared long
lines — once with the air and once without. The near-duplicate pair check does
not carry them either (Jaccard 0.39 and 0.36, under the floor), so they were
invisible to both instruments at once for two different reasons.
**THE `2` IS THIS CHECKER'S YIELD AND NOT THE POPULATION — REPINNED
2026-08-21, and `M-20` holds the measurement.** Asking the corpus directly
(items inside one file sharing a normalised title AND opening line) returns
**28 pairs, 27 `eng_` and 1 `cym_`**, of which the near-duplicate check
surfaces exactly **one**. Three named causes with three counts, never summed:
8 dropped before comparison for holding under `ITEM_SIG_MIN` 8 long lines, 11
refused by `ITEM_SHARED_MIN` 8 despite containment as high as 0.88, 8 genuinely
under the 0.60 floor. And 28 is a floor: a third pair in Hogg (`THE WOMEN
FOLK`) is excluded by one letter (`sarely`/`sairly`). The gain of 2 recorded
above is exactly right about the SPLIT and says nothing about the corpus.

**GUARDED BY** `quality/test_grid.py`, 19 checks, whose census re-derives every
figure above from `corpus/song/` rather than pinning it; and
`quality/test_corpus_audit.py`, repinned to `RUN-ON 11` with the two named.

### 3.3 · The Persian edition gate is open on all ~~30~~ **31** files `M-13`
**THREE OF FOUR CLAUSES DISCHARGED 2026-08-11; THE ENTRY STAYS OPEN AND THE
DECLARATION WOULD BE WRONG.** This entry does NOT carry a `TASK DISCHARGED`
marker, deliberately: the fourth clause IS the gate this entry is named for,
it is open, and it cannot be closed from inside this container. Three clauses
struck individually below rather than as a block, because they were discharged
three different ways and only one of them is a dead end.

~~`ganjoor.net` is egress-blocked and the per-book منبع note lives only there.~~
**THE ROUTE WAS FOUND AND THE PREMISE IS PARTLY FALSIFIED**
(`data/sources.tsv:393`). The field is reachable in ganjoor's open source —
`GanjoorPaperSource` plus `GET /api/ganjoor/cat/{id}/papersources` — and the
finding is worse than "blocked": the value is a machine-scored `MatchPercent`
resemblance unless `IsTextOriginalSource` or `HumanReviewed` is set, so it is
not the editorial statement this entry assumed. Two dead ends were measured
rather than assumed: `ganjoor/ganjoor-db`'s dump has no source column, and
third-party dumps carry `paperSources` NULL 31 of 31. Six hosts 403-CONNECT.

~~`Erfi.epub` is a corrupt zip~~ — **CLOSED as NOT_FOUND**, not pending repair
(`data/sources.tsv:394`, `NOTE:erfi-epub-is-truncated-not-merely-corrupt`):
2,920 bytes, 7 local headers, **0 central-directory entries**. It is truncated,
not damaged; there is nothing in it to recover.

~~Bābā Ṭāhir's do-baytī (366 poems, a sung Luri form) is present and unstaged.~~
**STAGED** — `corpus/song/fas_baba_tahir_dobayti.txt`, 144,360 bytes, 366
poems, 366 `--- SUNG-EVIDENCE: form` blocks, row at `data/sources.tsv:395`,
with the form declaration MEASURED via `quality/phonology/fas.py` (AABA 233
against a null max of 3).

**15 on-list poets still have no ghazal section** (`MISSING.md:1750`), and the
edition gate is open on all **31** — `ls corpus/song/fas_* | wc -l` is 31, not
30, and `data/sources.tsv:393` says so in as many words. Closing it needs
egress to `api.ganjoor.net` or `naskban.ir`, currently 403. There is also no
edition COORDINATE in code to close it into: `gate_corpora.py` and
`provenance.py` have no edition gate, and the only one implemented is
`quality/phonology/ltc.py:220 EDITION_TABLES`, Chinese-only.

### 3.4 · ~~Finno's 1583 hymnal — the cheapest open probe left~~ — **probed, located, egress-blocked, and not cheap** — `CLOSED 2026-08-21`
~~Sung by definition, printed four centuries ago, needs no rights argument, and
`doria.fi` / `kansalliskirjasto.fi` were **never probed**. A guess standing
where a measurement should be.~~

**IT WAS PROBED TEN DAYS BEFORE THIS ENTRY WAS READ AGAIN.**
`data/sources.tsv:392`, `SEARCH:finnish-hymnal-finno-hemming-2026-08-11`,
headed *RE-PROBE OF A COMMITTED ROW* and citing doctrine 49 against the
earlier attempt at `data/sources.tsv:258`. **Twenty-one hosts, all 403
CONNECT**, read from the proxy's own `recentRelayFailures` rather than
inferred from an exit code — including both this entry names by name
(`doria.fi`, `www.doria.fi`, `kansalliskirjasto.fi`,
`www.kansalliskirjasto.fi`, `digi.kansalliskirjasto.fi`, `finna.fi`,
`kansalliskirjasto.finna.fi`, `api.finna.fi`) and thirteen more.
`data/lyricists.tsv:334-336` carry the matching NOT_FOUND rows for Agricola,
Finno and Hemming. So *never probed* was false, and this entry is a guess
standing where a measurement already was — the failure it was written to name,
in the entry itself.

**THE PROBE PAID FOR ITSELF AND CHANGED THE ANSWER.** Both copies are located:
Hemming's complete hymnal is printed **Rostock 1607, not 1605**, digitised at
`digital.slub-dresden.de/werkansicht/dlf/114166/1/`, shelfmark
Lit.var.167,misc.1, title page CC-BY-SA 4.0; Finno's c.1583 survives in ONE
known copy, incomplete, at Uppsala. That is doctrine 92's third category
refined — **complete, digitised, rights-free and egress-blocked**, on a GERMAN
host nobody had probed because the search had been framed as Finnish. It also
paid out sideways: the same probe found `GITenberg/Wahanen-Laulu-kirja_72965`
(`data/sources.tsv:390`), now staged as
`corpus/song/fin_wahanen_laulukirja.txt`, whose 18 named airs are 18 of the 31
that falsify M-11's ZERO (§3.2).

**AND IT IS NOT THE CHEAPEST PROBE LEFT.** The surviving text is page images
of 1607 blackletter Finnish, so acquiring it needs egress to
`digital.slub-dresden.de` or `alvin-portal.org` AND an OCR pass over Fraktur —
a different order of cost from what this heading claims. The next attempt
should ask for those two hosts by name.

### 3.5 · ~~The negative control is still Whitman alone~~ — **replaced 2026-08-11; the entry was ten days stale** `K-2, K-3` — `CLOSED 2026-08-21`
**TASK DISCHARGED — `K-3` STAYS OPEN.** The task was *build the replacement*,
and it was built the same day this entry was last touched — the entry simply
never said so. `K-3` stays OPEN because it is a FINDING about Whitman, not a
task: the Whitman negative control does not separate, and building a better
control does not make that stop being true. It reproduces and WORSENS under
power — Whitman P3 = 0.1733 against a null max of 0.1800 at n=200.

~~All four recorded Whitman figures sit inside one line-permutation null. The
replacement is the corpus's own shuffled self plus a multi-author positive.~~

**BUILT: `quality/negative_control.py`**, 49,805 bytes, whose first line reads
*THE REPLACEMENT NEGATIVE CONTROL. MISSING.md K-2 / K-3, BACKLOG §3.5.* It is
exactly the two things this entry specifies: the negative is the corpus's own
shuffled self (`line_permutation` per quatrain, matched on author, period and
vocabulary BY CONSTRUCTION rather than by selection), and the positive is
multi-author, drawn from 1,297 `eng_*` files and reported per tradition group.
Five arms — `arm_scheme`, `arm_chains`, `arm_whitman`, `arm_spans`,
`arm_langs` — with Whitman RETAINED as the legacy comparator rather than as
the control, which is the distinction the entry asks for.

**RUN 2026-08-21** (`--n=20 --cap=2 --skip-chains`): P1 differs 0.0%, the
identity map the derivation predicts; P2 TV **0.2649 against a null max of
0.0294**, gap +0.2355; 7 strata measured, all 7 separating under both
statistics, 15 distinct quatrain schemes. Write-up in
`quality/RESULTS_NULL_SHAPES.md` §1–§4, guarded by `quality/test_null_shapes.py`
(27 checks). The *never eligible* finding is staged in code and not only in
prose: `quality/audit_band_control.py:30` records it and RESULTS_NULL_SHAPES §2
measures it — 7 of 9 Whitman chain links are same-token REPEATs, 115 distinct
final tokens over 150 lines.

~~**Owed, and it is bookkeeping:** five cells of `negative_control.py`'s own
docstring table have drifted with the corpus (`eng_british`, `eng_hymn`, and
the ALL-stratum TV 0.2456 → 0.2477), already diagnosed at
`quality/RESULTS_NULL_SHAPES.md:582`.~~

**RE-DERIVED 2026-08-21, AND IT WAS NOT BOOKKEEPING.** The arm was re-run at
its own declared parameters (n=200, seed 20260811, cap 8) rather than the five
cells being hand-edited, and the diagnosis above turned out to be stale too:
not five cells and not two groups, but a different population — **792
quatrains / 115 files / 6 tradition groups → 4,217 / 712 / 9**, with three
groups (`eng_hbv`, `eng_oxford`, `eng_pah`) that did not exist when the table
was written. ALL-stratum TV is **0.2638**, not the predicted 0.2477, and the
null's MAX FELL from 0.0394 to 0.0188 — gap **+0.2061 → +0.2451**, lift
20.7× → **41.7×**. More material moved the result the way a real effect moves.

**Two of the moves are findings.** `eng_celtic` was the ONE failing stratum
(−0.0310, inside its own null) and it is the reason `P2b` was written; it now
SEPARATES at **+0.0982**, and the summary reads *9 measured, 9 separate under
BOTH statistics, 0 under neither*. P2b is kept regardless — a second
independent reduction of the same null is worth having, and deleting it would
erase the question — but the present-tense claim that a failing stratum EXISTS
is struck rather than carried (doctrine 17). And Whitman's P3 gap went −0.0067
to **−0.0333**: `K-3` does not merely reproduce under more power, it gets five
times worse, which is why that half stays open.

### 3.6 · Corpus adversary (adversary 5) `BUILT 2026-08-11`
Systematise doctrines 50/52/53: a runner that checks every `corpus/` file
against its `sources.tsv` row — declared language vs measured readability,
md5 vs recorded, licence path vs actual path, and the channel-specific
orthography check that caught the Háttatal OCR.
**MET**, at `c661b93`: `quality/audit_corpus.py`, results in
`quality/RESULTS_CORPUS_AUDIT.md`, regressions in
`quality/test_corpus_audit.py`. Its first run found that **42.3% of the
Coleridge file is Wordsworth**. §0's row said `ad hoc` for a week after it
landed — the STATUS column is a judgement and stays one, but the instrument
column is a path and `python3 quality/verify_entries.py` now checks it.

---

## TIER 4 — instrument honesty

### 4.1 · The time layer's α is not controlled `L-1` — CAUSE FOUND, LEVERS MEASURED 2026-08-11, TASK DISCHARGED — `L-1 STAYS OPEN` — `CLOSED 2026-08-21`
**AND IT WAS HELD OPEN BY AN INSTRUMENT, NOT BY WORK.** This heading has said
`TASK DISCHARGED — L-1 STAYS OPEN` since 2026-08-17, in prose, while the entry
kept reading OPEN — because `quality/verify_entries.py`'s `STATUS_XREF`
required a BACKLOG entry and its MISSING half to agree about being done, and
marking this one closed against an open `L-1` reported FALSE. The register was
lying in the only direction the checker allowed. That declaration is READ now
(doctrine 48), so the entry can say the true thing: the task is finished, the
capability is not. Nothing about the work changed on 2026-08-21.
~~"5.4% against 5.0%" is n=6; at n=20 it is 9.6%.~~ The guarding test runs three
sonnets and asserts only `mean < 0.20`, which cannot detect a 2× miss.

**The n=6 was the smaller of two defects.** `rhyme_events` measured each
position's Šidák family over the pairs that PASSED the band (median 6–13), not
over the comparisons made (89 on a quatrain, 176–265 on a sonnet), so neither
5.4% nor 9.6% was a false-event rate at the declared α. **`RESULTS_FWER.md`'s
headline is void.** All four `test_fwer.py` assertions pass again with every
constant replaced by the quantity it stood in for — saturation by `1−(1−r)^m`
from the measured per-pair FPR, the α tolerance by `α + 2 s.e.` over 1,321 slot
decisions (n=20, 6.2%, which CAN detect the 2× miss), the band-pass guard by 2×
the measured max over 30 real sonnets.
~~**Still open, and the open part moved:** at the honest family the layer cannot
produce an event at all — at `null_samples=2000` the Šidák cut (2.5e-4) sits
BELOW the p-value floor (5e-4). **Owed: `null_samples` and `window`, measured
against the candidate family.** Not a corpus, and not a fourth instrument.~~

**THE OWED MEASUREMENT WAS MADE ON 2026-08-11 AND THIS LINE DID NOT FOLLOW IT
— REPINNED 2026-08-17.** `quality/time_attainable.py` is the runner and
`quality/RESULTS_FWER.md` §"THE LEVERS, MEASURED — and the layer cannot speak"
is the write-up. **Both named levers are dead, and the arithmetic is the same
in both cases.** Verified green today: `quality/test_fwer.py`, all regressions
pass.

**And the diagnosis in the struck sentence was wrong in an instructive way.**
`min_p` is not sitting on a resolution floor — it is reporting a RATE.
`_pvalue` returns `(ge + 1)/(n_valid + 1)`, and for the best pair in a real
sonnet every one of the 40-83 draws at or above it is an exact TIE at 1.000
with ZERO strictly above: the comparator saturates at a perfect rhyme, so
`min_p` converges on the density of perfect chance re-pairings. **Raising
`null_samples` estimates that rate MORE PRECISELY rather than lowering it, and
it estimates it UPWARD** — 3.998e-3 at 2,000 draws, 4.200e-3 at 20,000,
4.415e-3 at 200,000. A 100x more expensive null makes the gap WORSE. Doctrine
57 warned about an empirical p sitting AT `1/(n+1)`; this is the complementary
trap, a p sitting far above it and reporting a rate.

**The real gap is a factor of ~10, not 1.4.** `M_NEEDED = ln(1-alpha) /
ln(1-min_p)` is 18-28 across the corpus against a median family of 198-217 at
the registered window. The 1.4x in the earlier record compared `min_p` against
the LOOSEST cut in the item — the cut at the smallest family, at a position
where the best pair almost never sits.

**So the honest state is that the layer is MUTE at an honest family size, and
that is a finding rather than a defect** (doctrine 20 — "cannot tell" is an
answer). Not owed: a second corpus, a fourth instrument, more `null_samples`,
a narrower window, a shorter `max_span`, or more text. All six were measured
and none is a route.

**THE BACKLOG TASK IS DISCHARGED AND `MISSING.md` L-1 STAYS OPEN, which is not
a contradiction.** This entry owed a MEASUREMENT and the measurement is made.
L-1 records a missing CAPABILITY — a false-event rate controlled at α — and
the capability is still missing; what changed is that its absence is now
arithmetic rather than an unexamined hope. Marking this entry `CLOSED` while
L-1 read `OPEN` was caught by `quality/verify_entries.py`'s STATUS_XREF check
on the first run after the edit, which is the check doing exactly its job: a
task one can finish is not the same object as a gap one cannot.

### 4.2 · Real sonnets do not separate from scrambled text on event rate `L-2` — MECHANISM FOUND, AND THE OWED NULL DELIVERED — `CLOSED 2026-08-21`
**TASK DISCHARGED — `L-2` STAYS OPEN.** The task was the mechanism and then
the null it asked for; both are done, and the null is measured USELESS, which
is a result and not a reason to keep the task open. `L-2` stays OPEN as a
capability: real sonnets still do not separate from scrambled text, and every
lever that could have made them is dead.
~~10.9% observed vs 9.6% word-scramble, p=0.095.~~ Until that separates, a null
placement result cannot distinguish "no periodic organisation" from "nothing to
organise."

**And it can never separate, because the word scramble is an identity map for
this statistic.** At 20 items per arm the two score identically — 29.1% vs 29.0%
at `m` = scored, 0.0% vs 0.0% at `m` = candidate — because an item's smallest
attainable p is set by how many chance re-pairings of ITS OWN spans are perfect
rhymes, and a word scramble preserves the span multiset exactly. Doctrine 63/68
in a fourth place. ~~**Owed: a null that destroys the span multiset — across items
rather than within one.**~~

**THE OWED NULL WAS BUILT TWICE, INDEPENDENTLY, AND MEASURED USELESS —
REPINNED 2026-08-21.** This entry kept printing an `Owed:` line for something
that has existed for ten days.

1. `quality/controls.py:176 cross_item_redeal` (with `rime_pool_redeal:253` as
   the detection floor), driven by `negative_control.py:631 arm_spans`, whose
   docstring names `MISSING.md` L-2. Result in `RESULTS_NULL_SHAPES.md` §3:
   real `band_pass` **0.0572**, scramble **0.0601**, cross-item redeal
   **0.0599** — the purpose-built null PRESERVES the very quantity it was
   commissioned to destroy, moving `min_p` 0.94× against the scramble's 1.15×,
   over a detection floor spanning 51× (0.00059–0.03040).
2. `RESULTS_FWER.md` *Lever 5 — a cross-item null. MISSING L-2's ask,
   delivered, and it is not enough*: pooled perfect-pair rate 0.0028 → 0.00175,
   `M_NEEDED` 21 → 28. **A 1.3× improvement against a 9.4× gap**, and at
   window 2 the scramble SATURATES HIGHER than real verse (3.15% vs 2.68%) —
   the sign flips.

Green: `quality/test_controls.py`, `quality/test_null_shapes.py` (27 checks).

**No buildable task remains here.** All six measured levers are dead, so
closing `L-2` is a layer redesign — a declared beat — and not a backlog item.

### 4.3 · Taxonomy adversary (adversary 6) `BUILT 2026-08-11`
Every named entry in `RHYME_CANON.md` and `relations.py` must cite a source
that is not this repo. `gabay higaad` was reconstructed from our own modules
and the truncation "converted an external check into a self-confirmation."
**Acceptance:** a runner that lists every name with no external citation.
**MET.** `python3 quality/audit_register.py --provenance` lists them. Every
figure below is that runner's current output; the struck ones are what this
section recorded and are kept because two of the four moved for a reason inside
the runner rather than inside the canon.
- **117 named structures**, of which ~~117~~ **112** carry no external citation
  *in the §2 block itself* — that detector reads a year or one of six repo names
  and does not see the `- witness:` lines, and §4b is the repair's measure.
- ~~611~~ **781** `from:` references over **594 distinct indices**, counted
  MULTI-LINE. The 611 is the single-line rule, and the runner names it **as its
  own doctrine-58 error** rather than quietly replacing it.
- ~~0~~ **25** publication-year tokens in the file — the 0 was the sharpest
  single finding here and it has been repaired.
- **19** names whose only witness is this project, superseded by §4b:
  `quality/canon_index.tsv` declares **601** indices and **116 of 117** named
  structures now reach a witness outside this project, 1 reaches none.
- `relations.py` hangs **298 `Tradition` rows over 319 attachments** off 77
  schemas, of which 75 carry traditions. ~~every `Tradition.source` is an `R<n>`
  pointer~~ — **212 are externally witnessed, 26 are this project's own, 60
  cannot be told**, three counts and not a rate (doctrine 79).

**The gap it found is now `MISSING.md` M-15a and is OPEN**; the runner is done,
the repair is partial.

### 4.4 · ~~`rhyme_constraints.py` — 1,325 stranded lines~~ `DECIDED 2026-08-11`
~~The only genuinely stranded module.~~ `quality/rhyme_constraints.py` is ~~1,652~~ **1,738** lines (repinned 2026-08-22: the M-38 quantifier reconciliation added the shared vocabulary table, the `Selection.__post_init__` gate and their comments. The argument this figure supports — that the module is large and is KEPT on a stated ground — never rested on the third digit) (~~1,566~~, ~~1,609~~, ~~1,611~~ — 2026-08-15's dead-coordinate lot removed the `tie_break` knob and stated its rule at the two enforcing sites, and wired `surfaces` — the inert-coordinate cell added the `Span.unit` and `Span.terminator` docstrings, which is growth in the file's OWN account of why it is kept; the 2026-08-13 doc-cleanup cell added four more correcting a comment that compared this module's exit behaviour to `battery.py`'s, which stopped holding at `9396946`).
It has an `if __name__ == "__main__"` and non-test callers.
(The line count is now stated in a sentence naming exactly ONE module, because
`python3 quality/verify_entries.py`'s `MODULE_LINE_COUNT` shape REFUSES a count
whose module is ambiguous and the previous phrasing named three in one breath.
~~The 1,566 is `wc -l` and `str.splitlines()`, which agree. `audit_register.py`
D22 prints **1,567** for the same file~~ — **BOTH FIGURES STRUCK AND NOT
REPLACED, 2026-08-16.** They were quoted in the PRESENT TENSE ("The 1,566 IS",
"D22 PRINTS") five lines under a strike of 1,566 itself, so this one section
stated the same quantity struck and unstruck at once; the file is 1,652 today
and D22 prints 1,653, so the drift had reached 86.
THE REASON NOTHING CAUGHT IT IS THE SENTENCE ABOVE, INVERTED. `MODULE_LINE_COUNT`
was already live — it resolves the **1,652** at the head of this cell — but it
matches a count followed by the word `lines` beside exactly ONE module name,
and these two said "for the same file" instead of naming it. So the paragraph
explaining that the count must name one module was itself the paragraph that
did not, and it sat directly beneath the fix it describes.
NO THIRD PAIR OF NUMBERS IS WRITTEN HERE. The count has ONE home in this cell
— the `**1,652 lines**` claim above, which `MODULE_LINE_COUNT` re-derives every
run — and what is restated here is only the CONVENTION, which does not rot:
`wc -l` and `str.splitlines()` agree with each other; `audit_register.py` D22
computes `src.count("\n") + 1` and therefore reports exactly one MORE than
either, for any file ending in a newline. That is an off-by-one in the auditor,
not a drift in the module, and it is written up in this cell's
`PATCHES-not-mine.md` rather than patched from here. `MISSING.md` M-16 repinned
its copy of these figures and this one did not, which is that entry's own
sentence — *"Two registers, one file, two answers"* — coming back true with the
registers swapped.) **Both branches were taken, and the file says which and
why:** the knowledge sets are mined into `relations.py` — `Syllable` fields may
now each hold a scalar or a `Readings` frozenset, with the TYPE as the marker so
there is no flag to forget — **and** the module is kept as a comparison runner
on a stated argument. Its P6 defect (`apply_pred`'s `PRESENT_ON` testing
whole-channel emptiness) is deliberately left unfixed, because patching it to
agree would spend the only property that justifies keeping it. That is the shape
a "keep it" decision has to have.

### 4.5 · Doctrine has drifted to auditing `L-5` — `DONE 2026-08-11`
~~**102 numbered doctrines**~~, and roughly half the recent ones are about null
hypotheses. A future session reading `CLAUDE.md` learns to audit rather than to
write. Needs a split: a short WRITING doctrine and a long METHOD appendix.

**DONE**, in commit `d11ca0a` ("Split the doctrine file: 20 for writing, 75 for
method, numbering intact"). ~~In progress~~ — **95** doctrines, **20** in
`CLAUDE.md` and **75** in `quality/METHOD.md`, one global non-contiguous
numbering so `doctrine 79` is still doctrine 79, checked by
`python3 quality/verify_doctrines.py` across 2,090 citation sites.

> **~~102 (27 + 75)~~ — where the 102 came from, because the arithmetic is the
> lesson.** `CLAUDE.md` carries TWO numbering systems that do not collide: the
> doctrine run, and a `Known gaps` list of 7 cited elsewhere as `known gap N`.
> Both are written `^\d+\. \*\*`, so a bare regex over the file returned **27**
> where the doctrine block holds **20**, and 27 + 75 = 102. Two runs added
> together as if they were one. The fix is not a better regex — both files
> delimit their run with `<!-- DOCTRINE-BLOCK -->` markers precisely so a
> counter can tell the lists apart, which is what `verify_doctrines.py` reads
> and what `quality/counters.py` calls rather than re-parsing.

### 4.6 · The ENTRY CLAIMS of this file and `MISSING.md` `BUILT 2026-08-11`, and mostly UNCHECKED
`quality/counters.py` made the table at the foot of this file an OUTPUT. **The
counters were fixed and the ENTRIES were not**, and the cost was measured: a
cell was briefed off §2.7 / `MISSING.md` M-6 on 2026-08-11 and sent to build a
relation that had shipped at `f94383c`.

`python3 quality/verify_entries.py` is the fourth instance of this repo's one
working move — `verify_doctrines.py`, the `wiring` verb, `counters.py`, this —
and it is deliberately SMALL. It carries **eight declared claim SHAPES**
(`SYMBOL_ABSENT`, `HASATTR`, `REPO_PATH_EXISTS`, `STAGED_FILE_COUNT`,
`MODULE_LINE_COUNT`, `CORPUS_MARKER_ABSENT`, `CORPUS_TABLE_ROW`,
`STATUS_XREF`), reads statuses by CALLING `counters.missing_entry_statuses()`
rather than re-parsing them, and reports `audit_register.py`'s 26 derivations
without re-deriving one of them.

**What is still owed is the refused count, and it is the honest headline.** At
commit `ad7edca` it asked **881** claims, answered **81** and refused **800** —
every one of the refusals `NO_SHAPE`, meaning no declared shape recognises the
sentence. **Those three counts move with every entry anyone writes**, so they are
pinned to a commit here and re-derived by running the command, never read off
this page. That number is not a defect to be optimised away. Some of that
remainder is not mechanically checkable at all (doctrine 6's "the exchange rate
between surprise and clarity is not derivable" has no instrument and never
will), and the checker deliberately does NOT try to separate "unshaped because
it is a judgement" from "unshaped because nobody wrote the shape yet", because
that separation needs a reader. **The way to bring the number down is to declare
another shape, never to loosen one.** Candidates the sweep already surfaced:
a claim of the form "N of M rows in `data/*.tsv`", a table whose row count
contradicts the sentence introducing it, and a `%` stated without its
denominator.

**Acceptance, met:** non-zero exit on a false claim; three counts, never a rate;
every shape carries a TRUE probe and a FALSE probe so a clean run is a null with
a positive control behind it (doctrines 31, 76); a shape matching no live
segment is printed `[dead]` rather than passing quietly (doctrine 28).

**AND THE REMAINDER WAS MEASURED RATHER THAN ESTIMATED, 2026-08-16.** A
standing audit had flagged **13** stale-record findings across `CLAUDE.md`,
`MISSING.md`, `BACKLOG.md`, `ci.yml`, `revise.py`, `audit_corpus.py` and
`verify_doctrines.py`. All 13 were RE-MEASURED against the tree before any was
touched — the standing rule since two consecutive lanes found the audit
substantially stale — and **4 had closed on their own**: `ci.yml`'s file census
(repinned 2026-08-15, and `ls quality/test_*.py` is 48 = 44 + 2 + 2 today),
the `grade()`/`admits()` divergence (closed by the 2026-08-15 `NO_RELATION`
fix — the recorded counterexample now returns a violation when measured), and
two counters rows (cleared by `--write`). **9 were live and are repaired here.**

**The headline is the coverage number, and it is bleak.** Of the 9 live stale
records, exactly **ONE** was inside a live instrument's reach: §4.4's line
counts, which `MODULE_LINE_COUNT` REFUSED for `AMBIGUOUS_SCOPE` because the
sentence said "the same file" instead of naming the module — a refusal that is
doctrine 20 working correctly and reporting nothing anyone read.
**ONE MORE WAS VISIBLE AND BLESSED, WHICH IS WORSE THAN UNSEEN.**
`audit_corpus.py`'s marker list did not recognise the phrasing three
`sources.tsv` rows use for a recorded failed search, so it printed a doctrine
34 WARN at a row obeying doctrine 39 — and `PINNED_SHAPE` had that WARN in its
committed count, so `--verify-shape` returned PASS **because** the wrong
verdict was being produced, and would have gone RED the moment it was fixed.
A pin records what a run DOES, not what it SHOULD do; pinning a shape freezes
its defects alongside its findings, and the only thing that separates them is
a reader. That is the price of pinning, and it is worth paying — but it is a
price, and this is what it looks like. The other
**7 were outside every instrument in this repo**, and 3 of them sat in files
whose own prose claims a check: a docstring saying "the print is what stops
that claim from going stale" (the print never read the docstring), a paragraph
saying "a number restated in prose beside its own counter is the next thing to
drift" (restating a number beside its own counter), and an auditor comment
saying "an auditor that reports it as a defect is punishing the table for
working" (reporting it as a defect).

**And the dominant failure mode is not carelessness — it is LATENCY.** 4 of
the 9 were TRUE WHEN WRITTEN and falsified afterwards by a commit that did not
revisit them, **two of those within the hour**: the annotation count went
false **11 minutes** later (`be3ad5a` 00:02:21 -> `f570fbe` 00:13:48), and
`sun/much`'s "Remaining" went false **21 minutes** later (`01a6e1c` 01:01:33
-> `0c3a0b1` 01:22:57). A record can be stale before its author has finished
the session that wrote it, so "check the records at the end" is not a
schedule that works.

**The third has a different mechanism and is the one worth generalising.**
Gap 6's `data/sources.tsv:271` citation went false with NOT ONE CHARACTER OF
THE SENTENCE CHANGING, and with nothing about Welsh changing either: `7ab38df`
(2026-08-14, *"two editions were named in a corpus header and had no
provenance row"*) inserted two unrelated English rows at positions 211 and
220, and every citation below them slid by 2. So `:271`/`:272` — written to
mean two `NOT FOUND` rows — came to mean a SATISFIED public-domain row and a
RIGHTS REFUSAL, which is the worst possible pair to confuse for a sentence
about what is blocked. **A line number into an append-only table is not an
address, it is an offset from a moving origin**, and it can be invalidated by
an edit that never touches the subject, the sentence, or the file the sentence
is in. Every remaining `data/sources.tsv:NNN` citation in this repo carries
that latent. Gap 6's are by `source_id` now.

**What this buys the shape list.** Every repair above was written to be
strike-and-date rather than overwrite (doctrine 17), and where a count could
not be put inside a command's reach it was **struck and NOT replaced** — five
of the nine now name the constant and the command instead of a digit, because
a corrected number in the same unwatched place rots on the same clock. The
candidate shapes this sweep surfaced, in priority order: **a `path:NNN`
citation into a tracked TSV** (mechanically checkable — resolve the row and
assert the id, which would have caught gap 6 and would catch the rest), **a
`len(CONST)` claim about a named module constant** (would have caught gap 7's
`VARIATION_KINDS`), and **a docstring figure that the same module's own run
prints** (would have caught `verify_doctrines.py`). None is built; they are
listed here rather than asserted as coverage.

### 4.7 · The three "cosmetic" findings, and why two of them were not `CLOSED 2026-08-16`

The same audit filed four findings as **cosmetic**. One (gap 6 filing the
Welsh prose arm under "WHAT REMAINS BLOCKED" when its own source says
*Blocker: **neither***) was repaired with the stale records, since it was the
same sentence. The other three are here, and re-measuring them moved two out
of the cosmetic class entirely.

**`--isochronous` on `verify` was NOT cosmetic — it was the only coordinate in
the CLI that could be READ, CHANGE THE ANALYSIS, and leave no trace.** The
audit had reported it honestly as neither read nor inert: it could not
construct an input that distinguished the two runs, so under doctrine 20 it
refused to call it either. Measured now, at the API: `Reviser.inspect` with an
`Isochrony` RETIRES the `NO_SETTING` refusal from `whole`, and on `brief` it
also adds `EVEN_DIVISION_LANDINGS` and four `TUPLET_REQUIRED`. So the
coordinate was read the whole time. **`verify` could not show it because
`verify` prints a SET DIFFERENCE** — verdict plus fixed/broken/untargeted/
modal_taken — and the flag moves the BEFORE and AFTER drafts identically, so
everything it adds or removes cancels. Byte-identical output, measured, on a
pair where `--subdivision 2` does change the verdict body.
**IT WAS ONE VERB, NOT THE FLAG, AND THE FILE ALREADY PROVED THAT.**
`quality/test_verbs.py` §29 has asserted since 2026-08-15 that `song` with
`--subdivision 1`, `--subdivision 2`, `--isochronous` and none of them
produces FOUR DISTINCT reports — so the coordinate was demonstrably visible on
`song`, and it is visible on `fit` (`NO_SETTING` ×2 gives way to `ASSUMED`)
and on `brief`. `verify` alone could not show it, because `verify` alone
reports a DIFFERENCE rather than a state. §32 is therefore not a second copy
of §29: §29 pins that the flag is read, §32 pins that the verb which cannot
show a read flag says so anyway.
The fix is the disclosure, not the analysis: the `BLUEPRINT:` banner named
`subdivision` in BOTH states (declared, or refusing to assume one) and named
isochrony in NEITHER, so a reader saw one meter coordinate disclosed and
reasonably read that as the set. It now names both, and the two runs differ.
Doctrine 1, and the sharpest case of it in this repo: **an analysis states the
coordinates it ran under, INCLUDING the ones whose effect cancels** — those
are exactly the ones no output will reveal.
*A method note worth keeping: the first measurement of this said the flag was
byte-identical on `brief` too, which would have made it a much larger defect.
It was wrong — the run had REFUSED on a scheme/draft length mismatch and never
reached the meter layer at all. A byte-identical pair of refusals is not
evidence about a coordinate neither run consulted.*

**`collisions N` was one number for three kinds.** It sat at the end of the row
that keeps `mandated`/`judged`/`refused` apart for doctrine 79, summing a set
`_collision_code` splits into three codes *because* "they are three different
reports": an unintended RHYME, a pair that is NOT a rhyme under this harness's
own band, and the same word twice. A writer does something different about
each. Measured on a four-line refrain: `collisions 4` was two REPEATs and two
rhymes. It is now `collisions 4 — unasked-rhyme 2  same-word 2`, on its own
line rather than appended to counts it shares no denominator with (a collision
is a pair the mandate did NOT ask about). `quality/test_verbs.py` §32 pins
both, and asserts the kinds SUM to the total so a code added to
`_collision_code` and not to the label map cannot vanish from the breakdown
while the total still counts it.

**A WITHDRAWN FINDING FROM THIS SAME LANE, AND IT IS THE MOST USEFUL THING IN
IT.** While repinning the report header I re-ran `RESULTS_REVISION_LOOP.md`
§6's ledger row — `mandated 8   judged 8   refused 0   violations 0
collisions 26`, marked **REPRODUCES EXACTLY** — measured **69**, and recorded
that the total had gone stale and the cause was unknown. **That was wrong. The
row was right the whole time.** The 69 came from running
`quality/fixtures/mandate_song.txt` when §6's input is
`examples/never_been_to_a_scene.txt`, which was deleted at 11aa19b and no
longer exists in the tree — recoverable only through the
`git show 11aa19b^:...` line that document prints eight lines above the table
I was editing. On the recovered draft it is
`collisions 26 — unasked-rhyme 12  not-a-rhyme 7  same-word 7`.

**Nothing could have caught it, and that is the finding.** Both drafts are
**41 lines**, so a 41-character mandate bound cleanly to the wrong one and the
run returned a complete, plausible report instead of refusing — the same shape
as every defect in this backlog, arriving from the input side. A length that
matches is not an identity that matches, and `Reviser.report()` takes `lines`
and therefore ~~**prints nothing that identifies the draft it read**~~
(**TRUE AT THE TIME OF THE ERROR AND FALSE SINCE LATER THE SAME DAY** — the
fingerprint paragraph below closed exactly this, and this clause is kept in
the past it describes rather than silently absorbed by its own fix): a
measurement recorded from it could not be tied back to its input by anyone
holding only the output. That is why a wrong-input run and a right-input run
were indistinguishable on the page, and it is why this took a second reading
rather than a failing check.

**It was caught by a figure the same table already carried.** The row two below
records `7 × NEAR_COLLISION` from the 2026-08-13 re-run; the recovered draft's
breakdown reads `not-a-rhyme 7`. Two derivations, different days, different
routes, same number — which is what a cross-check is for, and it existed before
the error did.

**AND THE 69 IS ACCOUNTED FOR RATHER THAN DISMISSED, which is the difference
between identifying a wrong input and merely disowning a number.** On this
mandate every collision is a pair over the cut that the mandate did not put in
one group, and all 8 mandated pairs clear the cut (`violations 0`), so
`collisions = (pairs >= THETA_COLLISION) - pairs_mandated` exactly. Measured on
both drafts:

| draft | lines | distinct end words | pairs >= 0.9 | - mandated | = collisions |
|---|---|---|---|---|---|
| `never_been_to_a_scene` (§6's input) | 41 | 34 | 34 | 8 | **26** |
| `mandate_song` (what I ran) | 41 | 33 | 77 | 8 | **69** |

Both identities hold to the unit. The gap is the DRAFT and nothing else: the
fixture is constructed test data with **2.3x** as many pairs over the cut, which
is what a fixture built to exercise mandate machinery should look like. No
harness behaviour changed, on any date. **The candidate shape this suggests is a draft FINGERPRINT in
the report header** (line count and a content hash), so a pinned figure names
the text it came from. ~~Not built; listed, like the shapes in §4.6.~~
**BUILT 2026-08-16, same day, on every surface a figure gets quoted from.**
`quality.revise.draft_fingerprint(lines)` — md5 over `"\n".join(lines)`,
first 12 hex, the width and algorithm the repo's existing citations
(`c9b9e7bf4bd2` and kin) already established — and the four surfaces print
it:
- `Reviser.report()` — `draft: N line(s), md5 X` above the mandated/judged
  counts, the header this whole error was recorded from;
- `brief`/`song` (one shared `_print_brief_report`) — printed the moment
  `rv.brief()` returns and BEFORE any render path forks, because the early
  returns include `nothing flagged`, which is precisely the report a wrong
  draft must not produce anonymously;
- `verify` — `BEFORE:`/`AFTER :` fingerprints above the verdict, gated on a
  mandate being present so a refusal stays the first thing printed. The verb
  needed it most: its output is a set difference, so it is structurally the
  least able to show its inputs;
- `revise_loop` — the one caller that CHANGES the draft, so
  `LoopResult.input_n`/`.input_fingerprint` are captured before the first
  round can rebind `lines`, and `disclosure()` leads with
  `DRAFT: handed in N, md5 X — emitted M, md5 Y`, with a derived
  `(UNCHANGED)` marker because comparing two hex strings by eye is the step
  that gets skipped. A hand-built `LoopResult` prints its missing input AS
  missing (doctrine 20), never as an invented identity.
A refusing run prints no fingerprint on any surface, and that is the design:
a refusal names its own cause; it was the SUCCESSFUL, plausible report that
used to name nothing. `quality/test_verbs.py` §33 pins all four surfaces —
recomputability by the stated rule, the 41=41 same-length case, determinism,
cross-surface agreement (`brief` and `verify` must fingerprint one file
identically), order (inputs above the verdict they precondition), and both
directions of the loop's `(UNCHANGED)` marker — 16 checks (~~13~~), proved
two-sided: **16 of 16 fail against the pre-fix tree, with no crash.**
**THE THREE ADDED CHECKS WERE BOUGHT BY AN ADVERSARIAL REVIEW OF THE FIRST
DRAFT, and what it found is worth the sentence:** a hostile mutation that
computed `verify`'s AFTER fingerprint from a DIFFERENT draft went **13/13
green** against the first version, because the CLI hashes were pinned by
shape and cross-surface agreement but never recomputed against ground truth
— a fingerprint test committing the fingerprint's own defect (agreement is
not correctness; two surfaces printing the same wrong identity agree). §33
now recomputes the expected md5 of each CLI file FROM THE CONTENT THE TEST
ITSELF WROTE, per side, and the mutant fails exactly the check built for it.
The review also exercised the previously untested absent-input branch (a
hand-built `LoopResult` must print `input NOT RECORDED`, never an invented
identity), and surfaced two boundary facts now stated where they live: the
`verify` fingerprints print above a DECLARED-but-unbindable mandate's
refusal — kept, because an arity refusal is a claim about these drafts and
belongs under their identity — and `"\n".join` is not injective over line
lists, so the identity is the printed PAIR (count, hash), recorded in
`draft_fingerprint`'s own docstring with the measured collision.
What this does NOT
do, stated so nobody reads coverage into it: it cannot retroactively validate
any figure pinned before today — those name no fingerprint and never will —
and it does not verify a draft against a PATH, only against content someone
still has. It makes the next wrong-input run legible, not impossible.

**The third finding was correctly cosmetic — it is a VERDICT, and it was
recorded nowhere.** The question "should the collision cut and `grade()`'s cut be one?"
is invited by `COLLISION_CUT_IS_SCALAR_ONLY`'s own text, which calls the
difference "the defect ... surviving here". The answer is NO, and it is now
written beside the cut in `Reviser._matrix` where the change would be made,
re-measured 2026-08-16 on a symlinked copy rather than carried from the audit:
adding `admits()` to the collision test deletes every `NEAR_COLLISION` (a
`wall`~`floor` pair at 0.996 goes from four findings to none) and silently
stops `MANDATE_GROUPS_INDISTINGUISHABLE` firing on a refrain, because
`group_merges` condition (a) requires the cross edges to be IN the collision
set and REPEAT is precisely what `admits()` rejects — 4 collisions and the
finding, down to 2 and no finding. **The test churn is not the cost and was the
only thing that looked like one:** `test_revise.py` goes 280/0 to 265/15, all
in one file, while `test_loop`, `test_coda` and `test_mandate_language` do not
move. A recorded verdict is cheap; rediscovering it by shipping the change is
not.

### 4.8 · Two more containers that merge two rules `FOUND AND CLOSED 2026-08-16`

Found by the audit that preceded the `forbidden_modal` split (defect D), by
asking the deliberately wider question *"where else does one name carry two
rules, such that a report can name the wrong one?"* rather than only fixing the
site in hand. Both are in `quality/loop.py`, both survive that repair
untouched, and both were PROVED by running the code rather than by reading it.

**(a) `"no candidates offered"` is printed when the PROPOSER declined.**
`_try_tier1`'s dead-end detail is chosen on `tried == 0`, which is true both
when `brief()` computed no candidate field AND when the proposer returned
`None` on its first attempt. Reproduced by driving `revise_loop` with a
proposer that returns `None`: the line prints `no candidates offered` while
`brief.candidates` held **24 words**. It reaches a writer on the ordinary
`revise` path through `LoopResult.__str__`. Doctrine 79's exact shape, and
note that `_replay_proposer.disclosure` ALREADY keeps the two apart — so the
repo states the distinction one layer up and loses it per line.

**(b) `LoopResult.unresolved` merges a FLAG with a pursued NOTE.**
`_open_lines` fills one list from two rules — the brief carries a flag, or it
carries a note whose code is in `ReviseDeclaration.pursue` — and the field's
own comment says *"still carrying a flag finding at stop"*, which is false
whenever `--pursue` is used. So `NO_PROGRESS` cannot say which rule kept the
loop open. Same remedy shape as D: two lists, or a per-entry mark, plus a
`pursue` line in `disclosure()`.

~~**NOT FIXED IN THE SAME COMMIT, on purpose.** D's repair is already four
production files and three suites; folding a second module's report semantics
into it would make the mutation evidence for either half unreadable.~~ Recorded
here with the measurement attached so the next lot does not have to rediscover
it — which is the whole argument for §4.7 existing.

**CLOSED IN THE NEXT COMMIT, and (a) turned out to be THREE rules.**

`tried == 0` is reached three ways and the sentence named one. Alongside the
two above there is `attempts_per_line < 1` — **the loop never put the question
at all**, which is doctrine 20's own case (inconclusive by construction, not a
dead end) and is reachable because that is a declared coordinate with no floor
on it. All three now say which:

    L1  no candidate field was offered — the harness had nothing for the
        proposer to choose from … not about the proposer
    L2  the PROPOSER declined at attempt 0 with 24 candidate(s) offered —
        its refusal, not an empty field
        NOT ASKED — attempts_per_line=0 … inconclusive by construction,
        not a line the loop could not fix (doctrine 20)

The first two are MEASURED ON ONE RUN — `revise … --blueprint` with a declining
proposer puts the meter-only L1 in the first state and L2 in the second — which
is what makes them two rules rather than two namings of one.

**(b) IS A SPLIT, NOT A REPLACEMENT.** `unresolved` stays the UNION, because
"has this loop still got work here" is the question a stop condition asks and
the union is its right answer; the field's own false comment is struck, and
`unresolved_flagged`/`unresolved_pursued` say WHY per line. `__str__` prints
`L3 (pursued note), L4 (flag)` rather than a bare list. **The two are never
summed** — they overlap on a line carrying a flag AND a pursued note, measured
on `_open_by_rule` directly (2 + 2 = 4 against a union of 3), which is why the
union keeps the count.

`quality/test_loop.py` §17 is 8 checks. Two mutations are needed because the
fix has two layers: restoring the merged sentence and the bare line list kills
**5**, and separately making `unresolved_flagged` the union again — the old
false comment made true — kills the other **2**. The 8th is the empty-`pursue`
control, which must pass on every tree.

---

### 4.9 · Tier 2 offered a pair its own grader rejects `FOUND AND CLOSED 2026-08-17`

Found by rung 3 of the coverage experiment, by COMPLETING a defer session
rather than stopping at the first prompt — see
`quality/COVERAGE_PREREGISTRATION.md` §R3.7, defect F. Not a reading: the pair
the tier-2 prompt prints under *THE PAIR THE GRADER'S OWN SEARCH IS PROPOSING*
was run through `verify()` and came back

    accepted  : False
    new_flags : [(5, 'SCHEME_VIOLATION'), (19, 'RETURN_NOT_VERBATIM')]

**One sentence, two consequences.** `_try_tier2` builds both searches out of
the PIVOT's group list and nothing else:

    other_calls = [w for lab2, _m2, cl2 in b.must_answer if lab2 != label
                   for _, w in cl2]
    p_offered, _ = reviser.joint_field(other_calls, exclude=(pivot_current,))
    a_offered, _ = reviser.modal_field(w, exclude=(anchor_current,))

**(a) The PIVOT field ignores the requirement KIND.** `other_calls` does not
read `Brief.return_groups`, so a group whose requirement is `REQUIRE_RETURN`
contributes its end word to a RHYME search. This is the SEARCH half of defect
E, still open after the rendering half landed: the prompt now correctly says
*"this line must BE L19"*, and the field beneath it still offers 24 words each
of which breaks the return. The one legal answer — the word already there — is
`exclude`d by construction, so the field cannot contain it.

**(b) The ANCHOR field ignores the ANCHOR's own groups.** `a_offered` is
`modal_field(w)` — derived from the pivot's candidate alone. An anchor that is
itself a pivot is searched as though the shared group were its only
obligation. MEASURED on rung 3's draft: `partners(3)` is `[(1, [5]), (12,
[7])]`, all 24 anchor options are `-air`/`-are` words, and L5 ends on `awake`.
The prompt does not tell the writer either — it renders **THE RHYME MANDATE ON
THE PIVOT** and no block for the anchor.

**Why this is doctrine 48 and not merely a weak search.** The offer was never
put through the check that judges the answer, so "this pair cannot be
accepted" was not a verdict the loop could reach. A blind writer took the
correct move available to it — keeping the pivot byte-identical to preserve
the return, moving the anchor to `chair` — and was rejected on (b), with
nothing in the prompt that could have told it why.

**CLOSED.** `_anchor_obligations` asks `Mandate.partners`/`requirement` for
the anchor and drops only the group being backtracked; the anchor field is
`joint_field([w] + a_other)`; a line pinned by a verbatim return is NOT
SEARCHED, with the group named; and `PairBrief.anchor_calls` carries the
anchor's obligations into the prompt under **AND THE ANCHOR HAS GROUPS OF ITS
OWN**. THREE COUNTS, NEVER SUMMED (doctrine 79): `tried` (pairs put to a
proposer), `pinned` (groups refused unsearched), `starved` (groups whose
anchor conjunction came back empty) — the last unsayable before the fold,
because `modal_field(w)` was never empty here.

`quality/test_loop.py` §19 is 8 checks over three fixtures, one per half:
`ANCHOR_IS_A_PIVOT` carries no returns at all, `ANCHOR_HAS_A_LIVE_GROUP` gives
the anchor's conjunction a non-empty answer so a prompt is actually built, and
the pin fixture puts the PIVOT in a return. Check 8 is the control that keeps
the fix inert where the defect is not.

---

### 4.10 · Two checks that cannot fire in any real run `FOUND AND CLOSED 2026-08-17, DECLARED INERT`

Found by sweeping the 16 finding codes no coverage rung had reached
(`quality/COVERAGE_PREREGISTRATION.md` §E). Thirteen turned out to be
positively tested already; two more (`NO_RHYME_KEY`, `REPRISE_STUB`) fire and
merely had no test, now `quality/test_grid.py` §30. The last two are doctrine
48 — a check that cannot fail is decoration — and they are unreachable for
DIFFERENT reasons, which is why they are two entries and not one.

**(a) `NO_TEMPO` is never called.** `quality/fit.py:184` builds a PERMANENT
`FitRefusal` for want of a tempo. A repo-wide grep finds exactly one caller:
`quality/test_fit.py`, which asserts its `status`, `missing` and `detail`
strings and that it raises rather than answering. **No production path
constructs it**, so no run of the harness can ever emit it. The module's own
docstring explains why — it never asks a per-second question, so "syllables
per second", "too fast to sing" and "the pickup is 200 ms" are refused by NOT
BEING ASKED rather than by refusing. That is a defensible design; what is not
defensible is a refusal object plus a test that reads as if the guard were
live. **AND THE OTHER HALF IS UNWIRED TOO:** `quality/declared_inputs.py:546`
declares `tempo_bpm`, and a grep finds NO reader anywhere. A caller can
declare a tempo and nothing will use it, while the refusal that exists for its
absence can never fire. Both halves of the tempo story are scaffolding.
**Decide:** either delete both and let `MISSING.md` C-5 carry the gap alone,
or wire one real per-second question so the refusal guards something.

**(b) `PROMINENCE_UNDECIDED` has a working branch and no producer.**
`quality/fit.py:1227` refuses when `units.prominence_undecided` is non-empty,
which needs `_resolve_prominence` to see a multi-valued `Readings`. MEASURED:
the branch WORKS — a phonology whose `syllabify_line` returns
`Readings({0, 1})` for one word yields 2 undecided units and a `?` in
`pattern()`. What no phonology does is produce one. `Readings` is constructed
in exactly one file in the repo, `quality/test_homograph.py`, and even its
`EnglishAllReadings`/`EnglishUncertain` classes set `prominence` to a plain
int per parse, so `read_line` came back with **0 undecided units on every
homograph tried** (`record`, `wound`, `desert`, `read`, `bass`). So the
refusal is live code guarding a state the shipped phonologies cannot enter.
**Decide:** either wire the English phonology to keep a `Readings` where
CMUdict's parses disagree on stress — which is what the class is FOR and would
make several homograph questions answerable — or mark the check as reachable
only through a caller-supplied phonology and pin that with a test, so it stops
looking like a live guard on the default path.

**Neither is a wrong answer being reported.** Nothing the harness says today
is false because of these. They are checks that cannot participate, which is
the failure mode doctrine 48 names and the reason this sweep was run.

**CLOSED BY THE THIRD END — KEPT AND DECLARED INERT, MECHANICALLY.** Both are
now entries in `quality/fit.py`'s `INERT`, in the shape `quality/relations.py`
settled on for this exact problem, and `quality/test_fit.py` re-derives both
and fails in BOTH directions: three mutations, each red — something starting to
CALL `_no_tempo`, an entry renamed off its subject, and a blocker outside the
declared three.

**And the second decision was NOT the obvious one, because measuring it
changed the answer.** Wiring `PROMINENCE_UNDECIDED` naively looked right —
`P11` already established that an unresolved homograph must read UNDECIDED
rather than be guessed, and `fit.py` guesses. But MEASURED: all five words on
this repo's own English homograph list (`wind`, `live`, `read`, `bow`, `tear`)
carry **one** prominence pattern and **two nuclei**, so the ambiguity P11
handles is never a prominence ambiguity. The CMUdict entries that do disagree
on prominence are reduction variants — `our`, `will`, `can`, `did` — on 4.24%
of corpus lines, where the dictionary did not decline to say anything; it
listed two PERFORMANCES of one word. Reporting those as *"the phonology left
it undecided"* would merge two kinds of fact under one count (doctrine 79) and
make the check fire for the wrong reason, which is worse than its being dead.
The blocker is therefore `disjoint` and it is nameable: the lexicon does not
mark WHICH multi-parse entries are lexically ambiguous as against reduction
variants, and `ENG_HOMOGRAPHS` is five hand-listed words in a test file.

---

## TIER 5 — whole absent layers (`MISSING` B, C, D, G, H)

Not debt, not defects — **never built**. Listed so they are not mistaken for
either.

**STILL ABSENT, verified 2026-08-11.** No pitch layer at all (B-1) — `grid.py`,
`meter.py` and `fit.py` between them expose no pitch, scale, mode or tuning
object. 12-TET assumed by omission (B-2). No tempo (C-5), which `fit.py` states
in its own refusal: *"a note DURATION is not [a coordinate], because there is no
tempo"*. The floor has ~~two~~ **three** length profiles — the third is the whole-sheet `song` profile, 2026-08-11 — and ~~L-4 records what they are~~ L-4 closed 2026-08-21 on saying "two"; L-4a carries the real residue (no generated class).

**MOVED OUT ON 2026-08-11 — three absences that were FILLED and stayed on the
list.** This section exists so absences "are not mistaken for" debt or defects.
An absence that has been filled and is still listed inverts that: it makes the
one section that is supposed to be trustworthy about what does not exist the
section that is wrong about it. History kept, per `MISSING.md`'s own rule that a
filled entry is marked, never deleted.

| ~~absent~~ | what closed it | landed |
|---|---|---|
| ~~Sections have no FUNCTION (D-1)~~ | `Section.function`, a coordinate distinct from `Section.name`; the `function` verb REFUSES rather than reading `"chorus"` out of a name, and reports asked / answered / refused | `7e802d3` (field first at `d944ff7`) |
| ~~No syllable-to-beat mapping~~ | `quality/fit.py` and the `fit` verb — syllables against the pulses of the bar they are declared in, with `--subdivision` a DECLARED coordinate that has no default | `90df738` |
| ~~No hook~~ | `grid.Hook`, `hook_occurrences`, `hook_findings`, reached by the `function` verb; a hook is a FRAGMENT the writer names, and an undeclared one REFUSES | `7e802d3` |

**Verify, do not take this table's word for it:**
`python3 lyric_harness.py function quality/fixtures/song.blueprint.json`
prints `asked 3  answered 0  refused 3` and three `REFUSED` lines — the
capability is built and that blueprint declares none of it, which are different
facts. `python3 lyric_harness.py fit quality/fixtures/song.blueprint.json
--subdivision 2` prints the per-section slot table.

---

## Counters, so drift is visible

**This table is OUTPUT. Do not edit it by hand.**

```
python3 quality/counters.py            # measure and print
python3 quality/counters.py --check    # FAILS if the table below is stale
python3 quality/counters.py --write    # regenerate it
```

Every row is derived by measurement and `quality/counters.py` states the
derivation beside each one. A row it cannot measure REFUSES and says which of
the two reasons applies — JUDGEMENT (no measurement exists; somebody sets the
status) or COST (a measurement exists and this run declined to pay for it) —
rather than printing a number. Asked, answered and refused are three counts,
never one (doctrine 79).

> **Why it is output.** The hand-maintained version of this table had drifted in
> four places at once, and re-typing the values would have been the same defect
> with fresher numbers (doctrine 48). What each error was, and why:
>
> - `doctrines | 102 (27 in CLAUDE.md, 75 in quality/METHOD.md)` — **95 (20 + 75)**.
>   `CLAUDE.md` carries two numbering systems written in the same markdown shape,
>   the doctrine run and a 7-item `Known gaps` list cited as `known gap N`. A bare
>   `^\d+\. \*\*` counted 20 + 7 = 27 and called them all doctrines. §4.5.
> - `MISSING entries ... | 53 / 10 / 2 / 7 (73 entries)` — the row **contradicted
>   itself in its own cell**: 53 + 10 + 2 + 7 = **72** against a stated total of
>   73, and nobody had added it up. **The parts and the total came from two
>   different rules**, which is why they could disagree and stay unnoticed.
>   Reproduced exactly on 2026-08-11: a status regex run over the HEADING LINE
>   ONLY returns `53 / 10 / 2 / 7`, total 72 — because `L-3`'s heading wraps and
>   its `PARTIAL` sits on the next line, so the entry is dropped from every
>   bucket while a separate `grep -c '^### '` correctly says 73.
>   **Both obvious repairs are also wrong**, in opposite directions: reading the
>   LAST status token over the wrapped block flips `C-2` from `PARTIAL` to `OPEN`,
>   because `C-2`'s continuation line ends `catalogues do not \`OPEN\``. Only the
>   FIRST token over heading-plus-continuation is right, and `counters.py` states
>   that rule, RAISES if the parts do not reconcile with the total, and prints
>   them AS a sum so the arithmetic is on the page. The live values are in the
>   table and are deliberately not repeated here, because a number restated in
>   prose beside its own counter is the next thing to drift.
> - `band FPR ... | 3.57% (107/3,000 at seed 20260810)` — not wrong, and not
>   reproducible from its own command: `redteam_band.py` defaults to n=4,000 and
>   prints **3.60%**. The seed was written down and the POPULATION SIZE was not
>   (doctrines 58 and 91). Both n are measured now, so neither can be quoted alone.
> - `corpus/song/ files | 258`, `sources.tsv | 386`, `lyricists.tsv | 539` —
>   transcriptions as-of-a-date of quantities that move whenever a corpus cell
>   runs. All three were stale within the day. They carry **no number here at
>   all** now, only the command; `--check` enforces the absence. A number you know
>   is moving does not belong in a file that is read as a record.
>
> The two that were RIGHT and were checked anyway: the sonnet battery
> (`81/1014` as measured on 2026-08-11; `82/1014` from 2026-08-13 and
> **`35/1014` since 2026-08-22**, when the door widened — repinned 2026-08-13
> after cell BA's coda-identity fix — and this paragraph's point survives the
> move, since the row was confirmed by re-running rather than assumed) and
> the mutation count — which was right on 2026-08-11 and has since been
> OUTGROWN rather than falsified. `33 declared, 32 caught, 1 allowlisted` was a
> full sweep of the inventory AS IT THEN STOOD: 33 `M*` mutations, every one of
> them landing in `lyric_harness.py` or `battery.py`. The `Q*` quality-layer
> block landed 2026-08-13 and the declared total moved with it; the live figure
> is in the table below and is deliberately not repeated here.
>
> **The caught half is a COVERAGE statement now, and not a ratio, because no
> run covers the declared set.** As of 2026-08-13,
> **24 of the 57 then declared** carry a verdict at all, and those 24 come
> from TWO runs at TWO different inventory bounds: a partial run of
> `QF1`–`QF5`, and a run of 19
> bounded to a TEN-FILE inventory (17 caught, 2 SURVIVED — `QS2` in
> `schemes.py`, `QG1` in `grid.py` — 0 indeterminate, 4,984s wall). Four
> survivors across the two, all four since closed by the tests they triggered,
> and **not one of the four replacement verdicts has been measured** — the
> sweep invalidates its own number by working. UNMEASURED is the larger half:
> the 33 `M*` were re-run in neither round, so `32 caught` is a fact about the
> 2026-08-11 tree and not about this one, and the only `M*` claim still
> standing on its own proof is the allowlist — `M4` is EQUIVALENT rather than
> missed, and `M11` tests the premise that makes it so.
>
> Two doctrines forbid the shorter sentence. **79** — caught, survived,
> indeterminate and NEVER-RUN are four counts, and any "N of 57" built by
> summing them puts a mutation nobody ran into the numerator. **91** — a count
> is a coordinate of the RENDERING: `17/19` bounded to ten files and `17/19`
> over the whole suite render identically, so the bound IS part of the number
> and a figure quoted without it is a different figure wearing the same digits.
> Confirming a number costs the same as catching one, and a table
> whose passing rows were never re-run is a table nobody has checked.

<!-- COUNTERS -->
| counter | measured | measured by |
|---|---|---|
| MISSING entries by status | 60 OPEN / 31 PARTIAL / 2 BLOCKED / 44 CLOSED = 137 entries | `python3 quality/counters.py` |
| doctrines | **95**, a contiguous run 1–95 with no number in both files (20 in `CLAUDE.md`, 75 in `quality/METHOD.md`) | `python3 quality/verify_doctrines.py` |
| stranded modules | **0** — every production module is imported or has a `__main__`; `rhyme_constraints.py` is 1,738 lines with a `__main__` and 3 non-test callers (`gate_census.py`, `relation_shapes.py`, `relations.py`), so it is KEPT on the argument M-16 records, and that decision is TAKEN rather than owed | `python3 lyric_harness.py wiring` |
| public symbols by where they are referenced | **1266** DECLARED-public top-level functions/classes under `quality/` and the root — **222** named by another production module, **370** by tests only, **597** only inside their own module, **12** by nothing anywhere, **65** REFUSED (44 ambiguous, 14 dynamic, 7 shadowed). Reference, NOT execution: a symbol whose only caller is itself dead still counts named. DECLARED: the population is `__all__` where the module declares one, so a lot adding a public `def` moves the total only where there is no `__all__` to omit it — **37** public top-level defs are outside this count for that reason and are listed in the evidence. This row is a READING OF THE TREE AT RUN TIME and it moves: the NOWHERE bucket is a queue under active repair, not a settled property — so a FAIL here is that movement, cleared by `--write`, and the figures are quotable only with the run that produced them | `python3 quality/counters.py` |
| mutations declared | **58 declared, 1 allowlisted equivalent** (M4 — and the allowlist entry's PREMISE is itself under test) | `python3 quality/counters.py` |
| mutations caught | REFUSED (cost) — not measured on the cheap path | `python3 quality/test_mutation.py` |
| `corpus/song/` files | MEASURED AT RUNTIME — `python3 quality/counters.py` | `python3 quality/counters.py` |
| `corpus/song/eng_*` — K-1's own quantities | MEASURED AT RUNTIME — `python3 quality/counters.py` | `python3 quality/counters.py` |
| `data/sources.tsv` rows | MEASURED AT RUNTIME — `python3 quality/counters.py` | `python3 quality/counters.py` |
| `data/lyricists.tsv` rows | MEASURED AT RUNTIME — `python3 quality/counters.py` | `python3 quality/counters.py` |
| sonnet battery | 35/1014 = 3.5% violations (`mandated 1064, judged 1014, refused 50`) | `python3 battery.py` |
| band FPR on random pairs | **2.10%** (84 of 4,000 at seed 20260810, the runner's own default n; 2.00% = 60 of 3,000 at n=3,000 — the population size is a coordinate) | `python3 quality/redteam_band.py` |
| register-audit findings | **0** — FALSE derivations: none | `python3 quality/audit_register.py` |
| adversaries built, of 8 | REFUSED (judgement) — `built` / `partial` / `ad hoc` / `missing` in §0 are statuses a person sets; no measurement distinguishes them (the INSTRUMENT column is checkable and `quality/verify_entries.py` checks it) | `read BACKLOG.md §0` |
<!-- /COUNTERS -->

> **The register-audit row was 9 findings on 2026-08-11** before seven were
> closed; the two that remain are deliberate.

> **The symbol census read 157 named by another production module / 238 by
> tests only on 2026-08-14**, at the same total and with the other three
> buckets unchanged. It reads 154 / 241 later the same day, and the cause is
> one commit: `b560014` replaced `lyric_harness._grid_song`'s hand-built
> `GR.Section`/`GR.Meter`/`GR.Line`/`GR.Song` construction with a single
> `GR.song_from_blueprint` call, which deleted the last non-test reference to
> all four of those classes (PRODUCTION -> TESTS, -4) and passed
> `GR.UnknownFunction` to a `_reraise` tuple (TESTS -> PRODUCTION, +1). Net
> -3 / +3; no symbol entered or left the population, which is why the total
> did not move. Re-derived with `--write`, never retyped (doctrine 58).
>
> **AND THE TOTAL COULD NOT HAVE MOVED FOR THE REASON `ed7a2f7` GAVE, which
> is why that commit's row is superseded rather than simply stale.** Its
> message explains its own `--check` FAIL as "`AssumedMeter` is a new public
> class ... and the resulting diff is that one row". The row it wrote kept the
> total and all five verdict buckets and its ONLY diff was `32 ambiguous, 5
> dynamic` -> `33 ambiguous, 4 dynamic`. Both halves are true and the
> explanation joining them is not. The census takes a module's symbols from
> `__all__` where it declares one; `quality/fit.py` declares one; and
> `AssumedMeter` was never added to it — so the class sits OUTSIDE the
> population and adding it could not move any figure. The movement that day
> was a single reclassification, `quality.phonology.declared` DYNAMIC ->
> AMBIGUOUS, because the same commit introduced a LOCAL variable named
> `declared` in `fit.py`: `declared` is a public top-level `def` in both
> `quality/ipa.py` and `quality/phonology/__init__.py`, so a bare identifier
> in a file importing either cannot be attributed to one, and an AMBIGUOUS
> refusal outranks the string-constant DYNAMIC one it previously carried.
> The gate is not a bug — `__all__` is the module's own declaration of its
> surface and doctrine 1 does not let the counter outrank it — but the cell
> did not disclose it, so the cell now says DECLARED-public, states the rule,
> and counts the public top-level defs it excludes (~~18 at this reading~~ —
> **the count is STRUCK and NOT replaced, 2026-08-16; the row four cells up
> and the `OUTSIDE THE POPULATION` line of `python3 quality/counters.py` are
> the reading, and they agree with each other at 19**), listed
> in the evidence.
>
> **IT WAS NEVER 18, AND ONE COMMIT WROTE BOTH NUMBERS.** `git blame` puts
> this sentence at `5afd656`, and `git show 5afd656:./BACKLOG.md` has **19**
> in the generated table at the same commit — so the hand-typed paragraph
> disagreed with the machine-written cell beside it from the first second
> either existed. It then read as present tense ("at this reading") for two
> days with no date and no strike.
> **NOTHING WAS EVER GOING TO CATCH IT.** `counters.py --check` reads the 14
> rows between this file's two counters-block markers and nothing else — it
> says so itself, and the marker strings are deliberately NOT quoted in this
> sentence, because writing one in prose makes the block parser count it and
> turns the table into "2 opening and 1 closing markers", which is a FAIL this
> paragraph earned once while being written — and
> `Counter.restated` carries prose regexes for exactly two
> figures, `mutations declared` and `sonnet battery`. This one was outside
> every instrument in the file, which is why the repair is a strike rather
> than a corrected digit: a third number here would be outside them too.
> This is the exact defect §4's own words name — *"a number restated in prose
> beside its own counter is the next thing to drift"* — committed in the
> paragraph that names it.
> `fit.AssumedMeter` is one of them, and that it is public,
> documented as the only way past a refusal, and invisible to this census is a
> fact about `fit.py`'s `__all__` for that file's owner to settle.

> **"surviving mutations 1 of 3 tested" was the state of §1.1 before it was
> done.** ~~The harness now declares **33** mutations and catches 32~~ — the
> declared total is in the table above and the caught count is not a number
> this file holds at all, for the reason the coverage paragraph beside that
> table gives: no run covers the declared set, so there is no ratio to write.
> M31/M32/M33
> cover the three coordinates declared on 2026-08-11 (`scalar_alignment`,
> `nucleus_agreement`, `nucleus_licence_unstressed_only`). The one ALLOWLISTED
> survivor is **M4, proved EQUIVALENT rather than missed**: dropping
> `channel_agreement`'s `not ca and not cb` clause ought to delete every
> open-syllable rhyme in English and deletes nothing, because `cluster_sim`
> opens with its own `if not a and not b: return 1.0`. It is allowlisted in
> `test_mutation.py` with the proof, and the allowlist entry's PREMISE is itself
> tested — M11 mutates the `cluster_sim` line and is caught, so M4 stops being
> equivalent the moment that line moves. An allowlist that outlives its reason
> is a licence nobody re-read.
>
> **Do not run `for f in quality/test_*.py`.** `test_mutation.py` matches, and
> it forks the WHOLE declared sweep — ~~a 30-mutation sweep~~ however many
> `mutations declared` says today, one full fork of the suite each. The one
> rate anyone has measured is 4,984s for 19 of them.
