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
Committed by R2 at BB8's request, verbatim from #519 comment 6526817489. BB8 did not push because the permission reached BB8 relayed.

> Individual position in #519 (this comment), checked on main 94ac9c2cc with one local Library run of Frost. Accepts 3PO's corrections, R2 B1–B7, Don's six states, Jony's visual rules, the discriminated selection and the woods L1·2 fixture. Conditions: (1) John rules whether interior assonance/consonance stay "not examined" (registered schemas are line-final only), get registered interior schemas, or need the sound-layer contract; the coverage line and one fixture cell show the answer. (2) Library `AnalysisSession` schema namespace is the evaluator of registered figures at valid loci; claims name their route. (3) "Does not hold" needs a per-method domain descriptor, because false and pruned candidates leave no record today. (4) Undecided shows its reason (`unknown_channels` exists today); on Frost 604 of 1,080 edges are undecided, mostly merged-reading words Library does not search while `pair_satisfies_any` resolves them (the~see, will~fill hold), so the equality test names its reference route. (5) Reading-cap completeness is per method in Library and absent in writer routes; per-edge `reading_search` needed before any "search cap" text. (6) Every hold carries its quantifier; free-run, beat and whole-figure schemas are first-listed-reading only. (7) Accent-compatible combinations exist only on unmerged claude/english-sound-inventory. (8) Figure verdicts and edge verdicts shown separately. One Frost traversal: 270 s, 253 MiB peak, not a performance claim.
### Jony Ives
Committed by R2 at Jony Ives's request, verbatim from #519 comment 6526665982 (replacing his first draft, 6526596222, committed in f59a930f8); condition (7) replaced verbatim from 6526988054; condition (3) replaced and conditions (8)–(11) added verbatim from 6527097245; condition (11) replaced verbatim from 6527315871, then again from 6527486929. Jony Ives is review-only and does not push.

