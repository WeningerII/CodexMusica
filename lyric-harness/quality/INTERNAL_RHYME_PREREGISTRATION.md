# Pre-registration — the in-line rhyme rate: what English verse does between the end words

## WITHDRAWN 2026-08-23 BY THE OWNER, BEFORE ANY CORPUS NUMBER WAS READ

**State at withdrawal, exactly:** registered; both falsifiers run and passed
(F1 the Raven fixture, F2 as amended below); the observed arm and null
replicates 1–7 computed in a background process that was **killed at
replicate 8**; `data/internal_rhyme_eng.tsv` **never written**; nothing
adopted; no number from this instrument is quoted anywhere in the repository
and none may be. The document is KEPT rather than deleted because a
withdrawn registration is evidence about how a decision was made (doctrine
17), and because its amendment below records a real instrument property that
the successor work inherits.

**Why it was withdrawn, in the owner's words:** *"it looks like you may have
taken 'internal rhyme' literally... I was using internal rhyme as an example.
It appears as though you're doing an internal rhyme calibration and I gotta
tell you that's a really lazy move when we actually have 77 included if you
did everything right."* The registration is not wrong, it is **parochial**:
it calibrates ONE cell of a vocabulary that holds 77 named schemas over 154
member span-rules, at a moment when the binding defect is that the DEFAULT
grading path reads `words[-1]` and reaches none of them. Calibrating the
example instead of converting the spine is the same shape as building a
third partial instrument beside two existing ones.

**What survives, and where it went.** The two-exclusion discipline (a
both-line-final pair IS the end-rhyme scheme; REPEAT is identity, not rhyme)
and the placement-destroying null (shuffle the non-final tokens, hold the end
words fixed, so vocabulary and scheme are held while PLACEMENT is broken) are
both correct and both generalize: placement is the coordinate under test for
every schema in the registry, not just this one. They are carried into the
web-wide work, and `quality/internal_rhyme_rate.py` is retired as a
standalone instrument in the same commit that lands its successor — a
one-cell instrument kept alive beside a general one is the private-workflow
defect standing rule 3 exists to stop.

**One instrument property banked here because it cost a falsifier to learn**
(see the F2 amendment below): at this reader's grain — stressed-syllable
anchors, spans of 1–3 syllables, theta 0.80 — sound matches are admitted in
very nearly any English text, INCLUDING one constructed to contain none. So
no raw rate from this reader may ever be quoted as "deliberate" anything;
only observed-against-null carries information. That constraint binds the
successor work and is the most useful thing this sitting produced.

---

*The registration as it stood at withdrawal follows, unedited except for this
header.*

Committed before any number over the corpus exists. Protocol pattern:
`quality/METER_BANDS_PREREGISTRATION.md` (register → measure → adopt or
refuse → CI re-derives) and `quality/KALEVALA_ALLITERATION_PREREGISTRATION.md`
(whose run 1 was VOIDED by its own table head for an undeclared tokenizer —
the reason every coordinate below is named before the run).

