# The blind panel runs of 2026-08-25, and what they forced into code

**WHAT THIS DOCUMENT IS.** The dated record of two blind judge-panel runs
over the six banked songs, the mechanical measurements they triggered, and
the planning protocol adopted for any future run. **A PANEL VERDICT IS MODEL
OUTPUT AT NONZERO TEMPERATURE: it does not re-derive byte-identical, so
NOTHING IN CI GATES ON ANYTHING IN THIS FILE** (the same rule that keeps
graphify's semantic pass out of the shipped invocation — a non-deterministic
derivation is recorded beside deterministic ones only with its provenance on
it). What DID become enforceable was re-derived mechanically and lives in
`quality/sentencehood.py`, whose `--check` is deterministic and does gate.

The runs were reached through a failure worth recording: the owner heard
`songs/long_bridge.txt` as a bad song while every gate in this tree said
exit 0, and the first analysis (M-106-era instincts, song-level statistics)
exonerated the plan without locating the defect. The panels located it.

---

## 1 · The planning protocol (adopted before run 2, owner's instruction)

A panel run refuses to launch without: **(1)** a declared one-sentence
question; **(2)** the mechanical-first test — a question a deterministic
check can answer spends no judge; **(3)** lenses derived from named
hypotheses, one REJECT criterion each; **(4)** the SECTION as the unit of
judgment, every ballot quoting from its own section — a verdict with no
quote is DISCARDED, which makes full reading verifiable instead of hoped;
**(5)** at least one SET lens whenever the panel sees more than one artifact
— per-item questions structurally cannot see between-item failures;
**(6)** ground truth declared up front, typing the run as CONTROL (pass
condition fixed before launch) or MEASUREMENT (verdicts only, nothing
"confirmed"); **(7)** aggregation fixed in advance: independent ballots,
zero cross-talk, shuffled blind labels with the key recorded before launch,
suspect items never first or last, majority per unit, disagreement kept as
data; deliberation-to-consensus is REFUSED — debate selects the persuasive
judge, not the true reading.

## 2 · Run 1 — the control: can blind readers hear what the owner heard

Question: does a context-free reader detect the song the owner condemned?
Five judges (sonnet-class), one lens each — sentences, imagery, coherence,
freshness, prosody — six songs, labels shuffled (key recorded first:
A=one_more B=turn_the_wheel C=long_bridge D=stay_awake E=carry_it_over
F=keep_the_light; the suspect at position 3). Pass condition, fixed before
any verdict returned: the panel converges on C.

**Result: 5/5 REJECT C, 5/5 name C weakest, and 24 of the 25 other verdicts
are PASS** — the panel is not a hair-trigger. Each lens named the same cause
in its own vocabulary: "comma-spliced noun lists ... almost no verbs" /
"imagery-as-noise, not picture" / "sections could shuffle freely without
loss" / "nothing here is predictable OR memorable" / "no phrase a melody
could carry". Five complaints, one defect: **lines without verbs.** The 25th
verdict was the imagery judge rejecting A (`one_more`) for its coda —
"unearned dockyard imagery" — which run 2 was partly designed to test.

## 3 · Run 2 — the measurement: sections and tics in the five that passed

