# Lyric Harness

**This is a harness for writing songs.** You write the words; it tells you what
the sound is actually doing and refuses the lines that do not hold. It never
writes for you and it never gives a line a mark out of ten — it locates the
defect, names the layer the defect is in, and hands the line back.

Declaration-driven rhyme, meter, and song-structure engine. The model
proposes; these tools grade. Target: MCP server beside Codex Musica —
Codex Musica describes the recording, this disciplines the words.

**Read this file before you write. Read `quality/METHOD.md` when you are about
to MEASURE** — a rate, a null, a threshold, a refusal, a provenance claim. One
doctrine numbered 1–95 spans the two files and the index at the bottom of this
file says which number lives where; `doctrine 79` is still doctrine 79. The
split exists because this file had reached ninety-five doctrines of which some
seventy were about checking, so a session reading it learned to audit rather
than to write (`MISSING.md` L-5, `BACKLOG.md` §4.5). Doctrine 48 is the reason
that mattered: a principle that lives only in prose gets followed exactly as
often as someone remembers it, and a session cannot remember what it never
reached.

## The loop, and the MCP wrap plan

Tools: transcribe, score, candidates, check_scheme, check_meter,
check_song, infer_chains, rhyme_graph, internal, density, qafiya,
cynghanedd, weight. Loop: spec -> draft -> check -> revise flagged
lines only -> re-check. Model never self-certifies.

**THE LOOP IS BUILT: quality/revise.py, tests in test_revise.py.**
`Reviser.brief(lines, scheme)` returns line-scoped instructions;
`Reviser.verify(before, after, scheme, targeted=...)` returns a verdict.
It NEVER generates text — the model proposes, this grades. Four
rejections are enforced and each is a silent failure mode:
  - a revision that fixes the flagged line and breaks another
  - a revision that takes the MODAL candidate (doctrine 9, below)
  - a revision that touches lines nobody targeted
  - a revision that restructures rather than revises
Doctrine 9 is the load-bearing one and it is now mechanical: a flagged
rhyme gets its candidate field with the MOST FREQUENT band-passing
members marked FORBIDDEN, and verify() rejects a revision that lands on
one. Passing the band by reaching for fire/desire is the slop direction,
so a loop that recommended it would manufacture what the floor rejects.
`modal_exclusion=0` disables the rule and is reachable so the defect is
demonstrable; it is not the default.

**METER JOINED THE SAME LOOP 2026-08-11, and rides the FIRST rejection
above rather than adding a fifth.** `brief`/`inspect`/`verify` all take
optional `blueprint=`/`subdivision=`/`assume=`; when given, `quality/fit.py`'s
per-line findings are folded into the SAME set rhyme findings already live
in, so a revision that fixes a rhyme and overflows its bar is rejected by
the existing "fixes the flagged line and breaks another" rule with no
meter-specific veto written. `subdivision` is a `quality.fit.Subdivision` —
a real declared choice, never a default — and it is call-site declared, the
same way a mandate is: nothing in a blueprint file is read as a subdivision.
Severity is not re-decided here either: a `SLOTS_EXCEEDED` finding (more
syllables than slots — mathematically impossible once the setting is
declared) is a hard flag because `fit.py`'s own `satisfiable=False` already
says so; `PROMINENCE_EXCEEDS_HEADS` and friends stay soft notes, the same
tier as an unintended rhyme collision, because they are a style call and not
a contradiction. Omit `blueprint=` and nothing changes — meter is opt-in.
`quality/test_revise.py` test 25.

**THE LOOP IS AUTOMATED: quality/loop.py, tests in test_loop.py.**
`brief`/`verify` graded one round at a time by hand; `revise_loop(reviser,
lines, mandate, ...)` drives them to convergence. It still never writes: text
generation is a `propose`/`propose_pair` callable the caller supplies, and
the one shipped here (`swap_end_word`, a single-word splice) exists to prove
the loop's OWN control flow, not to write a good line.

TWO TIERS, matching what backspacing through a draft actually does. TIER 1
swaps a flagged line's own word for an offered candidate. TIER 2
BACKTRACKS: `Brief.joint_conflict` means `joint_field` already searched the
complete pool and nothing answers every group a pivot is in at once —
retrying tier 1 there is re-running a search already proven empty, which is
why the brief says "the mandate, not the line, is what needs revising."
Tier 2 instead revises the WORD of the line the pivot has to match, bounded
to a two-line group (the pivot and one anchor): a group of three or more
would mean rewriting the whole group to keep it mutually rhyming, which is a
bigger move this tier does not attempt, and it says so rather than pretend
the search was wider than it was.

THREE STOP CONDITIONS, and they are not one thing. SUCCESS — nothing left
carries a flag finding. NO_PROGRESS — a whole round fixed nothing, so
another identical round is not run. ROUND_LIMIT — `ReviseDeclaration.
max_rounds` (declared since the first commit of `quality/revise.py`,
default 4, unread by anything until this module) is reached. A single
unsolved line is NEVER a stop condition — the loop keeps going on every
other flagged line and reports the dead end in the result.