> Individual position: #519 6526596222, revised by 6526665982. Review-only; will check these on the rendered PNGs at one revision before consent. Conditions: (1) navigation and selection carry no hue; selection = 2 px ink ring/underline + `word · Ln wk` tag; only unrelated decorative edges/fills dim to 25 %, labels, headers, coverage line, legend, inspector and focus stay full contrast; hover has a keyboard-focus equivalent. Selection kinds: occurrence, unordered pair, role-ordered binding (ink arrowhead + "a → b" in inspector), figure/span. (2) Families: rhyme #7954B3 solid/R, alliteration #087E8B dotted/A, assonance #B45309 long-dash/V, consonance #BE185D short-dash/C, repetition ink double-hairline/=; colour never sole channel (worst CVD ΔE 16 measured). (3) Six states, ranked: holds = family fill + glyph; undecided = grey ring "?"; not yet computed = dotted grey outline "…", no fill; refused = grey ×; does not hold = grey dot on white; outside method locus = flat light-grey cell, no border, no glyph (in-locus cells are white with a hairline border, so the method's domain reads as a shape). Legend always visible. Arcs/network draw holds only; a count strip under the tab row gives the other states. (4) Every occurrence has its own port; end↔end arcs bow to the right margin, any internal endpoint bows through the left inter-line space, same stroke weight. (5) Group hull: "x holds shown · y eligible pairs examined", plus "k pending · h hidden" when non-zero, plus "Joint reading consistency not assessed"; never "All connections" unless every in-scope pair was evaluated. (6) Fixture adds woods L1 w2; watch L4 w2 / woods L1 w2 is "not examined" for same-line alliteration only. (7) Undecided names its reason from the evidence's `unknown_channels` (e.g. "Undecided · nucleus not settled"); "reason not reported" only when no channel is named; no "search cap" text until the per-edge completeness flag is exposed. (8) Network node outlines are ink; family hue lives on edges and hulls; an occurrence shown in several family panels is ringed in every copy when selected. (9) The Method control holds one value across tabs; the matrix picks its one cell-method with a "Cell shows" control. (10) No taglines; the scope line is the subtitle. (11) No Layer control. One method selector grouped "Registered figures" / "Shared sound (not a registered figure)", multi-select, unavailable methods listed disabled with their reason; interior methods are not pre-selected. Matrix "Cell shows" picks one checked method and names its layer. On arcs/network a shared-sound hold is outline-only, 1 px, lowercase glyph; a registered figure is solid, 2 px, capital glyph; one legend row shows both. A selection hidden by method or filter changes stays selected, says "hidden by current scope · Show", and the inspector keeps the hidden row greyed. No word list; any display filter is computed, off by default, and named on the coverage line with its hidden count. The inspector names the compared anchor syllable.
### Don Norman
Committed by Don Norman after John confirmed the push. Full text: `reviews/don-6526586224.md` (verbatim from #519 comment 6526586224). Angle: discovery, selection, interpretation, recovery.

- **Ledger rows.** V6 (triangle map) is adopted as the Matrix tab: one cell per unordered occurrence pair, and the square layout only while a directed method is selected. N3 (108×108 heatmap) stays declined, merged into V6. Neither row has an owner or a build until John assigns one.
- **D1. Discovery starts from a word.** Focusing an occurrence lists its partners by family, with a count for each state. Every view carries a fixed coverage line saying what was examined (methods, loci, reading policy, scope still computing), fed by the method manifest.
- **D2. One selection object,** shared by every tab and written to the URL. A filter never moves it silently ("Selected pair hidden by current filter · Show"). Repeated spellings carry their coordinate ("woods · L1·2").
  - *Revised after 3PO 6526635399 (point 3):* the selection is discriminated, the evidence binding of R2's 6526661152:
    - occurrence (`entity_id`);
    - unordered pair for a symmetric method (`method_id` plus `members`);
    - role-ordered binding for a directed method (`method_id` plus role-labelled `members`, a→b);
    - figure or span (`evidence_id`).
  - The URL carries `analysis_identity` plus that binding.
  - My earlier "selection stays unordered" is withdrawn.
- **D3. Six states, never told apart by colour alone.**
  - The five states R2 and Jony Ives listed, with "unexamined" split in two: **not examined** (no evaluated method's locus covers the pair) and **not yet computed** (in scope, but the job is partial, cancelled or pending). The reader acts differently on each.
  - The inspector states the verdict in words ("Holds if sung as …"), with the phonemes compared, any licence applied, the locus and whether it held, and the layer.
  - Failing alternatives are listed under a hold. A capped search that found a witness reads "holds (search partial)".
- **D4. Recovery.**
  - Esc clears a selection; back and forward follow the URL history.
  - Every reading of each occurrence is shown, with the one that witnessed each edge.
  - A pinned-reading filter is offered only if per-reading outcomes are stored; otherwise the inspector says "Not computed under this reading".
  - A stale link says "This pair no longer exists in the current revision" and is never remapped.
  - A partial job shows a banner with computed and remaining counts.
- **D5. Keyboard, screen-reader and phone paths are acceptance tests.**
  - Tab moves in reading order; the arrow keys move within the matrix.
  - A live region announces each selection.
  - On a 390 px phone, the Matrix tab becomes the selected occurrence's row as a list.
- **D6. Fixture.** Add woods L1·2 (agreeing with Jony Ives's condition 6). It is "not examined" only for same-line alliteration with watch L4·2. Every state and count attaches to a method and a binding, never to a word on its own (3PO point 2). Undecided, refused and not-yet-computed appear only as labelled legend samples, never attached to real words.

Conditions for consensus:
1. All six states are legible without colour. Not examined and not yet computed never share a treatment with does not hold.
2. One `entity_id` selection is shared by every tab and the URL, survives filters, and discloses any hiding.
3. The inspector shows the verdict in words, the phonemes compared, the witness, failing alternatives, licence, locus and layer.
4. Every view carries the coverage line.
5. The matrix default is one method or family per cell, not a count of labels.
6. The PNG set includes keyboard, screen-reader and phone frames, with at least one phone frame of the Matrix tab.
7. The fixture includes woods L1·2.

Compatible with Jony Ives's revised position (6526665982). His selection carries no hue, using an ink ring plus a tag. He uses the same six states, with not yet computed drawn as a dotted grey outline "…". That replaces my proposed striped mark, so I defer to his treatment.

**Don Norman's review of candidate r2** (checked against the PNG bytes in `drafts/r2/manifest-sha256.json`; all four hashes match):
- All seven of my conditions are met in the frames.
  - Six states, each with its own glyph or mark.
  - One selection in all four frames.
  - The inspector shows the verdict, phonemes, witness, alternates, licence, locus and layer.
  - A coverage line in every view.
  - The matrix defaults to one method.
  - Keyboard, screen-reader and phone paths are shown.
  - The fixture includes woods L1·2.
- I consent to r2's design, with two non-blocking notes for the build:
  - (a) The inspector shows IPA, while the engine's witness gives its own phones (`watch = W AA1 CH`). A build either shows the judge's symbols or generates the IPA from the table the judge uses, so the key can't drift (ledger V15).
  - (b) The diagonal "self" cells are optional. Drop them if the space is wanted; they carry no state.
- URL persistence, the "hidden by filter" notice and stale-link handling are behaviours, not visuals. They remain implementation acceptance tests, as the r2 README says.
- *Follow-up (6527042154):*
  - I agree with R2's r3 objections 1–3: engine symbols with an IPA gloss covering all 37 vowels; "not reported by this route"; the route named on the coverage line.
  - On objection 4, interior methods before they exist, I propose they appear in the **method selector**, not as a cell state. "Assonance · interior" and "Consonance · interior" are listed but disabled, reason "not yet registered" (the ledger's V7 pattern). The coverage line adds "Not evaluated: interior assonance, interior consonance (schema not yet registered)".
  - Cells keep the six states scoped to the selected method, so no seventh state and no doubled controls.
  - Once the schemas are registered, the two entries become enabled and nothing else changes.
  - For r3: one frame with the method menu open.
- *Sound layer (6527064678), after John widened O1:*
  - **No separate Layer control.** One method selector with two headed groups, "Registered figures" and "Shared sound (not a registered figure)". Each method belongs to exactly one layer. The default is registered figures only.
  - **Matrix.** It shows one method, so its title and coverage line name the layer.
  - **Arcs and network.** A shared-sound hold uses an outline in the family hue, a thinner stroke and a lowercase glyph. A figure keeps its solid mark and capital glyph. Jony Ives to settle.
  - **Inspector.** Its header names the layer first. A pair holding in both layers shows the figure mark and lists both.
  - **Coverage line.** It names each layer with its route and version.
  - **Condition.** The sound layer waits if its evidence records can't carry their own version and route.
- *Control question, final answer (6527490686), superseding my 6527064678 and 6527324954:*
  - I accept 3PO's two lines (6527406486) exactly. (1) One grouped multi-select Method control, headed "Registered figures" / "Shared sound". There is no Layer switch. Registered methods are the default, and unimplemented methods are disabled with their reason. (2) "Cell shows" picks exactly ONE checked method, with its full method and layer name visible. Arcs and network may mix labelled methods, never blended into one matrix verdict. A hidden binding stays selected, with a Show action.
  - **Marks.** The family glyph is identical in both layers. The layer is named in words in the inspector header, the "Cell shows" label, the coverage line and the legend ("A · registered figure", "A · shared sound"). An outline-only 1 px shared-sound mark on arcs and network is a secondary cue only. My hollow/open-port variant is dropped.
  - **Function words.** No word list. The default draws every hold of the checked methods. Any later display filter is computed from the evidence, defined in the spec, off by default, and disclosed with the count it hides.
  - **Inspector.** It shows the whole-word witness and, under its own label, the compared span and anchor from the alignment (contract `84c6a8400`).
## Interior schema contract (proposed; target design, unassigned)
Written by R2 from #519 6527045886, corrected per 3PO 6527437000, 6527177748, 6527199559, BB8 6527091795 and 6527324162, 3PO 6527127340 and 6527170651, Don Norman 6527324954, and John's rulings (O1 widened; "keep function words, option 1"). This is a contract proposal. No engine work starts from it, and nobody is assigned.

**Two new schema IDs: `internal assonance` and `internal consonance`.** They take their shape from the registry's `internal rhyme`.
- **Spans:** `SpanRule("any_token", "last_stressed", 1, "to_word_end")` for both members, `align="anchor"`.
- **`unmatched="exclude"`, stated explicitly in the declaration.** Overhang syllables on the longer suffix are outside the comparison. It is not whole-suffix equality.
- **Channels:** assonance has nucleus `AGREE` `each`. Consonance has coda `AGREE` `each`, plus the guard below.
- **Placement:** `Placement("both_line_final", polarity=False)`, so at least one member is not line-final. Same-line pairs are included. Pairs where both members are line-final stay with the existing `assonance` and `consonance`, which are unchanged, so no pair is counted twice.
- **Identity:** `DISTINCT` is `IdentityRule("token", DIFFER)` over lower-cased token text, a difference in normalised spelling. It is a separate rule from the earlier requirement of two distinct occurrence IDs (B1).

**The consonance guard: a new named predicate, `BothPresent`, on the coda channel.**
- **Scope:** the codas at the *last aligned syllable pair*, the last position that both members' alignment covers. For suffixes of equal length, that is each word's final coda. It never reads the excluded overhang.
- **Unknown is not empty.** If either coda is unknown under the reading being tried, the result is undecided, with `coda` in `unknown_channels`.
- **Rule 5:** the pair holds when one whole reading has both codas present and agreeing.
- **Pruning:** the guard narrows what coda Agree admits and can never add a hold, so existing Agree bucket pruning stays sound. The guard is evaluator-only at first, and a test asserts that pruned and unpruned runs give identical results. `_bucket_key` and `planning_traits` (`test_plan.py` §14) must learn the predicate. Until then, the planner refuses the schema loudly.
- **E-5 is untouched.** Line-final `consonance` keeps empty/empty agreement. The guard is a stated contract difference between the two consonance IDs.
- **Which pair is last.** `align_anchor` pairs syllables from the anchor outward, so the last aligned pair is at tail index `min(len(suffix a), len(suffix b)) − 1`. It is the anchor only when the shorter suffix has one syllable (3PO 6527437000, correcting the earlier wording here).
- **A stated limit (BB8, corrected by 3PO).** The guard reads codas as the syllabifier assigns them, so it depends on syllabification. village (`V IH1 | L AH0 JH`) against fill (coda `L`) does not hold. The shorter suffix has one syllable, so the compared pair is the anchors, and village's anchor coda is empty against fill's `L`. That already fails coda Agree. village's word-final coda is `JH`, and its `L` is the onset of the excluded second syllable. A word-end-anchored consonance (`word_end` spans) would be a separately named variant ID, never a silent change.

**Function words (John: "keep function words, option 1").** The schemas use dictionary stress, with no lexical stop list. Function-word holds stay in the evidence. Any reduction in what is drawn is a disclosed display filter, never an engine exclusion. A meter-stress source would be a separately named variant ID.

**Reading policy and route.** Both schemas are judged under rule 5 by the declared reading search. The witness is `reading_witness`'s `word = PHONES`, which gives each word's *whole-word* phones under the reading the verdict rests on, not the compared span. The compared span and anchor are separate metadata, derived from the alignment: the anchor index and the aligned pairs. The inspector shows the two separately and labels each, for example "witness: watch = W AA1 CH · woods = W UH1 D Z" and "compared: last stressed, aligned pairs (0,0)" (Don Norman's request, with 3PO's correction 6527437000). The reference route is the Library `AnalysisSession` schema namespace. Equality tests assert "undecided" with its `unknown_channels` for merged-reading pairs that the reference route doesn't resolve, so the merged-reading search fix arrives as a deliberate repin (O3).

**Shared reads and the sound layer.**
- **The reusable primitive:** channel reads keyed by (span pair, span rule, alignment, pinned whole-reading combination), bound to the resource, schema and policy versions. Each schema quantifies over the combinations itself. Per-channel existential results are never combined, so nucleus-under-A plus coda-under-B never makes a hold.
- **Sharing:** reads are shared only within one span family. Today that is `internal rhyme` and the two interior schemas. The cache fills lazily, from whichever consumer asks first.
- **The sound layer** (`layer: sound`, separately versioned, never called a figure) consumes these reads. Word-initial onset (`word_start`) and last-stressed onset are different span families, so they get different keys and are recorded as two separate observations.

**Reference tests.**
- **Inventory:** each test names the vowel inventory it runs on. The positive "shares the stressed vowel" fixture avoids NEAR/KIT and every other pair that the sound-inventory branch splits. On that branch, his~queer is a pinned negative.
- **Assonance:** a positive interior pair sharing the stressed vowel. A negative pair where both members are line-final, so the new schema must not fire. A negative with the same spelling.
- **Consonance:**
  - positive: two closed final codas that agree;
  - negative: both codas open;
  - negative: one open, one closed;
  - negative: a medial coda with open word ends;
  - negative: village~fill. The anchor codas are empty against `L`, so coda Agree already fails. The reason is stated without any word-final-L claim;
  - unequal suffix lengths: the overhang goes unread;
  - a 3-syllable suffix against a 2-syllable suffix: the last aligned pair is tail index 1, not the anchor. The test pins that the guard reads index 1;
  - witness against compared span: the witness shows whole-word phones, and the compared-span metadata names the aligned positions;
  - undecided: a merged-reading word whose coda varies by reading.
- **Equality:** each verdict equals the direct Library schema-namespace call.
- **Pruning soundness:** pruned and unpruned runs are identical.

## Open disputes / evidence needed
1. ~~R2: Anywhere as placement-stripped pair judge.~~ RESOLVED by R2 accepting 3PO's position (registered loci only; a sound layer needs its own contract).
2. ~~R2: reading disagreement = undecided.~~ RESOLVED: existential outcome, quantifier, completeness and witness stored apart (backend §2 truth table).
3. ~~R2: mutual-consistency badge.~~ RESOLVED: default "not assessed"; a certificate is required (backend §5).
4. ~~R2: 5778 × ~20 cost.~~ RESOLVED: arithmetic only; measurement gate (backend §7).
5. OPEN: BB8 has not yet posted. Jony Ives (6526596222, revised 6526665982) and Don Norman (6526586224) have posted positions, which are conditions rather than assent. No assent is assumed.
7. ~~Don Norman: six states versus five.~~ RESOLVED in the design: Jony Ives's 6526665982 adopts the six states (not yet computed = dotted grey outline "…"). Backend: not yet computed reads manifest/job progress (backend §2 `not_evaluated` population state), never an engine outcome.
6. OPEN (R2): the reading-search completeness flag is not returned by today's API (`reading_combos` computes it; `pair_satisfies_any`/`resolve_line_pair` drop it). The evidence fields `reading_search.state` and `termination_reason` need that engine change before any view can show "search cap". It must be costed and tested before it is promised.

**John's ruling on BB8's O1 (2026-10-30, asked by R2 directly):** (b), register interior assonance and consonance schemas. The views assume interior cells for those two families are evaluated like any other method, under the six-state rules. The engine work (loci, placement, channels, bucket keys and tests, with its own review) is UNASSIGNED and is not started from this design. Until it lands, a real build shows those cells as "Not examined · no registered interior schema yet". WIDENED by John (2026-10-30, to R2 directly): "you can add the sound layer as well, I'm not opposed to that. especially if there's synergy" — O1 is (b) and (c): registered interior assonance/consonance AND a separately versioned sound layer (`layer: sound`, never called a figure). Both are unassigned. Proposed definitions and the shared-primitive synergy: #519 R2 comment after 6527012014.

**John's ruling on interior-assonance function words (2026-10-30, to R2 directly):** "keep function words, option 1". So interior assonance keeps dictionary stress with no lexical stop list. Function-word holds (his, is, I, my) stay in the evidence. Any reduction in what is drawn is a disclosed display filter, named on the coverage line, set by the per-method display default that Don Norman and Jony Ives own. It is never an engine exclusion. A meter-stress source, if ever wanted, is a separately named variant ID. This settles BB8's condition 2 (6527091795).

## Review process
Named collaborators revise here, identify decisions/disagreements, point #519 to commit. Reconcile spec; render exact local design sources to PNG (not product implementation); all named collaborators inspect same revision and explicitly resolve objections before final presentation.