Authorized 2026-08-23 by the owner's ruling, verbatim: **"measure-first then
adopt"** — after the owner's finding that this harness measures END rhyme
only ("insane"), that internal rhyme cannot be measured at the end of a line,
and that `rhyme_density` "does not go far enough." The census behind that
finding: `line_anchors` builds every graded anchor from `words[-1]`; the
registry's 19 intra-line figures are ungradeable by the mandate route
(refused-for-placement, correctly); `internal_matches` and `rhyme_density`
are wired only to display verbs (`internal`, `density`) and reach no grading
path; and `rhyme_density`'s cross-line walk is hardcoded to `lines[idx+1]` —
distance ≤ 1 structurally (known gap 4's own sentence).

## The question

At what rate does English song verse place rhyme INSIDE the line — spans
that are not the end-rhyme scheme — and does that rate separate from the
same vocabulary randomly re-placed? If it separates, the measured table
becomes the calibration basis for an in-line coordinate (the meter-band
pattern: the band is derived from the measurement, never guessed). If it
does not separate, the in-line axis is REFUSED at this instrument and the
refusal is the record — a finding this harness cannot distinguish from
chance must not become a finding it emits (doctrine 16/76).

## The instrument, every coordinate declared (doctrine 1)

| coordinate | value |
|---|---|
| reader | `lyric_harness.internal_matches(lex, text_a, decl, text_b=..., theta=None, max_window=3)` — the SHIPPED function, not a reimplementation. Its own defaults are the declared values: theta = `decl.theta_rhyme + 0.05` = 0.80, `max_window=3`. Neither is tuned here; this registration measures UNDER the instrument's standing declaration (doctrine 5/58 — no new threshold is invented by this run). |
| anchors | the function's own: every span of 1–3 syllables beginning on a stressed syllable (stress 1 or 2), both texts. |
| admission | the function's own: `total >= theta` or relation `RIME_RICHE`; greedy non-overlapping pick sorted by (score, combined length). |
| lexicon / declaration | `Lexicon()` / `Declaration()` at shipped defaults — the same objects every grading verb builds. |
| calls per quatrain | 10: four within-line (`text_b=None`) and six cross-line, every unordered line pair of the quatrain. Line distance is a declared split: 0 (within-line), 1, 2, 3 — reported apart, never summed (doctrine 79/89). |
| corpus | the declared positive population of the negative control: `negative_control.load_quatrains(cap_per_file=8, min_chars=12)` — 4-line stanzas over `corpus/song/eng_*`, capped in FILE ORDER per file. The whole population is run; nothing is sampled. Cost was MEASURED before this registration (0.085 s/quatrain, 10 calls) and the arm sizes below are derived from it, not guessed. |
| unreadable words | `word_syllable_map` drops them, so they are in neither numerator nor denominator — the same disclosed behaviour `rhyme_density`'s docstring records. The count of affected quatrains is reported. |

## The two exclusions, and why they are the point

A picked span-pair is EXCLUDED from every statistic when:

1. **Both spans are line-final** — `a_syll[1] == nA` and `b_syll[1] == nB`
   (the function returns all three). A both-final pair IS the end-rhyme
   scheme, the axis every existing instrument already measures; leaving it
   in would let this registration restate the end-rhyme rate and call it
   internal. A pair with ONE line-final span stays — `dreary`~`weary` in
   Poe's own quatrain is mid-line against line-final, and it is the
   phenomenon. Within-line calls cannot trip this exclusion (two
   non-overlapping spans cannot both end at `nA`), which is correct: the
   exclusion exists to excise the scheme, and the scheme is cross-line.
2. **Relation REPEAT** — identity is not rhyme (doctrine 3). A refrain
   word recurring across lines, or a word said twice in one line, passes
   theta at 1.0 and measures repetition, a different axis with its own
   machinery.

Both exclusion counts are reported beside the kept counts, never summed
into them.

## The statistics

- **S1 — syllable coverage (headline).** Per quatrain: distinct syllable
  positions covered by at least one kept span, over total readable
  syllables. Corpus figure: pooled (sum of numerators over sum of
  denominators) AND the per-quatrain distribution (quartiles). The same
  shape `rhyme_density.overall` has, under the two exclusions.
- **S2 — kept pairs per distance.** Count of kept span-pairs at each line
  distance 0/1/2/3, per quatrain and pooled. This is the series doctrine
  89 asks for: one pooled number can hide a distance profile collapsing.
- **S3 — relation split.** Kept pairs by relation (RHYME / RIME_RICHE /
  ASSONANCE / CONSONANCE as the band types them). Disclosure, not a
  gate.

## The null (doctrine 27/63/76)

**Within-quatrain non-final shuffle, end words held fixed.** For each
quatrain: collect the non-final word tokens of all four lines, shuffle
them with a seeded RNG, redistribute preserving each line's non-final
word COUNT; each line's final word stays in place. Then run the identical
10 calls under the identical exclusions.

- What it holds fixed: the vocabulary (every token survives), the
  end-rhyme scheme (final words untouched — so exclusion 1 excises the
  same scheme from both arms), the word-count profile per line.
- What it breaks: the PLACEMENT of every non-final word — which is the
  only thing a deliberate internal rhyme is.
- What it does not hold: per-line syllable counts (words of different
  lengths swap lines). Reported: the null arm's mean absolute per-line
  syllable drift, so the reader can see the perturbation's size.
- Seeds: replicate r, quatrain q uses `random.Random((20260823 << 8) + r
  * 1_000_003 + q)` — deterministic per (r, q), independent of execution
  order (doctrine 66), no wall clock anywhere.
- **20 replicates**, each a full pass over all 4,217 quatrains. Derived
  from measured cost: 0.085 s x 4,217 ≈ 6 min per arm; 21 arms ≈ 2.1 h
  sequential, run 4-wide ≈ 35 min. The empirical p's resolution is
  therefore 1/21 (doctrine 57: a p at the floor reports resolution, not
  effect — the excess series is the finding, the p is a check).

## Expectations and falsifiers

- **E1 (the phenomenon separates).** Observed S1 exceeds all 20 null
  replicates' S1, and the excess is reported per distance (S2) as a
  series. If observed sits inside the null spread, the in-line axis is
  REFUSED at this instrument — recorded, nothing ships, and the refusal
  names the instrument coordinate most likely responsible (theta, the
  greedy pick, the anchor rule) WITHOUT moving any of them in the same
  sitting (doctrine 19: no post-hoc sweep rescues a null).
- **F1 (positive control, run FIRST — doctrine 31).** Poe's Raven
  quatrain ("Once upon a midnight dreary…"), which the instrument was
  probed on before this registration (dreary~weary RHYME found), must
  yield ≥ 2 kept pairs under the full exclusion rule. Zero means the
  exclusions or the harness cannot see the canonical case: the run is
  VOID before any corpus number is read.
- **F2 (the exclusion excises exactly the scheme).** ~~A constructed
  quatrain whose ONLY sound repetition is a perfect AABB end-rhyme
  (verified by inspection at construction) must measure S1 = 0. If it
  does not, exclusion 1 leaks and every corpus number is VOID.~~
  **AMENDED 2026-08-23, BEFORE ANY CORPUS NUMBER WAS READ, because the
  registered spelling fired on its own auxiliary assumption and the
  diagnosis is a disclosure this registration needs anyway.** The AABB
  fixture measured S1 = 22/40 with BOTH scheme pairs correctly excluded
  (`both_final=2`): the exclusion did not leak — the fixture's
  "verified by inspection" premise was false. `whistled`~`distant`
  share the IH-S rime at 1.000; `No`~`frozen` share open OW at 1.000;
  the inspection missed them, and at the single-stressed-syllable grain
  under theta 0.80 a zero-match English quatrain may not be
  constructible at all. TWO CONSEQUENCES, both registered here: (a) F2
  is re-spelled MECHANICALLY — on the Poe fixture the admitted
  both-final pair count is exactly 1 (`lore`~`door`) and on the AABB
  fixture exactly 2 (`plain`~`rain`, `hills`~`rills`), and with
  exclusion 1 disabled in-process the AABB fixture's kept-pair total
  rises by exactly that both-final count, proving the exclusion is
  load-bearing and exact; a drifted count fails loud. (b) The raw
  observed rate is hereby barred from being quoted as "deliberate
  internal rhyme": the instrument at its shipped grain admits matches
  in nearly any English text, so the only statement this registration
  licenses is observed-against-null — which is what it was designed to
  say, now with the reason demonstrated on its own falsifier fixture.
- **F3 (the null is not the identity map — doctrine 63).** Per replicate:
  count quatrains whose shuffle returned every word to its own slot.
  Quatrains with ≤ 1 movable token are identity BY CONSTRUCTION — counted
  apart and retained in both arms (they contribute equally). Beyond
  those, the identity fraction must be < 1%; otherwise the null is
  underpowered and the run is VOID.

## What adoption means here, and what it does not

On E1 success the artifact `data/internal_rhyme_eng.tsv` is ADOPTED: the
observed table (S1 pooled + quartiles, S2 per distance, S3) beside the
null chance rates — the same move the structure census made ("English
alliterates by accident at ~9%" is the sentence this table exists to be
able to say about in-line rhyme). A `--check` mode re-derives the
observed row and null replicates 1 and 20 EXACTLY (declared here before
the run: the full 21-arm re-derivation is ~35 minutes and the two named
replicates bound the cost while pinning both ends of the seed range;
every replicate's seed is in its own row, so any of the other 18 is
re-derivable by hand). **No finding, no band, and no threshold ships from this
registration.** Wiring an in-line coordinate into the floor or the grader
is a SEPARATE sitting against the adopted table, per the owner's
measure-first ruling — the same two-step the meter bands walked
(calibrate, then the band; never both in one run).

## Bounds of the claim

English (`eng_*`) only; quatrains only (the stanza shape the declared
positive population is built from); the instrument's own theta and window,
named above, are coordinates of every number — a rate quoted without them
is not this rate (doctrine 58/91).