## Commands (python3 lyric_harness.py ...)
**Run `wiring` first.** It prints which verb runs on which layer, CHECKS that
map against the dispatch and against `--help`, NAMES every one-shot runner
with the command that runs it and its own first line, and lists every
production module with no caller and no `__main__` — so "is this plugged in?"
is a command rather than an audit. A count of runners is not discoverability:
`quality/audit_corpus.py`, `quality/relations_null.py` and
`quality/ltc_overlap.py` were "standalone by design" for the whole time nobody
could find them. Doctrine 48: a principle that lives only in prose gets
followed exactly as often as someone remembers it — this round it had to be
remembered eight times and was remembered zero, so the map, the usage text and
the dispatch are now three sets that `wiring` and `quality/test_verbs.py`
require to be equal. A verb added without a row and a `--help` line is a
failing test, not something a later session notices.
declaration | score A -- B | candidates W [n] | meter TEMPLATE L... |
scheme LETTERS [--profile assonance|rawi] L... | song blueprint.json
lyric.txt | chains FILE [theta] | graph FILE [theta] | internal "line" |
density FILE | weight "line" | qafiya FILE|L... |
cynghanedd [--lang=cym|eng] "line" | prasa K L... | demo
THE QUALITY LAYER, REACHABLE SINCE 2026-08-10 (it was not, and that was the
single largest defect in the project): wiring | types W1 -- W2 [--lang=]
[--preset=] | partition FILE|L... | cycle N/D [a+b+c] | relations FILE
[--schema=] | grid BLUEPRINT |
fit BLUEPRINT [--subdivision N] [--isochronous] [-v] |
function BLUEPRINT [--function=SECTION:FN,...] [--title=T] [--hook=H]
[--rhyme-key=cmudict] | refrain NOTATION|FORM [FILE] |
brief FILE [MANDATE] | verify BEFORE AFTER [MANDATE] [lines] |
revise FILE [MANDATE] | readability FILE

Four of those shipped on 2026-08-11 and closed the gap that had reopened
underneath the quality layer:
- **`fit`** is the only verb that answers *do the words fit the bars*. The
  subdivision is a DECLARED coordinate with NO default — without one the slot
  questions refuse rather than assume a sixteenth-note grid. At
  `--subdivision 2` the 4/4 choruses of `examples/never_been_to_a_scene` are
  UNSATISFIABLE (2 and 3 lines) and the 7/8 verses are not, because an
  eighth-note pulse subdivided twice is finer than a quarter-note one.
- **`function`** reads `Section.function`, which is not `Section.name`: an
  undeclared function REFUSES and the harness never reads `"chorus"` out of a
  name. Three counts on every run — asked / answered / refused (doctrine 79).
  `--function=` declares one at the command line, LABELLED as a CLI
  declaration, for blueprints written before the coordinate existed.
- **`refrain`** reads the A-1 notation, where a CAPITAL is a line that must
  come back VERBATIM. `refrain villanelle FILE` catches the drifted refrain
  that the rhyme partition and the band both pass.
- **`brief` / `verify`** take `--cliques` (the song's own graph structure,
  marked `source=derived` and NOT INDEPENDENT of the grader, doctrine 14) and
  `--groups=1,3;2,4` (1-based, MAY OVERLAP) as well as a letter string. With
  no mandate at all they REFUSE and **exit 2** — doctrine 20, and a caller in
  a pipeline has to be able to tell a refusal from a pass.

## Doctrine you hold while writing

Twenty of the ninety-five, and they are the twenty that decide what gets MADE:
what the object is, what the tool will and will not say about it, and what is
worth measuring at all. The other seventy-five are in `quality/METHOD.md` and
are not less true — they are just not what you need in working memory to draft
a verse. The numbering is global and deliberately non-contiguous here.
Do not drift from these. (This section is the former **Core doctrine (do not
drift from these)** and the writing-facing part of **Doctrine additions, earned
from the first run — do not drift from these either:**, merged into one run.)

<!-- DOCTRINE-BLOCK -->

1. **Declaration tuple.** Every analysis states its assumptions:
   dialect (CMUdict General American), anchor rule, channel weights,
   thresholds. All in the `Declaration` dataclass. Disagreements are
   located in a coordinate of the tuple, never argued at large.

2. **Graph first.** The full pairwise score matrix is the primary
   object (`rhyme_graph`). Letter schemes, chains, blueprints are lossy
   projections. Maximal cliques may OVERLAP = structures with no letter
   representation (chained slant). Never rebuild a projection-first
   architecture.

3. **Band-pass, TYPED.** Identity is not rhyme. Relations: RHYME
   (graded), REPEAT (same word), RIME_RICHE (same sound, different
   word), ASSONANCE (nucleus agrees, coda does not), CONSONANCE (coda
   agrees, nucleus does not). The band inverts by context: REPEAT is a
   violation inside a verse, the requirement across chorus instances,
   licensed as radif/refrain. The conjunctive coda rule RELABELS, never
   rejects — `sun`/`much` is assonance, not a non-relation — because a
   rule that closed the leak by deleting assonance from the taxonomy
   would be a worse defect than the leak. See RESULTS_BAND.md.

