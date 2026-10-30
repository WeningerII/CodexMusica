# Connection views: shared design debate
Status: PROPOSAL. No named-team consensus or user signoff. Design artifacts only; no product implementation, merge or deployment.
## Equal collaborators
3PO, R2, BB8, Jony Ives, Don Norman. Each may directly revise this document and design sources on this branch. Attribute revisions and address named recipients in #519. Never proxy another person's assent.
## User requirements
Retain full word-occurrence matrix, poem-side connection arcs, grouped word-node network. Show internal connections without ending-only bias. Final PNGs only after genuine named-team debate and review. Latest instructions: 2026-10-30 15:14 and 15:17 UTC.
## 3PO proposal
Three equal full-view tabs, poem/arcs default, shared evidence inspector and exact occurrence selection. One source coordinate per occurrence; duplicate spellings remain distinct. A matrix uses identical token occurrence axes, not token-by-line axes.
No spanning-tree shorthand masquerading as complete edges. Groups neither imply cliques nor one globally consistent pronunciation. Show exact edges for the stated subset; summarize omissions explicitly.
Separate selected scope, relation/figure, dialect/reading policy and evidence status. Anywhere must not silently strip registered placement constraints. Distinguish sound-level comparisons from registered figures if both are offered.
Fixed labeled relation palette: proposal teal #087E8B alliteration, purple #7954B3 rhyme, black selection; blue reserved for navigation. Other families pending design review. Category-count coloring is a separately named mode, never strength.
Directed/span/whole-line/n-ary relationships retain native structure in a linked spans/figures view and inspector; not forced into unordered word cells.
No speculative runtime/performance or complete-coverage claim. Existing AnalysisSession reuse is recommended, not every schema all-pairs.
## Exact illustrative fixture for visual review
NOT computed engine results. Five occurrences:
- know: line 1 token 8
- though: line 2 token 7
- watch: line 4 token 2
- woods: line 4 token 4
- snow: line 4 token 8
Selected pair watch L4w2 / woods L4w4.
Four illustrative positive edges: same-line alliteration watch/woods; end-rhyme know/though, know/snow, though/snow under selected illustrative standard-English readings.
Everything outside this illustrated evidence is not evaluated, not a negative result.
Use explicit label: Illustrative subset · not computed.
## Review positions
### 3PO
Supports occurrence identity, explicit status, real edge sets and consistent views. Original image-generated mockups are NOT signoff-ready: incorrect cross-line alliteration, collapsed anchors, sparse trees, inconsistent color/selection.
### R2
Revised 2026-10-30 15:50 UTC (first position: #519 6526315821; revision: 6526434548). Accepts 3PO's four corrections in full:
- Anywhere is a display scope over registered valid loci. No sound layer until it has its own contract; the writer pair judge is not repurposed.
- Holds are existential. Failing alternate readings are recorded beside a hold and never turn it undecided.
- No group-consistency badge without a replayable joint-assignment certificate. The default is "Joint reading consistency not assessed".
- 5,778 × ~20 is arithmetic only. No performance or coverage claim appears in any PNG.

Endorses `backend-contract-proposal.md` as the working backend contract, with the additions and differences in its "R2 review" section. Conditions for consensus: occurrence identity, registered loci only, outcome/coverage/search completeness kept apart, no transitive or inferred edges, one selection across all three views. Supports the margin-arcs default provided the matrix and the network are equally reachable.
### BB8
Awaiting individual contribution.
### Jony Ives
Committed by R2 at Jony Ives's request, verbatim from #519 comment 6526596222. Jony Ives is review-only and does not push. He will check these conditions on the rendered PNGs at one revision before giving consent.

> Individual position in #519 (this comment). Conditions: (1) navigation and selection carry no hue; selection = 2 px ink ring/underline + `word · Ln wk` tag + 25 % dimming of unconnected marks, identical in all views. (2) Relation families: rhyme #7954B3 solid/R, alliteration #087E8B dotted/A, assonance #B45309 long-dash/V, consonance #BE185D short-dash/C, repetition ink double-hairline/=; colour never sole channel (worst CVD ΔE 16 measured). (3) Matrix shows all five states: holds = family fill; undecided = grey ring "?"; refused = grey ×; fails = grey hairline dot; unexamined = light hatch. Arcs/network draw holds only; other states appear as a count strip under the title and grey ticks on the selected port. (4) Every occurrence has its own port; end↔end arcs bow to the right margin, any internal endpoint bows through the left inter-line space, same stroke weight. (5) Group hull label = "n occurrences · x of y pairs hold"; no "All connections" unless every in-scope pair was evaluated. (6) Fixture adds woods L1 w2 as unexamined to show duplicate-spelling identity.
### Don Norman
Awaiting individual contribution.
## Open disputes / evidence needed
1. ~~R2: Anywhere as placement-stripped pair judge.~~ RESOLVED by R2 accepting 3PO's position (registered loci only; a sound layer needs its own contract).
2. ~~R2: reading disagreement = undecided.~~ RESOLVED: existential outcome, quantifier, completeness and witness stored apart (backend §2 truth table).
3. ~~R2: mutual-consistency badge.~~ RESOLVED: default "not assessed"; a certificate is required (backend §5).
4. ~~R2: 5778 × ~20 cost.~~ RESOLVED: arithmetic only; measurement gate (backend §7).
5. OPEN: BB8, Jony Ives and Don Norman were messaged directly in their own sessions at about 15:35 UTC (R2, at John's instruction) and have not yet posted. No assent is assumed.
6. OPEN (R2): the reading-search completeness flag is not returned by today's API (`reading_combos` computes it; `pair_satisfies_any`/`resolve_line_pair` drop it). The evidence fields `reading_search.state` and `termination_reason` need that engine change before any view can show "search cap". It must be costed and tested before it is promised.

## Review process
Named collaborators revise here, identify decisions/disagreements, point #519 to commit. Reconcile spec; render exact local design sources to PNG (not product implementation); all named collaborators inspect same revision and explicitly resolve objections before final presentation.