Two lenses. **Section lens** (3 judges, 63 ballots each, every ballot
quoting its own section): unanimous — exactly three sections REJECTED 3/3,
zero disagreement across 189 ballots: `one_more`/POSTCHORUS1,
`one_more`/CODA1 (run 1's disclosed prior, confirmed),
`turn_the_wheel`/PRECHORUS1. **Set lens** (3 judges, every claimed tic
needing quotes from >= 2 songs): 3/3 STRONG — a blind listener would clock
one author. The independently-converging tics: verbatim no-variation
choruses; the "almost/Nearly" false-ending echo in two songs; "nothing to
spare" in three; doubled-word emphasis; `thread/brake/nigh/ache/spare/
crossed/quay` — one judge's words: **"a rhyme-word bank reused like one
glossary."**

## 4 · The mechanical half — what the panels turned into numbers

Everything below is deterministic and re-derivable; the load-bearing figures
are re-derived nightly by `python3 quality/sentencehood.py --check`.

- **Cross-song repetition is real and extreme.** Content types shared by
  >= 4 of the six songs: **10** (`light` in 5/6 at 11 tokens; ache, crossed,
  dark, groan, hold, stair, stone ...). Matched null — 300 draws of six
  human songs from six different files — median **1**, max **8**, so ours
  sits outside the null's entire range. At >= 3 of 6: ours 28, null median
  7, max 22. Whole phrases recur: "ache in the wrist" in two songs, "say
  it" in three.
- **The funnel has receipts.** 16 of the 50 words screened during
  `carry_it_over`'s session are SUNG in `long_bridge` — a different song,
  including three of the four members of the `-ay` clean list (weigh, grey,
  sleigh) and both of `spark/arc`. The ban tables and lexicon are fixed, so
  every session shopping a family gets the same short clean list: doctrine
  9's push away from the modal candidate manufactures a SECOND mode one rank
  out — M-88's finding operating across songs. Open as **M-111**.
- **Local binding density is the pressure, at the right grain.** The three
  rejected sections rank **1st, 6th and 10th of 62** lyric sections by
  rhyme-group members per line (from each song's own banked mandate) — while
  song-MEAN density had exonerated the planner (this plan looser than 90% of
  120 draws). Both readings are true; the grain was the error. Density is
  not sufficient: ranks 2-5 are equally dense and passed.
- **The sentencehood calibration** (all figures re-derived by `--check`):
  the STACKED predicate (verbless & function-share <= 0.15 & commas/token
  >= 0.15 & >= 4 tokens) reads 1.17% of a flat 3,000-line human sample and
  0.80% of 1,500 sonnet lines; per-song stacked fraction over the fixed
  500-song protocol has p99 = **0.125**, adopted as the `STACKED_DRAFT`
  ceiling (1.4% of the canon at or over it); `long_bridge` reads **0.16**
  and now grades **exit 3**. The five passing songs read 0.0.
- **The subtle mode's gate was REFUSED by measurement, on the record**:
  human songs carry verbless lines at 33% and 2-runs in 32% of sections,
  and the seven lines of the three rejected sections are statistically
  identical to human verbless lines on every surface feature measured
  (function share 0.40 vs 0.38, commas/token 0.143 vs 0.143). Only reading
  detects that mode; the panel stays its instrument.

## 5 · Honest limits

Run 1 was the weak form of a control — the five "good" songs were only ever
un-condemned, and five judges share model priors, so unanimity can in
principle be a shared blind spot. The strong-form control (a true same-plan
matched pair) remains unbuilt. Judges' single-line POS intuitions and the
tagger disagree at the margins (the tagger reads two of `long_bridge`'s
five INTRO lines as verbed via embedded VBDs inside lists); the adopted
gate therefore catches the FLAGRANT mode only, and says so in its module
docstring. The blinding was enforced by instruction (read exactly one
file), not by sandbox.

---

## 6 · Run 3 — series song 3 measured, 2026-08-25 (MEASUREMENT)

Question, declared before launch: does a context-free reader find any section
of `wheat_mane.txt` defective, and does the eight-song set still read as one
writer's glossary now that a song written under the live gates has joined it?
Type: MEASUREMENT (no pass condition). Six sonnet-class judges, independent
ballots, zero cross-talk. Set-lens shuffle key, recorded before launch:
A=stay_awake B=wheat_mane C=keep_the_light D=long_bridge E=one_more
F=taught_me_time G=carry_it_over H=turn_the_wheel (suspect B neither first
nor last).

**Section lens (3 judges — sentences, imagery, prosody — every ballot
quoting its section):** no unanimous rejection anywhere, which run 2's three
3/3 rejections make worth saying. Majority rejection: CHORUS1 at 2/3 —
sentences ("Sheet, row, read dune grain — three verbs crammed ... forcing a
guess") and imagery ("'dune grain' and 'wheat mane' import a desert/farmland
landscape into a rain-lashed sailing scene; the chain reads as
sound-matching"). Minority rejections: DROP1 1/3 (prosody: "stacked
stop-consonant collisions ... no vowel space anywhere in the section") and
PRECHORUS1 1/3 (imagery: "Zeal pulls more than praise" as an abstract maxim
present for its sound). CHORUS1 is the song's densest section by bound
members per line (23 bound words over 6 lines against a song mean of 2.6 per
line) — the local-density pressure of §4 reproducing on a fresh song, on a
new surface: grammar intact, verbs present, and the drift moved into the
SEMANTICS instead.

**Set lens (3 judges, all eight songs):** glossary verdict 3/3 STRONG — and
every evidence list locates the core cluster (light, ache, groan, stone,
stair, thread, spare, crossed, dark, cost, nothing, dry) in the first six
songs, with one judge writing "C, E, and H alone share seven-plus words ...
one writer drawing from the same word-bank." The two gate-era songs sit
outside that cluster: B (wheat_mane) enters only common song-stock rows
(tide, freight, hands, night, rain, wind, keep). Odd-one-out: B at 2/3 —
"abandons narrative and emotion entirely for dense ... sound-play", "pure
nautical-jargon sound-texture". Weakest of the set: D (long_bridge) at 2/3,
the control still converging blind; 1/3 named F's FALSE_ENDING2 bridge
("disconnected grab-bag of images").

**The mechanical half, re-derived here:** content types in >= 4 of the eight
songs: 16, and wheat_mane appears in two of them (hands, all). Eleven of
wheat_mane's 52 bound words were sung in long_bridge although its lists were
never consulted — the funnel receipt now in that song's README entry, filed
under M-111. The panel's verdicts are model output at nonzero temperature;
nothing in CI gates on this section.

**What run 3 changes:** the defect the gates closed (verbless stacks) did
not recur; the pressure that produced it did, one surface over — maximally
bound sections read as words chosen for sound with the grammar intact. That
is filed as `MISSING.md` M-112 (the bound-token share of a section is
disclosed by nothing), and the panel remains the only instrument for the
semantic half, per §4's subtle-mode refusal.

---

## 7 · Run 4 — series song 4 measured, 2026-08-25 (MEASUREMENT)

Question, declared before launch: does a context-free reader find any
section of `matinee.txt` defective — in particular, do its maximally bound
sections read as words chosen for sound (M-112's pressure), do its two
stacked lines read as catalogue rather than sung phrase, and do its
function-word prominence dilutions read as audible padding — and does the
NINE-song set still read as one writer's glossary? Type: MEASUREMENT (no
pass condition). Six sonnet-class judges, independent ballots, zero
cross-talk: three section judges (sentences, imagery, prosody — every
ballot quoting its own section, a quoteless verdict DISCARDED) and three
set judges. Set-lens shuffle key, recorded before launch:
A=turn_the_wheel B=keep_the_light C=matinee D=stay_awake E=long_bridge
F=wheat_mane G=one_more H=carry_it_over I=taught_me_time (suspect C
neither first nor last). Results below were appended after the ballots
returned; nothing above this sentence moved after launch.

**Section lens (3 judges — sentences, imagery, prosody — every ballot
quoting its section):** VAMP1 REJECTED **3/3** — the first unanimous
section rejection since run 2's three. Sentences: "Prayer kites, curator
quips, and all July" — "a three-item noun list with no verb anywhere in
the line". Imagery: "'ballet receipt' is a nonsense object, and the
section as a whole strings in dukes, an heir, a museum curator, an arcade,
and a hotel suite ... words chosen to hit the -ay/-eat sound family rather
than to build one scene". Prosody: "'Bronze dukes nod' collides three
heavy stressed monosyllables". VAMP1 is the song's largest and most bound
section (twelve lines carrying the seven-member EY clique and the
five-member IY-T clique among others) — M-112's local-binding pressure
reproducing for the third consecutive measured song, now with the grammar
gate live and the drift split between semantics and a verbless line the
STACKED predicate did not read (its commas are light). Majority rejection:
CODA1 at 2/3 (imagery: "a giraffe appears out of nowhere ... imported to
rhyme with 'carafe'"; prosody: "the highest density of unphraseable
lines"). Minority: CHORUS1 1/3 and VERSE1 1/3, both prosody — and both
quotes name the PROMINENCE REPAIRS: "'and the' strings two limp function
words together as audible padding" (the dilution that took L10 from nine
prominent to seven) and "six stressed monosyllables stack with no
unstressed syllable to hang a phrase on" (a line the band PASSES at
seven). Filed as M-115: the band is a COUNT, and both of its evasions are
audible — padding down into it, and clotting inside it.

**Set lens (3 judges, all nine songs):** glossary verdict 3/3 STRONG, and
all three evidence lists confine the core cluster (iron, groan, stone,
ache, spare, cost, crossed, nigh, thread, brake, stair, quay, cinder,
freight, spark, dark) to the six pre-gate songs — one judge: "seven of
nine songs draw on this same lexicon", counting the two sea songs' freight
/tide/opaque rows in. C (matinee) odd-one-out **3/3** — "the only song
built entirely on French-loanword, urban-leisure diction ... with none of
the iron/stone/ache/dark/freight glossary". Weakest: F (wheat_mane) at
**3/3** — a NEW convergence, and the reason is SHAPE, not words: "it never
returns to a chorus or hook and simply stops mid-thought after a single
verse", which is seed 2's own drawn form (the song ends on a fresh
two-line verse) read blind as an unfinished song. Run 3's weakest
(long_bridge, 2/3) now sits inside the glossary cluster unremarked — a
different panel, a different set, and the disagreement is kept as data.
One judge also produced a PHRASE-level funnel receipt across the two sea
songs: "dried salt" verbatim in long_bridge and wheat_mane, two songs
written months of tree-time apart with no shared session.

**The mechanical half, re-derived here:** content types in >= 4 of the
nine songs: 15, and matinee appears in two (all, door). The core cluster
stays confined to the first five songs; all three gate-era songs sit
outside it. The panel's verdicts are model output at nonzero temperature;
nothing in CI gates on this section.

**What run 4 changes:** the padding finding is new and is filed
(`MISSING.md` M-115); the maximally-bound-section finding is M-112's
third reproduction and strengthens the case for its disclosure; and the
weakest-song verdict moving to a SHAPE cause hands the planner a taste
question — whether a drawn form that ends on unreturned new material
should disclose itself — that is the owner's to rule on, not a gate to
build.

---

## 8 · Run 5 — series song 5 measured, 2026-08-25 (MEASUREMENT)

Question, declared before launch: does a context-free reader find any
section of `crooked_waltz.txt` defective — in particular, do its maximally
bound sections read as words chosen for sound (M-112's pressure, a fourth
measurement), do the DRAWN relation figures read as sung figures or as
mechanical compliance (the four-line "We" anaphora quartet, the open-AY
chain through the chorus, the Guy/Sky/Pylons head-rhyme triple — the first
banked song whose relations came from the planner's dice, M-117), and do
its function-word prominence dilutions read as audible padding (M-115's
pressure, measured on matinee and repaired the same way here) — and does
the TEN-song set still read as one writer's glossary? Type: MEASUREMENT
(no pass condition). Six sonnet-class judges, independent ballots, zero
cross-talk: three section judges (sentences, imagery, prosody — every
ballot quoting its own section, a quoteless verdict DISCARDED) and three
set judges. Set-lens shuffle key, recorded before launch:
A=taught_me_time B=one_more C=carry_it_over D=crooked_waltz
E=turn_the_wheel F=long_bridge G=stay_awake H=keep_the_light
I=wheat_mane J=matinee (suspect D neither first nor last). Results below
were appended after the ballots returned; nothing above this sentence
moved after launch.