4. **Four layers.** Signal (phoneme channels: nucleus/coda/onset/stress,
   scored separately). Time (BUILT and POWERED, and it found nothing:
   quality/time_layer.py, RESULTS_TIME.md, RESULTS_FWER.md. Placement of
   rhyme against a metric period, phase-invariant and self-normalizing,
   with family-wise error control across each position's candidate family
   (median 89 on a quatrain, 156-282 on a sonnet; "~15" was the SCORED
   family and is amended at doctrine 29). Saturation 6-16%.
   The standing record of what that layer does and does not
   license is METHOD § Time layer.
   Still no beat grid — there is no audio, so isochrony is an assumed
   coordinate, not a measurement, and "on the beat" is not a claim this
   project can make). 
   Perception (theta is a function: per-genre theta_chain, promotion
   licensed only by declared meter). Value (cliche pairs, shared-suffix
   stem check, REPEAT flags; doggerel = value failure, not rhyme type).

5. **Weights are `fitted: false`.** Hand-set, and they stay that way:
   the Hirjee-Brown path has now been walked (quality/fit_matrix.py)
   and its answer is that it buys nothing. Do not tune by single
   examples — accumulate, then fit — and if the fit does not beat the
   hand-set weights held-out, do not ship it because it is fancier.

6. **No weighted quality score, ever.** The features stay a vector. The
   exchange rate between surprise and clarity is not derivable; it is a
   genre's answer, so it belongs in a declaration, not in a constant.

7. **Rejection, not selection.** Detecting bad writing held-out at AUC 0.971;
   ranking good writing at 0.709. Enforce a floor, do not order the permitted
   region.

9. **Optimizing toward the phonetic maximum is the slop direction.** Handing a
   model "L2-L4 below theta" makes it reach for the highest-scoring rhyme,
   which is the most predictable one. A revision protocol must push away from
   the optimum: pass the band, but not by taking the modal candidate.

24. **When a rule would delete a category, make it RELABEL instead.** The
   conjunctive coda rule exists because `sun`/`much` has an identical nucleus
   and no comparator can stop a strong channel buying a weak one. Written as
   "rhyme requires the coda to match" it would have deleted assonance,
   consonance, oblique and slant rhyme from a harness built to represent them.
   Written as a type — nucleus-only is ASSONANCE, coda-only is CONSONANCE —
   it closes the leak and the vocabulary grows from three names to five. The
   test of such a rule is whether the harness can say MORE afterwards.

32. **A corpus is defined by the property under test, not by a genre or a
   language.** The replacement for the deleted rap arm is "forms in which
   sound-repetition is constrained to fixed metrical positions", which spans
   nine language families (quality/POSITIVE_CONTROL.md). Proposing "a second
   rap corpus", and then one tradition swapped for another, was doctrine 8
   broken twice over: single source AND single language. No tradition
   conceptualizes the property the same way, which is the reason to take many
   rather than a reason to pick one.

34. **Every corpus file must have a row in data/sources.tsv, including the
   local ones.** verse.txt sat in the repo from the first import, was never
   declared, was never run through the provenance gate it would have failed,
   and carried an entire experimental arm. Fixtures, generated text and
   PD downloads all now carry rows -- a file with no row is the defect.

37. **Test a phonology against its tradition, not against its own rules.** A
   syllabifier that satisfies only its author is untested. Kalevala lines that
   are known to alliterate must alliterate; canonical regulated verse that is
   known to rhyme must rhyme. That check is what caught the Finnish hiatus
   apostrophe: `saa'ani` was unreadable, so a line that alliterates reported
   that it did not.

44. **The blocker is not always difficulty.** Welsh was listed as blocked on
   transcription from the first commit; it turned out to be as cheap as
   Finnish once someone looked -- near-phonemic, eight digraphs, penultimate
   stress, an afternoon. What is actually blocked is the TEXT. Separate
   "hard to build" from "cannot obtain" in every gap entry, because the two
   have completely different remedies.

45. **Give a form's checker the language of the form, and make the language a
   coordinate.** check_cynghanedd now defaults to `cym` because cynghanedd is
   Welsh; `--lang=eng` keeps the CMUdict path for English imitation and says
   in its own output that it IS an imitation. Every result declares which
   phonology produced it. A checker that silently picks a phonology is making
   a claim it never states.

46. **A function-word list is part of a phonology, not an optimisation.**
   Welsh penultimate stress makes every monosyllable stressed, so without a
   PROCLITIC list cynghanedd lusg "answers" the definite article `y`. The
   English engine has always had WEAK_ALWAYS for the same reason. Any new
   language needs its own before its prominence rule means anything -- and the
   list changes what a skeleton IS: a half-line ending in a proclitic has its
   last stress on an earlier word, which is an edge case that silently swept
   the final coda into the skeleton until a test line hit it.

47. **A revision loop that only checks the line it was told to fix is a rubber
   stamp.** The three ways a revision goes wrong are all silent: it fixes the
   rhyme and breaks the scheme elsewhere, it fixes the rhyme by taking the most
   predictable word in the field, or it quietly rewrites lines nobody asked
   about. verify() diffs the whole finding set, enforces the modal exclusion,
   and refuses changes outside the targeted lines. Accepting on "the flagged
   finding is gone" would pass all three.

