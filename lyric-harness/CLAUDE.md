# Lyric Harness

Declaration-driven rhyme, meter, and song-structure engine. The model
proposes; these tools grade. Target: MCP server beside Codex Musica —
Codex Musica describes the recording, this disciplines the words.

## Core doctrine (do not drift from these)
1. **Declaration tuple.** Every analysis states its assumptions:
   dialect (CMUdict General American), anchor rule, channel weights,
   thresholds. All in the `Declaration` dataclass. Disagreements are
   located in a coordinate of the tuple, never argued at large.
2. **Graph first.** The full pairwise score matrix is the primary
   object (`rhyme_graph`). Letter schemes, chains, blueprints are lossy
   projections. Maximal cliques may OVERLAP = structures with no letter
   representation (chained slant). Never rebuild a projection-first
   architecture.
3. **Band-pass.** Identity is not rhyme. Relations: RHYME (graded),
   REPEAT (same word), RIME_RICHE (same sound, different word). The
   band inverts by context: REPEAT is a violation inside a verse, the
   requirement across chorus instances, licensed as radif/refrain.
4. **Four layers.** Signal (phoneme channels: nucleus/coda/onset/stress,
   scored separately). Time (NOT BUILT — no beat grid anywhere). 
   Perception (theta is a function: per-genre theta_chain, promotion
   licensed only by declared meter). Value (cliche pairs, shared-suffix
   stem check, REPEAT flags; doggerel = value failure, not rhyme type).
5. **Weights are `fitted: false`.** Hand-set. The fitting path is
   Hirjee-Brown log-odds estimated from the accumulated disagreement
   log. Do not tune by single examples — accumulate, then fit.

## Commands (python3 lyric_harness.py ...)
declaration | score A -- B | candidates W [n] | meter TEMPLATE L... |
scheme LETTERS [--profile assonance|rawi] L... | song blueprint.json
lyric.txt | chains FILE [theta] | graph FILE [theta] | internal "line" |
density FILE | weight "line" | qafiya FILE|L... | cynghanedd "line" |
prasa K L... | demo

## Test discipline
- `python3 battery.py` — sonnet oracle (152 sonnets, ABABCDCDEFEFGG),
  Lear limerick known-answers, Whitman negative control.
- Current baselines: sonnets 8.0% violations (residue = Early Modern
  -y class, archaic -st morphology, rhotic ER/AOR class). Whitman ~26%
  chained at theta 0.82. Rap chains (verse.txt) stable at theta 0.75.
- Triage every failure to a layer: ingestion / projection / anchor /
  comparator / band / structure / value. Fix only when a category
  accumulates. Every fixed case becomes a permanent regression.
- Real exemplars over constructed tests. Constructed tests encode the
  author's assumptions; canon corrects the checker (7 rule errors
  found this way: strict groes final-consonant rule, sain any-stressed
  link, radif licensing, hyphen splitting x2, collision bar, mosaic
  anchor reach, prefix phrase-final seam).

## Known gaps, priority order
1. **G2P for OOV.** CMUdict lacks hypotenuse, shiesty, coinages.
   Canary test: score "lot o' news" -- "hypotenuse" (currently
   NO_ANCHOR). Fix: g2p-en or equivalent as transcribe fallback.
2. **Fitted substitution matrix.** Log-odds from annotated pairs kills
   the additive-floor leak (sun/much at .777, dawn/again class).
3. **Time layer.** Beat grid, bar as unit, on/off-grid placement.
   Needed for chopped-and-screwed / Bone Thugs test. Nothing exists.
4. **Cross-line internal walk.** internal_matches supports two lines;
   no verse-wide positional graph yet.
5. **Assonance corpus.** Moncrieff Song of Roland (1919, PD) pending
   verification that translation preserves laisse assonance.
6. **Non-English phonology.** Welsh (real cynghanedd), Indic (prasa),
   Old Norse (hendings) all blocked on transcription.
7. **Blueprint identity-with-variation.** Outro-extends-intro,
   chorus variation. Current refs are verbatim-only.

## MCP wrap plan
Tools: transcribe, score, candidates, check_scheme, check_meter,
check_song, infer_chains, rhyme_graph, internal, density, qafiya,
cynghanedd, weight. Loop: spec -> draft -> check -> revise flagged
lines only -> re-check. Model never self-certifies.

## House rules
Never abbreviate project names: Codex Musica, Pantheon Registry,
Deus ex Homine, Chocolate Secrets. No artist/producer names as
descriptors in any generation-facing output — era+region+technique.

## Quality layer (quality/)
Separate from the correctness engine above and deliberately so: the harness
grades whether a rhyme is *correct*, this grades whether the writing is any
good. Ten pre-registered features (quality/PREREGISTRATION.md), a
discrimination test (quality/discriminate.py), results in quality/RESULTS.md.

Doctrine additions, earned from the first run — do not drift from these either:
6. **No weighted quality score, ever.** The features stay a vector. The
   exchange rate between surprise and clarity is not derivable; it is a
   genre's answer, so it belongs in a declaration, not in a constant.
7. **Rejection, not selection.** Detecting bad writing held-out at AUC 0.971;
   ranking good writing at 0.709. Enforce a floor, do not order the permitted
   region.
8. **Never fit on one tradition.** Five of ten features INVERT between the
   two experiments. A single corpus does not give a narrow answer, it gives a
   confidently wrong one; Experiment 2 alone would have recommended optimizing
   toward archaic pastiche. Cross-tradition replication is the error bar.
9. **Optimizing toward the phonetic maximum is the slop direction.** Handing a
   model "L2-L4 below theta" makes it reach for the highest-scoring rhyme,
   which is the most predictable one. A revision protocol must push away from
   the optimum: pass the band, but not by taking the modal candidate.