48. **Doctrine 9 is only real once it is mechanical.** "Push away from the
   optimum" sat in this file as a sentence for the whole project. It is now a
   number -- modal_exclusion -- and an enforcement: the brief names the most
   frequent band-passing candidates as FORBIDDEN and verify() rejects a
   revision that takes one. A principle that lives only in prose gets followed
   exactly as often as someone remembers it.

62. **The tradition frequently states the rule you were about to invent.**
   Snorri's own Háttatal prose supplies two things a modern summary omits, and
   both are load-bearing: that the ONSETS MUST DIFFER for a hending to count --
   which is doctrine 3 written in the 1220s -- and a málfylling list of
   function words, which is doctrine 46 attested rather than assumed. Without
   the second, Snorri's own line 5 reads as three vowel-initial words and his
   own stanza reports as malformed. Read the tradition's own statement of its
   rules before writing a checker for them; the primary source is a spec.

85. **An express NON-COMMERCIAL grant is a rejection, and it has to bind the
   same way in every language.** 4,347 ci and 734 樂府 were located, extracted,
   validated at 99.03% character coverage and measured against 311-year-old
   ground truth — and then refused, because the digitiser's grant quoted inside
   the files is `資料自由使用，但不得為商業用途`. This repo had ALREADY rejected
   `irfanzainudin/pantunis-data` for a quoted non-commercial restriction on the
   OTA layer, and CELT before it. Admitting Chinese on terms that refused Malay
   would make the gate a function of how much the corpus was wanted. The ci half
   fails twice over: its stated base is 唐圭璋's 《全宋詞》 (1940) and he died in
   1990, so life+70 runs to 2060 — and the sourcing cell's own measurement shows
   his PUNCTUATION is the signal (45.2% rhyme agreement at 。-ends against 2.7%
   at ，-ends and a 2.8% matched null), so we would be building ON the
   in-copyright contribution rather than around it. What survives is 花間集,
   500 songs, whose own last line is 王鵬運's 1893 四印齋 colophon and whose
   chain quotes no restriction at all. **Record the unblock route in the same
   breath as the refusal**: kanripo/KR4j 白文 (文淵閣四庫全書, 1782) segmented by
   the 欽定詞譜 (1715) reaches the same corpus with no living copyright anywhere.

92. **The admissible source and the complete source can be DISJOINT sets.**
   Doctrine 44 separated "hard to build" from "cannot obtain". This is a third
   category and the remedy is different again. The Gītagovinda's rāga and tāla
   headings — the named-air field this whole round was chasing — are built,
   digitised, GitHub-indexed and one `curl` away, verified present (25
   `gīyate`, 5 `rāgeṇa`, 9 `tālena`, HTTP 200). They are CC BY-**NC**-SA, so
   they are refused, and the copy that is admissible is the copy that dropped
   them. Neither difficulty nor reachability is the blocker; the two properties
   we need simply do not co-occur in any one file. A gap entry has to say which
   of the three it is, because "find a better source" is the answer to only one.
   Same round, second instance: `Guy-Bilitski/rcc-data` carries the root and
   commentary with **no licence file at all**, and silence is not permission.

<!-- /DOCTRINE-BLOCK -->

## House rules
Never abbreviate project names: Codex Musica, Pantheon Registry,
Deus ex Homine, Chocolate Secrets. No artist/producer names as
descriptors in any generation-facing output — era+region+technique.

## Test discipline
- `python3 battery.py` — sonnet oracle (152 sonnets, ABABCDCDEFEFGG),
  Lear limerick known-answers, Whitman negative control.
- Current baselines, WITH the conjunctive band: sonnets **8.0%
  violations (81/1014 JUDGED pairs; 73/1014 = 7.2% before `theta_coda`
  was calibrated 0.60 -> 0.80 on 2026-08-11, and 35/1014 = 3.5% pre-band)**
  — MEASURED, not recalled: `python3 battery.py` prints
  `mandated 1064, judged 1014, refused 50` and `violations 81`.
  The rise is the typed residue: love/prove and its class are CONSONANCE in
  the declared General American dialect, which is correct and now named.
  Report **refused, judged and mandated as three separate counts, always** —
  50 of the 1064 mandated pairs are REFUSALS, end words absent from CMUdict,
  and charging them to the comparator is the triage rule two items below this
  one broken in the headline number (doctrine 79).
  Whitman **17.3%** chained at theta 0.82 — MEASURED, and `battery.py` prints
  it. The recorded 20.0% and 18.0% are the PRE-`b1d7f64` comparator's: they
  reproduce exactly at head alignment with `theta_coda` 0.60 and in no other
  cell of that 2x2, so three of the four Whitman figures in this repo's record
  are a comparator that no longer ships. Doctrine 58, one axis further out —
  **a rate is a coordinate of the COMPARATOR.** 26.0% band-OFF is
  comparator-invariant and still reproduces, which is the check that it is the
  same statistic.
  **The band's empirical warrant stays withdrawn, and the REASON has changed.**
  Under the shipped comparator the control DOES clear its own line-permutation
  null — p 0.006 at n=2000 against the recorded 0.209, and the band's effect on
  the separation FLIPS SIGN, +6.7 -> +9.3 pp where the record has +6.7 -> +3.3.
  So doctrine 71's arithmetic no longer holds on this text. It is withdrawn on
  a prior ground that needs no null at all: **half of Whitman's detected chain
  links are REPEAT on an identical token** — `now` closes four consecutive
  lines, which `battery.py` has printed under `false chains (should be near
  zero)` since the first commit. A negative control is a text in which the
  property is ABSENT, and this one carries it as epistrophe, in the one
  relation doctrine 3 says cannot be read without a declared context.
  `corpus/whitman.txt` was never eligible, at any rate, under any comparator.
  THE BAND STILL SHIPS, on the doctrine 3/24 argument that it RELABELS rather
  than rejects — a claim about the taxonomy, which needs no negative control.
  `quality/RESULTS_NULL_SHAPES.md`, `quality/NULL_AUDIT.md` §1.1, and METHOD
  § The sonnet battery for why `verse.txt` was deleted.
- Triage every failure to a layer: ingestion / projection / anchor /
  comparator / band / structure / value. Fix only when a category
  accumulates. Every fixed case becomes a permanent regression.
- Real exemplars over constructed tests. Constructed tests encode the
  author's assumptions; canon corrects the checker (8 rule errors
  found this way: strict groes final-consonant rule, sain any-stressed
  link, radif licensing, hyphen splitting **x3**, collision bar, mosaic
  anchor reach, prefix phrase-final seam). The third hyphen error was the
  expensive one and it was a different KIND from the first two: they produced
  a refusal, this produced a WRONG ANSWER. **FIXED 2026-08-11, and it is a
  refusal now.** In **174** English song line ends the LAST letter-bearing
  piece of a hyphenated word is unread, so the anchor was built from an
  earlier piece and the line was nonetheless reported READABLE --
  `hill-zide` scored on `hill`, and `hill-zide`/`wife-zide 0.472 NO_RELATION`
  was `hill` against `wife`. The sharpest case is `a-vound`, where the only
  piece that reads is the participial prefix whose only phone is a schwa, so
  ANY TWO of Barnes's participles scored as a rhyme with each other on it:
  the harness was MANUFACTURING rhymes, not mislabelling them. One predicate,
  `unread_final_piece`, is read by the anchor path and by the record, so they
  cannot disagree. The 149 report-layer cases (`threshing-floor` reads
  `floor`; the anchor is right and the record of what was read is not) are
  NOT refused.
  Price, measured on both populations rather than argued: **zero on the
  sonnets** -- `wilful-slow` and `o'er-read` read on their LAST piece and stay
  judged at 1.0 -- and +0.099pp on the song corpus, 1.83% of all end-word
  refusals. It falls on 28 of 143 files and 63.8% of it on two, Barnes and
  Burns, which is dialect; doctrine 67 says measure WHERE and the answer is
  that those 28 files already refused at 8.26% against the other 115's 2.08%,
  so the rule lands where CMUdict was ALREADY failing. And it is not purely
  dialectal: 88 of the 174 are ordinary compounds, half of them standard
  literary English CMUdict does not list (`high-souled`, `star-inwrought`,
  `dew-pearled`) in Keats, Shelley, Arnold, Rossetti, Blake, Browning.
  `line_readability` had misfiled the unread piece as INTERIOR unreadable in
  328 of 328 cases; `interior_unreadable` is derived by POSITION now, so no
  string coincidence can put a final piece in it, and 0 of 323 are misfiled.
  Both hyphenated pairs in the sonnet battery score 1.0 correctly because
  their last piece reads -- so the oracle was structurally incapable of
  finding any of this, which is why it took a corpus sweep.

## Quality layer (quality/)
Separate from the correctness engine above and deliberately so: the harness
grades whether a rhyme is *correct*, this grades whether the writing is any
good. Ten pre-registered features (quality/PREREGISTRATION.md), a
discrimination test (quality/discriminate.py), results in quality/RESULTS.md.

Four things about it you need before you touch it. Its ten features have **no
demonstrated cross-design signal** (doctrine 10) and two were caught reading
period rather than quality (doctrine 11), so do not build on them and do not
cite their earlier numbers. The floor knows two text lengths — a 4-line
quatrain and a 14-line sonnet — and text outside both gets no length-sensitive
finding at all (doctrine 15). Relations are keyed on eight axes, of which
ANCHOR is declared per MEMBER rather than per pair (doctrine 83). And there are
**eight** adversaries, not the four this paragraph listed until 2026-08-11 —
`BACKLOG.md` §0 holds the roster and its statuses, which is where they belong
because they change:

  1 our RESULTS   line-permutation nulls, matched redeals, shuffled controls
  2 the WRITING   `quality/revise.py`
  3 the CODE's generosity   `quality/redteam_band.py`, band only
  4 the TESTS   `quality/mutate.py`
  5 the CORPUS   `quality/audit_corpus.py`
  6 the TAXONOMY   `quality/audit_register.py --provenance`
  7 the REPORT   `quality/audit_spans.py` — do the number, the label and the
    evidence agree? Its first run said no for 382 of 1014 judged sonnet pairs.
  8 the RECORD   `quality/audit_register.py` — do the documents agree with each
    other and with the code?

Adversary 8 was not on the list when the list was written, and it is the one
that found four false entries in a week: 1–7 all attack the WORK and nothing
attacked the RECORD of it. That is the argument for reading `BACKLOG.md` §0
rather than this paragraph — a roster copied into two files drifts in both.

## Known gaps, priority order
1. **G2P for OOV.** CMUdict lacks hypotenuse, shiesty, coinages.
   Canary test: score "lot o' news" -- "hypotenuse" (currently
   NO_ANCHOR). Fix: g2p-en or equivalent as transcribe fallback.
2. **Fitted substitution matrix — BUILT, and it does not help.**
   quality/fit_matrix.py, RESULTS_MATRIX.md. The floor IS removed: the
   free 0.15 stress gift became -0.0999 bits, and empty/empty coda went
   from 1.0 to -0.000. Held-out separation gains +0.003 (0.9177 vs
   0.9146) -- real in sign, inside anyone's noise -- and the Whitman
   negative control still got worse (21.3% vs 18.0% at matched FPR) --
   BUT THAT HALF IS ALSO WITHDRAWN, for the same reason as the band's --
   AND THE REASON WAS RESTATED ON 2026-08-11, so do not quote the old
   one. It used to read: all four recorded Whitman figures (18.0, 20.0,
   21.3, 26.0) fall inside one line-permutation null spanning
   6.7%-27.3%. That arithmetic no longer holds. 18.0 and 20.0 are the
   pre-`b1d7f64` comparator's and read 16.0 and 17.3 today; 21.3 has
   never been re-run under either, because it needs a fitted comparator
   threaded through `infer_chains` and that is still unbuilt. The
   withdrawal stands on the ground in quality/RESULTS_NULL_SHAPES.md §2
   instead: `corpus/whitman.txt` carries the property under test as
   epistrophe -- half its detected links are REPEAT on an identical
   token -- so it was never an eligible negative control and no
   ordering among figures measured on it means anything. See
   quality/NULL_AUDIT.md.
   NOT the default; Declaration.fitted stays False and a test enforces
   it -- now resting ONLY on the held-out gain of +0.003, which the
   record already called "inside anyone's noise". That is a weaker case
   than this file used to make, and it is the honest one: the fitted
   matrix is not shipped because nothing shows it helps, not because
   something shows it hurts. (Both figures here are the CLEAN ones; the
   first run was fitted on 9.2% corrupted end words.)
   Remaining: sun/much needs a CONJUNCTIVE band rule, not a comparator
   -- its nucleus is identical, so it was never a floor case.
3. **Time layer.** Placement half built, POWERED and null. The blocker
   was never the comparator: it was multiplicity, and family-wise error
   control fixed it (RESULTS_FWER.md). The beat grid still does not
   exist and cannot until audio or a declared tempo enters. NOT a
   second rap corpus -- that was doctrine 8 broken twice (single
   source, single language) and no rap is admissible anyway. The
   binding constraint is EVENTS PER ITEM: 8 events needs ~75% of an
   item's rhymes on one phase to reach 0.80 power, so a cell needs ~40
   events or pooling to reach it. See POSITIVE_CONTROL.md.
4. **Cross-line internal walk.** internal_matches supports two lines;
   no verse-wide positional graph yet.
5. **Assonance corpus.** Moncrieff Song of Roland (1919, PD) pending
   verification that translation preserves laisse assonance.
6. **Non-English phonology.** FOUR CELLS UNBLOCKED (quality/phonology/):
   fin, som, ltc — cheap for three DIFFERENT reasons, so three
   implementations rather than one G2P with three tables. Finnish: a
   near-phonemic orthography, regular syllabification, stress fixed on
   syllable 1 (rules only, nothing to licence). Somali: phonemic 1972
   Latin script, (C)V(V)(C), and it REFUSES a stress grid — pitch
   accent, not stress, so grid_unit is the mora. Middle Chinese: not
   G2P at all but a lookup, data/qieyun_mc.tsv (CC0), 19,499 chars,
   plus the 平水韻 同用 grouping without which 流/樓 do not rhyme.
   Welsh: near-phonemic, and its EIGHT DIGRAPHS (ch dd ff ng ll ph rh
   th) are single consonants -- split them and every consonant
   skeleton in the language is wrong while still looking plausible.
   cym implements croes/traws/sain/llusg on Welsh units, with a
   PROCLITIC list (y, a, i, o, yn, ar, fy, ei ...) because penultimate
   stress otherwise makes every monosyllable stressed and llusg then
   "answers" on the definite article. FIXED: check_cynghanedd now takes
   `language` and DEFAULTS TO WELSH; `--lang=eng` keeps the original
   CMUdict path for English imitation (Hopkins wrote it) and labels
   itself an imitation. Every result declares its phonology. It had
   built its skeleton from CMUdict since the first commit, so the seven
   recorded rule errors are findings about the RULES, never about Welsh.
   PHONOLOGY still blocked: Indic (prasa), Old Norse (hendings).
   TEXT blocked for Welsh: see SEARCH:welsh-cynghanedd-corpus in
   data/sources.tsv. The capability is built; the corpus is not
   reachable.
7. **Blueprint identity-with-variation.** Outro-extends-intro,
   chorus variation. Current refs are verbatim-only.

## The doctrine index — every number, and where it lives

`W` = this file, above. `A`–`F` = the part of `quality/METHOD.md`. Nothing is
defined in both places; every `doctrine N` citation anywhere in the repo
resolves through this table.

**The invariant, so it can be checked rather than trusted.** Extract every
`^\d+\. \*\*` between the `<!-- DOCTRINE-BLOCK -->` markers of these two files;
that set must be exactly 1–95, with no number in both. Extract every
`doctrines? N` reference in the repo (with a literal space — `data/`
`concreteness.txt` has a lexicon row `doctrine` TAB `0` that `\s` would read as a
citation); every one must land in that set. At the split there were 1,630
reference sites over 87 distinct numbers across 1,000+ files, so a number
cannot be renumbered — only added.

| # | in | doctrine |
|---:|:---:|---|
| 1 | `W` | Declaration tuple |
| 2 | `W` | Graph first |
| 3 | `W` | Band-pass, TYPED |
| 4 | `W` | Four layers |
| 5 | `W` | Weights are `fitted: false` |
| 6 | `W` | No weighted quality score, ever |
| 7 | `W` | Rejection, not selection |
| 8 | `B` | Never fit on one tradition |
| 9 | `W` | Optimizing toward the phonetic maximum is the slop direction |
| 10 | `B` | The quality layer has NO demonstrated cross-design signal |
| 11 | `B` | Two features have now been caught reading period, not quality |
| 12 | `B` | Wimsatt binding is unsupported here, under two operationalizations |
| 13 | `B` | Any resource used to score a cell must be INDEPENDENT of that cell's label |
| 14 | `B` | A control may not be defined in terms of the quantity it controls |
| 15 | `B` | Text length is a coordinate of the declaration, not a detail |
| 16 | `B` | An uncalibrated threshold does not fail safe, it fails loud — and it fails toward whoever guessed |
| 17 | `B` | A check may be kept after its premise is falsified, but never quoted as if it were not |
| 18 | `B` | A licence granted by pattern must be earned by systematicity |
| 19 | `A` | An argmax over a swept parameter is biased toward whichever end of the sweep has more degrees of freedom, and must be withheld on a null result |
| 20 | `A` | "Inconclusive by construction" is not "null", and collapsing the two is a false negative dressed as a finding |
| 21 | `B` | Removing a floor does not remove COMPENSATION, and they are different defects |
| 22 | `B` | State a threshold as a false-positive rate, not as a point on a scale |
| 23 | `B` | A fix can remove one unconditional gift and hand out another |
| 24 | `W` | When a rule would delete a category, make it RELABEL instead |
| 25 | `A` | Agreement is not evidence, and one channel can need both predicates |
| 26 | `F` | Normalize U+2019 anywhere a word is extracted from text |
| 27 | `A` | A null must not be conditioned on the filter it is calibrating |
| 28 | `A` | Distinguish "none" from "cannot tell", mechanically |
| 29 | `B` | BH and FWER have different resolution requirements, and BH's is brutal |
| 30 | `A` | A powered null is a different claim from an unpowered one |
| 31 | `A` | Run the positive control before believing any null |
| 32 | `W` | A corpus is defined by the property under test, not by a genre or a language |
| 33 | `A` | Correcting across items is not combining evidence across them |
| 34 | `W` | Every corpus file must have a row in data/sources.tsv, including the local ones |
| 35 | `E` | Prominence is not always stress, and faking it is invisible in the numbers |
| 36 | `E` | A rime dictionary is finer than any poet worked to |
| 37 | `W` | Test a phonology against its tradition, not against its own rules |
| 38 | `D` | A writing system can postdate the provenance cutoff, and that is a different trap from a modern edition |
| 39 | `D` | Record a failed source search as a row, not as a memory |
| 40 | `D` | A licence on a compilation is not a licence on its contents, and the two layers separate cleanly |
| 41 | `A` | A positive control can pass for the wrong reason, and only a second control tells you which |
| 42 | `A` | The cross-family replication came back negative, twice |
| 43 | `E` | A checker can implement a tradition's rules and never have read that tradition's language |
| 44 | `W` | The blocker is not always difficulty |
| 45 | `W` | Give a form's checker the language of the form, and make the language a coordinate |
| 46 | `W` | A function-word list is part of a phonology, not an optimisation |
| 47 | `W` | A revision loop that only checks the line it was told to fix is a rubber stamp |
| 48 | `W` | Doctrine 9 is only real once it is mechanical |
| 49 | `D` | Re-test the channel map before believing a NOT-FOUND row |
| 50 | `E` | An orthographic layer can silently destroy the very constraint a cell measures |
| 51 | `D` | Corroboration across repositories can be a single file |
| 52 | `D` | A perfect licence over a destroyed signal is still unusable, and the destruction is channel-specific |
| 53 | `C` | Admissibility is per-RELATION, not per-corpus |
| 54 | `D` | A repo-root LICENSE is a claim about part of the repo |
| 55 | `E` | Punctuation is not metre |
| 56 | `A` | A search over placements needs a null under the same search |
| 57 | `A` | An empirical p sitting at 1/(n+1) is reporting the resolution, not the effect |
| 58 | `B` | A recorded COUNT is a threshold nobody wrote down |
| 59 | `C` | Refusing on SCRIPT has a measurable cost, and it should be paid in the open |
| 60 | `C` | Derive a refusal from what the RELATION needs, not from which relation looks vulnerable |
| 61 | `B` | A rule that fires more often is not a better rule |
| 62 | `W` | The tradition frequently states the rule you were about to invent |
| 63 | `A` | Check whether your null is the identity map before you trust it |
| 64 | `A` | A big true effect and an uninterpretable headline are compatible |
| 65 | `E` | The same mark means opposite things in two languages, and both are right |
| 66 | `F` | A tie broken by iterating a set is a result that does not reproduce |
| 67 | `C` | A refusal rate is not a tax -- measure WHERE it falls |
| 68 | `A` | The identity-map trap has more than one shape |
| 69 | `A` | A null can be a null about the wrong thing |
| 70 | `E` | Modernising an orthography can move it FURTHER from the sound the form constrains |
| 71 | `A` | A negative control that does not separate from its own null is not a negative control |
| 72 | `B` | A calibration measured at n=6 is not a calibration |
| 73 | `A` | A single CV seed is a coin flip reported as a verdict |
| 74 | `A` | Check that your H0 is uniform before quoting a p from it |
| 75 | `A` | A null that is correct for one predicate can MANUFACTURE a null for another |
| 76 | `A` | A null is only as good as the demonstration that the instrument could have found something |
| 77 | `F` | Parallel cells share a scratchpad, so working files must be namespaced |
| 78 | `F` | A parallel round needs one shared channel-map, updated as it runs |
| 79 | `C` | A REFUSAL is not a failure, and putting it in the numerator charges the wrong layer |
| 80 | `D` | Provenance has TWO gates and the author is the cheap one |
| 81 | `D` | Bound a vague life at the END of its window, and say in the row that you did |
| 82 | `E` | A span that belongs to ONE class was applied to all four, and it under-read the line in both directions |
| 83 | `E` | A locator is per-MEMBER, and suffix alignment was the function rather than a parameter of it |
| 84 | `C` | Ask the phonology in its own declared relation — and keep the channel path reachable |
| 85 | `W` | An express NON-COMMERCIAL grant is a rejection, and it has to bind the same way in every language |
| 86 | `E` | Doctrine 50 finally has a POSITIVE instance, and it inverts the reflex |
| 87 | `D` | Doctrine 51's first NEGATIVE instance, and it is the more useful half |
| 88 | `C` | A rime dictionary keyed on ONE orthographic norm silently refuses the character that NAMES a rhyme group |
| 89 | `A` | Report the excess as a SERIES, because a falling raw rate can hide a collapsing constraint |
| 90 | `A` | A null can be RIGHT and the statistic wrong, and only the pairing tells you |
| 91 | `B` | Doctrine 58 gains an axis: a count is a coordinate of the RENDERING, not only of the threshold |
| 92 | `W` | The admissible source and the complete source can be DISJOINT sets |
| 93 | `D` | "Sung in performance" is a claim about practice; the TEXT has to carry a mark of it |
| 94 | `B` | A positive-case suite cannot find a rule that is too GENEROUS |
| 95 | `F` | The alignment defect was in the SHIPPED comparator, not only the taxonomy, and equal-length examples hid it |

**METHOD's parts.** `A` nulls, controls and what a negative result means ·
`B` thresholds, calibration and fitting · `C` refusals and determinacy ·
`D` corpora, provenance, licences and editions · `E` phonology, orthography and
what an edition does to a constraint · `F` instruments, engineering and running
cells in parallel.

**Reading orders, so the appendix is reached on purpose rather than by
accident.** About to write a phonology module: METHOD part E end to end, then
45, 46 and 62 above. About to fetch a corpus: 34, 44, 85 and 92 above, then
METHOD part D. About to report a rate: 79 first, then METHOD parts A and C.
About to move a threshold: METHOD part B, and 5 above. About to believe a null:
31, 71 and 76, in that order.

**Two numbering systems, and they do not collide.** The `Known gaps` list above
runs 1–7 and is cited elsewhere as `known gap N` (MATRIX_PREREGISTRATION.md,
fit_matrix.py, TIME_PREREGISTRATION.md, test_phon_san.py, test_phonology.py,
test_relations.py, POSITIVE_CONTROL.md, time_layer.py). It is not part of the
doctrine numbering and never was. The doctrine run is delimited in both files by
`<!-- DOCTRINE-BLOCK -->` markers so a checker can tell them apart.
